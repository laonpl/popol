import { parseExperiencesLocally, isCollectionDocument } from '../../../shared/localExperienceParser.mjs';
import { materialPlainText } from '../../../shared/materialPlainText.mjs';
import { extractLocalStar } from '../../../shared/localExperienceStar.mjs';
import { hasPersonalEvidence, experienceFolder, isExperienceTitle } from '../../../local-connector/experienceEvidence.mjs';
import { assessLocalExperience, localSourceKind, SOURCE_KIND_REASON, consolidateLocalEvidence, rankCoreExperiences, sortLocalExperiences, fuseLocalExperienceFields } from '../../../local-connector/experienceSelection.mjs';

export const LOCAL_FILE_LIMIT = 25 * 1024 * 1024;
export const LOCAL_TEXT_LIMIT = 120000;
export const LOCAL_SELECTION_LIMIT = 30;
const MAX_FILES = 1000;
const MAX_ENTRIES = 10000;
const MAX_BATCH_BYTES = 150 * 1024 * 1024;
const SUPPORTED = /\.(txt|md|csv|pdf|docx|pptx|hwpx)$/i;
const IGNORED_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build', 'coverage', '__pycache__', '$recycle.bin', 'system volume information']);
const RELEVANT = /경험|이력서|포트폴리오|프로젝트|활동|공모전|인턴|보고서|회고|성과|기획|발표|회의록|resume|portfolio|project|report|retrospective/i;
const FOLDER_DOCUMENT_LIMIT = 20;

export const normalizeLocalTitle = title => String(title || '').replace(/\s+/g, '').toLowerCase();
export function automaticFileBatch(files, start = 0) {
  const batch = [];
  let bytes = 0;
  for (const file of files.slice(start, start + LOCAL_SELECTION_LIMIT)) {
    if (bytes + file.size > MAX_BATCH_BYTES) break;
    batch.push(file); bytes += file.size;
  }
  return batch;
}
// Documents of one project folder are read next to each other and later analyzed as one experience.
// Larger folders are treated as collections of different experiences.
export function groupExperienceFolders(files) {
  const rows = files.map(file => ({ file, folder: experienceFolder(file.path) }));
  const folders = new Map();
  for (const row of rows) if (row.folder) { if (!folders.has(row.folder.key)) folders.set(row.folder.key, []); folders.get(row.folder.key).push(row); }
  const ordered = [];
  const placed = new Set();
  for (const row of rows) {
    if (placed.has(row)) continue;
    const siblings = row.folder ? folders.get(row.folder.key) : [];
    const group = siblings.length > 1 && siblings.length <= FOLDER_DOCUMENT_LIMIT ? siblings : [row];
    for (const sibling of group) { placed.add(sibling); ordered.push(group.length > 1 ? { ...sibling.file, experienceFolder: sibling.folder } : sibling.file); }
  }
  return ordered;
}
const aborted = signal => signal?.throwIfAborted();
const ignorePart = name => name.startsWith('.') || IGNORED_DIRS.has(name.toLowerCase());

export function localFileSkipReason(path, size) {
  const parts = path.replace(/\\/g, '/').split('/');
  if (parts.some(ignorePart) || parts.at(-1).startsWith('~$')) return '숨김·시스템·개발 파일';
  if (!SUPPORTED.test(path)) return '지원하지 않는 형식';
  if (size === 0) return '빈 파일';
  if (size > LOCAL_FILE_LIMIT) return '25MB 초과';
  return '';
}

function inventory() {
  return { files: [], skipped: {}, visited: 0, limited: false };
}

function skip(result, reason) {
  result.skipped[reason] = (result.skipped[reason] || 0) + 1;
}

function add(result, file, path, getFile) {
  const reason = localFileSkipReason(path, file.size);
  if (reason) { skip(result, reason); return; }
  result.files.push({ id: path, path, name: file.name, size: file.size, lastModified: file.lastModified,
    recommended: RELEVANT.test(path), getFile });
}

