/**
 * useJobRecommendations
 * 기업 공고 기반 경험 추천 호출 상태 관리.
 * - fetchRecommendations(jobAnalysis, experiences?) → 결과 저장
 */
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { recommendExperiences } from '../services/jobAI';

export default function useJobRecommendations() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const fetchRecommendations = useCallback(async (jobAnalysis, experiences) => {
    if (!jobAnalysis) {
      toast.error('연결된 기업 공고가 없습니다');
      return null;
    }
    setLoading(true);
    try {
      const data = await recommendExperiences(jobAnalysis, experiences);
      setResult(data);
      return data;
    } catch {
      toast.error('경험 추천 분석에 실패했습니다');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, result, fetchRecommendations, setResult };
}
