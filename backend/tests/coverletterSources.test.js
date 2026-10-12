import test from 'node:test';
import assert from 'node:assert/strict';
import { postingHtmlToText, scopePostingHtml, extractApplicationLinks, scrapeCoverLetterPosting } from '../src/services/coverLetterSources.js';
import { extractPostingQuestions } from '../src/services/coverLetterEvidence.js';
import { analyzeCoverLetter, generateCoverLetterAnswer, buildCoverLetterDocument } from '../src/services/coverLetterService.js';
import { fetchPublicText } from '../src/services/publicWebFetch.js';

const postingUrl = 'https://www.jobkorea.co.kr/Recruit/GI_Read/50122030?Oem_Code=C1&PageGbn=ST&sc=419';
const detailUrl = 'https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno=50122030';
const roleUrls = [1537, 1539, 1540].map(id => `https://recruit.sfa.co.kr/sfasemicon/recruit?id=${id}&pg=1`);
const mainHtml = `<html><title>SFA반도체㈜ 채용 - 2026년도 부문별 신입/경력 채용 | 잡코리아</title>
<nav>합격자소서</nav><div data-jobview-section="atf">SFA반도체㈜<h1>2026년도 부문별 신입/경력 채용</h1></div>
<div data-jobview-section="qualification"><h2>지원자격</h2><p>고등학교 졸업 이상인 자</p></div>
<div data-sentry-component="PassAssay"><h3>합격자소서</h3><div><span>2018년 상반기 신입</span><h3>자기소개서 문항</h3><p>1. 지원동기 (500자)</p></div></div>
<aside><a href="https://unrelated.example.com/job?id=12">지원하기</a></aside><footer>성장과정</footer></html>`;
const detailHtml = `<div id="detail-content"><h2>모집요강</h2><table><tbody>
<tr><td>제조본부</td><td>제조 <span class="br"></span>Operator</td><td><strong>필수조건</strong><p>고등학교 졸업 이상인 자</p><p>반도체 설비 Operation 업무 수행 가능자</p><p>우대조건</p><p>반도체 후공정 Operator 경험자 우대</p></td><td><a href="http://www.jobkorea.co.kr/List_GI/Co_HomePage_Open.asp?home=https%3A//recruit.sfa.co.kr/sfasemicon/recruit%3Fid%3D1537%26pg%3D1&amp;GI_No=51733503">지원하기</a></td></tr>
<tr><td>제조본부</td><td>제조기술 Maintenance</td><td>전문학사 이상인 자(전자, 전기, 기계, 반도체 전공)</td><td><a href="${roleUrls[1]}">지원하기</a></td></tr>
<tr><td>품질팀</td><td>품질검사원</td><td>반도체 후공정 품질 검사원 경험자 우대</td><td><a href="${roleUrls[2]}">지원하기</a></td></tr>
</tbody></table><h2>제출서류</h2><p>최종합격 후 제출</p></div>`;
const corporateRoleHtml = id => `<header><a href="/apply/resume">입사지원</a></header><div id="contents"><h2>채용공고</h2><p>제조본부 제조 Operator</p><p>접수기간 2026.10.06 ~ 2026.10.14</p><p>필수조건</p><p>반도체 설비 Operation 업무 수행 가능자</p><a href="/apply/resume?gbn=1&rnId=${id}">입사지원하기</a></div>`;
const landingHtml = '<html><title>SFA 채용</title><div id="contents"><p>회사 선택</p><a href="/sfa/">SFA</a><a href="/sfasemicon/">SFASEMICON</a></div></html>';
const fakeFetch = async (url) => {
  if (url === postingUrl) return mainHtml;
  if (url === detailUrl) return detailHtml;
  const roleIndex = roleUrls.indexOf(url);
  if (roleIndex !== -1) return corporateRoleHtml([1537, 1539, 1540][roleIndex]);
  if (url.startsWith('https://recruit.sfa.co.kr/apply/resume?')) return landingHtml;
  throw new Error(`Unexpected URL ${url}`);
};
const fakeAi = async (_prompt, options) => options.returnMetadata ? { text: '{"insights":[]}' }
  : JSON.stringify({ company: 'SFA반도체㈜', position: '제조 Operator', questions: [{ question: '고등학교 졸업 이상인 자 반도체 설비 Operation 업무 수행 가능자 우대조건 반도체 후공정 Operator 경험자 우대', sourceQuote: '고등학교 졸업 이상인 자 반도체 설비 Operation 업무 수행 가능자 우대조건 반도체 후공정 Operator 경험자 우대' }] });

