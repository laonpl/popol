import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { scanExperienceFiles, publicInventory, readIndexedFile, experienceFileScore, within, defaultRoots } from './scanner.mjs';
import { createLocalConnector } from './server.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fitpoly-connector-test-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('fitpoly-connector-test-'));
    return fs.rm(resolved, { recursive: true, force: true });
  });
  async function put(name, text = '프로젝트\n역할: 기획자\n한 일: 인터뷰를 진행하고 서비스를 개선했다.') {
    const target = path.join(root, name); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, text); return target;
  }
  return { root, put };
}

test('automatic discovery searches personal and drive roots without reading contents or returning absolute paths', async t => {
  const { root, put } = await fixture(t);
  await put('home/Desktop/회고.md'); await put('home/Documents/팀/보고서.txt'); await put('drive/내 프로젝트/성과.csv');
  await put('home/.aws/credentials.txt'); await put('home/AppData/notes.md'); await put('home/node_modules/readme.md');
  await put('drive/Windows/help.txt'); await put('drive/Users/Other/이력서.txt'); await put('home/passwords.csv'); await put('home/사진.png');
  const result = await scanExperienceFiles([{ path: path.join(root, 'home'), label: '내 파일' }, { path: path.join(root, 'drive'), label: 'D: 드라이브', drive: true }]);
  assert.equal(result.files.length, 3);
  const inventory = publicInventory(result);
  assert.ok(inventory.files.some(file => file.path === 'D: 드라이브/내 프로젝트/성과.csv'));
  assert.equal(JSON.stringify(inventory).includes(root.replace(/\\/g, '\\\\')), false);
  assert.ok(inventory.files.every(file => !('absolutePath' in file) && !('rootPath' in file)));
  assert.ok(experienceFileScore('회고.pdf', '프로젝트/회고.pdf', Date.now()) > experienceFileScore('README.md', '도구/README.md', Date.now()));
  assert.match((await readIndexedFile(result.files[0])).toString(), /프로젝트/);
});

