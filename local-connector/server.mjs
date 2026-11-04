import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { defaultRoots, scanExperienceFiles, publicInventory, readIndexedFile } from './scanner.mjs';

export const CONNECTOR_PORT = 43127;
export const CONNECTOR_VERSION = 3;
const CLIENT = 'fitpoly-local-experience-v1';
const ORIGINS = new Set(['https://fitpoly.kr', 'https://www.fitpoly.kr', ...[3000, 3001, 3002, 3003, 5173].flatMap(port => [`http://localhost:${port}`, `http://127.0.0.1:${port}`])]);
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
async function readJson(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 4096) throw new Error('요청이 너무 커요.'); }
  return raw ? JSON.parse(raw) : {};
}

export function createLocalConnector({ roots = defaultRoots, scan = scanExperienceFiles, sessionTtl = 60 * 60 * 1000 } = {}) {
  const sessions = new Map();
  let active = null;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const port = server.address()?.port;
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return json(res, 403, { error: '허용되지 않은 호스트예요.' });
    const origin = req.headers.origin;
    if (origin && !ORIGINS.has(origin)) return json(res, 403, { error: 'FitPoly에서만 연결할 수 있어요.' });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-FitPoly-Client, X-FitPoly-Token');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    let pathname;
    try { pathname = new URL(req.url, 'http://127.0.0.1').pathname; }
    catch { return json(res, 400, { error: '올바르지 않은 요청이에요.' }); }
    if (req.method === 'GET' && pathname === '/health') return json(res, 200, { product: 'fitpoly-local-experience', version: CONNECTOR_VERSION });
    if (!origin || req.headers['x-fitpoly-client'] !== CLIENT) return json(res, 403, { error: 'FitPoly 연결 요청이 필요해요.' });
    if (req.method === 'POST' && req.headers['content-type'] !== 'application/json') return json(res, 415, { error: 'JSON 요청만 허용해요.' });
    const time = Date.now();
    for (const [token, session] of sessions) if (time - session.updatedAt > sessionTtl) { session.controller?.abort(); sessions.delete(token); }
    if (req.method === 'POST' && pathname === '/session') {
      if (sessions.size >= 20) return json(res, 429, { error: '연결이 너무 많아요. 탐색기를 다시 실행해주세요.' });
      const token = randomBytes(32).toString('hex');
      sessions.set(token, { origin, updatedAt: time, job: null });
      return json(res, 200, { token, version: CONNECTOR_VERSION });
    }
    const session = sessions.get(req.headers['x-fitpoly-token']);
    if (!session || session.origin !== origin) return json(res, 401, { error: '로컬 탐색기에 다시 연결해주세요.' });
    session.updatedAt = time;
    try {
      if (req.method === 'POST' && pathname === '/scan') {
        if (active) return json(res, 409, { error: '진행 중인 탐색을 마친 뒤 다시 시작해주세요.' });
        const controller = new AbortController(); session.controller = controller;
        session.job = { state: 'scanning', progress: { visited: 0, found: 0 }, result: null };
        active = session;
        void (async () => {
          try {
            const result = await scan(await roots(), { signal: controller.signal, onProgress: progress => { session.job.progress = progress; } });
            controller.signal.throwIfAborted();
            session.job = { state: 'complete', result, progress: { visited: result.visited, found: result.files.length } };
          } catch (error) { session.job = { state: controller.signal.aborted ? 'cancelled' : 'error', error: controller.signal.aborted ? '탐색을 중단했어요.' : '로컬 파일 탐색에 실패했어요.' }; }
          finally { if (active === session) active = null; }
        })();
        return json(res, 202, { state: 'scanning' });
      }
      if (req.method === 'GET' && pathname === '/scan') {
        if (!session.job) return json(res, 404, { error: '먼저 탐색을 시작해주세요.' });
        return json(res, 200, session.job.state === 'complete' ? { state: 'complete', inventory: publicInventory(session.job.result) } : session.job);
      }
      if (req.method === 'POST' && pathname === '/cancel') { session.controller?.abort(); return json(res, 200, { cancelled: true }); }
      if (req.method === 'POST' && pathname === '/file') {
        const { id } = await readJson(req);
        const file = session.job?.state === 'complete' && session.job.result.files.find(row => row.id === id);
        if (!file) return json(res, 404, { error: '탐색 결과에 없는 파일이에요.' });
        const data = await readIndexedFile(file);
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': data.length }); res.end(data); return;
      }
      return json(res, 404, { error: '지원하지 않는 요청이에요.' });
    } catch { return json(res, 400, { error: '파일을 읽지 못했어요. 파일이 변경되었다면 다시 탐색해주세요.' }); }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.on('close', () => { for (const session of sessions.values()) session.controller?.abort(); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createLocalConnector();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'FitPoly 로컬 탐색기가 이미 실행 중이에요.' : '로컬 탐색기를 실행하지 못했어요.'); process.exitCode = 1; });
  server.listen(CONNECTOR_PORT, '127.0.0.1', () => console.log(`FitPoly 로컬 탐색기 준비 완료 (127.0.0.1:${CONNECTOR_PORT}). FitPoly에서 내 컴퓨터 자동 찾기를 눌러주세요.`));
}
