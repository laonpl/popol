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
      console.error('Gemini AI 분석 실패:', aiError.message);
      return res.status(502).json({ error: 'AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요.' });
    }

    // 분석 결과를 Firestore에 저장
    await docRef.update({
      structuredResult: analysis,
      keywords: analysis.keywords || [],
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