test('current JobKorea scope removes nested 2018 essay widgets and retains job paragraph boundaries', () => {
  const text = postingHtmlToText(scopePostingHtml(mainHtml, postingUrl));
  assert.ok(text.includes('지원자격\n고등학교 졸업 이상인 자'));
  assert.ok(!text.includes('2018'));
  assert.ok(!text.includes('합격자소서'));
  assert.deepEqual(extractPostingQuestions(text), []);
  assert.ok(postingHtmlToText(detailHtml).includes('고등학교 졸업 이상인 자\n반도체 설비'));
});

test('exact current outgoing job links are decoded with their per-role table labels', () => {
  const links = extractApplicationLinks(detailHtml, detailUrl);
  assert.deepEqual(links.map(link => link.url), roleUrls);
  assert.deepEqual(links.map(link => link.label), ['제조본부 · 제조 Operator', '제조본부 · 제조기술 Maintenance', '품질팀 · 품질검사원']);
  assert.deepEqual(extractApplicationLinks(mainHtml, postingUrl), []);
});

test('multi-role source requires selection and never follows the first role by default', async () => {
  const fetched = [];
  const result = await scrapeCoverLetterPosting(postingUrl, { safeFetch: async url => { fetched.push(url); return fakeFetch(url); } });
  assert.equal(result.questionStatus, 'selection_required');
  assert.equal(result.applicationUrl, '');
  assert.equal(result.applicationLinks.length, 3);
  // The public counterpart search is allowed; no employer role is selected or fetched.
  assert.deepEqual(fetched, [postingUrl, detailUrl, `https://jasoseol.com/api/v1/employment_companies?q=${encodeURIComponent('SFA반도체')}`]);
  assert.deepEqual(extractPostingQuestions(result.questionText), []);
});

test('selected exact role follows its own current rnId form and unavailable access does not invent questions', async () => {
  const result = await scrapeCoverLetterPosting(postingUrl, { safeFetch: fakeFetch, applicationUrl: roleUrls[1] });
  assert.equal(result.applicationUrl, 'https://recruit.sfa.co.kr/apply/resume?gbn=1&rnId=1539');
  assert.deepEqual(extractPostingQuestions(result.questionText), []);
  assert.ok(result.sources.some(source => source.url === roleUrls[1]));
  const analysis = await analyzeCoverLetter({ url: postingUrl, applicationUrl: roleUrls[1] }, { scrape: (url, options) => scrapeCoverLetterPosting(url, { ...options, safeFetch: fakeFetch }), generateAI: fakeAi });
  assert.equal(analysis.questionStatus, 'unavailable');
  assert.deepEqual(analysis.questions, []);
  assert.equal(analysis.selectedApplicationUrl, roleUrls[1]);
  assert.equal(analysis.position, '제조본부 · 제조기술 Maintenance');
  assert.ok(analysis.questionNotice.includes('실제 자기소개서 문항'));
});

