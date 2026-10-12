import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countAnswerCharacters, questionLimits, normalizePostingQuestions, extractPostingQuestions,
  suggestedQuestions, experienceSource, validateGeneratedAnswer, groundCompanyInsights, isApplicationQuestion,
} from '../src/services/coverLetterEvidence.js';
import { isPublicAddress, validatePublicUrl } from '../src/services/publicWebFetch.js';
import {
  analyzeCoverLetter, generateCoverLetterAnswer, importCoverLetterQuestions, normalizeQuestion,
  validateExperienceIds, buildCoverLetterDocument,
} from '../src/services/coverLetterService.js';
import { assertCoverLetterOwner } from '../src/routes/coverletter.js';

const sourceText = '기업명: 예시기업\n모집 직무: 프로덕트 매니저\n고객의 문제를 조사하고 제품을 개선합니다.\n자기소개서 문항\n1. 지원 동기를 경험과 연결해 작성해주세요. (500자 이내, 공백 제외)\n2. 문제를 해결한 경험을 구체적으로 기술해주세요. (300~700자)';
const rawExperience = { id: 'owned-experience', title: '고객 조사', content: { rawInput: '고객 인터뷰 12명을 직접 진행했습니다. 문제 유형을 분류해 제품 개선안을 제안했습니다.' }, structuredResult: { output: '고객 만족도가 40% 향상됐습니다.' } };
const experience = experienceSource(rawExperience);
const question = { id: 'q1', question: '문제를 해결한 경험을 작성해주세요.', maxLength: 500, minLength: null, countSpaces: true };
const evidenceQuote = '고객 인터뷰 12명을 직접 진행했습니다.';
const correctAnswer = { answer: '고객 인터뷰 12명을 직접 진행했습니다. 문제 유형을 분류하고 제품 개선안을 제안했습니다.', linkedExperienceIds: ['owned-experience'], evidence: [{ experienceId: 'owned-experience', quote: evidenceQuote }], warnings: [] };

test('character counts use code points, normalize CRLF, and exclude all whitespace when requested', () => {
  assert.equal(countAnswerCharacters('한글 🙂\r\n문장'), 7);
  assert.equal(countAnswerCharacters('한글 🙂\r\n문장', false), 5);
});

test('question character limits are read only from explicit units and strict ranges', () => {
  assert.deepEqual(questionLimits('300~700자, 공백 제외'), { minLength: 300, maxLength: 700, countSpaces: false });
  assert.equal(questionLimits('1,000자 이내').maxLength, 1000);
  assert.equal(questionLimits('500자 미만').maxLength, 499);
  assert.equal(questionLimits('30자 이내').maxLength, 30);
  assert.equal(questionLimits('500자 초과').minLength, 501);
  assert.equal(questionLimits('500자 내외').maxLength, null);
  assert.equal(questionLimits('최소 300자 이상, 최대 700자 이하').minLength, 300);
  assert.equal(questionLimits('1,000 bytes 이내, 2페이지').maxLength, null);
  assert.deepEqual(questionLimits('최대 700자\n최소 100자'), { minLength: 100, maxLength: 700, countSpaces: true });
  assert.deepEqual(questionLimits('최대 700자 최소 100자'), { minLength: 100, maxLength: 700, countSpaces: true });
  assert.deepEqual(questionLimits('최대 700자 이내\n최소 100자 이상'), { minLength: 100, maxLength: 700, countSpaces: true });
});

test('recognized short official headings are extracted without treating submission documents as questions', () => {
  const result = extractPostingQuestions('자기소개서 문항\n1. 지원동기 (500자)\n2. 성장과정\n3. 성격의 장단점 (700자)\n제출서류: 자기소개서');
  assert.deepEqual(result.map(item => item.question), ['지원동기', '성장과정', '성격의 장단점']);
  assert.deepEqual(result.map(item => item.maxLength), [500, null, 700]);
  assert.ok(result.every(item => item.source === 'posting'));
  assert.equal(extractPostingQuestions('제출서류: 자기소개서').length, 0);
});

test('unnumbered wrapped application prompts retain their entire wording and separate adjacent prompts', () => {
  const first = '본인이 맡았던 역할과\n문제를 해결하기 위해 한 행동을\n구체적으로 설명해주세요.';
  const second = '지원 분야를 선택한 이유를\n경험과 연결하여 작성해주세요.';
  const source = `자기소개서 문항\n${first}\n700자 이내\n${second}\n500자 이내\n입사 후 포부\n300자 이내`;
  const result = extractPostingQuestions(source);
  assert.deepEqual(result.map(item => item.question), [first, second, '입사 후 포부']);
  assert.deepEqual(result.map(item => item.maxLength), [700, 500, 300]);
});

test('wrapped prompt recovery does not join requirements or archives into a real question', () => {
  const source = '자기소개서 문항\n지원 직무에 대한\n우대사항\n관련 경력 3년 이상\n본인의 경험을 설명해주세요.\n합격자소서\n자기소개서 문항\n본인이 맡았던 역할과\n행동을 구체적으로 설명해주세요.';
  assert.deepEqual(extractPostingQuestions(source).map(item => item.question), ['본인의 경험을 설명해주세요.']);
});

const connectedApplicationUrl = 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=1537&pg=1';
const connectedFormUrl = 'https://recruit.sfa.co.kr/apply/resume?gbn=1&rnId=1537';
const connectedAnalysis = {
  company: 'SFA반도체', position: '제조본부 · 제조 Operator',
  applicationUrl: connectedFormUrl, selectedApplicationUrl: connectedApplicationUrl,
  applicationLinks: [{ label: '제조본부 · 제조 Operator', url: connectedApplicationUrl }],
  sourceUrl: 'https://www.jobkorea.co.kr/Recruit/GI_Read/50122030',
  sourceText: '채용 공고 원문과 기존 기업 분석 근거', questionSourceText: '2018년 합격자소서\n성장과정',
  companyInsights: [{ text: '기존 기업 분석', sourceId: 'posting', sourceQuote: '채용 공고 원문' }],
  rolePriorities: ['제조 공정 운영'], sources: [{ id: 'posting', title: '채용 공고 원문', url: '', type: 'posting' }],
};
const connectedQuestions = [
  { question: '성장과정 및 가족사항', sourceQuote: '성장과정 및 가족사항\n최대 500자', maxLength: 500 },
  { question: '지원동기 및 입사 후 포부', sourceQuote: '지원동기 및 입사 후 포부\n100~700자, 공백 제외', minLength: 100, maxLength: 700, countSpaces: false },
  { question: '성격의 장단점 및 생활신조', sourceQuote: '성격의 장단점 및 생활신조', maxLength: null },
];
const connectedImport = () => ({ analysis: structuredClone(connectedAnalysis), applicationUrl: connectedApplicationUrl,
  capture: { version: 1, sourceUrl: connectedFormUrl, capturedAt: '2026-10-08T12:00:00.000Z', questions: structuredClone(connectedQuestions), warnings: [] } });

