import { Router } from 'express';
import { adminDb as db } from '../config/firebase.js';
import {
  scrapeJobPosting,
  analyzeJobPosting,
  matchExperiencesToJob,
  generateTailoredCoverLetter,
  generateTailoredPortfolio,
  tailorExperienceContent,
  tailorPortfolioSections,
  generateWithRetry,
} from '../services/jobAnalysisService.js';
import { callProFirst, parseJSON } from '../services/geminiService.js';

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

// ── 포트폴리오 전체 섹션을 기업 맞춤형으로 재작성 ──────
router.post('/tailor-portfolio', async (req, res) => {
  try {
    const { jobAnalysis, sections } = req.body;
    if (!jobAnalysis || !sections || sections.length === 0) {
      return res.status(400).json({ error: '기업 분석 결과와 섹션 데이터가 필요합니다' });
    }
    const result = await tailorPortfolioSections(jobAnalysis, sections);
    res.json(result);
  } catch (err) {
    console.error('[Job] 포트폴리오 맞춤화 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 분석 결과 저장 ────────────────────────────────────

// ── 섹션별 내용 추천 ──────────────────────────────────
router.post('/recommend-section', async (req, res) => {
  try {
    const { jobAnalysis, sectionType, currentContent } = req.body;
    if (!jobAnalysis || !sectionType) {
      return res.status(400).json({ error: '기업 분석 결과와 섹션 타입이 필요합니다' });
    }

    const sectionLabels = {
      education: '학력/교육',
      awards: '수상 경력',
      experiences: '프로젝트/경험',
      curricular: '교내 활동',
      extracurricular: '교외 활동',
      skills: '기술 스택',
      goals: '목표와 계획',
      values: '가치관/자기소개',
      contact: '연락처',
      interviews: '인터뷰',
      books: '저서/글쓰기',
      lectures: '강연/교육',
      funfacts: '재미있는 사실',
      profile: '프로필/소개',
    };

    const label = sectionLabels[sectionType] || sectionType;

    const prompt = `당신은 포트폴리오 작성 전문 컨설턴트입니다.
아래 기업 분석을 참고하여, "${label}" 섹션에 들어갈 내용을 추천해주세요.

## 기업 분석:
- 기업: ${jobAnalysis.company || '미상'}
- 직무: ${jobAnalysis.position || '미상'}
- 요구 스킬: ${(jobAnalysis.skills || []).join(', ')}
- 핵심 가치: ${(jobAnalysis.coreValues || []).join(', ')}
- 필수 요건: ${(jobAnalysis.requirements?.essential || []).join(', ')}

${currentContent ? `## 현재 작성된 내용:\n${currentContent}\n` : ''}

## 요청:
"${label}" 섹션에 대해 이 기업에 맞는 구체적인 내용 추천 3가지를 제시해주세요.
각 추천은 짧고 실용적이어야 합니다.

반드시 아래 JSON으로만 응답:
{
  "recommendations": [
    {"title": "추천 제목", "content": "구체적인 추천 내용 1-2문장"},
    {"title": "추천 제목", "content": "구체적인 추천 내용 1-2문장"},
    {"title": "추천 제목", "content": "구체적인 추천 내용 1-2문장"}
  ]
}`;

    const raw = await callProFirst(prompt, 'RecommendSection');
    const result = parseJSON(raw);
    res.json(result);
  } catch (err) {
    console.error('[Job] 섹션 추천 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

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

// ── 키워드 기반 경험 추천 ─────────────────────────────
router.post('/recommend-experiences', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { jobAnalysis } = req.body;
    if (!jobAnalysis) {
      return res.status(400).json({ error: '채용공고 분석 결과가 필요합니다' });
    }

    // 사용자 경험 조회
    const expSnap = await db.collection('experiences')
      .where('userId', '==', userId)
      .get();
    const experiences = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (experiences.length === 0) {
      return res.json({ keywords: [], recommendations: [] });
    }

    // 핵심 키워드 3개 + 경험 매칭을 Gemini로 분석
    // GitHub Models(gpt-4o-mini) fallback 대비: 한국어 1~2자/token → 경험당 300자, 전체 3000자 제한
    const expSummaries = experiences.map((exp, i) => {
      const title = (exp.title || '').substring(0, 40);
      const desc = (exp.description || '').substring(0, 80);
      const kw = (exp.keywords || []).slice(0, 5).join(', ');
      const sk = (exp.skills || []).slice(0, 5).join(', ');
      return `[${i}]${title}: ${desc} | ${kw} | ${sk}`;
    }).join('\n').substring(0, 3000);

    const jaSkills = (jobAnalysis.skills || []).slice(0, 6).join(', ');
    const jaValues = (jobAnalysis.coreValues || []).slice(0, 4).join(', ');
    const jaReq = (jobAnalysis.requirements?.essential || []).slice(0, 4).join(', ');

    const prompt = `기업 채용공고를 분석하여 핵심 키워드 3개를 추출하고, 사용자 경험 중 적합한 것을 추천하세요.

기업:${jobAnalysis.company} 직무:${jobAnalysis.position}
스킬:${jaSkills} | 인재상:${jaValues} | 필수:${jaReq}

경험목록:
${expSummaries}

JSON으로만 응답:
{"keywords":[{"keyword":"k1","description":"이유"},{"keyword":"k2","description":"이유"},{"keyword":"k3","description":"이유"}],"recommendations":[{"experienceIndex":0,"matchedKeywords":["k1"],"reason":"추천 이유"}]}`;

    const raw = await callProFirst(prompt, 'RecommendExperiences');
    const result = parseJSON(raw);

    // 경험 정보 붙이기
    const recommendations = (result.recommendations || []).map(r => ({
      ...r,
      experience: experiences[r.experienceIndex] ? {
        id: experiences[r.experienceIndex].id,
        title: experiences[r.experienceIndex].title,
        description: experiences[r.experienceIndex].description,
        keywords: experiences[r.experienceIndex].keywords || [],
        framework: experiences[r.experienceIndex].framework || '',
      } : null,
    })).filter(r => r.experience);

    res.json({ keywords: result.keywords || [], recommendations });
  } catch (err) {
    console.error('[Job] 경험 추천 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
