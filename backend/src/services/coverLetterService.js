import { generateWithRetry } from '../config/geminiClient.js';
import { parseJSON } from './geminiService.js';
import { scrapeCoverLetterPosting, MAX_APPLICATION_LINKS } from './coverLetterSources.js';
import { validatePublicUrl } from './publicWebFetch.js';
import { applyCatalogEntry } from './coverLetterQuestionCatalog.js';
import { isTransientAiError, aiUnavailableError } from '../utils/aiError.js';
import { capCoverLetterAnswer, coverLetterLengthDistance, fitCoverLetterEdits } from '../utils/coverLetterLength.js';
import { coverLetterQualityProblems } from '../utils/coverLetterQuality.js';
import { coverLetterQuestionFocus, questionFocusWords } from '../../../shared/coverLetterQuestionFocus.mjs';
import {
  cleanText, compactText, stringList, quotedInSource, normalizePostingQuestions,
  extractPostingQuestions, experienceSource, validateGeneratedAnswer, groundCompanyInsights, isRecognizedQuestionHeading, isApplicationQuestion,
} from './coverLetterEvidence.js';
import {
  buildCoverLetterAnalysisPrompt, buildCompanyResearchPrompt,
  buildCoverLetterAnswerPrompt, buildCoverLetterAuditPrompt,
  buildCoverLetterLengthRevisionPrompt,
  buildCoverLetterLengthEditsPrompt,
  buildCoverLetterQualityReviewPrompt,
} from '../prompts/coverLetterPrompts.js';

const AI_OPTIONS = { tier: 'deep', models: ['gemini-2.5-flash', 'gemini-3.1-flash-lite'], retries: 2, delayMs: 1200, callTimeoutMs: 45000, githubFallback: false, config: { responseMimeType: 'application/json', temperature: 0.45 } };

function boundedAiRunner(generateAI) {
  const deadline = Date.now() + 240000;
  return async (prompt, options) => {
    const remaining = deadline - Date.now();
    if (remaining < 10000) throw inputError('AI 처리 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.', 504);
    const queueTimeoutMs = Math.min(15000, Math.floor(remaining / 4));
    const attempts = (options.models?.length || 2) * (options.retries || 1);
    const callTimeoutMs = Math.min(options.callTimeoutMs || 45000, Math.floor((remaining - queueTimeoutMs - 10000) / attempts));
    let timer;
    try {
      return await Promise.race([
        generateAI(prompt, { ...options, queueTimeoutMs, callTimeoutMs, githubFallback: false }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(inputError('AI 처리 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.', 504)), remaining);
          timer.unref?.();
        }),
      ]);
    } catch (error) {
      if (isTransientAiError(error)) throw aiUnavailableError(error);
      throw error;
    } finally { clearTimeout(timer); }
  };
}

export function inputError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function rethrowBillingError(error) {
  if (error?.status === 402 || /CREDIT|BILLING/i.test(String(error?.code || ''))) throw error;
}

export function normalizeQuestion(raw, allowEmpty = false) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw inputError('작성할 자기소개서 문항이 필요합니다.');
  const question = cleanText(raw.question || raw.text, 1600);
  if (!allowEmpty && question.length < 5 && !isRecognizedQuestionHeading(question)) throw inputError('자기소개서 문항을 입력해주세요.');
  const limit = (value, name) => {
    if (value == null || value === '') return null;
    if (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 10000) throw inputError(`${name}는 1~10,000 사이의 정수여야 합니다.`);
    return Number(value);
  };
  const maxLength = limit(raw.maxLength, '최대 글자 수');
  const minLength = limit(raw.minLength, '최소 글자 수');
  if (maxLength && minLength && minLength > maxLength) throw inputError('최소 글자 수는 최대 글자 수보다 클 수 없습니다.');
  return { id: cleanText(raw.id, 128) || 'q1', question, maxLength, minLength, countSpaces: raw.countSpaces !== false, source: ['posting', 'suggested', 'manual'].includes(raw.source) ? raw.source : 'manual', sourceQuote: cleanText(raw.sourceQuote, 2200), ...(['browser_extension', 'question_catalog'].includes(raw.importMethod) ? { importMethod: raw.importMethod } : {}) };
}

function boundedInput(body, key, max) {
  if (body?.[key] != null && typeof body[key] !== 'string') throw inputError(`${key} 입력 형식이 올바르지 않습니다.`);
  const value = cleanText(body?.[key], max + 1);
  if (value.length > max) throw inputError(`${key} 입력이 너무 깁니다. 최대 ${max.toLocaleString()}자까지 입력해주세요.`);
  return value;
}

