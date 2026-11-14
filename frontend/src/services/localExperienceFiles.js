import { materialPlainText } from '../../../shared/materialPlainText.mjs';
import { experienceFolder } from '../../../local-connector/experienceEvidence.mjs';

export const LOCAL_FILE_LIMIT = 25 * 1024 * 1024;
export const LOCAL_TEXT_LIMIT = 120000;
export const LOCAL_SELECTION_LIMIT = 30;
export const LOCAL_IMAGES_PER_DOCUMENT = 8;
const MAX_FILES = 1000;
const MAX_ENTRIES = 10000;
const SUPPORTED = /\.(txt|md|csv|pdf|docx|pptx|hwpx)$/i;
const IGNORED_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build', 'coverage', '__pycache__', '$recycle.bin', 'system volume information']);
const RELEVANT = /경험|이력서|포트폴리오|프로젝트|활동|공모전|인턴|보고서|회고|성과|기획|발표|회의록|resume|portfolio|project|report|retrospective/i;
const FOLDER_DOCUMENT_LIMIT = 20;

export const normalizeLocalTitle = title => String(title || '').replace(/\s+/g, '').toLowerCase();

// Detailed project material comes before résumé summaries; extra copies of one file go last.
const PROJECT_DOCUMENT = /기획|보고서|발표|회고|결과|제안|계획|프로젝트|포트폴리오|공모전|해커톤|인턴|활동|연구|캠페인|회의록|report|proposal|presentation|project|retrospective|portfolio|campaign/i;
const SUMMARY_DOCUMENT = /이력서|자소서|자기\s*소개서|경력\s*기술서|resume|(?:^|[^a-z])cv(?:[^a-z]|$)|cover.?letter/i;
const REFERENCE_DOCUMENT = /강의|교재|수업\s*자료|lecture|syllabus|양식|템플릿|template|sample|예시|readme|license|changelog|대본|script/i;
const COPY_SUFFIX = /(?:\s*\(\d+\)|\s*-?\s*복사본(?:\s*\(\d+\))?|\s+copy(?:\s*\d+)?)(?=\.[^.]+$)/i;
const fileFamily = file => `${file.path.replace(/[^/]*$/, '')}${file.name.replace(COPY_SUFFIX, '')}`.toLowerCase();

export function localFilePriority(file, now = Date.now()) {
  let score = 0;
  if (PROJECT_DOCUMENT.test(file.path)) score += 10;
  if (SUMMARY_DOCUMENT.test(file.name)) score += 4;
  if (/\.(pptx|pdf|docx|hwpx)$/i.test(file.name)) score += 3;
  if (now - (file.lastModified || 0) < 2 * 365 * 86400000) score += 2;
  if (REFERENCE_DOCUMENT.test(file.name)) score -= 20;
  return score;
}

export function prioritizeLocalFiles(files, now = Date.now()) {
  const newest = new Map();
  for (const file of files) {
    const family = fileFamily(file);
    if (!newest.has(family) || (file.lastModified || 0) > (newest.get(family).lastModified || 0)) newest.set(family, file);
  }
  const ranked = files.map((file, index) => ({ file, index, score: localFilePriority(file, now) - (newest.get(fileFamily(file)) === file ? 0 : 30) }))
    .sort((a, b) => b.score - a.score || (b.file.lastModified || 0) - (a.file.lastModified || 0) || a.index - b.index);
  // Alternate physical drives so one large drive cannot fill every reading round.
  const drives = new Map();
  for (const row of ranked) { const drive = row.file.drive || ''; if (!drives.has(drive)) drives.set(drive, []); drives.get(drive).push(row.file); }
  const ordered = [];
  for (let index = 0; ordered.length < files.length; index += 1) for (const group of drives.values()) if (group[index]) ordered.push(group[index]);
  return ordered;
}

// Documents of one project folder are read next to each other so AI sees them in one batch.
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

// Numbered reports of one project (1회차 … 7회차, week 1 … week 8) are one series. The newest
// stands for the series when AI looks for experiences; the others join it as sources.
const SERIES_NUMBER = /\d+\s*(?:회차|주차|차시|차|회|주)|(?:week|wk|vol|part|ep)[\s._-]*\d+/i;
const SERIES_MEMBERS = 8;
const seriesKey = file => SERIES_NUMBER.test(file.name) ? `${file.path.replace(/[^/]*$/, '')}${file.name.replace(/\d+/g, '#')}`.toLowerCase() : '';

