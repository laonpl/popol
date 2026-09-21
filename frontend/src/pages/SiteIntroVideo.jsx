/**
 * /video — FitPoly 서비스 소개 영상 (16:9 · 60초)
 *
 * 레퍼런스: 삼성페이 홍보영상 종합편(헤이메이트, lDhv9tqmokM).
 * 밝은 스튜디오, 입체 소품, 하루의 흐름과 로고 범퍼를 FitPoly의 기능으로 재구성.
 *  - 배경은 처음부터 끝까지 옅은 회백색 한 톤. 인트로만 브랜드 블루 풀스크린
 *  - 왼쪽에 파란 아이소메트릭 받침 위 3D 오브젝트(폰·파일) + 3D 시계 숫자, 오른쪽에 본문
 *  - 본문은 얇은(Light) 파란 글씨, 키워드만 한 박자 늦게 볼드로 바뀐다. 아래에 회색 해시태그
 *  - 파스텔 원형 아이콘이 폰 주위를 떠다니고, 스쿼클 로고가 챕터 사이 범퍼로 등장
 *  - "하루 일과"(08:00 → 22:00) 시나리오로 기능을 하나씩 보여준다
 *
 * 녹화: frontend 를 띄운 뒤  backend 에서
 *   npm run capture:intro
 * 캡처 계약은 /eng 와 같다 — window.__engReelDurationMs / window.__engSeek(ms)
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  MessageCircle, StickyNote, GitBranch, FolderOpen, FileText, PenTool,
  Upload, Sparkles, ListOrdered, Link2, BadgeCheck, Eye, Bell,
  Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Download, Check, ArrowUpRight,
} from 'lucide-react';
import './SiteIntroVideo.css';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const easeOut = (t) => 1 - (1 - clamp01(t)) ** 3;
/* 캡처 시각만으로 값이 정해져야 프레임이 흔들리지 않는다 */
const countUp = (e, to, startMs = 0, durMs = 900, from = 0) => from + (to - from) * easeOut((e - startMs) / durMs);

/* 폰 주위를 떠다니는 파스텔 아이콘 — 위치는 폰 중심 기준 오프셋 */
const ORBIT = [
  { Icon: MessageCircle, brand: 'kakaotalk', color: 'yellow', x: -345, y: -230 },
  { Icon: StickyNote, brand: 'notion', color: 'sky', x: 320, y: -280 },
  { Icon: GitBranch, brand: 'github', color: 'blue', x: -400, y: 40 },
  { Icon: FolderOpen, brand: 'google-drive', color: 'green', x: 390, y: 20 },
  { Icon: FileText, brand: 'pdf', color: 'red', x: -290, y: 280 },
  { Icon: PenTool, brand: 'figma', color: 'orange', x: 310, y: 290 },
];
const RING = [Upload, Sparkles, ListOrdered, Link2, BadgeCheck, Eye];
const RING_COLORS = ['yellow', 'red', 'green', 'sky', 'orange', 'blue'];

/* ── 화면 공통 조각 ── */
function Txt({ lines, tags, center }) {
  return (
    <div className={`sp-txt ${center ? 'is-center' : ''}`}>
      {lines.map((line, index) => (
        <p key={index} className="sp-line" style={{ animationDelay: `${200 + index * 260}ms` }}>{line}</p>
      ))}
      {tags && <p className="sp-tags">{tags}</p>}
    </div>
  );
}

function Bubble({ Icon, brand, color, x, y, className = '', delay = 0 }) {
  return (
    <span
      className={`sp-bubble c-${color} ${className}`}
      style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, '--dx': `${-x}px`, '--dy': `${-y}px`, animationDelay: `${delay}ms, ${delay}ms` }}
    >
      {brand ? <img src={`/brand-icons/${brand}.svg`} alt="" /> : <Icon />}
    </span>
  );
}

/* 파란 아이소메트릭 받침. 오브젝트는 받침 윗면 중앙에 세운다 */
function Iso({ clock, children }) {
  return (
    <div className="sp-iso">
      <i className="sp-iso-side" />
      <i className="sp-iso-top" />
      <div className="sp-iso-objs">{children}</div>
      {clock && <span className="sp-clock">{clock}</span>}
    </div>
  );
}

