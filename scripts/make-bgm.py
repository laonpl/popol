"""Write the ten original background scores the film can play, as 52-second MP3s.

Everything here is synthesised from scratch, so the tracks carry no third-party
licence. Run once, or again after changing a track: the player and the MP4 both
read the files this produces.

Requires: pip install numpy imageio-ffmpeg
Run: python scripts/make-bgm.py
"""
import json
import math
from pathlib import Path
import subprocess
import tempfile
import wave

import imageio_ffmpeg
import numpy as np

from audio_loudness import TARGET_LUFS, encode_mp3, loudness

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'frontend/public/motion/bgm'
RATE = 44100
DURATION = 52
FADE_IN, FADE_OUT = 1.5, 3.0
HEADROOM = .82  # 라우드니스 정규화는 audio_loudness.py 가 맡는다

# 12-TET from A4 = 440. 'C4' → 261.63
STEPS = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def pitch(name):
    step = STEPS[name[0]] + name.count('#') - name.count('b')
    octave = int(name[-1])
    return 440 * 2 ** ((step + (octave - 4) * 12 - 9) / 12)


def chord(root, quality, octave=3):
    """Root name plus a quality → the frequencies of its notes."""
    intervals = {'maj': (0, 4, 7), 'min': (0, 3, 7), 'maj7': (0, 4, 7, 11),
                 'min7': (0, 3, 7, 10), 'sus2': (0, 2, 7), 'sus4': (0, 5, 7),
                 'dom7': (0, 4, 7, 10), 'add9': (0, 4, 7, 14)}[quality]
    base = pitch(f'{root}{octave}')
    return [base * 2 ** (i / 12) for i in intervals]