const registrationHtml = `<main><h2>입사지원</h2>
<form name="fResume" id="fResume" method="post" action="resumesave" onsubmit="return false;">
<p>개인정보 수집·이용 동의</p><input name="agree1" type="radio" value="Y">
<p>민감정보 수집·이용 동의</p><input name="agree2" type="radio" value="Y">
<label>이름</label><input name="name" type="text" required>
<label>생년월일</label><input name="birthday" type="text" required>
<label>휴대폰</label><select name="hp1"></select><input name="hp2" type="text"><input name="hp3" type="text">
<label>이메일</label><input name="email_id" type="text"><input name="email_domain" type="text">
<label>비밀번호</label><input name="passwd" type="password" required><input name="rpasswd" type="password" required>
<button>다음 단계</button></form></main>`;

test('the current SFA first registration step is reported precisely without submitting applicant data', async () => {
  const requests = [];
  const safeFetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET' });
    return url.startsWith('https://recruit.sfa.co.kr/apply/resume?') ? registrationHtml : fakeFetch(url);
  };
  const scrape = (url, options) => scrapeCoverLetterPosting(url, { ...options, safeFetch });
  const result = await scrape(postingUrl, { applicationUrl: roleUrls[0] });
  assert.equal(result.applicationAccess, 'registration_required');
  assert.equal(result.applicationUrl, 'https://recruit.sfa.co.kr/apply/resume?gbn=1&rnId=1537');
  assert.deepEqual(extractPostingQuestions(result.questionText), []);
  const analysis = await analyzeCoverLetter({ url: postingUrl, applicationUrl: roleUrls[0] }, { scrape, generateAI: fakeAi });
  assert.equal(analysis.applicationAccess, 'registration_required');
  assert.equal(analysis.questionStatus, 'unavailable');
  assert.deepEqual(analysis.questions, []);
  assert.ok(analysis.questionNotice.includes('개인정보 동의와 지원자 등록'));
  assert.ok(analysis.questionNotice.includes('실제 자소서 문항을 확인하지 못했습니다'));
  assert.ok(requests.every(request => request.method === 'GET' && !request.url.includes('resumesave')));
});

test('real public prompts remain available when a form also contains registration fields', async () => {
  const formHtml = registrationHtml.replace('</form>', '<h2>자기소개서 문항</h2><label>1. 지원동기 (600자)</label><textarea></textarea></form>');
  const result = await scrapeCoverLetterPosting(postingUrl, { applicationUrl: roleUrls[0], safeFetch: async url =>
    url.startsWith('https://recruit.sfa.co.kr/apply/resume?') ? formHtml : fakeFetch(url) });
  assert.equal(result.applicationAccess, 'public');
  assert.deepEqual(extractPostingQuestions(result.questionText).map(question => question.question), ['지원동기']);
});

test('a login gate keeps its distinct access reason without generating substitute questions', async () => {
  const formHtml = '<main><h2>로그인</h2><form action="login"><input name="email" type="text"><input name="passwd" type="password"><button>로그인</button></form></main>';
  const scrape = (url, options) => scrapeCoverLetterPosting(url, { ...options, safeFetch: async target =>
    target.startsWith('https://recruit.sfa.co.kr/apply/resume?') ? formHtml : fakeFetch(target) });
  const analysis = await analyzeCoverLetter({ url: postingUrl, applicationUrl: roleUrls[0] }, { scrape, generateAI: fakeAi });
  assert.equal(analysis.applicationAccess, 'login_required');
  assert.deepEqual(analysis.questions, []);
  assert.ok(analysis.questionNotice.includes('로그인 또는 본인 인증'));
  assert.ok(analysis.questionNotice.includes('실제 자소서 문항을 확인하지 못했습니다'));
});

test('unattached application URLs are rejected before they are fetched even with manual supplemental text', async () => {
  let unrelatedFetched = false;
  await assert.rejects(analyzeCoverLetter({ url: postingUrl, applicationUrl: 'https://unrelated.example.com/job?id=12', text: '직접 입력한 충분히 긴 자료가 있더라도 잘못된 지원 페이지는 수집하지 않습니다.' }, {
    scrape: (url, options) => scrapeCoverLetterPosting(url, { ...options, safeFetch: async target => { if (target.includes('unrelated')) unrelatedFetched = true; return fakeFetch(target); } }), generateAI: fakeAi,
  }), error => error.status === 400);
  assert.equal(unrelatedFetched, false);
});

