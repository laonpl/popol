import test from 'node:test';
import assert from 'node:assert/strict';
import { assessLocalExperience, consolidateLocalEvidence, rankCoreExperiences, sortLocalExperiences } from './experienceSelection.mjs';

function record(id, fields = {}, extra = {}) {
  const title = fields.title || `${id} 프로젝트`;
  const data = { title, role: '', context: '', task: '', action: '', result: '', learning: '', ...fields };
  const labels = { role: '역할', context: '상황', task: '과제', action: '한 일', result: '성과', learning: '배운 점' };
  return {
    id, ...data, titleOrigin: 'source_project_name', projectNames: [title],
    sourcePaths: [`내 파일/${id}.md`],
    sourceText: [`프로젝트명: ${title}`, ...Object.entries(labels).filter(([field]) => data[field]).map(([field, label]) => `${label}: ${data[field]}`)].join('\n'),
    ...extra,
  };
}

const specific = (id = '가입 개선') => record(id, {
  role: '서비스 기획자',
  context: '회원이 가입 화면의 인증 단계에서 입력 방법을 이해하지 못했습니다.',
  task: '인증 오류 원인을 찾아 가입 이탈을 줄여야 했습니다.',
  action: '가입을 중단한 고객 12명을 인터뷰하고 인증 오류 로그를 분류해 필수 입력을 줄이는 화면을 설계했습니다.',
  result: '가입 완료율이 42%에서 55%로 개선됐습니다.',
  learning: '입력 항목을 늘리기보다 고객이 막힌 지점을 관찰하는 방법을 배웠습니다.',
});
const vague = (id = '가벼운 기록') => record(id, {
  role: '서비스 기획자', context: '프로젝트를 진행할 필요가 있었습니다.', task: '좋은 결과를 만들어야 했습니다.',
  action: '프로젝트를 기획하고 개발했습니다.', result: '좋은 성과를 얻었습니다.', learning: '많은 것을 배웠습니다.',
});

test('the marketing screenshot with achieved ROAS and revenue is recommended even with a missing task', () => {
  const campaign = record('저당간식 신제품런칭 캠페인', {
    role: 'Marketing Intern · 캠페인 오너',
    context: '저당 간식을 찾는 직장인에게 신제품을 알리고 첫 구매를 만들어야 했습니다.',
    action: '전환 장벽을 검토하고 광고 소재와 메시지를 A/B 테스트한 뒤 실험 기준을 문서화했습니다.',
    result: '첫달 매출 4,860만원, ROAS 405%, 신규 고객 68%를 달성했습니다.',
  });
  const [item] = sortLocalExperiences([campaign]);
  assert.equal(item.task, '');
  assert.equal(item.recommendation.recommended, true);
  assert.ok(item.recommendation.reasons.some(reason => /수치/.test(reason)));
  const metricOnly = { ...campaign, result: 'ROAS 405% 달성', sourceText: campaign.sourceText.replace(campaign.result, 'ROAS 405% 달성') };
  assert.equal(assessLocalExperience(metricOnly).recommendation.recommended, true);
});

test('specific contributions and actual impact outrank vague completed STAR fields', () => {
  const weak = vague('가나다'), strong = specific('하하하');
  const ranked = sortLocalExperiences([weak, strong]);
  assert.equal(ranked[0].id, strong.id, 'recommendation should beat alphabetical title order');
  assert.equal(ranked[0].recommendation.recommended, true);
  assert.equal(ranked[1].recommendation.recommended, false);
  assert.ok(ranked[0].recommendation.score > ranked[1].recommendation.score);
  assert.ok(ranked[0].recommendation.reasons.some(reason => /행동|수행/.test(reason)));
  assert.ok(ranked[0].recommendation.reasons.some(reason => /수치|결과/.test(reason)));
});

test('qualitative impact is recommendable without numbers or a filled-in role', () => {
  const qualitative = record('축제 관객 안내 개선', {
    context: '축제장 입구에 관객이 몰려 부스 앞 안전 통로가 막혔습니다.',
    task: '출입구와 대기 구역을 나누어 관객 충돌을 줄여야 했습니다.',
    action: '관객 동선을 관찰하고 부스 안내 표지를 제작해 안전 통로를 분리했습니다.',
    result: '현장 운영진이 새 동선 표지를 다음 행사에도 채택했고 관객 간 충돌이 없어졌습니다.',
  });
  const [item] = rankCoreExperiences([qualitative]);
  assert.ok(item, 'incomplete role does not exclude a concrete project');
  assert.equal(item.role, '', 'a missing role is not invented');
  assert.equal(item.recommendation.recommended, true);
  assert.ok(item.coreSelection.missing.includes('내 역할'));
  assert.ok(item.recommendation.reasons.some(reason => /완성|활용|개선/.test(reason)));
});