export function collapseSeries(files) {
  const groups = new Map();
  for (const file of files) { const key = seriesKey(file); if (key) groups.set(key, [...(groups.get(key) || []), file]); }
  const placed = new Set();
  return files.flatMap(file => {
    const key = seriesKey(file);
    if (!key || groups.get(key).length < 2) return [file];
    if (placed.has(key)) return [];
    placed.add(key);
    const [lead, ...series] = [...groups.get(key)].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0)).slice(0, SERIES_MEMBERS);
    return [{ ...lead, series }];
  });
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

const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };
const MEDIA_FOLDER = { docx: /^word\/media\//i, pptx: /^ppt\/media\//i, hwpx: /^BinData\//i };
const extensionOf = name => name.split('.').pop().toLowerCase();
const context = (label, text) => `${label}: ${String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200)}`;

// A 16×16 brightness thumbnail. The same picture saved in two files, or twice in one deck, gives
// nearly the same thumbnail; different slides and different poses of one mascot do not.
function imageLook(canvas) {
  const small = document.createElement('canvas');
  small.width = 16; small.height = 16;
  const draw = small.getContext('2d', { willReadFrequently: true });
  draw.drawImage(canvas, 0, 0, 16, 16);
  const { data } = draw.getImageData(0, 0, 16, 16);
  return Array.from({ length: 256 }, (_, index) => Math.round(data[index * 4] * 0.299 + data[index * 4 + 1] * 0.587 + data[index * 4 + 2] * 0.114));
}

export const sameLook = (a, b) => Boolean(a && b) && a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) / a.length <= 3;

async function canvasJpeg(canvas) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  return blob ? { blob, width: canvas.width, height: canvas.height, look: imageLook(canvas) } : null;
}

// Browser only: logos, icons and thin banners are dropped; the rest is re-encoded at a
// bounded size so AI requests and saved photos stay small.
async function prepareLocalImage(blob, maxSide = 1024) {
  let bitmap;
  try { bitmap = await createImageBitmap(blob); } catch { return null; }
  try {
    const { width, height } = bitmap;
    const ratio = width / height;
    if (Math.min(width, height) < 160 || width * height < 160 * 240 || ratio > 5 || ratio < 0.2) return null;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    const draw = canvas.getContext('2d');
    draw.fillStyle = '#fff'; draw.fillRect(0, 0, canvas.width, canvas.height);
    draw.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await canvasJpeg(canvas);
  } finally { bitmap.close?.(); }
}

// Map each slide picture to the slide whose text explains it.
async function pptxImageSlides(zip, slideTexts) {
  const slides = new Map();
  const rels = Object.values(zip.files).filter(entry => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  for (const entry of rels) {
    const number = Number(entry.name.match(/slide(\d+)\.xml\.rels$/)[1]);
    for (const match of (await entry.async('string')).matchAll(/Target="\.\.\/media\/([^"]+)"/g)) {
      const media = `ppt/media/${match[1]}`;
      if (!slides.has(media)) slides.set(media, { number, text: slideTexts.get(number) || '' });
    }
  }
  return slides;
}