function questionEvidence(materials) {
  const source = materials.filter(Boolean).join('\n\n');
  if (source.length <= 60000) return source;
  // Verify against the complete scoped material before shortening it. Long
  // privacy notices or supplementary text must not remove real question proof
  // needed for later generation and reopening a saved application.
  const questions = extractPostingQuestions(source);
  // A clipped copy can turn a partial prompt into an extra, apparently real
  // question on re-extraction. Keep only whole verified excerpts here; company
  // and role analysis retain their own sourceText separately.
  if (!questions.length) return '';
  return `[지원서 원문: 확인한 문항]\n자기소개서 문항\n${questions.map(item => item.sourceQuote).join('\n\n')}`;
}

function captureSourceUrl(rawUrl) {
  const url = new URL(validatePublicUrl(rawUrl));
  // An authenticated form may put temporary session information in its URL. It
  // establishes the page origin, but is neither needed nor retained as evidence.
  for (const name of [...url.searchParams.keys()]) {
    if (/(?:token|session|auth|jwt|cookie|password|email|phone|nonce)|^(?:sid|sso|code|state)$/i.test(name)) url.searchParams.delete(name);
  }
  url.hash = '';
  return url.href;
}

function explicitApplicationRole(rawUrl) {
  const url = new URL(rawUrl);
  if (url.hostname === 'recruit.sfa.co.kr') {
    const id = url.pathname === '/sfasemicon/recruit' ? url.searchParams.get('id')
      : url.pathname.startsWith('/apply/') ? url.searchParams.get('rnId') : null;
    return { provider: 'sfa', role: /^\d+$/.test(id || '') ? id : null };
  }
  if (url.hostname === 'jasoseol.com') {
    const role = url.searchParams.get('e') || url.searchParams.get('employment_id') || url.searchParams.get('employmentId');
    const posting = url.searchParams.get('ec');
    return { provider: 'jasoseol', role: /^\d+$/.test(role || '') ? role : null,
      posting: /^\d+$/.test(posting || '') ? posting : null };
  }
  return {};
}

function assertSameExplicitApplicationRole(sourceUrl, targetUrl) {
  const captured = explicitApplicationRole(sourceUrl);
  const selected = explicitApplicationRole(targetUrl);
  if (captured.provider && captured.provider === selected.provider
    && ['role', 'posting'].some(key => captured[key] && selected[key] && captured[key] !== selected[key])) {
    throw inputError('선택한 직무와 다른 지원서가 열려 있습니다. 지원할 직무의 자기소개서 화면에서 문항을 다시 가져와주세요.', 422);
  }
}

