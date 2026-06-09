import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { adminDb } from '../config/firebase.js';
import { validatePortfolioWithAI, matchSectionsToRequirements, generateThemedPortfolio } from '../services/geminiService.js';
import { generateAiPptDeck, reviseAiPptSlide } from '../services/geminiPptFunctions.js';

const router = Router();

// 프런트의 인라인 리치 서식(이름/학교명/수상명 등에 굵게·크기 등 적용 시 HTML 태그 저장)을
// 내보내기·AI 입력에서는 평문으로 환원한다. (서식 태그가 슬라이드/텍스트에 그대로 노출되지 않게)
const stripTags = (s) => (typeof s === 'string' ? s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : s);
function stripPortfolioInlineHtml(portfolio) {
  if (!portfolio || typeof portfolio !== 'object') return portfolio;
  ['userName', 'headline', 'portfolioTitle', 'greeting', 'catchphrase'].forEach(f => {
    if (typeof portfolio[f] === 'string') portfolio[f] = stripTags(portfolio[f]);
  });
  const stripItems = (arr, fields) => {
    if (!Array.isArray(arr)) return;
    arr.forEach(item => { if (item && typeof item === 'object') fields.forEach(f => { item[f] = stripTags(item[f]); }); });
  };
  stripItems(portfolio.education, ['school', 'name', 'major', 'degree', 'period', 'detail']);
  stripItems(portfolio.awards, ['title', 'date', 'org', 'detail']);
  stripItems(portfolio.experiences, ['company', 'title', 'period', 'date']);
  stripItems(portfolio.goals, ['title']);
  stripItems(portfolio.activityRecords, ['title', 'date']);
  stripItems(portfolio.customBlocks, ['title', 'content']);
  if (Array.isArray(portfolio.interests)) portfolio.interests = portfolio.interests.map(stripTags);
  return portfolio;
}

function aiPptErrorResponse(error) {
  const message = String(error?.message || error || '');
  if (/GEMINI_API_KEY|GOOGLE_API_KEY|VERTEX_AI_PROJECT_ID|VERTEX_AI_LOCATION|API key|api key|authentication|credentials/i.test(message)) {
    return {
      status: 502,
      error: 'AI PPT 생성에 필요한 Gemini/Vertex AI 환경변수 설정을 확인해주세요.',
      detail: message,
    };
  }
  if (/timeout|GEMINI_TIMEOUT|시간 초과/i.test(message)) {
    return {
      status: 504,
      error: 'AI PPT 생성 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
      detail: message,
    };
  }
  if (/429|quota|rate|Resource has been exhausted|요청 한도|사용량/i.test(message)) {
    return {
      status: 429,
      error: 'AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.',
      detail: message,
    };
  }
  return {
    status: error?.status || error?.statusCode || 500,
    error: 'AI PPT 생성 중 서버 오류가 발생했습니다.',
    detail: message,
  };
}

