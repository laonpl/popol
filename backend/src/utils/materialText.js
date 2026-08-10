/**
 * materialText.js
 * 자료 원문(파일·링크·인터뷰 텍스트)을 프롬프트 입력 한도에 맞춰 자르는 유틸.
 */

/**
 * 앞부분만 남기고 자르면 뒤에 덧붙인 "=== AI 추출 핵심 경험 ===" 블록이나
 * 인터뷰 Q&A가 통째로 사라져 결과에 반영되지 않는다.
 * 앞 70% + 뒤 30%를 남기고 가운데를 생략해 서두와 결론을 모두 보존한다.
 *
 * 생략 표기에 숫자를 넣지 않는 이유: 수치 검증(groundAnalysisMetrics)이 원본 텍스트의
 * 숫자 집합으로 성과 수치를 판정하므로, 표기 숫자가 원본 수치로 오인될 수 있다.
 */
export function clampMaterial(text, limit) {
  const value = String(text ?? '');
  if (value.length <= limit) return value;
  const head = Math.floor(limit * 0.7);
  const tail = limit - head;
  return `${value.slice(0, head)}\n\n…(자료 중간 생략)…\n\n${value.slice(-tail)}`;
}