test('browser-connected real compound questions retain company analysis and literal limits without AI', () => {
  const input = connectedImport();
  const result = importCoverLetterQuestions(input);
  assert.deepEqual(result.questions.map(item => item.question), connectedQuestions.map(item => item.question));
  assert.deepEqual(result.questions.map(item => [item.minLength, item.maxLength, item.countSpaces]), [[null, 500, true], [100, 700, false], [null, null, true]]);
  assert.ok(result.questions.every(item => item.source === 'posting' && item.validation === 'verified'));
  assert.ok(result.questions.every(item => item.importMethod === 'browser_extension'));
  assert.deepEqual(result.analysis.companyInsights, input.analysis.companyInsights);
  assert.deepEqual(result.analysis.rolePriorities, input.analysis.rolePriorities);
  assert.equal(result.analysis.company, input.analysis.company);
  assert.equal(result.analysis.position, input.analysis.position);
  assert.equal(result.analysis.sourceText, input.analysis.sourceText);
  assert.equal(result.analysis.applicationAccess, 'connected');
  assert.equal(result.analysis.questionStatus, 'verified');
  assert.equal(result.analysis.sources.at(-1).url, connectedFormUrl);
  assert.equal(result.analysis.sources.at(-1).type, 'posting');
  assert.deepEqual(result.analysis.applicationCapture, { sourceUrl: connectedFormUrl, capturedAt: input.capture.capturedAt, method: 'browser_extension' });
  assert.equal(normalizePostingQuestions(result.questions, result.analysis.questionSourceText).length, 3);
  assert.equal(input.analysis.questionSourceText, connectedAnalysis.questionSourceText);
  assert.equal(input.analysis.sources.length, 1);
});

test('browser import rejects other origins, unregistered role selections and unsafe URLs', () => {
  for (const sourceUrl of ['https://unrelated.example.com/apply', 'https://www.jobkorea.co.kr/Recruit/GI_Read/50122030', 'https://user:pass@recruit.sfa.co.kr/apply', 'http://recruit.sfa.co.kr/apply']) {
    const input = connectedImport(); input.capture.sourceUrl = sourceUrl;
    assert.throws(() => importCoverLetterQuestions(input), error => error.status === 400 || error.status === 422);
  }
  const input = connectedImport(); input.applicationUrl = 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=9999';
  assert.throws(() => importCoverLetterQuestions(input), error => error.status === 422);
});

test('browser import accepts an attached role beyond the twelfth option and updates its position', () => {
  const input = connectedImport();
  input.analysis.applicationLinks = Array.from({ length: 15 }, (_, index) => ({
    label: `모집 직무 ${index + 1}`, url: `https://recruit.sfa.co.kr/sfasemicon/recruit?id=${1600 + index}`,
  }));
  input.applicationUrl = input.analysis.applicationLinks[14].url;
  input.capture.sourceUrl = 'https://recruit.sfa.co.kr/apply/resume?gbn=1&rnId=1614';
  const result = importCoverLetterQuestions(input);
  assert.equal(result.questions.length, 3);
  assert.equal(result.analysis.position, '모집 직무 15');
  assert.equal(result.analysis.selectedApplicationUrl, input.applicationUrl);
});

test('browser import checks explicit SFA role IDs and Jasoseol posting or employment IDs without guessing hidden state', () => {
  for (const applicationUrl of [connectedApplicationUrl, connectedFormUrl]) {
    const input = connectedImport(); input.applicationUrl = applicationUrl;
    input.capture.sourceUrl = connectedFormUrl.replace('rnId=1537', 'rnId=1539');
    assert.throws(() => importCoverLetterQuestions(input), error => error.status === 422);
  }
  const input = connectedImport();
  input.applicationUrl = 'https://jasoseol.com/resume_list?ec=123456&e=42';
  input.analysis.selectedApplicationUrl = input.applicationUrl;
  input.analysis.applicationUrl = input.applicationUrl;
  input.analysis.applicationLinks = [{ label: '개발', url: input.applicationUrl }];
  for (const sourceUrl of ['https://jasoseol.com/resume_list?ec=123456&e=43', 'https://jasoseol.com/resume_list?ec=999999&e=42', 'https://jasoseol.com/resume_list?ec=123456&employment_id=43']) {
    input.capture.sourceUrl = sourceUrl;
    assert.throws(() => importCoverLetterQuestions(input), error => error.status === 422);
  }
  input.capture.sourceUrl = 'https://jasoseol.com/resume_list?ec=123456&employment_id=42';
  assert.equal(importCoverLetterQuestions(input).questions.length, 3);
  input.capture.sourceUrl = 'https://jasoseol.com/resume/write';
  assert.equal(importCoverLetterQuestions(input).questions.length, 3);
});

test('the current selected provider role can connect its final employer form but a changed role cannot reuse that origin', () => {
  const input = connectedImport();
  input.applicationUrl = 'https://jasoseol.com/resume_list?ec=123456&e=42';
  input.analysis.selectedApplicationUrl = input.applicationUrl;
  input.analysis.applicationLinks = [{ label: '개발', url: input.applicationUrl }, { label: '기획', url: 'https://jasoseol.com/resume_list?ec=123456&e=43' }];
  assert.equal(importCoverLetterQuestions(input).questions.length, 3);
  input.capture.sourceUrl = connectedFormUrl.replace('rnId=1537', 'rnId=1539');
  assert.throws(() => importCoverLetterQuestions(input), error => error.status === 422);
  input.capture.sourceUrl = connectedFormUrl;
  input.applicationUrl = input.analysis.applicationLinks[1].url;
  assert.throws(() => importCoverLetterQuestions(input), error => error.status === 422);
});

test('connecting a newly selected registered role updates its label and clears facts belonging to the previous role', () => {
  const input = connectedImport();
  input.analysis.writingPoints = ['Operator 직무 작성 방향'];
  input.analysis.applicationLinks.push({ label: '제조본부 · 제조기술 Maintenance', url: connectedApplicationUrl.replace('id=1537', 'id=1539') });
  const sameRole = importCoverLetterQuestions(input);
  assert.deepEqual(sameRole.analysis.rolePriorities, input.analysis.rolePriorities);
  assert.deepEqual(sameRole.analysis.writingPoints, input.analysis.writingPoints);
  assert.equal(sameRole.analysis.applicationUrl, input.analysis.applicationUrl);
  input.applicationUrl = input.analysis.applicationLinks[1].url;
  input.capture.sourceUrl = connectedFormUrl.replace('rnId=1537', 'rnId=1539');
  const changed = importCoverLetterQuestions(input);
  assert.equal(changed.analysis.position, '제조본부 · 제조기술 Maintenance');
  assert.equal(changed.analysis.summary, '');
  assert.deepEqual(changed.analysis.rolePriorities, []);
  assert.deepEqual(changed.analysis.writingPoints, []);
  assert.equal(changed.analysis.applicationUrl, input.capture.sourceUrl);
  assert.equal(changed.analysis.selectedApplicationUrl, input.applicationUrl);
  assert.deepEqual(changed.analysis.companyInsights, input.analysis.companyInsights);
});