test('public selected application form supplies every real prompt even if the model returns only one', async () => {
  const url = 'https://careers.example.com/jobs/abc123';
  const sourceHtml = '<title>예시기업 개발 채용</title><main><p>기업명: 예시기업</p><p>모집 직무: 개발</p><p>담당업무: 제품 개발 및 개선</p><a href="/apply/abc123">지원하기</a></main>';
  const formHtml = '<main><h2>자기소개서 문항</h2><label>1. 지원동기 (500자)</label><textarea></textarea><label>2. 최근에 읽은 책이 본인에게 미친 영향을 설명해주세요. (700자)</label><textarea></textarea></main>';
  const scrape = (target, options) => scrapeCoverLetterPosting(target, { ...options, safeFetch: async fetched => fetched === url ? sourceHtml : formHtml });
  const generateAI = async (_prompt, options) => options.returnMetadata ? { text: '{"insights":[]}' }
    : JSON.stringify({ company: '예시기업', position: '개발', questions: [{ question: '지원동기', sourceQuote: '1. 지원동기 (500자)' }] });
  const analysis = await analyzeCoverLetter({ url }, { scrape, generateAI });
  assert.equal(analysis.questionStatus, 'verified');
  assert.deepEqual(analysis.questions.map(question => question.question), ['지원동기', '최근에 읽은 책이 본인에게 미친 영향을 설명해주세요.']);
  assert.deepEqual(analysis.questions.map(question => question.maxLength), [500, 700]);
  const canonicalAfterPosting = extractPostingQuestions(`${analysis.questionSourceText}\n성장과정`);
  assert.deepEqual(canonicalAfterPosting.map(question => question.question), analysis.questions.map(question => question.question));
});

test('dedicated short question import is explicit and stores raw user input independently of scoped proof', async () => {
  const text = '지원동기 (500자)';
  const analysis = await analyzeCoverLetter({ company: '예시기업', position: '개발', text, questionImport: true }, { generateAI: async () => { throw new Error('unavailable'); } });
  assert.equal(analysis.questionStatus, 'verified');
  assert.equal(analysis.questions[0].question, '지원동기');
  assert.equal(analysis.sourceInputText, text);
  assert.ok(analysis.questionSourceText.includes('자기소개서 문항\n지원동기'));
  const document = buildCoverLetterDocument({ analysis, sourceInputText: text }, 'owner');
  assert.equal(document.sourceInputText, text);
  await assert.rejects(analyzeCoverLetter({ company: '예시기업', position: '개발', text }, { generateAI: async () => { throw new Error('unavailable'); } }), error => error.status === 400);
});

test('corrupt old duties labeled posting cannot trigger paid draft generation', async () => {
  let calls = 0;
  await assert.rejects(generateCoverLetterAnswer({ question: { question: '반도체 설비 Operation 업무 수행 가능자 우대조건 반도체 후공정 Operator 경험자 우대', source: 'posting', sourceQuote: '반도체 설비 Operation 업무 수행 가능자 우대조건 반도체 후공정 Operator 경험자 우대' }, analysis: { sourceText: postingHtmlToText(detailHtml) } }, [], { generateAI: async () => { calls += 1; } }), error => error.status === 422);
  assert.equal(calls, 0);
});

test('an empty scoped form source never falls back to a real-looking archive quote during generation', async () => {
  const question = '팀과 협업하며 배운 점을 작성해주세요.';
  let calls = 0;
  for (const analysis of [{ sourceText: question, questionSourceText: '' }, {}]) {
    await assert.rejects(generateCoverLetterAnswer({ question: { question, source: 'posting', sourceQuote: question }, analysis }, [], {
      generateAI: async () => { calls += 1; },
    }), error => error.status === 422);
  }
  assert.equal(calls, 0);
});

