import test from 'node:test';
import assert from 'node:assert/strict';
import { scanLocalDirectory, scanLocalFileList, localFileSkipReason, decodeLocalText,
  organizeLocalFiles, mergeLocalCandidates, pdfItemsToText, automaticFileBatch, looksLikeExperience, LOCAL_FILE_LIMIT } from './localExperienceFiles.js';
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
  assert.equal(result.failures[0].message, '접근 거부');
  assert.match(result.items[0].sourceText, /사용자 인터뷰/);
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