function finish(result) {
  result.files.sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.path.localeCompare(b.path, 'ko'));
  return result;
}

// Only handles and metadata are kept during discovery. Contents are read after selection.
export async function scanLocalDirectory(handle, { signal, onProgress = () => {} } = {}) {
  const result = inventory();
  async function walk(dir, prefix, depth) {
    if (depth > 32) { result.limited = true; return; }
    for await (const entry of dir.values()) {
      aborted(signal);
      if (result.files.length >= MAX_FILES || result.visited >= MAX_ENTRIES) { result.limited = true; return; }
      result.visited += 1;
      const path = `${prefix}/${entry.name}`;
      if (entry.kind === 'directory') {
        if (ignorePart(entry.name)) skip(result, '숨김·시스템·개발 폴더');
        else {
          try { await walk(entry, path, depth + 1); }
          catch (error) { if (signal?.aborted) throw error; skip(result, '읽기 권한 없는 폴더'); }
        }
      } else if (!SUPPORTED.test(entry.name) || ignorePart(entry.name)) {
        skip(result, localFileSkipReason(path, 1) || '지원하지 않는 형식');
      } else {
        try { add(result, await entry.getFile(), path, () => entry.getFile()); }
        catch { skip(result, '읽을 수 없는 파일'); }
      }
      if (result.visited % 50 === 0) { onProgress(result.visited); await new Promise(resolve => setTimeout(resolve, 0)); }
    }
  }
  await walk(handle, handle.name, 0);
  return finish(result);
}

// webkitdirectory is a local FileList fallback; no form or upload request is used.
export async function scanLocalFileList(files, { signal, onProgress = () => {} } = {}) {
  const result = inventory();
  for (const file of files) {
    aborted(signal);
    if (result.files.length >= MAX_FILES || result.visited >= MAX_ENTRIES) { result.limited = true; break; }
    result.visited += 1;
    add(result, file, file.webkitRelativePath || file.name, () => Promise.resolve(file));
    if (result.visited % 50 === 0) { onProgress(result.visited); await new Promise(resolve => setTimeout(resolve, 0)); }
  }
  return finish(result);
}

export function decodeLocalText(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('euc-kr').decode(bytes); }
}

export function xmlDocumentText(xml, paragraphTag, textTag) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('문서 구조를 읽을 수 없어요.');
  return [...doc.getElementsByTagNameNS('*', paragraphTag)].map(p =>
    [...p.getElementsByTagNameNS('*', textTag)].map(t => t.textContent).join('')
  ).join('\n');
}

// PDF fonts may expose one glyph per item. Insert spaces only for real layout gaps.
export function pdfItemsToText(items) {
  let text = '';
  let previous = null;
  for (const item of items) {
    if (!('str' in item)) continue;
    const x = item.transform?.[4] || 0;
    const y = item.transform?.[5] || 0;
    if (previous) {
      if (Math.abs(y - previous.y) > 3) { if (!text.endsWith('\n')) text += '\n'; }
      else if (x - previous.end > Math.max(1, (item.height || 12) * 0.15) && !/\s$/.test(text) && !/^\s/.test(item.str)) text += ' ';
    }
    text += item.str;
    if (item.hasEOL) text += '\n';
    previous = item.hasEOL ? null : { y, end: x + (item.width || 0) };
  }
  return text;
}