test('twelve new questions and twelve quarantined answers can be saved without losing recovery material', () => {
  const archived = Array.from({ length: 12 }, (_, index) => ({ id: `old-${index}`, question: '반도체 설비 Operation 업무 수행 가능자', source: 'posting', sourceQuote: '반도체 설비 Operation 업무 수행 가능자', answer: `기존 답변 ${index}` }));
  const current = Array.from({ length: 12 }, (_, index) => ({ id: `new-${index}`, question: '직접 입력한 지원서 문항입니다.', source: 'manual', answer: '' }));
  const saved = buildCoverLetterDocument({ questions: [...current, ...archived], analysis: { questionSourceText: '' } }, 'owner');
  assert.equal(saved.questions.length, 24);
  assert.equal(saved.questions.filter(question => question.validation === 'unverified').length, 12);
  assert.equal(saved.questions[23].answer, '기존 답변 11');
  assert.throws(() => buildCoverLetterDocument({ questions: [...current, { id: 'new-13', question: '추가 문항', source: 'manual' }] }, 'owner'), error => error.status === 400);
});

test('Jasoseol public question lookup selects current employment ID and preserves explicit character conventions', async () => {
  const sourceUrl = 'https://jasoseol.com/recruit/123456';
  const roleUrl = 'https://jasoseol.com/resume_list?ec=123456&e=42';
  const data = { name: '예시기업', title: '2026 개발 채용', content: '<p>담당업무: 제품 개발</p>', employment_page_url: 'https://careers.example.com/apply/123456', employments: [{ id: 41, field: '기획', has_resume: true }, { id: 42, field: '개발', has_resume: true }] };
  const requests = [];
  const safeFetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url === sourceUrl) return '<title>예시기업 채용</title><main>자소서 문항 보기</main>';
    if (url.includes('/api/v1/employment_companies/')) return JSON.stringify(data);
    if (url.endsWith('/employment/employment_question.json')) {
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), { employment_id: 42 });
      return JSON.stringify({ employment_question: [{ question: '1. 지원동기', is_character: true, include_space: false, total_count: 700 }, { question: '2. 개인적으로 중요하게 생각하는 가치를 설명해주세요.', is_character: false, include_space: true, total_count: 1000 }] });
    }
    throw new Error('Unexpected fetch');
  };
  const initial = await scrapeCoverLetterPosting(sourceUrl, { safeFetch });
  assert.equal(initial.questionStatus, 'selection_required');
  assert.equal(initial.applicationLinks.length, 2);
  assert.ok(!requests.some(request => request.options.method === 'POST'));
  const selected = await scrapeCoverLetterPosting(sourceUrl, { safeFetch, applicationUrl: roleUrl });
  const questions = extractPostingQuestions(selected.questionText);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].maxLength, 700);
  assert.equal(questions[0].countSpaces, false);
  assert.equal(questions[1].maxLength, null);
  assert.equal(selected.applicationUrl, data.employment_page_url);
});

test('public transport refuses POST outside the confirmed provider question read endpoint before network access', async () => {
  await assert.rejects(fetchPublicText('https://example.com/apply', { method: 'POST', body: '{}' }), error => error.status === 400);
  await assert.rejects(fetchPublicText('https://jasoseol.com/api/v1/resumes', { method: 'POST', body: '{}' }), error => error.status === 400);
});

