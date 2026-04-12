import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminDb } from '../config/firebase.js';
import { validatePortfolioWithAI } from '../services/geminiService.js';

const router = Router();

// POST /api/portfolio/validate - 체크리스트 6개 항목 검증
router.post('/validate', authMiddleware, async (req, res, next) => {
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

export default router;
