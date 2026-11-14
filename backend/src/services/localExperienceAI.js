// AI 기반 로컬 경험 찾기·정리. AI 호출(generate)과 JSON 해석(parse)은 호출부가 넘긴다.
import { clampMaterial } from '../utils/materialText.js';
import {
  LOCAL_CATEGORIES, LOCAL_IMAGE_KINDS,
  buildLocalDiscoverPrompt, buildLocalConsolidatePrompt, buildLocalOrganizePrompt,
} from '../prompts/localExperiencePrompts.js';

// Finding an experience needs only enough text to recognise it; résumés and portfolios list many
// experiences, so they keep a longer excerpt.
export const DISCOVER_LIMITS = { documents: 60, documentChars: 3000, summaryChars: 7000, batchChars: 36000, concurrency: 3 };
export const ORGANIZE_LIMITS = { documents: 30, totalChars: 24000, documentChars: 16000, images: 6, imageBase64: 2_000_000 };
const SUMMARY_DOCUMENT = /이력서|자소서|자기\s*소개서|경력\s*기술서|포트폴리오|resume|portfolio|cover.?letter|(?:^|[^a-z])cv(?:[^a-z]|$)/i;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const STAR_FIELDS = ['role', 'situation', 'task', 'action', 'result'];

const text = (value, max = 4000) => String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const list = value => Array.isArray(value) ? value : [];
const compact = value => String(value).toLowerCase().replace(/\s+/g, '');
const json = config => ({ responseMimeType: 'application/json', temperature: 0.2, ...config });

async function mapLimit(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await task(items[index]); }
  }));
  return results;
}

function packBatches(documents) {
  const batches = [];
  let current = [], size = 0;
  for (const doc of documents) {
    const body = clampMaterial(doc.text, SUMMARY_DOCUMENT.test(doc.path) ? DISCOVER_LIMITS.summaryChars : DISCOVER_LIMITS.documentChars);
    if (current.length && size + body.length > DISCOVER_LIMITS.batchChars) { batches.push(current); current = []; size = 0; }
    current.push({ ...doc, text: body }); size += body.length;
  }
  if (current.length) batches.push(current);
  return batches;
}

export function sanitizeDiscoverInput(body = {}) {
  const documents = list(body.documents).slice(0, DISCOVER_LIMITS.documents).map(doc => ({
    id: text(doc?.id, 200), path: text(doc?.path, 500), modified: text(doc?.modified, 20),
    imageCount: Math.max(0, Math.min(999, Number(doc?.imageCount) || 0)), text: text(doc?.text, 120000),
  })).filter(doc => doc.id && doc.text);
  const known = list(body.known).slice(0, 60).map(row => ({
    id: text(row?.id, 200), title: text(row?.title, 120), summary: text(row?.summary, 300), period: text(row?.period, 40),
  })).filter(row => row.id && row.title);
  return { documents, known };
}

// Each key appears once, a group holds at most one existing experience and at least one new one.
function sanitizeGroups(groups, knownKeys, foundKeys) {
  const used = new Set();
  return list(groups).map(group => {
    let target = null;
    const keys = [...new Set(list(group).map(String))].filter(key => {
      if (used.has(key)) return false;
      if (knownKeys.has(key)) { if (target) return false; target = key; return true; }
      return foundKeys.has(key);
    });
    if (keys.length < 2 || !keys.some(key => foundKeys.has(key))) return null;
    keys.forEach(key => used.add(key));
    return keys;
  }).filter(Boolean);
}

function combine(rows) {
  const base = [...rows].sort((a, b) => b.strength - a.strength)[0];
  return { ...base,
    documents: [...new Set([base.primary, ...rows.flatMap(row => row.documents)])],
    anchors: [...new Set(rows.flatMap(row => row.anchors))].slice(0, 8),
    search: [...new Set(rows.flatMap(row => row.search))].slice(0, 8),
    strength: Math.max(...rows.map(row => row.strength)) };
}

