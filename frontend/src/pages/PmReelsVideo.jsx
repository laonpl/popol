import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  FileText,
  Gauge,
  Lightbulb,
  MousePointer2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import './PmReelsVideo.css';

const DURATION = 31.5;
const SCENES = [0, 3.7, 8, 12.1, 16.2, 21.7, 26.6];

const sceneAt = (time) => {
  for (let index = SCENES.length - 1; index >= 0; index -= 1) {
    if (time >= SCENES[index]) return index;
  }
  return 0;
};

function BrandLockup({ light = false }) {
  return (
    <div className={`pm-video-brand ${light ? 'is-light' : ''}`}>
      <span className="pm-video-brand-mark"><span /></span>
      <span>FitPoly</span>
    </div>
  );
}

function Scene({ active, index, children, className = '' }) {
  if (!active) return null;
  return (
    <section className={`pm-video-scene pm-video-scene-${index} ${className}`} aria-live="polite">
      {children}
    </section>
  );
}

function ChaosFile({ type, children, className = '', delay = '0s' }) {
  return (
    <div className={`pm-chaos-file ${className}`} style={{ '--delay': delay }}>
      <span className={`pm-file-type is-${type.toLowerCase()}`}>{type}</span>
      <span>{children}</span>
    </div>
  );
}

function ProcessStep({ icon: Icon, title, copy, delay }) {
  return (
    <div className="pm-process-step" style={{ '--delay': delay }}>
      <div className="pm-process-icon"><Icon size={19} strokeWidth={2.5} /></div>
      <div>
        <strong>{title}</strong>
        <span>{copy}</span>
      </div>
      <Check className="pm-process-check" size={18} strokeWidth={3} />
    </div>
  );
}

