import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { exportForNotion, exportForGitHub, exportForPDF, exportNotionPortfolio } from '../services/exportService.js';
import { createNotionPortfolioPage, parseNotionPageId } from '../services/notionExportService.js';

const router = Router();

// POST /api/export/notion-page - Notion API로 실제 페이지 생성 (3컬럼 레이아웃)
router.post('/notion-page', authMiddleware, async (req, res, next) => {
  try {
    const { notionToken, parentPageId, data } = req.body;
    if (!notionToken || !parentPageId || !data) {
      return res.status(400).json({ success: false, message: 'Notion 토큰, 부모 페이지 ID, 포트폴리오 데이터가 모두 필요합니다' });
    }
    const parsedId = parseNotionPageId(parentPageId);
    if (!parsedId) {
      return res.status(400).json({ success: false, message: '유효하지 않은 Notion 페이지 ID입니다' });
    }
    const result = await createNotionPortfolioPage(notionToken, parsedId, data);
    res.json({ success: true, pageId: result.pageId, url: result.url });
  } catch (error) {
    console.error('Notion page creation error:', error.message);
    if (error.code === 'unauthorized' || error.status === 401) {
      return res.status(401).json({ success: false, message: 'Notion 토큰이 유효하지 않습니다. 토큰을 확인해주세요.' });
    }
    if (error.code === 'object_not_found' || error.status === 404) {
      return res.status(404).json({ success: false, message: '부모 페이지를 찾을 수 없습니다. 페이지가 Integration에 공유되었는지 확인해주세요.' });
    }
    next(error);
  }
});

// POST /api/export/notion-portfolio - Notion 포트폴리오 전용 내보내기
router.post('/notion-portfolio', authMiddleware, async (req, res, next) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: '내보낼 데이터가 없습니다' });
    }
    const result = await exportNotionPortfolio(data);
    res.json({ success: true, content: result, format: 'notion-portfolio-markdown' });
  } catch (error) {
    next(error);
  }
});

// POST /api/export/notion - Notion 최적화 Markdown 내보내기
router.post('/notion', authMiddleware, async (req, res, next) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: '내보낼 데이터가 없습니다' });
    }
    const result = await exportForNotion(data);
    res.json({ success: true, content: result, format: 'notion-markdown' });
  } catch (error) {
    next(error);
  }
});

// POST /api/export/github - GitHub README 최적화 내보내기
router.post('/github', authMiddleware, async (req, res, next) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: '내보낼 데이터가 없습니다' });
    }
    const result = await exportForGitHub(data);
    res.json({ success: true, content: result, format: 'github-readme' });
  } catch (error) {
    next(error);
  }
});

// POST /api/export/pdf - PDF 최적화 텍스트 내보내기
router.post('/pdf', authMiddleware, async (req, res, next) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: '내보낼 데이터가 없습니다' });
    }
    const result = await exportForPDF(data);
    res.json({ success: true, content: result, format: 'pdf-optimized' });
  } catch (error) {
    next(error);
  }
});

export default router;
