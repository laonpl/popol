import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('CSV and TSV use local text extraction with no model or network call', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network is forbidden in this test'); };
  try {
    const { importFromFile } = await import('./importService.js');
    for (const [name, mime, text] of [
      ['채널 리포트.csv', 'text/csv', '\uFEFFchannel,spend,clicks\nsearch,12000,30'],
      ['전환 리포트.tsv', 'application/octet-stream', 'event\tcount\npurchase\t3'],
    ]) {
      const result = await importFromFile(Buffer.from(text, 'utf8'), mime, name);
      assert.equal(result.content, text.replace(/^\uFEFF/, ''));
      assert.equal(result.fileName, name);
    }
  } finally { globalThis.fetch = previousFetch; }
});

test('document upload and experience picker both allow report text formats', async () => {
  const upload = await readFile(new URL('../routes/upload.js', import.meta.url), 'utf8');
  const picker = await readFile(new URL('../../../frontend/src/pages/experience/ExperienceResult.jsx', import.meta.url), 'utf8');
  assert.match(upload, /const DOC_EXT = .*csv\|tsv/);
  assert.match(picker, /accept="[^"]*\.csv,\.tsv/);
});
