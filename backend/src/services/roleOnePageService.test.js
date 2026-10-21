import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePm, normalizeCampaign, groundOnePage } from './roleOnePageService.js';

const SOURCE = '1인 가구 15명 인터뷰. 기록 완료율 71%, 이탈 34%에서 18%로. PRD 24쪽. OCR 신뢰도에 따라 자동 확정·사용자 확인·직접 입력으로 나눴다. Meta 광고 예산 1,200만원, 40대 고객, ROAS 405%. 소재 카피 "아침 5분, 든든하게"';

test('PM 한 장: 형식이 틀린 응답도 정해진 모양으로 맞춘다', () => {
  const page = normalizePm({
    headline: { label: '기록 완료율', value: '71%' },
    research: [{ label: '인터뷰', value: '15명' }, { value: '라벨 없음' }],
    decisions: [{ title: 'OCR 실패 복구', options: [{ label: '자동 확정', chosen: true }, { label: '전부 수동', chosen: 'yes' }], spec: { criteria: '문자열' } }],
  });
  assert.equal(page.research.length, 1);
  assert.equal(page.decisions[0].options[1].chosen, false);
  assert.deepEqual(page.decisions[0].spec.criteria, []);
  assert.deepEqual(page.flow, []);
});

test('자료에 없는 수치가 든 칸은 비우고 근거 있는 칸은 남긴다', () => {
  const page = groundOnePage(normalizePm({
    headline: { label: '기록 완료율', value: '71%', target: '90%' },
    research: [{ label: '설문', value: '126명' }],
    decisions: [{ title: '복구 정책', problem: '이탈이 52% 수준이었다', result: { label: '이탈', before: '34%', after: '18%' } }],
  }), SOURCE);
  assert.equal(page.headline.value, '71%');
  assert.equal(page.headline.target, '');
  assert.equal(page.research.length, 0); // 값이 지워진 행은 뺀다
  assert.equal(page.decisions[0].problem, ''); // 52%는 자료에 없다
  assert.equal(page.decisions[0].result.after, '18%');
});

test('마케터 한 장: 자료에 없는 채널 비중·카피는 빼고 자료의 카피는 유지', () => {
  const page = groundOnePage(normalizeCampaign({
    headline: { label: 'ROAS', value: '405%' },
    stats: [{ label: '예산', value: '1,200만원' }],
    channels: [{ name: 'Meta', share: 62 }, { name: '크리에이터', share: 40 }],
    executions: [{ title: '소재 A/B', creatives: [{ variant: 'A', hook: '아침 5분, 든든하게', metric: 'CTR 9.9%' }, { variant: 'B', hook: '저당 그래놀라로 건강한 아침' }] }],
  }), SOURCE);
  assert.equal(page.stats[0].value, '1,200만원');
  assert.equal(page.channels[0].share, 0);
  assert.equal(page.channels[1].share, 0); // '40대'의 40은 비중 근거가 아니다
  assert.equal(groundOnePage({ channels: [{ name: 'Meta', share: 40 }] }, 'Meta 광고 40% 집행').channels[0].share, 40);
  assert.equal(page.executions[0].creatives.length, 1); // 자료에 없는 카피는 뺀다
  assert.equal(page.executions[0].creatives[0].hook, '아침 5분, 든든하게');
  assert.equal(page.executions[0].creatives[0].metric, '');
});

test('정책·수용 기준에 자료에 없는 임계값을 만들면 그 항목을 뺀다', () => {
  const page = groundOnePage(normalizePm({
    exceptions: [{ step: '추출', label: 'OCR 신뢰도 낮음', handling: '직접 입력 유도' }, { step: '추출', label: '신뢰도 70% 미만', handling: '재촬영' }],
    decisions: [{ title: '복구 정책', spec: {
      criteria: ['영수증 정보를 3초 이내 추출한다', '자동 확정·사용자 확인·직접 입력 3단계로 나눈다'],
      policies: [{ condition: 'OCR 신뢰도 90% 이상', rule: '자동 확정' }, { condition: '신뢰도 낮음', rule: '직접 입력' }],
    } }],
  }), SOURCE);
  assert.deepEqual(page.exceptions.map(e => e.label), ['OCR 신뢰도 낮음']);
  assert.equal(page.decisions[0].spec.criteria.length, 0);
  assert.deepEqual(page.decisions[0].spec.policies, [{ condition: '신뢰도 낮음', rule: '직접 입력' }]);
});

test('사례 공통 칸(요약·목표·내 역할·회고)을 정리하고 자료에 없는 숫자가 든 역할은 비운다', () => {
  const page = groundOnePage(normalizePm({
    summary: '인터뷰 15명으로 문제를 좁혀 기록 완료율 71% 달성',
    contribution: ['PRD 24쪽 작성', '인터뷰 30명 진행', 123, ''],
    goal: '기록 완료율 목표', retrospective: '예외 처리를 먼저 설계해야 한다',
  }), SOURCE);
  assert.equal(page.summary, '인터뷰 15명으로 문제를 좁혀 기록 완료율 71% 달성');
  assert.deepEqual(page.contribution, ['PRD 24쪽 작성']); // '30명'·'123'은 자료에 없는 숫자
});
