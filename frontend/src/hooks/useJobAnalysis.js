/**
 * useJobAnalysis
 * 채용공고 URL 분석의 loading / error 상태를 감쌈.
 * - onSuccess(analysis): 성공 시 후처리 (store 업데이트 / UI 초기화 등)
 *   실패 시 error 문자열에 메시지 담김.
 */
import { useState, useCallback } from 'react';
import { analyzeJobUrl } from '../services/jobAI';

export default function useJobAnalysis(onSuccess) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const analyze = useCallback(async (url) => {
    if (!url?.trim()) return null;
    setAnalyzing(true);
    setError(null);
    try {
      const resp = await analyzeJobUrl(url);
      onSuccess?.(resp.analysis, resp);
      return resp.analysis;
    } catch (err) {
      const msg = err.response?.data?.error || '분석에 실패했습니다';
      setError(msg);
      throw err;
    } finally {
      setAnalyzing(false);
    }
  }, [onSuccess]);

  return { analyzing, error, analyze, setError };
}