/** Import only visible question labels captured by the user's browser, without AI or credentials. */
export function importCoverLetterQuestions(body) {
  const capture = body?.capture;
  const analysis = body?.analysis;
  if (!capture || typeof capture !== 'object' || Array.isArray(capture) || capture.version !== 1) {
    throw inputError('지원서 연결 자료의 형식이 올바르지 않습니다. 연결 화면에서 다시 가져와주세요.');
  }
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) throw inputError('먼저 지원할 공고를 분석해주세요.');
  const sourceUrl = captureSourceUrl(boundedInput(capture, 'sourceUrl', 2000));
  const knownUrls = [analysis.applicationUrl, analysis.selectedApplicationUrl,
    ...(Array.isArray(analysis.applicationLinks) ? analysis.applicationLinks.slice(0, MAX_APPLICATION_LINKS).map(link => link?.url) : [])]
    .filter(value => typeof value === 'string' && value)
    .flatMap(value => { try { return [captureSourceUrl(value)]; } catch { return []; } });
  // A direct application link can also be the posting URL. Once official role
  // pages are known, the original job portal cannot stand in for their forms.
  if (!knownUrls.length && analysis.sourceUrl) {
    try { knownUrls.push(captureSourceUrl(analysis.sourceUrl)); } catch { /* Invalid stored link provides no trust. */ }
  }
  const requestedApplicationUrl = boundedInput(body, 'applicationUrl', 2000);
  const targetUrl = requestedApplicationUrl ? captureSourceUrl(requestedApplicationUrl)
    : analysis.selectedApplicationUrl ? captureSourceUrl(analysis.selectedApplicationUrl)
      : analysis.applicationUrl ? captureSourceUrl(analysis.applicationUrl) : knownUrls[0];
  if (!targetUrl || !knownUrls.includes(targetUrl)) throw inputError('분석한 공고에서 지원할 직무를 선택한 뒤 연결해주세요.', 422);
  const selectedUrl = analysis.selectedApplicationUrl ? captureSourceUrl(analysis.selectedApplicationUrl) : '';
  const finalApplicationUrl = analysis.applicationUrl ? captureSourceUrl(analysis.applicationUrl) : '';
  // A provider role page may lead to the employer's separate application site.
  // That final site belongs only to the exact role used for this analysis.
  const currentFinalUrl = selectedUrl === targetUrl ? finalApplicationUrl : '';
  const allowedOrigins = new Set([targetUrl, currentFinalUrl].filter(Boolean).map(url => new URL(url).origin));
  if (!allowedOrigins.has(new URL(sourceUrl).origin)) {
    throw inputError('선택한 직무의 공식 지원서 사이트에서 문항을 가져와주세요. 다른 사이트의 문항은 연결할 수 없습니다.', 422);
  }
  assertSameExplicitApplicationRole(sourceUrl, targetUrl);
  if (currentFinalUrl) assertSameExplicitApplicationRole(sourceUrl, currentFinalUrl);
  const capturedAt = boundedInput(capture, 'capturedAt', 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(capturedAt) || !Number.isFinite(Date.parse(capturedAt))) {
    throw inputError('지원서 연결 시간이 올바르지 않습니다. 문항을 다시 가져와주세요.');
  }
  if (!Array.isArray(capture.questions) || !capture.questions.length || capture.questions.length > 12) {
    throw inputError('연결할 실제 자기소개서 문항이 없습니다. 지원서의 자기소개서 입력 화면에서 최대 12개 문항을 가져와주세요.', 422);
  }
  const candidates = capture.questions.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw inputError('지원서 문항의 형식이 올바르지 않습니다.');
    const question = boundedInput(raw, 'question', 1600);
    const sourceQuote = boundedInput(raw, 'sourceQuote', 2200);
    if (!question || !sourceQuote || !compactText(sourceQuote).includes(compactText(question))) {
      throw inputError(`${index + 1}번 문항의 실제 지원서 원문을 확인할 수 없습니다. 문항을 다시 가져와주세요.`, 422);
    }
    return { question, sourceQuote };
  });
  const captureProof = `[현재 지원서 원문: 브라우저 연결]\n자기소개서 문항\n${candidates.map((item, index) => `${index + 1}. ${item.sourceQuote}`).join('\n\n')}`;
  const verified = normalizePostingQuestions(candidates, captureProof);
  if (verified.length !== candidates.length) {
    throw inputError('일부 항목을 실제 자기소개서 문항으로 확인하지 못했습니다. 자기소개서 입력 화면에서 다시 가져오거나 문항을 직접 확인해주세요.', 422);
  }
  for (let index = 0; index < verified.length; index += 1) {
    const raw = capture.questions[index];
    const question = verified[index];
    for (const key of ['minLength', 'maxLength']) {
      if (raw[key] != null && raw[key] !== '' && (!Number.isInteger(Number(raw[key])) || Number(raw[key]) !== question[key])) {
        throw inputError(`${index + 1}번 문항의 글자 수 제한에 원문 근거가 없습니다. 지원서에 표시된 제한을 다시 확인해주세요.`, 422);
      }
    }
    if (raw.countSpaces != null && (typeof raw.countSpaces !== 'boolean' || raw.countSpaces !== question.countSpaces)) {
      throw inputError(`${index + 1}번 문항의 공백 계산 기준이 지원서 원문과 다릅니다.`, 422);
    }
  }
  const oldProof = boundedInput(analysis, 'questionSourceText', 60000) || boundedInput(analysis, 'sourceText', 60000);
  const separator = '\n\n[채용 공고 원문]\n';
  const questionSourceText = captureProof + (oldProof ? separator + oldProof.slice(0, 60000 - captureProof.length - separator.length) : '');
  const questions = verified.map(question => ({ ...question, validation: 'verified', importMethod: 'browser_extension' }));
  const source = { id: 'application-browser', title: '브라우저에서 연결한 실제 지원서 문항', url: sourceUrl, type: 'posting' };
  const sources = [...(Array.isArray(analysis.sources) ? analysis.sources.filter(item => item?.id !== source.id) : []), source];
  const changedRoleLink = selectedUrl !== targetUrl && Array.isArray(analysis.applicationLinks)
    ? analysis.applicationLinks.slice(0, MAX_APPLICATION_LINKS).find(link => {
      try { return captureSourceUrl(link?.url) === targetUrl && cleanText(link?.label, 200); } catch { return false; }
    }) : null;
  return { analysis: { ...analysis, questions, questionSourceText, sources,
    ...(changedRoleLink ? { position: cleanText(changedRoleLink.label, 200), summary: '', rolePriorities: [], writingPoints: [], applicationUrl: sourceUrl } : {}),
    selectedApplicationUrl: targetUrl, questionStatus: 'verified', applicationAccess: 'connected',
    questionNotice: '로그인한 실제 지원서 화면에서 가져온 문항입니다. 최종 문구와 글자 수 제한을 지원서에서 확인해주세요.',
    applicationCapture: { sourceUrl, capturedAt, method: 'browser_extension' },
  }, questions };
}

