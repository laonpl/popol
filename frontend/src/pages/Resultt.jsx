import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Code2,
  FileCode2,
  Github,
  GitCommit,
  Layers3,
  Megaphone,
  Network,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import JobShowcase from '../components/portfolio/JobShowcase';
import { CodeSnippet } from '../components/portfolio/GitInsights';

const ROLES = [
  {
    id: 'common',
    label: '공통',
    short: 'ALL JOBS',
    icon: Sparkles,
    accent: '#002f6c',
    activeClass: 'border-[#002f6c] bg-[#002f6c] text-white shadow-blue-200',
    softClass: 'border-blue-100 bg-blue-50 text-blue-800',
    title: 'FitPoly 경험 구조화 서비스 제작',
    subtitle: '직무와 관계없이 문제·행동·결과·배움을 CASE STUDY와 핵심 경험으로 정리',
    metrics: [
      { label: '핵심 경험', value: '3개', note: '근거 중심 정리' },
      { label: '도출 역량', value: '6개', note: '행동에서 추출' },
      { label: '완성도', value: '86점', note: '보완점 포함' },
    ],
  },
  {
    id: 'dev',
    label: '개발자',
    short: 'FE / BE',
    icon: Code2,
    accent: '#0369a1',
    activeClass: 'border-sky-600 bg-sky-600 text-white shadow-sky-200',
    softClass: 'border-sky-100 bg-sky-50 text-sky-700',
    title: 'FitPoly 경험 구조화·검증 파이프라인 개발',
    subtitle: '문서와 GitHub 근거를 교차 분석해 설명 가능한 개발 경험으로 변환',
    metrics: [
      { label: '본인 커밋', value: '179개', note: '전체 345개' },
      { label: '기여 비중', value: '51.9%', note: '저장소 기여 1위' },
      { label: '핵심 코드', value: '4개', note: '변경 이유까지 추출' },
    ],
  },
  {
    id: 'pm',
    label: '기획·PM',
    short: 'PRODUCT',
    icon: Layers3,
    accent: '#4f46e5',
    activeClass: 'border-indigo-600 bg-indigo-600 text-white shadow-indigo-200',
    softClass: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    title: '대화형 경험정리 MVP 기획 및 검증',
    subtitle: '문제 정의, 로드맵, 핵심 가설과 Before/After 제품 지표를 연결',
    metrics: [
      { label: '작성 완료율', value: '64%', note: '+26%p' },
      { label: '첫 결과 도달', value: '11분', note: '59% 단축' },
      { label: '도움됨 응답', value: '81%', note: '+29%p' },
    ],
    showcase: {
      visuals: {
        timeline: [
          { label: '문제 발견', start: 0, span: 2, desc: '사용자 인터뷰 12건' },
          { label: 'MVP 설계', start: 2, span: 3, desc: '핵심 가설·MSC 정의' },
          { label: '개발 스프린트', start: 5, span: 4, desc: '질문형 입력 흐름 구현' },
          { label: '베타 검증', start: 9, span: 3, desc: '420명 퍼널 분석' },
        ],
        compare: [
          { label: '작성 완료율', before: '38%', after: '64%' },
          { label: '첫 결과 도달', before: '27분', after: '11분' },
        ],
      },
    },
  },
  {
    id: 'marketer',
    label: '마케터',
    short: 'GROWTH',
    icon: Megaphone,
    accent: '#e11d48',
    activeClass: 'border-rose-600 bg-rose-600 text-white shadow-rose-200',
    softClass: 'border-rose-100 bg-rose-50 text-rose-700',
    title: '취업 준비생 타깃 콘텐츠 캠페인 운영',
    subtitle: '채널별 예산과 ROAS, 소재×타깃 CTR을 캠페인 성과 보드로 변환',
    metrics: [
      { label: '콘텐츠 저장률', value: '8.7%', note: '4.1배' },
      { label: '랜딩 CVR', value: '9.6%', note: '+5.8%p' },
      { label: '신규 가입', value: '510명', note: '4.3배' },
    ],
    showcase: {
      visuals: {
        mix: [
          { label: 'Instagram', pct: 42 },
          { label: 'YouTube', pct: 28 },
          { label: 'Naver', pct: 18 },
          { label: 'Meta Ads', pct: 12 },
        ],
        kpis: [{ label: 'ROAS', value: '382%' }],
      },
      keyExps: [{ jobData: { channels: ['Instagram', 'YouTube', 'Naver', 'Meta Ads'] } }],
    },
  },
];

const GRASS_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
const GRASS_CELLS = Array.from({ length: 168 }, (_, index) => {
  const wave = Math.sin(index * 1.31) + Math.cos(index * 0.47);
  if (index % 19 === 0) return 0;
  return Math.max(1, Math.min(4, Math.round(wave + 2.55)));
});

