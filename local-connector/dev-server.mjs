import { once } from 'node:events';
import { createLocalConnector, CONNECTOR_PORT, CONNECTOR_VERSION } from './server.mjs';

export const LOCAL_CONNECTOR_START_PATH = '/__fitpoly/local-experience/connect';
const CLIENT = 'fitpoly-local-experience-v1';
const loopbackAddress = value => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value);
const localHost = value => ['localhost', '127.0.0.1', '[::1]'].includes(value);

// Only the local development browser may start this feature. No file scan happens
// here: /scan still requires the connector's trusted origin and session token.
export function isLocalConnectorStartRequest(req) {
  if (!loopbackAddress(req.socket?.remoteAddress)) return false;
  if (req.headers['x-fitpoly-client'] !== CLIENT) return false;
  try {
    const origin = new URL(req.headers.origin);
    return origin.protocol === 'http:' && localHost(origin.hostname)
      && origin.host === req.headers.host && origin.origin === req.headers.origin;
  } catch { return false; }
}

export function createDevConnectorManager({ port = CONNECTOR_PORT, createConnector = createLocalConnector, fetchHealth = fetch } = {}) {
  let owned = null;
  let pending = null;
  let disposed = false;
  const endpoint = `http://127.0.0.1:${port}`;
  async function start() {
    let health;
    try {
      const response = await fetchHealth(`${endpoint}/health`, { signal: AbortSignal.timeout(1200) });
      if (response.ok) health = await response.json();
    } catch { /* A stopped connector is started below. */ }
    if (health) {
      if (health.product !== 'fitpoly-local-experience' || health.version < 3) {
        throw new Error('로컬 탐색 연결 포트를 다른 프로그램이나 이전 탐색기가 사용하고 있어요.');
      }
      return { ready: true, version: health.version };
    }
    const connector = createConnector();
    // Observe listen errors before calling listen; never terminate another process.
    const listening = once(connector, 'listening');
    connector.listen(port, '127.0.0.1');
    try { await listening; }
    catch { throw new Error('자동 탐색 연결을 시작하지 못했어요. 로컬 연결 포트 사용 여부를 확인해주세요.'); }
    owned = connector;
    return { ready: true, version: CONNECTOR_VERSION };
  }
  return {
    ensureStarted() {
      if (disposed) return Promise.reject(new Error('개발 서버가 종료되었어요.'));
      if (owned?.listening) return Promise.resolve({ ready: true, version: CONNECTOR_VERSION });
      if (!pending) pending = start().finally(() => { pending = null; });
      return pending;
    },
    async close() {
      disposed = true;
      await pending?.catch(() => {});
      if (owned) {
        const connector = owned; owned = null;
        connector.closeAllConnections();
        await new Promise(resolve => connector.close(resolve));
      }
    },
  };
}

export function localExperienceDevPlugin({ manager = createDevConnectorManager() } = {}) {
  return {
    name: 'fitpoly-local-experience',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== LOCAL_CONNECTOR_START_PATH) return next();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const reply = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
        if (req.method !== 'POST') return reply(405, { error: 'POST 요청이 필요해요.' });
        if (!isLocalConnectorStartRequest(req)) return reply(403, { error: '내 컴퓨터의 FitPoly 개발 화면에서만 연결할 수 있어요.' });
        void manager.ensureStarted().then(value => reply(200, value), error => reply(503, { error: error.message }));
      });
      server.httpServer?.once('close', () => { void manager.close(); });
    },
    async closeBundle() { await manager.close(); },
  };
}
