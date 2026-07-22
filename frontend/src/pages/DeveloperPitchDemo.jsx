import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCode2,
  FileText,
  Folder,
  Github,
  Image as ImageIcon,
  MessageSquare,
  MoreHorizontal,
  Network,
  PanelLeft,
  PenLine,
  Play,
  Search,
  Star,
  UploadCloud,
  X,
} from 'lucide-react';
import { CodeSnippet } from '../components/portfolio/GitInsights';

const DEMO_STEPS = [
  {
    key: 'attention',
    label: 'GitHub를 채용 언어로',
    short: '오프닝',
    duration: 3400,
    caption: '커밋 345개를 채용 언어로 바꾸는 법',
    guide: 'GitHub 기록이 포트폴리오의 성과와 기여 근거로 바뀝니다.',
  },
  {
    key: 'github-pain',
    label: '쌓여 있는 GitHub 기록',
    short: 'GitHub 기록',
    duration: 4600,
    caption: '커밋은 계속 쌓이는데, 이걸 언제 다시 보면서 정리하지?',
    guide: '성과가 될 커밋과 PR을 다시 찾는 데만 시간이 듭니다.',
  },
  {
    key: 'files-pain',
    label: '흩어진 파일 찾기',
    short: '파일 찾기',
    duration: 4600,
    caption: '회고, 캡처, 기획서… 정리하려고 파일 찾다가 또 포기합니다.',
    guide: '폴더마다 흩어진 자료를 찾다 보면 경험 정리는 시작도 못 합니다.',
  },
  {
    key: 'create',
    label: '새 경험 추가',
    short: '경험 추가',
    duration: 3200,
    caption: '새 경험 추가에서 흩어진 개발 기록을 하나의 프로젝트로 모으기 시작합니다.',
    guide: '먼저 정리할 경험을 새로 만듭니다.',
  },
  {
    key: 'role',
    label: '개발자 선택',
    short: '직군 선택',
    duration: 3200,
    caption: '개발자를 선택하면 기술 선택, 트러블슈팅, 성능 개선에 맞춘 분석 흐름이 열립니다.',
    guide: '직군에 맞는 질문과 결과 구조를 자동으로 준비합니다.',
  },
  {
    key: 'sources',
    label: '개발 자료 연결',
    short: '자료 연결',
    duration: 4600,
    caption: '회고 문서 한 개와 GitHub 저장소만 연결하면 충분합니다. AI가 기록 사이의 근거를 함께 읽습니다.',
    guide: '문서의 맥락과 Git 기록의 객관적인 근거를 함께 연결합니다.',
  },
  {
    key: 'pipeline',
    label: '근거 분석',
    short: 'AI 분석',
    duration: 6200,
    caption: '문서, 커밋, 코드 변경점을 빠르게 교차 분석해 실제 기여와 구현 이유를 찾습니다.',
    guide: 'AI가 지어내지 않고 확인 가능한 기록을 근거 단위로 정리합니다.',
  },
  {
    key: 'overview',
    label: '결과 요약',
    short: '결과 요약',
    duration: 3600,
    caption: '127개 커밋에서 핵심 경험 3개와 기술 역량 6개가 성과 중심으로 정리됐습니다.',
    guide: '채용 담당자가 먼저 봐야 할 숫자와 기여 범위를 한눈에 보여줍니다.',
  },
  {
    key: 'commits',
    label: '커밋 스토리',
    short: 'Git 커밋',
    duration: 4600,
    caption: '커밋 수만 세지 않습니다. 내가 바꾼 파일과 해결한 문제까지 연결해 실제 기여 범위를 보여줍니다.',
    guide: '전체 커밋 중 내 변경 비중과 핵심 코드 근거를 함께 보여줍니다.',
  },
  {
    key: 'review',
    label: '코드 선택 근거',
    short: '코드 근거',
    duration: 4600,
    caption: '코드만 보여주는 것이 아니라 이 코드를 왜 썼는지와 어떤 문제를 해결했는지까지 경험으로 정리합니다.',
    guide: '핵심 로직과 구현 이유·효과를 함께 보여줘 개발 판단을 설명합니다.',
  },
  {
    key: 'architecture',
    label: '아키텍처 시각화',
    short: '아키텍처',
    duration: 5200,
    caption: '저장소 구조와 문서 내용을 바탕으로 시스템 구성과 데이터 흐름을 읽기 쉬운 아키텍처로 만듭니다.',
    guide: '복잡한 구조를 면접에서 설명할 수 있는 한 장의 다이어그램으로 바꿉니다.',
  },
  {
    key: 'complete',
    label: '개발자 포트폴리오 완성',
    short: '완성',
    duration: 5200,
    caption: '흩어진 개발 기록이 5분 만에 하나의 경험정리로 완성됩니다.',
    guide: 'GitHub와 문서를 연결하면 설명 가능한 개발 경험이 빠르게 완성됩니다.',
  },
];

// 공감형 카피 + 시선이 쏠릴 키워드(hl)만 하이라이트로 강조한다.
const REEL_CAPTIONS = {
  'github-pain': [{ t: '커밋은 매일 쌓이는데', hl: '매일' }, { t: '포트폴리오는 아직도 백지', hl: '백지' }],
  'files-pain': [{ t: '회고·캡처·기획서 다 흩어졌고', hl: '흩어졌고' }, { t: '찾다 지쳐서 또 포기', hl: '포기' }],
  create: [{ t: '“쓸 만한 경험이 없다”고요?', hl: '경험이 없다' }, { t: '정리를 안 했을 뿐입니다', hl: '정리를 안 했을 뿐' }],
  role: [{ t: '개발자 직군만 딱 고르면', hl: '개발자' }, { t: '분석 기준이 통째로 바뀝니다', hl: '통째로' }],
  sources: [{ t: '회고 PDF 하나 + GitHub 하나', hl: 'GitHub' }, { t: '흩어진 기록을 통째로 긁어옵니다', hl: '통째로' }],
  pipeline: [{ t: '커밋 수백 개를 알아서 훑고', hl: '수백 개' }, { t: '근거까지 싹 정리합니다', hl: '근거까지' }],
  overview: [{ t: '백지였던 포트폴리오가', hl: '백지' }, { t: '단 한 화면으로 완성', hl: '한 화면' }],
  commits: [{ t: '전체 345개 중 내 커밋 179개', hl: '179개' }, { t: '기여 비중 51.9% + 핵심 변경까지', hl: '핵심 변경' }],
  review: [{ t: '“이 코드를 왜 썼는지”까지', hl: '왜 썼는지' }, { t: '그대로 면접 답변이 됩니다', hl: '면접 답변' }],
  architecture: [{ t: '복잡한 저장소 구조도', hl: '복잡한' }, { t: '설명 가능한 한 장으로', hl: '한 장' }],
  complete: [{ t: '흩어진 개발 기록이', hl: '흩어진' }, { t: '단 5분 만에 포트폴리오로', hl: '5분' }],
};

const DEMO_GIT_PROJECTS = [
  {
    project_name: '경험 구조화·검증 파이프라인 개발',
    period: '2026.04 — 2026.07',
    core_tech_stack: 'React, JavaScript, Node.js, Express, Firebase, Gemini API',
    problem_definition: ['경험 데이터가 여러 화면과 저장 단계에 분산되어 결과 화면마다 내용이 달라지는 문제', 'GitHub 분석 결과와 사용자 답변의 저장 순서가 엇갈리면 일부 근거가 누락되는 문제'],
    action_and_solution: ['경험 저장 결과를 단일 소스로 삼고 케이스 스터디 동기화 순서를 명시', '커밋·코드 변경·트러블슈팅을 경험 단위로 병합하는 파이프라인 구현'],
    core_impact: '커밋 345개 중 본인 기여 179개를 식별하고 코드 근거가 포함된 핵심 경험으로 자동 변환',
    code_snippets: [{ file: 'frontend/src/stores/experienceStore.js', code: "- await saveExperience(payload)\n+ const result = await saveExperience(payload)\n+ await syncCaseStudy(result.id)\n+ return result", why: '저장 완료 후 동기화가 실행되도록 순서를 보장해 결과 화면의 데이터 누락을 막았습니다.' }],
    troubleshooting: ['Firestore 전파 지연 시 네비게이션 state를 초기값으로 사용하고 저장 결과와 재동기화'],
    learning: ['AI 결과의 품질만큼 저장·동기화 순서를 검증 가능한 구조로 만드는 것이 중요했습니다.'],
  },
];