class Track:
    """A stereo buffer that instruments draw into."""

    def __init__(self):
        self.buffer = np.zeros((int(RATE * DURATION) + RATE, 2), dtype=np.float32)

    def _slot(self, start, length):
        first = max(0, int(start * RATE))
        last = min(len(self.buffer), first + int(length * RATE))
        if last <= first:
            return None, None
        return first, np.arange(last - first, dtype=np.float32) / RATE

    def _mix(self, first, signal, pan):
        left, right = math.sqrt((1 - pan) / 2), math.sqrt((1 + pan) / 2)
        self.buffer[first:first + len(signal), 0] += signal * left
        self.buffer[first:first + len(signal), 1] += signal * right

    def tone(self, start, freq, length, gain, partials, decay, attack=.006, pan=0., vibrato=0.):
        """One struck or bowed note: a stack of partials under one envelope."""
        first, t = self._slot(start, length)
        if first is None:
            return
        wave_sum = np.zeros_like(t)
        for index, weight in enumerate(partials, start=1):
            if weight:
                detune = 1 + vibrato * np.sin(2 * math.pi * 5.2 * t) if vibrato else 1
                wave_sum += weight * np.sin(2 * math.pi * freq * index * t * detune)
        envelope = np.minimum(1, t / attack) * np.exp(-t * decay)
        self._mix(first, wave_sum * envelope * gain, pan)

    def pad(self, start, freq, length, gain, attack=.7, release=1.2, pan=0.):
        """A slow swell that holds, for chords sitting behind everything else."""
        first, t = self._slot(start, length + release)
        if first is None:
            return
        wave_sum = sum(weight * np.sin(2 * math.pi * freq * index * t + index)
                       for index, weight in enumerate((1, .42, .2, .09), start=1))
        wave_sum += .5 * np.sin(2 * math.pi * freq * 1.004 * t)  # gentle chorus
        hold = np.minimum(1, t / attack)
        tail = np.clip((length + release - t) / release, 0, 1)
        breathe = 1 + .06 * np.sin(2 * math.pi * .13 * t)
        self._mix(first, wave_sum * hold * tail * breathe * gain, pan)

    def saw(self, start, freq, length, gain, decay=6., pan=0.):
        first, t = self._slot(start, length)
        if first is None:
            return
        harmonics = int(min(14, RATE / 2.4 / freq))
        wave_sum = sum(np.sin(2 * math.pi * freq * n * t) / n for n in range(1, harmonics + 1))
        envelope = np.minimum(1, t / .004) * np.exp(-t * decay)
        self._mix(first, wave_sum * envelope * gain, pan)

    def noise(self, start, length, gain, decay, colour=1., pan=0., seed=0):
        """Filtered noise — hats, shakers, brushes and vinyl hiss."""
        first, t = self._slot(start, length)
        if first is None:
            return
        raw = np.random.default_rng(seed).standard_normal(len(t)).astype(np.float32)
        if colour > 0:  # differencing brightens, averaging darkens
            for _ in range(int(colour)):
                raw = np.diff(raw, prepend=raw[:1])
        else:
            for _ in range(int(-colour)):
                raw = np.convolve(raw, np.full(9, 1 / 9), mode='same')
        self._mix(first, raw * np.exp(-t * decay) * gain, pan)

    def kick(self, start, gain=.9, top=112., bottom=46., decay=9.):
        first, t = self._slot(start, .5)
        if first is None:
            return
        freq = bottom + (top - bottom) * np.exp(-t * 26)
        phase = 2 * math.pi * np.cumsum(freq) / RATE
        self._mix(first, np.sin(phase) * np.exp(-t * decay) * gain, 0.)

    def glide(self, start, top, bottom, length, gain, decay=2.4, drive=1.6, pan=0.):
        """808 / 로그드럼 — 음정이 미끄러져 내려앉는 저음."""
        first, t = self._slot(start, length)
        if first is None:
            return
        freq = bottom + (top - bottom) * np.exp(-t * 15)
        phase = 2 * math.pi * np.cumsum(freq) / RATE
        shaped = np.tanh(np.sin(phase) * drive) / math.tanh(drive)
        envelope = np.minimum(1, t / .006) * np.exp(-t * decay)
        self._mix(first, shaped * envelope * gain, pan)

    def metal(self, start, freq, length, gain, ratio=1.4815, decay=17., drive=2.6, pan=0.):
        """두 개의 사각파를 겹친 808 카우벨. 펑크의 멜로디는 이걸로 만든다."""
        first, t = self._slot(start, length)
        if first is None:
            return
        square = sum(np.sin(2 * math.pi * freq * n * t) / n for n in (1, 3, 5, 7))
        square += sum(np.sin(2 * math.pi * freq * ratio * n * t) / n for n in (1, 3, 5))
        shaped = np.tanh(square * drive) / math.tanh(drive)
        self._mix(first, shaped * np.exp(-t * decay) * gain, pan)

    def clap(self, start, gain=.5, pan=0., seed=0):
        """세 번 빠르게 튀는 노이즈 — 손뼉."""
        for offset, level in ((0, .55), (.012, .8), (.026, 1.)):
            self.noise(start + offset, .2, gain * level, 27, 2, pan, seed=seed + int(offset * 1e4))

    def pump(self, times, depth=.5, release=.3):
        """킥에 맞춰 전체가 잠깐 눌렸다 돌아오는 사이드체인 느낌."""
        envelope = np.ones(len(self.buffer), dtype=np.float32)
        span = int(release * RATE)
        for start in times:
            first = int(start * RATE)
            if first >= len(envelope):
                continue
            ramp = np.linspace(0, 1, min(span, len(envelope) - first), dtype=np.float32)
            window = envelope[first:first + len(ramp)]
            envelope[first:first + len(ramp)] = np.minimum(window, 1 - depth * (1 - ramp) ** 2)
        self.buffer *= envelope[:, None]

    def reverb(self, wet=.3, size=1.):
        """Four attenuated taps — enough space without a convolution kernel."""
        out = self.buffer.copy()
        for delay, level in ((.0231, .30), (.0367, .24), (.0533, .19), (.0719, .14), (.1013, .10)):
            offset = int(delay * size * RATE)
            out[offset:] += self.buffer[:len(self.buffer) - offset] * level * wet
        self.buffer = out

    def finish(self):
        """Fade and leave headroom; the encoder matches loudness across scores."""
        samples = self.buffer[:int(RATE * DURATION)]
        t = np.arange(len(samples), dtype=np.float32) / RATE
        fade = np.minimum(np.minimum(1, t / FADE_IN), np.clip((DURATION - t) / FADE_OUT, 0, 1))
        samples = samples * fade[:, None]
        peak = float(np.max(np.abs(samples)))
        return samples * (HEADROOM / peak if peak > 0 else 1)


def beats(bpm, count, offset=0.):
    """Start times for `count` beats, so patterns read as musical positions."""
    return [offset + i * 60 / bpm for i in range(count)]


PIANO = (1, .42, .2, .1, .05)
BELL = (1, .0, .55, .0, .28)
GUITAR = (1, .58, .33, .19, .11, .06)
MARIMBA = (1, .06, .0, .28)
RHODES = (1, .22, .07, .03)
BASS = (1, .28, .1)


# ── the ten scores ────────────────────────────────────────────────────────
def calm_piano(track):
    """Default score: an unhurried piano figure over a held string bed."""
    progression = [('C', 'maj7'), ('G', 'maj'), ('A', 'min7'), ('F', 'maj7')]
    bar = 4.0
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        start = index * bar
        for voice in chord(root, quality, 3):
            track.pad(start, voice, bar, .05)
        track.tone(start, chord(root, quality, 2)[0], bar, .16, BASS, 1.1)
        pattern = [0, 2, 1, 3 % len(notes), 1, 2, 0, 1]
        for step, degree in enumerate(pattern):
            track.tone(start + step * bar / 8, notes[degree % len(notes)] * (2 if step in (3, 6) else 1),
                       2.4, .105 if step % 4 == 0 else .07, PIANO, 2.3, pan=-.25 + .07 * step)
    track.reverb(.42, 1.15)


