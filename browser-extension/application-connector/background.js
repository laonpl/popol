import {
  CONNECTION_KEY, connectionIsLive, createConnection, matchesConnection, sanitizeCapture,
} from './protocol.js';

let messageQueue = Promise.resolve();
const readConnection = async () => (await chrome.storage.session.get(CONNECTION_KEY))[CONNECTION_KEY];
const clearConnection = () => chrome.storage.session.remove(CONNECTION_KEY);

async function externalMessage(message, sender) {
  if (message?.type === 'FITPOLY_CONNECT') {
    const connection = createConnection(message, sender);
    if (!connection) return { status: 'error', error: '연결 요청을 확인하지 못했습니다.' };
    await chrome.storage.session.set({ [CONNECTION_KEY]: connection });
    return { status: 'waiting', expiresAt: connection.expiresAt };
  }
  if (!['FITPOLY_POLL', 'FITPOLY_CANCEL'].includes(message?.type)) {
    return { status: 'error', error: '지원하지 않는 요청입니다.' };
  }
  const connection = await readConnection();
  if (!matchesConnection(connection, message, sender)) {
    if (connection && !connectionIsLive(connection)) await clearConnection();
    return { status: 'expired' };
  }
  if (message.type === 'FITPOLY_CANCEL') {
    await clearConnection();
    return { status: 'cancelled' };
  }
  if (!connection.capture) return { status: 'waiting', expiresAt: connection.expiresAt };
  const capture = connection.capture;
  await clearConnection();
  return { status: 'captured', capture };
}

async function internalMessage(message, sender) {
  if (sender?.id !== chrome.runtime.id || sender?.url !== chrome.runtime.getURL('popup.html')) {
    return { status: 'error', error: '확장 창에서 다시 시도해주세요.' };
  }
  const connection = await readConnection();
  if (!connectionIsLive(connection)) {
    await clearConnection();
    return { status: 'expired' };
  }
  if (message?.type === 'FITPOLY_PENDING') {
    const { capture, senderOrigin, ...pending } = connection;
    return { status: capture ? 'captured' : 'waiting', connection: pending };
  }
  if (message?.type === 'FITPOLY_CAPTURE' && message.nonce === connection.nonce) {
    const capture = sanitizeCapture(message.capture, connection);
    if (!capture) return { status: 'error', error: '지원서 문항을 확인하지 못했습니다. 문항 확인을 다시 눌러주세요.' };
    await chrome.storage.session.set({ [CONNECTION_KEY]: { ...connection, capture } });
    return { status: 'captured' };
  }
  return { status: 'error', error: '연결 요청을 확인하지 못했습니다.' };
}

function enqueue(handler, message, sender, sendResponse) {
  messageQueue = messageQueue.then(() => handler(message, sender)).then(sendResponse).catch(() => {
    sendResponse({ status: 'error', error: '연결 중 문제가 생겼습니다. FitPoly에서 다시 연결해주세요.' });
  });
  return true;
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => enqueue(externalMessage, message, sender, sendResponse));
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => enqueue(internalMessage, message, sender, sendResponse));