const DEMO_DAILY_ACTIVITY = Array.from({ length: 112 }, (_, index) => {
  const date = new Date(2026, 3, 1 + index);
  const wave = [0, 2, 0, 4, 1, 3, 0, 5, 2, 1, 0, 3, 4, 0][index % 14];
  return {
    d: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    count: index % 9 === 0 ? 0 : wave,
  };
});

const DEMO_RESULT_STATS = {
  repoName: 'laonpl/popol',
  myCommits: 179,
  contributionPct: 51.9,
  totalCommits: 345,
  activePeriod: { first: '2026-04-16', last: '2026-07-16' },
  languages: [
    { name: 'JavaScript', pct: 98.1 },
    { name: 'HTML', pct: 1.6 },
    { name: 'CSS', pct: 0.3 },
    { name: 'PowerShell', pct: 0.1 },
  ],
  commitTypes: [
    { type: 'feat', count: 84 },
    { type: 'fix', count: 46 },
    { type: 'refactor', count: 28 },
    { type: 'docs', count: 13 },
    { type: 'test', count: 8 },
  ],
  dailyActivity: DEMO_DAILY_ACTIVITY,
};

const DEMO_ARCHITECTURE = {
  nodes: [
    { id: 'client', label: 'React Client', tech: 'Experience UI', tier: 0 },
    { id: 'api', label: 'Express API', tech: 'Node.js', tier: 1 },
    { id: 'engine', label: 'Experience Engine', tech: 'Gemini API', tier: 2 },
    { id: 'github', label: 'GitHub Analyzer', tech: 'Commits · Code', tier: 2 },
    { id: 'db', label: 'Firebase', tech: 'Experience DB', tier: 3 },
  ],
  edges: [
    { from: 'client', to: 'api', label: '자료 전송' },
    { from: 'api', to: 'engine', label: '경험 구조화' },
    { from: 'api', to: 'github', label: '근거 분석' },
    { from: 'engine', to: 'db', label: '결과 저장' },
    { from: 'github', to: 'db', label: '기여 근거' },
  ],
};

const DEMO_RESULT_EXPERIENCE = {
  id: 'fitpoly-demo',
  title: '졸프',
  jobCategory: 'dev',
  structuredResult: {
    jobCategory: 'dev',
    intro: '흩어진 경험을 모아, 회사에 맞는 맞춤형 포트폴리오로 가공해주는 서비스',
    githubStats: DEMO_RESULT_STATS,
    projectOverview: {
      name: 'FitPoly',
      summary: '흩어진 경험을 모아, 회사에 맞는 맞춤형 포트폴리오로 가공해주는 서비스',
      role: '풀스택',
      duration: '2026-04-16 ~ 2026-07-16',
      techStack: ['JavaScript', 'React', 'Node.js', 'Express', 'Firebase', 'Gemini API'],
    },
    product: {
      name: 'FitPoly',
      tagline: '흩어진 경험을 모아, 회사에 맞는 맞춤형 포트폴리오로 가공해주는 서비스',
      problem: '취준생은 포트폴리오 제작에 평균 40시간 이상을 쓰지만, 어떤 경험을 어떻게 정리해야 하는지 몰라 공고마다 수정과 재편집을 반복합니다. 반면 인사담당자는 짧은 시간 안에 직무 적합성과 핵심 역량이 바로 보이기를 원합니다.',
      solution: '경험을 새로 만드는 것이 아니라 흩어진 기록에서 추출하고 검증해 채용 언어로 전환합니다. 질문 기반 경험 구조화와 GitHub 근거 분석을 결합해 하나의 경험을 포트폴리오·자기소개서·면접 답변으로 재사용할 수 있게 합니다.',
      outcomes: [
        { label: '커밋 분석', value: '345개 중 본인 커밋 179개 식별' },
        { label: '기여 비중', value: '51.9% · 저장소 기여 1위' },
      ],
      features: [
        { name: '경험 구조화', desc: '질문 흐름으로 문제·행동·결과·배운 점을 추출' },
        { name: 'GitHub 근거 분석', desc: '커밋·코드 변경·트러블슈팅·기여도를 교차 분석' },
        { name: '맞춤 결과물', desc: '기업과 직무에 맞춰 경험을 채용 결과물로 변환' },
      ],
    },
    architectureDiagram: DEMO_ARCHITECTURE,
    keyExperiences: [
      { title: '경험 구조화 엔진 개발', result: '질문 기반 경험 추출과 GitHub 근거 분석을 하나의 흐름으로 통합' },
      { title: '포트폴리오 생성 파이프라인', result: '직군별 결과 화면과 내보내기 구조 구현' },
    ],
    gitAnalysis: {
      repoName: 'laonpl/popol',
      experiences: DEMO_GIT_PROJECTS,
    },
  },
};

const PIPELINE_ITEMS = [
  { label: '회고 문서 구조화', detail: '역할 · 문제 · 행동 · 결과 분리', Icon: FileText },
  { label: 'Git 저장소 연결', detail: '127 commits · 14 PRs 확인', Icon: Github },
  { label: '기여 코드 추적', detail: '핵심 변경 파일 23개 식별', Icon: FileCode2 },
  { label: '코드 선택 근거화', detail: '핵심 로직의 선택 이유와 효과 추출', Icon: MessageSquare },
  { label: '아키텍처 매핑', detail: '서비스 경계와 데이터 흐름 생성', Icon: Network },
];

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function Spotlight({ active, pointer = false, children, className = '' }) {
  return (
    <div
      className={cx(
        'relative transition-all duration-300',
        active
          ? 'z-20 opacity-100 ring-4 ring-primary-100 shadow-[0_18px_50px_rgba(0,47,108,0.16)]'
          : 'z-0 opacity-25',
        active && pointer && 'eng-demo-click-target',
        className,
      )}
    >
      {children}
      {active && <span className="pointer-events-none absolute -inset-px rounded-[inherit] border border-primary-300/80" />}
      {active && pointer && (
        <span className="eng-demo-click-ripple pointer-events-none absolute left-1/2 top-1/2 z-30 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary-500" />
      )}
    </div>
  );
}

const GITHUB_COMMITS = [
  ['f3a91c2', 'feat: onboarding state machine 도입', 'minseo-dev', '2 days ago'],
  ['c91d7b4', 'perf: analytics bundle 지연 로딩', 'minseo-dev', '4 days ago'],
  ['2bb74af', 'test: add transition regression cases', 'minseo-dev', 'last week'],
  ['8e41aa0', 'fix: duplicate session request 방지', 'minseo-dev', 'last week'],
  ['52b3d14', 'refactor: split analytics event dispatcher', 'minseo-dev', '2 weeks ago'],
  ['a83df29', 'docs: update onboarding event taxonomy', 'minseo-dev', '2 weeks ago'],
  ['7d19ee4', 'feat: persist interrupted signup state', 'jiyun-k', '3 weeks ago'],
  ['914f0ea', 'fix: handle expired onboarding session', 'minseo-dev', '3 weeks ago'],
  ['c181f22', 'chore: migrate tracking event constants', 'minseo-dev', 'last month'],
  ['1e7ca08', 'feat: add web-vitals dashboard events', 'minseo-dev', 'last month'],
];

