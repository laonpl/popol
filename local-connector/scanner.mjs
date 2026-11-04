import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { localSourceKind } from './experienceSelection.mjs';

const DOCUMENT = /\.(txt|md|csv|pdf|docx|pptx|hwpx)$/i;
const EXCLUDED = new Set(['appdata', 'application data', 'local settings', 'windows', 'program files', 'program files (x86)', 'programdata', 'recovery', 'system volume information', '$recycle.bin', '$windows.~bt', 'perflogs', 'node_modules', 'vendor', 'dist', 'build', 'coverage', '__pycache__', 'venv', 'env', 'library', 'applications', 'cache', 'caches', 'temp', 'tmp']);
const PRIVATE_FILE = /^(?:credentials?|passwords?|secrets?|tokens?|id_rsa|id_ed25519)(?:[._-]|$)/i;
const MAX_SIZE = 25 * 1024 * 1024;
const excludedName = name => name.startsWith('.') || name.startsWith('$') || EXCLUDED.has(name.toLowerCase());
export const within = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

export function experienceFileScore(name, relativePath, modifiedAt, now = Date.now()) {
  let score = 0;
  if (/경험|이력서|포트폴리오|회고|성과|공모전|인턴|resume|portfolio|retrospective/i.test(name)) score += 12;
  if (/프로젝트|보고서|활동|기획|발표|연구|캠페인|회의록|project|report|campaign/i.test(name)) score += 7;
  if (/경험|포트폴리오|공모전|인턴|프로젝트|활동|과제|연구|project|portfolio/i.test(relativePath)) score += 4;
  if (/\.(pdf|docx|pptx|hwpx)$/i.test(name)) score += 2;
  if (now - modifiedAt < 365 * 86400000) score += 2;
  if (/^(readme|changelog|license|contributing|package|requirements)(?:\.|$)/i.test(name)) score -= 12;
  if (localSourceKind(name, relativePath) !== 'experience') score -= 35;
  return score;
}

async function windowsScanLocations() {
  const command = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $f=Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders' -ErrorAction SilentlyContinue; [pscustomobject]@{folders=@(@{kind='desktop';path=$f.Desktop},@{kind='documents';path=$f.Personal},@{kind='downloads';path=$f.'{374DE290-123F-4565-9164-39C4925E467B}'} | Where-Object {$_.path} | ForEach-Object {[pscustomobject]@{kind=$_.kind;path=[Environment]::ExpandEnvironmentVariables($_.path)}});drives=@([System.IO.DriveInfo]::GetDrives() | Where-Object {$_.IsReady -and $_.DriveType -eq 'Fixed'} | ForEach-Object {$_.Name})} | ConvertTo-Json -Depth 4 -Compress`;
  const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, timeout: 10000, maxBuffer: 32768 });
  return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
}

// Explicit personal locations remain targets even if a parent directory cannot be inspected.
export async function defaultRoots({ home = os.homedir(), environment = process.env, platform = process.platform, discoverWindows = windowsScanLocations } = {}) {
  const candidates = [];
  let locations = {};
  if (platform === 'win32') {
    try { locations = await discoverWindows(); } catch { /* Personal locations and the system drive still work. */ }
    for (const [kind, folder, label] of [['desktop', 'Desktop', '바탕화면'], ['documents', 'Documents', '문서'], ['downloads', 'Downloads', '다운로드']]) {
      candidates.push({ path: locations.folders?.find(row => row.kind === kind && row.path)?.path || path.join(home, folder), label });
    }
  }
  candidates.push({ path: home, label: '내 파일' });
  for (const key of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) {
    if (environment[key] && !within(home, path.resolve(environment[key]))) candidates.push({ path: environment[key], label: 'OneDrive' });
  }
  if (platform === 'win32') {
    const systemRoot = `${environment.SystemDrive || path.win32.parse(home).root.slice(0, 2)}\\`;
    for (const drive of [systemRoot, ...(locations.drives || [])].filter(Boolean)) candidates.push({ path: drive.trim(), label: `${drive.trim().slice(0, 2).toUpperCase()} 드라이브`, drive: true });
  }
  const seen = new Set();
  const roots = [];
  for (const candidate of candidates) {
    let resolved;
    try { resolved = await fs.realpath(candidate.path); } catch { resolved = path.resolve(candidate.path); }
    const key = platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    const driveCode = resolved.match(/^[a-z]:/i)?.[0].toUpperCase() || '';
    seen.add(key); roots.push({ ...candidate, path: resolved, driveCode, label: driveCode && !candidate.drive ? `${candidate.label} (${driveCode})` : candidate.label });
  }
  return roots;
}

