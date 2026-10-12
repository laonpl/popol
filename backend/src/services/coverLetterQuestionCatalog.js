import { createHash } from 'node:crypto';
import { validatePublicUrl } from './publicWebFetch.js';
import { cleanText, extractPostingQuestions, normalizePostingQuestions } from './coverLetterEvidence.js';

const COLLECTION = 'coverLetterQuestionCatalog';
const ALIASES = `${COLLECTION}Aliases`;
const REQUESTS = `${COLLECTION}Requests`;
const error = (message, status = 422) => Object.assign(new Error(message), { status });
const clock = value => new Date(typeof value === 'function' ? value() : value ?? Date.now());
const digest = value => createHash('sha256').update(value).digest('hex');

function text(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw error(`${name}을 확인해주세요.`);
  return value.trim();
}

export function canonicalCatalogUrl(raw) {
  const url = new URL(validatePublicUrl(text(raw, '공고·지원서 주소', 2000)));
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_|^(?:Oem_Code|PageGbn|sc|pg|page|referrer|tracking)$/i.test(key)
      || /token|session|auth|jwt|cookie|password|email|phone|nonce/i.test(key)
      || /^(?:sid|sso|code|state)$/i.test(key)) url.searchParams.delete(key);
  }
  if (/^(?:www\.)?jobkorea\.co\.kr$/i.test(url.hostname)) {
    const id = url.pathname.match(/\/GI_Read\/(\d+)\/?$/i)?.[1] || url.searchParams.get('Gno') || url.searchParams.get('gno');
    if (id && /^\d+$/.test(id)) return `https://www.jobkorea.co.kr/Recruit/GI_Read/${id}`;
  }
  if (url.hostname === 'recruit.sfa.co.kr') {
    const role = url.pathname === '/sfasemicon/recruit' ? url.searchParams.get('id')
      : url.pathname.startsWith('/apply/') ? url.searchParams.get('rnId') : '';
    if (/^\d+$/.test(role || '')) return `https://recruit.sfa.co.kr/sfasemicon/recruit?id=${role}`;
  }
  url.searchParams.sort();
  // Preserve meaningful hash routes on ATS sites, removing only page anchors.
  if (!/\/(?:jobs?|recruitment|detail)\//i.test(url.hash)) url.hash = '';
  return url.href;
}

export function catalogIdentity({ sourceUrl, applicationUrl }) {
  const source = canonicalCatalogUrl(sourceUrl);
  const application = canonicalCatalogUrl(applicationUrl || sourceUrl);
  return { id: digest(JSON.stringify([source, application])), sourceUrl: source, applicationUrl: application };
}

function date(value, name) {
  if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw error(`${name}을 시간대와 함께 입력해주세요.`);
  return new Date(value).toISOString();
}

function assertEvidenceRole(applicationUrl, evidenceUrl) {
  const selected = new URL(applicationUrl);
  const evidence = new URL(evidenceUrl);
  if (selected.hostname === 'recruit.sfa.co.kr' && selected.searchParams.has('id')) {
    if (canonicalCatalogUrl(evidenceUrl) !== applicationUrl) throw error('선택한 SFA 직무와 다른 지원서 원본입니다.');
  }
  if (selected.hostname === 'jasoseol.com' && evidence.hostname === selected.hostname) {
    for (const key of ['ec', 'e', 'employment_id']) {
      const actual = evidence.searchParams.get(key);
      if (actual && selected.searchParams.get(key) && actual !== selected.searchParams.get(key)) throw error('선택한 직무와 다른 지원서 원본입니다.');
    }
  }
}

function verifiedQuestions(entry) {
  const questions = normalizePostingQuestions(entry.questions, entry.questionSourceText);
  if (!questions.length || questions.length !== entry.questions?.length || questions.some((q, index) =>
    q.question !== entry.questions[index].question || q.maxLength !== entry.questions[index].maxLength
    || q.minLength !== entry.questions[index].minLength || q.countSpaces !== entry.questions[index].countSpaces)) return [];
  return questions.map(q => ({ ...q, validation: 'verified', importMethod: 'question_catalog' }));
}

