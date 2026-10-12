import { normalizeQuestions } from './coverLetter.js';

export const APPLICATION_CONNECTION_TTL = 15 * 60 * 1000;
export const CONNECTOR_CONFIG_URL = '/application-connector/config.json';
export const CONNECTOR_DOWNLOAD_URL = '/application-connector/fitpoly-application-connector.zip';

export function connectionTarget(analysis, selectedUrl = '') {
  if (!analysis) throw new Error('먼저 채용 공고를 분석해주세요.');
  const links = analysis.applicationLinks || [];
  if (links.length > 1 && !selectedUrl) throw new Error('지원할 직무를 먼저 선택해주세요.');
  const selected = selectedUrl || analysis.selectedApplicationUrl || links[0]?.url || '';
  const raw = selected && selected !== analysis.selectedApplicationUrl
    ? selected : analysis.applicationUrl || selected;
  let url;
  try { url = new URL(raw); } catch { throw new Error('연결할 공식 지원서 링크를 확인하지 못했어요. 공고를 다시 분석해주세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('공식 HTTPS 지원서만 연결할 수 있어요.');
  }
  return { url: url.href, expectedOrigin: url.origin, selectedApplicationUrl: selected || url.href };
}

export function supportsApplicationConnector(userAgent = globalThis.navigator?.userAgent || '') {
  return /(?:Chrome|Chromium|Edg)\//.test(userAgent) && !/(?:Android|iPhone|iPad|Mobile)/i.test(userAgent);
}

export async function loadConnectorConfig(fetcher = globalThis.fetch) {
  const response = await fetcher(CONNECTOR_CONFIG_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('연결 도구 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  const config = await response.json();
  if (!/^[a-p]{32}$/.test(config?.extensionId) || config.downloadUrl !== CONNECTOR_DOWNLOAD_URL) {
    throw new Error('연결 도구 설정이 올바르지 않아요.');
  }
  return config;
}

export function sendConnectorMessage(extensionId, message, runtime = globalThis.chrome?.runtime) {
  if (!runtime?.sendMessage) return Promise.reject(new Error('연결 도구를 먼저 설치한 뒤 이 페이지를 새로고침해주세요.'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('연결 도구 응답이 없어요. 설치 상태를 확인하고 다시 연결해주세요.')), 5000);
    const done = (error, response) => {
      clearTimeout(timer);
      if (error) reject(error);
      else if (!response || response.status === 'error') reject(new Error(response?.error || '연결 도구에 접근하지 못했어요.'));
      else resolve(response);
    };
    try {
      runtime.sendMessage(extensionId, message, (response) => {
        const error = runtime.lastError;
        done(error ? new Error('연결 도구를 먼저 설치한 뒤 이 페이지를 새로고침해주세요.') : null, response);
      });
    } catch { done(new Error('연결 도구를 먼저 설치한 뒤 이 페이지를 새로고침해주세요.')); }
  });
}

export function newApplicationConnection(target, context = {}, now = Date.now(), randomUUID = () => crypto.randomUUID()) {
  return {
    type: 'FITPOLY_CONNECT',
    nonce: randomUUID().replace(/-/g, ''),
    expectedOrigin: target.expectedOrigin,
    targetUrl: target.url,
    expiresAt: now + APPLICATION_CONNECTION_TTL,
    company: String(context.company || '').slice(0, 200),
    position: String(context.position || '').slice(0, 200),
  };
}

/** Treat extension messages as untrusted data; never retain unexpected fields or credentials. */
export function validateApplicationCapture(raw, connection, now = Date.now()) {
  if (!connection || connection.expiresAt <= now) throw new Error('지원서 연결 시간이 지났어요. 다시 연결해주세요.');
  if (raw?.version !== 1 || !Array.isArray(raw.questions) || !raw.questions.length || raw.questions.length > 12) {
    throw new Error('실제 문항을 받지 못했어요. 자소서 입력 화면에서 다시 가져와주세요.');
  }
  let url;
  try { url = new URL(raw.sourceUrl); } catch { throw new Error('지원서 출처가 올바르지 않아요.'); }
  if (url.protocol !== 'https:' || url.origin !== connection.expectedOrigin || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('선택한 공고의 공식 지원서에서 가져온 문항만 연결할 수 있어요.');
  }
  if (url.hostname === 'recruit.sfa.co.kr' && url.searchParams.has('rnId') && connection.targetUrl) {
    const expected = new URL(connection.targetUrl);
    const roleId = expected.searchParams.get('rnId') || (/\/sfasemicon\/recruit\/?$/.test(expected.pathname) ? expected.searchParams.get('id') : null);
    if (roleId && url.searchParams.get('rnId') !== roleId) throw new Error('선택한 직무와 다른 지원서예요. 지원할 직무의 문항 화면에서 다시 가져와주세요.');
  }
  const safeUrl = new URL(url.origin + url.pathname);
  for (const key of ['rnId', 'gbn', 'ec', 'e', 'recruit_id', 'job_id']) {
    const value = url.searchParams.get(key);
    if (value && /^[\w-]{1,80}$/.test(value)) safeUrl.searchParams.set(key, value);
  }
  const captured = Date.parse(raw.capturedAt);
  if (!Number.isFinite(captured) || captured > now + 60000 || captured < connection.expiresAt - APPLICATION_CONNECTION_TTL - 60000) {
    throw new Error('이전 연결에서 가져온 문항이에요. 지원서 화면에서 다시 확인해주세요.');
  }
  const limit = value => value == null ? null : Number.isInteger(value) && value >= 1 && value <= 10000 ? value : undefined;
  const questions = raw.questions.map(item => {
    if (!item || typeof item.question !== 'string' || !item.question.trim() || item.question.length > 1600
      || typeof item.sourceQuote !== 'string' || item.sourceQuote.length > 2200
      || !item.sourceQuote.replace(/\s+/g, '').includes(item.question.trim().replace(/\s+/g, ''))
      || limit(item.maxLength) === undefined || limit(item.minLength) === undefined) {
      throw new Error('문항 원문이나 글자 수 정보가 올바르지 않아요. 지원서에서 다시 확인해주세요.');
    }
    const maxLength = limit(item.maxLength), minLength = limit(item.minLength);
    if (maxLength && minLength && maxLength < minLength) throw new Error('문항의 글자 수 제한을 확인해주세요.');
    return { question: item.question.trim(), sourceQuote: item.sourceQuote.trim(), maxLength, minLength, countSpaces: item.countSpaces !== false };
  });
  return { version: 1, sourceUrl: safeUrl.href, capturedAt: new Date(captured).toISOString(), questions,
    warnings: (Array.isArray(raw.warnings) ? raw.warnings : []).filter(item => typeof item === 'string').slice(0, 6).map(item => item.slice(0, 500)) };
}

const promptKey = question => String(question || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

/** Updating a matching prompt changes its evidence/limits, while keeping the author's work. */
export function mergeApplicationQuestions(existing = [], incoming = []) {
  const questions = normalizeQuestions(existing).filter(item => item.question.trim() || item.answer.trim() || item.linkedExperienceIds.length);
  const importedIds = [];
  for (const raw of normalizeQuestions(incoming)) {
    const matched = questions.findIndex(item => item.validation !== 'unverified' && promptKey(item.question) === promptKey(raw.question));
    if (matched >= 0) {
      const previous = questions[matched];
      questions[matched] = { ...previous, ...raw, id: previous.id, answer: previous.answer, linkedExperienceIds: previous.linkedExperienceIds,
        notes: previous.notes, warnings: previous.warnings, evidence: previous.evidence, review: null };
      importedIds.push(previous.id);
    } else {
      let id = raw.id;
      while (questions.some(item => item.id === id)) id = `import-${id}`;
      questions.push({ ...raw, id });
      importedIds.push(id);
    }
  }
  if (questions.filter(item => item.validation !== 'unverified').length > 12) {
    throw new Error('기존 문항과 합쳐 최대 12개까지 가져올 수 있어요. 필요 없는 문항을 정리한 뒤 다시 가져와주세요.');
  }
  return { questions, importedIds };
}