function AttentionScreen() {
  return (
    <div className="eng-demo-cover relative flex h-full flex-col overflow-hidden px-7 pb-8 pt-7 text-white">
      <div className="pointer-events-none absolute -right-28 -top-24 h-80 w-80 rounded-full bg-[#c7ff4a]/[0.12] blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-32 -left-28 h-96 w-96 rounded-full bg-[#3b82f6]/[0.15] blur-[110px]" />

      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[10px] font-black text-[#0b0f0e]">FP</span>
          <div>
            <p className="text-[11px] font-black tracking-[-0.02em]">FitPoly</p>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/[0.45]">for developers</p>
          </div>
        </div>
        <span className="rounded-full border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[8px] font-extrabold uppercase tracking-[0.16em] text-white/[0.65]">GitHub → Portfolio</span>
      </header>

      <div className="relative z-10 mt-[72px]">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#c7ff4a] px-3 py-1.5 text-[10px] font-black text-[#10150e]">
          취준 개발자라면 잠깐
        </div>
        <h1 className="mt-5 text-[45px] font-black leading-[1.06] tracking-[-0.065em] sm:text-[51px]">
          커밋 345개를<br />
          <span className="text-[#c7ff4a]">채용 언어로</span><br />
          바꾸는 법
        </h1>
        <p className="mt-5 text-[14px] font-semibold leading-[1.65] tracking-[-0.025em] text-white/60">GitHub만 연결하면 내가 한 일과<br />기여 근거가 포트폴리오가 됩니다.</p>
      </div>

      <div className="relative z-10 mt-8 rounded-[26px] border border-white/10 bg-white/[0.055] p-3.5 shadow-[0_30px_80px_rgba(0,0,0,0.34)] backdrop-blur-sm">
        <div className="grid grid-cols-[1fr_34px_1fr] items-stretch gap-2">
          <div className="rounded-[18px] border border-white/[0.08] bg-[#111816] p-4">
            <div className="flex items-center gap-2 text-[9px] font-extrabold text-white/[0.55]"><Github size={13} /> GITHUB RECORD</div>
            <p className="mt-7 text-[30px] font-black leading-none tracking-[-0.05em]">345</p>
            <p className="mt-2 text-[9px] font-bold text-white/40">commits · 127 files</p>
            <div className="mt-5 flex h-8 items-end gap-1">
              {[40, 72, 48, 88, 58, 100, 70, 92, 50, 78].map((height, index) => <span key={index} className="flex-1 rounded-[2px] bg-white/[0.15]" style={{ height: `${height}%` }} />)}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#c7ff4a]/30 bg-[#c7ff4a]/10 text-[14px] font-black text-[#c7ff4a]">→</span>
          </div>

          <div className="rounded-[18px] bg-[#f4f7f2] p-4 text-[#121713]">
            <div className="flex items-center justify-between text-[9px] font-extrabold"><span>FITPOLY RESULT</span><CheckCircle2 size={13} className="text-emerald-600" /></div>
            <p className="mt-7 text-[30px] font-black leading-none tracking-[-0.05em]">51.9%</p>
            <p className="mt-2 text-[9px] font-bold text-black/[0.45]">실제 기여 비중</p>
            <div className="mt-5 space-y-1.5">
              <span className="block h-1.5 w-full rounded-full bg-black/[0.08]"><span className="block h-full w-[78%] rounded-full bg-[#155eef]" /></span>
              <div className="flex gap-1.5"><span className="rounded-full bg-[#dce8ff] px-2 py-1 text-[7px] font-black text-[#155eef]">핵심 경험 3</span><span className="rounded-full bg-[#e5f5d1] px-2 py-1 text-[7px] font-black text-[#3e6416]">구조도 완성</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between border-t border-white/10 pt-5">
        <p className="text-[10px] font-bold leading-[1.5] text-white/[0.48]">3초 뒤,<br /><span className="text-white/80">만드는 과정 공개</span></p>
        <span className="flex items-center gap-2 rounded-full bg-white py-2 pl-4 pr-2 text-[10px] font-black text-[#101310] shadow-[0_10px_35px_rgba(0,0,0,0.2)]">과정 보기 <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c7ff4a]"><Play size={12} fill="currentColor" /></span></span>
      </div>
    </div>
  );
}