// POST /api/portfolio/validate - 체크리스트 6개 항목 검증
router.post('/validate', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const { portfolioId } = req.body;
    if (!portfolioId) {
      return res.status(400).json({ error: 'portfolioId가 필요합니다' });
    }

    const docSnap = await adminDb.collection('portfolios').doc(portfolioId).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: '포트폴리오를 찾을 수 없습니다' });
    }

    const portfolio = docSnap.data();
    if (portfolio.userId !== req.user.uid) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // ===== 1. 파일 용량 체크 (서버 측 JSON 크기 기준) =====
    const dataSize = Buffer.byteLength(JSON.stringify(portfolio), 'utf8');
    const maxSize = 20 * 1024 * 1024; // 20MB
    const fileSizeResult = {
      passed: dataSize < maxSize,
      checking: false,
      message: dataSize < maxSize
        ? `✓ 데이터 크기: ${(dataSize / 1024).toFixed(1)}KB (20MB 이하)`
        : `데이터 크기 초과: ${(dataSize / (1024 * 1024)).toFixed(1)}MB (최대 20MB)`,
    };

    // ===== 2~4. AI 기반 검증 (맞춤형 검토, 기여도, 오타/비문) =====
    let aiResults;
    try {
      // 관련 경험 데이터도 함께 가져오기
      const experienceIds = portfolio.experienceIds || [];
      let experiencesData = [];
      if (experienceIds.length > 0) {
        const expSnapshots = await Promise.all(
          experienceIds.slice(0, 10).map(eid =>
            adminDb.collection('experiences').doc(eid).get()
          )
        );
        experiencesData = expSnapshots
          .filter(s => s.exists)
          .map(s => ({ id: s.id, ...s.data() }));
      }

      aiResults = await validatePortfolioWithAI(portfolio, experiencesData);
    } catch (aiError) {
      console.error('AI 검증 실패:', aiError);
      aiResults = {
        customization: { passed: false, message: 'AI 검증 중 오류 발생. 다시 시도해주세요.' },
        contribution: { passed: false, message: 'AI 검증 중 오류 발생. 다시 시도해주세요.' },
        proofread: { passed: false, message: 'AI 검증 중 오류 발생. 다시 시도해주세요.' },
      };
    }

    // 체크리스트 결과에 checking: false 추가
    const addChecking = (result) => ({ ...result, checking: false });

    const response = {
      fileSize: fileSizeResult,
      customization: addChecking(aiResults.customization || { passed: false, message: '검증 실패' }),
      contribution: addChecking(aiResults.contribution || { passed: false, message: '검증 실패' }),
      proofread: addChecking(aiResults.proofread || { passed: false, message: '검증 실패' }),
    };

    // 결과를 Firestore에도 저장
    await adminDb.collection('portfolios').doc(portfolioId).update({
      checklist: {
        fileSize: fileSizeResult.passed,
        customization: aiResults.customization?.passed || false,
        contribution: aiResults.contribution?.passed || false,
        proofread: aiResults.proofread?.passed || false,
      },
      updatedAt: new Date(),
    });

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/portfolio/export - 포트폴리오 Export
router.post('/export', authMiddleware, async (req, res, next) => {
  try {
    const { portfolioId, format } = req.body;
    const docSnap = await adminDb.collection('portfolios').doc(portfolioId).get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: '포트폴리오를 찾을 수 없습니다' });
    }

    const portfolio = docSnap.data();
    if (portfolio.userId !== req.user.uid) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    switch (format) {
      case 'PDF':
        // PDF 생성 (HTML → PDF)
        const htmlContent = generatePortfolioHTML(portfolio);
        res.json({
          success: true,
          html: htmlContent,
          fileName: `${portfolio.userName || 'portfolio'}_포트폴리오.pdf`,
          message: 'PDF 생성용 HTML이 준비되었습니다. 클라이언트에서 렌더링하세요.',
        });
        break;

      case 'GitHub':
        // Markdown 변환
        const markdown = generatePortfolioMarkdown(portfolio);
        res.json({
          success: true,
          content: markdown,
          fileName: 'README.md',
          message: 'Markdown 변환 완료',
        });
        break;

      case 'Notion':
        res.json({
          success: true,
          blocks: generateNotionBlocks(portfolio),
          message: 'Notion 블록 변환 완료 (Notion API 연동 필요)',
        });
        break;

      default:
        res.status(400).json({ error: '지원되지 않는 포맷입니다' });
    }

    // 상태 업데이트
    await adminDb.collection('portfolios').doc(portfolioId).update({
      status: 'exported',
      updatedAt: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// HTML 생성 함수
function generatePortfolioHTML(portfolio) {
  const sectionsHTML = (portfolio.sections || []).map(s => `
    <div class="section">
      <h2>${escapeHtml(s.title || '')}</h2>
      ${s.role ? `<p class="meta">역할: ${escapeHtml(s.role)} | 기여도: ${escapeHtml(String(s.contribution || ''))}%</p>` : ''}
      <div class="content">${escapeHtml(s.content || '').replace(/\n/g, '<br>')}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>${escapeHtml(portfolio.title || '포트폴리오')}</title>
<style>
  body { font-family: 'Pretendard', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  .meta-info { color: #666; font-size: 14px; margin-bottom: 32px; }
  .section { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb; }
  .section h2 { font-size: 20px; margin-bottom: 12px; }
  .section .meta { font-size: 13px; color: #888; margin-bottom: 8px; }
  .section .content { font-size: 15px; line-height: 1.7; }
</style></head>
<body>
  <h1>${escapeHtml(portfolio.title || '포트폴리오')}</h1>
  <p class="meta-info">${escapeHtml(portfolio.userName || '')} | ${escapeHtml(portfolio.targetCompany || '')} ${escapeHtml(portfolio.targetPosition || '')}</p>
  ${sectionsHTML}
</body></html>`;
}

// Markdown 생성 함수
function generatePortfolioMarkdown(portfolio) {
  let md = `# ${portfolio.title || '포트폴리오'}\n\n`;
  md += `**${portfolio.userName || ''}** | ${portfolio.targetCompany || ''} ${portfolio.targetPosition || ''}\n\n---\n\n`;

  (portfolio.sections || []).forEach(s => {
    md += `## ${s.title || '섹션'}\n\n`;
    if (s.role) md += `> 역할: ${s.role} | 기여도: ${s.contribution || ''}%\n\n`;
    md += `${s.content || ''}\n\n---\n\n`;
  });

  return md;
}

// Notion 블록 변환
function generateNotionBlocks(portfolio) {
  const blocks = [
    { type: 'heading_1', text: portfolio.title || '포트폴리오' },
    { type: 'paragraph', text: `${portfolio.userName || ''} | ${portfolio.targetCompany || ''} ${portfolio.targetPosition || ''}` },
  ];

  (portfolio.sections || []).forEach(s => {
    blocks.push({ type: 'heading_2', text: s.title || '' });
    if (s.role) blocks.push({ type: 'callout', text: `역할: ${s.role} | 기여도: ${s.contribution || ''}%` });
    blocks.push({ type: 'paragraph', text: s.content || '' });
  });

  return blocks;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// POST /api/portfolio/match-sections - 섹션별 기업 요건 매칭 분석
router.post('/match-sections', authMiddleware, async (req, res, next) => {
  try {
    const { sections, targetCompany, targetPosition } = req.body;
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ error: '섹션 데이터가 필요합니다' });
    }
    if (!targetCompany || !targetPosition) {
      return res.status(400).json({ error: '지원 기업과 직무가 필요합니다' });
    }
    const results = await matchSectionsToRequirements(sections, targetCompany, targetPosition);
    res.json({ success: true, results });
  } catch (error) {
    next(error);
  }
});

// POST /api/portfolio/ai-ppt-analyze - 경험정리 → 선택한 합격 포트폴리오형 PPT deck 생성
router.post('/ai-ppt-analyze', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const { portfolioId, templateHint, customTemplate } = req.body;
    if (!portfolioId) return res.status(400).json({ error: 'portfolioId가 필요합니다' });
    const snap = await adminDb.collection('portfolios').doc(portfolioId).get();
    if (!snap.exists) return res.status(404).json({ error: '포트폴리오를 찾을 수 없습니다' });
    const portfolio = { id: snap.id, ...snap.data() };
    if (portfolio.userId !== req.user.uid) return res.status(403).json({ error: '접근 권한이 없습니다' });

    if (!Array.isArray(portfolio.experiences)) portfolio.experiences = [];
    const experienceIds = Array.isArray(portfolio.experienceIds) ? portfolio.experienceIds : [];
    if (portfolio.experiences.length === 0 && experienceIds.length > 0) {
      const expSnaps = await Promise.all(
        experienceIds.slice(0, 12).map(eid => adminDb.collection('experiences').doc(eid).get())
      );
      const linkedExperiences = expSnaps
        .filter(s => s.exists)
        .map(s => ({ id: s.id, ...s.data() }))
        .filter(exp => exp.userId === req.user.uid);
      portfolio.experiences = linkedExperiences.length ? linkedExperiences : (portfolio.experiences || []);
    }
    stripPortfolioInlineHtml(portfolio);
    const deck = await generateAiPptDeck({ portfolio, templateHint: templateHint || 'standard:proposal', customTemplate: customTemplate || null });
    res.json({ deck });
  } catch (error) {
    console.error('[POST /portfolio/ai-ppt-analyze]', error);
    const response = aiPptErrorResponse(error);
    res.status(response.status).json({ error: response.error, detail: response.detail });
  }
});

