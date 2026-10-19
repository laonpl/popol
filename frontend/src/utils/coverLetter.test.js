import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countCharacters, normalizeAnalysis, normalizeCoverLetter, normalizeGeneratedAnswer,
  normalizeGeneratedAnswers, normalizeQuestions, recommendExperiences, experienceSourceRecords, stripUndefined,
} from './coverLetter.js';

test('character counts respect spaces, Korean, emoji and Windows line endings', () => {
  assert.equal(countCharacters('가 나\r\n🙂'), 5);
  assert.equal(countCharacters('가 나\r\n🙂', false), 3);
  assert.equal(countCharacters(null), 0);
});

test('question normalization keeps source evidence and unknown limits without inventing prompts', () => {
  assert.deepEqual(normalizeQuestions([]), []);
  assert.deepEqual(normalizeQuestions(null), []);
  const values = normalizeQuestions([
    { id: 'q', question: '협업 경험을 알려주세요.', maxLength: '700', countSpaces: false, source: 'posting', sourceQuote: '협업 경험을 알려주세요.', answer: '내 문장', linkedExperienceIds: ['e1', 'e1', undefined] },
    { id: 'q', question: '지원 동기', maxLength: '알 수 없음', source: 'suggested' },
    { id: 'q', question: '직접 추가', maxLength: 0.5 },
  ]);
  assert.deepEqual(values.map(item => item.id), ['q', 'q-2', 'q-3']);
  assert.equal(values[0].source, 'posting');
  assert.equal(values[0].sourceQuote, '협업 경험을 알려주세요.');
  assert.equal(values[0].maxLength, 700);
  assert.equal(values[0].countSpaces, false);
  assert.equal(values[0].answer, '내 문장');
  assert.deepEqual(values[0].linkedExperienceIds, ['e1']);
  assert.equal(values[1].source, 'suggested');
  assert.equal(values[1].maxLength, null);
  assert.equal(values[2].source, 'manual');
  assert.equal(values[2].maxLength, null);
});

test('analysis normalization accepts the endpoint envelope and preserves attribution', () => {
  const result = normalizeAnalysis({ analysis: {
    company: '핏폴리', position: 'PM', sources: [{ id: 'p', title: '공고', url: 'https://example.com/job', type: 'posting' }],
    companyInsights: [{ text: '고객 조사 중요', sourceId: 'p', sourceQuote: '고객 인터뷰를 수행합니다.' }],
    questions: [], uncertainties: ['자소서 문항 미공개'], questionNotice: '지원 페이지에서 확인해 주세요.',
  } });
  assert.equal(result.company, '핏폴리');
  assert.equal(result.companyInsights[0].sourceQuote, '고객 인터뷰를 수행합니다.');
  assert.deepEqual(result.questions, []);
  assert.deepEqual(result.uncertainties, ['자소서 문항 미공개']);
  assert.equal(normalizeAnalysis(null).company, '');
  const letter = normalizeCoverLetter({ analysis: result, questions: [] });
  assert.equal(letter.targetCompany, '핏폴리');
  assert.deepEqual(letter.questions, []);
});

test('a draft moved to no company keeps that assignment and retains its original posting analysis', () => {
  const analysis = { company: '이전 기업', summary: '원문 분석' };
  const letter = normalizeCoverLetter({ targetCompany: '', analysis, questions: [{ question: '지원 동기', answer: '기존 답변' }] });
  assert.equal(letter.targetCompany, ''); assert.equal(letter.analysis.company, '이전 기업');
  assert.equal(letter.questions[0].answer, '기존 답변');
  assert.equal(normalizeCoverLetter({ analysis }).targetCompany, '이전 기업');
});