export async function discoverLocalExperiences({ documents, known = [] }, { generate, parse }) {
  const keyed = documents.map((doc, index) => ({ ...doc, key: `D${index + 1}` }));
  const byKey = new Map(keyed.map(doc => [doc.key, doc]));
  const batches = packBatches(keyed);
  const errors = [];
  const outcomes = await mapLimit(batches, DISCOVER_LIMITS.concurrency, async batch => {
    try {
      return parse(await generate(buildLocalDiscoverPrompt(batch), { tier: 'standard', callTimeoutMs: 150000, config: json({ maxOutputTokens: 8000 }) }));
    } catch (error) { errors.push(error); return null; }
  });
  if (outcomes.every(outcome => !outcome)) throw errors[0];

  const found = [], excluded = new Map();
  outcomes.forEach((outcome, index) => {
    const allowed = new Set(batches[index].map(doc => doc.key));
    for (const row of list(outcome?.experiences)) {
      let docs = [...new Set(list(row?.documents).map(String))].filter(key => allowed.has(key));
      const title = text(row?.title, 120);
      if (!docs.length || !title) continue;
      // A document that never names the project (another team's entry to the same contest) is not its source.
      const name = compact(title.split(/\s[—–-]\s/)[0]);
      const named = name.length >= 2 ? docs.filter(key => compact(`${byKey.get(key).path}\n${byKey.get(key).text}`).includes(name)) : [];
      if (named.length) docs = named;
      const primary = docs.includes(String(row.primary)) ? String(row.primary) : docs[0];
      found.push({ key: `N${found.length + 1}`, title, period: text(row.period, 40), summary: text(row.summary, 400),
        core: text(row.core, 400), documents: [primary, ...docs.filter(key => key !== primary)], primary,
        anchors: list(row.anchors).map(anchor => text(anchor, 80)).filter(Boolean).slice(0, 5),
        search: list(row.search).map(word => text(word, 30)).filter(Boolean).slice(0, 8),
        strength: Math.min(5, Math.max(1, Math.round(Number(row.strength) || 1))) });
    }
    for (const row of list(outcome?.excluded)) {
      const key = String(row?.document || '');
      if (allowed.has(key)) excluded.set(key, text(row.reason, 200) || '본인 경험으로 확인되지 않았어요.');
    }
  });

  const knownRows = known.map((row, index) => ({ ...row, key: `K${index + 1}` }));
  let groups = [];
  // One batch is already grouped by the discovery call itself.
  if (found.length && (batches.length > 1 || knownRows.length)) {
    try {
      const rows = found.map(row => ({ ...row, files: row.documents.map(key => byKey.get(key).path) }));
      const outcome = parse(await generate(buildLocalConsolidatePrompt(knownRows, rows), { tier: 'fast', callTimeoutMs: 90000, config: json({ temperature: 0, maxOutputTokens: 2000 }) }));
      groups = sanitizeGroups(outcome?.groups, new Set(knownRows.map(row => row.key)), new Set(found.map(row => row.key)));
    } catch { /* Without a confirmed match every found experience stays separate. */ }
  }

  const ids = keys => keys.map(key => byKey.get(key).id);
  const output = row => ({ title: row.title, period: row.period, summary: row.summary, core: row.core, anchors: row.anchors, search: row.search,
    strength: row.strength, documentIds: ids(row.documents), primaryDocumentId: byKey.get(row.primary).id });
  const grouped = new Set(groups.flat());
  const experiences = [], updates = [];
  for (const group of groups) {
    const merged = combine(group.filter(key => key.startsWith('N')).map(key => found.find(row => row.key === key)));
    const target = knownRows.find(row => group.includes(row.key));
    if (target) updates.push({ id: target.id, documentIds: ids(merged.documents), anchors: merged.anchors });
    else experiences.push(output(merged));
  }
  for (const row of found) if (!grouped.has(row.key)) experiences.push(output(row));
  const usedDocuments = new Set(found.flatMap(row => row.documents));
  return {
    experiences: experiences.sort((a, b) => b.strength - a.strength),
    updates,
    excluded: [...excluded].filter(([key]) => !usedDocuments.has(key)).map(([key, reason]) => ({ documentId: byKey.get(key).id, reason })),
    partial: errors.length > 0,
  };
}

