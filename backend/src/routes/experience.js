import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { adminDb } from '../config/firebase.js';
import { requireCredits } from '../services/billingService.js';
import {
  analyzeExperience,
  generateDraftAnalysis,
  extractProduct,
  extractDiagrams,
  generateProfileBoostDraft,
  buildFallbackExperienceAnalysis,
  extractMoments,
  refineKeyExperience,
  refineInterviewAnswer,
  researchMarketMetrics,
  generateInterviewQuestions,
  generateIdentityPatternCandidates,
  judgeEvidenceLabels,
  generateExperienceTags,
} from '../services/geminiService.js';
import { analyzeGitCommits } from '../services/gitAnalysisService.js';
import { logError } from '../services/errorLogger.js';

const router = Router();

const now = () => new Date();

/**
 * Firestore는 배열 속 배열을 거부한다(INVALID_ARGUMENT: invalid nested entity).
 * AI 응답이 섞이는 저장 페이로드를 깊이 순회해 중첩 배열은 문자열로 평탄화하고 undefined는 제거.
 * (배열→객체→배열은 합법이므로 배열 "바로 안"의 배열만 평탄화)
 */
function firestoreSafe(value, insideArray = false) {
  if (value === null || typeof value !== 'object') return value === undefined ? null : value;
  if (Array.isArray(value)) {
    if (insideArray) {
      return value.map(v => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''))).join('\n');
    }
    return value.map(v => firestoreSafe(v, true));
  }
  // Date·Timestamp 등 비순수 객체는 그대로 통과
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    out[k] = firestoreSafe(v, false);
  }
  return out;
}

// 경험 문서 → 태깅용 요약 텍스트
function experienceToTagText(data = {}) {
  const sr = data.structuredResult || {};
  const ov = sr.projectOverview || {};
  const parts = [
    data.title,
    ov.summary, ov.goal, ov.role,
    sr.intro, sr.task, sr.process, sr.output, sr.competency,
    Array.isArray(sr.keywords) ? sr.keywords.join(', ') : '',
    Array.isArray(data.keywords) ? data.keywords.join(', ') : '',
    typeof data.content?.rawInput === 'string' ? data.content.rawInput : '',
  ].filter(Boolean);
  return parts.join('\n').slice(0, 4000);
}

const hasTags = (d = {}) =>
  (Array.isArray(d.competencyTags) && d.competencyTags.length > 0) ||
  (Array.isArray(d.workStyleTags) && d.workStyleTags.length > 0);

function requireExperienceOwner(data, uid, res) {
  if (!data) {
    res.status(404).json({ error: '경험을 찾을 수 없습니다.' });
    return false;
  }
  if (data.userId !== uid) {
    res.status(403).json({ error: '접근 권한이 없습니다.' });
    return false;
  }
  return true;
}

