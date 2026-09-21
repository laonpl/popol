"""Encode audio to MP3 at one broadcast loudness, so no score is louder than another.

Peak or RMS matching is not enough here: the scores range from a rhythmless pad to
a phonk track full of 808s, and those land far apart in perceived loudness even at
the same RMS. EBU R128 measures what the ear does, and its true-peak ceiling stops
the lossy encoder from overshooting 0 dBFS on the sharp percussive tracks.

The compressor in front of it is not decoration. Loudness normalisation can only
raise a track until its peaks reach the ceiling, so sparse percussive material —
staccato pizzicato, claps, jersey-club kicks — stalls several LU below target while
sustained pads sail to it. Measured across the catalogue, going through the
compressor pulls the spread from 5.6 LU to 1.8 LU.

Used by make-bgm.py and import-bgm.py so synthesised and downloaded music match.
"""
import json
import re
import subprocess

import imageio_ffmpeg

TARGET_LUFS = -16.0   # 웹 영상 기준
TARGET_PEAK = -1.5    # dBTP — 인코딩 뒤에도 0 dBFS 를 넘지 않게
TARGET_RANGE = 11.0
# 타악기가 많은 곡의 크레스트 팩터를 낮춰 라우드니스 정규화가 목표까지 올라가게 한다
EVEN_OUT = 'acompressor=threshold=0.03:ratio=4:attack=6:release=160:makeup=1'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def _filter(**extra):
    settings = {'I': TARGET_LUFS, 'TP': TARGET_PEAK, 'LRA': TARGET_RANGE, **extra}
    return EVEN_OUT + ',loudnorm=' + ':'.join(f'{key}={value}' for key, value in settings.items())


def measure(path):
    """First pass — what this file actually sounds like."""
    report = subprocess.run(
        [FFMPEG, '-hide_banner', '-i', str(path), '-af', _filter(print_format='json'),
         '-f', 'null', '-'], capture_output=True, text=True, errors='replace').stderr
    block = re.search(r'\{[^{}]*"input_i"[^{}]*\}', report, re.S)
    if not block:
        return None
    return json.loads(block.group(0))


def encode_mp3(source, destination, bitrate='160k'):
    """Second pass — apply the correction the first pass worked out, then encode."""
    stats = measure(source)
    if stats:
        chain = _filter(measured_I=stats['input_i'], measured_TP=stats['input_tp'],
                        measured_LRA=stats['input_lra'], measured_thresh=stats['input_thresh'],
                        offset=stats['target_offset'], print_format='summary')
    else:  # 측정이 실패해도 한 번은 통과시킨다
        chain = _filter()
    subprocess.run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-i', str(source),
                    '-af', chain, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', bitrate,
                    str(destination)], check=True)


def loudness(path):
    """Integrated loudness and true peak of a finished file, for reporting."""
    report = subprocess.run(
        [FFMPEG, '-hide_banner', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'],
        capture_output=True, text=True, errors='replace').stderr
    if 'Integrated loudness' not in report:
        return None, None
    tail = report[report.rindex('Integrated loudness'):]
    integrated = re.search(r'I:\s*(-?[\d.]+) LUFS', tail)
    peak = re.search(r'Peak:\s*(-?[\d.]+) dBFS', tail)
    return (float(integrated.group(1)) if integrated else None,
            float(peak.group(1)) if peak else None)
