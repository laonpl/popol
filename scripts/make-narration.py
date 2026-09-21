"""Speak the film's narration lines and lay them onto 52-second tracks.

Reads frontend/public/motion/film-script.json, so the narration always matches
the captions on screen. Each line starts at its chapter time.

One track is written per voice in VOICES, and the player lets the viewer pick
between them — a synthetic voice is a matter of taste, so this ships several
rather than guessing at one.

Two things keep it from sounding robotic:

  * Silence is trimmed off both ends of every spoken line. The service pads its
    output, and that padding used to count against the chapter's length, which
    forced a time-stretch on the two short chapters.
  * Time-stretching is capped at 1.08. Past that a phase vocoder gives speech a
    metallic edge, so the script tells you to shorten the line instead.

Engines
  edge    (default) Microsoft Edge 읽어주기의 신경망 음성. 키 없이 네트워크만 있으면 된다.
  sapi    Windows System.Speech — 오프라인이지만 기계적이다. --rate 는 -10~10.
  gemini  Gemini TTS — GEMINI_API_KEY 가 generativelanguage 를 쓸 수 있어야 한다.

Requires: pip install numpy imageio-ffmpeg edge-tts
Run: python scripts/make-narration.py [--only sunhi] [--engine edge]
"""
import argparse
import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.error
import urllib.request
import wave

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / 'frontend/public/motion/film-script.json'
OUT = ROOT / 'frontend/public/motion/narration'
RATE = 44100
TARGET_RMS = .16          # narration sits above the score, which lands lower
MAX_SPEEDUP = 1.08        # past this a phase vocoder makes speech sound metallic
LEAD_IN = .15             # let the scene land before the line starts
TAIL_GUARD = .25          # never run right up against the next chapter
SILENCE = .004            # anything under this is padding, not speech
KEEP = .03                # leave a breath either side of the trim

# 골라 쓸 수 있게 여러 목소리를 굽는다. 숫자는 말하기 속도(퍼센트).
VOICES = [
    ('sunhi', '선히', '여성 · 또렷한 아나운서 톤', 'ko-KR-SunHiNeural', 6),
    ('injoon', '인준', '남성 · 차분하고 낮은 톤', 'ko-KR-InJoonNeural', 6),
    ('hyunsu', '현수', '남성 · 부드러운 최신 모델', 'ko-KR-HyunsuMultilingualNeural', 6),
    ('ava', '에이바', '여성 · 표현이 살아 있는 다국어 모델', 'en-US-AvaMultilingualNeural', 4),
    ('andrew', '앤드루', '남성 · 따뜻하고 단단한 다국어 모델', 'en-US-AndrewMultilingualNeural', 4),
    ('emma', '엠마', '여성 · 밝고 대화하듯 읽는 톤', 'en-US-EmmaMultilingualNeural', 4),
]
DEFAULT = 'ava'


def ps_quote(value):
    """A PowerShell single-quoted literal; the only escape inside one is ''."""
    return "'" + str(value).replace("'", "''") + "'"


def speak_sapi(text, destination, voice, rate):
    """Windows' built-in synthesiser, writing a WAV straight to disk.

    The lines are Korean, so the script goes through a UTF-8 file with a BOM
    rather than the command line, which Windows would read in the ANSI code page.
    """
    body = (
        'Add-Type -AssemblyName System.Speech\n'
        '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer\n'
        f'$s.SelectVoice({ps_quote(voice)})\n'
        f'$s.Rate = {int(rate)}\n'
        f'$s.SetOutputToWaveFile({ps_quote(destination)})\n'
        f'$s.Speak({ps_quote(text)})\n'
        '$s.Dispose()\n'
    )
    runner = destination.with_suffix('.ps1')
    runner.write_text(body, encoding='utf-8-sig')
    done = subprocess.run(['powershell', '-NoProfile', '-NonInteractive',
                           '-ExecutionPolicy', 'Bypass', '-File', str(runner)],
                          capture_output=True, text=True)
    if done.returncode != 0 or not destination.exists():
        raise RuntimeError(f'SAPI 합성 실패: {done.stderr.strip() or done.stdout.strip()}')


def speak_edge(text, destination, voice, rate):
    """Edge 읽어주기의 신경망 음성. mp3 로 오지만 ffmpeg 가 확장자를 보지 않는다."""
    import asyncio

    import edge_tts

    async def render():
        speech = edge_tts.Communicate(text, voice, rate=f'{int(rate):+d}%')
        await speech.save(str(destination))
    asyncio.run(render())
    if not destination.exists() or destination.stat().st_size < 1024:
        raise RuntimeError('edge-tts 가 오디오를 받지 못했습니다 — 네트워크를 확인하세요.')