def warm_acoustic(track):
    """Fingerpicked guitar, brushed and close, with a soft upright bass."""
    progression = [('G', 'maj'), ('E', 'min7'), ('C', 'maj7'), ('D', 'sus4')]
    bar = 3.2
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        start = index * bar
        track.tone(start, chord(root, quality, 2)[0], 2.6, .19, BASS, 1.5)
        track.tone(start + bar / 2, chord(root, quality, 2)[0] * 1.5, 1.6, .11, BASS, 1.8)
        for step, degree in enumerate([0, 2, 1, 3, 2, 1, 3, 2]):
            track.tone(start + step * bar / 8, notes[degree % len(notes)] * (2 if step > 4 else 1),
                       1.9, .085 if step % 2 == 0 else .055, GUITAR, 3.4,
                       pan=.3 if step % 2 else -.3)
        for voice in chord(root, quality, 3)[:3]:
            track.pad(start, voice, bar, .028)
    track.reverb(.3, .9)


def bright_pop(track):
    """Four-on-the-floor with a plucky lead — the upbeat option."""
    bpm, progression = 108, [('D', 'maj'), ('A', 'maj'), ('B', 'min7'), ('G', 'maj7')]
    bar = 60 / bpm * 4
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        start = index * bar
        for step in range(4):
            track.kick(start + step * bar / 4, .62)
            track.noise(start + step * bar / 4 + bar / 8, .16, .05, 42, 2, .3, seed=index * 8 + step)
        track.tone(start, chord(root, quality, 2)[0], bar * .9, .16, BASS, .7)
        for step, degree in enumerate([0, 1, 2, 1, 0, 2, 1, 2]):
            track.saw(start + step * bar / 8, notes[degree % len(notes)] * 2, .5,
                      .05 if step % 2 else .075, 9.5, pan=-.35 + .1 * step)
        for voice in chord(root, quality, 3):
            track.pad(start, voice, bar, .026)
    track.reverb(.26, .8)


def lofi_study(track):
    """Swung, filtered and a little dusty — a background you can talk over."""
    bpm, progression = 76, [('F', 'maj7'), ('A', 'min7'), ('B', 'min7'), ('E', 'dom7')]
    bar = 60 / bpm * 4
    track.noise(0, DURATION, .012, .0, -3, 0., seed=99)  # vinyl bed
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        start = index * bar
        track.kick(start, .5, 96, 42, 11)
        track.kick(start + bar * .625, .38, 96, 42, 11)
        track.noise(start + bar / 2, .3, .06, 26, -1, 0., seed=index * 3)  # brushed snare
        for step in range(8):  # swung hats
            swing = bar / 8 * (step + (.14 if step % 2 else 0))
            track.noise(start + swing, .12, .028, 55, 2, .22 if step % 2 else -.22, seed=index * 16 + step)
        track.tone(start, chord(root, quality, 2)[0], bar * .8, .17, BASS, .9)
        for step, degree in enumerate([0, 2, 3 % len(notes), 1]):
            track.tone(start + step * bar / 4 + .06, notes[degree % len(notes)], 2.2,
                       .075, RHODES, 2.0, attack=.02, pan=-.2 + .13 * step, vibrato=.0015)
    track.reverb(.34, 1.0)


def hopeful_build(track):
    """Follows the film's own arc: bare at first, full by the closing line."""
    progression = [('C', 'maj'), ('G', 'maj'), ('A', 'min'), ('F', 'maj7')]
    bar = 4.0
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        start = index * bar
        for voice in chord(root, quality, 3):
            track.pad(start, voice, bar, .036 + .022 * min(1, start / 34))
        track.tone(start, chord(root, quality, 2)[0], bar, .13 + .06 * min(1, start / 34), BASS, .9)
        if start >= 12:  # the arpeggio joins when the product appears
            level = .05 + .035 * min(1, (start - 12) / 26)
            for step, degree in enumerate([0, 1, 2, 1]):
                track.tone(start + step * bar / 4, notes[degree % len(notes)] * 2, 2.0,
                           level, BELL, 1.9, pan=-.3 + .2 * step)
        if start >= 26:  # a pulse under the results
            for step in range(4):
                track.kick(start + step * bar / 4, .3 + .22 * min(1, (start - 26) / 18))
        if start >= 40:  # the last two bars open up
            for voice in chord(root, quality, 5):
                track.tone(start, voice, 3.4, .05, BELL, 1.1, pan=.25)
    track.reverb(.46, 1.3)


