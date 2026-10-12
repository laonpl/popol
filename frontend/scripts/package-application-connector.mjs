import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(frontend, '..', 'browser-extension', 'application-connector');
const output = path.join(frontend, 'public', 'application-connector');
// Frontend-only hosting checkouts still have the committed, reviewed ZIP. Use
// its runtime files when the monorepo extension sources aren't in the checkout.
let packagedSource = null;
let manifestText;
try { manifestText = await readFile(path.join(source, 'manifest.json'), 'utf8'); }
catch (error) {
  if (!['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) throw error;
  packagedSource = await JSZip.loadAsync(await readFile(path.join(output, 'fitpoly-application-connector.zip')));
  manifestText = await packagedSource.file('manifest.json').async('string');
}
const manifest = JSON.parse(manifestText);
const collectorFile = path.join(frontend, 'src', 'utils', 'applicationQuestionCapture.js');
const captureModule = await readFile(collectorFile, 'utf8');
if (!/export\s+(?:async\s+)?function\s+captureApplicationQuestions\b/.test(captureModule)
  || /(^|\n)\s*import\s/m.test(captureModule)) {
  throw new Error('Application collector must export a self-contained captureApplicationQuestions function.');
}
const permissions = [...manifest.permissions].sort();
if (JSON.stringify(permissions) !== JSON.stringify(['activeTab', 'scripting', 'storage'])
  || manifest.host_permissions?.length || manifest.content_scripts?.length) {
  throw new Error('The connector must only request activeTab, scripting, and storage permissions.');
}
const key = Buffer.from(manifest.key, 'base64');
const extensionId = Array.from(createHash('sha256').update(key).digest().subarray(0, 16),
  (byte) => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))).join('');
const zip = new JSZip();
for (const file of ['manifest.json', 'background.js', 'protocol.js', 'popup.html', 'popup.js', 'popup.css', 'README.md']) {
  const contents = packagedSource ? await packagedSource.file(file).async('nodebuffer') : await readFile(path.join(source, file));
  zip.file(file, contents, { date: new Date('2026-01-01T00:00:00Z') });
}
zip.file('capture.js', captureModule, { date: new Date('2026-01-01T00:00:00Z') });
await mkdir(output, { recursive: true });
const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
const downloadUrl = '/application-connector/fitpoly-application-connector.zip';
await writeFile(path.join(output, 'fitpoly-application-connector.zip'), archive);
await writeFile(path.join(output, 'config.json'), JSON.stringify({ extensionId, downloadUrl, version: manifest.version }, null, 2) + '\n');
const verified = await JSZip.loadAsync(archive);
if (Object.keys(verified.files).length !== 8 || !(await verified.file('capture.js').async('string')).includes('captureApplicationQuestions')) {
  throw new Error('The connector ZIP did not contain the expected extension files.');
}
console.log(`Packaged FitPoly application connector ${manifest.version} (${extensionId}), ${archive.length} bytes.`);
