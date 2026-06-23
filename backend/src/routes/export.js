import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { requireCredits, flushPendingCharges, getBillingStore, createDetachedBillingStore } from '../services/billingService.js';
import { exportForNotion, exportForGitHub, exportForPDF, exportForResume, exportNotionPortfolio } from '../services/exportService.js';
import { createNotionPortfolioPage, parseNotionPageId } from '../services/notionExportService.js';
import { parsePptxLayout, extractDesignDna } from '../services/templateParser.js';
import { mapDeck } from '../services/geminiMapper.js';
import { renderDeckInPlace, isContentPhoto } from '../services/pptxRendererInPlace.js';
import { renderPortfolioPdf } from '../services/portfolioPdfService.js';
import { renderResumePdf, renderResumePdfFromText } from '../services/resumePdfService.js';
import { composePortfolioPptx } from '../services/pptComposeService.js';
import { resolveComposition, refineProjectBullets } from '../services/pptComposeDirector.js';

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

// POST /api/export/ppt-compose - PPT 추출: 업로드 템플릿의 디자인(색·폰트·배경) +
// 노션형 포트폴리오 핵심 내용 → 합격자 스타일로 새로 조립한 PPTX.
// 인플레이스 슬롯 채움이 아니라 코드가 레이아웃을 소유 → 빈 박스·누락 없음. (AI 미사용·무과금)
// multipart/form-data: template(file, .pptx), portfolio(string, JSON)
router.post('/ppt-compose', authMiddleware, pptUpload.single('template'), async (req, res, next) => {
  try {
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
    // 구성 질문 답변 — choices(드롭다운) + requests(자유 입력 4칸)
    let payload = {};
    try { payload = JSON.parse(req.body.options || '{}'); } catch { /* 기본 구성 */ }
    const choices = payload.choices || payload; // 구버전 호환(평면 옵션)
    const requests = payload.requests || {};
    const options = await resolveComposition({ portfolio, choices, requests });
    // 본문을 단답형 핵심 불릿으로 재작성(AI, 실패/무키 시 문장 분리로 폴백)
    const bullets = await refineProjectBullets({ portfolio });
    const pptxBuf = await composePortfolioPptx(portfolio, req.file.buffer, { ...options, bullets });
    res.json({ pptxBase64: pptxBuf.toString('base64') });
  } catch (error) {
    console.error('[POST /export/ppt-compose]', error);
    next(error);
  }
});

// POST /api/export/portfolio-pdf - 노션형 포트폴리오 → 합격자 스타일 PDF 문서
// 템플릿 매핑 파이프라인과 완전히 독립된 경로: 자체 설계한 A4 문서 레이아웃에
// 포트폴리오 전체 내용을 흐름대로 배치해 Puppeteer 로 렌더한다. (AI 미사용·무과금)
// body: { portfolio: {...} }
router.post('/portfolio-pdf', authMiddleware, async (req, res, next) => {
  try {
    const portfolio = req.body?.portfolio || req.body?.data;
    if (!portfolio || typeof portfolio !== 'object') {
      return res.status(400).json({ success: false, message: '포트폴리오 데이터가 필요합니다' });
    }
    const pdf = await renderPortfolioPdf(portfolio);
    res.json({ pdfBase64: pdf.toString('base64') });
  } catch (error) {
    console.error('[POST /export/portfolio-pdf]', error);
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

// POST /api/export/resume - 이력서 최적화 플레인 텍스트 내보내기
router.post('/resume', authMiddleware, requireCredits, async (req, res, next) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: '내보낼 데이터가 없습니다' });
    }
    const result = await exportForResume(data);
    res.json({ success: true, content: result, format: 'resume-text' });
  } catch (error) {
    next(error);
  }
});

// POST /api/export/resume-pdf - 이력서 PDF 파일 내보내기 (HTML→Puppeteer, AI 미사용·무과금)
// rawText 가 오면 사용자가 직접 붙여넣은 텍스트를 같은 이력서 PDF 스타일로 렌더한다.
router.post('/resume-pdf', authMiddleware, async (req, res, next) => {
  try {
    const rawText = req.body?.rawText;
    if (typeof rawText === 'string' && rawText.trim()) {
      const pdf = await renderResumePdfFromText(rawText);
      return res.json({ pdfBase64: pdf.toString('base64') });
    }
    const data = req.body?.data || req.body?.portfolio;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: '내보낼 데이터가 없습니다' });
    }
    const pdf = await renderResumePdf(data);
    res.json({ pdfBase64: pdf.toString('base64') });
  } catch (error) {
    console.error('[POST /export/resume-pdf]', error);
    next(error);
  }
});

export default router;
