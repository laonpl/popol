import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  FileSearch,
  MousePointer2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import './FitPolyProductReel.css';

const DURATION = 31.5;
const SCENES = [0, 3.8, 8.1, 12.8, 18.2, 23.3, 27.2];

const getScene = (time) => {
  for (let index = SCENES.length - 1; index >= 0; index -= 1) {
    if (time >= SCENES[index]) return index;
  }
  return 0;
};

function FitPolyBrand({ inverse = false }) {
  return (
    <div className={`v1-brand ${inverse ? 'is-inverse' : ''}`}>
      <img src="/logo.png" alt="" />
      <span>FitPoly</span>
    </div>
  );
}

function ReelScene({ active, index, children, className = '' }) {
  if (!active) return null;
  return <section className={`v1-scene v1-scene-${index} ${className}`}>{children}</section>;
}

function BrowserFrame({ src, alt, className = '', children }) {
  return (
    <div className={`v1-browser ${className}`}>
      <div className="v1-browser-bar">
        <span /><span /><span />
        <div>fitpoly.kr</div>
      </div>
      <div className="v1-browser-screen">
        <img src={src} alt={alt} />
        {children}
      </div>
    </div>
  );
}

export default function FitPolyProductReel() {
  const params = useRef(new URLSearchParams(window.location.search)).current;
  const renderMode = params.get('render') === '1';
  const initialTime = useRef(Math.min(Math.max(Number(params.get('t')) || 0, 0), DURATION - 0.1)).current;
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const startedAt = useRef(performance.now() - initialTime * 1000);
  const timeRef = useRef(initialTime);
  const frameRef = useRef(null);
  const audioRef = useRef(null);
  const lastSceneRef = useRef(getScene(initialTime));
  const currentScene = getScene(time);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = '실제 화면으로 보는 기획·PM 경험정리 | FitPoly';
    document.documentElement.classList.add('v1-reel-html');
    document.body.classList.add('v1-reel-body');
    return () => {
      document.title = previousTitle;
      document.documentElement.classList.remove('v1-reel-html');
      document.body.classList.remove('v1-reel-body');
    };
  }, []);

  useEffect(() => { timeRef.current = time; }, [time]);

  const playCue = useCallback((scene) => {
    if (!soundOn) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioRef.current) audioRef.current = new AudioContext();
    const context = audioRef.current;
    if (context.state === 'suspended') context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = scene < 2 ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime([210, 270, 430, 520, 600, 690, 780][scene], context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(scene < 2 ? 140 : 960, context.currentTime + 0.14);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
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
      const nextScene = getScene(next);
      if (nextScene !== lastSceneRef.current) {
        lastSceneRef.current = nextScene;
        playCue(nextScene);
      }
      setTime(next);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing, playCue]);

  const restart = () => {
    setTime(0);
    timeRef.current = 0;
    lastSceneRef.current = 0;
    startedAt.current = performance.now();
    setPlaying(true);
    playCue(0);
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
    lastSceneRef.current = getScene(next);
    startedAt.current = performance.now() - next * 1000;
  };

  const inverseHeader = currentScene === 0 || currentScene === 5 || currentScene === 6;

  return (
    <main className="v1-reel-page">
      <div className={`v1-reel-shell ${renderMode ? 'is-render-mode' : ''}`}>
        <div className="v1-reel-stage" aria-label="FitPoly 실제 서비스 기반 기획·PM 마케팅 영상">
          <div className="v1-grain" />
          <header className="v1-safe-header">
            <FitPolyBrand inverse={inverseHeader} />
            <span className={inverseHeader ? 'is-inverse' : ''}>REAL PRODUCT · PM</span>
          </header>

          <ReelScene active={currentScene === 0} index={0}>
            <div className="v1-hero-shot"><img src="/video1/landing.png" alt="FitPoly 실제 랜딩 화면" /></div>
            <div className="v1-hero-scrim" />
            <div className="v1-hero-copy">
              <p><span>PM POV</span> 포트폴리오 만들기 전</p>
              <h1>기능은 만들었는데<br /><em>왜 만들었는지</em><br />설명이 안 된다면?</h1>
              <div className="v1-search-meme"><FileSearch size={16} /> PRD_진짜최종_v7 찾는 중...</div>
            </div>
            <p className="v1-caption is-inverse">PM의 일을 ‘제품 판단’으로 바꾸는 법</p>
          </ReelScene>

          <ReelScene active={currentScene === 1} index={1}>
            <p className="v1-kicker">PM의 작업 폴더</p>
            <h2>PRD도, 지표도,<br />회고도 다 있는데</h2>
            <BrowserFrame src="/video1/landing.png" alt="FitPoly 실제 랜딩 화면" className="v1-landing-browser">
              <div className="v1-click-ring"><MousePointer2 size={17} fill="currentColor" /></div>
            </BrowserFrame>
            <div className="v1-meme-sticker">그래서 무슨 판단을<br /><strong>하셨는데요?</strong></div>
            <div className="v1-source-tags"><span>PRD</span><span>퍼널 지표</span><span>인터뷰</span><span>Figma</span></div>
            <p className="v1-caption">FitPoly는 PM의 자료에서 ‘제품 판단’을 찾습니다</p>
          </ReelScene>

          <ReelScene active={currentScene === 2} index={2}>
            <p className="v1-kicker is-blue">기획·PM 전용 구조</p>
            <h2>화면보다 중요한<br /><em>판단 과정부터</em></h2>
            <BrowserFrame src="/video1/sample.png" alt="FitPoly 실제 산출물 예시 화면" className="v1-sample-browser">
              <div className="v1-tab-focus">기획자 / PM</div>
              <div className="v1-card-focus"><span>문제 신호</span><b>→</b><span>가설</span><b>→</b><span>우선순위</span><b>→</b><span>검증</span></div>
            </BrowserFrame>
            <div className="v1-flow-copy"><span>문제</span><ArrowRight size={14} /><span>가설</span><ArrowRight size={14} /><span>결정</span><ArrowRight size={14} /><span>지표</span></div>
            <p className="v1-caption">실제 서비스의 기획·PM 전용 산출물 화면</p>
          </ReelScene>

          <ReelScene active={currentScene === 3} index={3}>
            <div className="v1-result-label"><Sparkles size={14} /> 실제 기획·PM 결과 화면</div>
            <h2>PM의 의사결정이<br /><em>이렇게 정리됩니다</em></h2>
            <BrowserFrame src="/video1/pm-result.png" alt="FitPoly 기획·PM 경험정리 결과 예시" className="v1-result-browser">
              <div className="v1-result-spotlight spot-one"><span>01</span> 문제 신호 · 사용자 이탈</div>
              <div className="v1-result-spotlight spot-two"><span>02</span> 가설 · 선택한 대안</div>
              <div className="v1-result-spotlight spot-three"><span>03</span> 기여도 · 검증 지표</div>
            </BrowserFrame>
            <p className="v1-caption">문제 신호·가설·대안·기여도·검증 지표가 한 화면에</p>
          </ReelScene>

          <ReelScene active={currentScene === 4} index={4}>
            <p className="v1-kicker is-blue">요구사항 정리에서</p>
            <h2>제품을 움직인<br /><em>의사결정 스토리로</em></h2>
            <div className="v1-result-crop">
              <img src="/video1/pm-result.png" alt="FitPoly 실제 PM 경험 결과 상세" />
              <div className="v1-evidence-line line-one"><Check size={13} /> 사용자 신호 · 문제 정의</div>
              <div className="v1-evidence-line line-two"><Check size={13} /> 채택·기각한 대안</div>
              <div className="v1-evidence-line line-three"><Check size={13} /> 성공 기준 · 검증 지표</div>
            </div>
            <div className="v1-story-equation">
              <div><small>BEFORE</small><span>“기능 3개 기획”</span></div>
              <ArrowDown size={17} />
              <div className="is-after"><small>AFTER</small><span>이탈 발견 → 가설 → 검증</span></div>
            </div>
            <p className="v1-caption">무엇을 만들었는지보다, 왜 그렇게 판단했는지</p>
          </ReelScene>

          <ReelScene active={currentScene === 5} index={5}>
            <div className="v1-before-after">
              <div className="v1-before-pane">
                <img src="/video1/landing.png" alt="흩어진 경험을 보여주는 FitPoly 랜딩" />
                <span>BEFORE</span>
                <strong>기능 목록</strong>
              </div>
              <div className="v1-after-pane">
                <img src="/video1/pm-result.png" alt="정리된 PM 경험 결과" />
                <span>AFTER</span>
                <strong>제품 의사결정</strong>
              </div>
              <div className="v1-swipe-line"><span><ArrowRight size={19} /></span></div>
            </div>
            <div className="v1-transform-copy"><span>기능 기획</span><ArrowRight size={15} /><strong>PM 케이스 스터디</strong></div>
            <p className="v1-caption is-inverse">PM의 실행을 채용 가능한 언어로</p>
          </ReelScene>

          <ReelScene active={currentScene === 6} index={6}>
            <div className="v1-cta-bg"><img src="/video1/landing.png" alt="FitPoly 실제 랜딩 화면" /></div>
            <div className="v1-cta-scrim" />
            <div className="v1-cta-content">
              <div className="v1-cta-badge">PRODUCT MANAGER · EXPERIENCE</div>
              <h2>PM의 경력은<br />판단으로<br />증명됩니다.</h2>
              <p>문제부터 지표까지, 설명 가능하게.</p>
              <div className="v1-cta-brand"><FitPolyBrand inverse /></div>
              <a href="/app/experience">무료로 시작하기 <ArrowRight size={18} strokeWidth={3} /></a>
              <small>fitpoly.kr</small>
            </div>
            <p className="v1-caption is-inverse">기획·PM 포트폴리오 만들 때 저장해두세요 ↗</p>
          </ReelScene>

          <div className="v1-progress"><span style={{ width: `${(time / DURATION) * 100}%` }} /></div>
        </div>

        <div className="v1-controls" aria-label="영상 컨트롤">
          <button type="button" onClick={togglePlay} aria-label={playing ? '일시정지' : '재생'}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button type="button" onClick={restart} aria-label="처음부터 다시 보기"><RefreshCw size={17} /></button>
          <input type="range" min="0" max="1000" value={Math.round((time / DURATION) * 1000)} onChange={jumpTo} aria-label="영상 재생 위치" />
          <span>{Math.floor(time).toString().padStart(2, '0')} / 31</span>
          <button type="button" onClick={toggleSound} aria-label={soundOn ? '음소거' : '사운드 켜기'}>
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
        <p className="v1-note">실제 FitPoly 화면 기반 · 9:16 릴스 프리뷰</p>
      </div>
    </main>
  );
}
