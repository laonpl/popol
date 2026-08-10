import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Download,
  MousePointer2,
  Pause,
  Play,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import './FitPolyProductReel.css';

const DURATION = 35.5;
const SCENES = [0, 4, 8, 12.3, 16.6, 21.4, 26.5, 31.1];

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

function Video0ChaosFile({ icon, iconAlt, children, className = '' }) {
  return (
    <div className={`v1-video0-file ${className}`}>
      <img className="v1-video0-file-icon" src={icon} alt={iconAlt} />
      <span>{children}</span>
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
  const captureMode = params.get('capture') === '1';
  const initialTime = useRef(Math.min(Math.max(Number(params.get('t')) || 0, 0), DURATION - 0.1)).current;
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(!captureMode);
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
    oscillator.frequency.setValueAtTime([260, 150, 310, 430, 520, 600, 690, 780][scene], context.currentTime);
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

  const inverseHeader = currentScene === 1;

  return (
    <main className="v1-reel-page">
      <div className={`v1-reel-shell ${renderMode ? 'is-render-mode' : ''}`}>
        <div className="v1-reel-stage" aria-label="FitPoly 실제 서비스 기반 기획·PM 마케팅 영상">
          <div className="v1-grain" />
          <header className="v1-safe-header">
            <FitPolyBrand inverse={inverseHeader} />
            <span className={inverseHeader ? 'is-inverse' : ''}>기획·PM 경험정리</span>
          </header>

          <ReelScene active={currentScene === 0} index="video0-hook">
            <div className="v1-video0-hook-label"><span>POV</span> 면접 3일 전</div>
            <h1>기획·PM 경험은<br /><span>많은데</span></h1>
            <div className="v1-video0-punchline"><span>정리된 건</span><strong>0개</strong></div>
            <div className="v1-video0-cursor"><MousePointer2 size={18} /> 생각 중...</div>
            <p className="v1-caption">프로젝트 폴더를 열어본 나</p>
          </ReelScene>

          <ReelScene active={currentScene === 1} index="video0-chaos">
            <p className="v1-video0-kicker">그 시절의 나</p>
            <h2>일은 했는데<br /><em>기억이 안 남</em></h2>
            <div className="v1-video0-files">
              <Video0ChaosFile icon="/brand-icons/pdf.svg" iconAlt="PDF" className="file-one">PRD_최종.pdf</Video0ChaosFile>
              <Video0ChaosFile icon="/brand-icons/powerpoint.svg" iconAlt="PowerPoint" className="file-two">발표자료_최종.pptx</Video0ChaosFile>
              <Video0ChaosFile icon="/brand-icons/word.svg" iconAlt="Word" className="file-three">회의록_진짜최종.docx</Video0ChaosFile>
              <Video0ChaosFile icon="/brand-icons/figma.svg" iconAlt="Figma" className="file-four">온보딩_화면_v3.fig</Video0ChaosFile>
            </div>
            <div className="v1-video0-toast"><span>면접관</span> 그래서 본인 역할이 뭐였죠?</div>
            <p className="v1-caption is-inverse">파일명부터 이미 위기</p>
          </ReelScene>

          <ReelScene active={currentScene === 2} index={1}>
            <p className="v1-kicker is-blue">기획·PM 포폴 구조조정</p>
            <h2>기능 목록은 버리고<br /><em>판단의 흐름만 남기기</em></h2>
            <BrowserFrame src="/video3/pm-result.png" alt="FitPoly 실제 기획·PM 경험정리 화면" className="v1-pm-overview-browser">
              <div className="v1-pm-flow-overlay"><span>문제 신호</span><b>→</b><span>가설</span><b>→</b><span>결정</span><b>→</b><span>검증</span></div>
            </BrowserFrame>
            <div className="v1-pm-proof-tags"><span className="is-meme">기능 나열 금지 🚨</span><span>문제 정의</span><span>가설</span><span>의사결정</span></div>
            <p className="v1-caption">면접관의 “그래서 왜?”에 막히지 않는 구조</p>
          </ReelScene>

          <ReelScene active={currentScene === 3} index={2}>
            <div className="v1-result-label">실제 기획·PM 결과 화면</div>
            <h2>기획·PM 포폴의 빈칸<br /><em>리너 캔버스로 채우기</em></h2>
            <BrowserFrame src="/video3/pm-lean-canvas.png" alt="FitPoly 실제 PM 리너 캔버스 화면" className="v1-lean-browser">
              <div className="v1-lean-data-mask"><strong>검증 기준</strong><span>무엇이 달라지면 가설이 맞는가?</span></div>
              <div className="v1-lean-focus focus-problem">문제</div>
              <div className="v1-lean-focus focus-value">고유 가치 제안</div>
              <div className="v1-lean-focus focus-metric">검증 기준</div>
            </BrowserFrame>
            <div className="v1-meme-tag">PM 뇌 구조 공개.zip</div>
            <p className="v1-caption">문제·가치·고객·대안이 연결되어야 기획이 보입니다</p>
          </ReelScene>

          <ReelScene active={currentScene === 4} index={3}>
            <p className="v1-kicker is-blue">중간 과정 실종 사건</p>
            <h2>결과만 쓰는 순간<br /><em>제품 여정은 증발합니다</em></h2>
            <BrowserFrame src="/video3/pm-lean-canvas.png" alt="FitPoly 실제 PM 제품 여정 화면" className="v1-journey-browser">
              <div className="v1-journey-data-mask">각 단계의 근거와 판단을 연결</div>
            </BrowserFrame>
            <div className="v1-journey-route">
              {['Discover', 'Insight', 'Hypothesize', 'Decide', 'Validate', 'Evolve'].map((step, index) => <span key={step}><b>{index + 1}</b>{step}</span>)}
            </div>
            <p className="v1-caption">발견 → 인사이트 → 가설 → 결정 → 검증 → 배움</p>
          </ReelScene>

          <ReelScene active={currentScene === 5} index={4}>
            <p className="v1-kicker is-blue">기능 소개 ≠ 기획·PM 경험</p>
            <h2>상태 변화가 없으면<br /><em>그냥 화면 소개입니다</em></h2>
            <div className="v1-as-is-board" aria-label="FitPoly 실제 AS-IS TO-BE 메모 보드">
              <div className="v1-sticky-board-head is-before">
                <strong>AS-IS</strong><span>현재 · 문제 상태</span>
              </div>
              <div className="v1-sticky-board-head is-after">
                <strong>TO-BE</strong><span>개선 · 목표 상태</span>
              </div>
              <div className="v1-sticky-divider" />
              <article className="v1-paper-note is-before">
                <p>전체 입력 폼 앞에서<br />첫 문장을 쓰지 못하고 이탈</p>
              </article>
              <ArrowRight className="v1-note-arrow" size={17} />
              <article className="v1-paper-note is-after">
                <p>한 질문씩 답해<br />수정 가능한 초안을 완성</p>
              </article>
              <div className="v1-pm-judgement"><b>기획·PM 판단</b><span>속도보다 근거를 이해하고 수정하는 경험을 우선</span></div>
            </div>
            <div className="v1-decision-proof">
              <div><small>채택</small><strong>단계형 인터뷰</strong></div>
              <div><small>기각</small><strong>전체 폼 입력</strong></div>
              <div className="is-pass"><small>배움</small><strong>질문 단위 진입</strong></div>
            </div>
            <p className="v1-caption">전후 상태와 판단 이유가 보여야 기획·PM 경험이 됩니다</p>
          </ReelScene>

          <ReelScene active={currentScene === 6} index={5}>
            <div className="v1-pm-logic-bg"><img src="/video3/pm-lean-canvas.png" alt="FitPoly 실제 PM 제품 판단 화면" /></div>
            <div className="v1-pm-logic-scrim" />
            <div className="v1-pm-logic-content">
              <p>기획의 흐름</p>
              <h2>면접관이 궁금한 건<br /><em>당신의 판단</em></h2>
              <div className="v1-pm-logic-flow">
                <div><span>01 · 문제</span><strong>첫 작성 이탈</strong></div>
                <div><span>02 · 가설</span><strong>질문형 입력</strong></div>
                <div><span>03 · 결정</span><strong>단계형 UX</strong></div>
                <div><span>04 · 검증</span><strong>가설 검증 완료</strong></div>
              </div>
            </div>
            <p className="v1-caption">문제 → 가설 → 결정 → 검증이 연결되는 기획·PM 포트폴리오</p>
          </ReelScene>

          <ReelScene active={currentScene === 7} index={6}>
            <div className="v1-cta-bg"><img src="/video3/landing.png" alt="FitPoly 실제 랜딩 화면" /></div>
            <div className="v1-cta-scrim" />
            <div className="v1-cta-content">
              <div className="v1-cta-badge">기획 · PM 포트폴리오</div>
              <h2>면접에서<br />막히지 않는<br /><em>기획·PM 포트폴리오</em></h2>
              <p>화면 나열은 끝. 판단의 근거를 보여주세요.</p>
              <div className="v1-cta-brand"><FitPolyBrand /></div>
              <a href="/app/experience">무료로 시작하기 <ArrowRight size={18} strokeWidth={3} /></a>
              <small>fitpoly.kr</small>
            </div>
            <p className="v1-caption">기획·PM 포트폴리오 만들 때 저장해두세요 ↗</p>
          </ReelScene>

          <div className="v1-progress"><span style={{ width: `${(time / DURATION) * 100}%` }} /></div>
        </div>

        <div className="v1-controls" aria-label="영상 컨트롤">
          <button type="button" onClick={togglePlay} aria-label={playing ? '일시정지' : '재생'}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button type="button" onClick={restart} aria-label="처음부터 다시 보기"><RefreshCw size={17} /></button>
          <input type="range" min="0" max="1000" value={Math.round((time / DURATION) * 1000)} onChange={jumpTo} aria-label="영상 재생 위치" />
          <span>{Math.floor(time).toString().padStart(2, '0')} / 35</span>
          <button type="button" onClick={toggleSound} aria-label={soundOn ? '음소거' : '사운드 켜기'}>
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <a className="v1-download" href="/video3/fitpoly-planning-pm-reel.mp4" download aria-label="영상 MP4 다운로드" title="MP4 다운로드">
            <Download size={18} />
          </a>
        </div>
        <p className="v1-note">실제 FitPoly 화면 기반 · 9:16 릴스 프리뷰</p>
      </div>
    </main>
  );
}
