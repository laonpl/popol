/**
 * /eng 릴스를 원본 화질 그대로 mp4 로 뽑는다.
 *
 * 화면 녹화가 아니라 프레임을 한 장씩 캡처한다. Chrome 의 가상 시간(virtual time)을
 * 써서 시간을 정확히 1/fps 씩만 흘려보내므로, 렉이 걸리든 캡처가 느리든
 * 결과 영상의 프레임 간격은 항상 일정하다. 브라우저 창 크기와 무관하게
 * 지정한 해상도(기본 1080x1920)로 나온다.
 *
 * 준비:  프론트를 띄워 둔다 (npm run dev  또는  npm run preview)
 * 실행:  node scripts/capture-eng-reel.mjs
 * 옵션:  --url=http://localhost:3000/eng  --fps=30  --width=1080
 *        --out=eng-reel.mp4  --scale=2  --keep-frames
 *        --height=1080  (생략하면 세로 9:16. 가로 영상은 --width=1920 --height=1080)
 *        --frames=<디렉터리>  임시 프레임을 둘 곳. 동기화 폴더(OneDrive 등) 밖으로 빼는 편이 안전하다.
 */
import { mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';

const run = (bin, argv) => new Promise((resolve, reject) => {
  const child = spawn(bin, argv, { stdio: ['ignore', 'ignore', 'inherit'] });
  child.on('error', reject);
  child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${path.basename(bin)} exited ${code}`))));
});

/**
 * 릴스를 mp4 로 캡처한다. CLI 와 /api/dev/reel 라우트가 함께 쓴다.
 * @returns {Promise<string>} 만들어진 mp4 경로
 */
export async function captureReel({
  url = 'http://localhost:3000/eng',
  fps = 30,
  width = 1080,
  height,            // 생략하면 세로 9:16 — /video 같은 가로 영상은 1080 을 넘긴다
  scale = 2,
  out = 'eng-reel.mp4',
  frameDir,
  keepFrames = false,
  onProgress,
} = {}) {
  const FPS = Number(fps);
  // H.264 는 가로·세로가 모두 짝수여야 한다 (홀수면 인코더가 아예 열리지 않는다)
  const even = value => Math.round(value / 2) * 2;
  const WIDTH = even(Number(width));
  const HEIGHT = even(height ? Number(height) : (WIDTH * 16) / 9);
  const SCALE = Number(scale);
  const OUT = path.resolve(out);
  const FRAME_DIR = path.resolve(frameDir || '.eng-frames');
  const log = onProgress || (() => {});

  if (!ffmpegPath) throw new Error('ffmpeg-static 을 찾지 못했습니다. backend 에서 npm install 을 먼저 실행하세요.');

  log(`▶ ${url}`);
  log(`  ${WIDTH}x${HEIGHT} · ${FPS}fps · 렌더 배율 ${SCALE}x`);

  await rm(FRAME_DIR, { recursive: true, force: true });
  await mkdir(FRAME_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    // 가상 시간에서는 합성기가 늦게 깨어나 스크린샷이 기본 30초를 넘길 때가 있다
    protocolTimeout: 180000,
    args: [
      '--hide-scrollbars',
      '--force-device-scale-factor=' + SCALE,
      '--font-render-hinting=none',       // 캡처 간 글자 두께가 흔들리지 않게
      '--disable-lcd-text',               // 서브픽셀 렌더링 → 색 번짐 방지
      '--allow-file-access-from-files',
    ],
  });

  try {
    const page = await browser.newPage();
    // 페이지가 죽으면 캡처가 중간에 끊긴다 — 원인을 바로 알 수 있게 남긴다
    page.on('pageerror', error => log(`  [페이지 오류] ${error.message}`));
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });
    await page.goto(url.includes("?") ? `${url}&capture=1` : `${url}?capture=1`, { waitUntil: 'networkidle0', timeout: 60000 });
    // 웹폰트가 로드된 뒤에 찍어야 글자가 바뀌지 않는다
    await page.evaluate(() => document.fonts.ready);

    const durationMs = await page.evaluate(() => window.__engReelDurationMs || 0);
    if (!durationMs) {
      throw new Error('페이지에서 재생 길이를 읽지 못했습니다. /eng 가 맞는지 확인하세요.');
    }
    const totalFrames = Math.round((durationMs / 1000) * FPS);
    log(`  전체 ${(durationMs / 1000).toFixed(1)}초 · ${totalFrames}프레임\n`);

    const frameMs = 1000 / FPS;
    for (let i = 0; i < totalFrames; i++) {
      const timeMs = i * frameMs;

      // 1) React 상태를 해당 시각으로 이동 (반환값 = 현재 장면이 시작된 뒤 흐른 ms)
      const sceneElapsed = await page.evaluate(t => window.__engSeek(t), timeMs);

      // 2) CSS 애니메이션도 같은 지점으로 고정한다.
      //    등장 애니메이션은 장면이 바뀔 때 시작하므로 장면 경과시간을 그대로 넣는다.
      //    이 과정이 없으면 실제 흐른 시간(캡처 속도)에 따라 매번 다르게 찍힌다.
      await page.evaluate((elapsed) => {
        document.getAnimations().forEach(animation => {
          try {
            animation.pause();
            animation.currentTime = elapsed;
          } catch { /* 이미 끝난 애니메이션은 무시 */ }
        });
      }, sceneElapsed);

      await page.screenshot({
        path: path.join(FRAME_DIR, `f${String(i).padStart(6, '0')}.png`),
        captureBeyondViewport: false,
        optimizeForSpeed: true,
      });

      if (i % FPS === 0 || i === totalFrames - 1) {
        log(`  캡처 ${Math.round(((i + 1) / totalFrames) * 100)}%  (${i + 1}/${totalFrames})`);
      }
    }

    const captured = (await readdir(FRAME_DIR)).filter(f => f.endsWith('.png')).length;
    if (captured === 0) throw new Error('캡처된 프레임이 없습니다.');

    log('  인코딩 중…');
    await run(ffmpegPath, [
      '-y',
      '-framerate', String(FPS),
      '-i', path.join(FRAME_DIR, 'f%06d.png'),
      '-vf', `scale=${WIDTH}:${HEIGHT}:flags=lanczos`,
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '16',                 // 낮을수록 고화질 (16이면 사실상 무손실에 가깝다)
      '-pix_fmt', 'yuv420p',        // 인스타·유튜브 호환
      '-movflags', '+faststart',
      OUT,
    ]);

    log(`✅ 완료 → ${OUT}`);
    return OUT;
  } finally {
    await browser.close();
    if (!keepFrames && existsSync(FRAME_DIR)) {
      await rm(FRAME_DIR, { recursive: true, force: true });
    }
  }
}

// ── CLI 로 직접 실행했을 때만 동작 (라우트에서 import 할 때는 실행되지 않는다) ──
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = Object.fromEntries(
    process.argv.slice(2).map(item => {
      const [key, value] = item.replace(/^--/, '').split('=');
      return [key, value === undefined ? true : value];
    })
  );

  captureReel({
    url: args.url,
    fps: args.fps,
    width: args.width,
    height: args.height,
    frameDir: args.frames,
    scale: args.scale,
    out: args.out,
    keepFrames: Boolean(args['keep-frames']),
    onProgress: message => console.log(message),
  }).catch(error => {
    console.error('\n❌ 실패:', error.message);
    process.exit(1);
  });
}
