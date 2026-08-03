import { track } from '@vercel/analytics';
import api from './api';

function getSessionId() {
  const key = 'fitpoly-analytics-session';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function trackActivation(name, properties = {}) {
  const clean = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  clean.sessionId = getSessionId();
  clean.path = window.location.pathname.slice(0, 120);
  if (import.meta.env?.DEV) console.debug('[activation]', name, clean);
  try {
    track(name, { ...clean, schemaVersion: 1 });
  } catch {
    // 분석 실패가 핵심 사용자 흐름을 막지 않게 한다.
  }
  api.post('/analytics/event', {
    eventName: name,
    properties: clean,
    clientOccurredAt: new Date().toISOString(),
  }).catch(() => {
    // 자체 사건 저장 실패도 핵심 사용자 흐름을 막지 않게 한다.
  });
}
