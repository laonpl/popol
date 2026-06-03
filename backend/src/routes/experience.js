import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { adminDb } from '../config/firebase.js';
import {
  analyzeExperience,
  generateDraftAnalysis,
  buildFallbackExperienceAnalysis,
  extractMoments,
  refineKeyExperience,
  researchMarketMetrics,
  generateInterviewQuestions,
} from '../services/geminiService.js';
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
      const hasFallbackInput = (moments && moments.length > 0)
        || Object.values(data.content || {}).some(value => String(value || '').trim());
      if (hasFallbackInput) {
        analysis = buildFallbackExperienceAnalysis(
          data.content || {},
          count,
          moments,
          data.jobCategory || 'common',
          {
            title: data.title || '',
            period: data.period || '',
            reason: errMsg.slice(0, 240),
          }
        );
        await docRef.update({
          structuredResult: analysis,
          keywords: analysis.keywords || [],
          highlights: analysis.highlights || [],
          updatedAt: new Date(),
        });
        return res.json(analysis);
      }
      console.error('Gemini AI 분석 실패 (최종):', errMsg);
      // 내용 비어있음 에러는 400으로
      if (errMsg.includes('비어있습니다')) {
        return res.status(400).json({ error: aiError.message });
      }
      // API 키 에러 구분
      if (errMsg.includes('API key') || errMsg.includes('API Key')) {
        return res.status(502).json({ error: 'Vertex AI/Gemini API 키가 유효하지 않습니다. 서버 .env 파일의 GEMINI_API_KEY를 확인해주세요.', detail: errMsg });
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

// POST /api/experience/draft - 빠른 초안 생성 (flash 1회, 검색 없음)
// 경험 생성 전 호출되므로 experienceId 없이 content를 직접 받는다.
// 실패 시 502 → 프론트가 로컬 초안(buildDraftStructuredResult)으로 폴백.
router.post('/draft', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const { content, jobCategory } = req.body;
    if (!content || typeof content !== 'object' || Object.keys(content).length === 0) {
      return res.status(400).json({ error: 'content가 필요합니다' });
    }
    const analysis = await generateDraftAnalysis(content, jobCategory || 'common');
    res.json(analysis);
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('비어있습니다')) {
      return res.status(400).json({ error: msg });
    }
    const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('요청 한도') || msg.includes('RESOURCE_EXHAUSTED');
    if (isQuota) {
      return res.status(429).json({ error: 'AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' });
    }
    // 그 외 실패는 프론트 로컬 폴백을 유도 (502)
    console.warn('[Draft] 빠른 초안 생성 실패 → 프론트 로컬 폴백 유도:', msg);
    return res.status(502).json({ error: '초안 생성에 실패했습니다.', detail: msg });
  }
});

// POST /api/experience/interview-questions - 대화형 추출 인터뷰 질문 생성
router.post('/interview-questions', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const { braindump, jobCategory } = req.body;
    if (!braindump || !String(braindump).trim()) {
      return res.status(400).json({ error: '경험 초안이 필요합니다' });
    }
    const questions = await generateInterviewQuestions(String(braindump), jobCategory || 'common');
    res.json({ questions });
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('요청 한도') || msg.includes('429') || msg.includes('quota')) {
      return res.status(429).json({ error: 'AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' });
    }
    next(error);
  }
});

// POST /api/experience/enrich-interview - 추출형 인터뷰 답변을 반영해 재분석·보강
router.post('/enrich-interview', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const { experienceId, qa } = req.body;
    if (!experienceId || !Array.isArray(qa)) {
      return res.status(400).json({ error: 'experienceId와 qa가 필요합니다' });
    }
    const answered = qa
      .map(item => ({ question: String(item?.question || '').trim(), answer: String(item?.answer || '').trim() }))
      .filter(item => item.answer);
    if (answered.length === 0) {
      return res.status(400).json({ error: '답변이 하나 이상 필요합니다' });
    }

    const docRef = adminDb.collection('experiences').doc(experienceId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: '경험을 찾을 수 없습니다' });
    const data = docSnap.data();
    if (data.userId !== req.user.uid) return res.status(403).json({ error: '접근 권한이 없습니다' });

    // 인터뷰 답변을 추가 자료로 content에 합쳐 재분석 (원본은 유지, 답변만 보강 근거로)
    const interviewText = answered.map(item => `Q. ${item.question}\n→ ${item.answer}`).join('\n\n');
    const augmentedContent = { ...(data.content || {}), 추가인터뷰_보강자료: interviewText };

    const structuredMoments = Array.isArray(data.structuredResult?.keyExperiences) && data.structuredResult.keyExperiences.length > 0
      ? data.structuredResult.keyExperiences
      : null;
    const moments = Array.isArray(data.reviewedMoments) && data.reviewedMoments.length > 0
      ? data.reviewedMoments
      : structuredMoments;
    const count = moments ? moments.length : (data.momentsCount || 3);

    let analysis;
    try {
      analysis = await analyzeExperience(augmentedContent, count, moments, data.jobCategory || 'common');
    } catch (aiError) {
      const errMsg = aiError.message || '';
      const hasFallbackInput = (moments && moments.length > 0)
        || Object.values(augmentedContent || {}).some(value => String(value || '').trim());
      if (hasFallbackInput) {
        analysis = buildFallbackExperienceAnalysis(
          augmentedContent,
          count,
          moments,
          data.jobCategory || 'common',
          {
            title: data.title || '',
            period: data.period || '',
            reason: errMsg.slice(0, 240),
          }
        );
        await docRef.update({
          structuredResult: analysis,
          keywords: analysis.keywords || [],
          highlights: analysis.highlights || [],
          followupAnswers: answered,
          updatedAt: new Date(),
        });
        return res.json(analysis);
      }
      if (errMsg.includes('요청 한도') || errMsg.includes('429') || errMsg.includes('quota')) {
        return res.status(429).json({ error: 'AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' });
      }
      return res.status(502).json({ error: 'AI 보강에 실패했습니다. 잠시 후 다시 시도해주세요.', detail: errMsg });
    }

    await docRef.update({
      structuredResult: analysis,
      keywords: analysis.keywords || [],
      highlights: analysis.highlights || [],
      followupAnswers: answered,
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

// POST /api/experience/refine-key-experience - 자유 텍스트 기반 핵심 경험 보강
router.post('/refine-key-experience', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const { currentExp, freeFormText } = req.body;
    if (!freeFormText || !currentExp) {
      return res.status(400).json({ error: '데이터가 부족합니다' });
    }
    const refined = await refineKeyExperience(currentExp, freeFormText);
    res.json(refined);
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('요청 한도')) return res.status(429).json({ error: msg });
    next(error);
  }
});

// POST /api/experience/research-metrics - AI 시장/지표 리서치 (최신 뉴스·지표·논문)
router.post('/research-metrics', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const { title, sections, keywords, projectOverview, jobCategory } = req.body;
    if (!title && !(sections && Object.keys(sections).length)) {
      return res.status(400).json({ error: '리서치할 프로젝트 내용이 부족합니다' });
    }
    const result = await researchMarketMetrics({ title, sections, keywords, projectOverview, jobCategory });
    res.json(result);
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('요청 한도')) return res.status(429).json({ error: msg });
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
