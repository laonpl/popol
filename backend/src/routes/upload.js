import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import { adminStorage } from '../config/firebase.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

    await fileRef.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
    });
    await fileRef.makePublic();

    const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    res.json({ url, filename: storagePath });
  } catch (error) {
    console.error('[Upload] 업로드 실패:', error.message);
    res.status(500).json({ error: '업로드에 실패했습니다' });
  }
});

// DELETE /api/upload/image
router.delete('/image', authMiddleware, async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename이 필요합니다' });

    // URL로 들어온 경우 Firebase Storage 경로 추출
    let storagePath = filename;
    const gsMatch = filename.match(/storage\.googleapis\.com\/[^/]+\/(.+?)(?:\?|$)/);
    if (gsMatch) storagePath = decodeURIComponent(gsMatch[1]);

    const bucket = adminStorage.bucket();
    await bucket.file(storagePath).delete().catch(() => {});

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '삭제에 실패했습니다' });
  }
});

export default router;