def cinematic_rise(track):
    """Low drone, string swells and a single arrival near the end."""
    progression = [('A', 'min'), ('F', 'maj'), ('C', 'maj'), ('G', 'maj')]
    bar = 6.5
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        start = index * bar
        for voice in chord(root, quality, 2):
            track.pad(start, voice, bar, .055, attack=1.6, release=2.0)
        for voice in chord(root, quality, 4):
            track.pad(start, voice, bar, .03, attack=2.2, release=1.8, pan=.3)
        track.tone(start, pitch('A1'), bar, .12, (1, .2), .35)
        track.noise(start, 2.4, .022, 1.1, -2, 0., seed=index)  # air
    for hit, level in ((13, .5), (23, .55), (33, .62), (44, .95)):
        track.kick(hit, level, 78, 38, 4.5)
        for voice in chord('A', 'min', 4):
            track.tone(hit, voice, 5.0, .05 * level, BELL, .7)
    track.reverb(.55, 1.6)


def minimal_tech(track):
    """A clean sixteenth pulse — reads as product, not as mood."""
    bpm, progression = 118, [('E', 'min'), ('E', 'min'), ('C', 'maj7'), ('D', 'sus2')]
    bar = 60 / bpm * 4
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 5)
        start = index * bar
        for step in range(16):
            if step % 4 == 0:
                track.kick(start + step * bar / 16, .5, 104, 44, 12)
            track.noise(start + step * bar / 16, .07, .016 if step % 2 else .03, 90, 2,
                        .35 if step % 4 == 2 else -.35, seed=index * 32 + step)
        track.tone(start, chord(root, quality, 2)[0], bar * .5, .15, BASS, 1.4)
        track.tone(start + bar * .5, chord(root, quality, 2)[0], bar * .4, .1, BASS, 1.6)
        for step, degree in enumerate([0, 2, 1]):
            track.tone(start + step * bar / 3, notes[degree % len(notes)], .9, .05, MARIMBA, 5.5,
                       pan=-.4 + .4 * step)
        for voice in chord(root, quality, 3)[:2]:
            track.pad(start, voice, bar, .022)
    track.reverb(.24, .75)


def soft_ambient(track):
    """No pulse at all — overlapping pads with occasional bells."""
    progression = [('E', 'maj7'), ('C', 'maj7'), ('A', 'min7'), ('B', 'sus4')]
    bar = 8.0
    for index in range(int(DURATION / bar) + 2):
        root, quality = progression[index % 4]
        start = index * bar - 1.2  # let each chord bleed into the last
        for voice_index, voice in enumerate(chord(root, quality, 3)):
            track.pad(start, voice, bar + 1.2, .05, attack=2.4, release=2.6,
                      pan=-.45 + .3 * voice_index)
        track.pad(start, chord(root, quality, 2)[0], bar + 1.2, .06, attack=2.0, release=2.4)
        for offset, voice in ((1.4, 0), (4.1, 2), (6.2, 1)):
            track.tone(start + offset, chord(root, quality, 5)[voice], 5.5, .045, BELL, .9,
                       pan=.4 if offset > 4 else -.4)
    track.reverb(.62, 1.8)


def playful_marimba(track):
    """Light and quick — good under the file-stacking opening."""
    bpm, progression = 98, [('F', 'maj'), ('C', 'maj'), ('D', 'min7'), ('B', 'maj7')]
    bar = 60 / bpm * 4
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        start = index * bar
        for step, degree in enumerate([0, 1, 2, 0, 1, 2, 1, 0]):
            track.tone(start + step * bar / 8, notes[degree % len(notes)] * (2 if step % 3 == 2 else 1),
                       1.1, .085 if step % 4 == 0 else .06, MARIMBA, 7.5, pan=-.4 + .11 * step)
        track.tone(start, chord(root, quality, 2)[0], bar * .8, .15, BASS, 1.2)
        for step in range(4):
            track.noise(start + step * bar / 4 + bar / 8, .1, .022, 60, 2, .3, seed=index * 4 + step)
        for voice in chord(root, quality, 3)[:3]:
            track.pad(start, voice, bar, .022)
    track.reverb(.3, .95)


def night_chill(track):
    """Deep and sparse, for a quieter read of the same story."""
    bpm, progression = 84, [('D', 'min7'), ('B', 'maj7'), ('F', 'maj7'), ('C', 'maj')]
    bar = 60 / bpm * 4
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        start = index * bar
        track.tone(start, chord(root, quality, 1)[0], bar * .9, .22, (1, .12), .8)
        track.kick(start, .42, 88, 40, 10)
        track.noise(start + bar / 2, .35, .04, 22, -1, 0., seed=index * 5)
        for step, degree in enumerate([0, 3 % len(notes), 1, 2]):
            track.tone(start + step * bar / 4 + (.1 if step % 2 else 0), notes[degree % len(notes)],
                       2.8, .07, RHODES, 1.6, attack=.03, pan=-.3 + .2 * step, vibrato=.002)
        for voice in chord(root, quality, 3)[:3]:
            track.pad(start, voice, bar, .026, attack=1.1)
    track.reverb(.44, 1.25)


