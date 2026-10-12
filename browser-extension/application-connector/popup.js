import { captureApplicationQuestions } from './capture.js';

const byId = (id) => document.getElementById(id);
const status = byId('status');
const readButton = byId('read');
const importButton = byId('import');
let connection;
let capture;

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}

async function pendingConnection() {
  const response = await chrome.runtime.sendMessage({ type: 'FITPOLY_PENDING' });
  if (response?.status === 'captured') {
    showStatus('문항을 보냈어요. FitPoly 화면으로 돌아가면 문항을 확인할 수 있어요.');
    return null;
  }
  if (response?.status !== 'waiting' || !response.connection) {
    showStatus('FitPoly의 자소서 화면에서 ‘로그인한 지원서 연결’을 먼저 눌러주세요.', true);
    return null;
  }
  return response.connection;
}

async function activeApplicationTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let origin;
  try { origin = new URL(tab?.url || '').origin; } catch { /* Missing activeTab URL. */ }
  if (!tab?.id || origin !== connection.expectedOrigin) {
    throw new Error(`연결한 지원 사이트(${new URL(connection.expectedOrigin).hostname})의 실제 자기소개서 입력 화면에서 확장을 열어주세요.`);
  }
  return tab;
}

function limitDescription(question) {
  const parts = [];
  if (Number.isInteger(question.minLength) && question.minLength > 0) parts.push(`최소 ${question.minLength.toLocaleString()}자`);
  if (Number.isInteger(question.maxLength)) parts.push(`최대 ${question.maxLength.toLocaleString()}자`);
  if (typeof question.countSpaces === 'boolean') parts.push(question.countSpaces ? '공백 포함' : '공백 제외');
  return parts.join(' · ') || '글자 수 제한을 확인하지 못했어요';
}

function selectedQuestions() {
  return capture.questions.filter((_, index) => byId(`question-${index}`)?.checked);
}

function refreshCount() {
  const count = selectedQuestions().length;
  byId('count').textContent = `${count}개 선택`;
  importButton.disabled = !count;
}

function showPreview() {
  const list = byId('questions');
  list.replaceChildren();
  capture.questions.forEach((question, index) => {
    const label = document.createElement('label');
    label.className = 'question';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.id = `question-${index}`;
    check.checked = true;
    check.addEventListener('change', refreshCount);
    const content = document.createElement('div');
    const prompt = document.createElement('p');
    prompt.textContent = question.question;
    const limit = document.createElement('small');
    limit.textContent = limitDescription(question);
    content.append(prompt, limit);
    label.append(check, content);
    list.append(label);
  });
  byId('preview').hidden = false;
  const warning = byId('warning');
  warning.hidden = !capture.warnings?.length;
  warning.textContent = '일부 문항이나 글자 수 제한은 읽히지 않을 수 있어요. 실제 지원서와 비교한 뒤 선택해주세요.';
  refreshCount();
}

readButton.addEventListener('click', async () => {
  readButton.disabled = true;
  byId('preview').hidden = true;
  capture = null;
  try {
    connection = await pendingConnection();
    if (!connection) return;
    const tab = await activeApplicationTab();
    showStatus('이 화면에서 자기소개서 문항을 확인하고 있어요.');
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: captureApplicationQuestions });
    if (!result?.result || result.result.version !== 1) throw new Error('이 화면의 문항을 읽지 못했어요. 실제 지원서 입력 화면인지 확인해주세요.');
    capture = result.result;
    if (!Array.isArray(capture.questions) || !capture.questions.length) {
      showStatus('이 화면에서 자기소개서 문항을 찾지 못했어요. 직접 동의·등록·로그인한 뒤 실제 자기소개서 입력 화면으로 이동하고 다시 눌러주세요.');
      return;
    }
    // The protocol permits at most 12 reviewed questions per import.
    capture.questions = capture.questions.slice(0, 12);
    showStatus('실제 지원서와 문항이 같은지 확인한 뒤 가져와주세요.');
    showPreview();
  } catch (error) {
    showStatus(error?.message || '이 화면의 문항을 읽지 못했어요. 새로고침한 뒤 다시 시도해주세요.', true);
  } finally {
    readButton.disabled = !connection;
  }
});

importButton.addEventListener('click', async () => {
  const questions = selectedQuestions();
  if (!questions.length) return;
  importButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FITPOLY_CAPTURE', nonce: connection.nonce, capture: { ...capture, questions },
    });
    if (response?.status !== 'captured') throw new Error(response?.error || '연결 시간이 끝났어요. FitPoly에서 다시 연결해주세요.');
    readButton.disabled = true;
    byId('preview').hidden = true;
    showStatus('문항을 보냈어요. FitPoly 화면으로 돌아가면 가져온 문항을 확인할 수 있어요.');
  } catch (error) {
    showStatus(error?.message || '문항을 보내지 못했어요. FitPoly에서 다시 연결해주세요.', true);
    importButton.disabled = false;
  }
});

try {
  connection = await pendingConnection();
  if (connection) {
    byId('connection').hidden = false;
    byId('company').textContent = connection.company || '지원 기업';
    byId('position').textContent = connection.position || '지원 직무';
    byId('site').textContent = new URL(connection.expectedOrigin).hostname;
    await activeApplicationTab();
    showStatus('자기소개서 입력 화면에서 아래 버튼을 눌러주세요.');
    readButton.disabled = false;
  }
} catch (error) {
  showStatus(error?.message || 'FitPoly 연결을 확인하지 못했어요.', true);
}
