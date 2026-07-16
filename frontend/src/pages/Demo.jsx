import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Braces, Check, ChevronLeft, ChevronRight,
  Github, Link2, Pause, Play, RefreshCw, Sparkles, Upload,
} from 'lucide-react';
import './Demo.css';

const NAV = ['경험 선택', '자료 입력', 'AI 인터뷰', '결과 완성'];
const SCENES = [
  { eyebrow: 'STEP 01', title: '개발 경험을 선택합니다', caption: '직군을 고르면, 그 직군에 맞는 경험 구조로 정리를 시작해요.', duration: 3800 },
  { eyebrow: 'STEP 02', title: '흩어진 자료를 한곳에 모읍니다', caption: '문서와 GitHub를 연결하면 AI가 자료와 실제 기여를 함께 읽어요.', duration: 5200 },
  { eyebrow: 'STEP 03', title: '개발자의 핵심 경험이 완성됩니다', caption: '서비스 임팩트부터 문제 해결 기록까지, 채용 담당자가 읽기 좋은 흐름으로.', duration: 8200 },
  { eyebrow: 'DEEP DIVE 01', title: '커밋이 기여도의 근거가 됩니다', caption: '커밋 비중, 활동 흐름, 언어와 작업 유형을 한눈에 보여줘요.', duration: 4800 },
  { eyebrow: 'DEEP DIVE 02', title: '복잡한 구조도 한 장으로 설명합니다', caption: '기술 스택을 바탕으로 개발 구조와 프로젝트 흐름을 시각화해요.', duration: 5000 },
  { eyebrow: 'DEEP DIVE 03', title: '코드 변화가 문제 해결 경험이 됩니다', caption: '핵심 수정 코드와 의도, 결과를 함께 추출해 면접에서 설명할 수 있게 만들어요.', duration: 5600 },
];

function TopProgress({ step = 1 }) {
  return (
    <div className="demo-product-top">
      <div className="demo-stage-count">{step} / 4 단계</div>
      <div className="demo-product-nav">
        {NAV.map((item, index) => <span key={item} className={index + 1 <= step ? 'is-on' : ''}>{index + 1 < step && <Check size={10} />} {index + 1} {item}</span>)}
      </div>
      <div className="demo-product-line"><span style={{ width: `${step * 25}%` }} /></div>
    </div>
  );
}

function Guide({ children }) {
  return <div className="demo-guide"><span className="demo-guide-face">••</span><div><b>FitPoly 경험 가이드</b><p>{children}</p></div></div>;
}

function SceneSelect() {
  const cards = [
    ['공통 경험', '여러 역할이 섞인 경험을 기본 구조로 정리해요.', '⌂'],
    ['개발자', '기술 선택, 구현 과정, 트러블슈팅, 성능 개선을 보여줄 경험', '{ }'],
    ['마케팅', '타깃, 메시지, 채널, 성과 지표를 중심으로 정리할 경험', '↗'],
    ['기획 / PM', '문제 정의, 사용자 흐름, 우선순위와 출시 판단을 보여줄 경험', '▦'],
  ];
  return (
    <div className="demo-page demo-select-scene">
      <TopProgress step={1} />
      <div className="demo-select-body">
        <p className="demo-kicker">경험 정리</p>
        <h2>어떤 분야의 경험부터 정리해볼까요?</h2>
        <p className="demo-subcopy">가장 가까운 항목을 하나 선택해주세요.</p>
        <Guide>직군을 선택하면 역할과 성과가 가장 잘 드러나는 구조로 정리됩니다.</Guide>
        <div className="demo-job-grid">
          {cards.map(([name, desc, icon], index) => <div key={name} className={`demo-job-card ${index === 1 ? 'selected' : ''}`}><span className="demo-job-icon">{icon}</span>{index === 1 && <span className="demo-check"><Check size={13} /></span>}<b>{name}</b><p>{desc}</p>{index === 1 && <small>웹 서비스 개발 · API 설계 · 성능 최적화</small>}</div>)}
        </div>
        <button className="demo-primary demo-select-button">이 경험으로 시작하기 <ArrowRight size={15} /></button>
      </div>
    </div>
  );
}

