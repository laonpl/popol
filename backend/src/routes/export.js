import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { requireCredits, flushPendingCharges, getBillingStore, createDetachedBillingStore } from '../services/billingService.js';
import { exportForNotion, exportForGitHub, exportForPDF, exportNotionPortfolio } from '../services/exportService.js';
import { createNotionPortfolioPage, parseNotionPageId } from '../services/notionExportService.js';
import { parsePptxLayout, extractDesignDna } from '../services/templateParser.js';
import { mapDeck } from '../services/geminiMapper.js';
import { renderDeckInPlace, isContentPhoto } from '../services/pptxRendererInPlace.js';

const router = Router();

const pptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.pptx$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('PPTX 파일만 업로드 가능합니다'));
  },
});

// POST /api/export/ppt-theme - PPTX 파일에서 디자인 DNA(팔레트·폰트) 추출
// theme1.xml 스킴이 아니라 슬라이드/레이아웃/마스터에 실제 칠해진 색을 가중 집계해
// 업로드 템플릿의 "보이는" 디자인을 내장 파이프라인 템플릿으로 옮긴다.
router.post('/ppt-theme', authMiddleware, pptUpload.single('template'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'PPTX 파일이 필요합니다' });
    const dna = await extractDesignDna(req.file.buffer);
    res.json({
      bg:          dna.bg          || '#FFFFFF',
      accent:      dna.accent      || '#3B82F6',
      accent2:     dna.accent2     || null,
      text:        dna.text        || '#111827',
      heading:     dna.heading     || dna.text || '#111827',
      dark:        dna.dark        || null,
      fontHeading: dna.fontHeading || 'Pretendard',
      fontBody:    dna.fontBody    || 'Pretendard',
    });
  } catch (error) {
    console.error('[POST /export/ppt-theme]', error);
    next(error);
  }
});

// POST /api/export/ppt - PPTX 템플릿 + 노션형 포트폴리오 → 완성된 PPTX
// multipart/form-data: template(file, .pptx), portfolio(string, JSON)
router.post('/ppt', authMiddleware, requireCredits, pptUpload.single('template'), async (req, res, next) => {
  // Pro 2.5 는 응답이 느리고 429 재시도 시간이 필요 → 소켓 타임아웃을 10분으로 연장
  // 기본 소켓 타임아웃(5s 등)이 ERR_EMPTY_RESPONSE 를 유발하는 것을 방지
  req.socket.setTimeout(600000);
  res.setTimeout(600000, () => {
    if (!res.headersSent) {
      res.status(503).json({ success: false, message: '처리 시간이 초과되었습니다. 슬라이드 수를 줄이거나 잠시 후 다시 시도해주세요.' });
    }
  });
  try {
    const billingStore = getBillingStore() || createDetachedBillingStore({
      userId: req.user.uid,
      operation: 'POST /api/export/ppt',
      operationLabel: 'PPT 템플릿 포트폴리오 제작',
    });
    if (billingStore && !billingStore.userId) billingStore.userId = req.user.uid;
    if (!req.file) return res.status(400).json({ success: false, message: 'PPTX 템플릿 파일이 필요합니다' });
    let portfolio;
    try {
      portfolio = JSON.parse(req.body.portfolio || '{}');
    } catch {
      return res.status(400).json({ success: false, message: 'portfolio 필드가 유효한 JSON이 아닙니다' });
    }
    if (!portfolio || typeof portfolio !== 'object') {
      return res.status(400).json({ success: false, message: '포트폴리오 데이터가 필요합니다' });
    }

    const layout = await parsePptxLayout(req.file.buffer);
    // 디자인 DNA(실제 칠해진 팔레트) → 카피 리파인의 톤앤매너 동기화에 사용.
    // 추출 실패는 톤 기본값으로 폴백할 뿐 변환 자체를 막지 않는다.
    let designDna = null;
    try { designDna = await extractDesignDna(req.file.buffer); } catch { /* 기본 톤 사용 */ }
    const deck = await mapDeck({ portfolio, layout, billingStore, designDna });
    const buf = await renderDeckInPlace(deck, req.file.buffer);
    // Charge only usage recorded by the model client. Uploaded PPT template
    // generation can be token-heavy, so no minimum/feature fallback charge is
    // applied here; credits must follow actual API token usage.
    const billing = await flushPendingCharges(billingStore);

    // 미리보기와 실제 PPTX 출력이 일치하도록:
    // - placeholder pics(<p:ph>)는 renderer가 이미 제거 → 미리보기도 제외
    // - 디자인 이미지(non-placeholder)는 PPTX에 보존되므로 미리보기에도 전달
    // 콘텐츠 사진 판별(renderer 와 동일 규칙)용 미디어 재사용 횟수
    const picUsage = new Map();
    for (const s of layout.slides) {
      for (const p of (s.pics || [])) {
        if (p.mediaPath) picUsage.set(p.mediaPath, (picUsage.get(p.mediaPath) || 0) + 1);
      }
    }
    const slideArea = layout.slideSize.widthPt * layout.slideSize.heightPt;
    res.json({
      pptxBase64: buf.toString('base64'),
      deck,
      slideSize: layout.slideSize,
      layoutSlides: layout.slides.map(s => ({
        index: s.index,
        bg: s.bg,
        decor: s.decor,
        // 콘텐츠 사진은 renderer가 제거하므로 미리보기에서도 동일 규칙으로 제외
        pics: (s.pics || []).filter(p => !isContentPhoto({
          areaRatio: (p.w * p.h) / slideArea,
          bytes: p.mediaBytes || 0,
          usage: p.mediaPath ? (picUsage.get(p.mediaPath) || 1) : 1,
        })),
      })),
      billing,
    });
  } catch (error) {
    console.error('[POST /export/ppt]', error);
    next(error);
  }
});

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
    console.error('Notion page creation error:', error.message, error.body || '');
    if (error.code === 'unauthorized' || error.status === 401) {
      return res.status(401).json({ success: false, message: 'Notion 토큰이 유효하지 않습니다. 토큰을 확인해주세요.' });
    }
    if (error.code === 'object_not_found' || error.status === 404) {
      return res.status(404).json({ success: false, message: '부모 페이지를 찾을 수 없습니다. 페이지가 Integration에 공유되었는지 확인해주세요.' });
    }
    if (error.code === 'validation_error' || error.status === 400) {
      return res.status(400).json({ success: false, message: `Notion API 유효성 오류: ${error.message || '블록 데이터 형식이 올바르지 않습니다'}` });
    }
    if (error.code === 'rate_limited' || error.status === 429) {
      return res.status(429).json({ success: false, message: 'Notion API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
    }
    next(error);
  }
});

// POST /api/export/notion-portfolio - Notion 포트폴리오 전용 내보내기
router.post('/notion-portfolio', authMiddleware, requireCredits, async (req, res, next) => {
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
router.post('/notion', authMiddleware, requireCredits, async (req, res, next) => {
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
router.post('/github', authMiddleware, requireCredits, async (req, res, next) => {
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
router.post('/pdf', authMiddleware, requireCredits, async (req, res, next) => {
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