# ── 서비스 소개 영상에서 흔히 쓰는 다섯 ────────────────────────────────
PLUCK = (1, .3, .55, .12, .2)
PIZZ = (1, .7, .45, .3, .16, .09)


def corporate_uplift(track):
    """플럭 신스와 피아노가 같이 걷는 밝은 코퍼레이트 베드."""
    bpm, progression = 104, [('C', 'maj'), ('G', 'maj'), ('A', 'min'), ('F', 'maj')]
    bar = 60 / bpm * 4
    hits = []
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 5)
        start = index * bar
        for step in range(4):
            track.kick(start + step * bar / 4, .5, 104, 44, 11)
            hits.append(start + step * bar / 4)
        track.clap(start + bar / 4, .3, .2, seed=index * 4)
        track.clap(start + bar * .75, .3, .2, seed=index * 4 + 2)
        track.tone(start, chord(root, quality, 2)[0], bar * .95, .16, BASS, .8)
        for step, degree in enumerate([0, 2, 1, 2, 0, 1, 2, 1]):
            track.tone(start + step * bar / 8, notes[degree % len(notes)], 1.0,
                       .062 if step % 2 else .085, PLUCK, 6.2, pan=-.34 + .1 * step)
        for step, degree in enumerate([0, 1, 2]):
            track.tone(start + step * bar / 4, chord(root, quality, 4)[degree % 3], 2.2,
                       .055, PIANO, 2.4, pan=.2)
        for voice in chord(root, quality, 3):
            track.pad(start, voice, bar, .028)
    track.pump(hits, .34, .2)
    track.reverb(.3, .95)


def clean_tech(track):
    """제품 투어에 까는 미니멀 아르페지오. 말을 거의 가리지 않는다."""
    bpm, progression = 100, [('D', 'sus2'), ('A', 'min7'), ('B', 'maj7'), ('F', 'maj7')]
    bar = 60 / bpm * 4
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 5)
        start = index * bar
        for step in range(16):
            degree = [0, 1, 2, 1][step % 4] + (1 if step >= 8 else 0)
            track.tone(start + step * bar / 16, notes[degree % len(notes)], .7,
                       .034 if step % 4 else .05, PLUCK, 9.5, pan=-.4 + .053 * step)
        track.tone(start, chord(root, quality, 2)[0], bar * .9, .13, BASS, .9)
        for step in (0, 2):
            track.kick(start + step * bar / 4, .34, 96, 42, 13)
        for voice in chord(root, quality, 3)[:3]:
            track.pad(start, voice, bar, .03, attack=1.0)
        track.noise(start + bar / 2, .5, .012, 8, -2, 0., seed=index)
    track.reverb(.36, 1.1)


def infographic_pizz(track):
    """피치카토 스타카토와 손뼉 — 설명 영상의 기본값."""
    bpm, progression = 116, [('F', 'maj'), ('D', 'min7'), ('B', 'maj7'), ('C', 'maj')]
    bar = 60 / bpm * 4
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        start = index * bar
        for step, degree in enumerate([0, 2, 1, 3, 0, 2, 1, 2]):
            track.tone(start + step * bar / 8, notes[degree % len(notes)] * (2 if step == 4 else 1),
                       .5, .075 if step % 4 == 0 else .052, PIZZ, 11.5, pan=-.36 + .1 * step)
        track.tone(start, chord(root, quality, 2)[0], bar * .45, .14, PIZZ, 4.2)
        track.tone(start + bar / 2, chord(root, quality, 2)[0], bar * .45, .11, PIZZ, 4.2)
        track.clap(start + bar / 4, .34, -.15, seed=index * 5)
        track.clap(start + bar * .75, .34, .15, seed=index * 5 + 3)
        for step in range(8):
            track.noise(start + step * bar / 8 + bar / 16, .08, .018, 68, 2,
                        .3 if step % 2 else -.3, seed=index * 16 + step)
    track.reverb(.26, .8)


def brand_story(track):
    """창업 이야기용 — 피아노 한 대로 시작해 스트링이 차오른다."""
    progression = [('F', 'maj7'), ('C', 'maj'), ('D', 'min7'), ('B', 'maj7')]
    bar = 4.4
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        start = index * bar
        swell = .034 + .03 * min(1, start / 36)
        for voice in chord(root, quality, 3):
            track.pad(start, voice, bar, swell, attack=1.3, release=1.6)
        if start >= 17:
            for voice in chord(root, quality, 5)[:2]:
                track.pad(start, voice, bar, swell * .55, attack=1.8, release=1.8, pan=.35)
        track.tone(start, chord(root, quality, 2)[0], bar, .15, BASS, .9)
        for step, degree in enumerate([0, 2, 1, 3, 2, 1]):
            track.tone(start + step * bar / 6, notes[degree % len(notes)] * (2 if step == 3 else 1),
                       2.6, .092 if step == 0 else .062, PIANO, 2.1, pan=-.22 + .09 * step)
    track.reverb(.48, 1.35)