export async function scanExperienceFiles(roots, { signal, onProgress = () => {}, maxEntries = 250000, maxFiles = 10000, maxDepth = 40 } = {}) {
  const result = { files: [], visited: 0, skipped: {}, limited: false, roots: roots.map(root => root.label),
    rootStats: roots.map(root => ({ label: root.label, drive: root.driveCode || '', state: 'pending', visited: 0, found: 0, inaccessible: 0, limited: false })) };
  const skip = reason => { result.skipped[reason] = (result.skipped[reason] || 0) + 1; };
  const visitedDirectories = new Set();
  const seenFiles = new Set();
  const now = Date.now();
  async function* walk(directory, root, depth, stat, boundary) {
    signal?.throwIfAborted();
    if (result.visited >= maxEntries || result.files.length >= maxFiles) { result.limited = stat.limited = true; return; }
    if (depth > maxDepth) { result.limited = stat.limited = true; skip('탐색 깊이 한도'); return; }
    let real;
    try { real = await fs.realpath(directory); }
    catch (error) { stat.inaccessible += 1; if (!depth) stat.state = error.code === 'ENOENT' ? 'missing' : 'inaccessible'; skip('접근할 수 없는 폴더'); return; }
    const key = process.platform === 'win32' ? real.toLowerCase() : real;
    if (visitedDirectories.has(key)) { if (!depth) stat.state = 'covered'; return; }
    if (depth && !within(boundary, real)) { skip('연결된 외부 폴더'); return; }
    if (!depth) boundary = real;
    let entries;
    try { entries = await fs.readdir(real, { withFileTypes: true }); }
    catch (error) { stat.inaccessible += 1; if (!depth) stat.state = error.code === 'ENOENT' ? 'missing' : 'inaccessible'; skip('접근할 수 없는 폴더'); return; }
    visitedDirectories.add(key);
    // Start with likely personal document locations before large program directories.
    entries.sort((a, b) => Number(/desktop|documents|downloads|onedrive|바탕|문서|다운로드/i.test(b.name)) - Number(/desktop|documents|downloads|onedrive|바탕|문서|다운로드/i.test(a.name)));
    for (const entry of entries) {
      signal?.throwIfAborted();
      if (result.visited >= maxEntries || result.files.length >= maxFiles) { result.limited = stat.limited = true; return; }
      result.visited += 1; stat.visited += 1;
      if (result.visited % 100 === 0) { onProgress({ visited: result.visited, found: result.files.length, location: root.label }); await new Promise(resolve => setImmediate(resolve)); }
      const fullPath = path.join(real, entry.name);
      // Yield each entry so a large drive cannot consume the whole scan before C: is visited.
      yield;
      if (result.files.length >= maxFiles) { result.limited = stat.limited = true; return; }
      if (entry.isSymbolicLink()) { skip('바로가기·연결 경로'); continue; }
      if (excludedName(entry.name) || (root.drive && depth === 0 && /^(users|documents and settings)$/i.test(entry.name))) { skip('시스템·개발·숨김 항목'); continue; }
      if (entry.isDirectory()) yield* walk(fullPath, root, depth + 1, stat, boundary);
      else if (entry.isFile() && DOCUMENT.test(entry.name) && !entry.name.startsWith('~$') && !PRIVATE_FILE.test(entry.name)) {
        try {
          const info = await fs.lstat(fullPath);
          if (!info.isFile() || info.isSymbolicLink() || !info.size || info.size > MAX_SIZE) { skip('빈 파일·크기 한도'); continue; }
          const fileKey = process.platform === 'win32' ? fullPath.toLowerCase() : fullPath;
          if (seenFiles.has(fileKey)) continue;
          seenFiles.add(fileKey);
          const relative = path.relative(root.path, fullPath).split(path.sep).join('/');
          const publicPath = `${root.label}/${relative}`;
          result.files.push({ id: randomUUID(), name: entry.name, path: publicPath, size: info.size, lastModified: info.mtimeMs,
            drive: root.driveCode || fullPath.match(/^[a-z]:/i)?.[0].toUpperCase() || '',
            score: experienceFileScore(entry.name, relative, info.mtimeMs, now),
            absolutePath: fullPath, rootPath: boundary, realPath: fullPath });
          stat.found += 1;
        } catch { skip('읽을 수 없는 파일'); }
      }
    }
  }
  const walkers = roots.map((root, i) => ({ iterator: walk(root.path, root, 0, result.rootStats[i]), stat: result.rootStats[i] }));
  while (walkers.length) {
    for (const walker of [...walkers]) {
      if (walker.stat.state === 'pending') walker.stat.state = 'scanning';
      const { done } = await walker.iterator.next();
      if (done) {
        if (walker.stat.state === 'scanning') walker.stat.state = walker.stat.limited ? 'limited' : 'complete';
        walkers.splice(walkers.indexOf(walker), 1);
      }
    }
  }
  result.files.sort((a, b) => b.score - a.score || b.lastModified - a.lastModified || a.path.localeCompare(b.path));
  // Interleave physical drives after ranking within each drive, including the first page.
  const groups = new Map();
  for (const file of result.files) { const group = file.drive || ''; if (!groups.has(group)) groups.set(group, []); groups.get(group).push(file); }
  const drives = [...groups.keys()].sort();
  result.files = [];
  for (let index = 0; ; index += 1) {
    let any = false;
    for (const drive of drives) { const file = groups.get(drive)[index]; if (file) { result.files.push(file); any = true; } }
    if (!any) break;
  }
  return result;
}

export function publicInventory(result) {
  return { ...result, files: result.files.map(({ absolutePath, rootPath, realPath, ...file }) => ({ ...file, recommended: file.score > 0 })) };
}

// Only an opaque file ID from a finished scan can be read; clients cannot supply paths.
export async function readIndexedFile(file) {
  const resolved = await fs.realpath(file.absolutePath);
  if (!within(file.rootPath, resolved) || resolved !== file.realPath) throw new Error('파일 경로가 바뀌었어요. 다시 탐색해주세요.');
  const info = await fs.lstat(file.absolutePath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_SIZE || info.size !== file.size || info.mtimeMs !== file.lastModified) throw new Error('파일이 변경되었어요. 다시 탐색해주세요.');
  const handle = await fs.open(resolved, 'r');
  try {
    const opened = await handle.stat();
    if (opened.ino !== info.ino || opened.dev !== info.dev || opened.size !== info.size || opened.mtimeMs !== info.mtimeMs) throw new Error('파일이 변경되었어요. 다시 탐색해주세요.');
    return await handle.readFile();
  } finally { await handle.close(); }
}