export default function PmReelsVideo() {
  const renderMode = useRef(new URLSearchParams(window.location.search).get('render') === '1').current;
  const initialTime = useRef(Math.min(
    Math.max(Number(new URLSearchParams(window.location.search).get('t')) || 0, 0),
    DURATION - 0.1,
  )).current;
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const startedAt = useRef(performance.now() - initialTime * 1000);
  const timeRef = useRef(initialTime);
  const frameRef = useRef(null);
  const audioRef = useRef(null);
  const lastSceneRef = useRef(sceneAt(initialTime));
  const currentScene = sceneAt(time);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = '기획·PM 경험정리 | FitPoly Reels';
    document.documentElement.classList.add('pm-video-html');
    document.body.classList.add('pm-video-body');
    return () => {
      document.title = previousTitle;
      document.documentElement.classList.remove('pm-video-html');
      document.body.classList.remove('pm-video-body');
    };
  }, []);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  const playSound = useCallback((scene) => {
    if (!soundOn) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioRef.current) audioRef.current = new AudioContext();
    const context = audioRef.current;
    if (context.state === 'suspended') context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = scene === 3 || scene === 6 ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime([260, 150, 110, 440, 520, 620, 740][scene] || 440, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(scene < 3 ? 90 : 900, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  }, [soundOn]);

  useEffect(() => {
    if (!playing) return undefined;
    startedAt.current = performance.now() - timeRef.current * 1000;
    const tick = (now) => {
      let next = (now - startedAt.current) / 1000;
      if (next >= DURATION) {
        next %= DURATION;
        startedAt.current = now - next * 1000;
        lastSceneRef.current = 0;
      }
      const nextScene = sceneAt(next);
      if (nextScene !== lastSceneRef.current) {
        lastSceneRef.current = nextScene;
        playSound(nextScene);
      }
      setTime(next);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing, playSound]);

  const restart = () => {
    setTime(0);
    timeRef.current = 0;
    lastSceneRef.current = 0;
    startedAt.current = performance.now();
    setPlaying(true);
    playSound(0);
  };

  const togglePlay = () => {
    if (!playing) startedAt.current = performance.now() - timeRef.current * 1000;
    setPlaying((value) => !value);
  };

  const toggleSound = () => {
    setSoundOn((value) => !value);
    if (!soundOn) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext && !audioRef.current) audioRef.current = new AudioContext();
    }
  };

  const jumpTo = (event) => {
    const next = (Number(event.target.value) / 1000) * DURATION;
    setTime(next);
    timeRef.current = next;
    lastSceneRef.current = sceneAt(next);
    startedAt.current = performance.now() - next * 1000;
  };

  return (
    <main className="pm-video-page">
      <div className={`pm-video-shell ${renderMode ? 'is-render-mode' : ''}`}>
        <div className="pm-video-stage" aria-label="FitPoly 기획·PM 직군 경험정리 마케팅 영상">
          <div className="pm-video-grain" />
          <div className="pm-video-safe-top">
            <BrandLockup light={currentScene === 1 || currentScene === 2 || currentScene === 6} />
            <span className={`pm-video-episode ${currentScene === 1 || currentScene === 2 || currentScene === 6 ? 'is-light' : ''}`}>PM SERIES · 01</span>
          </div>

          <Scene active={currentScene === 0} index={0}>
            <div className="pm-hook-label"><span>POV</span> 면접 3일 전</div>
            <h1>
              PM 경험은<br />
              <span className="pm-highlight-scribble">많은데</span>
            </h1>
            <div className="pm-hook-punchline">
              <span>정리된 건</span>
              <strong>0개</strong>
            </div>
            <div className="pm-hook-cursor"><MousePointer2 size={20} fill="currentColor" /> 생각 중...</div>
            <p className="pm-subtitle">프로젝트 폴더를 열어본 나</p>
          </Scene>

          <Scene active={currentScene === 1} index={1}>
            <div className="pm-chaos-bg-text">최종</div>
            <p className="pm-scene-kicker">그 시절의 나</p>
            <h2>일은 했는데<br /><em>기억이 안 남</em></h2>
            <div className="pm-chaos-files">
              <ChaosFile type="PDF" className="file-one" delay=".05s">PRD_v12_최종.pdf</ChaosFile>
              <ChaosFile type="DOC" className="file-two" delay=".16s">회의록_진짜최종(3)</ChaosFile>
              <ChaosFile type="PNG" className="file-three" delay=".28s">카톡 캡처 38장</ChaosFile>
              <ChaosFile type="FIG" className="file-four" delay=".4s">온보딩_최종_백업</ChaosFile>
            </div>
            <div className="pm-chaos-toast"><span>⚠</span> “그래서 본인 역할이 뭐였죠?”</div>
            <p className="pm-subtitle is-light">파일명부터 이미 위기</p>
          </Scene>

          <Scene active={currentScene === 2} index={2}>
            <div className="pm-interview-card">
              <span className="pm-interviewer-avatar">HR</span>
              <div>
                <small>면접관</small>
                <p>“가장 어려운 의사결정과<br />본인 기여도를 설명해 주세요.”</p>
              </div>
            </div>
            <div className="pm-buffering">
              <div className="pm-buffer-ring" />
              <span>경험 불러오는 중...</span>
              <strong>99%</strong>
            </div>
            <div className="pm-answer-bubble">
              <span>나</span>
              <p>“저... 그게...<br />일단 회의를 많이 했고요...”</p>
            </div>
            <div className="pm-meme-caption">내 머릿속 PM 데이터베이스</div>
            <p className="pm-subtitle is-light">경험은 자동 저장되지 않습니다</p>
          </Scene>

          <Scene active={currentScene === 3} index={3}>
            <div className="pm-rescue-orbit orbit-one" />
            <div className="pm-rescue-orbit orbit-two" />
            <div className="pm-rescue-logo"><span><Sparkles size={34} /></span></div>
            <p className="pm-scene-kicker is-blue">그래서 만들었습니다</p>
            <h2>기획자의 일을<br /><em>의사결정의 언어</em>로</h2>
            <div className="pm-rescue-lockup"><BrandLockup /><span>AI 경험정리</span></div>
            <div className="pm-rescue-pill">흩어진 자료 → 설명 가능한 경험</div>
            <p className="pm-subtitle">기획·PM 전용 구조로 정리</p>
          </Scene>

          <Scene active={currentScene === 4} index={4}>
            <p className="pm-scene-kicker is-blue">자료만 넣으면</p>
            <h2 className="pm-process-title">FitPoly가<br />PM의 맥락을 찾습니다</h2>
            <div className="pm-input-stack">
              <div className="pm-input-chip chip-one"><FileText size={15} /> PRD · 회고 · 회의록</div>
              <div className="pm-input-chip chip-two"><Search size={15} /> 문제와 근거 탐색 중</div>
            </div>
            <div className="pm-process-list">
              <ProcessStep icon={Target} title="문제 정의" copy="왜 시작했는지" delay=".12s" />
              <ProcessStep icon={Lightbulb} title="가설·판단" copy="무엇을 선택했는지" delay=".42s" />
              <ProcessStep icon={BarChart3} title="실행·검증" copy="어떻게 증명했는지" delay=".72s" />
            </div>
            <div className="pm-ai-scanner"><Zap size={14} fill="currentColor" /> AI가 사실과 추정을 구분해요</div>
            <p className="pm-subtitle">기능 나열 말고, 판단의 근거까지</p>
          </Scene>

          <Scene active={currentScene === 5} index={5}>
            <div className="pm-result-header">
              <div><span className="pm-live-dot" /> PM CASE STUDY</div>
              <small>자동 구조화 완료</small>
            </div>
            <h2>“온보딩 개선했어요”가</h2>
            <div className="pm-result-arrow"><ChevronRight size={20} /></div>
            <div className="pm-case-card">
              <div className="pm-case-topline">
                <span>01 · PRODUCT DECISION</span>
                <Gauge size={19} />
              </div>
              <h3>첫 행동까지의 마찰을<br />3단계로 줄인 온보딩 개선</h3>
              <div className="pm-case-grid">
                <div><small>문제 신호</small><strong>이탈률 42%</strong></div>
                <div><small>핵심 판단</small><strong>선택지 축소</strong></div>
              </div>
              <div className="pm-metric-card">
                <span>가입 완료율</span>
                <div className="pm-metric-change"><small>BEFORE</small><b>58%</b><ArrowRight size={17} /><small>AFTER</small><b>73%</b></div>
                <div className="pm-metric-bar"><span /></div>
                <strong>+15%p</strong>
              </div>
              <div className="pm-case-proof"><Check size={14} /> 가설 · 대안 · 기여도 · 검증 근거까지 한 번에</div>
            </div>
            <div className="pm-result-stamp">설명 가능한 경험</div>
            <p className="pm-subtitle">면접에서 바로 꺼내 쓰는 PM 스토리</p>
          </Scene>

          <Scene active={currentScene === 6} index={6}>
            <div className="pm-cta-glow" />
            <div className="pm-cta-mini">PM의 경험, 기억에 맡기지 마세요</div>
            <h2>열심히 한 일은<br /><em>설명할 수 있어야</em><br />경력이 되니까.</h2>
            <div className="pm-cta-logo"><BrandLockup light /></div>
            <a className="pm-cta-button" href="/app/experience">
              무료로 경험 정리하기 <ArrowRight size={19} strokeWidth={2.8} />
            </a>
            <p className="pm-cta-url">fitpoly.kr</p>
            <div className="pm-save-caption">저장해두고 면접 전에 꺼내보세요 ↗</div>
            <p className="pm-subtitle is-light">기획 · PM 경험정리, FitPoly</p>
          </Scene>

          <div className="pm-video-progress" aria-hidden="true">
            <span style={{ width: `${(time / DURATION) * 100}%` }} />
          </div>
        </div>

        <div className="pm-video-controls" aria-label="영상 컨트롤">
          <button type="button" onClick={togglePlay} aria-label={playing ? '일시정지' : '재생'}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button type="button" onClick={restart} aria-label="처음부터 다시 보기"><RefreshCw size={17} /></button>
          <input
            type="range"
            min="0"
            max="1000"
            value={Math.round((time / DURATION) * 1000)}
            onChange={jumpTo}
            aria-label="영상 재생 위치"
          />
          <span>{Math.floor(time).toString().padStart(2, '0')} / 31</span>
          <button type="button" onClick={toggleSound} aria-label={soundOn ? '음소거' : '사운드 켜기'}>
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
        <p className="pm-video-note">9:16 릴스 미리보기 · 자동 반복 재생</p>
      </div>
    </main>
  );
}