def launch_day(track):
    """런칭 영상용 — 손뼉과 스탭이 앞으로 미는 업템포."""
    bpm, progression = 122, [('A', 'maj'), ('E', 'maj'), ('F', 'min7'), ('D', 'maj')]
    bar = 60 / bpm * 4
    hits = []
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        start = index * bar
        for step in range(4):
            track.kick(start + step * bar / 4, .58)
            hits.append(start + step * bar / 4)
        for step in range(8):
            track.noise(start + step * bar / 8 + bar / 16, .1, .024, 52, 2,
                        .32 if step % 2 else -.32, seed=index * 20 + step)
        track.clap(start + bar / 4, .4, 0., seed=index * 7)
        track.clap(start + bar * .75, .4, 0., seed=index * 7 + 4)
        track.tone(start, chord(root, quality, 2)[0], bar * .48, .17, BASS, .9)
        track.tone(start + bar / 2, chord(root, quality, 2)[0], bar * .45, .13, BASS, 1.1)
        for step in (0, 1.5, 3):  # 코드 스탭
            for voice in chord(root, quality, 4):
                track.saw(start + step * bar / 4, voice, .42, .034, 8.5, pan=.15)
        for step, degree in enumerate([2, 1, 2, 0]):
            track.tone(start + step * bar / 4 + bar / 8, notes[degree % len(notes)] * 2, .8,
                       .05, PLUCK, 7.5, pan=-.3 + .2 * step)
    track.pump(hits, .42, .19)
    track.reverb(.28, .85)


# ── 요즘 숏폼에서 유행하는 다섯 ──────────────────────────────────────────
def drift_phonk(track):
    """카우벨 멜로디와 눌린 808 — 숏폼에서 가장 크게 번진 장르."""
    bpm = 138
    bar = 60 / bpm * 4
    root = pitch('F#2')
    melody = [0, 0, 3, 0, 5, 3, 0, -2]
    hits = []
    for index in range(int(DURATION / bar) + 1):
        start = index * bar
        track.kick(start, .82, 128, 41, 7.5)
        track.kick(start + bar * .5, .7, 120, 41, 8)
        hits += [start, start + bar * .5]
        track.glide(start, root * 1.9, root, bar * .48, .3, 2.6, 2.2)
        track.glide(start + bar * .5, root * 1.9, root * (1.5 if index % 2 else 1.2),
                    bar * .45, .26, 2.8, 2.2)
        for step, degree in enumerate(melody):
            note = 540 * 2 ** ((degree + (0 if index % 2 else -2)) / 12)
            track.metal(start + step * bar / 8, note, .5,
                        .085 if step % 2 == 0 else .055, pan=-.35 + .1 * step)
        for step in range(8):
            track.noise(start + step * bar / 8 + bar / 16, .06, .02, 95, 2,
                        .38 if step % 2 else -.38, seed=index * 24 + step)
        track.noise(start + bar * .75, .5, .02, 14, -2, 0., seed=index + 700)
    track.pump(hits, .5, .22)
    track.reverb(.3, 1.0)


def amapiano(track):
    """로그드럼 베이스와 셰이커, 그 위의 재즈 피아노."""
    bpm = 112
    bar = 60 / bpm * 4
    progression = [('A', 'min7'), ('D', 'min7'), ('G', 'dom7'), ('C', 'maj7')]
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        low = chord(root, quality, 2)[0]
        start = index * bar
        track.kick(start, .5, 100, 44, 10)
        track.kick(start + bar * .5, .44, 100, 44, 10)
        for offset, level in ((.375, .30), (.5, .26), (.625, .22), (.875, .28)):  # 로그드럼
            track.glide(start + bar * offset, low * 2.4, low, .34, level, 6.5, 2.0,
                        pan=-.2 + .4 * offset)
        for step in range(16):
            track.noise(start + step * bar / 16, .07, .019 if step % 4 else .03, 48, 1,
                        .34 if step % 2 else -.34, seed=index * 32 + step)
        track.clap(start + bar / 2, .3, .1, seed=index * 9)
        for step, degree in enumerate([0, 2, 3, 1]):
            track.tone(start + step * bar / 4 + (.05 if step % 2 else 0),
                       notes[degree % len(notes)], 1.9, .058, RHODES, 2.4, attack=.02,
                       pan=-.25 + .17 * step)
        for voice in chord(root, quality, 3)[:3]:
            track.pad(start, voice, bar, .022)
    track.reverb(.34, 1.05)