function Phone({ src, dim, className = '', children }) {
  return (
    <div className={`sp-phone ${className}`}>
      <div className="sp-phone-screen">
        {src && <img src={src} alt="" style={dim ? { filter: 'brightness(.5)' } : undefined} />}
        {children}
      </div>
      <i className="sp-phone-cam" />
      <i className="sp-phone-button" />
    </div>
  );
}

function Squircle({ className = '', children }) {
  return <div className={`sp-squircle ${className}`}>{children}</div>;
}

const Note = ({ children }) => <p className="sp-note">{children}</p>;

function Desk() {
  return (
    <div className="sp-desk" aria-hidden="true">
      <div className="sp-desk-wall"><div className="sp-desk-window"><i /><i /><i /><i /></div><span>MY NEXT CHAPTER</span></div>
      <div className="sp-desk-table"><i /><i /></div>
      <div className="sp-desk-monitor"><img src="/video/pf-dev.jpg" alt="" /><i /></div>
      <div className="sp-desk-books"><i /><i /><i /></div>
      <div className="sp-desk-plant"><i /><i /><i /><b /></div>
      <div className="sp-desk-mug" />
    </div>
  );
}

function PortfolioSheets() {
  return (
    <div className="sp-portfolio-sheets">
      {['dev', 'pm', 'mkt'].map((field, index) => (
        <div className={`sp-portfolio-sheet sheet-${index}`} key={field}>
          <div className="sp-sheet-bar"><i /><i /><i /><span>fitpoly.kr / portfolio</span></div>
          <img src={`/video/pf-${field}.jpg`} alt={`${['개발', '기획', '마케팅'][index]} 포트폴리오 예시`} />
        </div>
      ))}
      <span className="sp-export-badge"><Check /> PDF · 웹 링크</span>
    </div>
  );
}

