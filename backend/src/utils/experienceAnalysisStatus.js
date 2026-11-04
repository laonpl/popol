import { getAiErrorStatus } from './aiError.js';

// Only safe, actionable diagnostics leave the server. Provider messages can contain input text.
export function experienceAnalysisIssue(error, stage = 'keyExperiences', index = null) {
  const status = getAiErrorStatus(error);
  const code = String(error?.code || '');
  let issue;
  if (status === 402 || /CREDIT|BILLING/i.test(code)) {
    issue = { code: 'CREDITS_REQUIRED', status: 402, message: '분석에 필요한 크레딧이 부족해요.' };
  } else if (status === 429) {
    issue = { code: 'AI_RATE_LIMIT', status: 429, message: 'AI 요청 한도에 도달했어요. 잠시 후 다시 시도해주세요.' };
  } else if (status === 401 || status === 403 || code === 'BEDROCK_AUTH') {
    issue = { code: 'AI_CONFIGURATION', status: 503, message: 'AI 서버의 인증 또는 모델 접근 설정 문제로 분석하지 못했어요.' };
  } else if (status === 504 || status === 408 || /타임아웃|timeout|QUEUE_TIMEOUT/i.test(error?.message || '')) {
    issue = { code: 'AI_TIMEOUT', status: 504, message: 'AI 응답 시간이 초과됐어요. 저장된 자료로 다시 시도할 수 있어요.' };
  } else if (code === 'AI_EMPTY_EXPERIENCES') {
    issue = { code, status: 422, message: '자료에서 분석 가능한 핵심 경험을 추출하지 못했어요. 본인이 한 일과 결과를 확인해주세요.' };
  } else if (code === 'AI_INVALID_RESPONSE' || /JSON parse failed/i.test(error?.message || '')) {
    issue = { code: 'AI_INVALID_RESPONSE', status: 502, message: 'AI 응답 형식이 올바르지 않아 핵심 경험을 읽지 못했어요. 저장된 자료로 다시 시도할 수 있어요.' };
  } else {
    issue = { code: 'AI_UNAVAILABLE', status: 503, message: 'AI 서비스 연결에 실패했어요. 저장된 자료로 다시 시도할 수 있어요.' };
  }
  return { stage, ...(index == null ? {} : { index }), ...issue, stopBatch: issue.status !== 422 };
}

export function experienceAnalysisError(issues = []) {
  // Account/provider limits should stop the batch even when another subrequest failed to parse.
  const issue = issues.find(row => ['CREDITS_REQUIRED', 'AI_CONFIGURATION', 'AI_RATE_LIMIT', 'AI_TIMEOUT', 'AI_UNAVAILABLE'].includes(row.code))
    || issues[0] || experienceAnalysisIssue({ code: 'AI_EMPTY_EXPERIENCES' });
  return Object.assign(new Error(issue.message), { status: issue.status, code: issue.code, analysisIssues: issues.length ? issues : [issue] });
}

export function hasExtractedExperience(moment) {
  return Boolean(moment && !moment._extractionFailed && ['title', 'context', 'action', 'result', 'learning']
    .some(key => typeof moment[key] === 'string' && moment[key].trim()));
}