function GitHubPainScreen({ progress }) {
  const scrollY = Math.round(40 + progress * 310);
  return (
    <div className="relative h-full overflow-hidden bg-[#d8dee4] p-3 sm:p-5">
      <div className="mx-auto h-full max-w-[1280px] overflow-hidden rounded-xl border border-[#afb8c1] bg-white shadow-[0_24px_70px_rgba(31,35,40,0.28)]">
        <div className="flex h-9 items-center gap-2 border-b border-[#30363d] bg-[#161b22] px-3 text-white">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="mx-auto flex h-6 w-[54%] items-center rounded-md bg-[#0d1117] px-3 font-mono text-[10px] text-[#8b949e]">github.com/minseo-dev/flowdesk-web/commits/main</div>
        </div>
        <div className="flex h-12 items-center gap-4 bg-[#24292f] px-5 text-white">
          <Github size={25} fill="currentColor" />
          <div className="flex h-8 min-w-0 flex-1 max-w-[340px] items-center gap-2 rounded-md border border-[#57606a] bg-[#24292f] px-3 text-[12px] text-[#c9d1d9]"><Search size={13} /> Type / to search</div>
          <span className="ml-auto text-[11px] font-semibold">Pull requests</span><span className="hidden text-[11px] font-semibold sm:inline">Issues</span><span className="hidden text-[11px] font-semibold sm:inline">Marketplace</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6e7681] text-[9px] font-bold">M</span>
        </div>
        <div className="border-b border-[#d0d7de] bg-[#f6f8fa] px-5 pt-4">
          <div className="flex items-center gap-2 text-[15px] text-[#0969da]"><Github size={16} /><span>minseo-dev</span><span className="text-[#57606a]">/</span><b>flowdesk-web</b><span className="rounded-full border border-[#d0d7de] px-2 py-0.5 text-[9px] font-semibold text-[#57606a]">Public</span></div>
          <div className="mt-4 flex gap-1 overflow-hidden text-[11px] text-[#24292f]">
            {['Code', 'Issues 12', 'Pull requests 4', 'Actions', 'Projects', 'Security', 'Insights'].map((tab, i) => <span key={tab} className={cx('whitespace-nowrap border-b-2 px-3 pb-2 font-semibold', i === 0 ? 'border-[#fd8c73]' : 'border-transparent')}>{tab}</span>)}
          </div>
        </div>
        <div className="relative h-[calc(100%-132px)] overflow-hidden">
          <div className="absolute left-0 right-0 px-5 py-5 transition-transform duration-100" style={{ transform: `translateY(-${scrollY}px)` }}>
            <div className="mx-auto max-w-[980px]">
              <div className="mb-4 flex items-center justify-between">
                <div><h1 className="text-[21px] font-semibold text-[#1f2328]">Commits</h1><p className="mt-1 text-[11px] text-[#656d76]">Branch <b>main</b> · 276 commits</p></div>
                <button className="rounded-md border border-[#d0d7de] bg-[#f6f8fa] px-3 py-1.5 text-[11px] font-semibold text-[#24292f]">main⌄</button>
              </div>
              {['Jun 28, 2025', 'Jun 19, 2025', 'May 30, 2025'].map((date, groupIndex) => (
                <div key={date} className="mb-5 overflow-hidden rounded-md border border-[#d0d7de]">
                  <div className="border-b border-[#d0d7de] bg-[#f6f8fa] px-4 py-2 text-[11px] font-semibold text-[#57606a]">Commits on {date}</div>
                  {GITHUB_COMMITS.slice(groupIndex * 3, groupIndex * 3 + 4).map(([hash, title, author, ago]) => (
                    <div key={hash} className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#d8dee4] px-4 py-3 last:border-0">
                      <div className="min-w-0"><p className="truncate text-[12px] font-semibold text-[#1f2328]">{title}</p><p className="mt-1 text-[10px] text-[#656d76]"><b>{author}</b> committed {ago}</p></div>
                      <div className="flex items-center gap-2"><code className="text-[10px] text-[#0969da]">{hash}</code><button className="rounded border border-[#d0d7de] p-1 text-[#57606a]"><FileCode2 size={12} /></button></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-4 right-4 rounded-full bg-[#24292f]/90 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg">스크롤 중 · 커밋 127개</div>
        </div>
      </div>
    </div>
  );
}

const EXPLORER_FILES = [
  ['folder', '프로젝트_최종', '2025-06-29 오후 11:42', '파일 폴더', ''],
  ['folder', '포트폴리오_자료', '2025-06-20 오전 1:18', '파일 폴더', ''],
  ['pdf', '온보딩_개선_회고_진짜최종.pdf', '2025-06-28 오후 10:31', 'Microsoft Edge PDF', '2,418KB'],
  ['doc', '성과정리_최종_최종2.docx', '2025-06-27 오전 2:07', 'Microsoft Word 문서', '184KB'],
  ['image', '가입완료율_대시보드_캡처.png', '2025-06-26 오후 9:55', 'PNG 파일', '1,204KB'],
  ['code', '커밋_정리할것.txt', '2025-06-18 오후 11:13', '텍스트 문서', '12KB'],
  ['image', '스크린샷 2025-05-19 231842.png', '2025-05-19 오후 11:18', 'PNG 파일', '842KB'],
  ['doc', '트러블슈팅_메모.docx', '2025-05-12 오전 12:44', 'Microsoft Word 문서', '91KB'],
  ['pdf', 'FlowDesk_기획서_v7.pdf', '2025-04-30 오후 5:21', 'Microsoft Edge PDF', '8,721KB'],
  ['image', 'before_after_수정본.png', '2025-04-12 오전 1:06', 'PNG 파일', '2,012KB'],
];

function ExplorerFileIcon({ type }) {
  if (type === 'folder') return <Folder size={17} fill="#f7c948" className="text-[#e7aa18]" />;
  if (type === 'image') return <ImageIcon size={17} className="text-[#087ea4]" />;
  if (type === 'code') return <FileCode2 size={17} className="text-[#64748b]" />;
  return <FileText size={17} className={type === 'pdf' ? 'text-[#d83b01]' : 'text-[#185abd]'} />;
}

function FilesPainScreen({ progress }) {
  const activeRow = Math.min(EXPLORER_FILES.length - 1, Math.floor(progress * EXPLORER_FILES.length));
  return (
    <div className="relative h-full overflow-hidden bg-[#dfe7ef] p-3 sm:p-5">
      <div className="mx-auto flex h-full max-w-[1280px] flex-col overflow-hidden rounded-xl border border-[#aeb8c2] bg-white shadow-[0_24px_70px_rgba(30,41,59,0.28)]">
        <div className="flex h-10 items-center bg-[#f3f3f3] px-3">
          <div className="flex h-8 min-w-[210px] items-center gap-2 rounded-t-lg bg-white px-3 text-[11px] text-[#202020]"><Folder size={14} fill="#f7c948" className="text-[#e7aa18]" /> 포트폴리오 자료 <X size={12} className="ml-auto" /></div>
          <span className="ml-2 text-[18px] text-[#555]">+</span><MoreHorizontal size={15} className="ml-auto" />
        </div>
        <div className="flex h-12 items-center gap-2 border-b border-[#ddd] px-3 text-[#3b3b3b]">
          <ArrowLeft size={16} /><ArrowRight size={16} className="text-[#aaa]" /><ArrowUp size={16} />
          <div className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-md border border-[#d5d5d5] bg-[#fafafa] px-3 text-[11px]"><span>내 PC</span><ChevronRight size={12} /><span>문서</span><ChevronRight size={12} /><span className="font-semibold">포트폴리오 자료</span></div>
          <div className="flex h-8 w-[26%] min-w-[160px] items-center gap-2 rounded-md border border-[#d5d5d5] px-3 text-[11px] text-[#777]"><Search size={13} /> 포트폴리오 자료 검색</div>
        </div>
        <div className="flex h-11 items-center gap-5 border-b border-[#e7e7e7] px-4 text-[11px]"><span className="font-semibold">새로 만들기⌄</span><span>✂</span><span>복사</span><span>붙여넣기</span><span className="hidden sm:inline">이름 바꾸기</span><span className="hidden sm:inline">정렬⌄</span><MoreHorizontal size={15} /></div>
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[190px] flex-shrink-0 border-r border-[#eee] bg-[#fafafa] px-3 py-3 sm:block">
            {[[Star, '홈'], [PanelLeft, '갤러리'], [Clock3, '최근 항목'], [Folder, '바탕 화면'], [Folder, '다운로드'], [Folder, '문서'], [Folder, '사진'], [Github, 'GitHub']].map(([Icon, label], i) => <div key={label} className={cx('mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-[11px]', i === 5 ? 'bg-[#e8e8e8] font-semibold' : 'text-[#333]')}><Icon size={14} />{label}</div>)}
          </aside>
          <div className="min-w-0 flex-1 overflow-hidden px-3 py-2">
            <div className="grid grid-cols-[minmax(240px,1.4fr)_1fr_1fr_90px] border-b border-[#e5e5e5] px-2 py-1.5 text-[10.5px] text-[#555]"><span>이름</span><span>수정한 날짜</span><span>유형</span><span>크기</span></div>
            <div className="transition-transform duration-150" style={{ transform: `translateY(-${Math.max(0, activeRow - 6) * 34}px)` }}>
              {EXPLORER_FILES.map(([type, name, date, kind, size], index) => (
                <div key={name} className={cx('grid h-[34px] grid-cols-[minmax(240px,1.4fr)_1fr_1fr_90px] items-center rounded px-2 text-[10.5px]', index === activeRow ? 'bg-[#cce8ff] ring-1 ring-inset ring-[#99d1ff]' : 'hover:bg-[#f2f2f2]')}>
                  <span className="flex min-w-0 items-center gap-2"><ExplorerFileIcon type={type} /><span className="truncate">{name}</span></span><span className="truncate text-[#555]">{date}</span><span className="truncate text-[#555]">{kind}</span><span className="text-[#555]">{size}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="h-7 border-t border-[#e5e5e5] px-4 py-1 text-[10px] text-[#666]">10개 항목 · 파일을 찾는 중…</div>
      </div>
    </div>
  );
}

function ProductHeader() {
  return (
    <header className="relative z-[80] h-14 flex-shrink-0 border-b border-surface-200 bg-white">
      <div className="grid h-full grid-cols-[52px_1fr_52px] items-center px-3">
        <img src="/logo.png" alt="FitPoly" className="h-7 w-7 object-contain" />
        <nav className="mx-auto flex items-center rounded-full bg-surface-100 p-0.5 shadow-inner">
          <span className="whitespace-nowrap rounded-full bg-primary-600 px-4 py-1.5 text-[11px] font-extrabold text-white shadow-sm">경험 정리</span>
          <span className="whitespace-nowrap px-4 py-1.5 text-[11px] font-bold text-bluewood-400">포트폴리오</span>
        </nav>
        <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-[11px] font-black text-white ring-2 ring-surface-100">ㅇ</span>
      </div>
    </header>
  );
}

function EmptyExperienceScreen({ active }) {
  return (
    <div className="mx-auto h-full max-w-[1320px] px-5 py-6 sm:px-8 sm:py-8">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-gray-900 sm:text-[34px]">경험 정리</h1>
          <p className="mt-2 text-[14px] font-medium text-gray-500 sm:text-[16px]">지금까지 <span className="text-[18px] font-bold text-primary-600">6</span>개의 경험을 정리했어요.</p>
        </div>
        <Spotlight active={active} pointer className="rounded-xl">
          <button className="flex items-center rounded-xl bg-primary-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm shadow-primary-600/20 sm:px-5 sm:py-3 sm:text-[15px]">
            + 새 경험 추가
          </button>
        </Spotlight>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200">
        {['타임라인', '목록', '대시보드', '프로필'].map((item, index) => (
          <span key={item} className={cx('relative px-3.5 pb-3 pt-1 text-[14px] font-bold', index === 0 ? 'text-primary-700' : 'text-gray-400')}>
            {item}{index === 0 && <span className="absolute -bottom-px left-2 right-2 h-[2.5px] rounded-full bg-primary-600" />}
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ['2025. 06', '검색 결과 응답속도 개선', 'React · 성능 최적화', '84%'],
          ['2025. 03', '결제 이탈 구간 개선', '기획 / PM', '71%'],
          ['2024. 11', '디자인 시스템 구축', '프로덕트 디자인', '78%'],
        ].map(row => (
          <div key={row[1]} className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-[12px] font-bold text-primary-600">{row[0]}</span><span className="text-[11px] font-bold text-bluewood-300">{row[3]}</span></div>
            <p className="mt-4 text-[15px] font-bold leading-snug text-gray-900">{row[1]}</p>
            <p className="mt-1 text-[12.5px] text-gray-400">{row[2]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleSelectionScreen({ active }) {
  const roles = [
    { key: 'common', label: '공통', detail: '역할·행동·성과를 중심으로 경험을 정리합니다.' },
    { key: 'dev', label: '개발자', detail: '기술 스택·아키텍처, 트러블슈팅, 코드 최적화 성과' },
    { key: 'pm', label: '기획 / PM', detail: '문제 정의·우선순위·의사결정 근거와 제품 성과' },
    { key: 'marketing', label: '마케팅', detail: '타깃·채널·캠페인 지표와 전환 성과' },
  ];

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-5 pb-24 pt-6 sm:px-8 sm:pt-8">
      <div className="mb-5 rounded-2xl border border-primary-100 bg-white px-5 py-5 shadow-sm">
        <p className="mb-2 text-[12px] font-black uppercase tracking-[0.22em] text-primary-500">New Experience · Step 1 of 3</p>
        <h1 className="text-[24px] font-black leading-tight tracking-[-0.02em] text-bluewood-950">기본 정보</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-bluewood-500">프로젝트의 기본 정보와 직군을 선택해주세요. 직군에 맞는 분석 구조가 자동으로 적용됩니다.</p>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-white px-5 shadow-sm">
        <div className="grid gap-2 border-b border-surface-100 py-5 md:grid-cols-[200px_1fr]">
          <div className="flex items-start gap-2"><span className="mt-0.5 text-[15px] font-bold text-bluewood-200">01</span><div><p className="text-[11px] font-semibold text-bluewood-700">프로젝트명 <span className="text-red-400">*</span></p><p className="mt-0.5 text-[11px] text-bluewood-300">경험을 대표하는 이름</p></div></div>
          <div className="border-b-2 border-primary-300 py-1.5 text-[15px] font-semibold text-primary-600">FlowDesk 온보딩 구조 개선</div>
        </div>
        <div className="grid gap-2 border-b border-surface-100 py-5 md:grid-cols-[200px_1fr]">
          <div className="flex items-start gap-2"><span className="mt-0.5 text-[15px] font-bold text-bluewood-200">02</span><div><p className="text-[11px] font-semibold text-bluewood-700">진행 기간 <span className="text-red-400">*</span></p><p className="mt-0.5 text-[11px] text-bluewood-300">시작일과 종료일</p></div></div>
          <div className="flex max-w-sm gap-3 text-[14px] font-semibold text-primary-600"><span className="flex-1 border-b-2 border-surface-200 py-1.5">2025년 3월</span><span className="py-1.5 text-bluewood-200">—</span><span className="flex-1 border-b-2 border-surface-200 py-1.5">2025년 6월</span></div>
        </div>
        <div className="grid gap-2 py-6 md:grid-cols-[200px_1fr]">
          <div className="flex items-start gap-2 pt-0.5"><span className="mt-0.5 text-[15px] font-bold text-bluewood-200">03</span><div><p className="text-[11px] font-semibold text-bluewood-700">직군 선택 <span className="text-red-400">*</span></p><p className="mt-0.5 text-[11px] text-bluewood-300">1개 선택</p></div></div>
          <div className="divide-y divide-surface-50">
            {roles.map(({ key, label, detail }) => (
              <Spotlight key={key} active={active && key === 'dev'} pointer={key === 'dev'} className="rounded-lg">
                <button className="group flex w-full items-center gap-2 bg-white py-2 text-left">
                  <span className={cx('flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center rounded-full border-2 transition-all', key === 'dev' ? 'border-primary-600 bg-primary-600' : 'border-surface-300')}>
                    {key === 'dev' && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1"><span className={cx('block text-[13px] font-semibold leading-tight', key === 'dev' ? 'text-primary-600' : 'text-bluewood-600')}>{label}</span><span className="mt-0.5 block text-[11px] leading-snug text-bluewood-300">{detail}</span></span>
                </button>
              </Spotlight>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceInputScreen({ active }) {
  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-5 pb-24 pt-6 sm:px-8 sm:pt-8">
      <div className="mb-5 rounded-2xl border border-primary-100 bg-white px-5 py-5 shadow-sm">
        <p className="mb-2 text-[12px] font-black uppercase tracking-[0.22em] text-primary-500">Data Collection · Step 2 of 3</p>
        <h1 className="text-[24px] font-black leading-tight tracking-[-0.02em] text-bluewood-950">자료 수집</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-bluewood-500">파일, 링크, 텍스트 중 하나 이상을 추가하면 AI가 핵심 경험을 추출합니다.</p>
      </div>

      <div className="space-y-5">
        <Spotlight active={active} className="rounded-2xl">
          <div className="grid gap-5 rounded-2xl border border-sky-300 border-l-4 border-l-sky-600 bg-sky-50/40 p-5 shadow-sm md:grid-cols-[200px_1fr]">
            <div className="flex items-start gap-3 pt-0.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm"><Github size={15} /></span>
              <div><p className="text-[14px] font-extrabold text-bluewood-950">GitHub 연동 <span className="align-middle text-[10px] font-bold text-sky-600">추천</span></p><p className="mt-1 text-[12px] text-bluewood-500">커밋 자동 분석 → 초안 생성</p></div>
            </div>
            <div className="space-y-3">
              <div className="eng-demo-field-focus flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2.5"><Github size={13} className="flex-shrink-0 text-sky-500" /><span className="flex-1 text-[14px] text-bluewood-900">https://github.com/minseo-dev/flowdesk-web</span></div>
              <div className="eng-demo-field-focus flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2"><span className="text-[12px] font-bold text-sky-500">@</span><span className="flex-1 text-[12px] text-bluewood-800">minseo-dev</span></div>
              <p className="text-[12px] leading-relaxed text-bluewood-500">아이디를 입력하면 <strong className="text-sky-700">내 커밋만</strong> 골라 문제정의·코드변경·트러블슈팅·기술스택을 추출합니다.</p>
            </div>
          </div>
        </Spotlight>

        <Spotlight active={active} pointer className="rounded-2xl">
          <div className="grid gap-5 rounded-2xl border border-primary-100 border-l-4 border-l-primary-600 bg-white p-5 shadow-sm md:grid-cols-[200px_1fr]">
            <div className="flex items-start gap-3 pt-0.5"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-[12px] font-black text-white shadow-sm">01</span><div><p className="text-[14px] font-extrabold text-bluewood-950">파일 첨부</p><p className="mt-1 text-[12px] text-bluewood-500">PDF · 이미지 · 최대 10개</p></div></div>
            <div>
              <div className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-primary-400 bg-primary-50/70 px-5 py-5 text-bluewood-600">
                <UploadCloud size={18} className="text-primary-500" />
                <p className="text-[13px] font-bold">클릭하거나 파일을 여기에 끌어오세요</p><p className="text-[12px] text-bluewood-400">PDF, JPG, PNG, WEBP · 최대 25MB</p>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary-100 bg-primary-50/30 px-3 py-2"><CheckCircle2 size={12} className="flex-shrink-0 text-emerald-500" /><p className="flex-1 truncate text-[12px] font-semibold text-bluewood-800">온보딩_개선_회고.pdf</p><span className="text-[11px] text-bluewood-500">2.4 MB</span></div>
            </div>
          </div>
        </Spotlight>
      </div>

      <div className="mt-6 flex justify-end border-t border-surface-100 pt-6">
        <button className="eng-demo-button-press inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-[12px] font-semibold text-white">AI 경험 추출 <ChevronRight size={12} /></button>
      </div>
    </div>
  );
}

function PipelineScreen({ progress }) {
  const activeIndex = Math.min(PIPELINE_ITEMS.length - 1, Math.floor(progress * PIPELINE_ITEMS.length));
  const percentage = Math.min(100, Math.round(progress * 100));
  return (
    <div className="mx-auto h-full max-w-3xl px-8 pt-14 sm:pt-20">
      <p className="mb-6 text-[15px] font-bold uppercase tracking-[0.22em] text-bluewood-200">AI Analysis · Processing</p>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-primary-600 sm:text-[30px]">핵심 경험 추출 중</h2>
        <span className="text-[24px] font-bold tabular-nums text-primary-600">{percentage}<span className="ml-1 text-[15px] font-normal text-bluewood-300">%</span></span>
      </div>
      <div className="mb-9 h-[3px] w-full overflow-hidden bg-surface-100"><div className="h-full bg-primary-600 transition-all duration-700 ease-out" style={{ width: `${percentage}%` }} /></div>

      <div className="mb-6 flex items-center gap-2"><span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-bluewood-200 border-t-bluewood-500" /><span className="text-[11px] font-semibold text-bluewood-700">{PIPELINE_ITEMS[activeIndex]?.label}</span></div>

      <div className="divide-y divide-surface-100">
        {PIPELINE_ITEMS.map(({ label, detail, Icon }, index) => {
          const done = index < activeIndex;
          const current = index === activeIndex;
          return (
            <div
              key={label}
              className="flex items-center gap-2 py-2 transition-all duration-300"
            >
              <span className="flex w-5 flex-shrink-0 items-center justify-center">{done ? <Check size={11} className="text-emerald-500" strokeWidth={2.5} /> : current ? <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-bluewood-200 border-t-bluewood-500" /> : <span className="h-2 w-2 rounded-full bg-surface-300" />}</span>
              <span className={cx('text-[11px] transition-all', current ? 'font-semibold text-primary-600' : done ? 'text-bluewood-400 line-through decoration-surface-300' : 'text-bluewood-200')}>{label}</span>
              <span className={cx('hidden text-[10px] sm:inline', current ? 'text-bluewood-400' : 'text-bluewood-200')}>· {detail}</span>
              {done && <span className="ml-auto text-[11px] font-bold text-emerald-500">완료</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-9 text-[11px] leading-relaxed text-bluewood-200">자료량에 따라 최대 5분 소요 · 페이지 이탈 시 분석이 중단됩니다</p>
    </div>
  );
}

const DEMO_GRASS_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

function DemoCommitGrass({ days }) {
  const shown = days.slice(-112);
  const weeks = Array.from({ length: 16 }, (_, week) => shown.slice(week * 7, week * 7 + 7));
  const max = Math.max(1, ...shown.map(day => day.count || 0));
  return (
    <div>
      <div className="flex pl-[26px] text-[9.5px] text-bluewood-300"><span className="w-[52px]">4월</span><span className="w-[52px]">5월</span><span className="w-[52px]">6월</span><span>7월</span></div>
      <div className="mt-1.5 flex gap-[3px]">
        <div className="flex w-[23px] flex-col gap-[3px]">{['', '월', '', '수', '', '금', ''].map((label, index) => <span key={index} className="h-[10px] text-right text-[9px] leading-[10px] text-bluewood-300">{label}</span>)}</div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, dayIndex) => {
              const count = week[dayIndex]?.count || 0;
              const level = count <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
              return <span key={dayIndex} className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: DEMO_GRASS_COLORS[level] }} />;
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10.5px] text-bluewood-300">분석된 최근 커밋 150개 기준</span><span className="flex items-center gap-1 text-[10px] text-bluewood-300">적음 {DEMO_GRASS_COLORS.map(color => <span key={color} className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: color }} />)} 많음</span></div>
    </div>
  );
}

function DemoGitHeroCard() {
  const maxType = Math.max(...DEMO_RESULT_STATS.commitTypes.map(item => item.count));
  const languageColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3"><h3 className="text-[11.5px] font-black uppercase tracking-[0.16em] text-bluewood-400">기여도 · 영향력</h3><span className="text-[11px] tabular-nums text-bluewood-300">2026-04-16 ~ 2026-07-16</span></div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div><p className="text-[34px] font-black leading-none tracking-tight text-primary-700">51.9%</p><p className="mt-1.5 text-[11.5px] font-semibold text-bluewood-400">커밋 기여 비중</p></div>
        <div><p className="text-[20px] font-extrabold leading-none text-bluewood-900">179<span className="text-[13px] font-semibold text-bluewood-400"> / 345</span></p><p className="mt-1.5 text-[11px] text-bluewood-400">내 커밋 / 전체</p></div>
        <div><p className="text-[20px] font-extrabold leading-none text-bluewood-900">풀스택</p><p className="mt-1.5 text-[11px] text-bluewood-400">주 역할</p></div>
      </div>
      <div className="mt-4"><div className="h-2 w-full overflow-hidden rounded-full bg-surface-100"><div className="h-full w-[51.9%] rounded-full bg-primary-700" /></div><p className="mt-1.5 text-[11px] text-bluewood-300">내 커밋 179 / 전체 345 · GitHub 기여자 통계(기본 브랜치) 기준</p></div>
      <div className="mt-5"><div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full">{DEMO_RESULT_STATS.languages.map((item, index) => <span key={item.name} className="rounded-full" style={{ width: `${item.pct}%`, backgroundColor: languageColors[index] }} />)}</div><div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">{DEMO_RESULT_STATS.languages.map((item, index) => <span key={item.name} className="inline-flex items-center gap-1.5 text-[11.5px] text-bluewood-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: languageColors[index] }} />{item.name} <span className="text-bluewood-300">{item.pct}%</span></span>)}</div></div>
      <div className="mt-6"><p className="mb-2.5 text-[11px] font-bold text-bluewood-400">커밋 활동</p><DemoCommitGrass days={DEMO_RESULT_STATS.dailyActivity} /></div>
      <div className="mt-6"><p className="mb-2 text-[11px] font-bold text-bluewood-400">커밋 유형</p><div className="space-y-1.5">{DEMO_RESULT_STATS.commitTypes.map(item => <div key={item.type} className="flex items-center gap-2.5 text-[11.5px]"><span className="w-16 flex-shrink-0 font-mono text-bluewood-500">{item.type}</span><div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-100"><div className="h-full rounded-full bg-primary-700" style={{ width: `${(item.count / maxType) * 100}%` }} /></div><span className="w-9 text-right font-semibold text-bluewood-700">{item.count}</span></div>)}</div></div>
    </div>
  );
}

function DemoFactTable({ title, rows }) {
  return (
    <div><h3 className="mb-2.5 text-[11.5px] font-black uppercase tracking-[0.16em] text-bluewood-400">{title}</h3><div className="overflow-hidden rounded-xl border border-surface-200"><table className="w-full border-collapse text-[13px]"><tbody>{rows.map(row => <tr key={row[0]} className="border-b border-surface-100 last:border-0"><td className="w-[34%] border-r border-surface-100 bg-surface-50/50 px-3 py-2 align-top font-bold text-bluewood-800">{row[0]}</td><td className="px-3 py-2 leading-[1.6] text-bluewood-600">{row[1]}</td></tr>)}</tbody></table></div></div>
  );
}

function PitchArchitectureMap() {
  const Node = ({ eyebrow, title, detail, tone = 'blue', wide = false }) => {
    const tones = {
      blue: 'border-primary-300 bg-primary-50 text-primary-800',
      cyan: 'border-cyan-300 bg-cyan-50 text-cyan-900',
      violet: 'border-violet-300 bg-violet-50 text-violet-900',
      slate: 'border-slate-300 bg-white text-bluewood-900',
    };
    return (
      <div className={cx('rounded-xl border-2 px-5 py-3.5 text-center shadow-sm', tones[tone], wide && 'mx-auto w-[76%]')}>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-55">{eyebrow}</p>
        <p className="mt-1 text-[18px] font-black leading-tight">{title}</p>
        <p className="mt-1 text-[11.5px] font-semibold opacity-60">{detail}</p>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-primary-100 bg-[linear-gradient(145deg,#f8fbff_0%,#f1f7ff_55%,#fbfdff_100%)] px-6 py-5">
      <Node eyebrow="사용자 화면" title="React Client" detail="경험 입력 · 결과 확인" tone="blue" wide />
      <div className="mx-auto flex h-10 w-px items-center justify-center bg-primary-200"><span className="rounded-full bg-white px-2 py-0.5 text-[12px] font-black text-primary-500 shadow-sm">↓</span></div>
      <Node eyebrow="API GATEWAY" title="Express API" detail="인증 · 요청 분기 · 데이터 검증" tone="slate" wide />
      <div className="mx-auto flex h-10 items-center justify-center text-[12px] font-black text-primary-500">↙ <span className="mx-5 rounded-full bg-primary-600 px-3 py-1 text-[10px] tracking-wide text-white">AI + GIT 교차 분석</span> ↘</div>
      <div className="grid grid-cols-2 gap-4">
        <Node eyebrow="경험 맥락" title="Experience Engine" detail="문서 · 답변 구조화" tone="cyan" />
        <Node eyebrow="코드 근거" title="GitHub Analyzer" detail="커밋 · 변경 파일 분석" tone="violet" />
      </div>
      <div className="mx-auto flex h-10 items-center justify-center text-[12px] font-black text-primary-500">↘ <span className="mx-5 rounded-full bg-white px-3 py-1 text-[10px] tracking-wide text-bluewood-400 shadow-sm">검증된 결과 저장</span> ↙</div>
      <Node eyebrow="SINGLE SOURCE" title="Firebase" detail="경험 · 근거 · 포트폴리오 데이터" tone="blue" wide />
    </div>
  );
}

function ArchitectureFocusScreen() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_85%_5%,#dbeafe_0%,transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-5 pb-24 pt-28">
      <div className="mx-auto w-full max-w-[500px]">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-primary-600 px-3 py-1.5 text-[10px] font-black tracking-[0.14em] text-white">REPOSITORY → SYSTEM MAP</span>
          <span className="text-[10px] font-extrabold text-primary-500">자동 생성 완료 ✓</span>
        </div>
        <h1 className="mt-5 text-[30px] font-black leading-[1.08] tracking-[-0.055em] text-bluewood-950">코드 목록이 아니라<br />설명 가능한 구조로.</h1>
        <p className="mt-3 text-[13px] font-semibold leading-[1.65] text-bluewood-500">호출 관계와 문서 맥락을 함께 분석해<br />면접에서 바로 설명할 수 있는 한 장을 만듭니다.</p>

        <div className="mt-6 rounded-[22px] border-2 border-primary-300 bg-white p-3 shadow-[0_24px_70px_rgba(0,47,108,0.2)] ring-8 ring-white/55">
          <PitchArchitectureMap />
        </div>

      </div>
    </div>
  );
}

function DemoDevImpactSection({ architectureRef, architectureFocus = false }) {
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between gap-3"><h2 className="text-[15px] font-extrabold text-bluewood-900">개발 임팩트</h2><span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-bluewood-300"><Github size={12} /> laonpl/popol · 다시 분석</span></div>
      <div className="border-t border-surface-200 pt-5"><div className="space-y-8">
        <div>
          <div className="mb-1 flex items-baseline justify-between"><h3 className="text-[11.5px] font-black uppercase tracking-[0.16em] text-bluewood-400">프로젝트 소개</h3><span className="text-[11px] text-bluewood-300">노션형 편집 · 우클릭 서식</span></div>
          <div className="px-2 py-2"><h3 className="text-[17px] font-extrabold text-bluewood-900">FitPoly</h3><p className="mt-2 text-[13px] leading-[1.75] text-bluewood-600">흩어진 경험을 모아, 회사에 맞는 맞춤형 포트폴리오로 가공해주는 서비스</p><h3 className="mt-5 text-[17px] font-extrabold text-bluewood-900">문제 정의</h3><p className="mt-2 text-[13px] leading-[1.85] text-bluewood-600">취준생의 73%가 포트폴리오 제작에 평균 40시간 이상을 소요하며, 무엇을 보여줘야 할지 막막해 공고마다 수정·재편집을 반복합니다. 반면 인사담당자는 짧은 시간 안에 직무 적합성과 핵심 역량이 바로 보이기를 원합니다.</p><h3 className="mt-5 text-[17px] font-extrabold text-bluewood-900">해결 방법</h3><p className="mt-2 text-[13px] leading-[1.85] text-bluewood-600">경험을 새로 생성하는 것이 아니라 추출하고 검증해 채용 언어로 전환합니다. 질문 기반 구조화와 GitHub 근거 분석으로 하나의 경험을 여러 채용 결과물에 재사용할 수 있게 합니다.</p></div>
        </div>
        <DemoFactTable title="주요 성과" rows={[["커밋 분석", "345개 중 본인 커밋 179개 식별"], ["기여 비중", "51.9% · 저장소 기여 1위"]]} />
        <DemoFactTable title="핵심 기능" rows={[["경험 구조화", "질문 흐름으로 문제·행동·결과를 추출"], ["GitHub 근거 분석", "커밋·코드 변경·트러블슈팅·기여도를 교차 분석"], ["맞춤 결과물", "기업과 직무에 맞춰 경험을 채용 결과물로 변환"]]} />
        <div ref={architectureRef} className={cx('transition-all duration-500', architectureFocus && 'rounded-[22px] border-2 border-primary-300 bg-white p-5 shadow-[0_22px_70px_rgba(0,47,108,0.2)] ring-8 ring-primary-50')}>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-600">SYSTEM MAP · AUTO GENERATED</p>
              <h3 className="mt-1.5 text-[21px] font-black tracking-[-0.035em] text-bluewood-950">한 장으로 보는 서비스 구조</h3>
              <p className="mt-1 text-[12px] font-medium text-bluewood-400">저장소의 호출 관계와 경험 문서의 맥락을 함께 분석했습니다.</p>
            </div>
            <span className="shrink-0 rounded-full bg-bluewood-900 px-3 py-1.5 text-[10.5px] font-black text-white">5 COMPONENTS · 5 FLOWS</span>
          </div>
          <PitchArchitectureMap />
        </div>
        <div><div className="mb-1.5 flex items-baseline justify-between"><h3 className="text-[11.5px] font-black uppercase tracking-[0.16em] text-bluewood-400">문제 해결 과정</h3><span className="text-[11.5px] font-semibold text-bluewood-300">1건 · 눌러서 펼치기 · 눌러서 편집</span></div><div className="border-y border-surface-200 py-3"><div className="flex items-start gap-2.5"><span className="mt-0.5 flex h-[18px] w-[18px] items-center justify-center rounded bg-primary-700 text-[10.5px] font-black text-white">1</span><div><h4 className="text-[14.5px] font-extrabold text-bluewood-900">경험 구조화·검증 파이프라인 개발</h4><p className="mt-1 text-[11px] text-bluewood-400">2026.04 — 2026.07 · React, Node.js, Firebase, Gemini API</p></div></div><div className="mt-3 space-y-2.5 pl-7"><p className="text-[12.5px] leading-[1.65] text-bluewood-600"><b className="mr-2 text-bluewood-700">문제</b>저장 순서가 엇갈리면 GitHub 분석 근거가 결과 화면에서 누락됐습니다.</p><p className="text-[12.5px] leading-[1.65] text-bluewood-600"><b className="mr-2 text-primary-700">해결</b>저장 결과를 단일 소스로 삼고 케이스 스터디 동기화 순서를 보장했습니다.</p><p className="text-[12.5px] font-bold text-bluewood-900"><b className="mr-2 text-primary-700">성과</b>커밋 345개 중 본인 기여 179개를 근거와 함께 자동 변환</p><CodeSnippet file="frontend/src/stores/experienceStore.js" code={"- await saveExperience(payload)\n+ const result = await saveExperience(payload)\n+ await syncCaseStudy(result.id)\n+ return result"} /></div></div></div>
      </div></div>
    </>
  );
}

function CodeReasonEvidence({ active }) {
  const snippet = DEMO_GIT_PROJECTS[0].code_snippets[0];

  return (
    <section className={cx('rounded-xl border bg-white transition-all duration-500', active ? 'border-primary-400 ring-4 ring-primary-100 shadow-[0_18px_55px_rgba(0,47,108,0.18)]' : 'border-surface-200')}>
      <div className="border-b border-surface-200 px-4 py-3">
        <p className="text-[11px] font-bold text-bluewood-700">코드 변경</p>
        <p className="mt-1 text-[13px] font-extrabold text-bluewood-900">경험 구조화·검증 파이프라인 개발</p>
      </div>
      <div className="p-4">
        <CodeSnippet file={snippet.file} code={snippet.code} />
        <div className="-mt-2 rounded-b-lg border border-t-0 border-surface-200 bg-surface-50/55 px-4 pb-3 pt-5">
          <p className="text-[10.5px] font-black uppercase tracking-[0.14em] text-primary-600">왜 이 코드를 썼는지</p>
          <p className="mt-2 text-[12.5px] font-semibold leading-[1.75] text-bluewood-700">{snippet.why}</p>
          <p className="mt-2 text-[11.5px] leading-[1.65] text-bluewood-500">결과 화면으로 먼저 이동하면 저장 전 데이터가 노출될 수 있어, 저장 결과를 단일 기준으로 삼고 케이스 스터디 동기화가 끝난 뒤 결과를 반환하도록 구현했습니다.</p>
        </div>
      </div>
    </section>
  );
}

function ResultsScreen({ current }) {
  const complete = current === 'complete';
  const viewportRef = useRef(null);
  const pageRef = useRef(null);
  const overviewRef = useRef(null);
  const commitsRef = useRef(null);
  const reviewRef = useRef(null);
  const architectureRef = useRef(null);
  const completeRef = useRef(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 0.72, ready: false });

  useLayoutEffect(() => {
    const targets = {
      overview: overviewRef,
      commits: commitsRef,
      review: reviewRef,
      architecture: architectureRef,
      complete: completeRef,
    };
    const viewport = viewportRef.current;
    const page = pageRef.current;
    if (!viewport || !page) return undefined;

    let frame;
    const measureCamera = () => {
        const viewportWidth = viewport.clientWidth;
        const viewportHeight = viewport.clientHeight;
        const pageWidth = page.offsetWidth;
        const pageHeight = page.offsetHeight;
        if (!viewportWidth || !viewportHeight || !pageWidth || !pageHeight) return;

        if (complete) {
          const scale = Math.min(
            (viewportWidth - 34) / pageWidth,
            (viewportHeight - 34) / pageHeight,
          );
          setCamera({
            x: (viewportWidth - pageWidth * scale) / 2,
            y: (viewportHeight - pageHeight * scale) / 2,
            scale,
            ready: true,
          });
          return;
        }

        const target = targets[current]?.current || overviewRef.current;
        if (!target) return;
        const targetHeight = target.offsetHeight;
        const targetWidth = target.offsetWidth;
        let targetTop = 0;
        let targetLeft = 0;
        let offsetNode = target;
        while (offsetNode && offsetNode !== page) {
          targetTop += offsetNode.offsetTop;
          targetLeft += offsetNode.offsetLeft;
          offsetNode = offsetNode.offsetParent;
        }
        const targetCenterY = targetTop + targetHeight / 2;
        const targetCenterX = targetLeft + targetWidth / 2;
        const focusScaleLimit = current === 'commits' ? 1.08 : current === 'architecture' ? 0.92 : 1;
        const scale = Math.min(
          focusScaleLimit,
          (viewportWidth - 28) / Math.max(1, targetWidth),
          (viewportHeight - 62) / Math.max(1, targetHeight + 30),
        );
      setCamera({
        x: viewportWidth / 2 - targetCenterX * scale,
        y: viewportHeight / 2 - targetCenterY * scale,
        scale,
        ready: true,
      });
    };
    const updateCamera = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measureCamera);
    };

    measureCamera();
    const observer = new ResizeObserver(updateCamera);
    observer.observe(viewport);
    observer.observe(page);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [current]);

  return (
    <div ref={viewportRef} className="relative h-full overflow-hidden bg-[#f5f5f5]">
      <div
        ref={pageRef}
        className={cx(
          'absolute left-0 top-0 w-[1280px] overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]',
          camera.ready ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
          transformOrigin: 'top left',
          transition: 'transform 950ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out',
          willChange: 'transform',
        }}
      >
        <div ref={overviewRef} className="pointer-events-none absolute left-0 top-[54px] h-[610px] w-full" />
        <div className="border-b border-surface-200 bg-white/90">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-[13px] font-medium text-bluewood-400">← 경험 목록</span>
              <div className="inline-flex items-center gap-0.5 rounded-xl bg-surface-100 p-1">
                <span className="rounded-lg bg-white px-3.5 py-1.5 text-[13px] font-bold text-bluewood-900 shadow-sm">핵심 경험</span>
                <span className="rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-bluewood-400">자세히 보기</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2.5"><span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-500"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />저장 안 됨</span><span className="rounded-lg bg-primary-600 px-4 py-2 text-[13px] font-bold text-white shadow-sm shadow-primary-600/20">저장</span></div>
          </div>
        </div>

        <article ref={completeRef} className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
          <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] lg:gap-10">
            <aside className="lg:pr-2">
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-[11.5px] font-black uppercase tracking-[0.22em] text-primary-700">핵심 경험 리포트</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-[11px] font-semibold text-bluewood-400"><PenLine size={12} /> 눌러서 편집</span>
              </div>
              <h1 className="text-[26px] font-black leading-[1.22] tracking-tight text-bluewood-900">졸프</h1>
              <div ref={commitsRef} className="mt-4 border-t border-surface-200 pt-4"><DemoGitHeroCard /></div>
              <div className="mt-4 border-t border-surface-200 pt-4">
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-bluewood-300">기술 스택</p>
                <div className="flex flex-wrap gap-1.5">{DEMO_RESULT_EXPERIENCE.structuredResult.projectOverview.techStack.map(t => <span key={t} className="rounded-md bg-surface-100 px-2 py-0.5 text-[11px] font-semibold text-bluewood-600">{t}</span>)}</div>
              </div>
            </aside>

            <section className="min-w-0">
              <DemoDevImpactSection architectureRef={architectureRef} architectureFocus={current === 'architecture'} />
              <div ref={reviewRef} className="mt-8">
                <CodeReasonEvidence active={current === 'review'} />
              </div>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}

// 캡션 안에서 핵심 단어만 컬러로 구분한다.
function renderCaption(caption) {
  if (typeof caption === 'string') return caption;
  const { t, hl } = caption;
  if (!hl || !t.includes(hl)) return t;
  const [before, ...rest] = t.split(hl);
  return (
    <>
      {before}
      <mark className="eng-demo-hl">{hl}</mark>
      {rest.join(hl)}
    </>
  );
}

// 숏폼 하단 자막의 위치를 고정해 화면과 시선이 매 장면마다 흔들리지 않게 한다.
const CAPTION_POS = {
  'github-pain': 'bottom-[8%]',
  'files-pain': 'bottom-[8%]',
  create: 'bottom-[8%]',
  role: 'bottom-[8%]',
  sources: 'bottom-[8%]',
  pipeline: 'bottom-[8%]',
  overview: 'bottom-[8%]',
  commits: 'bottom-[8%]',
  review: 'bottom-[8%]',
  complete: 'bottom-[8%]',
};

function DemoSubtitle({ step, progress }) {
  const captions = REEL_CAPTIONS[step.key] || [step.caption];
  const captionIndex = progress < 0.48 ? 0 : Math.min(1, captions.length - 1);
  const caption = captions[captionIndex];

  return (
    <div className={cx(
      'pointer-events-none absolute inset-x-5 z-50 flex justify-center px-1 text-center',
      CAPTION_POS[step.key] || 'bottom-[14%]',
    )}>
      <p key={`${step.key}-${captionIndex}`} className="eng-demo-reel-caption max-w-full text-[21px] font-extrabold leading-[1.34] tracking-[-0.04em] text-white sm:text-[24px]">
        {renderCaption(caption)}
      </p>
    </div>
  );
}

// 모바일 9:16 프레임에 맞춰 데스크톱 설계 씬을 통째로 축소·중앙 정렬한다.
// Tailwind 반응형(sm/md/lg)은 창 너비 기준이라, 고정 설계 폭(w)에서 렌더한 뒤
// 프레임 폭에 맞게 scale해야 레이아웃이 안 깨지고 여백도 일정하게 잡힌다.
function ReelStage({ w = 900, h = 820, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setScale(Math.min(el.clientWidth / w, el.clientHeight / h) * 0.96);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => observer.disconnect();
  }, [w, h]);
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden rounded-[20px] bg-[#f5f5f5] shadow-[0_12px_44px_rgba(15,23,42,0.16)] ring-1 ring-black/5"
        style={{ width: w, height: h, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center center' }}
      >
        {children}
      </div>
    </div>
  );
}

export default function DeveloperPitchDemo() {
  const [stepIndex, setStepIndex] = useState(() => {
    const scene = new URLSearchParams(window.location.search).get('scene');
    const index = DEMO_STEPS.findIndex(item => item.key === scene);
    return index >= 0 ? index : 0;
  });
  const [progress, setProgress] = useState(0);
  const step = DEMO_STEPS[stepIndex];
  const resultsStep = ['overview', 'commits', 'review', 'architecture', 'complete'].includes(step.key);
  const desktopStep = ['attention', 'github-pain', 'files-pain'].includes(step.key);

  useEffect(() => {
    let frame;
    const startedAt = performance.now() - (progress * step.duration);
    const tick = (now) => {
      const nextProgress = Math.min(1, (now - startedAt) / step.duration);
      if (nextProgress >= 1) {
        setProgress(0);
        setStepIndex(index => (index + 1) % DEMO_STEPS.length);
        return;
      }
      setProgress(nextProgress);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // progress는 단계 내부 애니메이션에만 사용하며 프레임마다 effect를 재시작하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, step.duration]);

  const screen = useMemo(() => {
    if (step.key === 'attention') return <AttentionScreen />;
    if (step.key === 'github-pain') return <ReelStage><GitHubPainScreen progress={progress} /></ReelStage>;
    if (step.key === 'files-pain') return <ReelStage><FilesPainScreen progress={progress} /></ReelStage>;
    if (step.key === 'create') return <ReelStage><EmptyExperienceScreen active /></ReelStage>;
    if (step.key === 'role') return <ReelStage><RoleSelectionScreen active /></ReelStage>;
    if (step.key === 'sources') return <ReelStage><SourceInputScreen active /></ReelStage>;
    if (step.key === 'pipeline') return <ReelStage><PipelineScreen progress={progress} /></ReelStage>;
    if (step.key === 'architecture') return <ArchitectureFocusScreen />;
    return <ResultsScreen current={step.key} />;
  }, [step.key, progress]);

  return (
    // 인스타 릴스 홍보용 9:16 세로 배율 스테이지. 화면을 이 세로 프레임 영역만 녹화하면 된다.
    <div className="eng-demo flex h-screen w-screen items-center justify-center overflow-hidden bg-[#07090e]">
      <div
        className="relative flex flex-col overflow-hidden bg-[#f5f5f5] text-slate-700 shadow-[0_0_100px_rgba(0,0,0,0.55)]"
        style={{ height: '100dvh', width: 'min(100vw, calc(100dvh * 9 / 16))' }}
      >
        {!desktopStep && !resultsStep && <ProductHeader />}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <main key={resultsStep ? 'results' : step.key} className={cx(step.key !== 'attention' && 'eng-demo-screen-enter', 'h-full min-h-0 overflow-hidden bg-[#f5f5f5]')}>{screen}</main>
          {!['attention', 'architecture'].includes(step.key) && <DemoSubtitle step={step} progress={progress} />}
        </div>
      </div>
    </div>
  );
}