test('browser import preserves wrapped question labels and its method through document saves without trusting other method names', () => {
  const input = connectedImport();
  input.capture.questions = [{ question: '성장과정\n및 가족사항', sourceQuote: '성장과정\n및 가족사항\n최대 500자 이내', maxLength: 500 }];
  const result = importCoverLetterQuestions(input);
  const saved = buildCoverLetterDocument({ analysis: result.analysis, questions: [{ ...result.questions[0], answer: '가족과 대화하며 제 생각을 정리했습니다.' }] }, 'owner');
  assert.equal(saved.questions[0].validation, 'verified');
  assert.equal(saved.questions[0].importMethod, 'browser_extension');
  assert.equal(saved.questions[0].answer, '가족과 대화하며 제 생각을 정리했습니다.');
  assert.equal(saved.analysis.applicationCapture.method, 'browser_extension');
  assert.equal(normalizeQuestion({ ...result.questions[0], importMethod: 'cookies' }).importMethod, undefined);
  assert.equal(normalizeQuestion({ ...result.questions[0], importMethod: { token: 'secret' } }).importMethod, undefined);
});

test('browser import rejects qualifications, ambiguous labels, missing evidence and empty or excessive captures', () => {
  const invalidQuestions = [
    [], Array.from({ length: 13 }, () => connectedQuestions[0]),
    [{ question: '지원동기 및 입사 후 포부', sourceQuote: '' }],
    [{ question: '지원동기 및 입사 후 포부', sourceQuote: '성장과정 및 가족사항' }],
    [{ question: '고등학교 졸업 이상인 자 반도체 설비 Operation 업무 수행 가능자', sourceQuote: '고등학교 졸업 이상인 자 반도체 설비 Operation 업무 수행 가능자' }],
    [{ question: '기타사항', sourceQuote: '기타사항' }],
    [{ question: '성장과정 및 가족사항', sourceQuote: '2018년 합격자소서 성장과정 및 가족사항' }],
  ];
  for (const questions of invalidQuestions) {
    const input = connectedImport(); input.capture.questions = questions;
    assert.throws(() => importCoverLetterQuestions(input), error => error.status === 422);
  }
  assert.equal(isApplicationQuestion('성장과정 및 가족사항'), false);
  assert.equal(isApplicationQuestion('지원동기 및 입사 후 포부', '합격자소서\n자기소개서 문항\n지원동기 및 입사 후 포부'), false);
});

test('browser import never trusts invented limits or byte counts as character limits', () => {
  for (const mutation of [
    item => { item.maxLength = 1000; }, item => { item.minLength = 100; }, item => { item.countSpaces = false; },
  ]) {
    const input = connectedImport(); mutation(input.capture.questions[0]);
    assert.throws(() => importCoverLetterQuestions(input), error => error.status === 422);
  }
  const input = connectedImport(); input.capture.questions = [{ question: '지원동기 및 입사 후 포부', sourceQuote: '지원동기 및 입사 후 포부 (1,000 bytes 이내)', maxLength: null }];
  assert.equal(importCoverLetterQuestions(input).questions[0].maxLength, null);
  input.capture.questions[0].maxLength = 1000;
  assert.throws(() => importCoverLetterQuestions(input), error => error.status === 422);
  const attributes = connectedImport();
  attributes.capture.questions = [{ question: '지원동기 및 입사 후 포부', sourceQuote: '지원동기 및 입사 후 포부\n최대 700자\n최소 100자', maxLength: 700, minLength: 100 }];
  assert.deepEqual(importCoverLetterQuestions(attributes).questions.map(item => [item.minLength, item.maxLength]), [[100, 700]]);
});

test('browser proof stays within 60k and session secrets or collector transport data are not retained', () => {
  const input = connectedImport();
  input.analysis.questionSourceText = '기존 근거'.repeat(12000);
  input.capture.sourceUrl = `${connectedFormUrl}&token=secret&sessionId=private#nonce=private`;
  input.capture.nonce = 'transport-only'; input.capture.cookies = 'private';
  const result = importCoverLetterQuestions(input);
  assert.equal(result.analysis.questionSourceText.length, 60000);
  assert.equal(normalizePostingQuestions(result.questions, result.analysis.questionSourceText).length, 3);
  assert.equal(result.analysis.applicationCapture.sourceUrl, connectedFormUrl);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(JSON.stringify(result).includes('transport-only'), false);
  assert.equal(JSON.stringify(result).includes('private'), false);
});

test('question limits on the next line remain associated with the official question', () => {
  const result = extractPostingQuestions('자기소개서 문항\nQ1 지원동기\n500자 이내, 공백 제외\n문항 2 성장과정\n300~700자');
  assert.deepEqual(result.map(item => item.question), ['지원동기', '성장과정']);
  assert.equal(result[0].maxLength, 500);
  assert.equal(result[0].countSpaces, false);
  assert.equal(result[1].minLength, 300);
  assert.equal(result[1].maxLength, 700);
});

test('extracted short official heading can be generated while empty and arbitrary short prompts fail', async () => {
  const [shortQuestion] = extractPostingQuestions('자기소개서 문항\n1. 지원동기 (500자)');
  assert.equal(normalizeQuestion(shortQuestion).question, '지원동기');
  assert.equal(normalizeQuestion({ question: '성장과정' }).question, '성장과정');
  assert.throws(() => normalizeQuestion({ question: '' }));
  assert.throws(() => normalizeQuestion({ question: ' ' }));
  assert.throws(() => normalizeQuestion({ question: 'abc' }));
  const result = await generateCoverLetterAnswer({ question: shortQuestion, analysis: { sourceText: '자기소개서 문항\n1. 지원동기 (500자)' } }, [rawExperience], { generateAI: async () => JSON.stringify(correctAnswer) });
  assert.equal(result.answer, correctAnswer.answer);
  assert.equal(result.review.withinLimit, true);
});

test('extraction preserves official text, limits, count convention and literal evidence', () => {
  const questions = extractPostingQuestions(sourceText);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].source, 'posting');
  assert.equal(questions[0].maxLength, 500);
  assert.equal(questions[0].countSpaces, false);
  assert.equal(questions[1].minLength, 300);
  assert.equal(questions[1].maxLength, 700);
  assert.ok(sourceText.includes(questions[0].question));
  assert.ok(sourceText.includes(questions[0].sourceQuote));
});