// POST /api/experience/analyze - AI 경험 구조화
router.post('/analyze', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
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
      analysis = await analyzeExperience(data.content || {}, count, moments, data.jobCategory || 'common', data.careerStage || 'first');
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
        // 재분석 시 유실 방지: GitHub 기여도는 항상, 아키텍처·시각화는 새로 안 만들어졌을 때만 보존
        analysis.githubStats = data.structuredResult?.githubStats || analysis.githubStats || null;
        analysis.architectureDiagram = analysis.architectureDiagram || data.structuredResult?.architectureDiagram || null;
        analysis.flowDiagram = data.structuredResult?.flowDiagram || analysis.flowDiagram || null;
        analysis.readme = data.structuredResult?.readme || analysis.readme || null;
        analysis.overviewDoc = data.structuredResult?.overviewDoc || analysis.overviewDoc || null;
        analysis.product = analysis.product || data.structuredResult?.product || null;
        analysis.portfolioVisuals = analysis.portfolioVisuals || data.structuredResult?.portfolioVisuals || null;
        analysis.leanCanvas = data.structuredResult?.leanCanvas || analysis.leanCanvas || null;
        analysis.pmHypotheses = data.structuredResult?.pmHypotheses || analysis.pmHypotheses || null;
        analysis.pmFiles = data.structuredResult?.pmFiles || analysis.pmFiles || null;
        analysis.interviewPlan = data.structuredResult?.interviewPlan || analysis.interviewPlan || null;
        analysis.interviewSession = data.structuredResult?.interviewSession || analysis.interviewSession || null;
        analysis.deliverables = data.structuredResult?.deliverables || analysis.deliverables || [];
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

    // 재분석 시 유실 방지: GitHub 기여도·분석원본은 항상, 아키텍처·시각화는 새로 안 만들어졌을 때만 보존
    analysis.githubStats = data.structuredResult?.githubStats || analysis.githubStats || null;
    analysis.gitAnalysis = data.structuredResult?.gitAnalysis || analysis.gitAnalysis || null;
    analysis.architectureDiagram = analysis.architectureDiagram || data.structuredResult?.architectureDiagram || null;
    analysis.flowDiagram = data.structuredResult?.flowDiagram || analysis.flowDiagram || null;
    analysis.readme = data.structuredResult?.readme || analysis.readme || null;
    analysis.overviewDoc = data.structuredResult?.overviewDoc || analysis.overviewDoc || null;
    analysis.product = analysis.product || data.structuredResult?.product || null;
    analysis.portfolioVisuals = analysis.portfolioVisuals || data.structuredResult?.portfolioVisuals || null;
    analysis.leanCanvas = data.structuredResult?.leanCanvas || analysis.leanCanvas || null;
    analysis.pmHypotheses = data.structuredResult?.pmHypotheses || analysis.pmHypotheses || null;
    analysis.pmFiles = data.structuredResult?.pmFiles || analysis.pmFiles || null;
    analysis.interviewPlan = data.structuredResult?.interviewPlan || analysis.interviewPlan || null;
    analysis.interviewSession = data.structuredResult?.interviewSession || analysis.interviewSession || null;
    analysis.deliverables = data.structuredResult?.deliverables || analysis.deliverables || [];

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
router.post('/draft', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
  try {
    const { content, jobCategory, careerStage, interviewMode } = req.body;
    if (!content || typeof content !== 'object' || Object.keys(content).length === 0) {
      return res.status(400).json({ error: 'content가 필요합니다' });
    }
    const analysis = await generateDraftAnalysis(
      content,
      jobCategory || 'common',
      careerStage || 'first',
      interviewMode || 'basic',
    );
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

// POST /api/experience/extract-product - 자료에서 서비스(아이템) 설명(product)만 경량 추출
// 전체 초안이 응답 과대로 실패하는 경우에도 안정적으로 서비스 문제정의를 뽑기 위한 전용 경로.
router.post('/extract-product', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
  try {
    const material = req.body?.material;
    if (!material || !String(material).trim()) {
      return res.status(400).json({ error: '자료가 필요합니다' });
    }
    // product(필수·서비스 전용)와 다이어그램(best-effort)을 각각 집중된 프롬프트로 분리 추출 (병렬).
    // 다이어그램 실패는 무시 — 개발 프레이밍을 product 추출과 섞지 않는 게 핵심.
    const diagramsPromise = extractDiagrams(material).catch((e) => {
      console.warn('[extract-product] 다이어그램 추출 실패(무시):', e.message);
      return { architectureDiagram: null, flowDiagram: null };
    });
    // product도 best-effort로 취급한다. 이 경로는 전체 초안이 비었을 때의 보강용이고,
    // 호출부(ExperienceChat)는 실패를 이미 무시한다. 여기서 502를 내면 사용자 화면은
    // 그대로인데 오류 로그만 쌓였다(2026-08 오류로그). 실패는 warn으로만 남긴다.
    const productPromise = extractProduct(material).catch((e) => {
      // 쿼터 초과만은 사용자에게 알려야 하므로 그대로 던져 아래 429 분기를 태운다.
      const m = e.message || '';
      if (m.includes('429') || m.includes('quota') || m.includes('RESOURCE_EXHAUSTED') || m.includes('요청 한도')) {
        throw e;
      }
      console.warn('[extract-product] 서비스 설명 추출 실패(폴백 없음):', m);
      logError({
        source: 'server',
        level: 'warn',
        path: '/experience/extract-product',
        method: 'POST',
        message: `서비스 설명 추출 실패: ${e.message}`,
        userId: req.user?.uid,
        userEmail: req.user?.email,
      });
      return null;
    });
    const [product, diagrams] = await Promise.all([productPromise, diagramsPromise]);
    res.json({
      product,
      architectureDiagram: diagrams.architectureDiagram || null,
      flowDiagram: diagrams.flowDiagram || null,
    });
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('요청 한도')) {
      return res.status(429).json({ error: 'AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' });
    }
    return res.status(502).json({ error: '서비스 설명 추출에 실패했습니다. 잠시 후 다시 시도해주세요.', detail: msg });
  }
});

// POST /api/experience/boost-draft - 경험정리+프로필+공고로 빈 섹션 초안 생성
router.post('/boost-draft', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
  try {
    const { profile, jobAnalysis } = req.body || {};
    const snapshot = await adminDb.collection('experiences')
      .where('userId', '==', req.user.uid)
      .get();
    const experiences = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const draft = await generateProfileBoostDraft({
      profile: profile || {},
      experiences,
      jobAnalysis: jobAnalysis || null,
    });
    res.json(draft);
  } catch (error) {
    const msg = error.message || '';
    const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('요청 한도') || msg.includes('RESOURCE_EXHAUSTED');
    if (isQuota) {
      return res.status(429).json({ error: 'AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' });
    }
    next(error);
  }
});

