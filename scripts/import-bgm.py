"""Take a folder of downloaded music and turn it into playable film scores.

Drop any mp3/wav/m4a/flac into assets/bgm-source/ and run this. Each file is cut
to the film's length at its strongest passage, faded, matched to the same
loudness as every other score, and written into the player's catalogue — so a
downloaded track behaves exactly like the synthesised ones.

Attribution: put a `credit` in assets/bgm-source/tracks.json for anything under a
licence that needs one (CC-BY and friends). The player shows it under the title.

  assets/bgm-source/tracks.json   (선택)
  {
    "lofi-afternoon.mp3": {
      "title": "로파이 애프터눈",
      "note": "느긋한 스윙 비트",
      "credit": "Kevin MacLeod / incompetech.com — CC BY 4.0",
      "start": 32
    }
  }

Requires: pip install numpy imageio-ffmpeg
Run: python scripts/import-bgm.py [--source DIR] [--replace] [--keep-synth]
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unicodedata
import wave

import imageio_ffmpeg
import numpy as np

from audio_loudness import encode_mp3, loudness

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/bgm-source'
OUT = ROOT / 'frontend/public/motion/bgm'
RATE = 44100
HEADROOM = .82   # 라우드니스는 audio_loudness.py 가 합성곡과 같은 기준으로 맞춘다
FADE_IN, FADE_OUT = 1.5, 3.0
AUDIO = {'.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac', '.wma', '.opus'}
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def slug(name):
    plain = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    plain = re.sub(r'[^a-zA-Z0-9]+', '-', plain).strip('-').lower()
    return plain or 'track'


def tags(path):
    """ffmpeg prints metadata on stderr; that is enough to name a track."""
    report = subprocess.run([FFMPEG, '-hide_banner', '-i', str(path)],
                            capture_output=True, text=True, errors='replace').stderr
    found = {}
    for line in report.splitlines():
        match = re.match(r'\s{4}(\w+)\s*:\s*(.+)', line)
        if match:
            found.setdefault(match.group(1).lower(), match.group(2).strip())
    return found


def decode(path):
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', str(path), '-f', 'f32le',
                          '-ac', '2', '-ar', str(RATE), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, '<f4').astype(np.float32).reshape(-1, 2)


def excerpt(samples, duration, start=None):
    """The film needs a specific length; take the loudest window unless told where."""
    need = int(duration * RATE)
    if len(samples) <= need:
        return np.pad(samples, ((0, need - len(samples)), (0, 0)))
    if start is not None:
        first = min(max(0, int(start * RATE)), len(samples) - need)
        return samples[first:first + need]
    step = RATE * 2
    energy = np.array([float(np.mean(np.square(samples[i:i + need])))
                       for i in range(0, len(samples) - need, step)])
    # a couple of bars before the peak, so the excerpt starts on a phrase not a hit
    best = max(0, int(np.argmax(energy)) - 2)
    return samples[best * step:best * step + need]


def polish(samples, duration):
    t = np.arange(len(samples), dtype=np.float32) / RATE
    fade = np.minimum(np.minimum(1, t / FADE_IN), np.clip((duration - t) / FADE_OUT, 0, 1))
    samples = samples * fade[:, None]
    peak = float(np.max(np.abs(samples)))
    return samples * (HEADROOM / peak if peak > 0 else 1)


def write_mp3(samples, destination):
    with tempfile.TemporaryDirectory(prefix='fitpoly-import-') as tmp:
        raw = Path(tmp) / 'track.wav'
        with wave.open(str(raw), 'wb') as handle:
            handle.setnchannels(2)
            handle.setsampwidth(2)
            handle.setframerate(RATE)
            handle.writeframes((samples * 32767).astype('<i2').tobytes())
        encode_mp3(raw, destination)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--replace', action='store_true', help='합성 20곡을 지우고 가져온 곡만 남김')
    parser.add_argument('--keep-synth', action='store_true', help='합성곡을 목록 위쪽에 그대로 둠')
    args = parser.parse_args()

    catalogue = json.loads((OUT / 'bgm.json').read_text(encoding='utf-8'))
    duration = catalogue['duration']
    if not args.source.is_dir():
        args.source.mkdir(parents=True, exist_ok=True)
        raise SystemExit(f'{args.source} 를 만들었습니다. 음원을 넣고 다시 실행하세요.')
    sidecar_path = args.source / 'tracks.json'
    sidecar = json.loads(sidecar_path.read_text(encoding='utf-8')) if sidecar_path.exists() else {}
    files = sorted(p for p in args.source.iterdir() if p.suffix.lower() in AUDIO)
    if not files:
        raise SystemExit(f'{args.source} 안에 음원이 없습니다.')

    imported = []
    for path in files:
        meta = sidecar.get(path.name, {})
        tag = tags(path)
        title = meta.get('title') or tag.get('title') or path.stem
        identifier = meta.get('id') or slug(path.stem)
        samples = polish(excerpt(decode(path), duration, meta.get('start')), duration)
        write_mp3(samples, OUT / f'{identifier}.mp3')
        level, _ = loudness(OUT / f'{identifier}.mp3')
        entry = {'id': identifier, 'title': title,
                 'note': meta.get('note') or tag.get('artist') or '가져온 음원',
                 'group': meta.get('group', 'imported'),
                 'file': f'/motion/bgm/{identifier}.mp3'}
        if meta.get('credit') or tag.get('artist'):
            entry['credit'] = meta.get('credit') or f"{tag['artist']}"
        imported.append(entry)
        print(f'✔ {identifier}.mp3  {level:6.1f} LUFS  ← {path.name}  ({title})')

    synth = [] if args.replace else [t for t in catalogue['tracks']
                                     if t['id'] not in {e['id'] for e in imported}]
    tracks = (synth + imported) if args.keep_synth else (imported + synth)
    if not tracks:
        raise SystemExit('남는 곡이 없습니다.')
    if args.replace:
        for stale in OUT.glob('*.mp3'):
            if stale.stem not in {t['id'] for t in tracks}:
                stale.unlink()
    groups = catalogue.get('groups', [])
    if any(t.get('group') == 'imported' for t in tracks) and \
            not any(g['id'] == 'imported' for g in groups):
        groups = [{'id': 'imported', 'label': '가져온 음원'}] + groups
    catalogue.update({'default': tracks[0]['id'], 'groups': groups, 'tracks': tracks})
    (OUT / 'bgm.json').write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + '\n',
                                  encoding='utf-8')
    print(f'\n{len(tracks)}곡 · 기본값 {tracks[0]["title"]}\n→ {OUT}')
    print('다운로드본에도 넣으려면: python scripts/bake-film-variants.py')


if __name__ == '__main__':
    main()
