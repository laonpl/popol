import test from 'node:test';
import assert from 'node:assert/strict';
import { getRoleExperienceIntake, roleIntakeText, roleInterviewFallback, roleQuickFields, roleEditorFields } from './roleExperienceIntake.js';

test('intake serializes only actual answers from the selected role', () => {
  const answers = { customerEvidence: '  배송비를 늦게 알게 된다는 고객 인터뷰  ', creativeExperiments: '사용 장면 소재를 비교했다.', strategy: '   ', unknown: '포함하지 않음' };
  assert.equal(roleIntakeText('pm', answers), '고객 문제와 발견 근거\n배송비를 늦게 알게 된다는 고객 인터뷰');
  assert.equal(roleIntakeText('marketer', answers), '메시지·소재와 실험\n사용 장면 소재를 비교했다.');
  assert.equal(roleIntakeText('pm'), '');
  assert.equal(roleIntakeText('dev', answers), '');
});

test('PM and marketer interviews capture distinct decisions, artifacts and measurement', () => {
  const pm = roleInterviewFallback('pm');
  const marketing = roleInterviewFallback('marketer');
  assert.equal(pm.length, 5);
  assert.equal(marketing.length, 5);
  assert.match(pm.map(item => item.question).join('\n'), /PRD·유저 플로우·수용 기준/);
  assert.match(pm.map(item => item.question).join('\n'), /영향·공수·제약/);
  assert.match(marketing.map(item => item.question).join('\n'), /메시지와 소재/);
  assert.match(marketing.map(item => item.question).join('\n'), /노출·클릭·전환·비용/);
  assert.equal(pm.find(item => item.key === 'output').target, 'evidence');
  assert.equal(marketing.find(item => item.key === 'output').target, 'evidence');
  assert.ok(pm.toSorted((a, b) => b.valueScore - a.valueScore).slice(0, 3).some(item => item.key === 'output'), 'quick interviews still ask about verification');
  assert.ok(marketing.toSorted((a, b) => b.valueScore - a.valueScore).slice(0, 3).some(item => item.key === 'output'), 'quick interviews still ask about campaign results');
  assert.deepEqual(roleInterviewFallback('dev'), []);
});

test('quick capture keeps persisted field keys and validation while tailoring questions', () => {
  const fields = [{ key: 'context', label: '문제', rows: 3, required: true }, { key: 'action', label: '행동', rows: 3, required: true }];
  const pm = roleQuickFields('pm', fields);
  const marketer = roleQuickFields('marketer', fields);
  assert.match(pm[0].label, /고객 문제/);
  assert.match(marketer[0].label, /타깃과 퍼널/);
  assert.deepEqual(pm.map(({ key, rows, required }) => ({ key, rows, required })), fields.map(({ key, rows, required }) => ({ key, rows, required })));
  assert.equal(fields[0].label, '문제');
  assert.deepEqual(roleQuickFields('dev', fields), fields);
});

test('existing specialist entries remain editable without duplicating reused keys', () => {
  const existing = [{ key: 'funnel', label: '이전 캠페인' }, { key: 'resumeBullets', label: '이력서 문장' }, { key: 'jdKeywordMap', label: '직무 키워드' }];
  const fields = roleEditorFields('marketer', existing, { funnel: '진행 중', resumeBullets: '직접 작성한 문장' });
  assert.equal(fields.filter(item => item.key === 'funnel').length, 1);
  assert.ok(fields.some(item => item.key === 'creativeExperiments'));
  assert.ok(fields.some(item => item.key === 'resumeBullets'));
  assert.ok(!fields.some(item => item.key === 'jdKeywordMap'));
  assert.equal(roleEditorFields('dev', existing), existing);
  assert.deepEqual(roleEditorFields('common'), []);
});

test('sample copy is explicitly an example and never prefilled as source evidence', () => {
  for (const role of ['pm', 'marketer']) {
    assert.match(getRoleExperienceIntake(role).example, /^예시:/);
    assert.equal(roleIntakeText(role, { [getRoleExperienceIntake(role).fields[0].key]: '' }), '');
  }
});