test('missing application questions preserve their status and selectable application sources', () => {
  const result = normalizeAnalysis({ analysis: {
    questions: [], questionStatus: 'selection_required',
    applicationLinks: [{ label: '설비 Operation', url: 'https://apply.example.com/operations' }, null, { label: '빈 주소' }],
    applicationUrl: 'https://apply.example.com/operations',
    selectedApplicationUrl: 'https://apply.example.com/operations', applicationAccess: 'login_required',
    sourceText: '채용공고 본문과 스크랩한 지원서 원문',
    sourceInputText: '지원서에서 복사한 자기소개서 문항',
    questionSourceText: '현재 지원서의 검증된 문항 원문',
  } });
  assert.equal(result.questionStatus, 'selection_required');
  assert.deepEqual(result.questions, []);
  assert.deepEqual(result.applicationLinks, [{ label: '설비 Operation', url: 'https://apply.example.com/operations' }]);
  assert.equal(result.applicationUrl, 'https://apply.example.com/operations');
  assert.equal(result.selectedApplicationUrl, 'https://apply.example.com/operations');
  assert.equal(result.applicationAccess, 'login_required');
  assert.equal(result.questionSourceText, '현재 지원서의 검증된 문항 원문');
  assert.equal(result.sourceInputText, '지원서에서 복사한 자기소개서 문항');
  const stored = normalizeCoverLetter({ analysis: result });
  assert.equal(stored.sourceInputText, result.sourceInputText);
  assert.notEqual(stored.sourceInputText, stored.sourceText);
  assert.equal(normalizeCoverLetter({ sourceText: '기존 스크랩 본문' }).sourceInputText, '');
  assert.equal(normalizeCoverLetter({ analysis: result, sourceInputText: '' }).sourceInputText, '');
  assert.equal(normalizeAnalysis(null).questionStatus, 'unavailable');
  assert.deepEqual(normalizeAnalysis(null).applicationLinks, []);
});

test('unverified stored posting rows retain their answer for recovery without becoming confirmed questions', () => {
  const contaminated = {
    id: 'old-requirements', source: 'posting', validation: 'unverified',
    question: '고등학교 졸업 이상인 자 반도체 설비 Operation 업무 수행 가능자',
    answer: '사용자가 이미 작성한 문장은 보존한다.', linkedExperienceIds: ['e1'],
  };
  const stored = normalizeCoverLetter({ questions: [contaminated, { id: 'manual', source: 'manual', question: '직접 입력한 지원 동기', answer: '내 답변' }] });
  assert.equal(stored.questions[0].validation, 'unverified');
  assert.equal(stored.questions[0].id, contaminated.id);
  assert.equal(stored.questions[0].answer, contaminated.answer);
  assert.deepEqual(stored.questions[0].linkedExperienceIds, ['e1']);
  assert.equal(stored.questions[1].answer, '내 답변');
  assert.equal(normalizeAnalysis({ questions: [contaminated] }).questionStatus, 'unavailable');
  assert.equal(normalizeAnalysis({ questions: [{ question: '지원 동기를 작성해주세요.', source: 'posting', validation: 'verified' }] }).questionStatus, 'verified');
});

test('registration-gated application preserves access state without presenting verified prompts', () => {
  const result = normalizeAnalysis({ analysis: {
    company: 'SFA반도체', questions: [], questionStatus: 'unavailable',
    applicationAccess: 'registration_required',
    applicationUrl: 'https://recruit.sfa.co.kr/apply/resume?rnId=1539',
    questionNotice: '지원자 등록 후 실제 지원서 문항을 확인해주세요.',
  } });
  assert.equal(result.applicationAccess, 'registration_required');
  assert.equal(result.questionStatus, 'unavailable');
  assert.deepEqual(result.questions, []);
  assert.equal(result.questionNotice, '지원자 등록 후 실제 지원서 문항을 확인해주세요.');
  const stored = normalizeCoverLetter({ analysis: result });
  assert.equal(stored.analysis.applicationAccess, 'registration_required');
  assert.deepEqual(stored.questions, []);
});

test('generated answer merges only the result and recomputes limits from the edited prompt', () => {
  const question = { id: 'q', question: '직접 수정한 질문', maxLength: 3, countSpaces: false, source: 'manual', sourceQuote: '원문', linkedExperienceIds: ['old'] };
  const generated = normalizeGeneratedAnswer({
    answer: '가 나 다 라', linkedExperienceIds: ['saved', 'saved'], warnings: ['수치 확인'],
    evidence: [{ experienceId: 'saved', quote: '내가 수행한 조사' }], review: { charCount: 2, withinLimit: true, unverifiedNumbers: ['50%'] },
  }, question);
  assert.equal(generated.question, question.question);
  assert.equal(generated.sourceQuote, '원문');
  assert.deepEqual(generated.linkedExperienceIds, ['saved']);
  assert.equal(generated.review.charCount, 4);
  assert.equal(generated.review.withinLimit, false);
  assert.deepEqual(generated.review.unverifiedNumbers, ['50%']);
  assert.deepEqual(generated.evidence, [{ experienceId: 'saved', quote: '내가 수행한 조사' }]);
  const untouched = normalizeGeneratedAnswers({ answers: [{ questionId: 'q', answer: '새 글' }] }, [question, { id: 'other', question: '다른 질문', answer: '수정 중인 글' }]);
  assert.equal(untouched[1].answer, '수정 중인 글');
  assert.equal(normalizeGeneratedAnswer(null, question).answer, '');
});

