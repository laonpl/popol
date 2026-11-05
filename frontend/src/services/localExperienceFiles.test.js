import test from 'node:test';
import assert from 'node:assert/strict';
import { scanLocalDirectory, scanLocalFileList, localFileSkipReason, decodeLocalText,
  organizeLocalFiles, mergeLocalCandidates, splitLocalCandidate, reconcileLocalCandidates, pdfItemsToText, automaticFileBatch, looksLikeExperience, LOCAL_FILE_LIMIT } from './localExperienceFiles.js';
import { buildLocalExperienceDraft } from '../utils/localExperienceDraft.js';
import { materialPlainText } from '../../../shared/materialPlainText.mjs';

const sample = '결제 개선 프로젝트\n역할: 기획자\n배경: 결제 단계의 높은 이탈률이 문제였습니다.\n한 일: 사용자 인터뷰를 진행하고 결제 단계를 줄였습니다.\n성과: 결제 전환율 18% 개선\n배운 점: 가설 검증의 중요성을 배웠습니다.';
const file = (name, text = sample, size = 200) => ({ name, size, lastModified: 100, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
const entry = (name, text = sample) => ({ kind: 'file', name, getFile: async () => file(name, text) });
const directory = (name, entries) => ({ kind: 'directory', name, async *values() { yield* entries; } });
const record = (name, text = sample) => ({ id: name, path: `경험/${name}`, name, size: 200, getFile: async () => file(name, text) });

test('recursive discovery reads metadata only and skips development, hidden and unsupported files', async () => {
  let reads = 0;
  const result = await scanLocalDirectory(directory('경험', [
    directory('팀프로젝트', [entry('회고.md'), { kind: 'file', name: '성과.txt', getFile: async () => ({ ...file('성과.txt'), arrayBuffer: () => { reads += 1; } }) }]),
    directory('node_modules', [entry('readme.md')]), directory('.git', [entry('notes.md')]),
    entry('.secret.txt'), entry('사진.png'), entry('과거.hwp'), entry('~$보고서.docx'),
  ]));
  assert.equal(reads, 0);
  assert.deepEqual(result.files.map(item => item.path).sort(), ['경험/팀프로젝트/성과.txt', '경험/팀프로젝트/회고.md']);
  assert.equal(result.skipped['숨김·시스템·개발 폴더'], 2);
  assert.equal(result.skipped['지원하지 않는 형식'], 2);
  assert.equal(localFileSkipReason('경험/빈.txt', 0), '빈 파일');
  assert.equal(localFileSkipReason('경험/큰.pdf', LOCAL_FILE_LIMIT + 1), '25MB 초과');
});

test('fallback keeps relative paths and discovery reports limits rather than silently finishing', async () => {
  const result = await scanLocalFileList([{ ...file('메모.md'), webkitRelativePath: '경험/동아리/메모.md' }]);
  assert.equal(result.files[0].path, '경험/동아리/메모.md');
  assert.equal((await result.files[0].getFile()).name, '메모.md');
  const many = Array.from({ length: 1002 }, (_, i) => ({ ...file(`${i}.txt`), webkitRelativePath: `폴더/${i}.txt` }));
  const limited = await scanLocalFileList(many);
  assert.equal(limited.files.length, 1000);
  assert.equal(limited.limited, true);
});

test('UTF-8, UTF-16 and legacy Korean text are decoded locally', () => {
  assert.equal(decodeLocalText(new TextEncoder().encode('경험 정리').buffer), '경험 정리');
  assert.equal(decodeLocalText(Uint8Array.from([255, 254, 0xbd, 0xac, 0xd8, 0xd5]).buffer), '경험');
  assert.equal(decodeLocalText(Uint8Array.from([0xb0, 0xe6, 0xc7, 0xe8]).buffer), '경험');
});

test('PDF glyph fragments preserve Korean words, real gaps, line breaks and numeric metrics', () => {
  const glyph = (str, x, y = 100, width = 10) => ({ str, transform: [1, 0, 0, 1, x, y], width, height: 12 });
  assert.equal(pdfItemsToText([glyph('경', 0), glyph('험', 10), glyph('정리', 30, 100, 20),
    glyph('성과:', 0, 80, 30), glyph('18', 40, 80, 20), glyph('%', 60, 80)]), '경험 정리\n성과: 18%');
});

test('local organization preserves quoted facts, deduplicates copies, and isolates unreadable files', async () => {
  const bad = { ...record('못읽음.txt'), getFile: async () => { throw new Error('접근 거부'); } };
  const result = await organizeLocalFiles([record('프로젝트.txt'), record('복사본.md'), bad]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, '결제 개선 프로젝트');
  assert.match(result.items[0].result, /18% 개선/);
  assert.equal(result.items[0].role, '기획자');
  assert.deepEqual(result.items[0].sourcePaths, ['경험/프로젝트.txt', '경험/복사본.md']);
  assert.deepEqual(result.items[0].localDocuments.map(document => document.path), ['경험/프로젝트.txt', '경험/복사본.md']);
  const draft = buildLocalExperienceDraft(result.items[0]);
  assert.match(draft.content['로컬 파일 원문'], /프로젝트.txt ---/);
  assert.match(draft.content['로컬 파일 원문'], /복사본.md ---/);
  assert.equal(result.failures[0].message, '접근 거부');
  assert.match(result.items[0].sourceText, /사용자 인터뷰/);
});

test('manually selected files group complementary project records and retain incomplete unrelated material', async () => {
  const result = await organizeLocalFiles([
    record('인터뷰 정리.md', '프로젝트명: 학교 공지 검색\n역할: 서비스 기획자\n한 일: 동아리 회원 8명을 인터뷰하고 공지 검색 화면을 설계했습니다.'),
    record('운영 결과.md', '프로젝트명: 학교 공지 검색\n성과: 동아리 회원의 공지 탐색 시간이 5분에서 1분으로 줄었습니다.'),
    record('별도 메모.md', '봄 축제 메모\n아직 역할과 실행한 작업은 기록하지 않았습니다. 추후 행사 결과를 확인할 예정입니다.'),
  ]);
  assert.equal(result.items.length, 2);
  assert.equal(result.rejected.length, 0, 'manual selection keeps its existing inclusion policy');
  const project = result.items.find(item => item.title === '학교 공지 검색');
  assert.deepEqual(project.sourcePaths, ['경험/인터뷰 정리.md', '경험/운영 결과.md']);
  assert.match(project.action, /인터뷰/);
  assert.match(project.result, /1분/);
  assert.equal(project.localDocuments.length, 2);
  assert.ok(result.items.some(item => item.sourcePaths.includes('경험/별도 메모.md')));
});

test('manual and automatic intake put contribution and outcome evidence before incomplete records', async () => {
  const records = [
    record('먼저 읽은 메모.md', '일정 정리 프로젝트\n역할: 동아리 운영 담당\n한 일: 회의 일정을 조율하고 회의 내용을 정리했습니다.'),
    record('나중에 읽은 회고.md', `${sample}\n과제: 결제 단계를 줄이고 고객 이탈을 개선해야 했습니다.`),
  ];
  for (const experienceOnly of [false, true]) {
    const result = await organizeLocalFiles(records, { experienceOnly });
    assert.equal(result.items.length, 2, 'an incomplete experience remains available for review');
    assert.equal(result.items[0].title, '결제 개선 프로젝트');
    assert.equal(result.items[0].recommendation.recommended, true);
    assert.ok(result.items[0].recommendation.reasons.length > 0);
    assert.ok(result.items[0].recommendation.score > result.items[1].recommendation.score);
    assert.equal(result.items[1].recommendation.recommended, false);
  }
});

test('manual merge and separation refresh recommendation evidence without inheriting a stale badge', async () => {
  const result = await organizeLocalFiles([
    record('과정.md', '프로젝트명: 결제 개선\n역할: 서비스 기획자\n한 일: 고객 12명을 인터뷰하고 결제 화면을 세 단계로 다시 설계했습니다.'),
    record('결과.md', '프로젝트명: 결제 개선\n성과: 결제 전환율이 18% 개선됐습니다.'),
  ]);
  const [combined] = result.items;
  assert.equal(combined.recommendation.recommended, true);
  const parts = splitLocalCandidate(combined);
  assert.equal(parts.length, 2);
  assert.ok(parts.every(part => !part.recommendation.recommended), 'separated incomplete records do not retain the combined recommendation');
  const merged = mergeLocalCandidates(parts);
  assert.equal(merged.recommendation.recommended, true);
  assert.ok(merged.recommendation.score > parts[0].recommendation.score);
});

test('later fusion changes a representative ID without duplicating a selected reviewed card or losing new evidence', async () => {
  const process = record('과정.md', '프로젝트명: 학교 공지 검색\n역할: 백엔드 개발자\n한 일: 회원 권한에 따라 공지 검색 결과를 분리했습니다.');
  const outcome = record('결과.md', '프로젝트명: 학교 공지 검색\n한 일: 검색 오류 로그를 분류하고 색인 조건을 수정했습니다.\n성과: 공지 탐색 시간이 5분에서 1분으로 줄었습니다.');
  const [old] = (await organizeLocalFiles([process])).items;
  const reviewed = { ...old, action: '회원별 권한 조건을 직접 검토했습니다.', localEdits: { action: '회원별 권한 조건을 직접 검토했습니다.' } };
  const fresh = (await organizeLocalFiles([process, outcome])).items.map(item => ({ ...item, id: 'new-representative' }));
  const result = reconcileLocalCandidates([reviewed], fresh, { selectedItems: new Set([old.id]) });
  assert.equal(result.items.length, 1);
  const [item] = result.items;
  assert.equal(item.id, old.id);
  assert.deepEqual([...result.selectedItems], [old.id]);
  assert.match(item.action, /직접 검토/);
  assert.match(item.action, /검색 오류 로그/);
  assert.match(item.result, /1분/);
  assert.equal(item.localDocuments.length, 2);
  assert.match(item.sourceText, /회원 권한/);
  assert.equal(result.preservedIds.has(old.id), true);
});

test('fusion of two visible cards preserves the saved record and keeps one local card without changing account records', async () => {
  const a = (await organizeLocalFiles([record('진행.md', '프로젝트명: 학교 공지 검색\n역할: 개발자\n한 일: 회원 권한에 따라 공지 검색 결과를 분리했습니다.')])).items[0];
  const b = (await organizeLocalFiles([record('배포.md', '프로젝트명: 학교 공지 검색\n역할: 개발자\n한 일: 검색 오류 로그를 수집하고 화면의 필터를 수정했습니다.\n성과: 시제품을 동아리 회원 30명에게 배포했습니다.')])).items[0];
  const records = { [a.id]: { experienceId: 'draft-1', status: 'draft' }, [b.id]: { experienceId: 'saved-2', status: 'complete' } };
  const fresh = mergeLocalCandidates([a, b]);
  const result = reconcileLocalCandidates([a, b], [{ ...fresh, id: 'fresh-fusion' }], { selectedItems: new Set([a.id]), records });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, b.id, 'the existing completed result keeps its local reference');
  assert.equal(result.selectedItems.size, 0, 'a completed experience is not silently selected for another analysis');
  assert.deepEqual(result.records, records);
  assert.equal(result.items[0].sourcePaths.length, 2);
  assert.equal(result.items[0].hasNewLocalSources, true, 'added sources are distinguished from the existing saved analysis');
});

test('two entries in one portfolio do not inherit each other’s edits just because their file path matches', async () => {
  const body = '01. 결제 화면 개선 프로젝트\n2025.01 ~ 2025.03\n역할: 기획자\n한 일: 결제 화면의 필수 입력을 줄이고 안내 문구를 수정했습니다.\n02. 축제 동선 운영 프로젝트\n2025.08 ~ 2025.09\n역할: 운영 담당\n한 일: 관객 안내 표지를 제작하고 입장 동선을 조정했습니다.';
  const previous = (await organizeLocalFiles([record('포트폴리오.md', body)])).items;
  const target = previous.find(item => item.title.includes('결제'));
  const reviewed = previous.map(item => item === target ? { ...item, role: '직접 검토한 기획 역할', localEdits: { role: '직접 검토한 기획 역할' } } : item);
  const fresh = previous.map(item => ({ ...item, id: `fresh:${item.id}` }));
  const result = reconcileLocalCandidates(reviewed, fresh, { selectedItems: new Set([target.id]) });
  assert.equal(result.items.length, 2);
  assert.equal(result.items.find(item => item.title.includes('결제')).role, '직접 검토한 기획 역할');
  assert.equal(result.items.find(item => item.title.includes('축제')).role, '운영 담당');
  assert.deepEqual([...result.selectedItems], [target.id]);
});

test('an explicit manual fusion retains every source through another pass and can still be separated', async () => {
  const a = (await organizeLocalFiles([record('검색.md', '검색 화면 개선 프로젝트\n역할: 개발자\n한 일: 검색 결과의 필터를 구현하고 오류 로그를 수집했습니다.')])).items[0];
  const b = (await organizeLocalFiles([record('운영.md', '축제 운영 프로젝트\n역할: 운영 담당\n한 일: 관객 안내 표지를 제작하고 입장 동선을 조정했습니다.')])).items[0];
  const merged = mergeLocalCandidates([a, b]);
  assert.equal(merged.localParts.length, 2);
  const result = reconcileLocalCandidates([merged], [a, b], { selectedItems: new Set([merged.id]) });
  assert.equal(result.items.length, 1, 'a later automatic pass respects the user’s explicit merge');
  assert.equal(result.items[0].localDocuments.length, 2);
  const separated = splitLocalCandidate(result.items[0]);
  assert.equal(separated.length, 2);
  assert.ok(separated.every(item => item.separateExperience && !item.manualFusion));
  assert.deepEqual(separated.flatMap(item => item.sourcePaths).sort(), [a.sourcePaths[0], b.sourcePaths[0]].sort());
});

test('unknown fields remain empty and multiple projects retain separate source excerpts', async () => {
  const text = '01. 결제 개선 프로젝트\n2025.01 ~ 2025.03\n한 일: 사용자 인터뷰를 진행하고 결제 화면을 개선했습니다.\n02. 캠퍼스 서비스 프로젝트\n2025.04 ~ 2025.08\n한 일: 동아리 회원을 위한 공지 서비스를 기획하고 개발했습니다.';
  const { items } = await organizeLocalFiles([record('포트폴리오.md', text)]);
  assert.equal(items.length, 2);
  assert.equal(items[0].period, '2025-01 ~ 2025-03');
  assert.equal(items[0].result, '');
  assert.doesNotMatch(items[0].sourceText, /동아리/);
  assert.match(items[1].sourceText, /동아리/);
});

test('cancellation stops the batch instead of reporting cancelled files as failures', async () => {
  const controller = new AbortController();
  let count = 0;
  await assert.rejects(organizeLocalFiles([record('one.md'), record('two.md')], {
    signal: controller.signal, read: async () => { count += 1; controller.abort(); return sample; },
  }), { name: 'AbortError' });
  assert.equal(count, 1);
  await assert.rejects(organizeLocalFiles(Array.from({ length: 31 }, () => record('x.md'))), /1~30/);
  await assert.rejects(organizeLocalFiles(Array.from({ length: 7 }, () => ({ ...record('x.pdf'), size: LOCAL_FILE_LIMIT }))), /150MB/);
});

test('merging retains evidence and saved drafts contain provenance and require confirmation', () => {
  const merged = mergeLocalCandidates([
    { id: 'a', title: '프로젝트', context: '문제', action: '인터뷰', result: '', learning: '', sourceText: '첫 번째 근거', sourcePaths: ['자료/기획.md'], keywords: ['인터뷰'] },
    { id: 'b', title: '회고', context: '', action: '실험', result: '10% 개선', learning: '', sourceText: '두 번째 근거', sourcePaths: ['자료/회고.md'], keywords: ['실험'] },
  ]);
  const payload = buildLocalExperienceDraft(merged, 'pm');
  assert.equal(payload.analysisMode, 'local_folder');
  assert.equal(payload.lifecycleStatus, 'needs_confirmation');
  assert.equal(payload.jobCategory, 'pm');
  assert.equal(payload.localSources.length, 2);
  assert.match(payload.content['로컬 파일 원문'], /기획.md ---\n첫 번째 근거/);
  assert.match(payload.content['로컬 파일 원문'], /회고.md ---\n두 번째 근거/);
  assert.match(payload.content.rawInput, /10% 개선/);
  assert.equal(payload.structuredResult.projectOverview.role, '');
  assert.equal('file' in payload, false);
});

test('automatic batches respect memory limits and exclude documents with no experience evidence', async () => {
  const files = Array.from({ length: 30 }, (_, i) => ({ ...record(`${i}.txt`), size: LOCAL_FILE_LIMIT }));
  assert.equal(automaticFileBatch(files).length, 6);
  assert.equal(automaticFileBatch(files, 29).length, 1);
  assert.equal(looksLikeExperience(sample), true);
  assert.equal(looksLikeExperience('이 설명서는 소프트웨어 라이선스와 일반적인 설치 방법을 안내합니다.'), false);
  const result = await organizeLocalFiles([record('manual.txt', '이 설명서는 소프트웨어 라이선스와 일반적인 설치 방법을 안내합니다.')], { experienceOnly: true });
  assert.equal(result.items.length, 0);
  assert.match(result.rejected[0].reason, /역할|기여|행동/);
});

test('HTML exports and Markdown become editable sentences before experience segmentation', async () => {
  const html = '<h3>01. 캠퍼스 앱 프로젝트</h3><p>2024.01 ~ 2024.06</p><ul><li><strong>역할:</strong> 개발자</li><li>한 일: 동아리의 공지 기능을 설계하고 개발했습니다.</li><li>성과: &lt;strong&gt;가입자 120명 확보&lt;/strong&gt;</li></ul>';
  const { items } = await organizeLocalFiles([record('경험.md', html)]);
  assert.equal(items[0].title, '캠퍼스 앱 프로젝트');
  assert.equal(items[0].role, '개발자');
  assert.equal(items[0].period, '2024-01 ~ 2024-06');
  assert.match(items[0].result, /120명 확보/);
  assert.doesNotMatch(JSON.stringify(items), /<\/?(?:li|strong|h3|p|ul)>|&lt;/);
  const md = '# 경험 프로젝트\n**역할:** 기획자\n- **한 일:** 사용자 인터뷰를 진행하고 가입 흐름을 개선했습니다.\n- **성과:** 전환율 18% 개선\n[시연](https://example.com/demo)';
  const parsed = await organizeLocalFiles([record('회고.md', md)]);
  assert.equal(parsed.items[0].title, '경험 프로젝트');
  assert.equal(parsed.items[0].role, '기획자');
  assert.doesNotMatch(parsed.items[0].sourceText, /\*\*|^#/m);
  assert.match(parsed.items[0].sourceText, /https:\/\/example.com\/demo/);
});

test('format cleanup preserves technical notation and numeric facts without executing HTML', () => {
  assert.equal(materialPlainText('C++ vector<T> · 1 < 2 · 42% → 55%'), 'C++ vector<T> · 1 < 2 · 42% → 55%');
  assert.equal(materialPlainText('&amp;lt;strong&amp;gt;기획 &amp; 개발&amp;lt;/strong&amp;gt;'), '기획 & 개발');
  assert.equal(materialPlainText('<script>alert("실행 금지")</script><p>실제 경험</p>'), '실제 경험');
  const draft = buildLocalExperienceDraft({ title: '<h4>인턴 경험</h4>', role: '**개발자**', sourceText: '<li>원문 행동: 공지 기능을 개발했습니다.</li>', sourcePaths: ['회고.md'] });
  assert.equal(draft.title, '인턴 경험');
  assert.doesNotMatch(JSON.stringify(draft), /<h4>|<li>|\*\*개발자/);
});
