/**
 * Runs in the applicant's current tab through chrome.scripting.executeScript.
 * Keep every helper inside this function: Chrome serializes the function without
 * its module scope. Only question labels and their local limits are read.
 */
export function captureApplicationQuestions() {
  const warnings = [];
  const warn = message => { if (!warnings.includes(message)) warnings.push(message); };
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const allowedQuery = new Set(['rnId', 'gbn', 'ec', 'e', 'recruit_id', 'job_id']);
  let sourceUrl = '';
  try {
    const current = new URL(location.href);
    if (current.protocol !== 'https:') {
      return { version: 1, sourceUrl: '', capturedAt: new Date().toISOString(), questions: [], warnings: ['HTTPS 지원서 페이지에서 문항을 가져와주세요.'] };
    }
    const safe = new URL(current.origin + current.pathname);
    for (const [key, value] of current.searchParams) {
      if (allowedQuery.has(key) && /^[A-Za-z0-9_-]{1,100}$/.test(value)) safe.searchParams.append(key, value);
    }
    sourceUrl = safe.href;
  } catch {
    return { version: 1, sourceUrl: '', capturedAt: new Date().toISOString(), questions: [], warnings: ['현재 지원서 주소를 확인하지 못했어요.'] };
  }

  const controlsSelector = 'textarea,[contenteditable="true"],[contenteditable=""],[role="textbox"][contenteditable]';
  const forbiddenText = /(?:로그인|회원\s*가입|개인정보\s*(?:수집|처리|동의)|민감정보\s*(?:수집|처리|동의)|약관\s*동의|동의서|제출\s*서류|첨부\s*파일|파일\s*(?:업로드|첨부)|지원\s*방법|접수\s*(?:방법|기간))/i;
  const personalLabel = /^(?:이름|성명|생년월일|주민\s*등록\s*번호|휴대\s*(?:폰|전화)|전화\s*번호|이메일|e-?mail|비밀\s*번호|password|주소|연락처|학교명|계좌\s*번호)(?:\s|[:：(*]|$)/i;
  const archiveText = /(?:합격\s*(?:자소서|자기소개서)|자소서\s*(?:샘플|예시|모음)|기출\s*(?:문항|질문)|지난\s*(?:채용|공고)|면접\s*후기|직무\s*인터뷰)/i;
  const archiveAttribute = /(?:^|[\s_-])(?:archive|passassay|passessay|passedessay|sampleessay|essayexample)(?:$|[\s_-])/i;
  const sectionText = /^(?:(?:자기\s*소개서|자소서)\s*(?:작성|입력|답변)?|자기소개\s*(?:문항|질문)|(?:자기\s*소개서|자소서|지원서|에세이|essay)\s*(?:(?:작성|입력|답변)\s*)?(?:문항|항목|질문)|(?:서술형|주관식|추가)\s*(?:문항|질문))\s*[:：]?$/i;
  const topic = '(?:지원\\s*동기|성장\\s*과정|성장\\s*배경|성격(?:의)?\\s*(?:장단점|장점\\s*(?:및|과)\\s*단점)|장단점|입사\\s*후\\s*포부|직무\\s*역량|생활\\s*신조|가치관|가족\\s*(?:사항|소개)|경력\\s*사항|업무\\s*능력|자기\\s*소개|향후\\s*계획|장래\\s*포부|강점|약점|특기|성취\\s*경험|실패\\s*경험|협업\\s*경험)';
  const canonical = new RegExp(`^${topic}(?:\\s*(?:및|과|와|,|/|·|&)\\s*${topic})*$`, 'i');
  const request = /(?:기술|서술|설명|작성|소개|말씀|제시|기재|논술|묘사|정리|답변|이야기)(?:\s*(?:해\s*(?:주\s*)?(?:세요|십시오|시기\s*바랍니다|시기\s*바람)|해\s*주시(?:기\s*바랍니다|오)|하(?:세요|십시오|시오|라|기\s*바랍니다|기\s*바람)|하여\s*(?:주십시오|주시기\s*바랍니다)|\s*바랍니다))|(?:적어|써)\s*(?:주\s*)?(?:세요|십시오)|\b(?:describe|explain|tell\s+us|please\s+(?:write|share|describe))\b/i;
  const interrogative = /(?:무엇|어떤|어떻게|왜|언제|얼마나|있|했|인가|생각)[^?？]{0,500}(?:나요|니까|가요|인가요|일까요|는지|었는지)\s*[?？]/;
  const applicant = /(?:본인|자신|지원자|귀하|당신|지원\s*(?:직무|분야|기업|회사)|우리\s*(?:회사|기업)|당사|경험|협업|성취|실패|you(?:r)?|appl(?:y|ied|icant))/i;
  const requirement = /(?:졸업\s*이상(?:인)?\s*자|업무\s*수행\s*가능자|경험자\s*우대|자격\s*요건|우대\s*(?:조건|사항)|필수\s*요건)/;
  const prefix = /^(?:문항\s*\d{1,2}\s*[.):：]?\s*|(?:질문|Q)\s*\d{1,2}\s*[.):：]?\s*|\d{1,2}[.)]\s*)/i;
  const limitSuffix = /\s*[([](?:[^()[\]]*\d[\d,]*\s*(?:자|글자|characters?|bytes?|바이트)[^()[\]]*)[)\]]\s*$/i;
  const visible = element => {
    if (!element || element.nodeType !== 1 || element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && element.getClientRects().length > 0;
  };
  // A text-only walk deliberately skips every answer/input, including an answer
  // nested inside a wrapping label. Never use .value, innerText, or body text.
  const labelText = element => {
    if (!visible(element)) return '';
    const parts = [];
    let length = 0;
    const walk = node => {
      if (length > 2400) return;
      if (node.nodeType === 3) {
        const part = node.nodeValue || '';
        parts.push(part);
        length += part.length;
        return;
      }
      if (node.nodeType !== 1 || !visible(node)
        || node.matches('input,textarea,select,button,script,style,noscript,iframe,object,embed,svg,[contenteditable],[role="textbox"]')) return;
      for (const child of node.childNodes) walk(child);
    };
    walk(element);
    return clean(parts.join(' '));
  };
  const headings = container => Array.from(container.children || []).flatMap(child => {
    if (child.matches('h1,h2,h3,h4,h5,h6,legend')) return [child];
    if (child.matches('header')) return Array.from(child.querySelectorAll('h1,h2,h3,h4,h5,h6')).slice(0, 3);
    return [];
  });
  const excluded = control => {
    if (!visible(control) || control.closest('nav,aside,footer,[role="navigation"]')) return true;
    for (let parent = control.parentElement, level = 0; parent && level < 10 && parent !== document.body; parent = parent.parentElement, level += 1) {
      const marker = `${parent.id || ''} ${parent.className || ''} ${parent.getAttribute('data-sentry-component') || ''}`;
      if (archiveAttribute.test(marker) || headings(parent).some(heading => archiveText.test(labelText(heading)))) return true;
    }
    return false;
  };
  const ownControls = element => Array.from(element.querySelectorAll(controlsSelector)).filter(control => !excluded(control));
  const localContainers = control => {
    const roots = [];
    for (let parent = control.parentElement, level = 0; parent && level < 6; parent = parent.parentElement, level += 1) {
      if (parent.matches('body,html,main,form') || ownControls(parent).length > 1) break;
      roots.push(parent);
    }
    return roots;
  };
  const inQuestionSection = control => {
    for (let parent = control.parentElement, level = 0; parent && level < 8 && parent !== document.body; parent = parent.parentElement, level += 1) {
      if (headings(parent).some(heading => sectionText.test(labelText(heading)))) return true;
      for (let sibling = parent.previousElementSibling, checked = 0; sibling && checked < 3; sibling = sibling.previousElementSibling, checked += 1) {
        if (sibling.matches('h1,h2,h3,h4,h5,h6,legend') && sectionText.test(labelText(sibling))) return true;
        if (sibling.matches('form,main,section') || sibling.querySelector(controlsSelector)) break;
      }
    }
    return false;
  };
  const questionFrom = raw => clean(raw).replace(prefix, '').replace(/^\*\s*/, '').replace(/\s*\*$/, '')
    .replace(/\s*\[(?:필수|required)\]\s*$/i, '').replace(limitSuffix, '').trim();
  const isQuestion = (value, section) => {
    if (!value || value.length > 1600 || forbiddenText.test(value) || personalLabel.test(value) || archiveText.test(value) || sectionText.test(value)) return false;
    if (canonical.test(value)) return true;
    if (value.length < 8 || (requirement.test(value) && !request.test(value))) return false;
    return (request.test(value) || interrogative.test(value)) && (section || applicant.test(value));
  };
  const labelFor = (control, roots, section) => {
    const explicit = [];
    const ids = clean(control.getAttribute('aria-labelledby')).split(' ').filter(Boolean).slice(0, 10);
    if (ids.length) explicit.push(ids.map(id => labelText(document.getElementById(id))).filter(Boolean).join(' '));
    if (control.labels) explicit.push(...Array.from(control.labels).map(labelText));
    if (control.getAttribute('aria-label')) explicit.push(clean(control.getAttribute('aria-label')));
    const usableExplicit = explicit.filter(Boolean);
    if (usableExplicit.length) return usableExplicit.find(raw => isQuestion(questionFrom(raw), section)) || '';
    const row = control.closest('tr');
    if (row && ownControls(row).length === 1) {
      const raw = Array.from(row.children).filter(child => child.matches('th')).map(labelText).filter(Boolean).join(' ');
      if (isQuestion(questionFrom(raw), section)) return raw;
    }
    const fieldset = control.closest('fieldset');
    if (fieldset && ownControls(fieldset).length === 1) {
      const raw = labelText(Array.from(fieldset.children).find(child => child.matches('legend')));
      if (isQuestion(questionFrom(raw), section)) return raw;
    }
    for (const root of roots) {
      const candidates = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6,dt,label,[data-question],.question-title,.question-label,.item-title')).slice(0, 25);
      for (const candidate of candidates) {
        const raw = labelText(candidate);
        if (isQuestion(questionFrom(raw), section)) return raw;
      }
    }
    for (let sibling = control.previousElementSibling, checked = 0; sibling && checked < 4; sibling = sibling.previousElementSibling, checked += 1) {
      if (sibling.matches(controlsSelector) || sibling.querySelector(controlsSelector)) break;
      const raw = labelText(sibling);
      if (isQuestion(questionFrom(raw), section)) return raw;
    }
    return '';
  };
  const limitText = text => text.length <= 400 && /\d[\d,]*\s*(?:자|글자|characters?|bytes?|바이트)|공백\s*(?:포함|제외)|(?:with|without)\s*spaces/i.test(text);
  const localLimitProof = (control, roots) => {
    const candidates = [];
    for (const id of clean(control.getAttribute('aria-describedby')).split(' ').filter(Boolean).slice(0, 8)) candidates.push(document.getElementById(id));
    for (const root of roots.slice(0, 2)) {
      candidates.push(...Array.from(root.querySelectorAll('small,[class*="limit"],[class*="count"],[class*="length"],[class*="help"],[class*="hint"],[data-maxlength]')).slice(0, 20));
    }
    for (const direction of ['previousElementSibling', 'nextElementSibling']) {
      for (let sibling = control[direction], checked = 0; sibling && checked < 3; sibling = sibling[direction], checked += 1) {
        if (sibling.matches(controlsSelector) || sibling.querySelector(controlsSelector)) break;
        candidates.push(sibling);
      }
    }
    return [...new Set(candidates.map(labelText).filter(text => text && limitText(text) && !archiveText.test(text) && !forbiddenText.test(text)))].slice(0, 5);
  };
  const limitNumber = value => {
    const number = Number(String(value).replace(/,/g, ''));
    return Number.isInteger(number) && number >= 1 && number <= 10000 ? number : null;
  };
  const parseLimits = proof => {
    const countSpaces = !/공백\s*제외|without\s*spaces/i.test(proof);
    if (/\d[\d,]*\s*(?:bytes?|바이트)/i.test(proof)) {
      warn('바이트 제한은 글자 수로 바꾸지 않았어요. 지원서의 제한을 확인해주세요.');
      return { maxLength: null, minLength: null, countSpaces };
    }
    const range = proof.match(/(\d[\d,]*)\s*자?\s*(?:~|〜|-|–)\s*(\d[\d,]*)\s*(?:자|글자|characters?)/i);
    let minLength = range ? limitNumber(range[1]) : null;
    let maxLength = range ? limitNumber(range[2]) : null;
    if (!range) {
      for (const match of proof.matchAll(/(\d[\d,]*)\s*(?:자|글자|characters?)[ \t]*(이상|이내|이하|내외|미만|초과|최대(?!\s*\d)|최소(?!\s*\d))?/gi)) {
        if (match[2] === '내외') continue;
        if (match[2] === '초과') minLength = limitNumber(Number(match[1].replace(/,/g, '')) + 1);
        else if (match[2] === '이상' || match[2] === '최소' || /최소\s*$/.test(proof.slice(0, match.index))) minLength = limitNumber(match[1]);
        else maxLength = match[2] === '미만' ? limitNumber(Number(match[1].replace(/,/g, '')) - 1) : limitNumber(match[1]);
      }
    }
    if (maxLength && minLength && maxLength < minLength) {
      warn('문항에 표시된 최소·최대 제한이 서로 달라요. 지원서에서 확인해주세요.');
      minLength = null;
      maxLength = null;
    }
    return { maxLength, minLength, countSpaces };
  };

  const questions = [];
  const seen = new Set();
  for (const control of Array.from(document.querySelectorAll(controlsSelector)).slice(0, 160)) {
    if (excluded(control) || control.parentElement?.closest('[contenteditable]')) continue;
    const roots = localContainers(control);
    const raw = labelFor(control, roots, inQuestionSection(control));
    const question = questionFrom(raw);
    if (!question || seen.has(question.normalize('NFKC'))) continue;
    const proof = [raw, ...localLimitProof(control, roots)];
    const hasBytes = /\d[\d,]*\s*(?:bytes?|바이트)/i.test(proof.join(' '));
    if (!hasBytes) {
      const declared = parseLimits(proof.join('\n'));
      const maximum = limitNumber(control.getAttribute('maxlength'));
      const minimum = limitNumber(control.getAttribute('minlength'));
      if (!declared.maxLength && maximum) proof.push(`최대 ${maximum}자 이내`);
      if (!declared.minLength && minimum) proof.push(`최소 ${minimum}자 이상`);
    }
    const sourceQuote = [...new Set(proof)].join('\n');
    if (sourceQuote.length > 2200) {
      warn('긴 문항은 원문이 잘리지 않도록 자동 수집에서 제외했어요.');
      continue;
    }
    seen.add(question.normalize('NFKC'));
    questions.push({ question, sourceQuote, ...parseLimits(sourceQuote) });
    if (questions.length === 12) {
      warn('문항은 최대 12개까지 가져와요. 추가 문항은 직접 입력해주세요.');
      break;
    }
  }
  if (!questions.length) warn('문항을 찾지 못했어요. 로그인·지원자 등록을 마친 뒤 자기소개서 문항이 보이는 작성 화면에서 다시 가져와주세요.');
  return { version: 1, sourceUrl, capturedAt: new Date().toISOString(), questions, warnings };
}