test('Ottogi portal counterpart keeps all fifteen roles and supplies three questions after exact role selection', async () => {
  const url = 'https://www.jobkorea.co.kr/Recruit/GI_Read/50081150?Oem_Code=C1&PageGbn=ST&sc=419';
  const counterpartUrl = 'https://jasoseol.com/api/v1/employment_companies/106624';
  const roles = Array.from({ length: 15 }, (_, index) => ({ id: 432278 + index, field: `직무 ${index + 1}`, has_resume: true }));
  const roleUrl = 'https://jasoseol.com/resume_list?ec=106624&e=432292';
  const questions = [
    { question: '음식과 관련된 본인의 경험과 배운 점을 작성하십시오. (공백 제외 최소 150자 / 최대 300자 제한)' },
    { question: '지원직무에 필요한 역량을 경험과 연결하여 설명하십시오. (공백 제외 최소 300자 / 최대 700자 제한)' },
    { question: '지원한 이유와 입사 후 목표를 설명하십시오. (공백 제외 최소 200자 / 최대 400자 제한)' },
  ];
  let questionReads = 0;
  const safeFetch = async (target, options = {}) => {
    if (target === url) return '<title>㈜오뚜기 채용 - 2026년 하반기 대졸신입사원 및 외국인유학생 채용 | 잡코리아</title><main>오뚜기 신입 채용</main>';
    if (target.includes('GI_Read_Comt_Ifrm')) return `<main><p>${'오뚜기 현재 신입 공고의 담당업무와 지원자격 안내입니다. '.repeat(8)}</p></main>`;
    if (target.includes('employment_companies?q=')) return JSON.stringify([{ id: 106624, name: '오뚜기', title: '2026년 하반기 대졸신입사원 및 외국인유학생 채용' }]);
    if (target === counterpartUrl) return JSON.stringify({ name: '오뚜기', title: '2026년 하반기 대졸신입사원 및 외국인유학생 채용', employments: roles, employment_page_url: 'https://www.otoki.com/about/recruitment' });
    if (target.endsWith('/employment/employment_question.json')) {
      questionReads++;
      assert.deepEqual(JSON.parse(options.body), { employment_id: 432292 });
      return JSON.stringify({ employment_question: questions });
    }
    throw new Error(`Unexpected URL ${target}`);
  };
  const scrape = (target, options) => scrapeCoverLetterPosting(target, { ...options, safeFetch });
  const initial = await scrape(url);
  assert.equal(initial.applicationLinks.length, 15);
  assert.equal(initial.questionStatus, 'selection_required');
  assert.equal(questionReads, 0);
  const result = await analyzeCoverLetter({ url, applicationUrl: roleUrl }, { scrape, generateAI: async () => { throw new Error('AI unavailable'); } });
  assert.equal(questionReads, 1);
  assert.equal(result.company, '오뚜기');
  assert.equal(result.position, '직무 15');
  assert.equal(result.questionStatus, 'verified');
  assert.ok(result.questionNotice.includes('자소설닷컴'));
  assert.deepEqual(result.questions.map(item => [item.minLength, item.maxLength, item.countSpaces]), [[150, 300, false], [300, 700, false], [200, 400, false]]);
});

const hydrationUrl = 'https://careers.example.com/jobs/abc123';

test('a job-specific apply link outside main is followed even with a short posting ID', async () => {
  const url = 'https://careers.example.com/jobs/42';
  const applyUrl = 'https://careers.example.com/apply/42';
  const html = `<header><a href="/apply/42">지원하기</a><a href="/apply/resume">입사지원</a><a href="/apply/registration">지원자 등록</a></header>
    <main><h1>예시기업 개발 채용</h1><p>${'담당업무: 제품 개발 및 개선. '.repeat(8)}</p></main>
    <aside><a href="/apply/99">지원하기</a></aside>`;
  const fetched = [];
  const result = await scrapeCoverLetterPosting(url, { safeFetch: async target => {
    fetched.push(target);
    if (target === url) return html;
    assert.equal(target, applyUrl);
    return '<main><h2>자기소개서 문항</h2><label>지원동기 (700자)</label><textarea></textarea></main>';
  } });
  assert.deepEqual(result.applicationLinks.map(link => link.url), [applyUrl]);
  assert.deepEqual(fetched, [url, applyUrl]);
  assert.deepEqual(extractPostingQuestions(result.questionText).map(item => item.question), ['지원동기']);
});

