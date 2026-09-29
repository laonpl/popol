import { Router } from 'express';
import { readFile } from '../services/fileStore.js';

// GET /api/files/:id — 업로드 파일 내려주기 (공개 포트폴리오의 이미지도 쓰므로 로그인 없이 연다)
const router = Router();

// 브라우저에서 바로 열어도 되는 형식. 나머지는 다운로드로 내려준다.
const INLINE_TYPES = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|application\/pdf|text\/plain)$/i;

router.get('/:id', async (req, res) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: '파일을 찾을 수 없습니다' });
    const file = await readFile(req.params.id);
    if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다' });
    const { meta, buffer } = file;
    const type = meta.contentType || 'application/octet-stream';
    const disposition = INLINE_TYPES.test(type) ? 'inline' : 'attachment';
    res.set({
      'Content-Type': type.startsWith('text/') ? `${type}; charset=utf-8` : type,
      'Content-Length': buffer.length,
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(meta.name || 'file')}`,
      'Cache-Control': 'public, max-age=31536000, immutable', // id가 바뀌지 않는 파일이라 길게 캐시
      'X-Content-Type-Options': 'nosniff',
      // 올린 파일 안의 스크립트(SVG 등)가 실행되지 않도록 막는다
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(buffer);
  } catch (error) {
    console.error('[files] 파일 읽기 실패:', error.message);
    res.status(500).json({ error: '파일을 불러오지 못했습니다' });
  }
});

export default router;