function SceneMaterials() {
  return (
    <div className="demo-page demo-material-scene">
      <TopProgress step={2} />
      <div className="demo-material-grid">
        <section>
          <p className="demo-kicker">경험 정리 · 개발자</p>
          <h2>자료를 올리면 경험 조각을<br />먼저 정리해볼게요.</h2>
          <p className="demo-subcopy">파일, 링크, 짧은 메모 중 편한 방식으로 넣어주세요.</p>
          <Guide>GitHub 아이디를 함께 입력하면 내 커밋 기여도와 트러블슈팅까지 분석해드려요.</Guide>
        </section>
        <section className="demo-input-card">
          <h3>자료 입력</h3>
          <p>완벽한 문서가 아니어도 괜찮아요.</p>
          <div className="demo-upload-box"><Upload size={17} /><div><b className="demo-file-type">FitPoly_PRD.pdf</b><small>2.4MB · 업로드 완료 <Check size={11} /></small></div></div>
          <label>GitHub 리포지토리</label>
          <div className="demo-input-row is-filled"><Github size={14} /><span>https://github.com/fitpoly/app</span></div>
          <label>GitHub 사용자명</label>
          <div className="demo-input-row demo-typing"><span className="demo-typed">laonpl</span><i /></div>
          <label>기술 블로그 <em>(선택)</em></label>
          <div className="demo-input-row is-filled"><Link2 size={14} /><span>https://velog.io/@laonpl/fitpoly</span></div>
          <button className="demo-primary demo-draft-button"><Sparkles size={15} /> 이 자료로 초안 만들기</button>
        </section>
      </div>
    </div>
  );
}

const heat = [0,1,0,2,3,1,0,1,2,4,2,0,1,3,2,1,0,2,4,3,1,0,2,1,3,4,2,1,0,2,3,2,1,0,4,3,2,1,0,2,3,1,2,4,3,2,1,0,2,3,4,2,1,0,1,2,3,1,4,2,1,0,2,3,2,4,1,0,1,3,4,2,1,0,2,1,3,4,2,0,1,2,3,2,1,0,4,3,2,1,0];

function GithubPanel({ focused = false }) {
  return (
    <div className={`demo-github-panel ${focused ? 'is-focused' : ''}`}>
      <div className="demo-git-heading"><span>기여도 · 영향력</span><small>2026-04-13 ~ 2026-07-14</small></div>
      <div className="demo-git-numbers"><div><strong>47.8%</strong><span>커밋 기여 비중</span></div><div><b>160 <i>/ 335</i></b><span>내 커밋 / 전체</span></div><div><b>풀스택</b><span>주 역할</span></div></div>
      <div className="demo-contribution"><span style={{ width: '47.8%' }} /></div>
      <div className="demo-langs"><i />JavaScript 97.9% <i />HTML 1.7% <i />CSS 0.3%</div>
      <p className="demo-mini-title">커밋 활동</p>
      <div className="demo-heatmap">{heat.map((value, index) => <i key={index} data-v={value} />)}</div>
      <div className="demo-commit-types">{[['fix',60],['chore',34],['etc',24],['feat',16],['refactor',10]].map(([label,value]) => <div key={label}><code>{label}</code><span><i style={{ width: `${value / .6}%` }} /></span><b>{value}</b></div>)}</div>
    </div>
  );
}

function MiniArchitecture() {
  return (
    <div className="demo-mini-arch">
      <svg viewBox="0 0 620 310" aria-hidden="true">
        <defs><marker id="miniArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#6f8eaf" /></marker></defs>
        <path d="M310 64V105" /><path d="M310 153L188 204" /><path d="M310 153L432 204" /><path d="M188 250L285 278" /><path d="M432 250L335 278" />
      </svg>
      <div className="demo-mini-node mini-browser"><b>User's Browser</b><span>Web</span></div>
      <div className="demo-mini-node mini-api"><b>FitPoly API</b><span>Backend API</span></div>
      <div className="demo-mini-node mini-ai"><b>AI Structuring Engine</b><span>AI / ML</span></div>
      <div className="demo-mini-node mini-verify"><b>Verification Engine</b><span>Evidence Check</span></div>
      <div className="demo-mini-node mini-db"><b>Experience Master DB</b><span>Firestore</span></div>
    </div>
  );
}

