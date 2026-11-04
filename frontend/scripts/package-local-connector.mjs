import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(frontend, '../local-connector');
const output = path.join(frontend, 'public/local-experience-connector');
const archivePath = path.join(output, 'fitpoly-local-connector-win.zip');
const files = ['server.mjs', 'scanner.mjs', 'experienceSelection.mjs', 'experienceEvidence.mjs', 'start.ps1', 'setup.ps1', 'remove-connection.ps1', 'FitPoly-자동연결-설정.cmd', 'FitPoly-탐색기-실행.cmd', 'README.md'];
if (process.platform !== 'win32') {
  await access(archivePath);
  const packaged = await JSZip.loadAsync(await readFile(archivePath));
  for (const name of files) {
    let current;
    try { current = await readFile(path.join(source, name)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const entry = packaged.file(name);
    if (!entry || !current.equals(await entry.async('nodebuffer'))) throw new Error('Local connector sources changed. Rebuild the Windows ZIP before deployment.');
  }
  console.log('Using the packaged Windows local connector. Rebuild its ZIP on Windows when connector sources change.');
} else {
  const zip = new JSZip();
  const date = new Date('2026-01-01T00:00:00Z');
  for (const name of files) {
    zip.file(name, await readFile(path.join(source, name)), { date });
  }
  zip.file('node.exe', await readFile(process.execPath), { date });
  zip.file('NODE-LICENSE.txt', await readFile(path.join(source, `NODE-LICENSE-${process.version}.txt`)), { date });
  const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  await mkdir(output, { recursive: true });
  await writeFile(archivePath, archive);
  await writeFile(path.join(output, 'config.json'), JSON.stringify({ version: 4, nodeVersion: process.version, downloadUrl: '/local-experience-connector/fitpoly-local-connector-win.zip', bytes: archive.length,
    sha256: createHash('sha256').update(archive).digest('hex') }, null, 2) + '\n');
  const verify = await JSZip.loadAsync(archive);
  if (!verify.file('node.exe') || !verify.file('scanner.mjs') || !verify.file('NODE-LICENSE.txt')) throw new Error('Incomplete local connector archive');
  console.log(`Packaged portable Windows local connector: ${archive.length} bytes.`);
}
