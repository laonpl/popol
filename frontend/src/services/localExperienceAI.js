// AI finds the user's experiences in local documents, then fills STAR from each experience's
// full originals and the pictures inside them. `request(path, body, { signal })` posts to the API.
import { sameLook } from './localExperienceFiles.js';

export const DISCOVER_DOCUMENTS = 24;
export const VISIBLE_EXPERIENCES = 5;
const ORGANIZE_IMAGES = 6;
const STOP_CODES = ['CREDITS_REQUIRED', 'AI_CONFIGURATION', 'AI_RATE_LIMIT'];
const CACHE_KEY = 'fitpoly-local-ai-cache';
const CACHE_ENTRIES = 40;
const CACHE_AGE = 14 * 86400000;

// The same documents give the same answer, so an AI result is kept in this browser and reused.
// `fresh` asks AI again; incomplete discoveries are not kept.
export function cachedRequest(request, storage = globalThis.localStorage) {
  const load = () => { try { return JSON.parse(storage.getItem(CACHE_KEY)) || {}; } catch { return {}; } };
  return async (path, body, { fresh = false, ...options } = {}) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([path, body])));
    const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const hit = load()[key];
    if (!fresh && hit && Date.now() - hit.at < CACHE_AGE) return hit.data;
    const data = await request(path, body, options);
    if (!data?.partial) {
      const rows = Object.entries({ ...load(), [key]: { at: Date.now(), data } }).sort((a, b) => b[1].at - a[1].at).slice(0, CACHE_ENTRIES);
      try { storage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(rows))); } catch { /* A full or blocked storage only loses the reuse. */ }
    }
    return data;
  };
}

const normalized = text => String(text || '').replace(/\s+/g, ' ').trim();
const unique = (rows, key) => [...new Map(rows.map(row => [key(row), row])).values()];
let sequence = 0;
const newId = () => `local-${Date.now().toString(36)}-${(sequence += 1)}`;