// POST /api/experience/identity-patterns/suggest
// 서로 다른 경험 2개 이상에서 반복된 행동만 후보로 만들며, 아직 사용자 정체성으로 확정하지 않는다.
router.post('/identity-patterns/suggest', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
  try {
    const snapshot = await adminDb.collection('experiences')
      .where('userId', '==', req.user.uid)
      .get();
    const experiences = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (experiences.length < 2) {
      return res.json({
        candidates: [],
        reason: '서로 다른 경험이 2개 이상 쌓이면 반복 패턴을 찾을 수 있어요.',
      });
    }
    const profileRef = adminDb.collection('profiles').doc(req.user.uid);
    const profileSnap = await profileRef.get();
    const identityProfile = profileSnap.data()?.experienceIdentityProfile || {};
    const approvedIds = new Set((identityProfile.approvedPatterns || []).map(item => item?.id).filter(Boolean));
    const dismissedIds = new Set((identityProfile.dismissedPatternIds || []).filter(Boolean));
    const candidates = (await generateIdentityPatternCandidates(experiences))
      .filter(candidate => !approvedIds.has(candidate.id) && !dismissedIds.has(candidate.id));
    await profileRef.set({
      experienceIdentityProfile: {
        ...identityProfile,
        pendingPatterns: candidates,
        lastSuggestedAt: new Date(),
      },
    }, { merge: true });
    res.json({
      candidates,
      approvedPatterns: identityProfile.approvedPatterns || [],
    });
  } catch (error) {
    next(error);
  }
});