def jersey_club(track):
    """다섯 번 튀는 특유의 킥 패턴 — 릴스 편집에서 가장 많이 쓰는 리듬."""
    bpm = 140
    bar = 60 / bpm * 4
    progression = [('E', 'min'), ('C', 'maj7'), ('G', 'maj'), ('D', 'sus4')]
    pattern = [0, 3, 6, 10, 12]  # 16분 격자 위의 저지 클럽 킥
    hits = []
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 5)
        start = index * bar
        for step in pattern:
            track.kick(start + step * bar / 16, .62, 118, 46, 13)
            hits.append(start + step * bar / 16)
        track.clap(start + bar / 2, .38, 0., seed=index * 11)
        track.clap(start + bar * .875, .3, .2, seed=index * 11 + 5)
        track.glide(start, chord(root, quality, 2)[0] * 1.8, chord(root, quality, 2)[0],
                    bar * .45, .24, 3.4, 1.8)
        for step, degree in enumerate([0, 2, 1, 2, 0, 1]):
            track.tone(start + step * bar / 6, notes[degree % len(notes)], .55,
                       .06 if step % 2 == 0 else .04, PLUCK, 9.0, pan=-.36 + .14 * step)
        for step in range(8):
            track.noise(start + step * bar / 8 + bar / 16, .06, .017, 78, 2,
                        .36 if step % 2 else -.36, seed=index * 40 + step)
        for voice in chord(root, quality, 3)[:3]:
            track.pad(start, voice, bar, .022)
    track.pump(hits, .38, .14)
    track.reverb(.26, .85)


def hyper_plugg(track):
    """디튠된 밝은 플럭과 종소리 — 하이퍼팝·플럭 계열."""
    bpm = 134
    bar = 60 / bpm * 4
    progression = [('D', 'min7'), ('B', 'maj7'), ('F', 'maj7'), ('C', 'maj')]
    hits = []
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 5)
        start = index * bar
        track.kick(start, .6, 116, 42, 9)
        track.kick(start + bar * .625, .5, 116, 42, 9)
        hits += [start, start + bar * .625]
        track.glide(start, chord(root, quality, 2)[0] * 1.7, chord(root, quality, 2)[0],
                    bar * .55, .26, 3.0, 2.0)
        for step, degree in enumerate([0, 1, 2, 1, 3, 2, 1, 0]):
            note = notes[degree % len(notes)]
            for detune, pan in ((.997, -.34), (1.003, .34)):  # 살짝 어긋난 두 겹
                track.saw(start + step * bar / 8, note * detune, .46,
                          .028 if step % 2 else .04, 10.5, pan=pan)
        for step in (1, 5):
            track.tone(start + step * bar / 8, notes[2 % len(notes)] * 2, 1.6, .04, BELL, 2.4, pan=.2)
        for step in range(16):
            if step % 4 != 0:
                track.noise(start + step * bar / 16, .05, .014, 100, 2,
                            .3 if step % 2 else -.3, seed=index * 48 + step)
        for voice in chord(root, quality, 4)[:3]:
            track.pad(start, voice, bar, .02, attack=.5)
    track.pump(hits, .4, .18)
    track.reverb(.34, 1.0)


def dream_bedroom(track):
    """리버브에 잠긴 기타 톤과 느슨한 비트 — 베드룸팝·슈게이즈."""
    bpm = 94
    bar = 60 / bpm * 4
    progression = [('B', 'maj7'), ('F', 'maj7'), ('G', 'min7'), ('E', 'maj7')]
    for index in range(int(DURATION / bar) + 1):
        root, quality = progression[index % 4]
        notes = chord(root, quality, 4)
        start = index * bar
        track.kick(start, .42, 92, 40, 11)
        track.kick(start + bar * .625, .34, 92, 40, 11)
        track.noise(start + bar / 2, .34, .034, 20, -1, 0., seed=index * 13)
        track.tone(start, chord(root, quality, 2)[0], bar * .85, .16, BASS, 1.0)
        for step, degree in enumerate([0, 2, 1, 3, 2, 0]):
            track.tone(start + step * bar / 6, notes[degree % len(notes)], 2.4,
                       .062 if step % 3 == 0 else .042, GUITAR, 2.6,
                       pan=-.38 + .15 * step, vibrato=.004)
        for voice in chord(root, quality, 3):
            track.pad(start, voice, bar, .04, attack=1.5, release=1.8)
        for voice in chord(root, quality, 5)[:2]:
            track.pad(start, voice, bar, .018, attack=2.0, release=2.0, pan=.4)
    track.reverb(.66, 1.7)