/* ── 컷 ── */
const BEATS = [
  /* 인트로 — 브랜드 블루 풀스크린 */
  {
    key: 'intro', label: '당신의 경험, 다음 기회로', tone: 'blue', ms: 4000,
    render: () => (
      <div className="sp-intro">
        <span className="sp-intro-badge">당신의 경험을 <b>가능성으로</b></span>
        <div className="sp-intro-mark"><img src="/video/fitpoly-mark.png" alt="" /><span>FitPoly</span></div>
        <div className="sp-intro-cards"><i /><i /><i /></div>
        <p className="sp-intro-sub">경험 정리부터 맞춤 포트폴리오까지</p>
      </div>
    ),
  },

  /* 폰 주위로 흩어진 기록 아이콘이 떠다닌다 */
  {
    key: 'hub', label: '흩어진 경험', tone: 'light', ms: 4200,
    render: () => (
      <div className="sp-center">
        <Phone src="/video/phone-result.jpg" className="is-hero is-tilt" />
        {ORBIT.map((item, index) => <Bubble key={index} {...item} delay={250 + index * 130} />)}
      </div>
    ),
  },
  /* 아이콘들이 폰으로 빨려 들어간다 — 한곳에 */
  {
    key: 'gather', label: '한곳에 모으기', tone: 'light', ms: 3800,
    render: () => (
      <div className="sp-split">
        <div className="sp-stage-l">
          <Phone src="/video/phone-result.jpg" className="is-hero" />
          {ORBIT.map((item, index) => <Bubble key={index} {...item} className="is-in" delay={300 + index * 90} />)}
        </div>
        <Txt lines={['여기저기 흩어진 경험', <>이제 <b>한곳에</b></>]} tags="#카톡 #노션 #깃허브 #드라이브" />
      </div>
    ),
  },

  /* 08:00 — 출근길 공고 링크 */
  {
    key: 't0800', label: '08:00 · 채용공고 발견', tone: 'light', ms: 5000,
    render: (e) => (
      <div className="sp-split">
        <div className="sp-stage-l">
          <Iso clock="08:00">
            <Phone>
              <div className="sp-app">
                <div className="sp-app-bar"><i /><span>FitPoly</span></div>
                <div className="sp-app-url">https://jobkorea.co.kr/Recruit/GI_Read/…<i /></div>
                <div className="sp-app-card">
                  <b>프론트엔드 개발자 (신입)</b>
                  <span>㈜코코네 · 서울 · 정규직</span>
                  <em>{e < 2300 ? '공고 분석 중…' : '필요 역량 확인 완료'}<Check /></em>
                </div>
                <div className="sp-app-line" /><div className="sp-app-line is-short" />
              </div>
            </Phone>
            <span className="sp-floating-link"><Link2 /><span>공고 링크 하나로</span><Check /></span>
          </Iso>
        </div>
        <Txt lines={['아침에 발견한 채용공고', <><b>링크 하나로</b> 분석 시작</>]} tags="#채용공고 분석 #필요 역량 확인" />
        <Note>*공고 분석은 지원하는 채용 사이트의 페이지 구조에 따라 인식 범위가 다를 수 있습니다.</Note>
      </div>
    ),
  },

  /* 10:00 — 정리 안 된 자료 그대로 올리기 */
  {
    key: 't1000', label: '10:00 · 자료 업로드', tone: 'light', ms: 5000,
    render: () => (
      <div className="sp-split">
        <div className="sp-stage-l">
          <Iso clock="10:00">
            <Phone>
              <div className="sp-app">
                <div className="sp-app-bar"><i /><span>FitPoly</span></div>
                <div className="sp-app-drop"><Upload />자료 올리기</div>
                <div>
                  {[['kakaotalk', '카톡 대화.txt'], ['github', 'commits.json'], ['pdf', '발표자료.pdf']].map(([icon, name], index) => (
                    <span key={name} className="sp-app-chip" style={{ animationDelay: `${1300 + index * 220}ms` }}>
                      <img src={`/brand-icons/${icon}.svg`} alt="" />{name}
                    </span>
                  ))}
                </div>
              </div>
            </Phone>
            <div className="sp-files">
              {['kakaotalk', 'github', 'pdf'].map((icon, index) => (
                <span key={icon} className={`sp-file sp-file-${index + 1}`} style={{ animationDelay: `${500 + index * 200}ms, ${500 + index * 200}ms` }}>
                  <img src={`/brand-icons/${icon}.svg`} alt="" /><i /><i />
                </span>
              ))}
            </div>
          </Iso>
        </div>
        <Txt lines={['정리 안 된 자료도', <><b>그대로 올리면</b> 끝</>]} tags="#카톡대화 #깃허브 #노션 #발표PDF" />
      </div>
    ),
  },

  /* 범퍼 — 스쿼클 로고 + 기능 아이콘 링 */
  {
    key: 'bumper1', label: '경험이 연결되는 순간', tone: 'light', ms: 3200,
    render: () => (
      <div className="sp-center">
        <Squircle><img src="/video/fitpoly-mark.png" alt="" /></Squircle>
        {RING.map((Icon, index) => {
          const angle = (-90 + index * 60) * Math.PI / 180;
          return <Bubble key={index} Icon={Icon} color={RING_COLORS[index]} x={Math.cos(angle) * 400} y={Math.sin(angle) * 400} delay={500 + index * 110} />;
        })}
      </div>
    ),
  },

  /* 15:00 — AI 경험 정리 */
  {
    key: 't1500', label: '15:00 · AI 경험 정리', tone: 'light', ms: 6000,
    render: () => (
      <div className="sp-split">
        <div className="sp-stage-l">
          <Iso clock="15:00">
            <Phone src="/video/phone-result.jpg" />
            <span className="sp-evidence"><BadgeCheck /><span>내 경험의 근거를 찾아<b>판단과 성과까지 연결</b></span></span>
            <div className="sp-pills">
              {['관찰', '판단', '대안', '검증'].map((word, index) => (
                <span key={word} className={`sp-pill-${index + 1}`} style={{ animationDelay: `${700 + index * 220}ms, ${700 + index * 220}ms` }}>{word}</span>
              ))}
            </div>
          </Iso>
        </div>
        <Txt lines={['무엇을 했는지, 왜 했는지', <>AI가 <b>경험의 맥락까지</b></>]} tags="#관찰 #판단 #대안 #검증" />
        <Note>*업로드한 자료에서 확인된 내용은 사실, 모델이 보완한 문장은 추정으로 표기됩니다.</Note>
      </div>
    ),
  },

  /* 19:00 — 공고에 맞춰 순서가 바뀐다 */
  {
    key: 't1900', label: '19:00 · 공고별 맞춤 구성', tone: 'light', ms: 6000,
    render: (e) => (
      <div className="sp-split">
        <div className="sp-stage-l">
          <Iso clock="19:00">
            <Phone>
              <div className="sp-app">
                <div className="sp-app-bar"><i /><span>FitPoly</span></div>
                <p className="sp-app-title">㈜코코네 · 적합도 순</p>
                {[['성능 개선 · 문제 해결', 92], ['협업 · 코드 리뷰', 84], ['서비스 운영 경험', 77]].map(([name, pct], index) => (
                  <div key={name} className="sp-app-rank" style={{ animationDelay: `${900 + index * 240}ms` }}>
                    <b>{index + 1}</b><span>{name}</span>
                    <em>{Math.round(countUp(e, pct, 1100 + index * 240, 700))}%</em>
                  </div>
                ))}
              </div>
            </Phone>
          </Iso>
        </div>
        <Txt lines={['지원할 회사가 달라져도', <><b>공고에 맞게</b> 다시 구성</>]} tags="#경험 매칭 #직무별 포트폴리오" />
        <Note>*화면의 기업명과 적합도 수치는 기능 설명을 위한 예시입니다.</Note>
      </div>
    ),
  },

  /* 범퍼 — 로고가 한 바퀴 돌며 컨페티 */
  {
    key: 'bumper2', label: '다음 기회로', tone: 'light', ms: 2600,
    render: () => (
      <div className="sp-center">
        <div className="sp-confetti">
          {['red', 'yellow', 'green', 'sky', 'blue', 'orange', 'red', 'yellow'].map((color, index) => (
            <i key={index} style={{ '--a': `${index * 45}deg` }}><b className={`c-${color}`} style={{ animationDelay: `${300 + (index % 3) * 90}ms` }} /></i>
          ))}
        </div>
        <Squircle className="is-flip"><img src="/video/fitpoly-mark.png" alt="" /></Squircle>
      </div>
    ),
  },

  /* 22:00 — 하루를 마무리하며 열람 현황 확인 */
  {
    key: 't2200', label: '22:00 · 제출 후 열람 확인', tone: 'light', ms: 6000,
    render: () => (
      <div className="sp-split sp-evening">
        <div className="sp-stage-l">
          <Iso clock="22:00"><Desk /></Iso>
          <div className="sp-evening-notice"><span><Bell /></span><div><small>FitPoly · 링크 열람 현황</small><b>제출한 포트폴리오에 새로운 열람</b><p>열람 횟수 · 머문 시간 · 읽은 범위</p></div><Check /></div>
        </div>
        <Txt lines={['보내고 끝이 아니라', <><b>열람 여부까지</b> 확인</>]} tags="#공개 링크 #열람 현황" />
        <Note>*공개 링크의 익명 열람 현황을 확인하며, 열람자 개인은 식별하지 않습니다.</Note>
      </div>
    ),
  },

  /* 한 번 정리한 경험을 다양한 포트폴리오로 */
  {
    key: 'twelve', label: '경험 하나, 여러 번의 기회', tone: 'light', ms: 5000,
    render: () => (
      <div className="sp-split">
        <div className="sp-stage-l">
          <PortfolioSheets />
        </div>
        <Txt lines={['한 번 정리한 경험으로', <><b>다음 지원은 더 가볍게</b></>]} tags="#개발 #기획·PM #마케팅" />
      </div>
    ),
  },

  /* 아웃트로 — 기능 스쿼클이 차례로 넘어가다 로고로 */
  {
    key: 'outro-icons', label: '모으고, 정리하고, 연결하다', tone: 'light', ms: 3600,
    render: (e) => {
      const items = [Upload, Sparkles, Link2, null];
      const index = Math.min(items.length - 1, Math.floor(e / 900));
      const Icon = items[index];
      return (
        <div className="sp-center">
          <div className="sp-icon-swap" key={index} data-motion-offset={index * 900}>
            <Squircle className={Icon ? 'is-sm' : ''}>
              {Icon ? <Icon /> : <img src="/video/fitpoly-mark.png" alt="" />}
            </Squircle>
            <span>{['모으고', '정리하고', '연결하다', 'FitPoly'][index]}</span>
          </div>
        </div>
      );
    },
  },
  {
    key: 'outro', label: '지금, FitPoly에서 시작하세요', tone: 'white', ms: 5600,
    render: () => (
      <div className="sp-outro">
        <span className="sp-outro-badge">경험 정리부터 포트폴리오까지 <b>한 번에</b></span>
        <div className="sp-outro-mark"><img src="/video/fitpoly-mark.png" alt="" /><span>FitPoly</span></div>
        <a className="sp-outro-url" href="/">fitpoly.kr <ArrowUpRight /></a>
        <span className="sp-outro-credit">지금 시작하고 1,000C 무료로 받기</span>
        <Note>*가입 시 1,000크레딧이 제공되며, 일부 기능은 크레딧 차감 후 이용할 수 있습니다.</Note>
      </div>
    ),
  },
];

