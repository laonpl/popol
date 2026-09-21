"""Build the downloadable MP4s from the silent video masters plus the audio.

Audio is the only thing that changes between narration variants, so the video
stream is copied, never re-encoded — each variant takes a couple of seconds.
Captions are burned in, so those need their own master from render-motion.py.

  build/motion-masters/film-cc.mp4     자막이 들어간 무음 영상
  build/motion-masters/film-clean.mp4  자막 없는 무음 영상

무음 마스터는 서빙 대상이 아니라 public/ 밖에 두고 git 에서도 제외한다.

Requires: pip install imageio-ffmpeg
Run: python scripts/bake-film-variants.py [--bgm calm-piano] [--voice sunhi] [--all-bgm]
"""
import argparse
import json
from pathlib import Path
import subprocess

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
MOTION = ROOT / 'frontend/public/motion'
MASTERS = ROOT / 'build/motion-masters'
OUT = MOTION / 'downloads'
LEGACY = MOTION / 'fitpoly-3d-film.mp4'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def run(arguments):
    done = subprocess.run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', *arguments],
                          capture_output=True, text=True)
    if done.returncode != 0:
        raise RuntimeError(done.stderr.strip()[:600])


def ensure_masters():
    """Silent video masters. The pre-existing film stands in for the captioned one."""
    MASTERS.mkdir(parents=True, exist_ok=True)
    captioned = MASTERS / 'film-cc.mp4'
    if not captioned.exists() and LEGACY.exists():
        print(f'· {captioned.name} 이 없어 기존 {LEGACY.name} 에서 오디오만 떼어 만듭니다')
        run(['-i', str(LEGACY), '-an', '-c:v', 'copy', '-movflags', '+faststart', str(captioned)])
    found = {'cc': captioned if captioned.exists() else None,
             'clean': (MASTERS / 'film-clean.mp4') if (MASTERS / 'film-clean.mp4').exists() else None}
    for key, path in found.items():
        if path is None:
            flag = 'on' if key == 'cc' else 'off'
            print(f'! build/motion-masters/film-{"cc" if key == "cc" else "clean"}.mp4 없음 — '
                  f'python scripts/render-motion.py --captions {flag} 로 먼저 렌더하세요')
    return found


def mux(master, score, voice, destination):
    """One video copy plus either the score alone or the score ducked under the voice."""
    if voice is None:
        run(['-i', str(master), '-i', str(score), '-map', '0:v:0', '-map', '1:a:0',
             '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
             '-movflags', '+faststart', str(destination)])
        return
    chain = ('[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[bed];'
             '[2:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,'
             'asplit=2[voice][key];'
             '[bed][key]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=420[duck];'
             '[duck][voice]amix=inputs=2:normalize=0,alimiter=limit=0.95[out]')
    run(['-i', str(master), '-i', str(score), '-i', str(voice),
         '-filter_complex', chain, '-map', '0:v:0', '-map', '[out]',
         '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
         '-movflags', '+faststart', str(destination)])


def main():
    catalogue = json.loads((MOTION / 'bgm/bgm.json').read_text(encoding='utf-8'))
    titles = {track['id']: track['title'] for track in catalogue['tracks']}
    parser = argparse.ArgumentParser()
    parser.add_argument('--bgm', default=catalogue['default'], choices=sorted(titles))
    parser.add_argument('--all-bgm', action='store_true',
                        help='BGM 전곡으로 구움 (파일 수 ×20, 용량 주의)')
    parser.add_argument('--voice', default=None, help='내레이션 목소리 id (기본값은 narration.json 의 default)')
    args = parser.parse_args()
    if args.voice is None:
        args.voice = json.loads(
            (MOTION / 'narration/narration.json').read_text(encoding='utf-8'))['default']

    spoken_path = MOTION / 'narration/narration.json'
    if not spoken_path.exists():
        raise SystemExit('내레이션이 없습니다 — python scripts/make-narration.py 를 먼저 실행하세요.')
    spoken = json.loads(spoken_path.read_text(encoding='utf-8'))
    readers = {entry['id']: entry for entry in spoken['voices']}
    if args.voice not in readers:
        raise SystemExit(f'--voice 는 {", ".join(readers)} 중 하나여야 합니다.')
    voice = readers[args.voice]
    narration = MOTION / f'narration/{args.voice}.mp3'
    masters = ensure_masters()
    OUT.mkdir(parents=True, exist_ok=True)

    variants = []
    for bgm in (sorted(titles) if args.all_bgm else [args.bgm]):
        score = MOTION / f'bgm/{bgm}.mp3'
        for captions, master in masters.items():
            if master is None:
                continue
            for spoken in (True, False):
                suffix = '' if bgm == catalogue['default'] else f'-{bgm}'
                name = (f'fitpoly-film{"-cc" if captions == "cc" else ""}'
                        f'{"-voice" if spoken else ""}{suffix}.mp4')
                destination = OUT / name
                mux(master, score, narration if spoken else None, destination)
                variants.append({'file': f'/motion/downloads/{name}', 'bgm': bgm,
                                 'captions': captions == 'cc', 'narration': spoken,
                                 'size': destination.stat().st_size})
                print(f'✔ {name}  {destination.stat().st_size / 1024 / 1024:.1f} MB  '
                      f'(자막 {"O" if captions == "cc" else "X"} · 내레이션 '
                      f'{"O" if spoken else "X"} · {titles[bgm]})')

    (OUT / 'downloads.json').write_text(json.dumps(
        {'defaultBgm': catalogue['default'], 'voiceId': voice['id'],
         'voice': f"{voice['title']} · {voice['voice']}", 'variants': variants},
        ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'\n→ {OUT}')


if __name__ == '__main__':
    main()
