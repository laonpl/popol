/**
 * useAITailoring
 * 경험 하나를 기업/직무에 맞춰 재작성하는 흐름의 상태 관리.
 * - tailor(jobAnalysis, experience, meta?) → 결과 저장
 *   meta 인자는 결과에 함께 저장돼서 호출부에서 인덱스/ID를 붙일 때 사용.
 * - applyTailor(): 결과를 소비한 뒤 상태 초기화.
 */
import { useState, useCallback } from 'react';
import { tailorExperience as tailorExperienceAPI } from '../services/jobAI';

export default function useAITailoring() {
  const [tailoring, setTailoring] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const tailor = useCallback(async (jobAnalysis, experience, meta = null) => {
    if (!jobAnalysis) {
      setError('연결된 기업 공고가 없습니다');
      return null;
    }
    setTailoring(true);
    setError(null);
    try {
      const data = await tailorExperienceAPI(jobAnalysis, experience);
      const next = meta ? { ...data, ...meta } : data;
      setResult(next);
      return next;
    } catch (err) {
      const msg = err.response?.data?.error || 'AI 첨삭에 실패했습니다';
      setError(msg);
      throw err;
    } finally {
      setTailoring(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { tailoring, result, error, tailor, reset, setResult };
}