async function extractZipText(buffer, extension, signal) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const pattern = extension === 'docx' ? /^word\/document\.xml$/
    : extension === 'pptx' ? /^ppt\/slides\/slide\d+\.xml$/ : /^Contents\/section\d+\.xml$/i;
  const entries = Object.values(zip.files).filter(entry => pattern.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  if (!entries.length) throw new Error('문서 본문을 찾지 못했어요.');
  let text = '';
  let xmlBytes = 0;
  for (const entry of entries) {
    aborted(signal);
    // Bound expanded XML as well as the compressed file size.
    if (entry._data?.uncompressedSize > 10 * 1024 * 1024) throw new Error('압축된 문서 본문이 너무 커요.');
    const xml = await entry.async('string');
    xmlBytes += xml.length;
    if (xmlBytes > 20 * 1024 * 1024) throw new Error('문서 본문이 너무 커요.');
    text += `${xmlDocumentText(xml, 'p', 't')}\n`;
    if (text.length > LOCAL_TEXT_LIMIT) throw new Error('본문이 12만 자를 넘어요. 문서를 나누어주세요.');
  }
  return text;
}

async function extractPdfText(buffer, signal) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: buffer, isEvalSupported: false });
  const cancel = () => { void task.destroy(); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const doc = await task.promise;
    if (doc.numPages > 200) throw new Error('200쪽이 넘는 PDF는 나누어주세요.');
    let text = '';
    for (let number = 1; number <= doc.numPages; number += 1) {
      aborted(signal);
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      text += `${pdfItemsToText(content.items)}\n`;
      page.cleanup();
      if (text.length > LOCAL_TEXT_LIMIT) throw new Error('본문이 12만 자를 넘어요. 문서를 나누어주세요.');
    }
    return text;
  } finally {
    signal?.removeEventListener('abort', cancel);
    await task.destroy();
  }
}

export async function readLocalExperienceFile(record, { signal } = {}) {
  aborted(signal);
  const file = await record.getFile({ signal });
  const reason = localFileSkipReason(record.path, file.size);
  if (reason) throw new Error(reason);
  const extension = file.name.split('.').pop().toLowerCase();
  const buffer = await file.arrayBuffer();
  aborted(signal);
  const text = extension === 'pdf' ? await extractPdfText(buffer, signal)
    : ['docx', 'pptx', 'hwpx'].includes(extension) ? await extractZipText(buffer, extension, signal)
      : decodeLocalText(buffer);
  if (text.length > LOCAL_TEXT_LIMIT) throw new Error('본문이 12만 자를 넘어요. 문서를 나누어주세요.');
  if (text.replace(/\s/g, '').length < 20) throw new Error('읽을 수 있는 본문이 부족해요. 스캔 PDF·이미지는 기존 파일 가져오기를 이용해주세요.');
  return materialPlainText(text);
}

export function looksLikeExperience(text) {
  return parseExperiencesLocally(materialPlainText(text), '', { personalDocument: true }).experiences.some(item => assessLocalExperience(extractLocalStar(item)).eligible);
}

