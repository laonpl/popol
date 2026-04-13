import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import {
  importFromNotion,
  importFromGitHub,
  importFromPDF,
  importFromFile,
  structureImportedContent,
} from '../services/importService.js';

// Firestore 이력 저장 (실패해도 응답에 영향 없음)
async function saveImportHistory(data) {
  try {
    const { adminDb } = await import('../config/firebase.js');
    await adminDb.collection('imports').add({ ...data, createdAt: new Date() });
  } catch (e) {
    console.warn('임포트 이력 저장 실패 (무시됨):', e.message);
  }
}

const router = Router();

// multer 설정 (파일 업로드용, 메모리 저장)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|jpg|jpeg|png|webp|hwp|hwpx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('PDF, 이미지, HWP 파일만 업로드할 수 있습니다'));
    }
  },
});

// POST /api/import/notion - Notion 페이지 임포트
router.post('/notion', authMiddleware, async (req, res, next) => {
  try {
    const { url, targetType } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Notion URL이 필요합니다' });
    }

    const imported = await importFromNotion(url);

    // targetType이 있으면 AI로 구조화
    let structured = null;
    if (targetType) {
      try {
        structured = await structureImportedContent(imported, targetType);
      } catch (aiError) {
        console.error('AI 구조화 실패:', aiError);
      }
    }

    saveImportHistory({ userId: req.user.uid, source: 'notion', url, targetType: targetType || null, importedData: imported, structuredData: structured });

    res.json({ imported, structured });
  } catch (error) {
    next(error);
  }
});

// POST /api/import/github - GitHub 리포지토리 임포트
router.post('/github', authMiddleware, async (req, res, next) => {
  try {
    const { url, targetType } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'GitHub URL이 필요합니다' });
    }

    const imported = await importFromGitHub(url);

    let structured = null;
    if (targetType) {
      try {
        structured = await structureImportedContent(imported, targetType);
      } catch (aiError) {
        console.error('AI 구조화 실패:', aiError);
      }
    }

    saveImportHistory({ userId: req.user.uid, source: 'github', url, targetType: targetType || null, importedData: imported, structuredData: structured });

    res.json({ imported, structured });
  } catch (error) {
    next(error);
  }
});

// POST /api/import/upload - 파일 업로드 임포트 (서버 사이드 파싱 + AI 분석)
router.post('/upload', authMiddleware, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: '파일 크기가 25MB를 초과합니다' });
      }
      return res.status(400).json({ error: err.message || '파일 업로드 실패' });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: '파일이 필요합니다' });
    }
    const { targetType } = req.body;

    // 한글 파일명 인코딩 보정 (multer latin1 → utf8)
    let originalName = file.originalname;
    try {
      const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
      if (decoded && !decoded.includes('�')) originalName = decoded;
    } catch { /* 변환 실패 시 원본 사용 */ }

    const imported = await importFromFile(file.buffer, file.mimetype, originalName);

    let structured = null;
    if (targetType) {
      try {
        structured = await structureImportedContent(imported, targetType);
      } catch (aiError) {
        console.error('AI 구조화 실패:', aiError.message);
      }
    }

    saveImportHistory({
      userId: req.user.uid,
      source: 'file',
      fileName: originalName,
      targetType: targetType || null,
      importedData: imported,
      structuredData: structured,
    });

    res.json({ imported, structured });
  } catch (error) {
    next(error);
  }
});

// POST /api/import/pdf - PDF 파일 임포트 (텍스트 추출은 프론트에서)
router.post('/pdf', authMiddleware, async (req, res, next) => {
  try {
    const { text, fileName, targetType } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'PDF 텍스트 내용이 필요합니다' });
    }

    const imported = await importFromPDF(text, fileName);

    let structured = null;
    if (targetType) {
      try {
        structured = await structureImportedContent(imported, targetType);
      } catch (aiError) {
        console.error('AI 구조화 실패:', aiError);
      }
    }

    saveImportHistory({ userId: req.user.uid, source: 'pdf', fileName, targetType: targetType || null, importedData: imported, structuredData: structured });

    res.json({ imported, structured });
  } catch (error) {
    next(error);
  }
});

// POST /api/import/text - 직접 텍스트 입력 임포트
router.post('/text', authMiddleware, async (req, res, next) => {
  try {
    const { text, title, targetType } = req.body;
    if (!text) {
      return res.status(400).json({ error: '텍스트 내용이 필요합니다' });
    }

    const imported = {
      source: 'text',
      title: title || '직접 입력',
      content: text,
      rawText: text,
      importedAt: new Date().toISOString(),
    };

    let structured = null;
    if (targetType) {
      try {
        structured = await structureImportedContent(imported, targetType);
      } catch (aiError) {
        console.error('AI 구조화 실패:', aiError);
      }
    }

    saveImportHistory({ userId: req.user.uid, source: 'text', targetType: targetType || null, importedData: imported, structuredData: structured });

    res.json({ imported, structured });
  } catch (error) {
    next(error);
  }
});

// POST /api/import/structure - 이미 임포트된 내용을 AI로 구조화
router.post('/structure', authMiddleware, async (req, res, next) => {
  try {
    const { importedData, targetType } = req.body;
    if (!importedData || !targetType) {
      return res.status(400).json({ error: 'importedData와 targetType이 필요합니다' });
    }

    const structured = await structureImportedContent(importedData, targetType);
    res.json({ structured });
  } catch (error) {
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('Resource has been exhausted')) {
      return res.status(429).json({ error: 'AI 요청 한도 초과입니다. 1분 후 다시 시도해주세요.' });
    }
    next(error);
  }
});

export default router;