test('generated answer review enforces both ends of the edited character range', () => {
  const question = { id: 'q', question: '작성 문항', minLength: 3, maxLength: 4, countSpaces: false };
  assert.equal(normalizeGeneratedAnswer({ answer: '가 나' }, question).review.withinLimit, false);
  assert.equal(normalizeGeneratedAnswer({ answer: '가 나 다' }, question).review.withinLimit, true);
  assert.equal(normalizeGeneratedAnswer({ answer: '가 나 다 라' }, question).review.withinLimit, true);
  assert.equal(normalizeGeneratedAnswer({ answer: '가 나 다 라 마' }, question).review.withinLimit, false);
});

test('material recommendations reference saved text, exclude unrelated experience and keep input intact', () => {
  const experiences = [
    { id: 'e1', title: '고객 인터뷰', content: { action: '고객 인터뷰로 사용성 문제를 정리했다.' } },
    { id: 'e2', title: '제작 경험', content: { action: '포스터를 제작했다.' }, images: ['https://example.com/협업.png'] },
    { id: 'e3', title: '협업 프로젝트', content: { action: '협업 중 고객 인터뷰를 함께 설계했다.' } },
  ];
  const before = JSON.stringify(experiences);
  const recommended = recommendExperiences('협업 경험을 설명해주세요.', experiences, { rolePriorities: ['고객 인터뷰'] });
  assert.equal(recommended[0].experienceId, 'e3');
  assert.ok(recommended[0].reason.includes('협업'));
  assert.ok(recommended[0].evidence.every(quote => JSON.stringify(experiences[2]).includes(quote)));
  assert.ok(!recommended.some(item => item.experienceId === 'e2'));
  assert.equal(JSON.stringify(experiences), before);
  assert.deepEqual(recommendExperiences('', experiences), []);
});

test('question-specific collaboration evidence outranks broad job keywords and updates for the next question', () => {
  const experiences = [
    { id: 'interviews', title: '사용자 조사', content: { rawInput: '나는 사용자 인터뷰 6건을 진행하고 가입 안내를 개선했다. 제품 개선안을 팀에 공유했다.' } },
    { id: 'coordination', title: '일정 조율', content: { rawInput: '나는 개발 담당자와 일정과 작업 범위를 조율했다. 의견이 다른 두 팀과 범위에 합의했다.' } },
    { id: 'unrelated', title: '전시 방문', content: { rawInput: '주말에 미술관에서 사진 작품을 감상했다.' } },
  ];
  const analysis = { rolePriorities: ['사용자 인터뷰를 통한 제품 개선', '가입 안내 개선'] };
  const collaboration = recommendExperiences('팀과 협업하며 의견 차이를 조율한 경험을 작성해주세요.', experiences, analysis);
  assert.equal(collaboration[0].experienceId, 'coordination');
  assert.match(collaboration[0].questionReason, /조율|의견|협업/);
  assert.ok(collaboration[0].evidence.every(quote => experiences[1].content.rawInput.includes(quote)));
  assert.ok(!collaboration.some(item => item.experienceId === 'unrelated'));
  const research = recommendExperiences('사용자 인터뷰를 바탕으로 제품을 개선한 경험을 작성해주세요.', experiences, analysis);
  assert.equal(research[0].experienceId, 'interviews');
  assert.match(research[0].jobReason, /인터뷰|개선/);
  assert.notEqual(collaboration[0].experienceId, research[0].experienceId);
});

