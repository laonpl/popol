import test from 'node:test';
import assert from 'node:assert/strict';
import { findResearchScale, findDeliverables, buildPmOnePage, buildCampaignOnePage, parseAmount, toSavedPage } from './roleOnePage.js';

test('리서치 규모: 문장 속 다른 숫자를 조사 규모로 읽지 않는다', () => {
  const found = findResearchScale('1인 가구 15명 인터뷰에서 11명이 포기했습니다. 기존 서비스 리뷰 240건, 설문 126명. 테스트 사용자 48명 기준');
  assert.deepEqual(found, [
    { label: '사용자 인터뷰', value: '15명' },
    { label: '리뷰 분석', value: '240건' },
    { label: '설문', value: '126명' },
    { label: '사용성 테스트', value: '48명' },
  ]);
});

test('산출물: 분량이 적힌 것을 먼저, 앞에 숫자가 오는 표현도 읽는다', () => {
  const found = findDeliverables('PRD 24쪽, 와이어프레임 32화면, QA 테스트케이스 86개, 15장 제안서를 완성했습니다.');
  assert.deepEqual(found.map(d => `${d.name}:${d.value}`), ['PRD:24쪽', '와이어프레임:32화면', '테스트케이스:86개', '제안서:15장']);
});

test('저장된 분석 칸이 우선하고 빈 칸은 기존 데이터로 채운다', () => {
  const sr = {
    product: { problem: '입력이 번거로움', solution: '사진 한 장 기록' },
    keyExperiences: [{ title: 'OCR 복구', metricLabel: '이탈률', beforeMetric: '34%', afterMetric: '18%', jobData: { decision: '신뢰도별 3단계', alternatives: '전부 수동 입력' } }],
    pmOnePage: { source: 'analysis', headline: { label: '기록 완료율', value: '71%' }, problem: '', decisions: [] },
  };
  const page = buildPmOnePage({ sr, cs: { meta: { role: 'PM' } } });
  assert.equal(page.headline.value, '71%');
  assert.equal(page.problem, '입력이 번거로움');
  assert.equal(page.decisions[0].options[0].chosen, true);
  assert.equal(page.decisions[0].options[1].label, '전부 수동 입력');
  assert.equal(page.analyzed, true);
});

test('사용자가 편집한 한 장은 지운 칸을 다시 채우지 않는다', () => {
  const sr = { product: { outcomes: [{ label: '완료율', value: '71%' }] } };
  const derived = buildPmOnePage({ sr });
  assert.equal(derived.outcomes.length, 1);
  const saved = toSavedPage({ ...derived, outcomes: [] });
  const page = buildPmOnePage({ sr: { ...sr, pmOnePage: saved } });
  assert.deepEqual(page.outcomes, []);
  assert.equal(page.edited, true);
});

test('마케터: 채널 믹스 비중을 합계 기준으로 계산하고 퍼널 수치를 읽기 쉽게', () => {
  const page = buildCampaignOnePage({ sr: { portfolioVisuals: {
    mix: [{ label: 'Meta', value: '600만' }, { label: '네이버', value: '400만' }],
    funnel: [{ label: '노출', value: '1240000', unit: '명' }],
  } } });
  assert.deepEqual(page.channels, [{ name: 'Meta', share: 60 }, { name: '네이버', share: 40 }]);
  assert.equal(page.funnel[0].value, '1,240,000명');
  assert.equal(parseAmount('3.4만'), 34000);
});

test('원문 속 예시 화면 숫자를 이 캠페인 성과로 가져오지 않는다 (스크린샷 회귀)', () => {
  const page = buildCampaignOnePage({
    sr: { product: { problem: '73%의 취준생이 포트폴리오에 40시간을 쓴다', outcomes: [{ label: '제작 시간', value: '40시간 → 12분' }] }, keyExperiences: [{ title: '핵심 경험 1' }, { title: '릴스 3편 운영', context: '팔로워 120명에서 시작' }] },
    cs: { tech: ['채널', '운영', '블로그', '인스타', '유튜브', 'Canva'] },
    sourceText: '예시 화면: 모닝빈 캠페인 첫 달 매출 4,860만원, 신규 고객 68%',
  });
  assert.equal(page.stats.some(s => s.value.includes('4,860')), false);
  assert.deepEqual(page.stats, [{ label: '팔로워', value: '120명' }]);
  assert.equal(page.problem, ''); // 서비스 소개 문제는 캠페인 과제가 아니다
  assert.equal(page.headline.value, ''); // 서비스 성과도 캠페인 성과가 아니다
  assert.deepEqual(page.outcomes, []);
  assert.deepEqual(page.executions.map(x => x.title), ['릴스 3편 운영']); // 자리표시 제목뿐인 경험은 뺀다
  assert.deepEqual(page.channels.map(c => c.name), ['블로그', '인스타', '유튜브']);
  assert.deepEqual(page.tools, ['Canva']);
});

