import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import { adminStorage } from '../config/firebase.js';
import { saveFile, deleteFile, fileIdFromUrl, fileUrl, publicBaseUrl, MAX_FILE_BYTES } from '../services/fileStore.js';

// 업로드 파일은 Firestore(무료)에 조각으로 저장한다 — services/fileStore.js 참고.
// Firebase Storage는 유료(Blaze) 요금제가 있어야 쓰기가 가능해 더 이상 쓰지 않는다.
const router = Router();
const MAX_MB = MAX_FILE_BYTES / 1024 / 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드할 수 있습니다'));
    }
  },
});

// multer 오류(크기 초과·형식)를 한국어 메시지로 돌려준다
const withUpload = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `파일 크기가 ${MAX_MB}MB를 초과합니다` });
    return res.status(400).json({ error: err.message || '파일 업로드에 실패했습니다' });
  });
};

// POST /api/upload/image
router.post('/image', authMiddleware, withUpload(upload.single('file')), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '파일이 없습니다' });
    const { id } = await saveFile({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      name: req.file.originalname,
      ownerId: req.user.uid,
    });
    const url = fileUrl(publicBaseUrl(req), id);
    res.json({ url, filename: url });
  } catch (error) {
    console.error('[Upload] 업로드 실패:', error.message);
    res.status(error.status || 500).json({ error: error.status ? error.message : '업로드에 실패했습니다' });
  }
});

// 프로젝트 산출물 문서(PDF·PPT·HWP·DOC 등) 업로드용 — 이미지 외 파일 허용
const DOC_EXT = /\.(pdf|ppt|pptx|hwp|hwpx|doc|docx|key|xls|xlsx|csv|tsv|txt|md|zip|jpg|jpeg|png|webp|gif)$/i;
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    if (DOC_EXT.test(file.originalname || '')) cb(null, true);
    else cb(new Error('PDF·PPT·HWP·DOC·이미지 등 산출물 파일만 업로드할 수 있습니다'));
  },
});

// POST /api/upload/document — 문서 파일을 저장하고 공개 URL 반환
router.post('/document', authMiddleware, withUpload(uploadDoc.single('file')), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '파일이 없습니다' });

    // multipart 파일명은 latin1로 디코딩돼 한글이 깨진다 → UTF-8로 복원
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const { id } = await saveFile({
      buffer: req.file.buffer,
      contentType: req.file.mimetype || 'application/octet-stream',
      name: originalName,
      ownerId: req.user.uid,
    });
    const url = fileUrl(publicBaseUrl(req), id);
    res.json({ url, filename: url, originalName, size: req.file.size });
  } catch (error) {
    console.error('[Upload] 문서 업로드 실패:', error.message);
    res.status(error.status || 500).json({ error: error.status ? error.message : '업로드에 실패했습니다' });
  }
});

// DELETE /api/upload/image — 새 저장소 주소면 Firestore에서, 예전 Storage 주소면 Storage에서 지운다
router.delete('/image', authMiddleware, async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename이 필요합니다' });

    const fileId = fileIdFromUrl(filename);
    if (fileId) {
      await deleteFile(fileId, req.user.uid);
      return res.json({ success: true });
    }

    // 예전 Firebase Storage 주소 (토큰 URL · 공개 URL 두 형식 모두 처리)
    let storagePath = filename;
    const tokenMatch = filename.match(/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/);
    const gsMatch = filename.match(/storage\.googleapis\.com\/[^/]+\/(.+?)(?:\?|$)/);
    if (tokenMatch) storagePath = decodeURIComponent(tokenMatch[1]);
    else if (gsMatch) storagePath = decodeURIComponent(gsMatch[1]);
    await adminStorage.bucket().file(storagePath).delete().catch(() => {});

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '삭제에 실패했습니다' });
  }
});

export default router;