test('scan limits and cancellation are explicit; changed files cannot be read from a stale index', async t => {
  const { root, put } = await fixture(t);
  await put('경험1.txt'); await put('경험2.txt');
  const roots = [{ path: root, label: '내 파일' }];
  const limited = await scanExperienceFiles(roots, { maxFiles: 1 });
  assert.equal(limited.files.length, 1); assert.equal(limited.limited, true);
  await fs.appendFile(limited.files[0].absolutePath, '파일을 수정했습니다');
  await assert.rejects(readIndexedFile(limited.files[0]), /변경/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(scanExperienceFiles(roots, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(within(root, path.join(root, '..', 'another')), false);
});

test('directory junctions and files replaced by symlinks cannot escape scanned roots', async t => {
  const { root, put } = await fixture(t);
  const inside = path.join(root, 'inside'); const outside = path.join(root, 'outside');
  await put('inside/경험.txt'); await put('outside/비공개.txt');
  await fs.symlink(outside, path.join(inside, '외부연결'), 'junction');
  const result = await scanExperienceFiles([{ path: inside, label: '내 파일' }]);
  assert.equal(result.files.length, 1);
  assert.equal(result.skipped['바로가기·연결 경로'], 1);
  const record = result.files[0];
  // A directory redirection after indexing must not expose a file in a different root.
  record.absolutePath = path.join(outside, '비공개.txt');
  await assert.rejects(readIndexedFile(record), /경로/);
});

test('loopback connector requires trusted origin and session token, and accepts file IDs rather than paths', async t => {
  const { root, put } = await fixture(t); await put('경험.txt');
  let rootLookups = 0;
  const server = createLocalConnector({ roots: async () => { rootLookups += 1; return [{ path: root, label: '내 파일' }]; } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: 'https://fitpoly.kr', 'X-FitPoly-Client': 'fitpoly-local-experience-v1', 'Content-Type': 'application/json' };
  const request = (route, { method = 'GET', body, override = {} } = {}) => fetch(endpoint + route, { method, headers: { ...headers, ...override }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(rootLookups, 0, 'starting the connector does not scan');
  assert.equal((await request('/session', { method: 'POST', body: {}, override: { Origin: 'https://evil.invalid' } })).status, 403);
  assert.equal((await request('/scan')).status, 401);
  const token = (await (await request('/session', { method: 'POST', body: {} })).json()).token;
  headers['X-FitPoly-Token'] = token;
  assert.equal(rootLookups, 0, 'connecting does not scan');
  assert.equal((await request('/scan', { method: 'POST', body: {} })).status, 202);
  let status;
  for (let i = 0; i < 100; i += 1) {
    status = await (await request('/scan')).json();
    if (status.state === 'complete') break;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(status.state, 'complete'); assert.equal(rootLookups, 1);
  const file = status.inventory.files[0];
  assert.equal((await request('/file', { method: 'POST', body: { path: path.join(root, '경험.txt') } })).status, 404);
  assert.equal((await request('/file', { method: 'POST', body: { id: file.id }, override: { 'X-FitPoly-Token': 'wrong' } })).status, 401);
  const otherToken = (await (await request('/session', { method: 'POST', body: {} })).json()).token;
  assert.equal((await request('/file', { method: 'POST', body: { id: file.id }, override: { 'X-FitPoly-Token': otherToken } })).status, 404);
  const read = await request('/file', { method: 'POST', body: { id: file.id } });
  assert.equal(read.status, 200); assert.match(await read.text(), /인터뷰/);
  assert.equal((await request('/scan', { override: { Origin: 'http://localhost:3000' } })).status, 401, 'tokens are bound to an origin');
});

test('personal roots survive failed preflight and redirected Windows folders are explicit targets', async t => {
  const { root, put } = await fixture(t);
  await put('redirected-desktop/프로젝트.txt');
  const home = path.join(root, 'unavailable-home');
  const roots = await defaultRoots({ home, platform: 'win32', environment: { SystemDrive: path.parse(root).root.slice(0, 2) },
    discoverWindows: async () => ({ folders: [{ kind: 'desktop', path: path.join(root, 'redirected-desktop') }], drives: [] }),
  });
  assert.ok(roots.some(row => row.path === home), 'unavailable personal root must not be silently removed');
  assert.ok(roots.some(row => row.path === path.join(root, 'redirected-desktop')));
  assert.ok(roots.some(row => row.drive && row.label.startsWith('C:')));
  const result = await scanExperienceFiles(roots.filter(row => !row.drive));
  assert.equal(result.files.length, 1);
  assert.equal(result.rootStats.find(row => row.label.startsWith('바탕화면')).state, 'complete');
  assert.equal(result.rootStats.find(row => row.label.startsWith('내 파일')).state, 'missing');
});

test('a large D drive cannot starve C scanning or hide C files on the first page', async t => {
  const { root, put } = await fixture(t);
  for (let i = 0; i < 40; i += 1) await put(`drive-d/성과 프로젝트 ${i}.txt`);
  await put('drive-c/Documents/메모.txt');
  const roots = [{ path: path.join(root, 'drive-d'), label: 'D: 드라이브', driveCode: 'D:', drive: true },
    { path: path.join(root, 'drive-c'), label: 'C: 드라이브', driveCode: 'C:', drive: true }];
  const result = await scanExperienceFiles(roots);
  assert.deepEqual(result.files.slice(0, 2).map(file => file.drive), ['C:', 'D:']);
  assert.equal(result.rootStats.find(row => row.drive === 'C:').found, 1);
  assert.equal(result.rootStats.find(row => row.drive === 'D:').found, 40);
  const limited = await scanExperienceFiles(roots, { maxFiles: 3 });
  assert.equal(limited.files.length, 3);
  assert.ok(limited.files.some(file => file.drive === 'C:'));
  assert.equal(limited.limited, true);
});
