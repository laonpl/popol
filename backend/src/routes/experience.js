import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { adminDb } from '../config/firebase.js';
import { analyzeExperience, extractMoments } from '../services/geminiService.js';
import { analyzeGitCommits } from '../services/gitAnalysisService.js';

const router = Router();

// POST /api/experience/analyze - AI 경험 구조화
router.post('/analyze', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const { experienceId, momentsCount, reviewedMoments } = req.body;
    if (!experienceId) {
      return res.status(400).json({ error: 'experienceId가 필요합니다' });
    }

    const docRef = adminDb.collection('experiences').doc(experienceId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: '경험을 찾을 수 없습니다' });
    }

    const data = docSnap.data();

    // 본인 데이터만 접근 가능
    if (data.userId !== req.user.uid) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // 검토된 moments: 요청 바디 → Firestore 저장값 순으로 fallback
    const moments = Array.isArray(reviewedMoments) && reviewedMoments.length > 0
      ? reviewedMoments
      : (Array.isArray(data.reviewedMoments) ? data.reviewedMoments : null);

    // momentsCount: moments 길이 → 요청 바디 → Firestore 저장값 순으로 fallback
    const count = moments
      ? moments.length
      : ((momentsCount && Number.isInteger(Number(momentsCount)))
          ? Number(momentsCount)
          : (data.momentsCount || 3));

    let analysis;
    try {
      analysis = await analyzeExperience(data.content || {}, count, moments, data.jobCategory || 'common');
    } catch (aiError) {
      const errMsg = aiError.message || '';
      console.error('Gemini AI 분석 실패 (최종):', errMsg);
      // 내용 비어있음 에러는 400으로
      if (errMsg.includes('비어있습니다')) {
        return res.status(400).json({ error: aiError.message });
      }
      // API 키 에러 구분
      if (errMsg.includes('API key') || errMsg.includes('API Key')) {
        return res.status(502).json({ error: 'Gemini API 키가 유효하지 않습니다. 서버 .env 파일의 GEMINI_API_KEY를 확인해주세요.', detail: errMsg });
      }
      // Gemini 모델 미지원 에러
      const isModelError = errMsg.includes('no longer available') || errMsg.includes('404') || errMsg.includes('deprecated');
      if (isModelError) {
        return res.status(502).json({ error: 'AI 모델을 사용할 수 없습니다. API 키 또는 모델 설정을 확인해주세요.', detail: errMsg });
      }
      // 쿼터 초과 에러
      const isQuotaError = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
      if (isQuotaError) {
        return res.status(429).json({ error: 'AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.', detail: errMsg });
      }
      return res.status(502).json({ error: 'AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요.', detail: errMsg });
    }

    // 분석 결과를 Firestore에 저장
    await docRef.update({
      structuredResult: analysis,
      keywords: analysis.keywords || [],
      highlights: analysis.highlights || [],
      updatedAt: new Date(),
    });

    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

// POST /api/experience/extract-moments - 핵심 경험 순간 추출 (검토 단계용)
router.post('/extract-moments', authMiddleware, async (req, res, next) => {
  try {
    const { rawText, title } = req.body;
    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({ error: '분석할 텍스트가 필요합니다' });
    }
    const moments = await extractMoments(rawText, title);
    res.json({ moments });
  } catch (error) {
    next(error);
  }
});

// GET /api/experience/list - 경험 목록 조회
router.get('/list', authMiddleware, async (req, res, next) => {
  try {
    const snapshot = await adminDb.collection('experiences')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .get();

    const experiences = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(experiences);
  } catch (error) {
    next(error);
  }
});

// POST /api/experience/analyze-git - GitHub 커밋 분석으로 경험 스토리 생성
router.post('/analyze-git', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const { repoUrl, authorParam, githubToken } = req.body;
    if (!repoUrl) return res.status(400).json({ error: 'GitHub 레포지토리 URL이 필요합니다.' });
    if (!authorParam) return res.status(400).json({ error: 'GitHub 사용자명이 필요합니다.' });

    const result = await analyzeGitCommits(repoUrl, authorParam, githubToken || undefined);
    res.json(result);
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('찾을 수 없습니다') || msg.includes('유효한') || msg.includes('커밋을 찾을 수 없습니다')) {
      return res.status(400).json({ error: msg });
    }
    if (msg.includes('요청 한도')) return res.status(429).json({ error: msg });
    next(error);
  }
});

export default router;