export async function analyzeCoverLetter(body, dependencies = {}) {
  const generateAI = boundedAiRunner(dependencies.generateAI || generateWithRetry);
  const scrape = dependencies.scrape || scrapeCoverLetterPosting;
  const url = boundedInput(body, 'url', 2000);
  const sourceUrl = url ? validatePublicUrl(url) : '';
  const requestedApplicationUrl = boundedInput(body, 'applicationUrl', 2000);
  if (requestedApplicationUrl && !sourceUrl) throw inputError('지원 페이지를 선택하려면 원래 채용 공고 링크가 필요합니다.');
  const text = boundedInput(body, 'text', 30000);
  const questionImport = body.questionImport === true;
  const companyHint = boundedInput(body, 'company', 200);
  const positionHint = boundedInput(body, 'position', 200);
  if (!text && !url) throw inputError('공고 링크 또는 공고 내용을 입력해주세요.');
  const uncertainties = [];
  let scrapedText = '';
  let scraped = {};
  let scrapeFailure;
  let catalogResult;
  if (sourceUrl) {
    try {
      const result = await scrape(sourceUrl, { applicationUrl: requestedApplicationUrl });
      scraped = result && typeof result === 'object' ? result : {};
      scrapedText = cleanText(typeof result === 'string' ? result : result?.text, 30000);
    }
    catch (error) {
      if (error.status === 400) throw error;
      if (!text && !dependencies.lookupQuestions) throw error;
      scrapeFailure = error;
      if (text) uncertainties.push('공고 링크의 원문을 읽지 못해 직접 입력한 자료만 분석했습니다. 실제 지원 페이지의 문항과 글자 수를 확인해주세요.');
    }
  }
  const catalogTarget = requestedApplicationUrl || (scraped.applicationLinks?.length === 1 ? scraped.applicationLinks[0].url : '') || scraped.applicationUrl || sourceUrl;
  const publicQuestions = extractPostingQuestions(Object.hasOwn(scraped, 'questionText') ? scraped.questionText : scrapedText);
  if (sourceUrl && !questionImport && scraped.questionStatus !== 'selection_required' && !publicQuestions.length
    && !(text && extractPostingQuestions(text).length) && dependencies.lookupQuestions) {
    try {
      catalogResult = await dependencies.lookupQuestions({ sourceUrl, applicationUrl: catalogTarget });
      if (catalogResult?.entry && !scrapedText && !text) {
        const entry = catalogResult.entry;
        scrapedText = `기업명: ${cleanText(entry.company, 200)}\n모집 직무: ${cleanText(entry.position, 200)}\n검증된 지원서 문항을 확인한 채용 공고입니다.`;
        scraped = { ...scraped, selectedPosition: entry.position, applicationUrl: entry.sourceEvidenceUrl || entry.applicationUrl,
          applicationLinks: [{ label: entry.position, url: catalogTarget }], questionText: entry.questionSourceText };
        uncertainties.push('공고 원문을 다시 읽지 못해 검증된 지원서 문항과 등록된 기업·직무 정보를 사용했습니다.');
      }
    } catch {
      uncertainties.push('검증된 지원서 문항의 조회를 완료하지 못했습니다. 잠시 후 다시 확인해주세요.');
    }
  }
  if (scrapeFailure && !text && !scrapedText) throw scrapeFailure;
  // Only scoped current posting/form material is question evidence. Supplementary text stays separate from scraped text across saves/reanalysis.
  const manualQuestionSource = text ? `[직접 입력한 보충 자료]\n${questionImport ? '자기소개서 문항\n' : ''}${text}` : '';
  const questionSourceText = questionEvidence([
    Object.hasOwn(scraped, 'questionText') ? cleanText(scraped.questionText, 50000) : scrapedText,
    manualQuestionSource,
  ]);
  let sourceText = [scrapedText, text ? `${scrapedText ? '[직접 입력한 보충 자료]\n' : ''}${text}` : ''].filter(Boolean).join('\n\n');
  if (sourceText.length > 60000) {
    sourceText = sourceText.slice(0, 60000);
    uncertainties.push('공고와 보충 자료가 길어 앞부분 60,000자만 분석했습니다. 뒤쪽의 문항은 직접 추가해주세요.');
  }
  if (sourceText.length < 30 && !(companyHint && extractPostingQuestions(questionSourceText).length)) {
    throw inputError('공고 내용이 너무 짧습니다. 기업·직무·자기소개서 문항을 포함해 붙여넣어주세요.');
  }

  let posting = {};
  try {
    const response = await generateAI(buildCoverLetterAnalysisPrompt({ sourceText, company: companyHint, position: cleanText(scraped.selectedPosition, 200) || positionHint }), AI_OPTIONS);
    posting = parseJSON(typeof response === 'string' ? response : response.text);
  } catch (error) {
    rethrowBillingError(error);
    // Reading questions still works if the model is unavailable; no fake corporate research.
    uncertainties.push('기업 분석을 완료하지 못했습니다. 공고 원문과 문항을 확인한 뒤 다시 분석해주세요.');
  }
  const extractedCompany = cleanText(posting.company, 200);
  const extractedPosition = cleanText(posting.position, 200);
  const company = (extractedCompany && compactText(sourceText).includes(compactText(extractedCompany)) ? extractedCompany : '') || companyHint || cleanText(sourceText.match(/(?:기업명|회사명|company)\s*[:：]\s*([^\n]+)/i)?.[1], 200) || cleanText(catalogResult?.entry?.company, 200);
  const position = cleanText(scraped.selectedPosition, 200) || (extractedPosition && compactText(sourceText).includes(compactText(extractedPosition)) ? extractedPosition : '') || positionHint || cleanText(sourceText.match(/(?:모집\s*직무|모집\s*분야|포지션|position)\s*[:：]\s*([^\n]+)/i)?.[1], 200);
  if (!company) throw inputError('공고에서 기업명을 확인하지 못했습니다. 기업명을 함께 입력해주세요.', 422);
  if (!position) uncertainties.push('모집 직무를 확인하지 못했습니다. 지원할 직무를 입력해주세요.');
  let questions = normalizePostingQuestions([
    ...extractPostingQuestions(questionSourceText), ...normalizePostingQuestions(posting.questions, questionSourceText),
  ], questionSourceText);
  const manualQuestions = text ? extractPostingQuestions(manualQuestionSource) : [];
  if (scraped.questionStatus === 'selection_required') questions = manualQuestions;
  const hasPostingQuestions = questions.length > 0;
  const questionStatus = hasPostingQuestions ? 'verified' : scraped.questionStatus === 'selection_required' ? 'selection_required' : 'unavailable';
  const postingInsights = groundCompanyInsights(posting.companyInsights, sourceText).insights;
  let companyInsights = postingInsights;
  const sources = [{ id: 'posting', title: scrapedText && text ? '채용 공고 원문 및 직접 입력한 보충 자료' : scrapedText ? '채용 공고 원문' : '직접 입력한 공고 원문', url: scrapedText ? sourceUrl : '', type: 'posting' }];
  sources.push(...(Array.isArray(scraped.sources) ? scraped.sources.slice(0, 5) : []));
  try {
    const response = await generateAI(buildCompanyResearchPrompt({ company, position }), {
      ...AI_OPTIONS, returnMetadata: true, githubFallback: false,
      config: { tools: [{ googleSearch: {} }], temperature: 0.3 },
    });
    const research = parseJSON(typeof response === 'string' ? response : response.text);
    const grounded = groundCompanyInsights(research.insights, '', response.groundingMetadata);
    companyInsights = [...postingInsights, ...grounded.insights].slice(0, 8);
    sources.push(...grounded.sources);
    if (!grounded.insights.length) uncertainties.push('공개 기업 정보의 검색 출처를 확인하지 못했습니다. 기업 분석은 공고 내용만 반영했습니다.');
    uncertainties.push(...stringList(research.uncertainties, 5));
  } catch (error) {
    rethrowBillingError(error);
    uncertainties.push('공개 기업 자료를 불러오지 못했습니다. 기업 분석은 공고 원문에서 확인된 내용만 반영했습니다.');
  }
  // Use verified excerpts for corporate facts; model paraphrases cannot add achievements.
  const business = quotedInSource(posting.businessQuote, sourceText) ? cleanText(posting.businessQuote, 1000) : '';
  const summary = quotedInSource(posting.summaryQuote, sourceText) ? cleanText(posting.summaryQuote, 1000) : '';
  const rolePriorities = (Array.isArray(posting.rolePriorities) ? posting.rolePriorities : [])
    .map(item => typeof item === 'string' ? item : item?.sourceQuote)
    .filter(quote => quotedInSource(quote, scraped.roleSourceText || sourceText)).map(quote => cleanText(quote, 500)).slice(0, 8);
  const analysis = {
    company, position, summary, business,
    rolePriorities,
    companyInsights, writingPoints: stringList(posting.writingPoints, 6, 500), sources,
    uncertainties: [...new Set([...uncertainties, ...stringList(posting.uncertainties, 6)])].slice(0, 12),
    questions, questionStatus,
    questionNotice: hasPostingQuestions && scraped.questionOrigin === 'jasoseol_counterpart' ? '공개 공고에서 문항을 확인하지 못해, 자소설닷컴에 등록된 같은 공고의 선택 직무 문항을 가져왔습니다. 실제 지원서의 최종 문구와 글자 수를 꼭 대조해주세요.'
      : hasPostingQuestions ? '현재 공고 또는 직접 입력한 지원서에서 확인한 문항입니다. 지원 페이지의 최종 문구와 글자 수를 확인해주세요.'
      : questionStatus === 'selection_required' ? '이 공고는 여러 직무를 모집합니다. 지원할 직무의 페이지를 선택하면 해당 지원서 문항을 확인합니다.'
        : scraped.applicationAccess === 'registration_required' ? '공개 공고와 공식 지원서를 조회했지만, 문항은 개인정보 동의와 지원자 등록 뒤에만 제공됩니다. 현재 접근 가능한 원문에서 실제 자소서 문항을 확인하지 못했습니다.'
          : scraped.applicationAccess === 'login_required' ? '공개 공고와 공식 지원서를 조회했지만, 문항은 로그인 또는 본인 인증 뒤에만 제공됩니다. 현재 접근 가능한 원문에서 실제 자소서 문항을 확인하지 못했습니다.'
        : '공개 공고와 지원 페이지에서 실제 자기소개서 문항을 확인하지 못했습니다. 지원서에 표시된 문항을 복사해 붙여넣거나 직접 추가해주세요.',
    applicationUrl: cleanText(scraped.applicationUrl, 2000),
    selectedApplicationUrl: requestedApplicationUrl || (scraped.applicationLinks?.length === 1 ? scraped.applicationLinks[0].url : ''),
    applicationLinks: Array.isArray(scraped.applicationLinks) ? scraped.applicationLinks : [],
    applicationAccess: scraped.applicationAccess || 'unavailable',
    sourceText, questionSourceText, sourceInputText: text, questionImport, sourceUrl,
  };
  if (catalogResult?.entry && !publicQuestions.length && !manualQuestions.length) return applyCatalogEntry(analysis, catalogResult.entry);
  if (!questions.length && catalogResult?.status === 'pending') {
    analysis.questionCatalog = { status: 'pending', requestId: cleanText(catalogResult.requestId, 128) };
    analysis.questionNotice += ' 해당 직무의 실제 지원서 문항 확인 요청이 접수됐습니다. 확인된 문항이 준비되면 자동으로 불러옵니다.';
  }
  return analysis;
}

