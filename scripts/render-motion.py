"""Render /motion into a silent H.264 master using its actual browser artwork.

Captions are the only thing burned into the picture, so this produces one master
per caption setting. Sound is added afterwards by scripts/bake-film-variants.py,
which picks the score and the narration without touching the video stream.

Requires: pip install playwright imageio-ffmpeg (uses installed Google Chrome).
Start frontend Vite first, then run: python scripts/render-motion.py --captions on
All intermediate video files live in a temporary directory.
"""
import argparse
import base64
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import shutil
import subprocess
import tempfile

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DURATION = 52
MASTERS = ROOT / 'build/motion-masters'


def render_segment(job):
    """Independent deterministic frame ranges with optional lossless intermediates."""
    url, width, fps, first, last, destination, lossless, captions = job
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    command = [ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
               '-f', 'image2pipe', '-framerate', str(fps), '-vcodec', 'png' if lossless else 'mjpeg', '-i', 'pipe:0',
               '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-threads', '3',
               '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709',
               '-colorspace', 'bt709', '-movflags', '+faststart', destination]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page(viewport={'width': width, 'height': width * 9 // 16}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url.rstrip('/') + f'/motion?render=1&capture=1&cc={1 if captions else 0}',
                  wait_until='networkidle')
        page.wait_for_selector('.motion-picture[data-ready="true"]')
        page.evaluate('document.fonts.ready')
        page.wait_for_function('document.fonts.check(\'700 24px "Motion Pretendard"\')')
        capture = page.context.new_cdp_session(page)
        encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            for frame in range(first, last):
                t = frame / fps
                page.evaluate('''t => {
                  const slider = document.querySelector('.motion-seek');
                  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider, t);
                  slider.dispatchEvent(new Event('input', {bubbles: true}));
                }''', t)
                page.wait_for_function('t => Math.abs(Number(document.querySelector(".motion-picture").dataset.time) - t) < .002', arg=t)
                page.evaluate('new Promise(resolve => requestAnimationFrame(resolve))')
                options = {'format': 'png' if lossless else 'jpeg', 'captureBeyondViewport': False}
                if lossless:
                    options['optimizeForSpeed'] = True
                else:
                    options['quality'] = 100
                encoder.stdin.write(base64.b64decode(capture.send('Page.captureScreenshot', options)['data']))
                if (frame - first) % (fps * 2) == 0:
                    print(f'Segment {first // fps:02d}-{last // fps:02d}: rendered through {t:.1f}s', flush=True)
            encoder.stdin.close()
            error = encoder.stderr.read().decode('utf-8', errors='replace')
            if encoder.wait() != 0:
                raise RuntimeError(error)
            if errors:
                raise RuntimeError('Browser errors: ' + '; '.join(errors))
        except BaseException:
            encoder.kill()
            encoder.wait()
            raise
        finally:
            browser.close()
    return destination


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:3000')
    parser.add_argument('--captions', choices=('on', 'off'), default='on', help='자막을 화면에 구울지')
    parser.add_argument('--output', type=Path, help='기본값은 masters/film-cc.mp4 또는 masters/film-clean.mp4')
    parser.add_argument('--fps', type=int, default=60)
    parser.add_argument('--width', type=int, default=3840)
    parser.add_argument('--workers', type=int, default=3)
    parser.add_argument('--lossless-frames', action='store_true', help='Use PNG intermediate frames (slower). Default is quality-100 JPEG.')
    args = parser.parse_args()
    captions = args.captions == 'on'
    if args.output is None:
        args.output = MASTERS / ('film-cc.mp4' if captions else 'film-clean.mp4')
    height = args.width * 9 // 16
    if args.fps < 1 or args.width < 32 or args.width % 32 or height % 2 or not 1 <= args.workers <= 6:
        parser.error('Use positive FPS, a width divisible by 32 (1920 or 3840), and 1-6 workers.')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory(prefix='fitpoly-motion-') as tmp:
        tmp = Path(tmp)
        video = tmp / 'film.mp4'
        frames = DURATION * args.fps
        jobs = [(args.url, args.width, args.fps, frames * i // args.workers,
                 frames * (i + 1) // args.workers, str(tmp / f'segment-{i}.mp4'),
                 args.lossless_frames, captions) for i in range(args.workers)]
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            segments = list(pool.map(render_segment, jobs))
        playlist = tmp / 'segments.txt'
        playlist.write_text(''.join(f"file '{Path(segment).name}'\n" for segment in segments), encoding='utf-8')
        subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
                        '-i', str(playlist), '-an', '-c:v', 'copy', '-t', str(DURATION),
                        '-movflags', '+faststart', str(video)], check=True)
        # Keep the previous downloadable film intact until every segment succeeds.
        staging = args.output.with_suffix('.staging.mp4')
        shutil.copyfile(video, staging)
        staging.replace(args.output)
        print(f'Saved {args.output} ({args.output.stat().st_size / 1024 / 1024:.1f} MB)', flush=True)
        print('Next: python scripts/bake-film-variants.py', flush=True)


if __name__ == '__main__':
    main()