# 유튜브 배경음악으로 실제로 많이 쓰이는 장르 순서. 목록에 보이는 차례가 이 순서다.
SCORES = [
    # 서비스 소개 영상에서 흔히 쓰는 톤
    ('corporate-uplift', '코퍼레이트 업라이트', '밝은 플럭과 피아노 — 회사 소개의 표준', 'service', corporate_uplift),
    ('clean-tech', '클린 테크 인트로', '미니멀 아르페지오 — 제품 투어·SaaS 데모', 'service', clean_tech),
    ('infographic-pizz', '인포그래픽 피치카토', '스타카토 현과 손뼉 — 설명 영상의 기본값', 'service', infographic_pizz),
    ('brand-story', '브랜드 스토리 피아노', '피아노로 시작해 스트링이 차오름 — 창업 이야기', 'service', brand_story),
    ('launch-day', '런치 데이 팝', '손뼉과 코드 스탭 — 런칭·발표 영상', 'service', launch_day),
    # 유튜브 배경음악으로 많이 쓰이는 장르
    ('lofi-study', '로파이 스터디', '스윙 비트와 노이즈 — 브이로그·공부 영상', 'classic', lofi_study),
    ('calm-piano', '잔잔한 피아노', '조용한 피아노와 스트링 — 내레이션을 가장 적게 가린다', 'classic', calm_piano),
    ('soft-ambient', '소프트 앰비언트', '리듬 없는 패드 — 브랜드·제품 영상', 'classic', soft_ambient),
    ('bright-pop', '밝은 신스팝', '가벼운 4비트와 플럭 리드 — 광고·프로모션', 'classic', bright_pop),
    ('warm-acoustic', '따뜻한 어쿠스틱', '핑거피킹 기타 — 사람 이야기에 가까운 톤', 'classic', warm_acoustic),
    ('hopeful-build', '희망의 빌드업', '영상 전개에 맞춰 악기가 늘어남', 'classic', hopeful_build),
    ('cinematic-rise', '시네마틱 상승', '드론과 스트링 스웰 — 트레일러·리빌', 'classic', cinematic_rise),
    ('playful-marimba', '경쾌한 마림바', '가볍고 빠른 마림바 — 설명 영상', 'classic', playful_marimba),
    ('minimal-tech', '미니멀 테크', '깔끔한 16비트 펄스 — B2B·제품 데모', 'classic', minimal_tech),
    ('night-chill', '나이트 칠', '낮은 베이스와 로즈 — 차분한 버전', 'classic', night_chill),
    # 지금 숏폼에서 유행하는 장르
    ('drift-phonk', '드리프트 펑크', '카우벨과 눌린 808 — 숏폼에서 가장 크게 번진 장르', 'trend', drift_phonk),
    ('amapiano', '아마피아노', '로그드럼과 셰이커 — 가장 빠르게 퍼지는 장르', 'trend', amapiano),
    ('jersey-club', '저지 클럽', '다섯 번 튀는 킥 — 릴스 편집의 리듬', 'trend', jersey_club),
    ('hyper-plugg', '하이퍼팝 플럭', '디튠된 밝은 플럭과 종소리', 'trend', hyper_plugg),
    ('dream-bedroom', '드림 베드룸팝', '리버브에 잠긴 기타 — 감성 편집', 'trend', dream_bedroom),
]
GROUPS = [('service', '서비스 소개 영상'), ('classic', '많이 쓰는 장르'), ('trend', '요즘 유행')]
# 목록 순서와 별개로 기본값은 따로 고른다.
DEFAULT = 'playful-marimba'


def write_mp3(samples, destination):
    with tempfile.TemporaryDirectory(prefix='fitpoly-bgm-') as tmp:
        raw = Path(tmp) / 'score.wav'
        with wave.open(str(raw), 'wb') as handle:
            handle.setnchannels(2)
            handle.setsampwidth(2)
            handle.setframerate(RATE)
            handle.writeframes((samples * 32767).astype('<i2').tobytes())
        encode_mp3(raw, destination)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for identifier, title, note, group, compose in SCORES:
        track = Track()
        compose(track)
        destination = OUT / f'{identifier}.mp3'
        write_mp3(track.finish(), destination)
        level, peak = loudness(destination)
        manifest.append({'id': identifier, 'title': title, 'note': note, 'group': group,
                         'file': f'/motion/bgm/{identifier}.mp3'})
        print(f'✔ {identifier}.mp3  {level:6.1f} LUFS  peak {peak:5.1f} dB  — {title}')
    (OUT / 'bgm.json').write_text(
        json.dumps({'duration': DURATION, 'default': DEFAULT,
                    'groups': [{'id': i, 'label': l} for i, l in GROUPS], 'tracks': manifest},
                   ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'\n{len(manifest)}곡 · 모두 {TARGET_LUFS:.0f} LUFS 로 맞춤\n→ {OUT}')


if __name__ == '__main__':
    main()