def speak_gemini(text, destination, voice, _rate):
    """Gemini TTS returns raw 24 kHz mono PCM, which we wrap as a WAV."""
    key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if not key:
        raise RuntimeError('GEMINI_API_KEY 가 없습니다.')
    body = json.dumps({
        'contents': [{'parts': [{'text': text}]}],
        'generationConfig': {
            'responseModalities': ['AUDIO'],
            'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}},
        },
    }).encode()
    url = ('https://generativelanguage.googleapis.com/v1beta/models/'
           'gemini-2.5-flash-preview-tts:generateContent')
    request = urllib.request.Request(url, data=body, headers={
        'content-type': 'application/json', 'x-goog-api-key': key})
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Gemini TTS {error.code}: {error.read().decode()[:300]}') from error
    parts = payload['candidates'][0]['content']['parts']
    pcm = base64.b64decode(next(p['inlineData']['data'] for p in parts if 'inlineData' in p))
    with wave.open(str(destination), 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(24000)
        handle.writeframes(pcm)


ENGINES = {'edge': speak_edge, 'sapi': speak_sapi, 'gemini': speak_gemini}


def load_mono(path, tempo=1.0):
    """Decode to 44.1 kHz mono floats, trimmed of padding and optionally sped up."""
    filters = ['highpass=f=90']
    while tempo > 1.0001:  # atempo only accepts 0.5–2.0 per stage
        step = min(tempo, 2.0)
        filters.append(f'atempo={step:.5f}')
        tempo /= step
    raw = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-i', str(path),
                          '-af', ','.join(filters), '-f', 'f32le', '-ac', '1', '-ar', str(RATE), '-'],
                         capture_output=True, check=True).stdout
    samples = np.frombuffer(raw, '<f4').astype(np.float32)
    loud = np.flatnonzero(np.abs(samples) > SILENCE)
    if not len(loud):
        return samples
    margin = int(KEEP * RATE)
    return samples[max(0, loud[0] - margin):min(len(samples), loud[-1] + margin)].copy()


def render_voice(speak, voice, rate, chapters, duration, tmp):
    """One complete 52-second narration track, plus what happened to each line."""
    buffer = np.zeros(int(RATE * duration), dtype=np.float32)
    lines, warnings = [], []
    for index, chapter in enumerate(chapters):
        spoken = Path(tmp) / f'line-{index}.wav'
        speak(chapter['narration'], spoken, voice, rate)
        samples = load_mono(spoken)
        start = chapter['at'] + LEAD_IN
        nextat = chapters[index + 1]['at'] if index + 1 < len(chapters) else duration
        room = nextat - TAIL_GUARD - start
        length = len(samples) / RATE
        if length > room:  # squeeze it into the gap instead of talking over the cut
            tempo = min(MAX_SPEEDUP, length / room)
            samples = load_mono(spoken, tempo)
            length = len(samples) / RATE
            if length > room + .05:
                warnings.append(f'{chapter["at"]:>2}s 문장이 {length - room:.1f}초 깁니다 — '
                                f'film-script.json 의 narration 을 줄이세요.')
            else:
                warnings.append(f'{chapter["at"]:>2}s 문장을 {tempo:.2f}배로 압축했습니다.')
        peak = float(np.max(np.abs(samples)))
        if peak > 0:
            samples = samples * (.82 / peak)
        edge = int(.01 * RATE)  # short fades, so no click at either end
        samples[:edge] *= np.linspace(0, 1, edge, dtype=np.float32)
        samples[-edge:] *= np.linspace(1, 0, edge, dtype=np.float32)
        first = int(start * RATE)
        fit = min(len(samples), len(buffer) - first)
        buffer[first:first + fit] += samples[:fit]
        lines.append({'at': chapter['at'], 'start': round(start, 3),
                      'length': round(length, 3), 'text': chapter['narration']})
    speech = buffer[np.abs(buffer) > .001]
    if speech.size:
        buffer = np.clip(buffer * (TARGET_RMS / float(np.sqrt(np.mean(np.square(speech))))), -.95, .95)
    return buffer, lines, warnings


def write_mp3(buffer, destination, tmp):
    raw = Path(tmp) / 'narration.wav'
    with wave.open(str(raw), 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes((buffer * 32767).astype('<i2').tobytes())
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-hide_banner', '-loglevel', 'error',
                    '-i', str(raw), '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '160k',
                    str(destination)], check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--engine', choices=sorted(ENGINES), default='edge')
    parser.add_argument('--only', help='한 목소리만 다시 굽기 (예: --only injoon)')
    parser.add_argument('--rate', type=int, help='VOICES 에 적힌 기본 속도를 덮어씀')
    args = parser.parse_args()
    speak = ENGINES[args.engine]

    script = json.loads(SCRIPT.read_text(encoding='utf-8'))
    duration = script['duration']
    chapters = [c for c in script['chapters'] if c.get('narration')]
    wanted = [v for v in VOICES if not args.only or v[0] == args.only]
    if not wanted:
        raise SystemExit(f'--only {args.only} 에 맞는 목소리가 없습니다.')
    OUT.mkdir(parents=True, exist_ok=True)

    catalogue = []
    for identifier, title, note, voice, rate in wanted:
        with tempfile.TemporaryDirectory(prefix='fitpoly-narration-') as tmp:
            buffer, lines, warnings = render_voice(
                speak, voice, args.rate if args.rate is not None else rate,
                chapters, duration, tmp)
            write_mp3(buffer, OUT / f'{identifier}.mp3', tmp)
        catalogue.append({'id': identifier, 'title': title, 'note': note, 'voice': voice,
                          'file': f'/motion/narration/{identifier}.mp3', 'lines': lines})
        longest = max(line['length'] for line in lines)
        print(f'✔ {identifier}.mp3  {title} · {voice}  (가장 긴 문장 {longest:.1f}초)')
        for warning in warnings:
            print(f'    ! {warning}')

    if args.only:  # 나머지 목소리는 그대로 둔다
        existing = json.loads((OUT / 'narration.json').read_text(encoding='utf-8'))['voices']
        keep = {entry['id']: entry for entry in existing}
        keep.update({entry['id']: entry for entry in catalogue})
        catalogue = [keep[v[0]] for v in VOICES if v[0] in keep]

    (OUT / 'narration.json').write_text(json.dumps(
        {'engine': args.engine, 'duration': duration, 'default': DEFAULT, 'voices': catalogue},
        ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'\n{len(catalogue)}개 목소리\n→ {OUT}')


if __name__ == '__main__':
    main()