function generationAnalysis(raw) {
  const analysis = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const sourceText = cleanText(analysis.sourceText, 60000);
  const sources = Array.isArray(analysis.sources) ? analysis.sources.slice(0, 12).map(source => ({ id: cleanText(source?.id, 128), title: cleanText(source?.title, 300), url: cleanText(source?.url, 2000), type: source?.type === 'research' ? 'research' : 'posting' })) : [];
  const validIds = new Set(sources.map(source => source.id));
  const insights = (Array.isArray(analysis.companyInsights) ? analysis.companyInsights : []).filter(item => validIds.has(item?.sourceId))
    .filter(item => item.sourceId !== 'posting' || quotedInSource(item.sourceQuote, sourceText))
    .map(item => ({ text: cleanText(item.text, 800), sourceId: cleanText(item.sourceId, 128), sourceQuote: cleanText(item.sourceQuote, 1800) })).slice(0, 8);
  return { company: cleanText(analysis.company, 200), position: cleanText(analysis.position, 200), rolePriorities: stringList(analysis.rolePriorities, 8, 300), writingPoints: stringList(analysis.writingPoints, 6, 500), companyInsights: insights, sources, uncertainties: stringList(analysis.uncertainties, 8, 500) };
}

export async function generateCoverLetterAnswer(body, ownedExperiences, dependencies = {}) {
  const generateAI = boundedAiRunner(dependencies.generateAI || generateWithRetry);
  const question = normalizeQuestion(body.question);
  const questionProof = cleanText(body.analysis?.questionSourceText ?? body.analysis?.sourceText, 60000);
  if (question.source === 'posting' && (!isApplicationQuestion(question.question, questionProof, question.sourceQuote)
    || !normalizePostingQuestions([question], questionProof).length)) {
    throw inputError('실제 지원서 문항으로 확인되지 않은 내용입니다. 공고를 다시 분석하거나 지원서 문항을 직접 입력해주세요.', 422);
  }
  const additionalContext = boundedInput(body, 'additionalContext', 6000);
  const voiceSample = boundedInput(body, 'voiceSample', 4000);
  const revisionInstruction = boundedInput(body, 'revisionInstruction', 2000);
  const currentAnswer = boundedInput(body, 'currentAnswer', 20000);
  const experiences = ownedExperiences.map(experienceSource).filter(item => item.facts || item.narrativeContext);
  if (!experiences.length && !additionalContext) throw inputError('작성에 사용할 경험을 선택하거나 역할·행동·결과를 추가로 입력해주세요.');
  const input = {
    analysis: generationAnalysis(body.analysis), question, experiences,
    style: ['plain', 'story', 'concise'].includes(body.style) ? body.style : 'plain',
    voiceSample, additionalContext, revisionInstruction, currentAnswer,
  };
  const focus = coverLetterQuestionFocus(question.question);
  const needsContext = proposed => ({
    status: 'needs_context', answer: '', linkedExperienceIds: [], evidence: [], warnings: [],
    followUpQuestion: cleanText(proposed?.followUpQuestion, 600) || focus?.followUpQuestion
      || '이 문항에서 요구하는 주제와 직접 관련된 실제 경험과 느낀 점을 추가로 알려주세요.',
  });
  const questionSources = [...experiences.map(item => item.facts || item.narrativeContext), additionalContext].join('\n');
  if (focus && !questionFocusWords(question.question, questionSources).length) return needsContext();
  let proposed = parseJSON(await generateAI(buildCoverLetterAnswerPrompt(input), AI_OPTIONS));
  if (proposed.status === 'needs_context') return needsContext(proposed);
  // Separate factual audit catches qualitative inventions and goals presented as outcomes.
  let auditUnavailable = false;
  const audit = async draft => {
    try {
      return parseJSON(await generateAI(buildCoverLetterAuditPrompt(input, draft), AI_OPTIONS));
    } catch (error) {
      if (!isTransientAiError(error)) throw error;
      auditUnavailable = true;
      // An optional review outage must not discard an already generated usable draft.
      return { ...draft, warnings: ['AI 최종 검토가 지연되어 생성한 초안을 먼저 제공합니다.', ...stringList(draft.warnings, 11, 500)] };
    }
  };
  proposed = await audit(proposed);
  if (proposed.status === 'needs_context') return needsContext(proposed);
  let result = validateGeneratedAnswer(proposed, input);
  if (result.problems.length) {
    proposed = parseJSON(await generateAI(buildCoverLetterAnswerPrompt(input, result.problems.join(' ')), AI_OPTIONS));
    if (proposed.status === 'needs_context') return needsContext(proposed);
    proposed = await audit(proposed);
    if (proposed.status === 'needs_context') return needsContext(proposed);
    result = validateGeneratedAnswer(proposed, input);
  }
  if (result.problems.length) {
    const error = inputError(result.problems.join(' '), 422);
    error.code = 'COVERLETTER_REVIEW_FAILED';
    throw error;
  }
  const auditedAnswer = result.answer;
  const resize = async () => {
    // Check both bounds after audit, which can shorten or expand the draft.
    let lengthAiUnavailable = false;
    const closer = candidate => !candidate.problems.length
      && coverLetterLengthDistance(candidate.review.charCount, question) < coverLetterLengthDistance(result.review.charCount, question);
    for (let attempt = 0; !result.review.withinLimit && attempt < 2; attempt++) {
      try {
        const revised = parseJSON(await generateAI(buildCoverLetterLengthRevisionPrompt(input, proposed, result.review.charCount), AI_OPTIONS));
        if (revised.status === 'needs_context') return needsContext(revised);
        const candidate = validateGeneratedAnswer(revised, input);
        if (!closer(candidate)) continue;
        proposed = revised;
        result = candidate;
      } catch (error) {
        if (!isTransientAiError(error)) throw error;
        lengthAiUnavailable = true;
        break;
      }
    }
    if (question.maxLength && result.review.charCount > question.maxLength) {
      const answer = capCoverLetterAnswer(result.answer, question);
      const warnings = answer.endsWith('…')
        ? ['AI 축약을 완료하지 못해 최대 길이에 맞춘 임시 초안입니다. 마지막 문장을 확인해주세요.', ...stringList(proposed.warnings, 11, 500)]
        : proposed.warnings;
      const capped = validateGeneratedAnswer({ ...proposed, answer, warnings }, input);
      if (closer(capped)) result = capped;
    }
    // Whole-draft rewrites only estimate length. Choose local edits using actual
    // counts so near misses (e.g. 644 for 650–700) do not stop at an avoidable error.
    for (let attempt = 0; !result.review.withinLimit && !lengthAiUnavailable && attempt < 2; attempt++) {
      try {
        const revision = parseJSON(await generateAI(buildCoverLetterLengthEditsPrompt(input, result), AI_OPTIONS));
        const answer = fitCoverLetterEdits(result.answer, question, revision.edits);
        const candidate = validateGeneratedAnswer({ ...result, answer }, input);
        if (closer(candidate)) result = candidate;
      } catch (error) {
        if (!isTransientAiError(error)) throw error;
        break;
      }
    }
  };
  const assertReady = () => {
    if (result.problems.length) {
      const error = inputError(result.problems.join(' '), 422);
      error.code = 'COVERLETTER_REVIEW_FAILED';
      throw error;
    }
    if (!result.review.withinLimit) {
      const range = question.minLength && question.maxLength
        ? `${question.minLength}~${question.maxLength}자`
        : question.minLength ? `최소 ${question.minLength}자 이상` : `최대 ${question.maxLength}자 이하`;
      const error = inputError(`요청한 ${range}에 맞게 본문을 완성하지 못했습니다(현재 ${result.review.charCount}자). 다시 작성해주세요.`, 422);
      error.code = 'COVERLETTER_LENGTH_FAILED';
      throw error;
    }
  };
  const resizeContext = await resize();
  if (resizeContext) return resizeContext;
  assertReady();
  // A pre-resize audit cannot approve later sentence combinations or truncation.
  // Review the assembled text without rewriting it, so a pass cannot change its length.
  if (!auditUnavailable || result.answer !== auditedAnswer) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const quality = parseJSON(await generateAI(buildCoverLetterQualityReviewPrompt(input, result), AI_OPTIONS));
      if (quality.status === 'needs_context') return needsContext(quality);
      const qualityProblems = coverLetterQualityProblems(quality, result.answer);
      if (!qualityProblems.length) break;
      if (attempt === 1) {
        const error = inputError(qualityProblems.join(' '), 422);
        error.code = 'COVERLETTER_QUALITY_FAILED';
        throw error;
      }
      const repairInput = { ...input, currentAnswer: result.answer };
      proposed = parseJSON(await generateAI(buildCoverLetterAnswerPrompt(repairInput, qualityProblems.join(' ')), AI_OPTIONS));
      if (proposed.status === 'needs_context') return needsContext(proposed);
      proposed = await audit(proposed);
      if (proposed.status === 'needs_context') return needsContext(proposed);
      result = validateGeneratedAnswer(proposed, input);
      if (!result.problems.length) {
        const context = await resize();
        if (context) return context;
      }
      assertReady();
    }
  }
  const { problems, ...response } = result;
  return response;
}

