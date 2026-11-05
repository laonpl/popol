import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidateLocalEvidence, rankCoreExperiences, fuseLocalExperienceFields } from './experienceSelection.mjs';

function part(id, fields = {}, project = 'QRious') {
  const path = `내 파일/${id}.md`;
  const data = { role: '백엔드 개발자', context: '', task: '', action: '', result: '', learning: '', ...fields };
  const sourceText = [`프로젝트명: ${project}`, ...Object.entries(data).filter(([, value]) => value).map(([key, value]) =>
    `${({ role: '역할', context: '상황', task: '과제', action: '한 일', result: '성과', learning: '배운 점' })[key]}: ${value}`)].join('\n');
  return { id, title: '개발 기록', ...data, sourceText, sourcePaths: [path], localDocuments: [{ path, text: sourceText }] };
}

test('fusion removes repeated or wholly contained source sentences while retaining distinct contributions and facts', () => {
  const a = part('개발 과정', {
    action: '학술 자료 검색 파이프라인을 구현했습니다.',
    result: '검색 시간을 5초에서 2초로 단축했습니다.',
  });
  const b = part('구현 회고', {
    action: '3만 건을 처리하는 학술 자료 검색 파이프라인을 구현했습니다.\n답변마다 근거 문서 출처를 표시하는 필터를 구현했습니다.',
    result: '교수별 필터를 적용해 검색 시간을 5초에서 2초로 단축했습니다.\n해커톤에서 2등을 수상했습니다.',
  });
  const c = part('추가 개선', { action: '교수별 벡터 색인을 분리했습니다.', result: '검색 시간을 2초에서 1초로 단축했습니다.' });
  const [group] = rankCoreExperiences([a, b, c]);
  assert.equal(group.localParts.length, 3);
  assert.deepEqual(group.action.split('\n'), [
    '3만 건을 처리하는 학술 자료 검색 파이프라인을 구현했습니다.',
    '답변마다 근거 문서 출처를 표시하는 필터를 구현했습니다.',
    '교수별 벡터 색인을 분리했습니다.',
  ]);
  assert.equal(group.result.split('\n').length, 3);
  assert.match(group.result, /5초에서 2초/);
  assert.match(group.result, /2초에서 1초/);
  assert.match(group.result, /2등/);
  assert.equal(group.recommendation.recommended, true);
  for (const original of [a, b, c]) {
    assert.ok(group.sourcePaths.includes(original.sourcePaths[0]));
    assert.ok(group.localDocuments.some(doc => doc.path === original.sourcePaths[0] && doc.text === original.sourceText));
    assert.ok(group.sourceText.includes(original.sourceText));
  }
});

test('the public field fusion helper preserves original sentences and does not combine different numeric facts', () => {
  const fields = fuseLocalExperienceFields([
    { role: '개발 담당', action: '공지 검색 API를 구현했습니다.', result: '검색 완료율이 42%에서 55%로 개선됐습니다.' },
    { role: '개발 담당', action: '공지 검색 API를 구현했습니다.\n회원별 접근 권한을 확인하는 필터를 구현했습니다.', result: '검색 완료율이 55%에서 61%로 개선됐습니다.' },
  ]);
  assert.equal(fields.role, '개발 담당');
  assert.equal(fields.action.split('\n').length, 2);
  assert.equal(fields.result.split('\n').length, 2);
  assert.match(fields.result, /42%에서 55%/);
  assert.match(fields.result, /55%에서 61%/);
  const decimalFacts = fuseLocalExperienceFields([
    { result: '평균 검색 지연을 1.5초로 단축했습니다.' },
    { result: '평균 검색 지연을 15초로 단축했습니다.' },
  ]);
  assert.equal(decimalFacts.result.split('\n').length, 2, 'decimal and whole-number measurements are different source facts');
});

test('regrouping a fused and ranked project is idempotent and retains its recommendation', () => {
  const originals = [
    part('설계', { context: '교수별 연구 관심사가 뒤섞여 검색 결과를 구분하기 어려웠습니다.', task: '검색 결과에서 연구자별 근거를 확인할 수 있어야 했습니다.', action: '교수별 벡터 색인을 나누고 검색 출처 필터를 구현했습니다.' }),
    part('검증', { action: '실제 질의 로그를 분류해 문서 검색 누락 원인을 확인하고 색인 규칙을 수정했습니다.', result: '검색 응답 시간을 5초에서 2초로 단축했습니다.' }),
  ];
  const [first] = rankCoreExperiences(originals);
  const [again] = rankCoreExperiences([first, originals[1]]);
  assert.equal(again.title, 'QRious');
  assert.equal(again.titleOrigin, 'source_project_name');
  assert.equal(again.action, first.action);
  assert.equal(again.result, first.result);
  assert.equal(again.sourceText, first.sourceText);
  assert.deepEqual(again.sourcePaths, first.sourcePaths);
  assert.equal(again.localParts.length, 2);
  assert.deepEqual(again.recommendation, first.recommendation);
});

test('large documents with the same explicit project name stay one card without dropping their source documents', () => {
  const a = part('긴 설계기록', { action: '교수별 벡터 색인을 나누고 검색 출처 필터를 구현했습니다.' });
  const b = part('긴 결과기록', { result: '검색 응답 시간을 5초에서 2초로 단축했습니다.' });
  a.sourceText += `\n${'설계 문서의 세부 검토 기록입니다.\n'.repeat(3500)}`;
  b.sourceText += `\n${'결과 문서의 세부 검증 기록입니다.\n'.repeat(3500)}`;
  a.localDocuments[0].text = a.sourceText;
  b.localDocuments[0].text = b.sourceText;
  assert.ok(a.sourceText.length + b.sourceText.length > 100000);
  const groups = consolidateLocalEvidence([a, b]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].localDocuments.length, 2);
  assert.ok(groups[0].sourceText.includes(a.sourceText));
  assert.ok(groups[0].sourceText.includes(b.sourceText));
});

test('fused projects retain every independent contribution and result beyond the old per-card extraction caps', () => {
  const originals = [0, 1].map(batch => part(`색인 검증 ${batch + 1}`, {
    action: Array.from({ length: 12 }, (_, i) => `문서 유형 ${batch * 12 + i + 1}번의 검색 로그를 확인하고 개별 색인 규칙을 구현했습니다.`).join('\n'),
    result: Array.from({ length: 12 }, (_, i) => `문서 유형 ${batch * 12 + i + 1}번의 검색 지연이 ${i + 50}초에서 ${i + 5}초로 단축됐습니다.`).join('\n'),
  }));
  const [group] = rankCoreExperiences(originals);
  assert.equal(group.action.split('\n').length, 24);
  assert.equal(group.result.split('\n').length, 24);
  assert.match(group.action, /유형 24번/);
  assert.match(group.result, /유형 24번/);
  assert.equal(group.recommendation.recommended, true);
});

test('source-confirmed bilingual aliases fuse fields under an explicit project title', () => {
  const english = part('영문 설계', { action: '교수별 학술 자료를 나눠 검색 색인 파이프라인을 구현했습니다.' }, 'QRious (큐리어스)');
  const korean = part('한글 결과', { result: '학술 검색 응답 시간을 5초에서 2초로 단축했습니다.' }, '큐리어스');
  const groups = rankCoreExperiences([english, korean]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'QRious');
  assert.equal(groups[0].titleOrigin, 'source_project_name');
  assert.match(groups[0].action, /색인 파이프라인/);
  assert.match(groups[0].result, /5초에서 2초/);
  assert.equal(groups[0].localDocuments.length, 2);
});
