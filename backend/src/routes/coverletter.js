import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminDb } from '../config/firebase.js';
import { generateCoverLetterDraft } from '../services/geminiService.js';

const router = Router();

// POST /api/coverletter/generate - AI 자소서 초안 생성
router.post('/generate', authMiddleware, async (req, res, next) => {
  try {
    const { coverLetterId, questionIndex } = req.body;

    if (!coverLetterId || questionIndex === undefined) {
      return res.status(400).json({ error: 'coverLetterId와 questionIndex가 필요합니다' });
    }

    const clSnap = await adminDb.collection('coverLetters').doc(coverLetterId).get();
    if (!clSnap.exists) {
      return res.status(404).json({ error: '자기소개서를 찾을 수 없습니다' });
    }

    const clData = clSnap.data();
    if (clData.userId !== req.user.uid) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const question = clData.questions?.[questionIndex];
    if (!question) {
      return res.status(400).json({ error: '해당 문항을 찾을 수 없습니다' });
    }

    // 연결된 경험 데이터 가져오기
    const linkedIds = question.linkedExperienceIds || [];
    let linkedExperiences = [];
    if (linkedIds.length > 0) {
      const snapshots = await Promise.all(
        linkedIds.map(eid => adminDb.collection('experiences').doc(eid).get())
      );
      linkedExperiences = snapshots
        .filter(s => s.exists)
        .map(s => ({ id: s.id, ...s.data() }));
    }

    const draft = await generateCoverLetterDraft(
      question.question,
      linkedExperiences,
      clData.targetCompany,
      clData.targetPosition
    );

    res.json({ draft });
  } catch (error) {
    // 429/AI 실패 시에도 폴백이 이미 geminiService에서 처리됨
    next(error);
  }
});

export default router;
