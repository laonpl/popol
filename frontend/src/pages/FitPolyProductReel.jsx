import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import './FitPolyProductReel.css';

const DURATION = 31.5;
const SCENES = [0, 4.2, 8.5, 12.8, 17.6, 22.7, 27.3];

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
            <div className="v1-hero-shot v1-marketer-hook-bg"><img src="/video1/marketer-dashboard.png" alt="FitPoly 실제 마케터 경험정리 화면" /></div>
            <div className="v1-hero-scrim" />
            <div className="v1-hero-copy">
              <p><span>마케터 POV</span> 성과 정리할 때</p>
              <h1>조회수는<br />잘 나왔는데<br /><em>그래서 뭐가</em><br />바뀌었죠?</h1>
              <div className="v1-marketer-metrics"><span>팔로워 3배</span><span>저장률 4.1배</span><span>가입 CVR 9.6%</span></div>
            </div>
            <p className="v1-caption is-inverse">숫자만 나열하면 성과의 이유는 보이지 않으니까</p>
          </ReelScene>

          <ReelScene active={currentScene === 1} index={1}>
            <p className="v1-kicker is-rose">마케터 경험정리</p>
            <h2>성과 숫자 뒤의<br /><em>캠페인 스토리까지</em></h2>
            <BrowserFrame src="/video1/marketer-dashboard.png" alt="FitPoly 실제 마케터 캠페인 경험정리 화면" className="v1-marketer-browser">
              <div className="v1-kpi-focus kpi-one">800 → 2,400</div>
              <div className="v1-kpi-focus kpi-two">2.1 → 8.7%</div>
              <div className="v1-kpi-focus kpi-three">3.8 → 9.6%</div>
            </BrowserFrame>
            <div className="v1-campaign-flow"><span>Problem</span><ArrowRight size={13} /><span>Target</span><ArrowRight size={13} /><span>Strategy</span><ArrowRight size={13} /><span>Result</span></div>
            <p className="v1-caption">타깃·전략·실행·KPI·인사이트를 하나의 경험으로</p>
          </ReelScene>

          <ReelScene active={currentScene === 2} index={2}>
            <p className="v1-kicker is-blue">기획·PM 경험정리</p>
            <h2>PM의 실행은<br /><em>제품 판단 구조로</em></h2>
            <BrowserFrame src="/video1/pm-result.png" alt="FitPoly 실제 기획·PM 경험정리 화면" className="v1-pm-overview-browser">
              <div className="v1-pm-flow-overlay"><span>문제 신호</span><b>→</b><span>가설</span><b>→</b><span>결정</span><b>→</b><span>검증</span></div>
            </BrowserFrame>
            <div className="v1-pm-proof-tags"><span>PRD</span><span>사용자 인터뷰</span><span>퍼널</span><span>실험 결과</span></div>
            <p className="v1-caption">무엇을 만들었는지보다 왜 그렇게 결정했는지</p>
          </ReelScene>

          <ReelScene active={currentScene === 3} index={3}>
            <div className="v1-result-label"><Sparkles size={14} /> 실제 PM 결과 화면</div>
            <h2>리너 캔버스로<br /><em>문제부터 지표까지</em></h2>
            <BrowserFrame src="/video1/pm-lean-canvas.png" alt="FitPoly 실제 PM 리너 캔버스 화면" className="v1-lean-browser">
              <div className="v1-lean-focus focus-problem">문제</div>
              <div className="v1-lean-focus focus-value">고유 가치 제안</div>
              <div className="v1-lean-focus focus-metric">핵심지표</div>
            </BrowserFrame>
            <div className="v1-lean-summary">Problem · UVP · Customer · Metrics · Early Adopter</div>
            <p className="v1-caption">PM의 사고 구조와 제품 여정을 한 장에</p>
          </ReelScene>

          <ReelScene active={currentScene === 4} index={4}>
            <p className="v1-kicker is-blue">Transformation</p>
            <h2>기능이 아니라<br /><em>상태 변화를 보여줍니다</em></h2>
            <BrowserFrame src="/video1/pm-transformation.png" alt="FitPoly 실제 PM AS-IS TO-BE 화면" className="v1-transformation-browser">
              <div className="v1-transform-highlight">AS-IS <ArrowRight size={17} /> <strong>PM 개입</strong> <ArrowRight size={17} /> TO-BE</div>
            </BrowserFrame>
            <div className="v1-decision-proof">
              <div><small>채택</small><strong>단계형 인터뷰</strong></div>
              <div><small>기각</small><strong>전체 폼 입력</strong></div>
              <div className="is-pass"><small>검증</small><strong>38% → 64%</strong></div>
            </div>
            <p className="v1-caption">AS-IS → PM 개입 → TO-BE, 그리고 검증 결과까지</p>
          </ReelScene>

          <ReelScene active={currentScene === 5} index={5}>
            <div className="v1-before-after v1-role-split">
              <div className="v1-before-pane">
                <img src="/video1/marketer-dashboard.png" alt="FitPoly 마케터 경험정리 화면" />
                <span>MARKETER</span>
                <strong>성과의 이유</strong>
              </div>
              <div className="v1-after-pane">
                <img src="/video1/pm-lean-canvas.png" alt="FitPoly PM 리너 캔버스 화면" />
                <span>PM</span>
                <strong>판단의 근거</strong>
              </div>
              <div className="v1-swipe-line"><span><ArrowRight size={19} /></span></div>
            </div>
            <div className="v1-transform-copy"><span>캠페인 스토리</span><b>+</b><strong>제품 의사결정</strong></div>
            <p className="v1-caption is-inverse">마케터와 PM, 직군마다 다른 방식으로</p>
          </ReelScene>

          <ReelScene active={currentScene === 6} index={6}>
            <div className="v1-cta-bg"><img src="/video1/landing.png" alt="FitPoly 실제 랜딩 화면" /></div>
            <div className="v1-cta-scrim" />
            <div className="v1-cta-content">
              <div className="v1-cta-badge">MARKETER · PRODUCT MANAGER</div>
              <h2>경험을<br />증명 가능한<br />구조로.</h2>
              <p>성과의 이유부터 판단의 근거까지.</p>
              <div className="v1-cta-brand"><FitPolyBrand inverse /></div>
              <a href="/app/experience">무료로 시작하기 <ArrowRight size={18} strokeWidth={3} /></a>
              <small>fitpoly.kr</small>
            </div>
            <p className="v1-caption is-inverse">마케터·기획·PM 포트폴리오 만들 때 저장해두세요 ↗</p>
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