test('initial-page Next Flight markup is decoded before scripts are removed', async () => {
  const markup = `<main><h1>예시기업 개발 채용</h1><p>${'담당업무: 제품 개발 및 개선. '.repeat(8)}</p>
    <h2>자기소개서 문항</h2><label>지원동기 (600자)</label></main>`;
  const html = `<title>예시기업 개발 채용</title><script>self.__next_f.push([1,${JSON.stringify(markup)}])</script>`;
  const result = await scrapeCoverLetterPosting(hydrationUrl, { safeFetch: async () => html });
  assert.deepEqual(extractPostingQuestions(result.questionText).map(item => [item.question, item.maxLength]), [['지원동기', 600]]);
});

test('Next Flight markup on the connected application page also supplies real questions', async () => {
  const url = 'https://careers.example.com/jobs/42';
  const markup = '<main><h2>자기소개서 문항</h2><label>지원동기 (600자)</label></main>';
  const result = await scrapeCoverLetterPosting(url, { safeFetch: async target => target === url
    ? `<main><p>${'예시기업 개발 채용 공고입니다. '.repeat(8)}</p><a href="/apply/42">지원하기</a></main>`
    : `<script>self.__next_f.push([1,${JSON.stringify(markup)}])</script>` });
  assert.deepEqual(extractPostingQuestions(result.questionText).map(item => [item.question, item.maxLength]), [['지원동기', 600]]);
  assert.equal(result.applicationAccess, 'public');
});

const hydrationHtml = data => `<title>예시기업 현재 개발 채용</title><main><p>기업명: 예시기업</p><p>모집 직무: 개발</p><p>${'현재 개발 채용의 업무와 근무 조건 안내입니다. '.repeat(8)}</p></main><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`;

test('inert current-job application JSON supplies literal prompts and explicit character or byte units', async () => {
  const html = hydrationHtml({ props: { pageProps: { job: { id: 'abc123', applicationQuestions: [
    { question: '1. 지원동기', minLength: 100, maxLength: 700, unit: 'characters', countSpaces: false },
    { question: 'Describe a time when you resolved a difficult problem.', max_length: 1024, length_unit: 'bytes' },
    { question: '본인의 강점을 구체적인 경험과 함께 설명해주세요.', maxLength: 500 },
  ] } } } });
  const result = await scrapeCoverLetterPosting(hydrationUrl, { safeFetch: async () => html });
  const questions = extractPostingQuestions(result.questionText);
  assert.deepEqual(questions.map(question => question.question), ['지원동기', 'Describe a time when you resolved a difficult problem.', '본인의 강점을 구체적인 경험과 함께 설명해주세요.']);
  assert.equal(questions[0].minLength, 100);
  assert.equal(questions[0].maxLength, 700);
  assert.equal(questions[0].countSpaces, false);
  assert.equal(questions[1].maxLength, null);
  assert.ok(questions[1].sourceQuote.includes('1024바이트'));
  assert.equal(questions[2].maxLength, null);
});

test('current-job JSON rejects same-page archives, generic templates, other jobs and mismatched question rows', async () => {
  const wrong = { question: '지원 직무를 위해 준비한 경험을 설명해주세요.', maxLength: 500, unit: 'characters' };
  const html = hydrationHtml({ props: { pageProps: {
    job: { id: 'abc123', applicationQuestions: [
      { question: '지원동기', maxLength: 700, unit: 'characters' },
      { ...wrong, job_id: 'different-job' }, { ...wrong, isArchived: true },
    ], otherJob: { id: 'different-job', applicationQuestions: [wrong] }, questions: [wrong] },
    jobs: [{ id: 'different-job', applicationQuestions: [wrong] }],
    archivedJobs: [{ id: 'abc123', applicationQuestions: [wrong] }],
    historicalQuestions: { job: { id: 'abc123', applicationQuestions: [wrong] } },
    recommendations: { job: { id: 'abc123', applicationQuestions: [wrong] } },
    templates: { job: { id: 'abc123', applicationQuestions: [wrong] } },
  } } });
  const result = await scrapeCoverLetterPosting(hydrationUrl, { safeFetch: async () => html });
  assert.deepEqual(extractPostingQuestions(result.questionText).map(question => question.question), ['지원동기']);
  assert.ok(!result.questionText.includes(wrong.question));
});