test('한 칸에 적힌 전후 값을 이전/이후로 나눈다', async () => {
  const { splitChange } = await import('./roleOnePage.js');
  assert.deepEqual(splitChange({ label: '제작 시간', value: '평균 40시간 이상 → 12분' }), { label: '제작 시간', value: '12분', before: '평균 40시간 이상', target: '' });
  assert.equal(splitChange({ value: '71%', before: '55%' }).before, '55%');
});

test('사례 공통 칸: 한 장 정리의 내 역할을 우선, 없으면 핵심 경험 실행을 한 줄씩', async () => {
  const { brief } = await import('./roleOnePage.js');
  const withRole = buildPmOnePage({ sr: { keyExperiences: [{ title: 'OCR', action: '정책을 설계했다', roleSummary: { headline: '기록 완료율 71%', myRole: 'PRD 작성\n인터뷰 진행' } }] } });
  assert.equal(withRole.summary, '기록 완료율 71%');
  assert.deepEqual(withRole.contribution, ['PRD 작성', '인터뷰 진행']);
  const fromActions = buildCampaignOnePage({ sr: { marketerKit: { funnel: { goal: '첫 구매 전환' } }, keyExperiences: [{ title: '소재 테스트', action: '세로 영상 소재를 확대했다. 이후 CPA를 봤다.' }] } });
  assert.deepEqual(fromActions.contribution, ['세로 영상 소재를 확대했다.']);
  assert.equal(fromActions.goal, '첫 구매 전환');
  assert.equal(brief('첫 문장입니다. 둘째 문장'), '첫 문장입니다.');
});

test('PM 성과: 문제 정의의 현황 통계를 대표 지표·주요 성과로 쓰지 않고 핵심 경험 결과를 먼저 (DD 화면 회귀)', () => {
  const sr = {
    product: {
      problem: '취준생은 포트폴리오 제작에 평균 40시간 이상을 쓰고, 62%가 직무별로 다시 만든다.',
      outcomes: [
        { label: '취준생 포트폴리오 제작 시간 (평균)', value: '40시간 이상' },
        { label: '직무별 재작성 비율', value: '62%' },
        { label: '제작 시간', value: '40시간 이상 → 12분' },
      ],
    },
    keyExperiences: [{ title: '온보딩 개편', metricLabel: '가입 완료율', afterMetric: '71%', action: '가입 단계를 4단계에서 2단계로 줄였다. 이후 로그를 봤다. 이 문장은 아주 길어서 예전에는 일흔 자에서 잘렸지만 이제는 첫 문장을 통째로 보여준다' }],
  };
  const page = buildPmOnePage({ sr });
  assert.equal(page.headline.value, '12분'); // 전후가 있는 결과가 먼저
  assert.deepEqual(page.outcomes.map(o => o.value), ['71%', '40시간 이상 → 12분']);
  assert.equal(page.contribution[0], '가입 단계를 4단계에서 2단계로 줄였다.');
  const noChange = buildPmOnePage({ sr: { ...sr, product: { ...sr.product, outcomes: sr.product.outcomes.slice(0, 2) } } });
  assert.equal(noChange.headline.value, '71%');
});

test('기간은 개월 수로 읽는다', async () => {
  const { periodLength } = await import('./roleOnePage.js');
  assert.equal(periodLength('2026-02 ~ 2026-06'), '5개월');
  assert.equal(periodLength('2025.09 — 2025.12 · 4개월'), '4개월');
  assert.equal(periodLength('상시 운영'), '상시 운영');
});
