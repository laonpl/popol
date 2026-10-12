// Read-only synthetic DOM review. No real account, cookie, applicant or API is used.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { captureApplicationQuestions } from '../../frontend/src/utils/applicationQuestionCapture.js';

const browser = await puppeteer.launch({ headless: true, pipe: true, args: ['--no-sandbox'] });
const checks = [];
try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => request.respond({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.goto('https://apply.example.invalid/resume?rnId=1537&gbn=1&candidate_token=private&email=private%40example.invalid#secret');
  const capture = async html => {
    await page.setContent(`<html><head><style>textarea { width: 300px; height: 80px; } [contenteditable] { min-height: 60px; }</style></head><body>${html}</body></html>`);
    await page.evaluate(() => {
      // Access to applicant values, cookies, whole body text or a submission is a failure.
      const forbidden = () => { throw new Error('Applicant data or submission was accessed'); };
      for (const element of document.querySelectorAll('input,textarea,select,[contenteditable]')) {
        Object.defineProperty(element, 'value', { configurable: true, get: forbidden });
        Object.defineProperty(element, 'innerText', { configurable: true, get: forbidden });
        Object.defineProperty(element, 'textContent', { configurable: true, get: forbidden });
      }
      Object.defineProperty(document, 'cookie', { configurable: true, get: forbidden });
      Object.defineProperty(document.body, 'innerText', { configurable: true, get: forbidden });
      Object.defineProperty(document.body, 'textContent', { configurable: true, get: forbidden });
      window.fetch = forbidden;
      HTMLFormElement.prototype.submit = forbidden;
      HTMLFormElement.prototype.requestSubmit = forbidden;
    });
    // Serializing mimics chrome.scripting: this function has no imported closure.
    return page.evaluate(captureApplicationQuestions);
  };

  let result = await capture(`<nav><label for="past">합격자소서 지원동기</label><textarea id="past">비공개 과거 답변</textarea></nav>
    <form><h2>자기소개서 문항</h2>
      <div><label for="a">1. 지원동기 및 입사 후 포부</label><textarea id="a" maxlength="700" minlength="100">이미 쓴 비공개 답변</textarea><small>공백 제외</small></div>
      <div><label for="b">2. 본인이 협업하며 문제를 해결한 경험을 작성해주세요. (400자 이내)</label><textarea id="b">비공개 답변</textarea></div>
      <div hidden><label for="hidden">실패 경험</label><textarea id="hidden"></textarea></div>
      <label for="phone">휴대폰 번호</label><input id="phone" value="010-private">
    </form><aside><h2>합격자소서</h2><label for="archive">성장과정</label><textarea id="archive"></textarea></aside>`);
  assert.deepEqual(result.questions.map(item => item.question), ['지원동기 및 입사 후 포부', '본인이 협업하며 문제를 해결한 경험을 작성해주세요.']);
  assert.deepEqual(result.questions.map(item => [item.minLength, item.maxLength, item.countSpaces]), [[100, 700, false], [null, 400, true]]);
  assert.equal(result.sourceUrl, 'https://apply.example.invalid/resume?rnId=1537&gbn=1');
  assert.equal(result.version, 1);
  assert.ok(Number.isFinite(Date.parse(result.capturedAt)));
  assert.ok(!JSON.stringify(result).includes('비공개'));
  checks.push('explicit labels, isolated limits, source sanitization and no personal data access');

  result = await capture(`<form><h2>자기소개서</h2>
    <div><h3 id="q">최근에 읽은 책이 본인에게 미친 영향을 설명해주세요.</h3><p id="help">200~600자, 공백 포함</p><textarea aria-labelledby="q" aria-describedby="help"></textarea></div>
    <table><tr><th>성격의 장단점 및 생활신조</th><td><textarea maxlength="500"></textarea><small>500자 이내</small></td></tr></table>
    <fieldset><legend>성장과정 및 가족사항</legend><textarea maxlength="300"></textarea></fieldset>
    <div><h3>팀과 의견 차이를 조율한 경험을 작성해주세요.</h3><div role="textbox" contenteditable="true">비공개 편집 내용</div><small>최대 450자</small></div>
  </form>`);
  assert.equal(result.questions.length, 4);
  assert.deepEqual(result.questions.map(item => [item.minLength, item.maxLength]), [[200, 600], [null, 500], [null, 300], [null, 450]]);
  assert.ok(!JSON.stringify(result).includes('비공개'));
  checks.push('ARIA, table header, legend and contenteditable labels');

  result = await capture(`<form><h2>자기소개서 문항</h2>
    <div><label for="bytes">직무역량 (1000바이트 이내)</label><textarea id="bytes" maxlength="1000"></textarea></div>
    <div><label for="unknown">실패 경험</label><textarea id="unknown"></textarea><span>0 / 900</span></div>
    <div><label for="other">지원동기 (500자)</label><textarea id="other"></textarea></div>
  </form>`);
  assert.deepEqual(result.questions.map(item => item.maxLength), [null, null, 500]);
  assert.ok(result.warnings.some(item => item.includes('바이트')));
  assert.ok(result.questions[0].sourceQuote.includes('1000바이트'));
  assert.ok(!result.questions[1].sourceQuote.includes('500'));
  checks.push('byte units and unknown counters never become invented character limits');

  result = await capture(`<form><h2>자기소개서 작성</h2><div><label for="bounds">좋아하는 책을 설명해주세요.</label><textarea id="bounds" aria-describedby="both"></textarea><small id="both">최대 700자\n최소 100자</small></div></form>`);
  assert.equal(result.questions.length, 1);
  assert.deepEqual([result.questions[0].minLength, result.questions[0].maxLength], [100, 700]);
  checks.push('adjacent minimum prefix never reclassifies the previous maximum');

  result = await capture(`<form><h2>입사지원</h2><label>이름<input value="비공개 이름"></label>
    <label>비밀번호<input type="password" value="비공개 비번"></label>
    <label for="consent">개인정보 수집·이용 동의</label><textarea id="consent">약관과 비공개 입력</textarea>
    <label for="address">주소</label><textarea id="address">비공개 주소</textarea><button>다음 단계</button></form>`);
  assert.deepEqual(result.questions, []);
  assert.ok(result.warnings.some(item => item.includes('지원자 등록')));
  checks.push('registration and consent forms do not yield questions');

  result = await capture(`<main><section class="archive"><h2>자기소개서 문항</h2><label for="archived">본인의 협업 경험을 작성해주세요.</label><textarea id="archived"></textarea></section>
    <form><h2>자기소개서 문항</h2><label>성장과정<textarea>비공개 래핑 답변</textarea></label>
      <div><h3>고등학교 졸업 이상인 자 업무 수행 가능자</h3><textarea></textarea></div>
      <div><p>설명을 작성해주세요.</p><textarea aria-label="주소"></textarea></div>
    </form></main>`);
  assert.deepEqual(result.questions.map(item => item.question), ['성장과정']);
  assert.ok(!JSON.stringify(result).includes('비공개'));
  checks.push('wrapping labels keep answer text out and archives/qualifications remain excluded');

  result = await capture(`<form><h2>자기소개서 문항</h2>${Array.from({ length: 14 }, (_, index) => `<div><label for="q${index}">지원 직무에서 해결한 ${index + 1}번째 문제를 작성해주세요.</label><textarea id="q${index}" maxlength="500"></textarea></div>`).join('')}</form>`);
  assert.equal(result.questions.length, 12);
  assert.ok(result.warnings.some(item => item.includes('12개')));
  assert.ok(result.questions.every(item => item.question.length <= 1600 && item.sourceQuote.length <= 2200));
  checks.push('bounded count and evidence sizes');
  console.log(JSON.stringify({ checks, count: checks.length }, null, 2));
} finally {
  await browser.close();
}