test('recommendations cite original and followup answers rather than AI questions, title, tags or generated metrics', () => {
  const experience = {
    id: 'original', title: '협업 리더십 매출 200% 개선', keywords: ['리더십', '매출'], competencyTags: ['협업'],
    content: { rawInput: '--- 직접 입력 ---\n나는 담당자와 일정에 합의했다.\n--- AI 초안 ---\n나는 팀장으로 매출을 200% 높였다.\n--- AI 채팅 보완 ---\nQ. 리더십을 발휘해 매출을 200% 높였나요?\n→ 결과 수치는 측정하지 못했다.', action: 'AI가 덧붙인 협업 리더십 성과 200%' },
    followupAnswers: [{ question: '매출 200%를 달성한 리더십?', answer: '나는 두 동료의 의견을 듣고 작업 범위를 조율했다.' }],
    structuredResult: { keyExperiences: [{ action: '나는 리더십으로 매출 200%를 달성했다.' }] },
  };
  const sources = experienceSourceRecords(experience);
  assert.ok(sources.some(record => record.sourceLabel === '추가 질문에 직접 답한 내용'));
  assert.ok(sources.every(record => !/200%|팀장|리더십|Q\./.test(record.text)));
  const recommended = recommendExperiences('협업하며 의견 차이를 조율한 경험을 작성해주세요.', [experience]);
  assert.equal(recommended.length, 1);
  assert.ok(recommended[0].evidence.every(quote => !/200%|팀장|리더십/.test(quote)));
  assert.deepEqual(recommendExperiences('리더십을 발휘해 매출을 늘린 경험을 작성해주세요.', [experience]), []);
  assert.deepEqual(recommendExperiences('협업 경험을 작성해주세요.', [{ id: 'summary-only', title: '협업', structuredResult: { intro: '협업으로 매출 200% 개선' }, keywords: ['협업'] }]), []);
});

test('food experience questions do not recommend unrelated hackathon learning or job skills', () => {
  const question = '본인이 경험한 식문화 또는 음식 관련된 경험에 대해 서술하고, 이를 통해 깨달은 점이나 어떤 의미가 있었는지 작성하십시오.';
  const hackathon = { id: 'qrious', title: '음식 관련 프로젝트', keywords: ['식문화'],
    content: { rawInput: "해커톤에서 캠퍼스 소통 문제를 해결하는 AI 페르소나 플랫폼 QRious를 개발했습니다. RAG 데이터를 구축하고 사용자 행동의 맥락을 설계하는 것이 핵심임을 배웠습니다." } };
  const food = { id: 'food', content: { rawInput: '교환학생 친구와 함께 음식을 만들어 나누었습니다. 서로 다른 식문화를 이해하며 대화가 자연스러워지는 것을 배웠습니다.' } };
  const analysis = { rolePriorities: ['AI 사용자 행동 설계', 'RAG 데이터'] };
  assert.deepEqual(recommendExperiences(question, [hackathon], analysis), []);
  const recommendations = recommendExperiences(question, [hackathon, food], analysis);
  assert.deepEqual(recommendations.map(item => item.experienceId), ['food']);
  assert.match(recommendations[0].questionReason, /음식·식문화/);
  assert.ok(recommendations[0].evidence.some(quote => quote.includes('음식')));
  assert.equal(recommendExperiences('문제를 해결하고 배운 점을 작성해주세요.', [hackathon]).length, 1);
});

test('evidence stays a literal bounded excerpt and recommendations cap at three without score from numbers', () => {
  const raw = `${'원본 자료의 다른 내용. '.repeat(40)}나는 고객 인터뷰 12건을 진행하고 질문을 정리했다.${' 이후 기록을 정리했다.'.repeat(40)}`;
  const experiences = Array.from({ length: 5 }, (_, index) => ({ id: `e${index}`, content: { rawInput: raw } }));
  const recommended = recommendExperiences('고객 인터뷰 경험을 작성해주세요.', experiences, {}, 20);
  assert.equal(recommended.length, 3);
  assert.ok(recommended[0].evidence.every(quote => quote.length <= 300 && raw.includes(quote)));
  assert.deepEqual(recommendExperiences('500자 이내 12', experiences), []);
  assert.deepEqual(recommendExperiences('직무 역량', [{ id: 'generic', content: { action: '나는 주어진 업무를 수행하고 맡은 역할을 마무리했다.' } }], { rolePriorities: ['필수 사항: 담당 업무 수행', '우대 조건'] }), []);
});

test('nested undefined values are removed while null and valid values remain', () => {
  const timestamp = new Date('2026-10-07T00:00:00Z');
  assert.deepEqual(stripUndefined({ a: undefined, b: null, c: [{ answer: '내 글', optional: undefined }, undefined], timestamp }), {
    b: null, c: [{ answer: '내 글' }], timestamp,
  });
});