test('dates and task counts cannot make a generic result outrank a real qualitative outcome', () => {
  const counted = vague('가나다');
  counted.result = '2026년 3월에 작업 2개를 완료했습니다.';
  counted.sourceText += `\n성과: ${counted.result}`;
  const qualitative = record('후순위 이름', {
    role: '동아리 운영 담당',
    action: '영수증 대장을 스프레드시트로 옮기고 월별 결산표를 만들어 회원에게 공유했습니다.',
    result: '다음 총무가 같은 결산표를 재사용했고 영수증 누락 문제가 해결됐습니다.',
  });
  const ranked = sortLocalExperiences([counted, qualitative]);
  assert.equal(ranked[0].id, qualitative.id);
  assert.equal(ranked[0].recommendation.recommended, true);
  assert.ok(!ranked[1].recommendation.reasons.some(reason => reason.includes('수치')));
});

test('a concise before-and-after metric remains evidence without a full sentence ending', () => {
  const item = specific();
  item.sourceText = item.sourceText.replace(item.result, '가입 완료율 42% → 55%');
  item.result = '가입 완료율 42% → 55%';
  const quality = assessLocalExperience(item).recommendation;
  assert.equal(quality.recommended, true);
  assert.ok(quality.reasons.some(reason => reason.includes('수치')));
});

test('long source text, repeated keywords and extra files do not increase recommendation strength', () => {
  const single = specific();
  const repeated = { ...single, id: 'repeated',
    sourcePaths: Array.from({ length: 30 }, (_, index) => `복사본/${index}.md`),
    sourceText: `${single.sourceText}\n${single.sourceText.repeat(15)}\n${'설계 분석 개발 구현 기획 협업 성과 경험 프로젝트 '.repeat(50)}`,
  };
  const one = assessLocalExperience(single).recommendation;
  const many = assessLocalExperience(repeated).recommendation;
  assert.deepEqual(many, one);
  const weak = vague();
  const keywordStuffed = { ...weak, sourceText: `${weak.sourceText}\n${'인터뷰 테스트 검증 실험 설계 분석 개발 구현 기획 '.repeat(100)}` };
  assert.deepEqual(assessLocalExperience(keywordStuffed).recommendation, assessLocalExperience(weak).recommendation);
});

test('invented outcome fields receive no source-backed recommendation bonus', () => {
  const noResult = specific();
  noResult.result = '';
  noResult.sourceText = noResult.sourceText.split('\n').filter(line => !line.startsWith('성과:')).join('\n');
  const invented = { ...noResult, result: '가입 완료율이 10%에서 99%로 개선됐습니다.' };
  const originalQuality = assessLocalExperience(noResult).recommendation;
  const inventedQuality = assessLocalExperience(invented).recommendation;
  assert.equal(inventedQuality.score, originalQuality.score);
  assert.ok(!inventedQuality.reasons.some(reason => reason.includes('수치')));
});

test('title-review candidates remain visible below verified experiences', () => {
  const verified = specific('확인된 가입 개선');
  const review = { ...specific('제목 미정'), title: '경험 제목 확인 필요', titleOrigin: 'needs_review', needsTitleReview: true, projectNames: [] };
  const ranked = sortLocalExperiences([review, verified]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, verified.id);
  assert.equal(ranked[1].recommendation.recommended, false);
  assert.ok(ranked[1].recommendation.reasons.some(reason => /제목.*확인/.test(reason)));
});

test('sorting retains fragments, recomputes stale scores, and does not mutate or regroup input', () => {
  const strong = specific('하하하');
  const fragment = record('가나다', { role: '개발자' }, { separateExperience: true, coreSelection: { eligible: true, score: 999 } });
  const input = [fragment, strong];
  const before = JSON.stringify(input);
  const ranked = sortLocalExperiences(input);
  assert.equal(ranked.length, input.length);
  assert.equal(ranked[0].id, strong.id);
  assert.equal(ranked[1].recommendation.recommended, false);
  assert.equal(ranked[1].coreSelection.eligible, false);
  assert.equal(JSON.stringify(input), before);
  assert.notEqual(ranked, input);
});

test('automatic and explicit selection use the same recommendation order', () => {
  const candidates = [vague('가나다'), specific('하하하'), record('조각', { role: '개발 담당' })];
  const grouped = consolidateLocalEvidence(candidates);
  const explicit = sortLocalExperiences(grouped);
  const automatic = rankCoreExperiences(grouped, { consolidated: true });
  assert.deepEqual(automatic.map(item => item.id), explicit.filter(item => item.coreSelection.eligible).map(item => item.id));
  assert.equal(automatic[0].id, '하하하');
});

test('descriptive titles retain their source origin through grouping and can be recommended', () => {
  const a = specific('인증 화면 개선');
  delete a.projectNames;
  a.titleOrigin = 'source_description';
  a.sourceText = a.sourceText.replace(/^프로젝트명:[^\n]+\n/, '');
  const b = { ...a, id: '발표', sourcePaths: ['내 파일/발표.md'], sourceText: `${a.sourceText}\n발표 기록` };
  const [group] = consolidateLocalEvidence([a, b]);
  assert.equal(group.localParts.length, 2);
  assert.equal(group.titleOrigin, 'source_description');
  assert.equal(sortLocalExperiences([group])[0].recommendation.recommended, true);
});