export function validateExperienceIds(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 12 || value.some(id => typeof id !== 'string' || !id || id.length > 128 || /[\/]/.test(id))) {
    throw inputError('경험 ID 형식이 올바르지 않습니다. 최대 12개까지 선택해주세요.');
  }
  return [...new Set(value)];
}

export function buildCoverLetterDocument(raw, uid, previous = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw inputError('자기소개서 저장 형식이 올바르지 않습니다.');
  const fields = {};
  const strings = { title: 300, targetCompany: 200, targetPosition: 200, sourceUrl: 2000, sourceText: 60000, sourceInputText: 30000, voiceSample: 4000, additionalContext: 6000 };
  for (const [key, max] of Object.entries(strings)) if (raw[key] !== undefined) fields[key] = boundedInput(raw, key, max);
  if (raw.style !== undefined) fields.style = ['plain', 'story', 'concise'].includes(raw.style) ? raw.style : 'plain';
  if (raw.status !== undefined) fields.status = ['draft', 'final', 'ready', 'completed', 'submitted'].includes(raw.status) ? raw.status : 'draft';
  if (raw.analysis !== undefined) {
    if (raw.analysis !== null && (typeof raw.analysis !== 'object' || Array.isArray(raw.analysis))) throw inputError('기업 분석 형식이 올바르지 않습니다.');
    fields.analysis = raw.analysis;
  }
  if (raw.questions !== undefined) {
    if (!Array.isArray(raw.questions) || raw.questions.length > 24) throw inputError('작성 문항 12개와 이전 답변 12개까지 보관할 수 있습니다.');
    fields.questions = raw.questions.map(question => ({ ...normalizeQuestion(question, true), answer: boundedInput(question, 'answer', 20000), linkedExperienceIds: validateExperienceIds(question.linkedExperienceIds), notes: stringList(question.notes, 12, 500), warnings: stringList(question.warnings, 12, 500), evidence: Array.isArray(question.evidence) ? question.evidence.slice(0, 12).map(item => ({ experienceId: cleanText(item?.experienceId, 128), quote: cleanText(item?.quote, 1800) })) : [], review: question.review && typeof question.review === 'object' && !Array.isArray(question.review) ? { charCount: Number(question.review.charCount) || 0, withinLimit: Boolean(question.review.withinLimit), unverifiedNumbers: stringList(question.review.unverifiedNumbers, 20, 100) } : null }));
    const analysis = raw.analysis !== undefined ? fields.analysis : previous?.analysis;
    const proof = analysis?.questionSourceText ?? analysis?.sourceText ?? fields.sourceText ?? previous?.sourceText ?? '';
    fields.questions = fields.questions.map(question => ({ ...question, validation: question.source === 'posting'
      ? normalizePostingQuestions([question], proof).length ? 'verified' : 'unverified'
      : question.source === 'suggested' ? 'unverified' : 'manual' }));
    if (fields.questions.filter(question => question.validation !== 'unverified').length > 12) throw inputError('자기소개서 작성 문항은 최대 12개까지 저장할 수 있습니다.');
  }
  const date = new Date();
  const document = { ...(previous || { title: '새 자기소개서', targetCompany: '', targetPosition: '', questions: [], analysis: null, style: 'plain', voiceSample: '', additionalContext: '', sourceUrl: '', sourceText: '', sourceInputText: '', status: 'draft', createdAt: date }), ...fields, userId: uid, updatedAt: date };
  delete document.id;
  if (Buffer.byteLength(JSON.stringify(document)) > 900000) throw inputError('자기소개서 용량이 너무 큽니다. 공고 원문이나 문항을 줄여주세요.', 413);
  return document;
}
