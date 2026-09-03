/**
 * /video — FitPoly 서비스 소개 영상 (16:9 · 약 68초)
 *
 * 모션그래픽 홍보영상 문법으로 짰다.
 *  - 컷을 2~4초로 잘게 나눈다 (한 컷 = 한 메시지)
 *  - 자막 바 대신 큰 카피가 화면의 주인공이고, 보조 설명만 아래에 작게 깐다
 *  - 컷이 바뀔 때 색 패널이 화면을 쓸고 지나가며 배경색 자체가 갈린다
 *  - 숫자는 카운트업, 아이콘·칩은 스프링으로 튀어 들어온다
 *
 * 녹화: frontend 를 띄운 뒤  backend 에서
 *   node scripts/capture-eng-reel.mjs --url=http://localhost:3000/video --width=1920 --height=1080 --scale=1 --fps=30 --out=fitpoly-intro.mp4
 * 캡처 계약은 /eng 와 같다 — window.__engReelDurationMs / window.__engSeek(ms)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import './SiteIntroVideo.css';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const easeOut = (t) => 1 - (1 - clamp01(t)) ** 3;
/* 캡처 시각만으로 값이 정해져야 프레임이 흔들리지 않는다 */
const countUp = (e, to, startMs = 0, durMs = 900, from = 0) => from + (to - from) * easeOut((e - startMs) / durMs);

const CHANNELS = [
  { src: '/brand-icons/kakaotalk.svg', name: '카카오톡' },
  { src: '/brand-icons/notion.svg', name: '노션' },
  { src: '/brand-icons/github.svg', name: '깃허브', dark: true },
  { src: '/brand-icons/google-drive.svg', name: '드라이브' },
  { src: '/brand-icons/pdf.svg', name: '발표 PDF' },
  { src: '/brand-icons/figma.svg', name: '피그마' },
];
const JOBS = ['개발', 'AI · ML', '데이터', '인프라', '보안', 'QA', '웹퍼블리셔', '기획 · PM', '디자인', '마케팅', '인사', '영업', '재무', '연구', '정책', '게임기획'];
const STANDARDS = ['O*NET', 'NACE', 'DORA', 'ISTQB', 'OWASP ASVS', 'NN/g'];

/* ── 화면 공통 조각 ── */
function Copy({ lines, sub }) {
  return (
    <div className="mg-copy">
      {lines.map((line, index) => (
        <p key={index} className="mg-line" style={{ animationDelay: `${120 + index * 130}ms` }}>
          {line}
        </p>
      ))}
      {sub && <p className="mg-copy-sub">{sub}</p>}
    </div>
  );
}

function Mock({ src, cap }) {
  return (
    <div className="mg-mock">
      <div className="mg-mock-bar"><i /><i /><i /><span>fitpoly.kr</span></div>
      <img src={src} alt="" />
      {cap && <p className="mg-mock-cap">{cap}</p>}
    </div>
  );
}