export async function organizeLocalFiles(records, { signal, onProgress = () => {}, read = readLocalExperienceFile, experienceOnly = false } = {}) {
  if (!records.length || records.length > LOCAL_SELECTION_LIMIT) throw new Error('한 번에 1~30개 파일을 선택해주세요.');
  if (records.reduce((total, file) => total + file.size, 0) > MAX_BATCH_BYTES) throw new Error('선택한 파일의 합계는 150MB 이하여야 해요.');
  const items = [];
  const failures = [];
  const rejected = [];
  const seen = new Set();
  for (const [index, record] of records.entries()) {
    aborted(signal);
    onProgress({ current: index + 1, total: records.length, path: record.path });
    try {
      const text = materialPlainText(await read(record, { signal }));
      aborted(signal);
      const kind = localSourceKind(record.name, record.path, text);
      if (experienceOnly && kind !== 'experience') { rejected.push({ path: record.path, reason: SOURCE_KIND_REASON[kind] }); continue; }
      // Only resumes, portfolios and cover letters are split; a project document is one experience.
      const single = !isCollectionDocument(record.name, text);
      const parsed = parseExperiencesLocally(text, record.name.replace(/\.[^.]+$/, ''), { personalDocument: true, single });
      const personalSource = /이력서|자소서|자기소개서|경력기술서|경험\s*정리|포트폴리오|resume|portfolio|cover.?letter/i.test(record.name) || hasPersonalEvidence(text);
      if (!parsed.experiences.length) {
        if (experienceOnly) { rejected.push({ path: record.path, reason: '프로젝트·활동 경험의 본문을 확인하지 못했어요.' }); continue; }
        throw new Error('경험으로 정리할 본문을 찾지 못했어요.');
      }
      for (const [part, parsedItem] of parsed.experiences.entries()) {
        // Multi-experience documents (resumes, cover letters) never join a folder or file-name series group.
        const whole = parsed.experiences.length === 1;
        const folder = whole ? { wholeDocument: true, ...(record.experienceFolder ? { experienceFolder: record.experienceFolder } : {}) } : {};
        const item = extractLocalStar({ ...parsedItem, personalSource, ...folder });
        const quality = assessLocalExperience(item, record);
        const sourceText = item.sourceText || text;
        // Identical copies are one candidate with all their relative source paths.
        const key = sourceText.replace(/\s+/g, ' ').trim();
        if (seen.has(key)) {
          const duplicate = items.find(candidate => candidate.sourceText.replace(/\s+/g, ' ').trim() === key);
          if (duplicate && !duplicate.sourcePaths.includes(record.path)) {
            duplicate.sourcePaths.push(record.path);
            duplicate.localDocuments.push({ path: record.path, text: sourceText });
          }
          continue;
        }
        seen.add(key);
        items.push({ ...item,
          ...(experienceOnly ? { coreSelection: quality } : {}),
          id: `${record.id}:${part}`, sourceText, sourcePaths: [record.path], localEdits: {},
          localDocuments: [{ path: record.path, text: sourceText }],
          period: item.startDate ? `${item.startDate}${item.ongoing ? ' ~ 현재' : item.endDate ? ` ~ ${item.endDate}` : ''}` : '',
          needsReview: !parsed.confident || quality.needsReview });
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      failures.push({ path: record.path, message: error.message || '파일을 읽지 못했어요.' });
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const grouped = consolidateLocalEvidence(items);
  // Explicitly chosen files use the same grouping rules while retaining incomplete candidates.
  if (!experienceOnly) return { items: sortLocalExperiences(grouped), failures, rejected, supporting: [] };
  const supporting = grouped.filter(item => !item.coreSelection.eligible);
  rejected.push(...supporting.map(item => ({ path: item.sourcePaths[0], title: item.title, reason: item.coreSelection.reasons.join(' ') })));
  return { items: rankCoreExperiences(grouped, { consolidated: true }), supporting, failures, rejected };
}

// Continue past irrelevant first-page documents, with bounded file reading and no paid calls.
export async function findCoreLocalExperiences(scanned, { offset = 0, previous = [], supporting: previousSupporting = [], signal, onProgress = () => {}, read,
  maxDocuments = 240 } = {}) {
  const files = groupExperienceFolders(scanned);
  let current = offset;
  let items = rankCoreExperiences(previous);
  let supporting = previousSupporting;
  const failures = [], rejected = [];
  while (current < files.length && current - offset < maxDocuments) {
    aborted(signal);
    const batch = automaticFileBatch(files, current).slice(0, maxDocuments - (current - offset));
    if (!batch.length) break;
    const parsed = await organizeLocalFiles(batch, { signal, experienceOnly: true, ...(read ? { read } : {}),
      onProgress: progress => onProgress({ ...progress, checked: current + progress.current, totalDocuments: files.length }),
    });
    const combined = consolidateLocalEvidence([...items, ...supporting, ...parsed.items, ...parsed.supporting]);
    items = rankCoreExperiences(combined, { consolidated: true });
    supporting = combined.filter(item => !item.coreSelection.eligible);
    failures.push(...parsed.failures); rejected.push(...parsed.rejected);
    current += batch.length;
  }
  const selectedPaths = new Set(items.flatMap(item => item.sourcePaths));
  return { items, supporting, failures, rejected: rejected.filter(item => !selectedPaths.has(item.path)), offset: current };
}

const sourceKey = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const leafParts = item => item.localParts?.length ? item.localParts.flatMap(leafParts) : [item];
const sourceDocuments = item => item.localDocuments?.length ? item.localDocuments
  : (item.sourcePaths || []).map(path => ({ path, text: item.sourceText || '' }));
const documentKey = document => `${String(document.path || '').replace(/\\/g, '/').toLowerCase()}\n${sourceKey(document.text)}`;
function uniqueDocuments(items) {
  const seen = new Set();
  return items.flatMap(sourceDocuments).filter(document => {
    const key = documentKey(document);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
function identityKeys(item) {
  const keys = new Set();
  for (const part of [item, ...leafParts(item)]) if (part.id) keys.add(`id:${part.id}`);
  for (const document of sourceDocuments(item)) if (sourceKey(document.text)) keys.add(`doc:${documentKey(document)}`);
  return keys;
}

// A group's representative ID can change when more files arrive. Match the source
// excerpts, not the file path alone: two portfolio entries share a path.
export function reconcileLocalCandidates(previous, fresh, { selectedItems = [], records = {}, supporting = [] } = {}) {
  const selected = new Set(selectedItems);
  const fields = ['title', 'period', 'role', 'context', 'task', 'action', 'result', 'learning'];
  // Preserve a review already open before edit tracking was introduced. New scans
  // start with an empty map, so untouched fields continue to receive new evidence.
  const reviewedChanges = new Map(previous.map(item => [item, item.localEdits || Object.fromEntries(fields
    .filter(field => Object.hasOwn(item, field) && (field !== 'title' || isExperienceTitle(item.title)))
    .map(field => [field, item[field]]))]));
  const previousKeys = new Map(previous.map(item => [item, identityKeys(item)]));
  const keyCache = new WeakMap();
  const score = (item, old) => {
    if (!keyCache.has(item)) keyCache.set(item, identityKeys(item));
    const keys = keyCache.get(item), oldKeys = previousKeys.get(old);
    return (old.id && keys.has(`id:${old.id}`) ? 1000 : 0)
      + [...keys].reduce((sum, key) => sum + (oldKeys.has(key) ? key.startsWith('id:') ? 100 : 1 : 0), 0);
  };
  let candidates = [...fresh, ...supporting.filter(item => previous.some(old => score(item, old) > 0))];
  // An explicit manual merge remains one card when the automatic pass rechecks its leaves.
  for (const old of previous.filter(item => item.manualFusion)) {
    const matching = candidates.filter(item => score(item, old) > 0);
    if (matching.length > 1) {
      candidates = [...candidates.filter(item => !matching.includes(item)), mergeLocalCandidates(matching)];
    }
  }
  const owners = new Map();
  for (const old of previous) {
    let best = -1, bestScore = 0;
    candidates.forEach((item, index) => { const value = score(item, old); if (value > bestScore) { best = index; bestScore = value; } });
    if (best >= 0) owners.set(old, best);
  }
  const nextSelected = new Set(), preservedIds = new Set(), usedIds = new Set();
  const priority = item => records[item.id]?.status === 'complete' ? 0 : records[item.id] ? 1 : Object.keys(reviewedChanges.get(item)).length ? 2 : selected.has(item.id) ? 3 : 4;
  const next = candidates.map((item, index) => {
    const matched = previous.filter(old => owners.get(old) === index).sort((a, b) => priority(a) - priority(b));
    const representative = matched.find(old => !usedIds.has(old.id));
    const id = representative?.id || item.id;
    usedIds.add(id);
    const localEdits = {};
    const addition = leafParts(item).filter(part => !matched.some(old => score(part, old) > 0));
    const reviewed = {};
    for (const field of fields) {
      const edited = matched.filter(old => Object.hasOwn(reviewedChanges.get(old), field));
      if (!edited.length) continue;
      const value = field === 'title' || field === 'period' ? reviewedChanges.get(edited[0])[field]
        : fuseLocalExperienceFields([...matched.map(old => ({ [field]: reviewedChanges.get(old)?.[field] ?? old[field] })), ...addition])[field];
      reviewed[field] = value; localEdits[field] = value;
    }
    if (matched.some(old => selected.has(old.id)) && records[id]?.status !== 'complete') nextSelected.add(id);
    if (matched.some(old => selected.has(old.id) || records[old.id] || Object.keys(reviewedChanges.get(old)).length)) preservedIds.add(id);
    const savedPrevious = matched.find(old => old.id === id && records[old.id]);
    const savedSources = savedPrevious && new Set(sourceDocuments(savedPrevious).map(documentKey));
    const hasNewLocalSources = Boolean(savedPrevious && (savedPrevious.hasNewLocalSources
      || sourceDocuments(item).some(document => !savedSources.has(documentKey(document)))));
    const combined = { ...item, ...reviewed, id, localEdits, hasNewLocalSources, manualFusion: Boolean(item.manualFusion || matched.some(old => old.manualFusion)) };
    return { ...combined, sourcePaths: [...new Set(combined.sourcePaths || [])], localDocuments: uniqueDocuments([combined]),
      ...(Object.hasOwn(reviewed, 'title') ? { needsTitleReview: !isExperienceTitle(reviewed.title) } : {}),
      situation: combined.context || '', star: { situation: combined.context || '', task: combined.task || '', action: combined.action || '', result: combined.result || '' } };
  });
  for (const old of previous) if (!owners.has(old) && (selected.has(old.id) || records[old.id] || old.separateExperience || Object.keys(reviewedChanges.get(old)).length)) {
    next.push(old); preservedIds.add(old.id);
    if (selected.has(old.id) && records[old.id]?.status !== 'complete') nextSelected.add(old.id);
  }
  return { items: sortLocalExperiences(next), selectedItems: nextSelected, records: { ...records }, preservedIds };
}

export function mergeLocalCandidates(items) {
  const first = items[0];
  const fields = fuseLocalExperienceFields(items);
  const parts = [...new Map(items.flatMap(leafParts).map(part => [`${part.id || ''}\n${(part.sourcePaths || []).join('|')}\n${sourceKey(part.sourceText)}`, part])).values()];
  const sourceTexts = [...new Map(parts.filter(part => part.sourceText).map(part => [sourceKey(part.sourceText), part.sourceText])).values()];
  const merged = { ...first, ...fields, situation: fields.context, sourceText: sourceTexts.join('\n\n'),
    sourcePaths: [...new Set(items.flatMap(item => item.sourcePaths || []))],
    localDocuments: uniqueDocuments(items), localParts: parts, manualFusion: true, separateExperience: false,
    mergeReasons: [...new Set([...items.flatMap(item => item.mergeReasons || []), '직접 선택한 후보를 하나의 경험으로 합쳤어요.'])],
    localEdits: Object.fromEntries(['title', 'period', 'role', 'context', 'task', 'action', 'result', 'learning']
      .filter(field => field === 'title' || items.some(item => Object.hasOwn(item.localEdits || {}, field)))
      .map(field => [field, field === 'title' || field === 'period' ? first[field] : fields[field]])),
    keywords: [...new Set(items.flatMap(item => item.keywords || []))].slice(0, 6), needsReview: true };
  merged.star = { situation: fields.context, task: fields.task, action: fields.action, result: fields.result };
  return sortLocalExperiences([merged])[0];
}

export function splitLocalCandidate(item) {
  return sortLocalExperiences(leafParts(item).map((part, index) => ({ ...part,
    id: part.id || `${item.id}:split:${index}`, localParts: [], mergeReasons: [], separateExperience: true,
    manualFusion: false,
    needsReview: true, coreSelection: assessLocalExperience(part) })));
}
