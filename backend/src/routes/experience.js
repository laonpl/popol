import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminDb } from '../config/firebase.js';
import { analyzeExperience } from '../services/geminiService.js';

const router = Router();

// POST /api/experience/analyze - AI 경험 구조화
router.post('/analyze', authMiddleware, async (req, res, next) => {
  try {
    const { experienceId } = req.body;
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

    let analysis;
    try {
      analysis = await analyzeExperience(data.content || {});
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

export default router;