test('model supplied default limit and fake posting question are discarded', () => {
  const actual = '지원 동기를 경험과 연결해 작성해주세요.';
  const normalized = normalizePostingQuestions([
    { question: actual, sourceQuote: actual, maxLength: 9999 },
    { question: '실패한 경험을 구체적으로 작성해주세요.', sourceQuote: '실패한 경험을 구체적으로 작성해주세요.', maxLength: 500 },
  ], sourceText);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].maxLength, null);
});

const jobkoreaRequirements = [
  '기업명: 예시반도체',
  '모집 직무: 제조기술 Maintenance',
  '담당업무',
  '1. 고등학교 졸업 이상인 자 반도체 설비 Operation 업무 수행 가능자 우대조건 반도체 후공정 Operator 경험자 우대 Front 공정 : Back Lab, Saw, Die Attach, Wire Bonding Back-end 공정 : Marking/Solder ball/Saw Sorter/Mold, SMT, AVI(육안검사), DC Test, Final Test, Wafer Test(EDS)공정, Probe Card관리 Bump 공정 : Incoming, Photo, Sputter/Desum, Plating, AOI공정',
  '2. 전문학사 이상인 자(전자, 전기, 기계, 반도체 전공) 반도체 설비 유지보수(제조기술) 업무 수행 가능자 우대조건 고졸의 경우 관련 경력 1~3년 이상 경험자 우대',
  '3. 고등학교 졸업 이상인 자 반도체 설비 Operation 업무 수행 가능자 우대조건 반도체 후공정 Operator 경험자 우대',
  '필수조건 3조 2교대 근무가능자(5근 2휴) Day(06:00~14:00)',
  '접수방법',
  '지원 서류: 이력서 및 자기소개서',
  '이 기업의 취업 전략 합격자소서 인적성·면접 후기 직무 인터뷰 자기소개 및 장단점 2018년 상반기 신입',
].join('\n');

test('literal numbered Jobkorea duties and footer essay links never become application questions', () => {
  for (const source of [jobkoreaRequirements, jobkoreaRequirements.replace(/\n/g, ' ')]) {
    assert.deepEqual(extractPostingQuestions(source), []);
    const candidates = jobkoreaRequirements.split('\n').filter(line => /^\d\./.test(line) || /합격자소서/.test(line))
      .map(line => ({ question: line.replace(/^\d\.\s*/, ''), sourceQuote: line }));
    assert.deepEqual(normalizePostingQuestions(candidates, source), []);
    assert.ok(candidates.every(item => !isApplicationQuestion(item.question, source, item.sourceQuote)));
  }
});

test('current real questions survive mixed duties while archived copies with their own heading are excluded', () => {
  const actual = '최근 관심을 가진 분야를 어떻게 공부하고 있는지 서술해주세요.';
  const archived = '살면서 가장 보람을 느꼈던 순간을 소개해주세요.';
  const source = `${jobkoreaRequirements.split('접수방법')[0]}\n자기소개서 문항\n1. ${actual} (700자 이내)\n2. 본인에게 가장 중요한 사회적 질문은 무엇인가요? (500자)\n합격자소서\n2018년 상반기 신입\n자기소개서 문항\n1. ${archived} (1,000자)\n2. 성장과정`;
  assert.deepEqual(extractPostingQuestions(source).map(item => item.question), [actual, '본인에게 가장 중요한 사회적 질문은 무엇인가요?']);
  assert.equal(normalizePostingQuestions([{ question: archived, sourceQuote: archived }], source).length, 0);
  assert.equal(normalizePostingQuestions([{ question: '성장과정', sourceQuote: '2. 성장과정' }], source).length, 0);
});

test('canonical headings require a current application section and menu or tutorial labels cannot prove one', () => {
  assert.equal(isApplicationQuestion('지원동기'), false);
  assert.equal(isApplicationQuestion('성장과정', '채용정보\n직무 인터뷰\n1. 성장과정'), false);
  assert.equal(isApplicationQuestion('지원동기', '자소서 작성 가이드\n자기소개서 문항\n1. 지원동기'), false);
  assert.equal(isApplicationQuestion('지원동기', '현재 채용 자기소개서 문항\n1. 지원동기'), true);
  assert.deepEqual(extractPostingQuestions('지원서 문항 1. 지원동기 (500자) 2. 성장과정 (700자)').map(item => item.maxLength), [500, 700]);
  assert.deepEqual(extractPostingQuestions('지원서 문항 1.지원동기 (500자) 2.성장과정 (700자)').map(item => item.maxLength), [500, 700]);
});

test('unusual candidate requests and wrapped real questions preserve complete prompts and their own limits', () => {
  const first = '자신이 세상을 바라보는 방식을 바꾼\n책 한 권과 그 이유를\n서술하여 주십시오.';
  const second = '최근 관심을 가진 분야를 어떻게 공부하고 있는지 서술해주세요.';
  const source = `지원서 질문\n1. ${first}\n300~800자, 공백 제외\n2. ${second} (600자 이내)`;
  const result = extractPostingQuestions(source);
  assert.deepEqual(result.map(item => item.question), [first, second]);
  assert.deepEqual(result.map(item => [item.minLength, item.maxLength, item.countSpaces]), [[300, 800, false], [null, 600, true]]);
  assert.equal(isApplicationQuestion('관심 분야를 선정한 기준과 관점을 설명하시오.'), true);
  assert.equal(isApplicationQuestion('파일을 업로드하고 지원서를 제출해주세요.'), false);
  assert.equal(isApplicationQuestion('자기소개서를 자유 양식으로 제출해주세요.'), false);
  const continued = '지원 분야를 선택한 이유를 작성해주세요.\n그 선택을 바꾸게 된다면 어떤 기준을 적용할지도 설명해주세요.';
  assert.equal(extractPostingQuestions(`지원서 문항\n1. ${continued}\n700자 이내`)[0].question, continued);
});

test('pasted current application questions can follow archived page content without inheriting the archive', () => {
  const actual = '최근 관심을 가진 분야를 어떻게 공부하고 있는지 서술해주세요.';
  const source = `${jobkoreaRequirements}\n[직접 입력한 보충 자료]\n현재 지원서 문항\n1. ${actual} (900자)\n2. 지원동기 (500자)`;
  assert.deepEqual(extractPostingQuestions(source).map(item => item.question), [actual, '지원동기']);
});

test('explicit practice suggestions never claim posting provenance or invented limits', () => {
  assert.equal(extractPostingQuestions('제출 서류: 이력서 및 자기소개서. 협업 경험과 문제 해결 역량이 있는 분을 찾습니다.').length, 0);
  assert.ok(suggestedQuestions().every(item => item.source === 'suggested' && item.maxLength === null && !item.sourceQuote));
});