test('hydration role questions require the exact selected role and never choose another role by default', async () => {
  const operator = '제조 Operator에 지원한 이유를 경험과 함께 설명해주세요.';
  const maintenance = '설비 유지보수 문제를 해결한 경험을 설명해주세요.';
  const html = hydrationHtml({ job: { id: 'abc123', roles: [
    { id: 'maintenance', application: { questions: [{ question: maintenance, maxLength: 600, unit: 'characters' }] } },
    { id: 'operator', application: { questions: [{ question: operator, maxLength: 700, unit: 'characters' }] } },
  ] } });
  const initial = await scrapeCoverLetterPosting(hydrationUrl, { safeFetch: async () => html });
  assert.deepEqual(extractPostingQuestions(initial.questionText), []);
  const selected = await scrapeCoverLetterPosting(`${hydrationUrl}?role_id=operator`, { safeFetch: async () => html });
  assert.deepEqual(extractPostingQuestions(selected.questionText).map(question => question.question), [operator]);
  assert.ok(!selected.questionText.includes(maintenance));
});

test('unidentified or malformed JSON and executable hydration never become application proof', async () => {
  const question = '본인이 협업한 경험을 설명해주세요.';
  const base = hydrationHtml({ applicationQuestions: [{ question }] });
  const scripts = [
    '<script type="application/json">{ broken json }</script>',
    `<script>throw new Error('do not execute'); window.__NEXT_DATA__=${JSON.stringify({ job: { id: 'abc123', applicationQuestions: [{ question }] } })};</script>`,
    `<script type="application/json">${JSON.stringify({ job: { id: 'different-job', applicationQuestions: [{ question }] } })}</script>`,
  ];
  for (const suffix of ['', ...scripts]) {
    const result = await scrapeCoverLetterPosting(hydrationUrl, { safeFetch: async () => base + suffix });
    assert.deepEqual(extractPostingQuestions(result.questionText), []);
  }
});

test('public prompt excerpts survive the source cap when long current application text precedes them', async () => {
  const question = '본인이 어려운 문제를 해결한 경험을 설명해주세요.';
  const html = `<title>예시기업 현재 채용</title><main><p>${'현재 지원서 안내 문구입니다. '.repeat(4000)}</p><h2>자기소개서 문항</h2><label>1. ${question} (700자)</label><textarea></textarea></main>`;
  const result = await scrapeCoverLetterPosting(hydrationUrl, { safeFetch: async () => html });
  assert.ok(result.questionText.length < 50000);
  const questions = extractPostingQuestions(result.questionText);
  assert.deepEqual(questions.map(item => item.question), [question]);
  assert.equal(questions[0].maxLength, 700);
  assert.ok(result.questionText.startsWith('[현재 공고의 지원 페이지]\n자기소개서 문항\n1.'));
  assert.ok(!result.questionText.includes('현재 지원서 안내 문구입니다.'));
});

test('oversize question proof never turns a clipped invalid long prompt into a verified question', async () => {
  const invalidQuestion = `본인의 경험을 설명해주세요. ${'세부 상황과 전체 맥락 '.repeat(180)}`;
  assert.ok(invalidQuestion.length > 1600);
  const html = `<title>예시기업 현재 채용</title><main><p>${'일반 안내 '.repeat(10000)}</p><h2>자기소개서 문항</h2><label>1. ${invalidQuestion}</label></main>`;
  const result = await scrapeCoverLetterPosting(hydrationUrl, { safeFetch: async () => html });
  assert.equal(result.questionText.length, 0);
  assert.deepEqual(extractPostingQuestions(result.questionText), []);
});
