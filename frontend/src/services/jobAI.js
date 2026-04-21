/**
 * jobAI.js
 * AI 기반 채용공고 분석/맞춤 변환/추천 API 클라이언트.
 * 뷰 컴포넌트가 api.post 직접 호출하지 않고 이 모듈을 거치도록 중개.
 * 순수 함수 — 상태 없이 data 반환, 실패 시 throw.
 */
import api from './api';

/** 채용공고 분석. url 또는 text 하나를 받는다. */
export async function analyzeJob({ url, text } = {}) {
  const payload = {};
  if (url) payload.url = url.trim();
  if (text) payload.text = text.trim();
  const { data } = await api.post('/job/analyze', payload);
  return data; // { analysis, ... }
}

/** URL 단축 헬퍼. */
export async function analyzeJobUrl(url) {
  return analyzeJob({ url });
}

/** 한 경험(exp)을 기업/직무에 맞춰 재작성. */
export async function tailorExperience(jobAnalysis, experience) {
  const { data } = await api.post('/job/tailor-experience', { jobAnalysis, experience });
  return data;
}

/** 포트폴리오 섹션 전체를 기업 맞춤형으로 재작성. */
export async function tailorPortfolio(jobAnalysis, sections, options = {}) {
  const { data } = await api.post('/job/tailor-portfolio', { jobAnalysis, sections }, {
    timeout: 120000,
    ...options,
  });
  return data;
}

/** 직무 요건 기반 경험 추천. 백엔드가 userId로 직접 경험을 조회하므로 jobAnalysis만 전송. */
export async function recommendExperiences(jobAnalysis) {
  if (!jobAnalysis || typeof jobAnalysis !== 'object') {
    throw new Error('기업 분석 결과가 없습니다');
  }
  const { data } = await api.post('/job/recommend-experiences', { jobAnalysis });
  return data;
}

/** 포트폴리오 섹션별(스킬/가치관 등) 맞춤 문구 추천. */
export async function recommendSection(jobAnalysis, sectionType) {
  const { data } = await api.post('/job/recommend-section', { jobAnalysis, sectionType });
  return data;
}