test('research URLs need actual claim support and returned research is not a literal quote', () => {
  const candidate = { text: '공식 제품 소개에는 고객 리서치 도구가 설명되어 있습니다.', sourceUrl: 'https://example.com/product', sourceQuote: 'model-invented quote' };
  const metadata = { groundingChunks: [{ web: { title: '공식 제품 소개', uri: candidate.sourceUrl } }] };
  assert.equal(groundCompanyInsights([candidate], '', metadata).insights.length, 0);
  metadata.groundingSupports = [{ segment: { text: JSON.stringify(candidate) }, groundingChunkIndices: [0] }];
  const result = groundCompanyInsights([candidate], '', metadata);
  assert.equal(result.insights[0].sourceId, 'research-1');
  assert.equal(result.insights[0].sourceQuote, '');
  assert.equal(result.sources[0].url, candidate.sourceUrl);
});

test('company posting insights require a literal quote in the original', () => {
  const result = groundCompanyInsights([{ text: '고객 문제 중심 제품 개선을 강조합니다.', sourceQuote: '고객의 문제를 조사하고 제품을 개선합니다.' }, { text: '새로운 해외 사업 확장', sourceQuote: '해외 진출에 성공했습니다.' }], sourceText);
  assert.equal(result.insights.length, 1);
  assert.equal(result.insights[0].sourceId, 'posting');
});

test('HTTPS fetching blocks credentials, ports, reserved hosts and private addresses', () => {
  for (const url of ['http://example.com/job', 'https://localhost/job', 'https://127.0.0.1/job', 'https://10.0.0.2/job', 'https://192.168.2.3/job', 'https://[::1]/job', 'https://[::ffff:127.0.0.1]/job', 'https://user:pass@example.com/job', 'https://example.com:8080/job', 'https://metadata.internal/job']) assert.throws(() => validatePublicUrl(url));
  assert.equal(validatePublicUrl('https://example.com/job'), 'https://example.com/job');
  assert.equal(isPublicAddress('100.64.0.1'), false);
  assert.equal(isPublicAddress('198.18.0.1'), false);
  assert.equal(isPublicAddress('169.254.169.254'), false);
  assert.equal(isPublicAddress('8.8.8.8'), true);
});

test('original experience facts take precedence over unverified saved summaries', () => {
  assert.ok(experience.facts.includes('12명'));
  assert.ok(experience.narrativeContext.includes('40%'));
  const result = validateGeneratedAnswer({ ...correctAnswer, answer: `${correctAnswer.answer} 고객 만족도가 40% 향상되었습니다.`, evidence: [...correctAnswer.evidence, { experienceId: 'owned-experience', quote: '고객 만족도가 40% 향상됐습니다.' }] }, { experiences: [experience], question });
  assert.equal(result.evidence.length, 1);
  assert.deepEqual(result.review.unverifiedNumbers, []);
  assert.equal(result.problems.length, 0);
});

test('foreign IDs and fake evidence cannot become linked experiences', () => {
  const result = validateGeneratedAnswer({ ...correctAnswer, linkedExperienceIds: ['foreign-id'], evidence: [{ experienceId: 'foreign-id', quote: evidenceQuote }, { experienceId: 'owned-experience', quote: '매출을 200% 성장시켰습니다.' }] }, { experiences: [experience], question });
  assert.equal(result.evidence.length, 0);
  assert.deepEqual(result.linkedExperienceIds, []);
  assert.ok(result.problems.some(problem => problem.includes('인용')));
});

test('numbers missing from citation snippets no longer block a completed answer', () => {
  const result = validateGeneratedAnswer({ ...correctAnswer, answer: '매출을 200% 성장시켰습니다.' }, { experiences: [experience], voiceSample: '매출 200% 성장', currentAnswer: '200% 성장', question });
  assert.deepEqual(result.review.unverifiedNumbers, []);
  assert.equal(result.problems.length, 0);
  assert.equal(result.answer, '매출을 200% 성장시켰습니다.');
});

test('verified results link only source-backed experience IDs and expose length review', () => {
  const result = validateGeneratedAnswer(correctAnswer, { experiences: [experience], question });
  assert.deepEqual(result.linkedExperienceIds, ['owned-experience']);
  assert.equal(result.problems.length, 0);
  assert.equal(result.review.charCount, countAnswerCharacters(correctAnswer.answer));
  assert.equal(result.review.withinLimit, true);
  assert.deepEqual(result.review.unverifiedNumbers, []);
});

test('length outside the requested limits is reported without rejecting or truncating the draft', () => {
  for (const limits of [{ maxLength: 20 }, { minLength: 300 }]) {
    const result = validateGeneratedAnswer(correctAnswer, { experiences: [experience], question: { ...question, ...limits } });
    assert.equal(result.review.withinLimit, false);
    assert.equal(result.problems.length, 0);
    assert.equal(result.answer, correctAnswer.answer);
  }
});

test('a short 330-character draft remains usable without a minimum-length error', async () => {
  const answer = correctAnswer.answer.padEnd(329, '가') + '.';
  assert.equal(countAnswerCharacters(answer), 330);
  for (const limits of [{ minLength: 500, maxLength: 700 }]) {
    let calls = 0;
    const result = await generateCoverLetterAnswer({ question: { ...question, ...limits } }, [rawExperience], {
      generateAI: async () => { calls++; return JSON.stringify({ ...correctAnswer, answer }); },
    });
    assert.equal(calls, 2);
    assert.equal(result.answer, answer);
    assert.equal(result.review.charCount, 330);
    assert.equal(result.review.withinLimit, false);
    const saved = buildCoverLetterDocument({ questions: [{ ...question, ...limits, ...result }] }, 'owner');
    assert.equal(saved.questions[0].answer, answer);
    assert.equal(saved.questions[0].review.withinLimit, false);
  }
});

