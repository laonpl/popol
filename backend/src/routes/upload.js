import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import { adminStorage } from '../config/firebase.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB (Storage 유료 플랜 — 고해상도 이미지 허용)
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드할 수 있습니다'));
    }
  },
});

// POST /api/upload/image
router.post('/image', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '파일이 없습니다' });

    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const storagePath = `uploads/${Date.now()}_${randomUUID()}${ext}`;

    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);

    // Firebase 기본 버킷은 uniform 버킷 수준 접근이 켜져 있어 객체 ACL(makePublic)을 쓸 수 없다.
    // 대신 Firebase 다운로드 토큰을 메타데이터에 넣어 토큰 기반 공개 URL을 만든다.
    const downloadToken = randomUUID();
    await fileRef.save(req.file.buffer, {
      resumable: false,
      metadata: {
        contentType: req.file.mimetype,
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
    res.json({ url, filename: storagePath });
  } catch (error) {
    console.error('[Upload] 업로드 실패:', error);
    const notFound = /bucket does not exist/i.test(error.message || '');
    res.status(notFound ? 503 : 500).json({
      error: notFound
        ? 'Firebase Storage가 활성화되지 않았습니다. Firebase 콘솔에서 Storage를 시작해주세요.'
        : '업로드에 실패했습니다',
    });
  }
});

// 프로젝트 산출물 문서(PDF·PPT·HWP·DOC 등) 업로드용 — 이미지 외 파일 허용
const DOC_EXT = /\.(pdf|ppt|pptx|hwp|hwpx|doc|docx|key|xls|xlsx|txt|zip)$/i;
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (DOC_EXT.test(file.originalname || '')) cb(null, true);
    else cb(new Error('PDF·PPT·HWP·DOC 등 문서 파일만 업로드할 수 있습니다'));
  },
});

// POST /api/upload/document — 산출물 문서 파일을 Storage에 올리고 공개 URL 반환
router.post('/document', authMiddleware, uploadDoc.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '파일이 없습니다' });

    // multipart 파일명은 latin1로 디코딩돼 한글이 깨진다 → UTF-8로 복원
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase() || '';
    const storagePath = `uploads/docs/${Date.now()}_${randomUUID()}${ext}`;

    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);
    const downloadToken = randomUUID();
    await fileRef.save(req.file.buffer, {
      resumable: false,
      metadata: {
        contentType: req.file.mimetype || 'application/octet-stream',
        // 새 탭에서 바로 열람 (다운로드 강제 대신 인라인)
        contentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(originalName)}`,
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
    res.json({ url, filename: storagePath, originalName, size: req.file.size });
  } catch (error) {
    console.error('[Upload] 문서 업로드 실패:', error);
    const notFound = /bucket does not exist/i.test(error.message || '');
    res.status(notFound ? 503 : 500).json({
      error: notFound
        ? 'Firebase Storage가 활성화되지 않았습니다. Firebase 콘솔에서 Storage를 시작해주세요.'
        : (error.message || '업로드에 실패했습니다'),
    });
  }
});

// DELETE /api/upload/image
router.delete('/image', authMiddleware, async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename이 필요합니다' });

    // URL로 들어온 경우 Storage 경로 추출 (토큰 URL · 공개 URL 두 형식 모두 처리)
    let storagePath = filename;
    const tokenMatch = filename.match(/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/);
    const gsMatch = filename.match(/storage\.googleapis\.com\/[^/]+\/(.+?)(?:\?|$)/);
    if (tokenMatch) storagePath = decodeURIComponent(tokenMatch[1]);
    else if (gsMatch) storagePath = decodeURIComponent(gsMatch[1]);

    const bucket = adminStorage.bucket();
    await bucket.file(storagePath).delete().catch(() => {});

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '삭제에 실패했습니다' });
  }
});

export default router;
