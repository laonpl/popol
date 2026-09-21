/**
 * Export /video with its deterministic animation clock and an original synth score.
 * Start the frontend, then: node scripts/render-site-intro.mjs
 * Music only: node scripts/render-site-intro.mjs --audio-only
 * No reference footage or third-party audio is included in the output.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import ffmpeg from 'ffmpeg-static';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'frontend/public/video');
const scratch = await mkdtemp(path.join(tmpdir(), 'fitpoly-intro-render-'));
const options = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const duration = 60;
const fps = 30;

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}`)));
  });
}

// Deterministic PCM synthesis: soft marimba, warm chords and a light electronic beat.
// This score is generated here, not sampled from the reference video.
function soundtrack() {
  const rate = 44100;
  const frames = rate * duration;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const beat = 60 / 112;
  let seed = 8713;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return seed / 2147483648; };
  const tone = (time, note, length, volume, kind = 'pluck', pan = 0) => {
    const hz = 440 * 2 ** ((note - 69) / 12);
    const start = Math.round(time * rate);
    const size = Math.min(Math.ceil(length * rate), frames - start);
    for (let i = 0; i < size; i++) {
      const t = i / rate;
      const attack = Math.min(1, t / (kind === 'pad' ? .14 : .009));
      const release = Math.min(1, (length - t) / .1);
      const envelope = attack * release * (kind === 'pad' ? .7 : Math.exp(-t * 6));
      const signal = Math.sin(2 * Math.PI * hz * t) + .24 * Math.sin(2 * Math.PI * hz * 2 * t) * Math.exp(-t * 10);
      const value = signal * envelope * volume;
      left[start + i] += value * (1 - pan * .4);
      right[start + i] += value * (1 + pan * .4);
    }
  };
  const drum = (time, kind, volume) => {
    const start = Math.round(time * rate);
    const length = kind === 'kick' ? .23 : kind === 'snare' ? .13 : .045;
    let previous = 0;
    for (let i = 0; i < Math.min(length * rate, frames - start); i++) {
      const t = i / rate;
      const n = noise();
      const high = n - previous;
      previous = n;
      const signal = kind === 'kick' ? Math.sin(2 * Math.PI * (49 * t + 3 * (1 - Math.exp(-t * 22)))) * Math.exp(-t * 22)
        : high * Math.exp(-t * (kind === 'snare' ? 38 : 110));
      const value = signal * volume * Math.min(1, t / .002);
      left[start + i] += value;
      right[start + i] += value;
    }
  };
  const chords = [[50, 57, 62, 66], [45, 52, 57, 61], [47, 54, 59, 62], [43, 50, 55, 59]];
  for (let bar = 0; bar * beat * 4 < 56; bar++) {
    const start = bar * beat * 4;
    const chord = chords[bar % chords.length];
    chord.forEach((note, i) => tone(start, note, beat * 3.95, .032, 'pad', (i - 1.5) / 2));
    for (let step = 0; step < 8; step++) {
      const time = start + step * beat / 2;
      if (time > 56) break;
      const note = chord[[2, 3, 1, 3, 2, 1, 3, 2][step]] + 12;
      if (step !== 3 && step !== 7) {
        tone(time, note, .65, .075, 'pluck', step % 2 ? .4 : -.4);
        tone(time + beat * .75, note, .5, .015, 'pluck', step % 2 ? -.6 : .6);
      }
      if (time > 4 && time < 53) {
        drum(time, 'hat', step % 2 ? .019 : .012);
        if (step === 0 || step === 4) { drum(time, 'kick', .19); tone(time, chord[0] - 12, .35, .07); }
        if (step === 2 || step === 6) drum(time, 'snare', .027);
      }
    }
  }
  [62, 66, 69, 74].forEach((note, i) => tone(56 + i * .12, note, 3.7 - i * .12, .075, 'pad', (i - 1.5) / 2));
  const wav = Buffer.alloc(44 + frames * 4);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28); wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    const fade = Math.min(1, i / rate / .7, (duration - i / rate) / 1.6);
    wav.writeInt16LE(Math.round(Math.tanh(left[i] * 1.5) * fade * 28000), 44 + i * 4);
    wav.writeInt16LE(Math.round(Math.tanh(right[i] * 1.5) * fade * 28000), 46 + i * 4);
  }
  return wav;
}

await mkdir(output, { recursive: true });
const wavPath = path.join(scratch, 'score.wav');
await writeFile(wavPath, soundtrack());
await run(['-i', wavPath, '-c:a', 'libmp3lame', '-b:a', '192k', path.join(scratch, 'score.mp3')]);
await copyFile(path.join(scratch, 'score.mp3'), path.join(output, 'fitpoly-intro-music.mp3'));
console.log('Original 60-second soundtrack ready.');

if (!('audio-only' in options)) {
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 180000, args: ['--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text'] });
  let encoder;
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    const url = new URL(options.url || 'http://localhost:3000/video');
    url.searchParams.set('capture', '1');
    await page.goto(url.href, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    if (await page.evaluate(() => window.__engReelDurationMs) !== duration * 1000) throw new Error('Unexpected intro duration.');
    // Visit every chapter to preload its actual assets before rendering frame zero.
    const timeline = await page.evaluate(() => window.__introTimeline);
    for (const scene of timeline) {
      await page.evaluate(t => window.__engSeek(t), scene.start + 1500);
      await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
      await page.evaluate(() => document.fonts.ready);
    }
    const target = path.join(scratch, 'fitpoly-intro.mp4');
    encoder = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0', '-i', wavPath,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-t', String(duration), '-movflags', '+faststart', target], { stdio: ['pipe', 'inherit', 'inherit'], windowsHide: true });
    const completed = once(encoder, 'close');
    let encoderError;
    encoder.on('error', error => { encoderError = error; });
    encoder.stdin.on('error', error => { encoderError = error; });
    for (let frame = 0; frame < duration * fps; frame++) {
      if (encoderError) throw encoderError;
      if (errors.length) throw new Error(errors.join('\n'));
      await page.evaluate(time => window.__engSeek(time), frame * 1000 / fps);
      const image = await page.screenshot({ type: 'jpeg', quality: 96, captureBeyondViewport: false });
      if (!encoder.stdin.write(image)) await once(encoder.stdin, 'drain');
      if (frame % (fps * 5) === 0) console.log(`Rendering ${frame / fps}s / ${duration}s`);
    }
    encoder.stdin.end();
    const [code] = await completed;
    if (code !== 0) throw new Error(`Encoder failed: ${code}`);
    await copyFile(target, path.join(output, 'fitpoly-intro.mp4'));
    console.log(`Ready: ${path.join(output, 'fitpoly-intro.mp4')} (1920×1080, 30fps, stereo)`);
  } finally {
    if (encoder && encoder.exitCode === null) encoder.kill();
    await browser.close();
  }
}
console.log(`Render intermediates: ${scratch}`);