router.post('/identity-patterns/dismiss', authMiddleware, async (req, res, next) => {
  try {
    const candidateId = String(req.body?.candidateId || '').trim();
    if (!candidateId) return res.status(400).json({ error: 'candidateId가 필요합니다' });
    const profileRef = adminDb.collection('profiles').doc(req.user.uid);
    await adminDb.runTransaction(async transaction => {
      const snap = await transaction.get(profileRef);
      const data = snap.data() || {};
      const identityProfile = data.experienceIdentityProfile || {};
      const pending = Array.isArray(identityProfile.pendingPatterns) ? identityProfile.pendingPatterns : [];
      const dismissed = Array.isArray(identityProfile.dismissedPatternIds)
        ? identityProfile.dismissedPatternIds
        : [];
      transaction.set(profileRef, {
        experienceIdentityProfile: {
          ...identityProfile,
          dismissedPatternIds: [...new Set([...dismissed, candidateId])],
          pendingPatterns: pending.filter(item => item?.id !== candidateId),
          updatedAt: new Date(),
        },
      }, { merge: true });
    });
    res.json({ dismissed: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/experience/identity-patterns/approve
// AI 후보는 사용자가 명시적으로 승인한 뒤에만 개인 정체성으로 저장한다.
router.post('/identity-patterns/approve', authMiddleware, async (req, res, next) => {
  try {
    const candidateId = String(req.body?.candidateId || '').trim();
    if (!candidateId) return res.status(400).json({ error: 'candidateId가 필요합니다' });
    const profileRef = adminDb.collection('profiles').doc(req.user.uid);
    let approvedPattern = null;
    await adminDb.runTransaction(async transaction => {
      const snap = await transaction.get(profileRef);
      const data = snap.data() || {};
      const identityProfile = data.experienceIdentityProfile || {};
      const pending = Array.isArray(identityProfile.pendingPatterns) ? identityProfile.pendingPatterns : [];
      const candidate = pending.find(item => item?.id === candidateId);
      if (!candidate) {
        const error = new Error('승인할 패턴 후보를 찾을 수 없습니다.');
        error.status = 404;
        throw error;
      }
      const approved = Array.isArray(identityProfile.approvedPatterns)
        ? identityProfile.approvedPatterns
        : [];
      approvedPattern = {
        ...candidate,
        approvedAt: new Date(),
        approvedByUser: true,
      };
      transaction.set(profileRef, {
        experienceIdentityProfile: {
          ...identityProfile,
          approvedPatterns: [
            ...approved.filter(item => item?.id !== candidateId),
            approvedPattern,
          ],
          pendingPatterns: pending.filter(item => item?.id !== candidateId),
          updatedAt: new Date(),
        },
      }, { merge: true });
    });
    res.json({ approved: true, pattern: approvedPattern });
  } catch (error) {
    next(error);
  }
});

// POST /api/experience/interview-questions - 대화형 추출 인터뷰 질문 생성
router.post('/interview-questions', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
  try {
    const { braindump, jobCategory, interviewMode } = req.body;
    if (!braindump || !String(braindump).trim()) {
      return res.status(400).json({ error: '경험 초안이 필요합니다' });
    }
    const plan = await generateInterviewQuestions(
      String(braindump),
      jobCategory || 'common',
      interviewMode || 'basic',
    );
    res.json({ plan, questions: plan.questions || [] });
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('요청 한도') || msg.includes('429') || msg.includes('quota')) {
      return res.status(429).json({ error: 'AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' });
    }
    next(error);
  }
});

// POST /api/experience/enrich-interview - 추출형 인터뷰 답변을 반영해 재분석·보강
router.post('/enrich-interview', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
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
      analysis = await analyzeExperience(augmentedContent, count, moments, data.jobCategory || 'common', data.careerStage || 'first');
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
router.post('/extract-moments', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
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

// POST /api/experience/refine-answer - 인터뷰 답변 판정 + FitPoly 톤 가공 (경험 채우기 채팅)
router.post('/refine-answer', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
  try {
    const { question, answer, sectionLabel, jobCategory } = req.body;
    const q = String(question || '').trim();
    const a = String(answer || '').trim();
    if (!q || !a) {
      return res.status(400).json({ error: 'question과 answer가 필요합니다' });
    }
    const result = await refineInterviewAnswer({
      question: q,
      answer: a.slice(0, 1000),
      sectionLabel: String(sectionLabel || '').slice(0, 50),
      jobCategory: String(jobCategory || 'common'),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/experience/refine-key-experience - 자유 텍스트 기반 핵심 경험 보강
router.post('/refine-key-experience', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
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
router.post('/research-metrics', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
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

// POST /api/experience/evidence-labels - 각 섹션 근거 라벨(사실/추정/가정/해석 + A~D) AI 자동 판단
router.post('/evidence-labels', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
  try {
    const { sections } = req.body;
    if (!sections || typeof sections !== 'object' || Object.keys(sections).length === 0) {
      return res.status(400).json({ error: '판단할 섹션 내용이 없습니다' });
    }
    const result = await judgeEvidenceLabels(sections);
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
      .get();

    const experiences = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
        if (a.sortOrder != null) return -1;
        if (b.sortOrder != null) return 1;
        const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
        return bTime - aTime;
      });

    res.json(experiences);
  } catch (error) {
    next(error);
  }
});

router.post('/reorder', authMiddleware, async (req, res, next) => {
  try {
    const orderedIds = Array.isArray(req.body.orderedIds) ? req.body.orderedIds : [];
    const snaps = await Promise.all(orderedIds.map(id => adminDb.collection('experiences').doc(id).get()));
    if (snaps.some(snap => !snap.exists || snap.data().userId !== req.user.uid)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }
    const batch = adminDb.batch();
    snaps.forEach((snap, idx) => batch.update(snap.ref, { sortOrder: idx, updatedAt: now() }));
    await batch.commit();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/experience/analyze-git - GitHub 커밋 분석으로 경험 스토리 생성
router.post('/analyze-git', authMiddleware, requireCredits, aiRateLimiter, async (req, res, next) => {
  try {
    const { repoUrl, authorParam, githubToken } = req.body;
    if (!repoUrl) return res.status(400).json({ error: 'GitHub 레포지토리 URL이 필요합니다.' });
    if (!authorParam) return res.status(400).json({ error: 'GitHub 사용자명이 필요합니다.' });

    // 서버 GITHUB_TOKEN 폴백 — 무인증(60req/h) 레이트리밋으로 기여도·언어 통계가 자주 비는 문제 방지
    const result = await analyzeGitCommits(repoUrl, authorParam, githubToken || process.env.GITHUB_TOKEN || undefined);
    res.json(result);
  } catch (error) {
    const msg = error.message || '';
    // 실제 원인을 서버 로그와 응답 detail로 노출 (generic 500으로 원인 숨기지 않음)
    console.error('[analyze-git] 실패:', msg, '\n', error.stack);
    if (msg.includes('찾을 수 없습니다') || msg.includes('유효한') || msg.includes('커밋을 찾을 수 없습니다')) {
      return res.status(400).json({ error: msg });
    }
    if (msg.includes('요청 한도') || msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'GitHub 또는 AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.', detail: msg });
    }
    if (msg.includes('API key') || msg.includes('API Key')) {
      return res.status(502).json({ error: 'AI API 키가 유효하지 않습니다. 서버 .env의 GEMINI_API_KEY를 확인해주세요.', detail: msg });
    }
    // 그 외(커밋 분석 실패 등)도 원인 메시지를 담아 반환 → 프론트 토스트로 확인 가능
    return res.status(502).json({ error: msg || 'GitHub 분석에 실패했습니다. 잠시 후 다시 시도해주세요.', detail: msg });
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    // AI 응답(초안·git 분석)이 섞이는 본문은 Firestore가 거부하는 구조(중첩 배열 등)를 깊이 정규화
    const body = firestoreSafe(req.body || {});
    const payload = {
      ...body,
      userId: req.user.uid,
      title: body.title || '',
      framework: body.framework || 'STRUCTURED',
      jobCategory: body.jobCategory || 'common',
      careerStage: body.careerStage || 'first',
      content: body.content || {},
      images: body.images || [],
      keywords: body.keywords || [],
      createdAt: now(),
      updatedAt: now(),
    };
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    const docRef = await adminDb.collection('experiences').add(payload);
    res.status(201).json({ id: docRef.id, ...payload });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const docSnap = await adminDb.collection('experiences').doc(req.params.id).get();
    const data = docSnap.exists ? docSnap.data() : null;
    if (!requireExperienceOwner(data, req.user.uid, res)) return;
    res.json({ id: docSnap.id, ...data });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authMiddleware, async (req, res, next) => {
  try {
    const ref = adminDb.collection('experiences').doc(req.params.id);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;
    if (!requireExperienceOwner(data, req.user.uid, res)) return;
    const update = { ...req.body, userId: req.user.uid, updatedAt: now() };
    delete update.id;
    await ref.update(update);
    res.json({ id: req.params.id, ...data, ...update });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const ref = adminDb.collection('experiences').doc(req.params.id);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;
    if (!requireExperienceOwner(data, req.user.uid, res)) return;
    await ref.delete();
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/experience/auto-tag-all - 태그 없는 경험을 AI로 일괄 자동 태깅(백필)
// force=true면 태그 유무와 무관하게 전부 재태깅. 한 번에 최대 12건 처리 후 남은 수 반환.
router.post('/auto-tag-all', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const force = req.body?.force === true;
    const snap = await adminDb.collection('experiences').where('userId', '==', req.user.uid).get();
    const targets = snap.docs.filter(d => force || !hasTags(d.data()));
    const batchDocs = targets.slice(0, 12);

    let tagged = 0;
    const results = [];
    for (const doc of batchDocs) {
      const data = doc.data();
      const { competencyTags, workStyleTags } = await generateExperienceTags(experienceToTagText(data));
      if (competencyTags.length || workStyleTags.length) {
        await doc.ref.update({ competencyTags, workStyleTags, updatedAt: now() });
        tagged++;
        results.push({ id: doc.id, competencyTags, workStyleTags });
      }
    }
    res.json({ tagged, processed: batchDocs.length, remaining: Math.max(0, targets.length - batchDocs.length), results });
  } catch (error) {
    next(error);
  }
});

export default router;
