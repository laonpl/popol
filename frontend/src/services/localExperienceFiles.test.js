import test from 'node:test';
import assert from 'node:assert/strict';
import { scanLocalDirectory, scanLocalFileList, localFileSkipReason, decodeLocalText,
  pdfItemsToText, prioritizeLocalFiles, groupExperienceFolders, LOCAL_FILE_LIMIT } from './localExperienceFiles.js';
import { buildLocalExperienceDraft } from '../utils/localExperienceDraft.js';
import { materialPlainText } from '../../../shared/materialPlainText.mjs';

const sample = '결제 개선 프로젝트\n역할: 기획자\n배경: 결제 단계의 높은 이탈률이 문제였습니다.\n한 일: 사용자 인터뷰를 진행하고 결제 단계를 줄였습니다.\n성과: 결제 전환율 18% 개선\n배운 점: 가설 검증의 중요성을 배웠습니다.';
const file = (name, text = sample, size = 200) => ({ name, size, lastModified: 100, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
const entry = (name, text = sample) => ({ kind: 'file', name, getFile: async () => file(name, text) });
const directory = (name, entries) => ({ kind: 'directory', name, async *values() { yield* entries; } });

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

test('detailed project material is read before résumé summaries, references and extra copies', () => {
  const now = Date.UTC(2026, 10, 13);
  const row = (path, lastModified = now - 86400000, drive = 'C:') => ({ id: path, path, name: path.split('/').at(-1), lastModified, drive });
  const files = [
    row('다운로드/김유신_이력서 (1).hwpx', now - 9 * 86400000), row('다운로드/김유신_이력서 (2).hwpx', now - 5 * 86400000),
    row('다운로드/김유신_이력서.hwpx', now - 7 * 86400000), row('문서/마케팅 강의자료.pdf'),
    row('바탕화면/FitPoly/FitPoly 기획서.pptx'), row('바탕화면/FitPoly/결과 보고서.docx'), row('문서/메모.txt'),
  ];
  const ordered = prioritizeLocalFiles(files, now).map(file => file.path);
  assert.deepEqual(ordered.slice(0, 3), ['바탕화면/FitPoly/FitPoly 기획서.pptx', '바탕화면/FitPoly/결과 보고서.docx', '다운로드/김유신_이력서 (2).hwpx']);
  assert.ok(ordered.indexOf('문서/마케팅 강의자료.pdf') > ordered.indexOf('문서/메모.txt'));
  assert.deepEqual(ordered.slice(-2).sort(), ['다운로드/김유신_이력서 (1).hwpx', '다운로드/김유신_이력서.hwpx'], 'older copies of one résumé go last');
});

test('reading priority alternates drives and keeps project folders together', () => {
  const row = (path, drive) => ({ id: path, path, name: path.split('/').at(-1), lastModified: 1, drive });
  const ordered = prioritizeLocalFiles([row('C/프로젝트 보고서 1.docx', 'C:'), row('C/프로젝트 보고서 2.docx', 'C:'), row('D/프로젝트 회고.md', 'D:')]);
  assert.deepEqual(ordered.map(file => file.drive), ['C:', 'D:', 'C:']);
  const grouped = groupExperienceFolders([row('바탕화면/포트폴리오/쇼핑몰 리뉴얼/기획.docx'), row('문서/메모.txt'), row('바탕화면/포트폴리오/쇼핑몰 리뉴얼/발표.pptx')]);
  assert.deepEqual(grouped.map(file => file.path), ['바탕화면/포트폴리오/쇼핑몰 리뉴얼/기획.docx', '바탕화면/포트폴리오/쇼핑몰 리뉴얼/발표.pptx', '문서/메모.txt']);
});

test('format cleanup preserves technical notation and numeric facts without executing HTML', () => {
  assert.equal(materialPlainText('C++ vector<T> · 1 < 2 · 42% → 55%'), 'C++ vector<T> · 1 < 2 · 42% → 55%');
  assert.equal(materialPlainText('&amp;lt;strong&amp;gt;기획 &amp; 개발&amp;lt;/strong&amp;gt;'), '기획 & 개발');
  assert.equal(materialPlainText('<script>alert("실행 금지")</script><p>실제 경험</p>'), '실제 경험');
  const draft = buildLocalExperienceDraft({ title: '<h4>인턴 경험</h4>', role: '**개발자**', sourceText: '<li>원문 행동: 공지 기능을 개발했습니다.</li>', sourcePaths: ['회고.md'] });
  assert.equal(draft.title, '인턴 경험');
  assert.doesNotMatch(JSON.stringify(draft), /<h4>|<li>|\*\*개발자/);
});