const TOTAL = BEATS.reduce((sum, beat) => sum + beat.ms, 0);
const STARTS = BEATS.reduce((acc, beat) => [...acc, acc[acc.length - 1] + beat.ms], [0]);

const locate = (ms) => {
  const t = Math.min(TOTAL - 0.001, Math.max(0, Number(ms) || 0));
  let index = 0;
  while (index < BEATS.length - 1 && t >= STARTS[index + 1]) index += 1;
  return { index, elapsed: t - STARTS[index] };
};

export default function SiteIntroVideo() {
  const captureMode = useMemo(() => new URLSearchParams(window.location.search).has('capture'), []);
  const [ms, setMs] = useState(() => !captureMode && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1600 : 0);
  const [playing, setPlaying] = useState(() => !captureMode && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [sound, setSound] = useState(false);
  const [notice, setNotice] = useState('');
  const stageRef = useRef(null);
  const pageRef = useRef(null);
  const audioRef = useRef(null);
  const msRef = useRef(ms);
  const rafRef = useRef(null);
  const startedAt = useRef(0);

  const { index, elapsed } = locate(ms);
  const beat = BEATS[index];

  // Preview, scrubbing and MP4 export use exactly the same animation clock.
  // Newly mounted icon bumpers have their own offset within the scene.
  useLayoutEffect(() => {
    msRef.current = ms;
    stageRef.current?.getAnimations({ subtree: true }).forEach(animation => {
      const offset = Number(animation.effect?.target?.closest('[data-motion-offset]')?.dataset.motionOffset || 0);
      animation.pause();
      animation.currentTime = Math.max(0, elapsed - offset);
    });
  }, [ms, elapsed, index]);

  /* 1920×1080 좌표계로 그리고 화면에는 마지막에 scale 한 번만 건다 */
  useEffect(() => {
    const previousScale = document.documentElement.style.getPropertyValue('--iv-scale');
    const fit = () => {
      document.documentElement.style.setProperty('--iv-scale', String(Math.min(window.innerWidth / 1920, window.innerHeight / 1080)));
    };
    fit();
    window.addEventListener('resize', fit);
    document.documentElement.classList.add('iv-html');
    const previousTitle = document.title;
    document.title = 'FitPoly 서비스 소개 영상';
    return () => {
      window.removeEventListener('resize', fit);
      document.documentElement.classList.remove('iv-html');
      if (previousScale) document.documentElement.style.setProperty('--iv-scale', previousScale);
      else document.documentElement.style.removeProperty('--iv-scale');
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    window.__engReelDurationMs = TOTAL;
    window.__introTimeline = BEATS.map((item, i) => ({ key: item.key, label: item.label, start: STARTS[i], duration: item.ms }));
    if (captureMode) {
      window.__engSeek = async (value) => {
        const next = Math.min(TOTAL, Math.max(0, Number(value) || 0));
        flushSync(() => setMs(next));
        msRef.current = next;
        // Let Chrome commit new compositing layers after a chapter change.
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return locate(next).elapsed;
      };
    }
    return () => {
      delete window.__engReelDurationMs;
      delete window.__engSeek;
      delete window.__introTimeline;
    };
  }, [captureMode]);

  useEffect(() => {
    if (!playing || captureMode) return undefined;
    startedAt.current = performance.now() - msRef.current;
    const tick = (now) => {
      const next = Math.min(TOTAL, now - startedAt.current);
      setMs(next);
      if (next >= TOTAL) setPlaying(false);
      else rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, captureMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing && sound) {
      audio.currentTime = msRef.current / 1000;
      audio.volume = 0.65;
      audio.play().catch(error => {
        // A quick pause/seek can abort a pending play request; that is not a playback failure.
        if (error.name === 'AbortError') return;
        setSound(false);
        setNotice('소리를 켜려면 음량 버튼을 다시 눌러 주세요.');
      });
    } else audio.pause();
  }, [playing, sound]);

  const seek = (value) => {
    const next = Math.min(TOTAL, Math.max(0, value));
    msRef.current = next;
    startedAt.current = performance.now() - next;
    setMs(next);
    if (audioRef.current) audioRef.current.currentTime = next / 1000;
    if (next >= TOTAL) setPlaying(false);
  };

  const togglePlay = () => {
    if (msRef.current >= TOTAL) { seek(0); setPlaying(true); }
    else setPlaying(value => !value);
  };

  useEffect(() => {
    if (captureMode) return;
    const onKey = (event) => {
      if (event.target.closest('button, input, a, select, textarea')) return;
      if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
      if (event.code === 'ArrowRight') { event.preventDefault(); seek(msRef.current + 5000); }
      if (event.code === 'ArrowLeft') { event.preventDefault(); seek(msRef.current - 5000); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [captureMode]);

  const clock = (value) => `${String(Math.floor(value / 60000)).padStart(2, '0')}:${String(Math.floor((value % 60000) / 1000)).padStart(2, '0')}`;

  return (
    <main className={`iv-page ${captureMode ? 'is-capture' : ''}`} ref={pageRef} aria-label="FitPoly 서비스 소개 영상">
      <div className={`iv-stage tone-${beat.tone}`} ref={stageRef}>
        <div className={`mg-body scene-${beat.key}`} key={beat.key} style={{ '--scene-duration': `${beat.ms}ms` }}>
          {beat.render(elapsed)}
        </div>
      </div>

      {!captureMode && (
        <div className="iv-controls" role="group" aria-label="영상 재생 제어">
          <div className="iv-controls-heading"><span>FitPoly <i>소개 영상</i></span><span>{beat.label}</span></div>
          <div className="iv-controls-row">
          <button type="button" onClick={togglePlay} aria-label={playing ? '일시정지' : ms >= TOTAL ? '다시 재생' : '재생'} title="재생 / 일시정지 (Space)">{playing ? <Pause /> : <Play />}</button>
          <button type="button" onClick={() => { seek(0); setPlaying(true); }} aria-label="처음부터 재생" title="처음부터"><RotateCcw /></button>
          <input
            type="range" min={0} max={TOTAL} step={100} value={Math.round(ms)} aria-label="영상 재생 위치" aria-valuetext={`${clock(ms)} / ${clock(TOTAL)}`}
            style={{ '--progress': `${ms / TOTAL * 100}%` }} onChange={event => seek(Number(event.target.value))}
          />
          <span className="iv-time">{clock(ms)} <i>/ {clock(TOTAL)}</i></span>
          <button type="button" onClick={() => { setSound(value => !value); setNotice(''); }} aria-label={sound ? '배경음악 끄기' : '배경음악 켜기'} aria-pressed={sound} title={sound ? '음악 끄기' : '음악 켜기'}>{sound ? <Volume2 /> : <VolumeX />}</button>
          <a href="/video/fitpoly-intro.mp4" download="FitPoly-서비스소개.mp4" aria-label="소개 영상 MP4 다운로드" title="MP4 다운로드"><Download /></a>
          <button type="button" className="iv-fullscreen" aria-label="전체 화면 전환" title="전체 화면" onClick={async () => {
            try {
              if (document.fullscreenElement) await document.exitFullscreen();
              else if (pageRef.current?.requestFullscreen) await pageRef.current.requestFullscreen();
              else setNotice('이 브라우저는 전체 화면을 지원하지 않습니다.');
            } catch { setNotice('전체 화면으로 전환하지 못했습니다.'); }
          }}><Maximize /></button>
          </div>
          {notice && <p className="iv-notice" role="status">{notice}</p>}
        </div>
      )}
      {!captureMode && <audio ref={audioRef} src="/video/fitpoly-intro-music.mp3" preload="none" onError={() => { setSound(false); setNotice('배경음악을 불러오지 못했습니다.'); }} />}
    </main>
  );
}