function SceneResult() {
  return (
    <div className="demo-page demo-result-scene">
      <div className="demo-result-toolbar"><span>← 경험 목록</span><b>핵심 경험</b><span>자세히 보기</span><button>저장됨</button></div>
      <div className="demo-auto-scroll">
        <div className="demo-result-document">
          <aside><p className="demo-kicker">핵심 경험 리포트</p><h2>FitPoly</h2><GithubPanel /></aside>
          <main>
            <div className="demo-impact-title"><h3>개발 임팩트</h3><span><Github size={12} /> laonpl/popol</span></div>
            <section className="demo-project-intro"><h5>PROJECT · 서비스 소개</h5><h2>FitPoly</h2><p className="demo-project-tagline">흩어진 경험을 모아, 회사와 직무에 맞는 포트폴리오로 가공해주는 AI 커리어 서비스</p></section>
            <section className="demo-project-block"><h3>문제 정의</h3><p>취업 준비생은 하나의 포트폴리오를 만드는 데 평균 40시간 이상을 사용하고, 지원 기업마다 문서를 다시 구성해야 했습니다. 하지만 실제 프로젝트 자료는 GitHub, Notion, 발표 자료와 개인 메모에 흩어져 있어 자신이 해결한 문제와 기여도를 빠르게 찾아내기 어려웠습니다.</p><p>기존 생성형 AI 도구는 결과 문장을 만들어주지만 사실·추정·가정을 구분하지 않아, 사용자가 면접에서 근거를 설명하기 어렵고 직무별 핵심 역량도 일관되게 드러나지 않는 문제가 있었습니다.</p></section>
            <section className="demo-project-block"><h3>해결 방법</h3><p>파일과 GitHub 활동에서 경험을 추출한 뒤 문제–행동–성과 구조로 검증하고, 채용 담당자가 이해하기 쉬운 직무 언어로 변환하는 파이프라인을 설계했습니다. 원본 자료와 코드 변경 내역을 경험 단위로 연결해 모든 문장이 실제 근거를 갖도록 구성했습니다.</p><p>검증된 경험은 Experience Master DB에 축적해 포트폴리오, 면접 답변, 지원서에 반복 활용할 수 있게 했으며, 직군별 전용 시각화로 핵심 임팩트를 빠르게 탐색할 수 있도록 구현했습니다.</p></section>
            <section className="demo-project-section"><h5>주요 성과</h5><div className="demo-table demo-unified-table"><p><b>경험 1건 + AI 구조화 완료율</b><span>62% → 84%</span></p><p><b>1인 평균 핵심 경험 작성 수</b><span>1.8건 → 3.4건</span></p><p><b>포트폴리오 초안 제작 시간</b><span>40시간 → 6시간</span></p><p><b>D7 재방문율</b><span>22% → 37%</span></p></div></section>
            <section className="demo-project-section"><h5>핵심 기능</h5><div className="demo-table demo-feature-table"><p><b>경험 자동 추출</b><span>파일·GitHub·Notion 자료에서 역할과 문제 해결 경험을 구조적으로 추출</span></p><p><b>근거 검증</b><span>사실·추정·가정을 구분하고 문장별 원본 자료와 코드 근거를 연결</span></p><p><b>직군별 AI 구조화</b><span>개발·기획·마케팅 등 직군 평가 기준에 맞춰 경험의 강조점을 재구성</span></p><p><b>Experience Master DB</b><span>검증된 경험을 포트폴리오·면접·지원서에서 재사용 가능한 형태로 관리</span></p></div></section>
            <h5>시스템 아키텍처</h5><MiniArchitecture />
            <h5>문제 해결 기록</h5>
            <div className="demo-story-card demo-story-rich"><div className="demo-story-title"><b>대용량 문서 업로드 안정화</b><span>UPLOAD PIPELINE</span></div><p>분석 요청과 파일 저장 단계를 분리해 한 단계가 실패해도 초안 생성을 계속하고, 실패한 파일만 다시 처리할 수 있도록 개선했습니다.</p><div className="demo-code-mini"><span>+ const uploaded = await uploadDocumentFile(file);</span><br /><span>+ collectedDeliverables.push({`{ name, url, size }`});</span><br /><span>+ deliverables: materialDeliverablesRef.current</span></div><p className="demo-code-result">부분 실패 복구 · 산출물 URL 보존 · 재시도 범위 축소</p></div>
            <div className="demo-story-card demo-story-rich"><div className="demo-story-title"><b>AI 응답의 신뢰도 개선</b><span>EVIDENCE FIRST</span></div><p>변경 코드와 커밋 유형, 원본 저장소를 하나의 문제 해결 기록으로 연결해 주장과 실제 근거를 함께 확인할 수 있게 했습니다.</p><div className="demo-code-mini"><span>+ evidence: gitExperience.codeChanges</span><br /><span>+ repository: githubStats.repoName</span></div><p className="demo-code-result">검증 가능한 개발 경험 · 면접 설명력 강화</p></div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SceneGithub() {
  return <div className="demo-page demo-focus-scene"><div className="demo-focus-backdrop" /><div className="demo-focus-label"><Github size={18} /><span><b>GitHub 기여도 분석</b><small>말이 아닌 실제 커밋으로 증명하는 개발 임팩트</small></span></div><GithubPanel focused /></div>;
}

function ArchitectureDiagram() {
  return (
    <div className="demo-architecture-canvas">
      <svg viewBox="0 0 800 510" aria-hidden="true">
        <defs><marker id="demoArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#88a0bd" /></marker></defs>
        <path className="demo-flow-line l1" d="M400 92 L400 166" /><path className="demo-flow-line l2" d="M380 234 L240 305" /><path className="demo-flow-line l3" d="M420 234 L560 305" /><path className="demo-flow-line l4" d="M240 367 L380 430" /><path className="demo-flow-line l5" d="M560 367 L420 430" />
      </svg>
      <div className="demo-node n-browser"><b>User's Browser</b><span>Web</span></div>
      <div className="demo-node n-api"><b>FitPoly API</b><span>Backend API</span></div>
      <div className="demo-node n-ai"><b>AI Structuring Engine</b><span>AI / ML</span></div>
      <div className="demo-node n-verify"><b>Verification Engine</b><span>Backend Logic</span></div>
      <div className="demo-node n-db"><b>Experience Master DB</b><span>Database</span></div>
    </div>
  );
}

function SceneArchitecture() {
  return <div className="demo-page demo-architecture-scene"><div className="demo-arch-head"><div><p className="demo-kicker">ARCHITECTURE</p><h2>개발 구조에서 프로젝트 흐름까지</h2></div><div className="demo-tabs"><b>개발 구조</b><span>프로젝트 흐름</span></div></div><ArchitectureDiagram /><div className="demo-arch-pulse p1">요청 수집</div><div className="demo-arch-pulse p2">AI 구조화</div><div className="demo-arch-pulse p3">근거 검증</div></div>;
}

const CODE_ONE = [
  ['const diagramsPromise = extractDiagrams(material).catch((e) => {', ''],
  ["  console.warn('[extract-product] diagram.async failed', e.message);", ''],
  ['  return { architectureDiagram: null, flowDiagram: null };', ''],
  ['});', ''],
  ['', ''],
  ['const [product, diagrams] = await Promise.all([extractProduct(materialText), diagramsPromise]);', 'add'],
  ['res.json({ product, architectureDiagram: diagrams.architectureDiagram || null });', 'add'],
];
const CODE_TWO = [
  ['const uploadDoc = multer({', ''],
  ['  storage: multer.memoryStorage(),', ''],
  ['  limits: { fileSize: 25 * 1024 * 1024 },', ''],
  ['  fileFilter: (req, file, cb) => {', ''],
  ["    if (DOC_EXT.test(file.originalname || '')) cb(null, true);", 'add'],
  ["    else cb(new Error('지원하는 산출물 파일만 올려주세요'));", 'add'],
  ['  },', ''],
  ['});', ''],
];

function CodeWindow({ file, lines, delay = 0 }) {
  return <div className="demo-code-window" style={{ '--code-delay': `${delay}ms` }}><div className="demo-code-title"><span><i /><i /><i /></span><code>{file}</code><b>JS</b></div><pre>{lines.map(([line, type], index) => <span key={index} className={type}><i>{index + 1}</i><code>{line || ' '}</code></span>)}</pre></div>;
}

function SceneCode() {
  return <div className="demo-page demo-code-scene"><div className="demo-code-head"><div><p className="demo-kicker">CODE EVIDENCE</p><h2>수정 코드를 경험의 근거로</h2></div><div className="demo-code-badge"><Braces size={15} /> 2개 핵심 변경 추출</div></div><div className="demo-code-layout demo-code-layout-site"><section><CodeWindow file="backend/src/routes/experience.js" lines={CODE_ONE} /><div className="demo-site-code-desc"><b>비동기 실패 격리</b><p>아키텍처 추출이 실패하면 전체 API 응답이 중단되던 흐름을 작업별 fallback 구조로 변경했습니다.</p><div><span><small>변경 전</small>분석 하나가 실패하면 전체 결과 반환 중단</span><ArrowRight size={13} /><span><small>변경 후</small>성공한 product 결과는 정상 반환</span></div></div></section><section><CodeWindow file="backend/src/routes/upload.js" lines={CODE_TWO} delay={500} /><div className="demo-site-code-desc"><b>업로드 입력 경계 검증</b><p>허용 확장자와 파일 크기를 업로드 진입점에서 검증해 불필요한 분석 요청을 사전에 차단했습니다.</p><div><span><small>변경 전</small>잘못된 파일도 분석 단계까지 진입</span><ArrowRight size={13} /><span><small>변경 후</small>즉시 차단하고 명확한 오류 반환</span></div></div></section></div></div>;
}

const SCENE_COMPONENTS = [SceneSelect, SceneMaterials, SceneResult, SceneGithub, SceneArchitecture, SceneCode];

export default function Demo() {
  const [scene, setScene] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [runKey, setRunKey] = useState(0);
  const current = SCENES[scene];
  const Scene = SCENE_COMPONENTS[scene];
  const progress = Math.min(100, (elapsed / current.duration) * 100);

  useEffect(() => {
    if (!playing) return undefined;
    const started = performance.now() - elapsed;
    const timer = window.setInterval(() => {
      const nextElapsed = performance.now() - started;
      if (nextElapsed >= current.duration) {
        setScene(value => (value + 1) % SCENES.length);
        setElapsed(0);
        setRunKey(value => value + 1);
      } else setElapsed(nextElapsed);
    }, 50);
    return () => window.clearInterval(timer);
  }, [scene, playing, runKey]); // current duration follows scene

  const go = next => {
    setScene((next + SCENES.length) % SCENES.length);
    setElapsed(0);
    setRunKey(value => value + 1);
  };
  const totalProgress = useMemo(() => ((scene + progress / 100) / SCENES.length) * 100, [scene, progress]);

  return (
    <main className="demo-root">
      <header className="demo-header"><a href="/" className="demo-brand"><span>F</span> FitPoly</a><div><span>개발자 경험이 포트폴리오가 되는 순간</span><b>PRODUCT TOUR</b></div></header>
      <section className="demo-player">
        <div className="demo-browser">
          <div className="demo-browser-bar"><span><i /><i /><i /></span><div>fitpoly.kr/experience</div><b>FitPoly</b></div>
          <div key={`${scene}-${runKey}`} className={`demo-scene scene-${scene + 1}`}><Scene /></div>
        </div>
      </section>
      <footer className="demo-controls">
        <div className="demo-total-progress"><span style={{ width: `${totalProgress}%` }} /></div>
        <button onClick={() => go(scene - 1)} aria-label="이전 장면"><ChevronLeft size={18} /></button>
        <button className="demo-play" onClick={() => setPlaying(value => !value)} aria-label={playing ? '일시정지' : '재생'}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <button onClick={() => go(scene + 1)} aria-label="다음 장면"><ChevronRight size={18} /></button>
        <div className="demo-dots">{SCENES.map((item, index) => <button key={item.title} onClick={() => go(index)} className={index === scene ? 'active' : ''} aria-label={`${index + 1}번 장면`}><span style={index === scene ? { width: `${progress}%` } : undefined} /></button>)}</div>
        <button onClick={() => go(0)} aria-label="처음부터"><RefreshCw size={16} /></button>
      </footer>
    </main>
  );
}