export function sanitizeOrganizeInput(body = {}) {
  const experience = body.experience || {};
  return {
    experience: { title: text(experience.title, 120), summary: text(experience.summary, 400), core: text(experience.core, 400),
      period: text(experience.period, 40), anchors: list(experience.anchors).map(anchor => text(anchor, 80)).filter(Boolean).slice(0, 8) },
    documents: list(body.documents).slice(0, ORGANIZE_LIMITS.documents).map(doc => ({ id: text(doc?.id, 200), path: text(doc?.path, 500), text: text(doc?.text, 120000) }))
      .filter(doc => doc.text),
    images: list(body.images).slice(0, ORGANIZE_LIMITS.images).map(image => ({ id: text(image?.id, 240), path: text(image?.path, 500),
      context: text(image?.context, 300), mimeType: String(image?.mimeType || '').toLowerCase(), data: String(image?.data || '') }))
      .filter(image => image.id && IMAGE_TYPES.has(image.mimeType) && image.data && image.data.length <= ORGANIZE_LIMITS.imageBase64 && /^[A-Za-z0-9+/=]+$/.test(image.data)),
  };
}

const lines = value => (Array.isArray(value) ? value : String(value ?? '').split('\n'))
  .map(row => text(row, 600).replace(/^(?:[-*•·]|\d{1,2}[.)])\s*/, '').trim()).filter(Boolean);

function normalizeStar(outcome = {}) {
  const missing = list(outcome.missing).map(String).filter(field => STAR_FIELDS.includes(field));
  return {
    title: text(outcome.title, 120), period: text(outcome.period, 40), role: text(outcome.role, 300),
    context: text(outcome.situation, 2000), task: text(outcome.task, 1200),
    action: lines(outcome.action).slice(0, 8).map(row => `• ${row}`).join('\n'),
    result: lines(outcome.result).slice(0, 6).map(row => `• ${row}`).join('\n'),
    learning: text(outcome.learning, 1000),
    keywords: list(outcome.keywords).map(keyword => text(keyword, 40)).filter(Boolean).slice(0, 6),
    category: LOCAL_CATEGORIES.includes(outcome.category) ? outcome.category : '기타',
    core: text(outcome.core, 400), missing,
  };
}

const OMITTED = '\n\n…(자료 중간 생략)…\n\n';

// A long document that mentions this experience only in places (a résumé, a portfolio) is cut down
// to those places. A document that is about the experience throughout keeps its head and tail.
function focusText(value, terms, limit) {
  if (value.length <= limit) return value;
  const blocks = [];
  let current = '';
  for (const line of value.split('\n')) {
    current += `${line}\n`;
    if (current.length >= 600) { blocks.push(current); current = ''; }
  }
  if (current) blocks.push(current);
  const hits = blocks.map(block => { const lower = block.toLowerCase(); return terms.some(term => lower.includes(term)); });
  const count = hits.filter(Boolean).length;
  if (!count || count > blocks.length / 2) return clampMaterial(value, limit);
  let focused = '', last = -1;
  blocks.forEach((block, index) => {
    if (index && !hits[index] && !hits[index - 1] && !hits[index - 2]) return;
    focused += (last >= 0 && last !== index - 1 ? OMITTED : '') + block;
    last = index;
  });
  return clampMaterial(focused, limit);
}

function organizeSources(documents, experience) {
  const share = Math.min(ORGANIZE_LIMITS.documentChars, Math.max(4000, Math.floor(ORGANIZE_LIMITS.totalChars / Math.max(1, documents.length))));
  const terms = [...new Set([experience.title.split(/\s[—–-]\s/)[0], ...experience.anchors].map(term => term.trim().toLowerCase()).filter(term => term.length >= 2))];
  return documents.map(doc => ({ ...doc, text: focusText(doc.text, terms, share) }));
}

