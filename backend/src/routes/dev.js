import { Router } from 'express';
import path from 'node:path';
import os from 'node:os';
import { unlink } from 'node:fs/promises';
import { captureReel } from '../../scripts/capture-eng-reel.mjs';

/**
 * 로컬 개발용 라우트. 운영에서는 index.js 가 아예 마운트하지 않는다.
 *
 * 릴스 캡처는 헤드리스 브라우저를 띄워 수천 장을 찍는 무거운 작업이라
 * 공개 엔드포인트로 두면 그 자체가 서버를 멈추는 수단이 된다.
 */
const router = Router();

let capturing = false;

// GET /api/dev/reel?fps=30&width=1080 — 릴스를 mp4 로 만들어 그대로 내려준다
router.get('/reel', async (req, res, next) => {
  if (capturing) {
    return res.status(409).json({ error: '이미 캡처가 진행 중입니다. 끝난 뒤 다시 시도해주세요.' });
  }

  const fps = Math.min(60, Math.max(12, Number(req.query.fps) || 30));
  const width = Math.min(1440, Math.max(360, Number(req.query.width) || 1080));
  const scale = Math.min(3, Math.max(1, Number(req.query.scale) || 2));
  // 캡처 대상은 이 요청을 보낸 프론트 자신 (dev 3000, preview 4173 등 무엇이든)
  const origin = String(req.query.origin || req.get('referer') || 'http://localhost:3000').replace(/\/+$/, '');
  const pageUrl = `${new URL(origin).origin}/eng`;

  const stamp = Date.now();
  const out = path.join(os.tmpdir(), `fitpoly-reel-${stamp}.mp4`);
  const frameDir = path.join(os.tmpdir(), `fitpoly-reel-frames-${stamp}`);

  capturing = true;
  // 프레임 수천 장 캡처는 기본 타임아웃을 훌쩍 넘긴다
  req.setTimeout(0);
  res.setTimeout(0);

  try {
    console.log(`[reel] 캡처 시작 · ${pageUrl} · ${width}px ${fps}fps`);
    await captureReel({
      url: pageUrl,
      fps,
      width,
      scale,
      out,
      frameDir,
      onProgress: message => console.log(`[reel] ${message}`),
    });

    res.download(out, `fitpoly-reel-${width}p-${fps}fps.mp4`, async () => {
      await unlink(out).catch(() => {});
    });
  } catch (error) {
    console.error('[reel] 실패:', error.message);
    await unlink(out).catch(() => {});
    next(error);
  } finally {
    capturing = false;
  }
});

export default router;