test('generation targets 270 characters for a 300-character limit and resizes an overflowing draft automatically', async () => {
  const answer = correctAnswer.answer.padEnd(329, '가') + '.';
  let calls = 0;
  const result = await generateCoverLetterAnswer({ question: { ...question, maxLength: 300 } }, [rawExperience], {
    generateAI: async prompt => {
      calls++;
      assert.ok(prompt.includes('최대 300자'));
      assert.ok(prompt.includes('약 270자'));
      if (calls === 3) assert.ok(prompt.includes('현재 본문은 330자'));
      return JSON.stringify({ ...correctAnswer, answer: calls < 3 ? answer : correctAnswer.answer });
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.answer, correctAnswer.answer);
  assert.equal(result.review.withinLimit, true);
  assert.ok(result.review.charCount <= 300);
  const saved = buildCoverLetterDocument({ questions: [{ ...question, maxLength: 300, ...result }] }, 'owner');
  assert.equal(saved.questions[0].answer, result.answer);
  assert.equal(saved.questions[0].review.withinLimit, true);
});

test('length is enforced after an audit expands an initially fitting draft', async () => {
  let calls = 0;
  const result = await generateCoverLetterAnswer({ question: { ...question, maxLength: 300, countSpaces: false } }, [rawExperience], {
    generateAI: async prompt => {
      assert.ok(prompt.includes('공백과 줄바꿈 제외'));
      calls++;
      return JSON.stringify({ ...correctAnswer, answer: calls === 2 ? correctAnswer.answer + '가'.repeat(330) + '.' : correctAnswer.answer });
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.answer, correctAnswer.answer);
  assert.ok(result.review.charCount <= 300);
});

test('continued model overflow or a resizing outage still returns a draft under the maximum', async () => {
  for (const unavailable of [false, true]) {
    let calls = 0;
    const oversized = correctAnswer.answer + ' ' + '가'.repeat(330) + '.';
    const result = await generateCoverLetterAnswer({ question: { ...question, maxLength: 300 } }, [rawExperience], {
      generateAI: async () => {
        calls++;
        if (unavailable && calls > 2) throw Object.assign(new Error('unavailable'), { status: 503 });
        return JSON.stringify({ ...correctAnswer, answer: oversized });
      },
    });
    assert.equal(calls, unavailable ? 3 : 4);
    assert.equal(result.answer, correctAnswer.answer);
    assert.equal(result.review.withinLimit, true);
    assert.ok(result.review.charCount <= 300);
  }
});

test('analysis combines live posting with supplemental text and never invents questions', async () => {
  let scrapeCalls = 0;
  const response = await analyzeCoverLetter({ url: 'https://example.com/job', text: '추가 문항: 협업 경험을 구체적으로 기술해주세요. (800자 이내)' }, {
    scrape: async () => { scrapeCalls += 1; return sourceText; },
    generateAI: async (_prompt, options) => options.returnMetadata ? { text: '{"insights":[]}', groundingMetadata: null } : JSON.stringify({ company: '예시기업', position: '프로덕트 매니저', questions: [] }),
  });
  assert.equal(scrapeCalls, 1);
  assert.ok(response.sourceText.includes('추가 문항'));
  assert.equal(response.questions.length, 3);
  assert.ok(response.uncertainties.some(value => value.includes('검색 출처')));
});

test('blocked link plus pasted fallback remains actionable and clearly uncertain', async () => {
  const response = await analyzeCoverLetter({ url: 'https://example.com/job', text: sourceText, company: '예시기업' }, {
    scrape: async () => { throw new Error('login wall'); }, generateAI: async () => { throw new Error('model unavailable'); },
  });
  assert.equal(response.questions[0].source, 'posting');
  assert.equal(response.sources[0].url, '');
  assert.ok(response.uncertainties.some(value => value.includes('링크의 원문')));
});

test('questionless source returns no invented questions and asks for actual application prompts', async () => {
  const response = await analyzeCoverLetter({ company: '예시기업', position: '개발', text: '기업명: 예시기업\n모집 직무: 개발\n지원 서류: 이력서와 자기소개서 자유 양식으로 제출해주세요.' }, { generateAI: async () => { throw new Error('unavailable'); } });
  assert.deepEqual(response.questions, []);
  assert.equal(response.questionStatus, 'unavailable');
  assert.ok(response.questionNotice.includes('실제'));
});

test('generation returns 4000 cases, stages and days without numeric repair or rejecting the answer', async () => {
  let calls = 0;
  const answer = `${correctAnswer.answer} 4,000건의 자료를 검토하고 3단계로 분류해 3일 동안 2가지 개선안을 작성했습니다.`;
  const response = await generateCoverLetterAnswer({ question, experienceIds: ['owned-experience'], experiences: [{ id: 'owned-experience', content: '매출 200% 성장' }] }, [rawExperience], {
    generateAI: async prompt => {
      assert.ok(!prompt.includes('매출 200% 성장'));
      calls += 1;
      return JSON.stringify({ ...correctAnswer, answer });
    },
  });
  assert.equal(calls, 2);
  assert.equal(response.answer, answer);
  assert.deepEqual(response.review.unverifiedNumbers, []);
  assert.deepEqual(response.linkedExperienceIds, ['owned-experience']);
});

test('generation with no usable experience citations still fails with 422', async () => {
  await assert.rejects(generateCoverLetterAnswer({ question }, [rawExperience], { generateAI: async () => JSON.stringify({ ...correctAnswer, evidence: [] }) }), error => error.status === 422 && error.code === 'COVERLETTER_REVIEW_FAILED');
});

const foodQuestion = { ...question, question: '본인이 경험한 식문화 또는 음식 관련된 경험에 대해 서술하고, 이를 통해 깨달은 점이나 어떤 의미가 있었는지 작성하십시오.', maxLength: 300, countSpaces: false };
const qriousExperience = { id: 'qrious', title: 'QRious 해커톤', content: { rawInput: "해커톤 당시 캠퍼스 내 소통 단절 문제를 해결하고자 AI 페르소나 플랫폼 QRious를 개발했습니다. 교수님과 선배 데이터를 RAG로 처리하고 3만 건의 데이터를 구축해 최종 2위를 수상했습니다. 기술이 사용자의 행동을 유도하는 맥락을 설계하는 것이 핵심임을 배웠습니다." } };

test('food question with QRious alone requests real food experience before any AI calls', async () => {
  const result = await generateCoverLetterAnswer({ question: foodQuestion,
    analysis: { company: '식품 기업', companyInsights: [{ text: '다양한 음식과 식문화' }] },
    currentAnswer: '음식을 나눠 먹었습니다.', voiceSample: '식문화가 중요합니다.' }, [qriousExperience], {
    generateAI: async () => { throw new Error('Unrelated experience must not reach AI'); },
  });
  assert.equal(result.status, 'needs_context');
  assert.equal(result.answer, '');
  assert.match(result.followUpQuestion, /음식·식문화/);
});

test('actual food context can generate an answer with only user-input evidence and no linked experience', async () => {
  const context = '교환학생 친구와 함께 음식을 만들어 나누었습니다. 각자의 식문화를 이야기하며 서로를 이해하는 계기가 됐습니다.';
  const result = await generateCoverLetterAnswer({ question: foodQuestion, additionalContext: context }, [], {
    generateAI: async () => JSON.stringify({ status: 'draft', answer: context,
      evidence: [{ experienceId: 'user-input', quote: context }], warnings: [] }),
  });
  assert.equal(result.answer, context);
  assert.deepEqual(result.linkedExperienceIds, []);
  assert.equal(result.evidence[0].experienceId, 'user-input');
  assert.ok(result.review.charCount <= 300);
});

test('a topical question rejects an unrelated answer even when its facts and evidence are real', () => {
  const facts = experienceSource(qriousExperience);
  const result = validateGeneratedAnswer({ answer: facts.facts, evidence: [{ experienceId: facts.id, quote: facts.facts }] }, { experiences: [facts], question: foodQuestion });
  assert.ok(result.problems.some(problem => problem.includes('음식·식문화')));
});

test('other question topics can request missing context through generation or audit without empty-answer retries', async () => {
  for (const failAt of [1, 2]) {
    let calls = 0;
    const result = await generateCoverLetterAnswer({ question: { ...question, question: '최근 읽은 책과 배운 점을 설명해주세요.' } }, [rawExperience], {
      generateAI: async () => ++calls === failAt
        ? JSON.stringify({ status: 'needs_context', answer: '', followUpQuestion: '최근 읽은 책과 인상 깊었던 내용을 알려주세요.' })
        : JSON.stringify(correctAnswer),
    });
    assert.equal(calls, failAt);
    assert.equal(result.status, 'needs_context');
    assert.match(result.followUpQuestion, /최근 읽은 책/);
  }
});

test('a temporary audit overload returns the generated draft instead of discarding it', async () => {
  let calls = 0;
  const result = await generateCoverLetterAnswer({ question }, [rawExperience], {
    generateAI: async (_prompt, options) => {
      assert.equal(options.retries, 2);
      assert.equal(options.githubFallback, false);
      assert.ok(options.callTimeoutMs <= 45000);
      if (++calls === 2) throw new Error('{"error":{"code":503,"message":"high demand","status":"UNAVAILABLE"}}');
      return JSON.stringify(correctAnswer);
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.answer, correctAnswer.answer);
  assert.deepEqual(result.linkedExperienceIds, ['owned-experience']);
  assert.ok(result.warnings.some(warning => warning.includes('최종 검토가 지연')));
});

test('an exhausted draft overload exposes a Korean retriable error instead of raw provider JSON', async () => {
  await assert.rejects(generateCoverLetterAnswer({ question }, [rawExperience], {
    generateAI: async () => { throw new Error('{"error":{"code":503,"message":"high demand","status":"UNAVAILABLE"}}'); },
  }), error => error.status === 503 && error.code === 'AI_TEMPORARILY_UNAVAILABLE'
    && error.message.includes('AI 서비스가 일시적으로 혼잡') && !error.message.includes('{'));
});

test('an audit billing failure is propagated rather than bypassed as an optional outage', async () => {
  let calls = 0;
  const failure = Object.assign(new Error('크레딧 부족'), { status: 402, code: 'CREDIT_INSUFFICIENT' });
  await assert.rejects(generateCoverLetterAnswer({ question }, [rawExperience], {
    generateAI: async () => { if (++calls === 2) throw failure; return JSON.stringify(correctAnswer); },
  }), error => error === failure);
});

test('invalid limits and excessive or path-like experience IDs fail early', () => {
  assert.throws(() => normalizeQuestion({ question: question.question, maxLength: -1 }));
  assert.throws(() => normalizeQuestion({ question: question.question, maxLength: 50, minLength: 60 }));
  assert.throws(() => validateExperienceIds(['../private']));
  assert.throws(() => validateExperienceIds(Array(13).fill('same')));
  assert.deepEqual(validateExperienceIds(['a', 'a', 'b']), ['a', 'b']);
});

test('owned saved document retains final state, warnings and evidence, and ignores identity overrides', () => {
  const created = buildCoverLetterDocument({ userId: 'attacker', createdAt: 'forged', id: 'injected', title: '지원서', status: 'final', questions: [{ ...question, answer: correctAnswer.answer, linkedExperienceIds: ['owned-experience'], warnings: ['성과를 최종 확인해주세요.'], evidence: correctAnswer.evidence, review: { charCount: 1, withinLimit: true, unverifiedNumbers: [] } }] }, 'owner');
  assert.equal(created.userId, 'owner');
  assert.equal(created.id, undefined);
  assert.ok(created.createdAt instanceof Date);
  assert.equal(created.status, 'final');
  assert.deepEqual(created.questions[0].warnings, ['성과를 최종 확인해주세요.']);
  assert.deepEqual(created.questions[0].evidence, correctAnswer.evidence);
  const updated = buildCoverLetterDocument({ title: '수정한 지원서', userId: 'other', createdAt: 'fake' }, 'owner', created);
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.userId, 'owner');
  assert.equal(updated.questions.length, 1);
});

test('CRUD ownership checks deny nonexistent and other users documents', () => {
  assert.throws(() => assertCoverLetterOwner(null, 'owner'), error => error.status === 404);
  assert.throws(() => assertCoverLetterOwner({ userId: 'other' }, 'owner'), error => error.status === 403);
  assert.doesNotThrow(() => assertCoverLetterOwner({ userId: 'owner' }, 'owner'));
});

test('company factual fields display only original excerpts despite unrelated model claims', async () => {
  const literal = '고객의 문제를 조사하고 제품을 개선합니다.';
  const result = await analyzeCoverLetter({ text: sourceText }, {
    generateAI: async (_prompt, options) => options.returnMetadata ? { text: '{"insights":[]}', groundingMetadata: null } : JSON.stringify({
      company: '예시기업', position: '프로덕트 매니저', summary: '매출 500억 원의 글로벌 기업입니다.', summaryQuote: '매출 500억 원의 글로벌 기업입니다.',
      business: 'AI 반도체 사업을 운영합니다.', businessQuote: literal,
      rolePriorities: [{ text: '해외 사업 성장 리더', sourceQuote: '해외 사업 성장 리더' }, { text: '새로운 해외 사업 확장', sourceQuote: literal }],
      companyInsights: [{ text: '매출 500억 원을 달성했습니다.', sourceQuote: literal }],
    }),
  });
  assert.equal(result.summary, '');
  assert.equal(result.business, literal);
  assert.deepEqual(result.rolePriorities, [literal]);
  assert.equal(result.companyInsights[0].text, literal);
  assert.ok(!JSON.stringify(result).includes('500억'));
});

test('original interview facts include followup answers but omit AI questions and generated moments', () => {
  const result = experienceSource({ id: 'interview', content: { rawInput: '직접 고객 인터뷰를 진행했습니다.\n=== AI 추출 핵심 경험 ===\n매출을 200% 성장시켰습니다.\n=== AI 채팅 보완 ===\nQ. 매출을 500% 성장시켰나요?\n→ 실제 매출 성과는 측정하지 않았습니다.' }, followupAnswers: [{ question: '팀을 이끌었나요?', answer: '팀원과 의견을 조율했습니다.' }] });
  assert.ok(result.facts.includes('직접 고객 인터뷰'));
  assert.ok(result.facts.includes('성과는 측정하지 않았습니다'));
  assert.ok(result.facts.includes('팀원과 의견을 조율했습니다'));
  assert.ok(!result.facts.includes('200%'));
  assert.ok(!result.facts.includes('500%'));
  assert.ok(!result.facts.includes('팀을 이끌었나요'));
});

test('combined source cap is explicit and its returned document can be saved', async () => {
  const result = await analyzeCoverLetter({ url: 'https://example.com/job', text: '후'.repeat(30000), company: '예시기업', position: '개발' }, {
    scrape: async () => '전'.repeat(30000), generateAI: async () => { throw new Error('unavailable'); },
  });
  assert.equal(result.sourceText.length, 60000);
  assert.ok(result.uncertainties.some(value => value.includes('60,000자')));
  assert.doesNotThrow(() => buildCoverLetterDocument({ sourceText: result.sourceText, analysis: result, questions: result.questions }, 'owner'));
});

test('automatic questions after a long public privacy notice survive analysis and saving', async () => {
  const questionText = `${'개인정보 처리 안내입니다.\n'.repeat(2400)}자기소개서 문항\n1. 지원동기 (700자 이내, 공백 제외)\n합격자소서\n자기소개서 문항\n1. 성장과정 (500자)`;
  assert.ok(questionText.indexOf('지원동기') > 30000 && questionText.length < 50000);
  const result = await analyzeCoverLetter({ url: 'https://example.com/jobs/42', company: '예시기업', position: '개발' }, {
    scrape: async () => ({ text: sourceText, questionText, applicationAccess: 'public' }),
    generateAI: async () => { throw new Error('unavailable'); },
  });
  assert.equal(result.questionStatus, 'verified');
  assert.deepEqual(result.questions.map(item => item.question), ['지원동기']);
  assert.equal(result.questions[0].maxLength, 700);
  assert.equal(result.questions[0].countSpaces, false);
  const saved = buildCoverLetterDocument({ analysis: result, questions: result.questions }, 'owner');
  assert.equal(saved.questions[0].validation, 'verified');
  assert.equal(normalizePostingQuestions(saved.questions, saved.analysis.questionSourceText).length, 1);
});

test('combined material preserves verified question excerpts inside the saved 60k evidence budget', async () => {
  const scrapedProof = `${'공개 안내 자료\n'.repeat(5000)}자기소개서 문항\n1. 지원동기 (500자 이내)\n합격자소서\n자기소개서 문항\n1. 직무 역량 (900자)`;
  const manualProof = `${'보충 메모\n'.repeat(4000)}자기소개서 문항\n1. 성장과정 (20~700자)`;
  assert.ok(scrapedProof.length < 50000 && manualProof.length < 30000);
  assert.ok(scrapedProof.length + manualProof.length > 60000);
  const result = await analyzeCoverLetter({ url: 'https://example.com/jobs/42', text: manualProof, questionImport: true, company: '예시기업', position: '개발' }, {
    scrape: async () => ({ text: sourceText, questionText: scrapedProof }),
    generateAI: async () => { throw new Error('unavailable'); },
  });
  assert.ok(result.questionSourceText.length < 60000);
  assert.deepEqual(result.questions.map(item => item.question), ['지원동기', '성장과정']);
  assert.deepEqual(result.questions.map(item => [item.minLength, item.maxLength]), [[null, 500], [20, 700]]);
  const saved = buildCoverLetterDocument({ analysis: result, questions: result.questions }, 'owner');
  assert.ok(saved.questions.every(item => item.validation === 'verified'));
  assert.equal(normalizePostingQuestions(saved.questions, saved.analysis.questionSourceText).length, 2);
  const generated = await generateCoverLetterAnswer({ question: saved.questions[1], analysis: saved.analysis }, [rawExperience], {
    generateAI: async () => JSON.stringify(correctAnswer),
  });
  assert.equal(generated.answer, correctAnswer.answer);
});

test('automatic lookup reports registration or login limits without presenting invented questions', async () => {
  for (const applicationAccess of ['registration_required', 'login_required']) {
    const result = await analyzeCoverLetter({ url: 'https://example.com/jobs/42', company: '예시기업', position: '개발' }, {
      scrape: async () => ({ text: '기업명: 예시기업\n모집 직무: 개발\n고객의 문제를 조사하고 제품을 개선하는 담당자를 모집합니다.', questionText: '개인정보 수집 동의\n지원자 등록\n이름\n생년월일\n비밀번호', applicationAccess }),
      generateAI: async () => JSON.stringify({ questions: [{ question: '지원동기', sourceQuote: '지원동기', maxLength: 500 }] }),
    });
    assert.equal(result.applicationAccess, applicationAccess);
    assert.equal(result.questionStatus, 'unavailable');
    assert.deepEqual(result.questions, []);
    assert.ok(result.questionNotice.includes('공개 공고와 공식 지원서를 조회'));
    assert.ok(!/설치|붙여넣어주세요/.test(result.questionNotice));
  }
});

test('shortening long question evidence never creates a second truncated version of a real prompt', async () => {
  const prompt = `Please describe your experience. ${'a'.repeat(800)} and explain the result.`;
  const manual = `${'memo\n'.repeat(1760)}자기소개서 문항\n1. ${prompt}\n700자 이내\n${'tail\n'.repeat(1800)}`;
  const result = await analyzeCoverLetter({ url: 'https://example.com/jobs/42', text: manual, questionImport: true, company: 'Example', position: 'Engineer' }, {
    scrape: async () => ({ text: 'Company Example recruits engineers who improve the product.', questionText: 'notice\n'.repeat(7140) }),
    generateAI: async () => { throw new Error('unavailable'); },
  });
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].question, prompt);
  assert.equal(result.questions[0].maxLength, 700);
  const saved = buildCoverLetterDocument({ analysis: result, questions: result.questions }, 'owner');
  assert.equal(saved.questions[0].validation, 'verified');
});

test('credit failure propagates instead of being converted to successful partial analysis', async () => {
  const error = Object.assign(new Error('크레딧 부족'), { status: 402, code: 'INSUFFICIENT_CREDITS' });
  await assert.rejects(analyzeCoverLetter({ text: sourceText, company: '예시기업' }, { generateAI: async () => { throw error; } }), candidate => candidate === error);
  let calls = 0;
  await assert.rejects(analyzeCoverLetter({ text: sourceText, company: '예시기업' }, { generateAI: async () => {
    calls += 1;
    if (calls === 1) return JSON.stringify({ company: '예시기업', position: '프로덕트 매니저' });
    throw error;
  } }), candidate => candidate === error);
});