export function buildCatalogEntry(payload, { now, verifiedBy, preview = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw error('문항 원본 정보를 확인해주세요.');
  if (!preview && payload.originalVerified !== true) throw error('실제 지원서 원본 확인이 필요합니다.');
  const identity = catalogIdentity(payload);
  const sourceEvidenceUrl = canonicalEvidenceUrl(payload.sourceEvidenceUrl);
  assertEvidenceRole(identity.applicationUrl, sourceEvidenceUrl);
  const company = text(payload.company, '기업명', 200);
  const position = text(payload.position, '직무명', 200);
  const original = text(payload.sourceQuestionText || payload.evidenceText, '지원서 문항 원문', 30000);
  const questions = extractPostingQuestions(`[지원서 원문: 운영 확인]\n자기소개서 문항\n${original}`);
  if (!questions.length || questions.length > 12) throw error('실제 지원서의 자기소개서 문항을 확인하지 못했습니다.');
  const validFrom = date(payload.validFrom, '모집 시작일');
  const expiresAt = date(payload.expiresAt, '모집 마감일');
  if (validFrom >= expiresAt || Date.parse(expiresAt) - Date.parse(validFrom) > 180 * 86400000) throw error('모집 기간은 시작일 이후 180일 이내여야 합니다.');
  if (Date.parse(expiresAt) <= clock(now).getTime()) throw error('이미 마감된 공고의 문항은 등록할 수 없습니다.');
  const aliases = (Array.isArray(payload.sourceAliases) ? payload.sourceAliases : []).slice(0, 8)
    .map(sourceUrl => catalogIdentity({ sourceUrl, applicationUrl: identity.applicationUrl }));
  const identities = [...new Map([identity, ...aliases].map(item => [item.id, item])).values()];
  const timestamp = clock(now).toISOString();
  // Store only validated question labels/excerpts, never the full pasted form.
  const questionSourceText = `[지원서 원문: 운영 확인]\n자기소개서 문항\n${questions.map(q => q.sourceQuote).join('\n\n')}`;
  return { id: identity.id, identity, aliasIds: identities.map(item => item.id), aliases: identities,
    company, position, sourceUrl: identity.sourceUrl, applicationUrl: identity.applicationUrl,
    sourceEvidenceUrl, questions: questions.map(q => ({ ...q, validation: 'verified', importMethod: 'question_catalog' })),
    questionSourceText, validFrom, expiresAt, verifiedAt: timestamp,
    verifiedBy: text(verifiedBy, '관리자', 128), active: true, createdAt: timestamp, updatedAt: timestamp };
}

function canonicalEvidenceUrl(raw) {
  const url = new URL(validatePublicUrl(text(raw, '지원서 원본 주소', 2000)));
  for (const key of [...url.searchParams.keys()]) if (/token|session|auth|jwt|cookie|password|email|phone|nonce/i.test(key) || /^(?:sid|sso|code|state)$/i.test(key)) url.searchParams.delete(key);
  url.hash = '';
  return url.href;
}

function currentEntry(entry, now) {
  return entry?.active === true && entry.verifiedBy && Number.isFinite(Date.parse(entry.validFrom))
    && Date.parse(entry.validFrom) <= clock(now).getTime() && Date.parse(entry.expiresAt) > clock(now).getTime()
    && verifiedQuestions(entry).length > 0;
}

export function customerCatalogEntry(entry) {
  const result = {};
  for (const key of ['id', 'company', 'position', 'sourceUrl', 'applicationUrl', 'sourceEvidenceUrl', 'validFrom', 'expiresAt', 'verifiedAt', 'questionSourceText']) result[key] = entry[key];
  result.questions = verifiedQuestions(entry);
  return result;
}

export function applyCatalogEntry(analysis, entry, { now } = {}) {
  const identity = catalogIdentity({ sourceUrl: analysis.sourceUrl,
    applicationUrl: analysis.selectedApplicationUrl || analysis.applicationUrl || analysis.sourceUrl });
  if (!currentEntry(entry, now) || !entry.aliasIds?.includes(identity.id)) throw error('현재 공고와 직무에 맞는 검증 문항을 확인하지 못했습니다.');
  return { ...analysis, company: analysis.company || entry.company, position: analysis.position || entry.position,
    questions: verifiedQuestions(entry), questionStatus: 'verified', questionSourceText: entry.questionSourceText,
    questionNotice: '해당 공고와 직무의 실제 지원서 원문을 확인한 문항입니다.',
    questionCatalog: { status: 'verified', id: entry.id, verifiedAt: entry.verifiedAt, expiresAt: entry.expiresAt },
    sources: [...(analysis.sources || []).filter(source => source.id !== 'question-catalog'),
      { id: 'question-catalog', title: '확인한 실제 지원서 문항', url: entry.sourceEvidenceUrl, type: 'posting' }] };
}

export function createQuestionCatalog(db, { now = Date.now } = {}) {
  const entries = db.collection(COLLECTION);
  const aliases = db.collection(ALIASES);
  const requests = db.collection(REQUESTS);
  return {
    async lookup(input) {
      const identity = catalogIdentity(input);
      const alias = await aliases.doc(identity.id).get();
      const id = alias.exists ? alias.data().catalogId : identity.id;
      if (typeof id === 'string' && /^[a-f\d]{64}$/.test(id)) {
        const snapshot = await entries.doc(id).get();
        const entry = snapshot.exists ? snapshot.data() : null;
        if (currentEntry(entry, now) && entry.aliasIds?.includes(identity.id)) return { entry, status: 'verified' };
      }
      const ref = requests.doc(identity.id);
      await db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        const previous = snapshot.exists ? snapshot.data() : {};
        tx.set(ref, { id: identity.id, ...identity, status: 'pending',
          count: Math.min(1000000, Math.max(0, Number(previous.count) || 0) + 1),
          createdAt: previous.createdAt || clock(now).toISOString(), updatedAt: clock(now).toISOString() });
      });
      return { entry: null, status: 'pending', requestId: identity.id };
    },
    async publish(payload, { verifiedBy } = {}) {
      const entry = buildCatalogEntry(payload, { now, verifiedBy });
      const previous = await entries.doc(entry.id).get();
      if (previous.exists) entry.createdAt = previous.data().createdAt || entry.createdAt;
      const batch = db.batch();
      batch.set(entries.doc(entry.id), entry);
      for (const identity of entry.aliases) {
        batch.set(aliases.doc(identity.id), { catalogId: entry.id });
        batch.set(requests.doc(identity.id), { ...identity, status: 'resolved', updatedAt: entry.updatedAt }, { merge: true });
      }
      await batch.commit();
      return entry;
    },
    async list({ limit = 50 } = {}) {
      const count = Math.max(1, Math.min(100, Number(limit) || 50));
      const [catalogSnapshot, requestSnapshot] = await Promise.all([
        entries.orderBy('updatedAt', 'desc').limit(count).get(),
        requests.where('status', '==', 'pending').limit(count).get(),
      ]);
      return { entries: catalogSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })),
        requests: requestSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) };
    },
    async setActive(id, active, { verifiedBy } = {}) {
      if (active !== false || !/^[a-f\d]{64}$/.test(id || '')) throw error('문항 원본 ID를 확인해주세요.');
      const ref = entries.doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) throw error('등록된 문항을 찾을 수 없습니다.', 404);
      const entry = { ...snapshot.data(), active: false, updatedAt: clock(now).toISOString(), deactivatedBy: text(verifiedBy, '관리자', 128) };
      await ref.set(entry);
      return entry;
    },
  };
}
