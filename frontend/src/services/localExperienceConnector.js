const ENDPOINT = 'http://127.0.0.1:43127';
const CLIENT = 'fitpoly-local-experience-v1';

export async function startDevelopmentConnector({ signal, fetchRequest = fetch, location = globalThis.location,
  development = import.meta.env?.DEV === true } = {}) {
  if (!development || !['localhost', '127.0.0.1', '[::1]'].includes(location?.hostname)) return;
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetchRequest('/__fitpoly/local-experience/connect', { method: 'POST',
      headers: { 'X-FitPoly-Client': CLIENT }, signal: controller.signal, cache: 'no-store', credentials: 'same-origin' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ready) throw new Error(result.error || '자동 탐색 연결을 준비하지 못했어요. 개발 서버를 다시 시작해주세요.');
  } catch (cause) {
    signal?.throwIfAborted();
    throw Object.assign(new Error(controller.signal.aborted
      ? '자동 탐색 연결 준비 시간이 초과됐어요. 다시 눌러주세요.'
      : cause.message || '자동 탐색 연결을 준비하지 못했어요.'), { code: 'LOCAL_CONNECTOR_START_FAILED' });
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function discoverLocalExperiences({ signal, onProgress = () => {}, waitForConnection = false } = {}) {
  let token;
  async function request(route, { body, timeout = 10000, requestSignal = signal, binary = false } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort(requestSignal.reason);
    if (requestSignal?.aborted) abort(); else requestSignal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`${ENDPOINT}${route}`, { method: body === undefined ? 'GET' : 'POST', mode: 'cors', cache: 'no-store', signal: controller.signal,
        headers: { 'X-FitPoly-Client': CLIENT, ...(token ? { 'X-FitPoly-Token': token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok) throw new Error((await response.json()).error || '로컬 탐색기에 연결하지 못했어요.');
      return binary ? await response.arrayBuffer() : await response.json();
    } finally { clearTimeout(timer); requestSignal?.removeEventListener('abort', abort); }
  }
  onProgress('내 컴퓨터 자동 탐색을 준비하고 있어요.');
  await startDevelopmentConnector({ signal });
  onProgress('내 컴퓨터에 연결하고 있어요. 브라우저 권한 요청이 나오면 허용해주세요.');
  try {
    if (waitForConnection) {
      const deadline = Date.now() + 30000;
      while (true) {
        try { await request('/health', { timeout: 2000 }); break; }
        catch { signal?.throwIfAborted(); if (Date.now() >= deadline) throw new Error('connection timeout'); }
        await wait(750, signal);
      }
    }
    // Leave time to respond to the browser's local network permission prompt.
    const session = await request('/session', { body: {}, timeout: 60000 });
    if (!(session.version >= 3)) throw Object.assign(new Error('로컬 탐색기를 업데이트한 뒤 다시 실행해주세요. 새 탐색기는 참고자료·대본을 낮추고 핵심경험을 선별해요.'), { code: 'LOCAL_CONNECTOR_OUTDATED' });
    token = session.token;
  }
  catch (cause) {
    signal?.throwIfAborted();
    if (cause.code === 'LOCAL_CONNECTOR_OUTDATED') { cause.code = 'LOCAL_CONNECTOR_UNAVAILABLE'; throw cause; }
    if (import.meta.env?.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(globalThis.location?.hostname)) {
      throw Object.assign(new Error('내 컴퓨터에 연결하지 못했어요. 브라우저가 로컬 네트워크 권한을 요청하면 허용하고 다시 눌러주세요.'), { code: 'LOCAL_CONNECTOR_CONNECTION_FAILED' });
    }
    const error = new Error('이 PC의 탐색 연결이 필요해요. 처음 한 번 자동 연결을 설정하면 다음부터 사이트 버튼으로 탐색할 수 있어요.');
    error.code = 'LOCAL_CONNECTOR_UNAVAILABLE'; throw error;
  }
  const cancel = () => { void request('/cancel', { body: {}, timeout: 2000, requestSignal: null }).catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await request('/scan', { body: {} });
    while (true) {
      signal?.throwIfAborted();
      const status = await request('/scan');
      if (status.state === 'complete') {
        return { ...status.inventory, files: status.inventory.files.map(record => ({ ...record,
          getFile: async ({ signal: fileSignal } = {}) => {
            const buffer = await request('/file', { body: { id: record.id }, timeout: 30000, requestSignal: fileSignal, binary: true });
            return new File([buffer], record.name, { lastModified: record.lastModified });
          },
        })) };
      }
      if (status.state !== 'scanning') throw new Error(status.error || '자동 탐색을 완료하지 못했어요.');
      const progress = status.progress || {};
      onProgress(`${progress.location || '내 컴퓨터'} · ${(progress.visited || 0).toLocaleString()}개 항목 확인 · 문서 ${(progress.found || 0).toLocaleString()}개 발견`);
      await wait(500, signal);
    }
  } finally { signal?.removeEventListener('abort', cancel); }
}