async function zipImages(zip, extension, slideTexts, signal) {
  const slides = extension === 'pptx' ? await pptxImageSlides(zip, slideTexts) : new Map();
  const entries = Object.values(zip.files).filter(entry => !entry.dir && MEDIA_FOLDER[extension].test(entry.name) && IMAGE_TYPES[extensionOf(entry.name)])
    .sort((a, b) => (slides.get(a.name)?.number ?? 1e6) - (slides.get(b.name)?.number ?? 1e6) || a.name.localeCompare(b.name, 'en', { numeric: true }));
  // One picture from every slide before a second picture from any slide.
  const perSlide = new Map();
  const turn = new Map(entries.map(entry => { const slide = slides.get(entry.name)?.number ?? entry.name; const count = perSlide.get(slide) || 0; perSlide.set(slide, count + 1); return [entry, count]; }));
  entries.sort((a, b) => turn.get(a) - turn.get(b));
  const images = [], seen = new Set();
  for (const entry of entries.slice(0, 40)) {
    if (images.length >= LOCAL_IMAGES_PER_DOCUMENT) break;
    aborted(signal);
    const size = entry._data?.uncompressedSize;
    // Flat charts compress to a few KB; icons are dropped by their pixel size instead.
    if (size !== undefined && (size < 1024 || size > 15 * 1024 * 1024)) continue;
    const bytes = await entry.async('uint8array');
    const key = `${bytes.length}:${Array.from({ length: 16 }, (_, i) => bytes[Math.floor(i * bytes.length / 16)]).join('.')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const prepared = await prepareLocalImage(new Blob([bytes], { type: IMAGE_TYPES[extensionOf(entry.name)] }));
    const slide = slides.get(entry.name);
    if (prepared && !images.some(kept => sameLook(kept.look, prepared.look))) images.push({ ...prepared, context: slide ? context(`슬라이드 ${slide.number}`, slide.text) : '' });
  }
  return images;
}

async function extractZipDocument(buffer, extension, signal, pictures = true) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const pattern = extension === 'docx' ? /^word\/document\.xml$/
    : extension === 'pptx' ? /^ppt\/slides\/slide\d+\.xml$/ : /^Contents\/section\d+\.xml$/i;
  const entries = Object.values(zip.files).filter(entry => pattern.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  if (!entries.length) throw new Error('문서 본문을 찾지 못했어요.');
  let text = '';
  let xmlBytes = 0;
  const slideTexts = new Map();
  for (const entry of entries) {
    aborted(signal);
    // Bound expanded XML as well as the compressed file size.
    if (entry._data?.uncompressedSize > 10 * 1024 * 1024) throw new Error('압축된 문서 본문이 너무 커요.');
    const xml = await entry.async('string');
    xmlBytes += xml.length;
    if (xmlBytes > 20 * 1024 * 1024) throw new Error('문서 본문이 너무 커요.');
    const part = xmlDocumentText(xml, 'p', 't');
    if (extension === 'pptx') slideTexts.set(Number(entry.name.match(/slide(\d+)\.xml$/)[1]), part);
    text += `${part}\n`;
    if (text.length > LOCAL_TEXT_LIMIT) throw new Error('본문이 12만 자를 넘어요. 문서를 나누어주세요.');
  }
  return { text, images: pictures ? await zipImages(zip, extension, slideTexts, signal) : [] };
}

async function extractPdfDocument(buffer, signal, withPictures = true) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: buffer, isEvalSupported: false });
  const cancel = () => { void task.destroy(); };
  signal?.addEventListener('abort', cancel, { once: true });
  const pictures = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageXObjectRepeat]);
  try {
    const doc = await task.promise;
    if (doc.numPages > 200) throw new Error('200쪽이 넘는 PDF는 나누어주세요.');
    let text = '';
    const imagePages = [];
    for (let number = 1; number <= doc.numPages; number += 1) {
      aborted(signal);
      const page = await doc.getPage(number);
      const pageText = pdfItemsToText((await page.getTextContent()).items);
      text += `${pageText}\n`;
      // Pages that carry pictures are rendered whole: designed portfolio pages lose meaning when cropped.
      if (withPictures && imagePages.length < LOCAL_IMAGES_PER_DOCUMENT && number <= 60
        && (await page.getOperatorList()).fnArray.some(fn => pictures.has(fn))) imagePages.push({ number, text: pageText });
      page.cleanup();
      if (text.length > LOCAL_TEXT_LIMIT) throw new Error('본문이 12만 자를 넘어요. 문서를 나누어주세요.');
    }
    const images = [];
    for (const { number, text: pageText } of imagePages) {
      aborted(signal);
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1024 / Math.max(base.width, base.height)) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const prepared = await canvasJpeg(canvas);
      if (prepared) images.push({ ...prepared, context: context(`${number}쪽`, pageText) });
      page.cleanup();
    }
    return { text, images };
  } finally {
    signal?.removeEventListener('abort', cancel);
    await task.destroy();
  }
}

// Text and embedded pictures stay in this browser until the user starts AI analysis.
export async function readLocalDocument(record, { signal } = {}) {
  aborted(signal);
  const file = await record.getFile({ signal });
  const reason = localFileSkipReason(record.path, file.size);
  if (reason) throw new Error(reason);
  const extension = extensionOf(file.name);
  const buffer = await file.arrayBuffer();
  aborted(signal);
  // A résumé or cover letter is read for its text; a picture of its page shows no work of the experience.
  const pictures = !SUMMARY_DOCUMENT.test(file.name);
  const document = extension === 'pdf' ? await extractPdfDocument(buffer, signal, pictures)
    : ['docx', 'pptx', 'hwpx'].includes(extension) ? await extractZipDocument(buffer, extension, signal, pictures)
      : { text: decodeLocalText(buffer), images: [] };
  if (document.text.length > LOCAL_TEXT_LIMIT) throw new Error('본문이 12만 자를 넘어요. 문서를 나누어주세요.');
  if (document.text.replace(/\s/g, '').length < 20) throw new Error('읽을 수 있는 본문이 부족해요. 스캔 PDF·이미지는 기존 파일 가져오기를 이용해주세요.');
  return { text: materialPlainText(document.text),
    images: document.images.map((image, index) => ({ ...image, id: `${record.id}#${index + 1}`, documentId: record.id, path: record.path })) };
}
