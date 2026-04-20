/**
 * importAI.js
 * 외부 자료(파일/Notion/GitHub) import + 구조화 API 클라이언트.
 * 순수 함수 — 상태 없이 data 반환, 실패 시 throw.
 */
import api from './api';

/** 파일 업로드 → 텍스트 추출. FormData 직접 전달. */
export async function importFileUpload(formData, options = {}) {
  const response = await api.post('/import/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    ...options,
  });
  return response.data;
}

/** URL 기반 import — source는 'notion' | 'github' | 'blog' 등. */
export async function importFromUrl(source, url, targetType) {
  const endpoint = `/import/${source}`;
  const { data } = await api.post(endpoint, { url: url.trim(), targetType }, { timeout: 120000 });
  return data;
}

/** 가져온 원본 데이터를 경험/포트폴리오 구조로 변환. */
export async function structureImportedData(importedData, targetType) {
  const { data } = await api.post('/import/structure', { importedData, targetType }, { timeout: 60000 });
  return data;
}