// One call reads the pictures and writes STAR. When the pictures cannot be read, text alone is used.
export async function organizeLocalExperience({ experience, documents, images = [] }, { generate, parse }) {
  const keyed = images.map((image, index) => ({ ...image, key: `I${index + 1}` }));
  const sources = organizeSources(documents, experience);
  const ask = async pictures => {
    const prompt = buildLocalOrganizePrompt({ ...experience, documents: sources, images: pictures });
    const parts = pictures.flatMap(image => [`${image.key} — 파일: ${image.path}${image.context ? ` · ${image.context}` : ''}`,
      { inlineData: { mimeType: image.mimeType, data: image.data } }]);
    return parse(await generate(pictures.length ? [...parts, prompt] : prompt, pictures.length
      ? { tier: 'vision', retries: 2, callTimeoutMs: 180000, githubFallback: false, config: json({ maxOutputTokens: 8000 }) }
      : { tier: 'standard', callTimeoutMs: 180000, config: json({ maxOutputTokens: 8000 }) }));
  };
  let outcome, imageFailed = false;
  if (keyed.length) {
    try { outcome = await ask(keyed); } catch { imageFailed = true; }
  }
  outcome ||= await ask([]);
  const rows = new Map(list(imageFailed ? [] : outcome?.images).map(row => [String(row?.id), row]));
  const findings = imageFailed ? [] : keyed.map(image => {
    const row = rows.get(image.key);
    if (!row) return { id: image.id, analyzed: false, relevance: 'none' };
    return { id: image.id, analyzed: true,
      kind: LOCAL_IMAGE_KINDS.includes(row.kind) ? row.kind : 'other',
      relevance: ['core', 'supporting', 'none'].includes(row.relevance) ? row.relevance : 'supporting',
      description: text(row.description, 400), text: text(row.text, 400), caption: text(row.caption, 60) };
  });
  const star = normalizeStar(outcome);
  if (![star.context, star.task, star.action, star.result].some(Boolean)) {
    throw Object.assign(new Error('AI returned no experience fields'), { code: 'AI_EMPTY_EXPERIENCES' });
  }
  const unrelated = [...new Set(list(outcome.unrelated).map(key => sources[Number(String(key).replace(/^F/i, '')) - 1]?.path).filter(Boolean))];
  return { experience: star, images: findings, imageFailed, unrelated: unrelated.length < sources.length ? unrelated : [] };
}

const tokens = value => new Set(String(value || '').toLowerCase().match(/[가-힣]{2,}|[a-z][a-z0-9+#.-]{1,}|\d[\d,.]*%?/g) || []);

// Local images were already judged relevant to the experience; place each one beside the key
// experience that shares the most words, or beside the one holding the fewest images.
export function assignLocalImages(keyExperiences = [], images = [], perExperience = 3) {
  const moments = list(keyExperiences).map(moment => [moment?.title, moment?.context, moment?.situation, moment?.action, moment?.result].join(' ').toLowerCase());
  const assigned = {};
  if (!moments.length) return assigned;
  list(images).forEach(image => {
    if (!image?.localImage || !image.url) return;
    const words = tokens([image.caption, image.description, image.text].join(' '));
    const scores = moments.map((moment, index) => ({ index, score: [...words].filter(word => moment.includes(word)).length,
      count: assigned[String(index)]?.length || 0 })).filter(row => row.count < perExperience);
    if (!scores.length) return;
    const best = scores.sort((a, b) => b.score - a.score || a.count - b.count || a.index - b.index)[0];
    (assigned[String(best.index)] ||= []).push({ url: image.url, width: '100%', ...(image.caption ? { caption: image.caption } : {}) });
  });
  return assigned;
}
