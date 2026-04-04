import { Router } from 'express';
import { adminDb as db } from '../config/firebase.js';
import {
  scrapeJobPosting,
  analyzeJobPosting,
  matchExperiencesToJob,
  generateTailoredCoverLetter,
  generateTailoredPortfolio,
  tailorExperienceContent,
} from '../services/jobAnalysisService.js';

const router = Router();

// ── 채용공고 분석 ──────────────────────────────────────
router.post('/analyze', async (req, res) => {
  try {
    const { url, text } = req.body;
    if (!url && !text) {
      return res.status(400).json({ error: 'URL 또는 채용공고 텍스트가 필요합니다' });
    }

    let postingText = text;
    let scrapedUrl = url || null;

    // URL이 있으면 스크래핑
    if (url && !text) {
      postingText = await scrapeJobPosting(url);
    }

    // Gemini로 구조화 분석
    const analysis = await analyzeJobPosting(postingText);
    analysis._scrapedUrl = scrapedUrl;

    res.json({ analysis });
  } catch (err) {
    console.error('[Job] 분석 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 경험 매칭 분석 ─────────────────────────────────────
router.post('/match', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { jobAnalysis } = req.body;
    if (!jobAnalysis) {
      return res.status(400).json({ error: '채용공고 분석 결과가 필요합니다' });
    }

    // Firestore에서 사용자 경험 조회
    const expSnap = await db.collection('experiences')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    const experiences = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Firestore에서 최신 포트폴리오 조회
    const portSnap = await db.collection('portfolios')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    const portfolio = portSnap.empty ? null : portSnap.docs[0].data();

    const matchResult = await matchExperiencesToJob(jobAnalysis, experiences, portfolio);
    matchResult._experienceCount = experiences.length;

    res.json({ matchResult, experiences: experiences.map(e => ({ id: e.id, title: e.title })) });
  } catch (err) {
    console.error('[Job] 매칭 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 맞춤 자소서 생성 ──────────────────────────────────
router.post('/generate-coverletter', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { jobAnalysis, matchResult } = req.body;
    if (!jobAnalysis || !matchResult) {
      return res.status(400).json({ error: '분석 결과와 매칭 결과가 필요합니다' });
    }

    const expSnap = await db.collection('experiences')
      .where('userId', '==', userId)
      .get();
    const experiences = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const portSnap = await db.collection('portfolios')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    const portfolio = portSnap.empty ? null : portSnap.docs[0].data();

    const coverLetter = await generateTailoredCoverLetter(jobAnalysis, matchResult, experiences, portfolio);
    res.json({ coverLetter });
  } catch (err) {
    console.error('[Job] 자소서 생성 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 맞춤 포트폴리오 제안 ──────────────────────────────
router.post('/generate-portfolio', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { jobAnalysis, matchResult } = req.body;
    if (!jobAnalysis || !matchResult) {
      return res.status(400).json({ error: '분석 결과와 매칭 결과가 필요합니다' });
    }

    const expSnap = await db.collection('experiences')
      .where('userId', '==', userId)
      .get();
    const experiences = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const portSnap = await db.collection('portfolios')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    const portfolio = portSnap.empty ? null : portSnap.docs[0].data();

    const portfolioSuggestion = await generateTailoredPortfolio(jobAnalysis, matchResult, experiences, portfolio);
    res.json({ portfolioSuggestion });
  } catch (err) {
    console.error('[Job] 포트폴리오 제안 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 경험 내용을 기업에 맞게 재작성 ────────────────────
router.post('/tailor-experience', async (req, res) => {
  try {
    const { jobAnalysis, experience } = req.body;
    if (!jobAnalysis || !experience) {
      return res.status(400).json({ error: '기업 분석 결과와 경험 데이터가 필요합니다' });
    }
    const tailored = await tailorExperienceContent(jobAnalysis, experience);
    res.json({ tailored });
  } catch (err) {
    console.error('[Job] 경험 맞춤화 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 분석 결과 저장 ────────────────────────────────────
router.post('/save', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { jobAnalysis, matchResult, coverLetter, portfolioSuggestion } = req.body;

    const docRef = await db.collection('jobMatches').add({
      userId,
      jobAnalysis,
      matchResult,
      coverLetter: coverLetter || null,
      portfolioSuggestion: portfolioSuggestion || null,
      createdAt: new Date(),
    });

    res.json({ id: docRef.id });
  } catch (err) {
    console.error('[Job] 저장 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 저장된 매칭 목록 ──────────────────────────────────
router.get('/list', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const snap = await db.collection('jobMatches')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    const items = snap.docs.map(d => ({
      id: d.id,
      company: d.data().jobAnalysis?.company,
      position: d.data().jobAnalysis?.position,
      overallFitScore: d.data().matchResult?.overallFitScore,
      createdAt: d.data().createdAt,
    }));
    res.json({ items });
  } catch (err) {
    console.error('[Job] 목록 조회 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
