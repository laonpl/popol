import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Download, Maximize, Mic, MicOff, Music, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import './MotionFilm.css';
import FilmArt from './MotionFilmArt';
import pageTiles from '../../public/motion/page-tiles.json';
import filmScript from '../../public/motion/film-script.json';
import bgmCatalogue from '../../public/motion/bgm/bgm.json';
import narrationCatalogue from '../../public/motion/narration/narration.json';
import downloadCatalogue from '../../public/motion/downloads/downloads.json';

const DURATION = filmScript.duration;
const CHAPTERS = filmScript.chapters;
const NAV = [0, 2, 3, 4, 5];
const NAV_END = [7, 13, 23, 33, DURATION];
const BGM_VOLUME = 0.62;
const BGM_DUCKED = 0.3; // the score steps back while the voice is reading
const chapterAt = (t) => CHAPTERS.findLastIndex((s) => t >= s.at);
const stamp = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)}MB`;
// 받침이 있으면 '이', 없으면 '가' — 곡 제목이 바뀌어도 문장이 어색해지지 않게
const subject = (word) => {
  const last = word.charCodeAt(word.length - 1) - 0xac00;
  return last >= 0 && last <= 11171 && last % 28 === 0 ? '가' : '이';
};

export default function MotionFilm() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const renderMode = params.get('render') === '1';
  const initialTime = Math.max(0, Math.min(DURATION, Number(params.get('t')) || 0));
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(() => params.get('capture') !== '1' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [sound, setSound] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [voiceId, setVoiceId] = useState(narrationCatalogue.default);
  const [bgmId, setBgmId] = useState(bgmCatalogue.default);
  const [captions, setCaptions] = useState(params.get('cc') !== '0');
  const [panel, setPanel] = useState('');
  const [want, setWant] = useState({ captions: true, narration: true });
  const [notice, setNotice] = useState('');
  const frame = useRef(null);
  const position = useRef(initialTime);
  const stage = useRef(null);
  const score = useRef(null);
  const voice = useRef(null);
  const chapter = Math.max(0, chapterAt(time));
  const bgm = bgmCatalogue.tracks.find(t => t.id === bgmId) || bgmCatalogue.tracks[0];
  const reader = narrationCatalogue.voices.find(v => v.id === voiceId) || narrationCatalogue.voices[0];
  const bgmGroups = useMemo(() => {
    const known = bgmCatalogue.groups || [];
    const shelves = known.map(g => ({ ...g, tracks: bgmCatalogue.tracks.filter(t => t.group === g.id) }));
    const rest = bgmCatalogue.tracks.filter(t => !known.some(g => g.id === t.group));
    if (rest.length) shelves.push({ id: 'rest', label: '가져온 음원', tracks: rest });
    return shelves.filter(shelf => shelf.tracks.length);
  }, []);
  const pick = useMemo(() => downloadCatalogue.variants.find(
    v => v.captions === want.captions && v.narration === want.narration
      && v.bgm === downloadCatalogue.defaultBgm), [want]);
  useEffect(() => {
    let active = true;
    // Every bitmap the film draws, so no shot can be captured before its art has loaded.
    const files = ['/motion/graduate-typing.png', '/motion/graduate-typing-clean.png', '/motion/graduate-wide.png', '/motion/graduate-relieved.png',
      '/motion/actual-chat-select.png', '/motion/actual-chat-materials.png', '/motion/actual-chat-materials-ready.png', '/motion/actual-chat-loading.png',
      '/motion/actual-resume.png', '/motion/crop-metrics-hd.png', '/motion/crop-strengths-hd.png', '/motion/crop-results-hd.png',
      '/motion/crop-resume-entry-hd.png', '/motion/crop-portfolio-card-hd.png', '/logo.png',
      ...Object.values(pageTiles).flatMap(page => page.tiles)];
    const images = files.map(src => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = reject;
      img.src = src;
    }));
    const fonts = Promise.all([400, 500, 600, 700, 750].map(weight => document.fonts.load(`${weight} 24px "Motion Pretendard"`, '흩어진 기록이 나의 기회로')));
    Promise.all([...images, fonts]).then(() => { if (active) setReady(true); }).catch(() => {
      if (active) { setPlaying(false); setNotice('장면 이미지를 불러오지 못했습니다. 페이지를 새로고침해주세요.'); }
    });
    return () => { active = false; };
  }, []);
  const seek = useCallback((value) => {
    const next = Math.max(0, Math.min(DURATION, value));
    position.current = next;
    setTime(next);
    for (const track of [score.current, voice.current]) if (track) track.currentTime = next;
  }, []);
  const toggle = useCallback(() => {
    if (position.current >= DURATION) seek(0);
    setPlaying(p => !p);
  }, [seek]);

  useEffect(() => {
    const title = document.title;
    document.title = '흩어진 기록이, 나의 기회로 | FitPoly Motion';
    return () => { document.title = title; };
  }, []);

  // The film's clock is the rAF loop, so both tracks follow it rather than lead it.
  useEffect(() => {
    for (const [track, wanted, volume] of [[score.current, sound, narrating ? BGM_DUCKED : BGM_VOLUME],
      [voice.current, narrating, 1]]) {
      if (!track) continue;
      track.volume = volume;
      if (!wanted || !playing || renderMode) { track.pause(); continue; }
      if (Math.abs(track.currentTime - position.current) > 0.3) track.currentTime = position.current;
      track.play().catch(() => setNotice('브라우저가 오디오 재생을 막았습니다. 버튼을 한 번 더 눌러주세요.'));
    }
  }, [playing, sound, narrating, bgmId, renderMode]);

  useEffect(() => {
    if (!playing || !ready) return undefined;
    let last = performance.now();
    const resetClock = () => { last = performance.now(); };
    document.addEventListener('visibilitychange', resetClock);
    const tick = (now) => {
      const elapsed = document.hidden ? 0 : (now - last) / 1000;
      last = now;
      position.current = Math.min(DURATION, position.current + elapsed);
      setTime(position.current);
      for (const track of [score.current, voice.current]) {
        // Decoded audio drifts from the animation clock; nudge it back when it does.
        if (track && !track.paused && Math.abs(track.currentTime - position.current) > 0.3) track.currentTime = position.current;
      }
      if (position.current >= DURATION) setPlaying(false);
      else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame.current); document.removeEventListener('visibilitychange', resetClock); };
  }, [playing, ready]);

  useEffect(() => {
    if (!panel) return undefined;
    const dismiss = (event) => { if (!event.target.closest('.motion-menu')) setPanel(''); };
    const escape = (event) => { if (event.key === 'Escape') setPanel(''); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [panel]);

  useEffect(() => {
    const keydown = (event) => {
      if (event.target.closest('button, a, input, textarea, select')) return;
      if (event.code === 'Space') { event.preventDefault(); toggle(); }
      if (event.code === 'ArrowRight') { event.preventDefault(); seek(position.current + 5); }
      if (event.code === 'ArrowLeft') { event.preventDefault(); seek(position.current - 5); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [seek, toggle]);

  // Started straight from the click, so the browser counts it as a user gesture.
  const start = (track, on) => {
    if (!track) return;
    if (!on) { track.pause(); return; }
    track.currentTime = position.current;
    if (playing) track.play().catch(() => setNotice('브라우저가 오디오 재생을 막았습니다. 버튼을 한 번 더 눌러주세요.'));
  };
  const toggleSound = () => { setSound(!sound); start(score.current, !sound); };
  const toggleNarration = () => { setNarrating(!narrating); start(voice.current, !narrating); };
  const chooseBgm = (id) => {
    setBgmId(id);
    setPanel('');
    if (!sound) { setSound(true); start(score.current, true); }
  };
  const chooseVoice = (id) => {
    setVoiceId(id);
    setPanel('');
    if (!narrating) { setNarrating(true); start(voice.current, true); }
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.current.requestFullscreen) await stage.current.requestFullscreen();
      else setNotice('이 브라우저에서는 전체화면을 지원하지 않습니다.');
    } catch { setNotice('전체화면을 열 수 없습니다.'); }
  };

  return <main className={`motion-page motion-3d ${renderMode ? 'motion-render' : ''}`}>
    <header className="motion-header"><Link to="/" className="motion-wordmark"><span className="motion-logo-grid"><i /><i /><i /><i /></span>FitPoly<span className="motion-header-divider" /><span className="motion-film-label">브랜드 필름</span></Link><Link to="/" className="motion-back"><ArrowLeft size={15} /> 사이트로 돌아가기</Link></header>
    <div className="motion-heading"><div><p className="motion-eyebrow"><span /> THE FITPOLY FILM · 52 SECONDS</p><h1>흩어진 기록이, <span>나의 기회로.</span></h1></div><p className="motion-heading-note">당신이 쌓아온 모든 순간에<br />다음 이야기가 있으니까.</p></div>
    <section className="motion-player" ref={stage} aria-label="FitPoly 1분 홍보영상">
      <div className="motion-picture" data-time={time.toFixed(3)} data-ready={ready}><FilmArt time={time} />
        {!ready && <div className="motion-loading" role="status">당신의 이야기를 준비하고 있어요…</div>}
        {captions && <p className="motion-caption">{CHAPTERS[chapter].caption}</p>}
        {!renderMode && time >= DURATION && <div className="motion-end"><button onClick={() => { seek(0); setPlaying(true); }}><RotateCcw size={17} /> 다시 보기</button><Link to="/app/experience">내 경험 정리하기 <ArrowUpRight size={17} /></Link></div>}
      </div>
      <div className="motion-controls">
        <input className="motion-seek" type="range" min="0" max={DURATION} step="0.001" value={time} onChange={e => seek(Number(e.target.value))} aria-label="영상 재생 위치" aria-valuetext={`${stamp(time)} / ${stamp(DURATION)}`} style={{ '--progress': `${time / DURATION * 100}%` }} />
        <div className="motion-control-row"><div className="motion-control-group"><button onClick={toggle} aria-label={playing ? '일시정지' : '재생'}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button onClick={() => { seek(0); setPlaying(true); }} aria-label="처음부터 재생"><RotateCcw size={17} /></button><span className="motion-time">{stamp(time)}<span> / {stamp(DURATION)}</span></span><span className="motion-now">{CHAPTERS[chapter].label}</span></div>
          <div className="motion-control-group">
            <button className="motion-sound" onClick={toggleSound} aria-label={sound ? 'BGM 끄기' : 'BGM 켜기'} aria-pressed={sound}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}<span>{sound ? bgm.title : 'BGM 켜기'}</span></button>
            <div className="motion-menu">
              <button className={panel === 'bgm' ? 'active' : ''} onClick={() => setPanel(p => p === 'bgm' ? '' : 'bgm')} aria-label="배경음악 고르기" aria-expanded={panel === 'bgm'}><Music size={17} /></button>
              {panel === 'bgm' && <div className="motion-pop motion-pop-bgm" role="dialog" aria-label="배경음악">
                <p className="motion-pop-head">배경음악 {bgmCatalogue.tracks.length}곡</p>
                <div>{bgmGroups.map(shelf => <ul key={shelf.id}>
                  <li className="motion-pop-shelf">{shelf.label}</li>
                  {shelf.tracks.map(track => <li key={track.id}><button className={track.id === bgmId ? 'on' : ''} onClick={() => chooseBgm(track.id)} aria-pressed={track.id === bgmId}><span className="motion-pop-mark">{track.id === bgmId && <Check size={13} />}</span><span><b>{track.title}</b><em>{track.note}</em>{track.credit && <em className="motion-pop-credit">{track.credit}</em>}</span></button></li>)}
                </ul>)}</div>
              </div>}
            </div>
            <div className="motion-menu">
              <button className={`motion-voice ${narrating ? 'active' : ''}`} onClick={() => setPanel(p => p === 'voice' ? '' : 'voice')} aria-label="AI 내레이션" aria-expanded={panel === 'voice'}>{narrating ? <Mic size={17} /> : <MicOff size={17} />}<span>{narrating ? reader.title : '내레이션'}</span></button>
              {panel === 'voice' && <div className="motion-pop motion-pop-bgm" role="dialog" aria-label="AI 내레이션">
                <p className="motion-pop-head">AI 내레이션</p>
                <div>
                  <ul>
                    <li><button className={!narrating ? 'on' : ''} onClick={() => { if (narrating) toggleNarration(); setPanel(''); }} aria-pressed={!narrating}><span className="motion-pop-mark">{!narrating && <Check size={13} />}</span><span><b>끄기</b><em>자막만 보기</em></span></button></li>
                  </ul>
                  <ul>
                    <li className="motion-pop-shelf">목소리 {narrationCatalogue.voices.length}종</li>
                    {narrationCatalogue.voices.map(person => <li key={person.id}><button className={narrating && person.id === voiceId ? 'on' : ''} onClick={() => chooseVoice(person.id)} aria-pressed={narrating && person.id === voiceId}><span className="motion-pop-mark">{narrating && person.id === voiceId && <Check size={13} />}</span><span><b>{person.title}</b><em>{person.note}</em></span></button></li>)}
                  </ul>
                </div>
              </div>}
            </div>
            <button className={`motion-cc ${captions ? 'active' : ''}`} onClick={() => setCaptions(p => !p)} aria-label="자막" aria-pressed={captions}>CC</button>
            <div className="motion-menu">
              <button className={`motion-download ${panel === 'save' ? 'active' : ''}`} onClick={() => setPanel(p => p === 'save' ? '' : 'save')} aria-label="영상 내려받기" aria-expanded={panel === 'save'}><Download size={17} /><span>다운로드</span></button>
              {panel === 'save' && <div className="motion-pop motion-pop-save" role="dialog" aria-label="영상 내려받기">
                <p className="motion-pop-head">내려받을 영상 고르기</p>
                <div className="motion-pop-row"><span>자막</span><div className="motion-pop-seg">{[true, false].map(on => <button key={String(on)} className={want.captions === on ? 'on' : ''} onClick={() => setWant(w => ({ ...w, captions: on }))} aria-pressed={want.captions === on}>{on ? '넣기' : '빼기'}</button>)}</div></div>
                <div className="motion-pop-row"><span>AI 내레이션</span><div className="motion-pop-seg">{[true, false].map(on => <button key={String(on)} className={want.narration === on ? 'on' : ''} onClick={() => setWant(w => ({ ...w, narration: on }))} aria-pressed={want.narration === on}>{on ? '넣기' : '빼기'}</button>)}</div></div>
                {(() => { const baked = bgmCatalogue.tracks.find(t => t.id === downloadCatalogue.defaultBgm)?.title || ''; return <p className="motion-pop-note">배경음악 <b>{baked}</b>{subject(baked)} 들어가고, 내레이션은 <b>{downloadCatalogue.voice.split(' · ')[0]}</b> 목소리입니다. 다른 조합이 필요하면 <code>bake-film-variants.py --bgm … --voice …</code> 으로 구우세요.</p>; })()}
                {pick
                  ? <a className="motion-pop-go" href={pick.file} download={`fitpoly-brand-film${want.captions ? '-자막' : ''}${want.narration ? '-내레이션' : ''}.mp4`} onClick={() => setPanel('')}><Download size={15} /> 4K 내려받기 <em>{megabytes(pick.size)}</em></a>
                  : <p className="motion-pop-missing">이 조합은 아직 굽지 않았습니다.<code>python scripts/render-motion.py --captions {want.captions ? 'on' : 'off'}</code><code>python scripts/bake-film-variants.py</code></p>}
              </div>}
            </div>
            <button onClick={fullscreen} aria-label="전체화면"><Maximize size={17} /></button>
          </div>
        </div>
      </div>
      <audio ref={score} src={bgm.file} preload={renderMode ? 'none' : 'auto'} onLoadedMetadata={() => { if (sound) start(score.current, true); }} />
      <audio ref={voice} src={reader.file} preload={renderMode ? 'none' : 'auto'} onLoadedMetadata={() => { if (narrating) start(voice.current, true); }} />
    </section>
    <nav className="motion-chapters" aria-label="영상 챕터">{NAV.map((index, i) => { const item = CHAPTERS[index]; return <button key={item.at} onClick={() => seek(item.at)} className={time >= item.at && time < NAV_END[i] ? 'active' : ''}><span>{stamp(item.at)}</span>{item.label}</button>; })}</nav>
    <footer className="motion-footer"><p>기록은 이미 있어요. 이제, 가능성을 꺼낼 차례.</p><Link to="/app/experience">내 경험 정리하기 <ArrowUpRight size={17} /></Link></footer>
    {notice && <p className="motion-notice" role="status">{notice}<button aria-label="알림 닫기" onClick={() => setNotice('')}>×</button></p>}
  </main>;
}
