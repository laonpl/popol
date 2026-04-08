import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import multer from 'multer';
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
// 이미지를 Firebase Storage에 업로드하고 다운로드 URL 반환
router.post('/image', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: '파일이 없습니다' });
    }

    const { storagePath } = req.body;
    if (!storagePath) {
      return res.status(400).json({ error: 'storagePath가 필요합니다' });
    }

    // storagePath가 해당 유저 경로인지 검증 (path traversal 방지)
    const userId = req.user.uid;
    if (!storagePath.includes(userId)) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'popol-cb20b.firebasestorage.app';
    const bucket = adminStorage.bucket(bucketName);
    const fileRef = bucket.file(storagePath);

    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        cacheControl: 'public, max-age=31536000',
      },
    });

    // 영구 공개 접근 URL 생성 (서명 없이)
    await fileRef.makePublic();
    const url = `https://storage.googleapis.com/${bucketName}/${storagePath}`;

    res.json({ url, storagePath });
  } catch (error) {
    console.error('[Upload] 이미지 업로드 실패:', error.message);
    // Firebase/GCS 404는 bucket 미존재 → 클라이언트에 500으로 반환
    if (error.code === 404 || error.status === 404) {
      return res.status(500).json({ error: 'Firebase Storage 버킷을 찾을 수 없습니다. Firebase 콘솔에서 Storage를 활성화해 주세요.' });
    }
    next(error);
  }
});

// DELETE /api/upload/image
// Firebase Storage에서 이미지 삭제
router.delete('/image', authMiddleware, async (req, res, next) => {
  try {
    const { storagePath } = req.body;
    if (!storagePath) {
      return res.status(400).json({ error: 'storagePath가 필요합니다' });
    }

    const userId = req.user.uid;
    if (!storagePath.includes(userId)) {
      return res.status(403).json({ error: '권한이 없습니다' });
    }

    const bucket = adminStorage.bucket();
    await bucket.file(storagePath).delete().catch(() => {});

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