// Read in order; identical copies become one document that lists every path.
export async function readLocalDocuments(records, { read, signal, onProgress = () => {} }) {
  const documents = [], failures = [];
  const byText = new Map();
  for (const [index, record] of records.entries()) {
    signal?.throwIfAborted();
    onProgress({ current: index + 1, total: records.length, path: record.path });
    try {
      const { text, images = [] } = await read(record, { signal });
      const copy = byText.get(normalized(text));
      if (copy) { copy.paths.push(record.path); continue; }
      const document = { id: record.id, path: record.path, paths: [record.path], lastModified: record.lastModified, text, images };
      byText.set(normalized(text), document);
      documents.push(document);
    } catch (error) {
      if (signal?.aborted) throw error;
      failures.push({ path: record.path, message: error.message || '파일을 읽지 못했어요.' });
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return { documents, failures };
}

const month = time => {
  if (!time) return '';
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// A picture that looks the same as one already held (a copy or another version of the same deck) is not added again.
function withDocuments(item, documents) {
  const all = unique([...(item.documents || []), ...documents], document => document.id);
  const images = [...(item.images || [])];
  for (const image of documents.flatMap(document => document.images)) {
    if (!images.some(kept => kept.id === image.id || sameLook(kept.look, image.look))) images.push({ ...image, include: false });
  }
  return { ...item, documents: all, documentIds: all.map(document => document.id),
    sourcePaths: [...new Set(all.flatMap(document => document.paths))],
    localDocuments: all.map(document => ({ path: document.path, text: document.text })), images };
}

function candidate(finding, documents) {
  return withDocuments({ id: newId(), title: finding.title, period: finding.period || '', summary: finding.summary || '', core: finding.core || '',
    anchors: finding.anchors || [], searchTerms: finding.search || [], strength: finding.strength || 1, role: '', context: '', task: '', action: '', result: '', learning: '',
    keywords: [], category: '기타', missing: [], organizeState: 'pending', organizeError: '', localEdits: {}, needsReview: true }, documents);
}

// The first readable file of each series is sent to discovery; the rest follow it into the experience.
export function splitSeries(records, documents) {
  const byId = new Map(documents.map(document => [document.id, document]));
  const leads = [], followers = new Map();
  for (const record of records) {
    const [lead, ...rest] = [record, ...(record.series || [])].map(member => byId.get(member.id)).filter(Boolean);
    if (!lead) continue;
    leads.push(lead);
    if (rest.length) followers.set(lead.id, rest);
  }
  return { leads, followers };
}

// Documents travel under their position, not their file id: the local explorer issues new ids on
// every scan, and the same documents must make the same request for a stored result to be reused.
export async function discoverCandidates(documents, { request, known = [], signal, followers = new Map() }) {
  const byId = new Map(documents.map((document, index) => [String(index + 1), document]));
  const result = await request('/experience/local-discover', {
    documents: documents.map((document, index) => ({ id: String(index + 1), path: document.path, modified: month(document.lastModified),
      imageCount: document.images.length, text: document.text })),
    known: known.map(item => ({ id: item.id, title: item.title, summary: item.summary || item.core || '', period: item.period || '' })),
  }, { signal });
  const pick = ids => (ids || []).map(id => byId.get(id)).filter(Boolean).flatMap(document => [document, ...(followers.get(document.id) || [])]);
  return {
    items: (result.experiences || []).map(finding => candidate(finding, pick(finding.documentIds))).filter(item => item.documents.length),
    updates: (result.updates || []).map(update => ({ id: update.id, documents: pick(update.documentIds), anchors: update.anchors || [] })),
    excluded: (result.excluded || []).map(row => ({ path: byId.get(row.documentId)?.path, reason: row.reason })).filter(row => row.path),
    partial: Boolean(result.partial),
  };
}

// New documents for an existing card. Unsaved cards without edits are organized again.
export function attachDocuments(item, documents, anchors = []) {
  const added = documents.filter(document => !item.documentIds.includes(document.id));
  if (!added.length) return item;
  return { ...withDocuments(item, added), anchors: [...new Set([...item.anchors, ...anchors])], hasNewLocalSources: true };
}

export const sortCandidates = items => [...items].sort((a, b) => b.strength - a.strength);

const projectName = title => String(title || '').split(/\s[—–-]\s/)[0].trim().toLowerCase();
const GENERIC_NAME = /프로젝트|포트폴리오|이력서|자소서|보고서|기획|발표|회고|공모전|인턴|활동|연구|과제|project|portfolio|resume|report/i;
const GENERIC_TERM = /^(?:프로젝트|포트폴리오|서비스|시스템|플랫폼|솔루션|프로그램|개발|기획|구축|설계|분석|운영|관리|구현|제작|개선|활용|기반|보고서|발표|발표자료|자료|최종|결과|대회|공모전|경진대회|활동|연구|과제|참여|수상|모델|데이터|사용자|학생|대학|대학교|인턴|동아리|이력서|회고|주간|위한|통한|project|service|system|report|final|team|data|model|platform|portfolio|resume)$/;
const RELATED_FOLDER = 6;

// What a file path can be searched for: the project's own name, and the distinctive words of the
// title, the source expressions and the search words AI gave for the experience.
function fileSearch(item) {
  const name = projectName(item.title);
  const named = name.replace(/\s/g, '').length < 3 || GENERIC_NAME.test(name) ? null
    : /^[a-z0-9 ]+$/.test(name) ? new RegExp(`(?:^|[^a-z0-9])${name.replace(/ /g, '[ _-]?')}(?:[^a-z0-9]|$)`)
      : name.replace(/\s/g, '');
  const words = [item.title, ...(item.anchors || []), ...(item.searchTerms || [])].join(' ').toLowerCase().match(/[가-힣]{2,}|[a-z][a-z0-9]{2,}/g) || [];
  return { named, terms: [...new Set(words)].filter(word => !GENERIC_TERM.test(word)) };
}

// 10 when the path carries the project name, otherwise the number of distinctive words it carries.
function fileScore({ named, terms }, path) {
  const compact = path.replace(/[\s_-]/g, '');
  if (named && (typeof named === 'string' ? compact.includes(named) : named.test(path))) return 10;
  return terms.filter(term => /^[a-z]/.test(term) ? new RegExp(`(?:^|[^a-z0-9])${term}(?:[^a-z0-9]|$)`).test(path)
    : compact.includes(term) || (term.length >= 4 && compact.includes(term.slice(0, -1)))).length;
}

// Files outside the reading round that belong to a found experience: the path carries the project's
// name ("FitPoly_중간발표.pptx") or two of its distinctive words ("구현트랙_보고서_시각장애인_실내대피.pdf"),
// and the other documents of that file's own small folder come with it. A file that fits two
// experiences equally well is left for a later round.
export function relatedLocalFiles(items, files, limit = 4) {
  const searches = items.map(item => [item, fileSearch(item)]);
  const folderOf = file => file.path.replace(/\/[^/]*$/, '');
  const folders = new Map();
  for (const file of files) folders.set(folderOf(file), [...(folders.get(folderOf(file)) || []), file]);
  const related = new Map(), versions = new Set(), taken = new Set();
  const add = (item, file) => {
    // v2 and v3 of one deck, its PDF export, or its copy in another folder repeat the same pages: the first (newest) is enough.
    const version = file.path.split('/').at(-1).toLowerCase().replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)|[\s_-]/g, '').replace(/v\d+(?:\.\d+)*|\d+차/g, '#');
    const rows = related.get(item.id) || [];
    if (taken.has(file) || versions.has(version) || rows.length >= limit) return;
    taken.add(file); versions.add(version);
    related.set(item.id, [...rows, file]);
  };
  // undefined: fits no experience · null: fits two equally · otherwise the experience it belongs to
  const owner = file => {
    const path = file.path.toLowerCase().replace(/^[^/]*\//, '');
    const scores = searches.map(([item, search]) => [item, fileScore(search, path)]).filter(([, score]) => score >= 2).sort((a, b) => b[1] - a[1]);
    return !scores.length ? undefined : scores[0][1] === scores[1]?.[1] ? null : scores[0][0];
  };
  const owners = new Map(files.map(file => [file, owner(file)]));
  const owned = [...owners].filter(([, item]) => item);
  for (const [file, item] of owned) add(item, file);
  for (const [file, item] of owned) {
    const folder = folderOf(file), siblings = folders.get(folder);
    // A drive root or a whole 다운로드 folder is not one project's folder.
    if (folder.split('/').length < 2 || siblings.length > RELATED_FOLDER) continue;
    for (const sibling of siblings) if (owners.get(sibling) === undefined) add(item, sibling);
  }
  return related;
}

export const addDocuments = (item, documents) => withDocuments(item, documents.filter(added => !item.documents.some(own => own.text === added.text)));

// Spread picks across documents, slide decks first: their pictures are the charts and screens made to be shown.
export function imagesForAnalysis(item, limit = ORGANIZE_IMAGES) {
  const groups = item.documentIds.map(id => item.images.filter(image => image.documentId === id))
    .sort((a, b) => Number(/\.pptx$/i.test(b[0]?.path)) - Number(/\.pptx$/i.test(a[0]?.path)));
  const picked = [];
  for (let round = 0; picked.length < limit && groups.some(group => group[round]); round += 1) {
    for (const group of groups) if (group[round] && picked.length < limit) picked.push(group[round]);
  }
  return picked;
}

async function base64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export async function organizeCandidate(item, { request, signal, fresh = false }) {
  const images = imagesForAnalysis(item);
  const result = await request('/experience/local-organize', {
    experience: { title: item.title, summary: item.summary, core: item.core, period: item.period, anchors: item.anchors },
    documents: item.localDocuments,
    images: await Promise.all(images.map(async (image, index) => ({ id: String(index + 1), path: image.path, context: image.context || '',
      mimeType: image.blob.type || 'image/jpeg', data: await base64(image.blob) }))),
  }, { signal, fresh });
  const fields = result.experience || {};
  // Files AI found to be about another project leave the experience, with their pictures.
  const kept = item.documents.filter(document => !(result.unrelated || []).includes(document.path));
  if (kept.length && kept.length < item.documents.length) item = withDocuments({ ...item, documents: [], images: [] }, kept);
  const findings = new Map((result.images || []).filter(row => row.analyzed && images[row.id - 1]).map(row => [images[row.id - 1].id, { ...row, id: images[row.id - 1].id }]));
  return { ...item,
    title: fields.title || item.title, period: fields.period || item.period, role: fields.role || '', context: fields.context || '',
    task: fields.task || '', action: fields.action || '', result: fields.result || '', learning: fields.learning || '',
    keywords: fields.keywords || [], category: fields.category || item.category, core: fields.core || item.core, missing: fields.missing || [],
    images: item.images.map(image => {
      const analysis = findings.get(image.id);
      return { ...image, analysis: analysis || null, include: Boolean(analysis && analysis.relevance !== 'none' && analysis.kind !== 'decoration') };
    }),
    imageFailed: Boolean(result.imageFailed), organizeState: 'done', organizeError: '', localEdits: {}, hasNewLocalSources: false,
    needsReview: (fields.missing || []).length > 0 };
}

export const shouldStopOrganizing = error => STOP_CODES.includes(error?.response?.data?.code) || [401, 402, 429].includes(error?.response?.status);

export function mergeCandidates(items) {
  const parts = items.flatMap(item => item.parts?.length ? item.parts : [item]);
  const merged = withDocuments({ ...items[0], id: newId(), documents: [], images: [] }, items.flatMap(item => item.documents));
  return { ...merged, summary: items.map(item => item.summary).filter(Boolean).join(' '), core: items.map(item => item.core).filter(Boolean).join(' '),
    anchors: [...new Set(items.flatMap(item => item.anchors))], strength: Math.max(...items.map(item => item.strength)),
    parts, organizeState: 'pending', localEdits: {}, hasNewLocalSources: false, manualFusion: true };
}

// A manual merge returns to its original cards; an AI group is split per document and organized again.
export function splitCandidate(item) {
  if (item.parts?.length > 1) return item.parts.map(part => ({ ...part, separateExperience: true }));
  return item.documents.map(document => withDocuments({ ...item, id: newId(), documents: [], images: [], anchors: item.anchors,
    title: `${item.title} · ${document.path.split('/').at(-1)}`, organizeState: 'pending', localEdits: {}, parts: [], separateExperience: true,
    hasNewLocalSources: false }, [document]));
}