/* ── 컷 ── */
const BEATS = [
  {
    key: 'hook1', tone: 'dark', ms: 2800,
    render: () => <Copy lines={['경험은 분명', '많은데']} />,
  },
  {
    key: 'hook2', tone: 'dark', ms: 3000,
    render: () => (
      <>
        <Copy lines={['정리된 건', '하나도 없습니다']} />
        <div className="mg-fall">
          {CHANNELS.map((channel, index) => (
            <span key={channel.name} className={`mg-fall-item mg-fall-${index + 1}`} style={{ animationDelay: `${240 + index * 110}ms` }}>
              <img src={channel.src} alt="" />
            </span>
          ))}
        </div>
      </>
    ),
  },
  {
    key: 'survey', tone: 'light', ms: 3600,
    render: (e) => (
      <div className="mg-split">
        <Copy lines={['10명 중 6명은', '기록은 합니다']} sub="현장 설문 · 취준생 37명" />
        <div className="mg-bars">
          <div className="mg-bar">
            <span className="mg-bar-label">경험을 기록한다</span>
            <div className="mg-bar-track"><i style={{ width: `${62 * easeOut((e - 300) / 900)}%` }} /></div>
            <b>{Math.round(countUp(e, 62, 300, 900))}%</b>
          </div>
          <div className="mg-bar is-drop">
            <span className="mg-bar-label">다시 쓸 수 있게 정리한다</span>
            <div className="mg-bar-track"><i style={{ width: `${19.8 * easeOut((e - 1400) / 900)}%` }} /></div>
            <b>{countUp(e, 19.8, 1400, 900).toFixed(1)}%</b>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: 'drop', tone: 'dark', ms: 3000,
    render: (e) => (
      <div className="mg-center">
        <p className="mg-huge">{countUp(e, 80.2, 200, 1000).toFixed(1)}<em>%</em></p>
        <p className="mg-huge-sub">기록해 둔 사람의 대부분이<br /><b>쌓아두는 데서 멈춥니다</b></p>
      </div>
    ),
  },
  {
    key: 'channels', tone: 'light', ms: 3600,
    render: () => (
      <div className="mg-center">
        <div className="mg-chip-row">
          {CHANNELS.map((channel, index) => (
            <span key={channel.name} className={`mg-chip ${channel.dark ? 'is-dark' : ''}`} style={{ animationDelay: `${180 + index * 110}ms` }}>
              <img src={channel.src} alt="" />{channel.name}
            </span>
          ))}
        </div>
        <p className="mg-mid">기록은 평균 <b>5.4개 채널</b>에 흩어져 있습니다</p>
      </div>
    ),
  },
  {
    key: 'hours', tone: 'light', ms: 3200,
    render: (e) => (
      <div className="mg-center">
        <p className="mg-huge is-ink">{countUp(e, 3.2, 200, 800).toFixed(1)}<em>시간</em></p>
        <p className="mg-huge-sub is-ink">경험 <b>한 건</b>을 정리하는 데 드는 시간</p>
      </div>
    ),
  },
  {
    key: 'hours10', tone: 'dark', ms: 3000,
    render: (e) => (
      <div className="mg-center">
        <div className="mg-dots">
          {Array.from({ length: 10 }, (_, index) => (
            <i key={index} style={{ animationDelay: `${140 + index * 90}ms` }} />
          ))}
        </div>
        <p className="mg-huge is-gold">{Math.round(countUp(e, 32, 400, 1100))}<em>시간</em></p>
        <p className="mg-huge-sub">열 곳에 지원하면 그대로 반복됩니다</p>
      </div>
    ),
  },
  {
    key: 'tensec', tone: 'blue', ms: 3200,
    render: () => (
      <div className="mg-center">
        <p className="mg-huge">10<em>초</em></p>
        <p className="mg-huge-sub">그렇게 만든 서류를<br /><b>인사담당자가 판단하는 시간</b></p>
        <p className="mg-foot">공고 1건당 지원서 244건 · 직무 관련 경험 최우선 81.6%</p>
      </div>
    ),
  },
  {
    key: 'brand', tone: 'blue', ms: 3800,
    render: () => (
      <div className="mg-center">
        <img className="mg-logo" src="/video/fitpoly-mark.png" alt="" />
        <p className="mg-slogan">만드는 게 아니라<br /><em>뽑아냅니다</em></p>
      </div>
    ),
  },
  {
    key: 'step1', tone: 'light', ms: 3800, step: 0,
    render: () => (
      <div className="mg-split">
        <Copy lines={['정리하지 않은', '원본 그대로']} sub="카톡 대화 · 깃허브 커밋 · 노션 회고 · 발표 PDF" />
        <div className="mg-chip-grid">
          {CHANNELS.map((channel, index) => (
            <span key={channel.name} className={`mg-chip ${channel.dark ? 'is-dark' : ''}`} style={{ animationDelay: `${200 + index * 90}ms` }}>
              <img src={channel.src} alt="" />{channel.name}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    key: 'step2', tone: 'light', ms: 3800, step: 1,
    render: () => (
      <div className="mg-split">
        <Copy lines={['판단까지', '되살립니다']} sub="무엇을 보고 결정했고, 어떤 대안을 왜 버렸는지" />
        <div className="mg-tags">
          {['관찰', '판단', '대안', '검증', '잔여'].map((tag, index) => (
            <span key={tag} style={{ animationDelay: `${220 + index * 150}ms` }}>{tag}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    key: 'step3', tone: 'light', ms: 3800, step: 2,
    render: () => (
      <div className="mg-split">
        <Copy lines={['공고 링크 하나면', '순서가 바뀝니다']} sub="그 회사가 찾는 역량 순서로 다시 배열" />
        <div className="mg-url"><span>https://</span>jobkorea.co.kr/Recruit/GI_Read/…<i /></div>
      </div>
    ),
  },
  {
    key: 'step4', tone: 'light', ms: 3800, step: 3,
    render: () => (
      <div className="mg-split">
        <Copy lines={['그대로', '제출합니다']} sub="PDF · 공개 링크 · 이력서 문장" />
        <div className="mg-outs">
          {['PDF 산출물', '공개 링크', '이력서 문장'].map((item, index) => (
            <span key={item} style={{ animationDelay: `${200 + index * 160}ms` }}>{item}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    key: 'jobs', tone: 'light', ms: 3800,
    render: () => (
      <div className="mg-center">
        <p className="mg-mid">직군이 바뀌면 <b>인정되는 경험</b>도 바뀝니다</p>
        <div className="mg-job-chips">
          {JOBS.map((job, index) => (
            <span key={job} style={{ animationDelay: `${160 + index * 55}ms` }}>{job}</span>
          ))}
          <span className="is-more" style={{ animationDelay: '1080ms' }}>+8</span>
        </div>
        <p className="mg-foot is-ink">24개 직군마다 인정 기준을 따로 정의했습니다</p>
      </div>
    ),
  },
  {
    key: 'std', tone: 'dark', ms: 3600,
    render: (e) => (
      <div className="mg-center">
        <p className="mg-huge">{Math.round(countUp(e, 67, 300, 1000))}<em>%</em></p>
        <p className="mg-huge-sub">120개 평가 항목 중 <b>공인 표준에 직접 근거</b>하는 비율</p>
        <div className="mg-std">
          {STANDARDS.map((name, index) => (
            <span key={name} style={{ animationDelay: `${700 + index * 120}ms` }}>{name}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    key: 'label', tone: 'light', ms: 3400,
    render: () => (
      <div className="mg-center">
        <div className="mg-label-row">
          <span className="mg-label is-fact">사실</span>
          <span className="mg-label is-guess">추정</span>
        </div>
        <p className="mg-mid">올린 자료에서 찾은 근거와<br />모델이 메운 부분을 <b>문장마다 구분</b>합니다</p>
        <p className="mg-foot is-ink">넣지 않은 사실은 지어내지 않습니다</p>
      </div>
    ),
  },
  {
    key: 'output', tone: 'light', ms: 5400,
    render: (e) => {
      const shots = [
        { src: '/video/out-dev.jpg', cap: '개발자 · 경험정리 결과' },
        { src: '/video/pf-dev.jpg', cap: '김도윤 · 프론트엔드 개발자' },
        { src: '/video/pf-mkt.jpg', cap: '이수민 · 마케터' },
      ];
      const shot = shots[Math.min(shots.length - 1, Math.floor(e / 1800))];
      return (
        <div className="mg-center">
          <Mock key={shot.src} src={shot.src} cap={shot.cap} />
        </div>
      );
    },
  },
  {
    key: 'reuse', tone: 'blue', ms: 3600,
    render: () => (
      <div className="mg-center">
        <p className="mg-swap"><s>3.2시간</s><b>12분</b></p>
        <p className="mg-huge-sub">두 번째 지원부터는 <b>다시 쓰기만</b> 하면 됩니다</p>
      </div>
    ),
  },
  {
    key: 'cta', tone: 'navy', ms: 5200,
    render: () => (
      <div className="mg-center">
        <img className="mg-logo is-small" src="/video/fitpoly-mark.png" alt="" />
        <p className="mg-slogan is-cta">흩어진 기록을<br />그대로 올려 보세요</p>
        <p className="mg-url-big">fitpoly.kr</p>
        <p className="mg-foot">가입하면 1,000크레딧 무료 · 경험 정리부터 포트폴리오까지</p>
      </div>
    ),
  },
];

const TOTAL = BEATS.reduce((sum, beat) => sum + beat.ms, 0);
const STARTS = BEATS.reduce((acc, beat) => [...acc, acc[acc.length - 1] + beat.ms], [0]);
const STEP_LABELS = ['모으기', '뽑기', '맞추기', '완성'];

const locate = (ms) => {
  const t = ((ms % TOTAL) + TOTAL) % TOTAL;
  let index = 0;
  while (index < BEATS.length - 1 && t >= STARTS[index + 1]) index += 1;
  return { index, elapsed: t - STARTS[index] };
};

export default function SiteIntroVideo() {
  const captureMode = useMemo(() => new URLSearchParams(window.location.search).has('capture'), []);
  const [ms, setMs] = useState(0);
  const [playing, setPlaying] = useState(!captureMode);
  const msRef = useRef(0);
  const rafRef = useRef(null);
  const startedAt = useRef(0);

  const { index, elapsed } = locate(ms);
  const beat = BEATS[index];

  useEffect(() => { msRef.current = ms; }, [ms]);

  /* 1920×1080 좌표계로 그리고 화면에는 마지막에 scale 한 번만 건다 */
  useEffect(() => {
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
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    window.__engReelDurationMs = TOTAL;
    if (captureMode) {
      window.__engSeek = (value) => {
        const next = ((Number(value) || 0) % TOTAL + TOTAL) % TOTAL;
        setMs(next);
        msRef.current = next;
        return locate(next).elapsed;
      };
    }
    return () => {
      delete window.__engReelDurationMs;
      delete window.__engSeek;
    };
  }, [captureMode]);

  useEffect(() => {
    if (!playing || captureMode) return undefined;
    startedAt.current = performance.now() - msRef.current;
    const tick = (now) => {
      setMs((now - startedAt.current) % TOTAL);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, captureMode]);

  const clock = (value) => `${String(Math.floor(value / 60000)).padStart(2, '0')}:${String(Math.floor((value % 60000) / 1000)).padStart(2, '0')}`;

  return (
    <main className="iv-page">
      <div className={`iv-stage tone-${beat.tone}`}>
        <div className="mg-body" key={beat.key}>
          {beat.render(elapsed)}
          {/* 컷이 바뀔 때 색 패널이 화면을 한 번 쓸고 지나간다 */}
          <span className={`mg-wipe ${index % 2 ? 'is-alt' : ''}`} />
        </div>

        <div className="iv-brand">
          <img src="/video/fitpoly-mark.png" alt="" />
          <span>FitPoly</span>
        </div>

        {typeof beat.step === 'number' && (
          <div className="mg-steps">
            {STEP_LABELS.map((label, stepIndex) => (
              <span key={label} className={stepIndex === beat.step ? 'is-on' : ''}>
                {String(stepIndex + 1).padStart(2, '0')} {label}
              </span>
            ))}
          </div>
        )}

        <div className="iv-progress"><i style={{ width: `${(ms / TOTAL) * 100}%` }} /></div>
      </div>

      {!captureMode && (
        <div className="iv-controls">
          <button type="button" onClick={() => setPlaying(value => !value)}>{playing ? '일시정지' : '재생'}</button>
          <input
            type="range" min={0} max={TOTAL} step={100} value={Math.round(ms)}
            onChange={event => { const next = Number(event.target.value); setMs(next); msRef.current = next; startedAt.current = performance.now() - next; }}
          />
          <span>{clock(ms)} / {clock(TOTAL)}</span>
          <span className="iv-controls-scene">{index + 1}/{BEATS.length} · {beat.key}</span>
        </div>
      )}
    </main>
  );
}