// POST /api/portfolio/ai-ppt-revise - 단일 슬라이드 AI 수정
router.post('/ai-ppt-revise', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const { portfolioId, slide, instruction } = req.body;
    if (!slide || !instruction) return res.status(400).json({ error: 'slide와 instruction이 필요합니다' });
    let portfolio = {};
    if (portfolioId) {
      const snap = await adminDb.collection('portfolios').doc(portfolioId).get();
      if (snap.exists) portfolio = { id: snap.id, ...snap.data() };
    }
    stripPortfolioInlineHtml(portfolio);
    const updated = await reviseAiPptSlide({ slide, instruction, portfolio });
    res.json({ slide: updated });
  } catch (error) {
    console.error('[POST /portfolio/ai-ppt-revise]', error);
    const response = aiPptErrorResponse(error);
    res.status(response.status).json({ error: response.error, detail: response.detail });
  }
});

// POST /api/portfolio/generate-themed — 테마 기반 전문가 포트폴리오 AI 생성
router.post('/generate-themed', authMiddleware, aiRateLimiter, async (req, res, next) => {
  try {
    const { portfolioId, themeId } = req.body;
    if (!portfolioId || !themeId) {
      return res.status(400).json({ error: 'portfolioId 와 themeId 가 필요합니다' });
    }

    const docSnap = await adminDb.collection('portfolios').doc(portfolioId).get();
    if (!docSnap.exists) return res.status(404).json({ error: '포트폴리오를 찾을 수 없습니다' });
    const portfolio = docSnap.data();
    if (portfolio.userId !== req.user.uid) return res.status(403).json({ error: '접근 권한이 없습니다' });

    // 연결된 경험 데이터 수집
    const experienceIds = portfolio.experienceIds || [];
    let experiencesData = [];
    if (experienceIds.length > 0) {
      const snaps = await Promise.all(
        experienceIds.slice(0, 12).map(eid => adminDb.collection('experiences').doc(eid).get())
      );
      experiencesData = snaps.filter(s => s.exists).map(s => ({ id: s.id, ...s.data() }));
    }

    const portfolioMeta = {
      userName: portfolio.userName || '',
      targetPosition: portfolio.targetPosition || '',
      headline: portfolio.headline || '',
      contact: portfolio.contact || {},
    };

    const { visual_sections } = await generateThemedPortfolio({ themeId, experiencesData, portfolioMeta });

    // Firestore 에 저장
    await adminDb.collection('portfolios').doc(portfolioId).update({
      visual_sections,
      visual_sections_theme: themeId,
      visual_sections_generated_at: new Date().toISOString(),
    });

    res.json({ success: true, visual_sections });
  } catch (error) {
    console.error('[POST /portfolio/generate-themed]', error);
    next(error);
  }
});

export default router;