function RoleTabs({ activeId, onChange }) {
  return (
    <>
      <style>{`
        .resultt-role-tabs { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 6px; }
        @media (max-width: 1023px) { .resultt-role-tabs { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
        @media (max-width: 639px) { .resultt-role-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      `}</style>
      <div className="resultt-role-tabs">
        {ROLES.map(role => {
          const Icon = role.icon;
          const active = role.id === activeId;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onChange(role.id)}
              className={`flex min-h-[54px] flex-col items-center justify-center rounded-xl border px-2 py-1.5 transition-all ${
                active
                  ? `${role.activeClass} -translate-y-0.5 shadow-lg`
                  : 'border-slate-200 bg-white text-slate-500 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.6 : 2} />
              <span className="mt-1 text-[11.5px] font-extrabold">{role.label}</span>
              <span className={`mt-0.5 text-[7.5px] font-black tracking-[0.1em] ${active ? 'text-white/65' : 'text-slate-300'}`}>{role.short}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ResultHeader({ role }) {
  const Icon = role.icon;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-[#002f6c] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-white">FitPoly</span>
          <span className="text-[11px] font-bold text-slate-300">경험정리</span>
          <span className="text-slate-200">/</span>
          <span className="text-[11px] font-extrabold text-slate-600">{role.label} 결과</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-600">분석 완료</span>
          <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-400">예시 데이터</span>
        </div>
      </div>

      <style>{`
        .resultt-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
        @media (max-width: 1023px) { .resultt-hero-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
      <div className="resultt-hero-grid gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex min-w-0 items-start gap-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${role.softClass}`}>
            <Icon size={23} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: role.accent }}>
              {role.id === 'common' ? 'CORE EXPERIENCE · CASE STUDY' : 'JOB-SPECIFIC EXPERIENCE'}
            </p>
            <h1 className="mt-1 text-[20px] font-black leading-tight tracking-[-0.035em] text-slate-950">{role.title}</h1>
            <p className="mt-1.5 text-[11.5px] font-medium text-slate-500">{role.subtitle}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {role.metrics.map(metric => (
            <div key={metric.label} className="min-w-[104px] rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-[9.5px] font-extrabold text-slate-400">{metric.label}</p>
              <p className="mt-0.5 text-[17px] font-black tracking-tight" style={{ color: role.accent }}>{metric.value}</p>
              <p className="text-[9px] font-bold text-slate-400">{metric.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-5 border-b border-slate-200 bg-slate-50/70 px-5 py-2 text-[9.5px] font-extrabold text-slate-400">
        <span>경험 요약</span>
        <span>핵심 경험</span>
        <span className="border-b-2 pb-2" style={{ color: role.accent, borderColor: role.accent }}>직무 특화 산출물</span>
        <span>증거 자료</span>
      </div>
    </>
  );
}

function CommitGrass() {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 grid grid-cols-4 pl-5 text-center text-[8px] font-semibold text-slate-300">
        <span>4월</span><span>5월</span><span>6월</span><span>7월</span>
      </div>
      <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-1.5">
        <div className="grid grid-rows-7 gap-0.5 text-right text-[7px] leading-[7px] text-slate-300">
          {['월', '', '수', '', '금', '', ''].map((label, index) => <span key={index} className="h-[7px]">{label}</span>)}
        </div>
        <div
          className="grid min-w-0"
          style={{
            gridTemplateColumns: 'repeat(24, minmax(5px, 1fr))',
            gridTemplateRows: 'repeat(7, 7px)',
            gridAutoFlow: 'column',
            gap: '2px',
          }}
        >
          {GRASS_CELLS.map((level, index) => (
            <span
              key={index}
              className="block min-w-0 rounded-[1.5px]"
              style={{ backgroundColor: GRASS_COLORS[level] }}
              title={`${level * 2} contributions`}
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[8px] font-semibold text-slate-300">
        <span>최근 24주 커밋 활동 · 179개</span>
        <span className="flex items-center gap-1">
          적음 {GRASS_COLORS.map(color => <i key={color} className="h-1.5 w-1.5 rounded-[1px]" style={{ backgroundColor: color }} />)} 많음
        </span>
      </div>
    </div>
  );
}

function GitContributionCard() {
  const commitTypes = [
    { label: 'feat', count: 72, width: 100 },
    { label: 'fix', count: 48, width: 67 },
    { label: 'refactor', count: 31, width: 43 },
    { label: 'docs', count: 18, width: 25 },
    { label: 'test', count: 10, width: 14 },
  ];
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Github size={17} className="text-slate-800" />
          <div>
            <h3 className="text-[13px] font-black text-slate-800">GitHub 기여도 · 영향력</h3>
            <p className="mt-0.5 text-[9.5px] font-semibold text-slate-400">laonpl/popol · 기본 브랜치 기준 교차 분석</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-600">근거 확인됨</span>
      </div>

      <div className="resultt-git-summary mt-3 gap-4">
        <style>{`
          .resultt-git-summary { display: grid; grid-template-columns: 140px minmax(0, 1fr); }
          @media (max-width: 639px) { .resultt-git-summary { grid-template-columns: minmax(0, 1fr); } }
        `}</style>
        <div>
          <p className="text-[27px] font-black leading-none tracking-tight text-[#002f6c]">51.9%</p>
          <p className="mt-1.5 text-[10px] font-bold text-slate-400">커밋 기여 비중</p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[51.9%] rounded-full bg-[#002f6c]" />
          </div>
          <p className="mt-1 text-[9.5px] font-semibold text-slate-400">내 커밋 179 / 전체 345</p>

          <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full">
            <span className="w-[63%] bg-blue-500" />
            <span className="w-[19%] bg-emerald-500" />
            <span className="w-[11%] bg-amber-400" />
            <span className="w-[7%] bg-violet-500" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-bold text-slate-400">
            <span>● JavaScript 63%</span><span>● CSS 19%</span>
            <span>● Node.js 11%</span><span>● Python 7%</span>
          </div>
        </div>
        <div className="min-w-0">
          <CommitGrass />
        </div>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center gap-2">
          <GitCommit size={13} className="text-[#002f6c]" />
          <p className="text-[10px] font-extrabold text-slate-500">커밋 유형 분석</p>
        </div>
        <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
          {commitTypes.map(item => (
            <div key={item.label} className="grid grid-cols-[48px_minmax(0,1fr)_24px] items-center gap-2">
              <span className="font-mono text-[9.5px] font-bold text-slate-500">{item.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <i className="block h-full rounded-full bg-[#002f6c]" style={{ width: `${item.width}%` }} />
              </span>
              <span className="text-right font-mono text-[9.5px] font-bold text-slate-500">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchitectureCard() {
  const Node = ({ eyebrow, title, tone = 'blue', wide = false }) => {
    const tones = {
      blue: 'border-blue-200 bg-blue-50 text-blue-900',
      cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900',
      violet: 'border-violet-200 bg-violet-50 text-violet-900',
      slate: 'border-slate-200 bg-white text-slate-800',
    };
    return (
      <div className={`rounded-xl border px-3 py-2.5 text-center shadow-sm ${tones[tone]} ${wide ? 'mx-auto w-[82%]' : ''}`}>
        <p className="text-[7.5px] font-black uppercase tracking-[0.12em] opacity-50">{eyebrow}</p>
        <p className="mt-0.5 text-[11px] font-black">{title}</p>
      </div>
    );
  };
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-[#002f6c]" />
          <div>
            <h3 className="text-[13px] font-black text-slate-800">서비스 아키텍처</h3>
            <p className="mt-0.5 text-[9.5px] font-semibold text-slate-400">저장소 구조와 호출 관계에서 자동 추출</p>
          </div>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-[8.5px] font-black text-slate-400">5 COMPONENTS</span>
      </div>
      <div className="mt-3 rounded-xl border border-blue-100 bg-gradient-to-br from-slate-50 to-blue-50 p-3">
        <Node eyebrow="USER INTERFACE" title="React Client" wide />
        <div className="mx-auto h-4 w-px bg-blue-200" />
        <Node eyebrow="API GATEWAY" title="Express API" tone="slate" wide />
        <div className="mx-auto flex h-5 items-center justify-center text-[9px] font-black text-blue-400">↙ AI + GIT 교차 분석 ↘</div>
        <div className="grid grid-cols-2 gap-3">
          <Node eyebrow="CONTEXT" title="Experience Engine" tone="cyan" />
          <Node eyebrow="EVIDENCE" title="GitHub Analyzer" tone="violet" />
        </div>
        <div className="mx-auto h-4 w-px bg-blue-200" />
        <Node eyebrow="SINGLE SOURCE" title="Firebase" wide />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['React', 'Node.js', 'Firebase', 'Gemini API'].map(tag => (
          <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-[8.5px] font-extrabold text-slate-500">{tag}</span>
        ))}
      </div>
    </section>
  );
}

function CodeExtractionCard() {
  const code = `- await saveExperience(payload)
+ const result = await saveExperience(payload)
+ await syncCaseStudy(result.id)
+ return result`;
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCode2 size={16} className="text-[#002f6c]" />
          <div>
            <h3 className="text-[13px] font-black text-slate-800">핵심 코드 추출</h3>
            <p className="mt-0.5 text-[9.5px] font-semibold text-slate-400">변경 코드만 보여주지 않고 선택 이유와 영향까지 설명</p>
          </div>
        </div>
        <span className="rounded-full bg-blue-50 px-2 py-1 text-[8.5px] font-black text-blue-700">4개 추출</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.8fr)]">
        <CodeSnippet file="frontend/src/stores/experienceStore.js" code={code} />
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.13em] text-blue-700">WHY THIS CODE</p>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-600">
            저장 완료 전에 다음 동기화가 실행되던 경쟁 상태를 제거했습니다. 저장 결과를 단일 기준으로 삼아 결과 화면의 데이터 누락을 방지했습니다.
          </p>
          <div className="mt-3 border-t border-blue-100 pt-3">
            <p className="text-[9px] font-extrabold text-slate-400">영향 범위</p>
            <p className="mt-1 text-[10.5px] font-bold text-slate-700">경험 저장 · 케이스 스터디 · 결과 페이지</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TroubleshootingCard() {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-[#002f6c]" />
        <div>
          <h3 className="text-[13px] font-black text-slate-800">문제 해결 과정</h3>
          <p className="mt-0.5 text-[9.5px] font-semibold text-slate-400">커밋과 변경 파일을 근거로 재구성</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { n: '01', label: '문제', text: '저장 순서가 엇갈리면 GitHub 분석 근거가 결과 화면에서 누락됨' },
          { n: '02', label: '진단', text: '비동기 호출 3개의 완료 시점과 Firestore 쓰기 로그를 비교' },
          { n: '03', label: '해결', text: '저장 결과를 단일 소스로 만들고 후속 동기화 순서를 보장' },
          { n: '04', label: '성과', text: '커밋 345개 중 본인 기여 179개를 근거와 함께 안정적으로 변환' },
        ].map((item, index) => (
          <div key={item.n} className="relative flex gap-3">
            {index < 3 && <span className="absolute left-[11px] top-6 h-[calc(100%+4px)] w-px bg-slate-200" />}
            <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-black ${
              index === 3 ? 'bg-emerald-500 text-white' : 'bg-[#002f6c] text-white'
            }`}>{item.n}</span>
            <div>
              <p className="text-[9px] font-black text-slate-400">{item.label}</p>
              <p className="mt-0.5 text-[10.5px] font-semibold leading-[1.55] text-slate-600">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DeveloperDashboard() {
  return (
    <div className="resultt-developer-grid min-w-0 gap-3 p-3.5">
      <style>{`
        .resultt-developer-grid { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); }
        @media (max-width: 1023px) { .resultt-developer-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
      <GitContributionCard />
      <ArchitectureCard />
      <CodeExtractionCard />
      <TroubleshootingCard />
    </div>
  );
}

function CommonDashboard() {
  const experiences = [
    {
      title: '대화형 경험정리 MVP 설계',
      metric: '작성 완료율 38% → 64%',
      problem: '빈 편집기에서 무엇부터 써야 할지 몰라 사용자가 작성을 포기함',
      action: '경험을 회상·행동·성과 단계로 나누고 한 번에 한 질문만 제시',
    },
    {
      title: '문서 업로드 오류 개선',
      metric: '업로드 성공률 71% → 96%',
      problem: '404와 타임아웃이 섞여 실패 원인과 재시도 방법을 알기 어려움',
      action: 'API 경로를 단일화하고 단계별 오류 메시지와 재시도 흐름을 적용',
    },
    {
      title: '사용자 검증 및 개선',
      metric: '도움됨 응답 52% → 81%',
      problem: '결과는 꼼꼼하지만 유형과 경험 카테고리를 구분하기 어려움',
      action: '활동 유형 필터와 분류 배지를 추가하고 타임라인에서 바로 수정',
    },
  ];
  return (
    <div className="grid min-w-0 gap-6 p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#002f6c]">CASE STUDY</span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-400">공통 직군 결과</span>
        </div>
        <h2 className="text-[24px] font-black leading-tight tracking-[-0.035em] text-slate-950">취업 준비생의 경험을<br />채용 언어로 구조화한 서비스</h2>
        <p className="mt-3 text-[12px] font-medium leading-6 text-slate-500">
          사용자가 흩어진 경험을 질문에 답하는 방식으로 정리하고, 문제·행동·결과·배움이 드러나는 재사용 가능한 경험 자산으로 만드는 프로젝트입니다.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            ['역할', '기획·개발'], ['기간', '2026.04–07'], ['팀', '5명'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[9px] font-bold text-slate-400">{label}</p>
              <p className="mt-1 text-[11px] font-black text-slate-700">{value}</p>
            </div>
          ))}
        </div>

        <section className="mt-6 border-t border-slate-200 pt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">핵심 역량</p>
          <div className="mt-3 space-y-3">
            {[
              ['핵심 역량', '#002f6c', ['문제 해결', '사용자 중심', '실행력']],
              ['도출 역량', '#0f766e', ['데이터 분석', '협업', '개선 반복']],
              ['성장 역량', '#7c3aed', ['구조화', '문서화', '검증']],
            ].map(([label, color, tags]) => (
              <div key={label}>
                <p className="flex items-center gap-1.5 text-[9.5px] font-extrabold text-slate-500">
                  <i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> {label}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {tags.map(tag => <span key={tag} className="rounded-full px-2.5 py-1 text-[9.5px] font-bold" style={{ color, backgroundColor: `${color}12` }}>{tag}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-xl bg-[#002f6c] p-4 text-white">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-cyan-300">배운 점</p>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-white/85">
            좋은 정리는 정보량을 늘리는 것이 아니라, 사용자가 자신의 경험을 비교하고 다시 활용할 수 있는 기준을 만들어주는 일임을 배웠습니다.
          </p>
        </section>
      </div>

      <aside className="min-w-0 lg:border-l lg:border-slate-200 lg:pl-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-black text-slate-900">핵심 경험</h3>
          <span className="text-[10px] font-bold text-slate-400">3건</span>
        </div>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {experiences.map((experience, index) => (
            <div key={experience.title} className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#002f6c] text-[9px] font-black text-white">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[13px] font-black text-slate-800">{experience.title}</p>
                    <span className="rounded bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-600">{experience.metric}</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-rose-50/70 p-2.5">
                      <p className="text-[8px] font-black uppercase tracking-wider text-rose-500">문제</p>
                      <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">{experience.problem}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50/70 p-2.5">
                      <p className="text-[8px] font-black uppercase tracking-wider text-blue-600">행동</p>
                      <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">{experience.action}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function PmDashboard() {
  const canvas = [
    ['문제', '경험은 있지만 무엇을 강조해야 할지 몰라 작성을 포기한다.'],
    ['기존 솔루션', '빈 문서, 템플릿 복사, 일회성 컨설팅'],
    ['고유 가치 제안', '질문에 답하면 검증 가능한 경험 초안이 완성된다.'],
    ['핵심 지표', '작성 완료율 64% · 첫 결과 11분'],
    ['고객 세그먼트', '포트폴리오를 처음 만드는 취업 준비생'],
    ['얼리어답터', '지원 마감 2주 이내의 취준생'],
  ];
  return (
    <div className="grid min-w-0 gap-5 p-5 lg:grid-cols-[minmax(0,310px)_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-2xl bg-[#0f2747] p-5 text-white">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-300">PRODUCT BRIEF</p>
        <h2 className="mt-3 text-[22px] font-black leading-tight tracking-[-0.035em]">대화형 경험정리로<br />작성 포기 문제 해결</h2>
        <p className="mt-4 text-[11px] font-semibold leading-5 text-white/65">Define → Hypothesize → Test → Decide</p>
        <div className="mt-6 space-y-4">
          {[
            ['문제', '무엇부터 써야 할지 몰라 첫 문장을 시작하지 못함'],
            ['타깃', '포트폴리오 경험이 적다고 느끼는 취업 준비생'],
            ['MSC', '15분 안에 수정 가능한 경험 초안 1개 완성'],
            ['핵심 전략', '전체 입력 폼을 한 번에 한 질문으로 전환'],
          ].map(([label, text]) => (
            <div key={label} className="border-t border-white/10 pt-3">
              <p className="text-[8.5px] font-black uppercase tracking-wider text-indigo-300">{label}</p>
              <p className="mt-1 text-[10.5px] font-semibold leading-[1.6] text-white/85">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          {[['완료율', '38→64%'], ['도달 시간', '27→11분']].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/10 p-3">
              <p className="text-[8.5px] font-bold text-white/50">{label}</p>
              <p className="mt-1 text-[16px] font-black text-white">{value}</p>
            </div>
          ))}
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-600 px-4 py-2.5 text-white">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/55">Leaner Canvas</p>
              <p className="mt-0.5 text-[12px] font-black">기획 캔버스 · 문제와 사업 가설 요약</p>
            </div>
            <span className="rounded-full bg-white/15 px-2 py-1 text-[8px] font-black">AUTO STRUCTURED</span>
          </div>
          <div className="grid sm:grid-cols-3">
            {canvas.map(([label, text], index) => (
              <div key={label} className={`min-h-[92px] p-3.5 ${index % 3 !== 0 ? 'sm:border-l sm:border-slate-100' : ''} ${index >= 3 ? 'border-t border-slate-100' : ''}`}>
                <p className="text-[8.5px] font-black uppercase tracking-wider text-indigo-600">{label}</p>
                <p className="mt-2 text-[10px] font-semibold leading-[1.55] text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[12px] font-black text-slate-800">서비스 타임라인</h3>
            <span className="text-[8.5px] font-bold text-slate-400">12 WEEKS</span>
          </div>
          <div className="space-y-2">
            {[
              ['문제 발견', '사용자 인터뷰 12건', 'w-[22%]', 'bg-indigo-300'],
              ['MVP 설계', '핵심 가설·MSC 정의', 'w-[33%]', 'bg-indigo-400'],
              ['개발 스프린트', '질문형 흐름 구현', 'w-[48%]', 'bg-indigo-500'],
              ['베타 검증', '420명 퍼널 분석', 'w-[28%]', 'bg-indigo-600'],
            ].map(([label, detail, width, color], index) => (
              <div key={label} className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
                <p className="text-right text-[9.5px] font-extrabold text-slate-500">{label}</p>
                <div className="h-7 rounded-lg bg-slate-50 p-1">
                  <div className={`flex h-full ${width} min-w-[130px] items-center rounded-md px-2 text-[8.5px] font-bold text-white ${color}`} style={{ marginLeft: `${index * 10}%` }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-indigo-600">의사결정 & 대안</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-3">
                <p className="text-[8px] font-black text-indigo-500">채택</p>
                <p className="mt-1 text-[10px] font-black text-indigo-900">단계형 인터뷰</p>
                <p className="mt-1 text-[8.5px] font-semibold text-indigo-700">인지 부담↓ · 맥락 유지↑</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[8px] font-black text-slate-400">기각</p>
                <p className="mt-1 text-[10px] font-black text-slate-600">전체 폼 입력</p>
                <p className="mt-1 text-[8.5px] font-semibold text-slate-400">빠르지만 이탈률이 높음</p>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-indigo-600">가설 & 검증</p>
            <p className="mt-3 text-[10.5px] font-black text-slate-700">H1. 답변 예시가 첫 결과 도달을 빠르게 한다.</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-[11px] font-bold text-slate-300 line-through">38%</span>
              <ArrowRight size={12} className="mb-1 text-slate-300" />
              <span className="text-[24px] font-black text-indigo-600">64%</span>
              <span className="mb-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black text-emerald-600">PASS</span>
            </div>
            <p className="mt-1 text-[8.5px] font-semibold text-slate-400">420명 · p&lt;0.01 · 완료율 기준</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function PmExperienceDashboard() {
  const canvasColumns = [
    [
      ['문제', 'Problem', ['첫 문장을 쓰지 못하고 이탈', '직무 역량 연결 기준 부족']],
      ['기존 솔루션', 'Existing Alternatives', ['빈 문서 작성', '템플릿 복사·일회성 첨삭']],
    ],
    [
      ['고유 가치 제안', 'Unique Value Proposition', ['질문에 답하면 근거가 연결된 경험 초안 완성']],
      ['핵심지표', 'Key Metrics', ['작성 완료율 64%', '첫 결과 도달 11분']],
    ],
    [
      ['고객 세그먼트', 'Customer Segments', ['포트폴리오를 처음 만드는 취업 준비생']],
      ['얼리어답터', 'Early Adopters', ['지원 마감 2주 이내 취업 준비생']],
    ],
  ];
  const journey = [
    ['Discover', '문제 발견', '인터뷰 12건'],
    ['Insight', '고객 정의', '첫 작성 이탈'],
    ['Hypothesize', '가설 수립', '질문형 입력'],
    ['Decide', '방향 결정', '단계형 UX'],
    ['Validate', '검증', '베타 420명'],
    ['Evolve', '결과·배움', '완료율 64%'],
  ];

  return (
    <div className="resultt-pm-grid min-w-0 gap-4 p-3.5">
      <style>{`
        .resultt-pm-grid { display: grid; grid-template-columns: minmax(0, 230px) minmax(0, 1fr); align-items: start; }
        @media (max-width: 1023px) { .resultt-pm-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>

      <aside className="min-w-0 border-r border-slate-200 pr-4">
        <p className="font-mono text-[8px] font-black uppercase tracking-[0.18em] text-indigo-500">Product case</p>
        <h2 className="mt-2 text-[20px] font-black leading-[1.18] tracking-[-0.035em] text-slate-900">
          대화형 경험정리 MVP 기획 및 검증
        </h2>
        <p className="mt-2 text-[10.5px] font-medium leading-[1.55] text-slate-500">
          막막한 경험 작성을 한 번에 한 질문으로 바꾸고, 사용자가 수정 가능한 첫 결과까지 도달하도록 설계했습니다.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-1.5 border-y border-slate-200 py-3">
          {[['역할', 'PM'], ['기간', '12주'], ['팀', '5명']].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <p className="text-[8px] font-bold text-slate-400">{label}</p>
              <p className="mt-0.5 text-[10px] font-black text-slate-700">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-slate-400">프로젝트 산출물</p>
          <div className="mt-2 space-y-1.5">
            {['사용자 인터뷰 노트', 'PRD · 질문 흐름', '퍼널 검증 리포트'].map((file, index) => (
              <div key={file} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                <span className="text-[9px] font-bold text-slate-600">{file}</span>
                <span className="font-mono text-[7px] font-black text-indigo-500">{['PDF', 'DOC', 'DATA'][index]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-indigo-50 p-3">
          <p className="text-[8px] font-black uppercase tracking-wider text-indigo-500">제품 판단 원칙</p>
          <p className="mt-1 text-[9.5px] font-bold leading-4 text-indigo-900">
            빠른 완성보다 사용자가 근거를 이해하고 직접 고칠 수 있는 초안을 우선했습니다.
          </p>
        </div>
      </aside>

      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2">
          {[['Define', '문제 정의'], ['Hypothesize', '가설 수립'], ['Test', '검증'], ['Decide', '판단']].map(([en, ko], index) => (
            <span key={en} className="flex items-center gap-1.5">
              {index > 0 && <ArrowRight size={9} className="text-slate-300" />}
              <span className="font-mono text-[8px] font-black uppercase tracking-wider text-indigo-600">{en}</span>
              <span className="text-[8.5px] font-semibold text-slate-400">{ko}</span>
            </span>
          ))}
        </div>

        <section className="overflow-hidden border-[3px] border-[#3d5262] bg-[#3d5262]">
          <div className="px-3 py-2 text-center text-white">
            <div className="flex items-baseline justify-center gap-2">
              <h3 className="text-[15px] font-black">리너 캔버스</h3>
              <span className="font-mono text-[7px] font-bold uppercase tracking-[0.16em] text-white/60">Leaner Canvas</span>
            </div>
            <p className="text-[8px] text-white/60">문제, 차별화된 가치, 핵심 고객과 검증 지표를 한 장에 압축했습니다.</p>
          </div>
          <div className="grid gap-[3px] bg-[#3d5262] sm:grid-cols-3">
            {canvasColumns.map((column, columnIndex) => (
              <div key={columnIndex} className="grid gap-[3px] bg-[#3d5262]">
                {column.map(([label, en, bullets], rowIndex) => (
                  <div key={label} className={`bg-white px-3 py-2 ${rowIndex === 0 ? 'min-h-[72px]' : 'min-h-[56px]'}`}>
                    <p className="text-center text-[9.5px] font-black text-[#3d5262]">{label}</p>
                    <p className="text-center font-mono text-[6px] font-bold uppercase tracking-wider text-slate-300">{en}</p>
                    <ul className="mt-1.5 space-y-0.5">
                      {bullets.map(bullet => (
                        <li key={bullet} className="flex gap-1 text-[8px] font-medium leading-3 text-slate-600">
                          <i className="mt-1 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />{bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-[10.5px] font-black text-slate-800">제품 여정</h3>
              <p className="text-[7.5px] text-slate-400">문제 발견부터 검증과 배움까지 제품이 발전한 핵심 흐름</p>
            </div>
            <span className="font-mono text-[7px] font-bold uppercase text-slate-300">Product Journey</span>
          </div>
          <div className="relative grid grid-cols-3 gap-x-2 gap-y-2 sm:grid-cols-6">
            <span className="absolute left-[7%] right-[7%] top-[11px] hidden h-px bg-indigo-100 sm:block" />
            {journey.map(([phase, label, detail], index) => (
              <div key={phase} className="relative z-10 text-center">
                <span className="mx-auto flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-[7px] font-black text-white shadow">{index + 1}</span>
                <p className="mt-1 font-mono text-[6.5px] font-black uppercase tracking-wider text-indigo-500">{phase}</p>
                <p className="text-[8px] font-black text-slate-700">{label}</p>
                <p className="mt-0.5 text-[7px] font-medium text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10.5px] font-black text-slate-800">AS-IS → TO-BE</h3>
                <p className="text-[7.5px] text-slate-400">문제를 어떤 상태 변화로 설계했는지</p>
              </div>
              <span className="font-mono text-[7px] font-bold uppercase text-slate-300">Transformation</span>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
              <div className="rounded-lg bg-slate-100 p-2">
                <p className="text-center text-[9px] font-black text-slate-500">AS-IS</p>
                <p className="mt-1 text-[8px] font-semibold leading-3 text-slate-600">전체 입력 폼 앞에서 첫 문장을 쓰지 못하고 이탈</p>
              </div>
              <ArrowRight size={13} className="self-center text-indigo-400" />
              <div className="rounded-lg bg-indigo-50 p-2">
                <p className="text-center text-[9px] font-black text-indigo-600">TO-BE</p>
                <p className="mt-1 text-[8px] font-semibold leading-3 text-indigo-800">한 질문씩 답해 11분 안에 수정 가능한 초안 완성</p>
              </div>
            </div>
            <div className="mt-2 rounded-lg bg-indigo-50/60 px-2 py-1.5 text-center">
              <span className="font-mono text-[6.5px] font-black uppercase text-indigo-400">PM 판단 · </span>
              <span className="text-[8px] font-bold text-indigo-800">속도보다 근거를 이해하고 수정하는 경험을 우선</span>
            </div>
          </section>

          <div className="grid gap-2.5 sm:grid-rows-2">
            <section className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[8px] font-black uppercase tracking-wider text-indigo-600">의사결정 & 어려움 해결</p>
                <span className="text-[7px] font-bold text-slate-300">01 / 03</span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-1.5">
                  <p className="text-[7px] font-black text-indigo-500">채택</p>
                  <p className="text-[8px] font-bold text-indigo-900">단계형 인터뷰</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-1.5">
                  <p className="text-[7px] font-black text-slate-400">기각</p>
                  <p className="text-[8px] font-bold text-slate-600">전체 폼 입력</p>
                </div>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[8px] font-black uppercase tracking-wider text-indigo-600">가설 및 검증</p>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[7px] font-black text-emerald-600">PASS</span>
              </div>
              <div className="mt-1 flex items-end gap-1.5">
                <span className="text-[9px] font-bold text-slate-300 line-through">38%</span>
                <ArrowRight size={9} className="mb-0.5 text-slate-300" />
                <span className="text-[18px] font-black leading-none text-indigo-600">64%</span>
                <span className="text-[7px] font-semibold text-slate-400">420명 · p&lt;0.01</span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketerDashboard() {
  const stages = [
    ['Problem', '광고형 콘텐츠 반복으로 도달과 팔로워가 6개월간 정체'],
    ['Target', '저장할 실용 정보를 찾는 20대 자취러'],
    ['Strategy', '제품 메시지를 정보형 릴스와 체크리스트로 전환'],
    ['Execution', '주 3회 발행·주제별 저장률 실험·프로필 CTA 개선'],
    ['Result', '팔로워 3배·저장률 8.7%·가입 CVR 9.6%'],
    ['Insight', '조회보다 저장 행동이 팔로우와 가입을 더 잘 예측'],
  ];
  return (
    <div className="min-w-0 space-y-4 p-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-slate-950 px-3 py-1.5 text-[12px] font-black text-white">
            <small className="mr-1.5 text-[8px] text-rose-300">1순위</small>콘텐츠 마케터
          </span>
          <span className="rounded-lg bg-rose-50 px-3 py-1.5 text-[12px] font-black text-rose-700">
            <small className="mr-1.5 text-[8px] text-rose-400">2순위</small>브랜드 마케터
          </span>
          <span className="text-[10px] font-semibold text-slate-400">참고 · 그로스 마케터</span>
        </div>
        <p className="mt-4 text-[13px] font-black leading-6 text-slate-800">
          “타깃의 저장 행동을 설계하고 반응 데이터를 다음 콘텐츠 방향으로 연결하는 콘텐츠 마케터”
        </p>
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
          {[
            ['핵심 강점', '타깃 리서치', '콘텐츠 실험', '채널 운영'],
            ['보완 필요', '광고 집행 근거', '본인 기여 분리', '원본 캡처'],
            ['우선 액션', 'KPI 증거 연결', 'JD 키워드 매핑', '성과 문장 정제'],
          ].map(([title, ...items], column) => (
            <div key={title}>
              <p className={`text-[10px] font-black ${column === 0 ? 'text-emerald-600' : column === 1 ? 'text-rose-600' : 'text-indigo-600'}`}>{title}</p>
              <ul className="mt-2 space-y-1.5">
                {items.map((item, index) => <li key={item} className="flex gap-2 text-[9.5px] font-semibold text-slate-500"><span className="font-black">{index + 1}.</span>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-rose-600">EXPERIENCE CARD · EXP-001</p>
              <h3 className="mt-1 text-[13px] font-black text-slate-800">정보형 릴스 리뉴얼로 팔로워 3배 성장</h3>
            </div>
            <div className="flex gap-2">
              <span className="rounded bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-600">PORTFOLIO A-</span>
              <span className="rounded bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-600">RESUME B+</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-3">
            <div className="p-4 sm:col-span-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-rose-500">Problem</p>
                  <p className="mt-2 text-[10.5px] font-semibold leading-5 text-slate-600">광고 소재를 재편집한 콘텐츠가 반복되며 도달과 팔로워가 정체되었습니다.</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-amber-600">Action</p>
                  <p className="mt-2 text-[10.5px] font-semibold leading-5 text-slate-600">타깃 인터뷰와 경쟁 계정 분석 후 정보형 콘텐츠 축을 정의하고 주제별 저장률을 실험했습니다.</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-indigo-50 p-3">
                <p className="text-[8.5px] font-black uppercase tracking-wider text-indigo-500">Goal</p>
                <p className="mt-1 text-[10.5px] font-bold text-indigo-900">타깃이 저장하고 다시 방문할 이유를 만들어 신규 팔로워와 가입 전환을 높인다.</p>
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 p-4 sm:border-l sm:border-t-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Key Results</p>
              <div className="mt-3 space-y-3">
                {[['팔로워', '800 → 2,400'], ['저장률', '2.1 → 8.7%'], ['가입 CVR', '3.8 → 9.6%']].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[8px] font-bold text-slate-400">{label}</p>
                    <p className="mt-0.5 text-[15px] font-black text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-rose-600">CAMPAIGN STORY</p>
          <div className="mt-3 space-y-2">
            {stages.map(([label, text], index) => (
              <div key={label} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
                <span className={`rounded-md px-2 py-1.5 text-center text-[8px] font-black ${
                  index === stages.length - 1 ? 'bg-emerald-500 text-white' : 'bg-rose-50 text-rose-600'
                }`}>{label}</span>
                <p className="text-[9.5px] font-semibold leading-4 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl bg-slate-950 p-4 text-white">
        <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-rose-300">이력서 성과 문장</p>
          <p className="text-[11px] font-bold leading-5 text-white/90">
            타깃 인터뷰와 경쟁 계정 분석을 바탕으로 정보형 릴스 콘텐츠를 기획·운영해 팔로워를 800명에서 2,400명으로 성장시키고 저장률을 4.1배 개선
          </p>
        </div>
      </section>
    </div>
  );
}

function GenericDashboard({ role }) {
  const showcase = role.showcase || {};
  return (
    <div className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: role.accent }}>VISUAL ARTIFACT</p>
          <h2 className="mt-1 text-[16px] font-black text-slate-900">{role.label} 직무 특화 결과 화면</h2>
        </div>
        <div className="flex items-center gap-2 text-[9.5px] font-bold text-slate-400">
          <CheckCircle2 size={13} className="text-emerald-500" /> 사용자의 실제 경험 수치와 근거로 자동 구성
        </div>
      </div>

      <div className="[&>section]:mt-0">
        <JobShowcase
          job={role.id}
          accent={role.accent}
          visuals={showcase.visuals || {}}
          keyExps={showcase.keyExps || []}
          jobSpecific={showcase.jobSpecific || {}}
          techList={showcase.techList || []}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Target, label: '문제 정의', text: role.subtitle },
          { icon: TrendingUp, label: '성과 근거', text: `${role.metrics[0].label} ${role.metrics[0].value} · ${role.metrics[0].note}` },
          { icon: BarChart3, label: '지원서 변환', text: `${role.title} 경험을 직무 핵심 역량 문장으로 자동 변환` },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-center gap-2">
                <Icon size={13} style={{ color: role.accent }} />
                <p className="text-[10px] font-black text-slate-700">{item.label}</p>
              </div>
              <p className="mt-2 text-[10px] font-semibold leading-5 text-slate-500">{item.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * 경험정리 결과 재현
 * 실제 화면(StructuredResult)의 7개 섹션 구조·번호 거터·근거 등급 표기를 그대로 따른다.
 * 숫자/라벨/부제는 StructuredResult의 SECTION_META와 동일하게 유지할 것.
 * ────────────────────────────────────────────────────────────── */
const EXPERIENCE_SECTIONS = [
  { key: 'intro',      num: '01', label: '프로젝트 소개', subtitle: '서비스 이름 or 프로젝트 특징 + 소개 한 줄' },
  { key: 'overview',   num: '02', label: '프로젝트 개요', subtitle: '배경과 목적' },
  { key: 'task',       num: '03', label: '진행한 일',     subtitle: '배경-문제-(핵심)-해결' },
  { key: 'process',    num: '04', label: '과정',          subtitle: '나의 직접적인 액션 + 인사이트' },
  { key: 'output',     num: '05', label: '결과물',        subtitle: '최종으로 진행한 내용 + 포인트' },
  { key: 'growth',     num: '06', label: '성장한 점',     subtitle: '성과가 있는 경우: 성과 / 없는 경우: 배운 점' },
  { key: 'competency', num: '07', label: '나의 역량',     subtitle: '입사 시 기여할 수 있는 부분' },
];

/* 근거 장부 표기 — 실제 화면과 동일하게 주장 성격 + 근거 등급(A~D)을 함께 단다 */
const EVIDENCE_STYLE = {
  A: { label: 'A · 직접 자료', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  B: { label: 'B · 작업 기록', cls: 'border-sky-200 bg-sky-50 text-sky-700' },
  C: { label: 'C · 정리본',   cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  D: { label: 'D · 회상',     cls: 'border-slate-200 bg-slate-50 text-slate-500' },
};

/* 역량 키워드 분류 — 실제 화면(StructuredResult)의 KW_CATEGORY_STYLES와 같은 구분 */
const KW_STYLE = {
  tech:       { cls: 'bg-sky-50 text-sky-700 ring-sky-200',             label: '기술' },
  soft:       { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: '소통' },
  leadership: { cls: 'bg-violet-50 text-violet-700 ring-violet-200',    label: '리더십' },
  planning:   { cls: 'bg-amber-50 text-amber-700 ring-amber-200',       label: '기획' },
};

const EXPERIENCE_SAMPLES = {
  common: {
    title: 'FitPoly 경험 구조화 서비스 제작',
    meta: { 기간: '2025.09 - 2026.02', 역할: '기획·실행 총괄', '팀 구성': '기획 1명, 개발 2명, 디자인 1명', '영향 범위': '베타 사용자 120명', 목표: '자료에서 판단 근거를 복원해 직무 언어로 정리' },
    keywords: [['문제 정의', 'planning'], ['사용자 인터뷰', 'soft'], ['정보 구조 설계', 'planning'], ['협업 리딩', 'leadership']],
    sections: {
      intro:      { tag: '사실', level: 'A', body: '흩어진 문서·발표자료·메신저 기록에서 실제로 한 일과 그 근거를 찾아 하나의 경험으로 정리하는 웹 서비스입니다. 취업 준비생의 경험을 채용 담당자가 판단할 수 있는 형태로 바꾸는 것을 목표로 했습니다.' },
      overview:   { tag: '사실', level: 'B', body: '취업 준비생 12명의 초안을 읽어보니 대부분이 "무엇을 했다"는 활동 나열이었고, 평가자가 기여 범위를 판단할 근거가 없었습니다. 문장을 다듬는 도구는 많지만 사실과 추정을 가려주는 도구는 없다는 점에서 출발했습니다.' },
      task:       { tag: '사실', level: 'A', body: '자료 업로드부터 구조화·근거 표기까지의 파이프라인을 설계했습니다. 직무마다 평가 기준이 다르다는 점을 반영해 직군별 추출 스키마를 따로 정의하고, 근거 수준을 A~D로 나눠 표기하는 규칙을 만들었습니다.' },
      process:    { tag: '해석', level: 'B', body: '초기에는 좋은 문장을 생성하는 데 집중했으나, 사용자 테스트에서 "이 문장이 사실인지 모르겠다"는 반응이 반복됐습니다. 이후 생성보다 판독을 먼저 설계하는 방향으로 바꿔 근거 장부를 도입했습니다.' },
      output:     { tag: '사실', level: 'A', body: '7개 공통 섹션, 근거 등급 A~D 표기, 직군별 특화 섹션과 시각 산출물을 포함한 결과 화면을 완성했습니다. 정리한 경험은 채용공고에 맞춰 재구성되어 포트폴리오로 이어집니다.' },
      growth:     { tag: '해석', level: 'C', body: '좋은 문장을 만드는 일과 사실을 판별하는 일은 다른 작업이라는 것을 배웠습니다. 이후 기능을 설계할 때는 "무엇을 생성할까"보다 "무엇을 근거로 판단할까"를 먼저 정의합니다.' },
      competency: { tag: '추정', level: 'B', body: '모호한 요구를 판단 가능한 기준으로 바꾸고, 확인된 사실과 추정을 구분해 커뮤니케이션할 수 있습니다. 사용자 반응을 근거로 초기 가설을 수정한 경험이 있습니다.' },
    },
  },
  dev: {
    title: 'FitPoly 경험 구조화·검증 파이프라인 개발',
    meta: { 기간: '2025.11 - 2026.01', 역할: '백엔드 개발 (기여도 60%)', '팀 구성': '백엔드 2명, 프론트 2명', '영향 범위': '전체 분석 요청', 목표: '대용량 자료 분석의 실패율과 지연 해소' },
    keywords: [['성능 프로파일링', 'tech'], ['비동기 처리', 'tech'], ['원인 분석', 'tech'], ['기술 문서화', 'soft']],
    sections: {
      intro:      { tag: '사실', level: 'A', body: '업로드된 문서와 GitHub 기록에서 기여 근거를 추출하는 백엔드 파이프라인입니다. PPTX·XLSX·ZIP을 포함한 다양한 형식을 읽어 텍스트와 구조를 뽑아냅니다.' },
      overview:   { tag: '사실', level: 'B', body: '분석 요청이 몰릴 때 응답이 지연되고 일부 요청이 타임아웃으로 유실됐습니다. 처리량을 늘리는 것보다 어디서 무엇이 실패하는지 관측 가능하게 만드는 것이 먼저라고 판단했습니다.' },
      task:       { tag: '사실', level: 'A', body: '증상은 대용량 PPTX 업로드 시 분석이 45초를 넘겨 중단되는 것이었습니다. 재현 조건을 슬라이드 30장 이상·이미지 합계 20MB 이상으로 좁혀 안정적으로 재현되는 케이스를 확보했습니다.' },
      process:    { tag: '사실', level: 'A', body: '원인 가설을 AI 호출 지연, 파일 파싱 병목, 메모리 부족 셋으로 두고 프로파일을 떴습니다. AI 호출은 8초대로 정상이었고 파싱 단계에서 전체 시간의 92%가 소요돼 앞의 두 가설을 근거로 기각했습니다.' },
      output:     { tag: '사실', level: 'A', body: '파싱을 스트리밍 방식으로 전환하고 이미지 추출을 지연 처리했습니다. 동시 실행 수를 2개로 제한해 메모리 상한을 확보했고, 단계별 진행 상태를 남겨 실패 지점을 추적할 수 있게 했습니다.' },
      growth:     { tag: '사실', level: 'B', body: '분석 성공률이 71%에서 96%로 올랐고 평균 처리 시간은 45초에서 12초로 줄었습니다. 다만 100장 이상 문서는 여전히 분할 처리가 필요해 기술 부채로 남겨두고 문서화했습니다.' },
      competency: { tag: '추정', level: 'B', body: '추측으로 고치지 않고 재현 조건을 먼저 좁힌 뒤 계측 결과로 가설을 기각하는 방식으로 문제를 해결할 수 있습니다. 남은 한계를 숨기지 않고 기록해 다음 사람이 이어받게 합니다.' },
    },
  },
  pm: {
    title: '대화형 경험정리 MVP 기획 및 검증',
    meta: { 기간: '2025.10 - 2025.12', 역할: '프로덕트 기획 (단독)', '팀 구성': '개발 2명, 디자인 1명과 협업', '영향 범위': '신규 사용자 온보딩 전체', 목표: '첫 화면 이탈을 줄여 초안 완성까지 도달시키기' },
    keywords: [['가설 검증', 'planning'], ['사용자 인터뷰', 'soft'], ['우선순위 판단', 'planning'], ['이해관계자 설득', 'leadership']],
    sections: {
      intro:      { tag: '사실', level: 'A', body: '빈 양식을 채우게 하는 대신 AI가 질문을 던져 경험을 끌어내는 입력 방식입니다. 사용자가 형식을 몰라도 대화만으로 초안이 만들어지도록 설계했습니다.' },
      overview:   { tag: '사실', level: 'B', body: '기존 입력 화면은 STAR·5F·PMI 등 프레임워크 5종 중 하나를 먼저 고르게 했는데, 퍼널에서 이 화면의 이탈이 가장 높았습니다. 사용자가 프레임워크 이름 자체를 모른다는 신호로 읽었습니다.' },
      task:       { tag: '가정', level: 'B', body: '검증 전 가설은 "사용자는 형식을 고르지 못해 이탈한다. 질문에 답하는 방식이면 완주한다"였습니다. 실행 전에 성공 기준을 초안 완성률 40% 이상으로, 반증 기준을 대화 이탈이 기존보다 높을 때로 정했습니다.' },
      process:    { tag: '사실', level: 'A', body: '프레임워크 선택을 없애고 대화형을 기본 진입으로 두는 안과, 선택지를 3개로 줄이는 안을 비교했습니다. 후자는 인지 부하를 완전히 없애지 못한다고 판단해 기각했습니다. 개발 리소스가 부족해 대화 분기를 최소로 줄여 2주 안에 붙였습니다.' },
      output:     { tag: '사실', level: 'A', body: '대화형 입력을 기본 경로로 전환하고 프레임워크는 AI가 내용에 맞춰 선택하도록 했습니다. 직접 고르기는 고급 옵션으로 내렸습니다.' },
      growth:     { tag: '해석', level: 'C', body: '초안 완성률은 목표를 넘겼지만, 인터뷰에서 이탈이 형식 선택이 아니라 "무엇을 쓸지 모르는 것"에서도 발생했음을 확인했습니다. 가설이 절반만 맞았다는 뜻이라 다음에는 첫 질문 자체를 더 좁히기로 했습니다.' },
      competency: { tag: '추정', level: 'B', body: '실행 전에 성공·반증 기준을 정하고, 검증 결과로 처음 가설을 수정하는 방식으로 제품 결정을 내릴 수 있습니다. 리소스 제약 안에서 범위를 잘라 먼저 검증하는 판단이 가능합니다.' },
    },
  },
  marketer: {
    title: '취업 준비생 타깃 콘텐츠 캠페인 운영',
    meta: { 기간: '2025.09 - 2025.11', 역할: '콘텐츠·퍼포먼스 담당', '팀 구성': '마케팅 2명, 디자인 1명', '영향 범위': '신규 유입 전 채널', 목표: '가입이 아니라 첫 경험 작성까지 도달하는 유입 만들기' },
    keywords: [['타깃 정의', 'planning'], ['A/B 테스트', 'tech'], ['성과 분석', 'tech'], ['콘텐츠 기획', 'planning']],
    sections: {
      intro:      { tag: '사실', level: 'A', body: '경험정리 서비스의 초기 사용자를 모으기 위한 콘텐츠·유입 캠페인입니다. 커뮤니티, 검색 유입, 숏폼 세 채널을 운영했습니다.' },
      overview:   { tag: '사실', level: 'B', body: '가입 수는 늘었지만 첫 경험을 작성하지 않고 이탈하는 비율이 높았습니다. 유입량이 아니라 유입의 질이 문제라고 보고, 목표 지표를 가입에서 첫 작성으로 바꿨습니다.' },
      task:       { tag: '사실', level: 'B', body: '타깃을 "공고를 이미 보고 있는 3~4학년"으로 좁혔습니다. 근거는 온보딩 설문에서 이 집단의 첫 작성률이 다른 집단의 약 2배였다는 점입니다.' },
      process:    { tag: '사실', level: 'A', body: '세 채널에 같은 예산을 2주씩 집행했습니다. 소재는 "포트폴리오 예시 공개"와 "경험 정리법" 두 축으로 나눠 비교했고, 클릭이 아니라 첫 작성 전환을 기준으로 판단했습니다.' },
      output:     { tag: '사실', level: 'A', body: '예시 공개형 소재가 정리법 소재보다 첫 작성 전환이 높아 예산을 7:3으로 재배분했습니다. 숏폼은 유입은 가장 많았으나 작성 전환이 낮아 중단했습니다.' },
      growth:     { tag: '해석', level: 'C', body: '가입 후 첫 작성률이 개선됐지만, 같은 기간 서비스 온보딩도 함께 바뀌어 캠페인 단독 효과로 단정할 수 없습니다. 다음에는 채널별 홀드아웃 집단을 두고 증분을 확인하겠습니다.' },
      competency: { tag: '추정', level: 'B', body: '숫자를 성과로 보고하는 데 그치지 않고 그 숫자로 예산·소재·타깃 판단을 바꿀 수 있습니다. 성과의 귀인 한계를 스스로 밝히고 다음 검증을 설계합니다.' },
    },
  },
};

function ExperienceResultReplica({ role }) {
  const sample = EXPERIENCE_SAMPLES[role.id] || EXPERIENCE_SAMPLES.common;
  return (
    <div className="border-b border-surface-200 bg-white px-5 py-6 sm:px-8 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-[#002F6C] px-2 py-1 text-[10px] font-black tracking-[0.1em] text-white">경험정리 결과</span>
        <span className="text-[12px] font-semibold text-bluewood-500">{role.label} · 실제 서비스 화면과 동일한 구성</span>
      </div>

      <h2 className="text-[22px] font-extrabold leading-snug text-bluewood-950 sm:text-[25px]" style={{ wordBreak: 'keep-all' }}>
        {sample.title}
      </h2>

      {/* 프로젝트 메타 — 실제 화면의 보기 모드와 동일하게 한 줄 인라인으로 압축 */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-snug">
        {Object.entries(sample.meta).map(([label, value]) => (
          <span key={label} style={{ wordBreak: 'keep-all' }}>
            <span className="font-bold text-bluewood-400">{label}</span>{' '}
            <span className="font-semibold text-bluewood-700">{value}</span>
          </span>
        ))}
      </div>

      <div className="mt-7 space-y-7">
        {EXPERIENCE_SECTIONS.map(meta => {
          const item = sample.sections[meta.key];
          if (!item) return null;
          const ev = EVIDENCE_STYLE[item.level] || EVIDENCE_STYLE.D;
          return (
            <div key={meta.key} className="flex gap-3 sm:gap-5">
              <span className="w-6 shrink-0 pt-0.5 text-right text-[14px] font-black tabular-nums" style={{ color: '#002F6C' }}>{meta.num}</span>
              <div className="min-w-0 flex-1">
                <div className="mb-3.5 flex items-center gap-3.5">
                  <h3 className="flex-shrink-0 text-[19px] font-extrabold leading-snug tracking-tight text-bluewood-900 sm:text-[21px]">{meta.label}</h3>
                  <span className="h-px flex-1 bg-surface-200" />
                </div>
                <p className="mb-2 text-[12px] font-semibold text-bluewood-400">{meta.subtitle}</p>
                <p className="text-[14.5px] leading-relaxed text-bluewood-800" style={{ wordBreak: 'keep-all' }}>{item.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md border border-surface-200 bg-surface-50 px-2 py-0.5 text-[11px] font-bold text-bluewood-600">{item.tag}</span>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${ev.cls}`}>{ev.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 핵심 역량 한눈에 보기 — 실제 화면과 같은 카테고리 구분 */}
      <div className="mt-8 rounded-2xl border border-surface-200 bg-surface-50/60 px-5 py-5">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-primary-500">Competency</p>
        <h3 className="mt-1 text-[17px] font-black text-bluewood-950">핵심 역량 한눈에 보기</h3>
        <p className="mt-1 text-[12px] text-bluewood-500">본문에서 근거가 확인된 역량만 추출합니다.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sample.keywords.map(([name, cat]) => {
            const st = KW_STYLE[cat] || KW_STYLE.tech;
            return (
              <span key={name} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold ring-1 ${st.cls}`}>
                {name}
                <span className="text-[10.5px] font-semibold opacity-70">{st.label}</span>
              </span>
            );
          })}
        </div>
      </div>

      <p className="mt-5 text-[11px] font-medium text-bluewood-400">
        ※ 각 섹션에는 주장 성격(사실·추정·가정·해석)과 근거 등급(A~D)이 함께 기록됩니다. 실제 서비스에서는 업로드한 자료에서 자동으로 판정됩니다.
      </p>
    </div>
  );
}

/**
 * roleId를 넘기면 해당 직무 하나만 보여주는 예시 페이지가 된다(탭 숨김).
 * 직무별로 URL을 분리해 각각 검색 색인·공유가 가능하게 하려는 용도다. (/example4~6)
 * 넘기지 않으면 기존처럼 전 직무 탭 화면으로 동작한다. (/resultt)
 */
export default function Resultt({ roleId }) {
  const locked = ROLES.some(item => item.id === roleId);
  const [selectedRole, setSelectedRole] = useState(() => {
    if (locked) return roleId;
    const requested = new URLSearchParams(window.location.search).get('job');
    return ROLES.some(item => item.id === requested) ? requested : 'dev';
  });
  const role = ROLES.find(item => item.id === (locked ? roleId : selectedRole)) || ROLES[0];

  useEffect(() => {
    if (!locked) return undefined;
    const previous = document.title;
    document.title = `${role.label} 경험정리 예시 — FitPoly`;
    window.scrollTo(0, 0);
    return () => { document.title = previous; };
  }, [locked, role.label]);

  return (
    <main className="min-h-screen bg-[#f3f6fa] text-slate-900">
      <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 lg:px-8">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-950 px-2.5 py-1 text-[9.5px] font-black tracking-[0.14em] text-white">FitPoly</span>
              <span className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[9.5px] font-black tracking-[0.1em] text-cyan-700">IR OUTPUT DEMO</span>
            </div>
            <h1 className="mt-2 text-[23px] font-black tracking-[-0.04em] text-slate-950 sm:text-[28px]">
              {locked
                ? <><span style={{ color: role.accent }}>{role.label}</span> 경험정리 결과 예시</>
                : <>경험정리 결과가 <span className="text-[#002f6c]">직무별 포트폴리오 화면</span>으로</>}
            </h1>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              {locked
                ? `${role.subtitle}`
                : '직무를 선택하면 실제 서비스에서 생성되는 대표 시각 산출물을 한눈에 확인할 수 있습니다.'}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Sparkles size={16} className="text-cyan-600" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">Output coverage</p>
              <p className="mt-0.5 text-[14px] font-black text-slate-800">공통 + 9개 직무 · 30+ 시각 산출물</p>
            </div>
          </div>
        </header>

        {!locked && <RoleTabs activeId={selectedRole} onChange={setSelectedRole} />}

        <div className={`my-2 flex items-center justify-center gap-2 text-[8.5px] font-bold text-slate-400 ${locked ? 'hidden' : ''}`}>
          <Clock3 size={11} />
          <span>직무 탭을 누르면 결과 화면이 즉시 전환됩니다</span>
          <ArrowRight size={11} />
          <span style={{ color: role.accent }}>{role.label} 산출물 표시 중</span>
        </div>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-[#f8fafc] shadow-[0_24px_80px_rgba(15,23,42,0.09)]">
          {/* 실제 서비스 화면과 같은 배율로 보여준다. (이전에는 0.65배로 축소해 실제와 크기가 달랐다) */}
          <style>{`
            .resultt-output-scale { width: 100%; }
          `}</style>
          <div className="resultt-output-scale">
            <ResultHeader role={role} />
            <ExperienceResultReplica role={role} />
            {role.id === 'common' ? (
              <CommonDashboard />
            ) : role.id === 'dev' ? (
              <DeveloperDashboard />
            ) : role.id === 'pm' ? (
              <PmExperienceDashboard />
            ) : role.id === 'marketer' ? (
              <MarketerDashboard />
            ) : (
              <GenericDashboard role={role} />
            )}
          </div>
        </section>

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[9px] font-semibold text-slate-400">
          <p>※ IR 설명용 예시 화면이며, 실제 서비스에서는 사용자의 문서·답변·GitHub 등 근거 자료로 구성됩니다.</p>
          <p>FitPoly · 경험에서 증거를 찾고, 직무 언어로 보여줍니다.</p>
        </footer>
      </div>
    </main>
  );
}
