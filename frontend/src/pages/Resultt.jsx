import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Briefcase,
  CheckCircle2,
  Clock3,
  Code2,
  Database,
  FileCode2,
  Github,
  GitCommit,
  Layers3,
  Megaphone,
  Network,
  Palette,
  ServerCog,
  Sparkles,
  Target,
  TrendingUp,
  Users,
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
    id: 'aiml',
    label: 'AI·ML',
    short: 'ENGINEER',
    icon: BrainCircuit,
    accent: '#7c3aed',
    activeClass: 'border-violet-600 bg-violet-600 text-white shadow-violet-200',
    softClass: 'border-violet-100 bg-violet-50 text-violet-700',
    title: '직무 역량 분류 모델 실험 및 서빙',
    subtitle: '데이터셋, 모델 성능, 학습 곡선과 추론 파이프라인을 하나의 결과로 정리',
    metrics: [
      { label: 'Macro F1', value: '0.86', note: 'Baseline 0.68' },
      { label: '미분류율', value: '7%', note: '15%p 감소' },
      { label: '추론 지연', value: '1.9초', note: '60% 단축' },
    ],
    showcase: {
      techList: ['Python', 'PyTorch', 'KoELECTRA', 'FAISS', 'FastAPI'],
      keyExps: [{
        title: '역량 분류 모델',
        jobData: {
          model: 'KoELECTRA + LLM Router',
          metrics: [
            { name: 'Macro F1', value: '0.86', baseline: '0.68' },
            { name: 'Recall', value: '0.83', baseline: '0.65' },
            { name: '미분류율', value: '7%', baseline: '22%' },
          ],
        },
      }],
      visuals: {},
    },
  },
  {
    id: 'da',
    label: '데이터 분석',
    short: 'ANALYST',
    icon: Database,
    accent: '#0f766e',
    activeClass: 'border-teal-600 bg-teal-600 text-white shadow-teal-200',
    softClass: 'border-teal-100 bg-teal-50 text-teal-700',
    title: '경험 작성 퍼널 이탈 원인 분석',
    subtitle: '이벤트 정의부터 세그먼트 분석, A/B 검증과 제품 제안까지 연결',
    metrics: [
      { label: '작성 완료율', value: '64%', note: '+26%p' },
      { label: '3단계 이탈률', value: '19%', note: '22%p 감소' },
      { label: '재방문율', value: '29%', note: '+12%p' },
    ],
    showcase: {
      visuals: {
        kpis: [
          { label: '작성 완료율', value: '64%' },
          { label: '3단계 이탈률', value: '19%' },
          { label: '재방문율', value: '29%' },
        ],
      },
      keyExps: [{
        title: '답변 예시 노출 실험',
        jobData: { control: '38%', variant: '64%', significance: 'p < 0.01 · 통계적으로 유의' },
      }],
    },
  },
  {
    id: 'devops',
    label: 'DevOps',
    short: 'INFRA',
    icon: ServerCog,
    accent: '#ea580c',
    activeClass: 'border-orange-600 bg-orange-600 text-white shadow-orange-200',
    softClass: 'border-orange-100 bg-orange-50 text-orange-700',
    title: '배포 파이프라인과 서비스 관측성 개선',
    subtitle: '운영 지표, CI/CD 흐름과 장애 대응 결과를 실제 콘솔 형태로 시각화',
    metrics: [
      { label: '가용성', value: '99.95%', note: '최근 30일' },
      { label: '배포 시간', value: '7분', note: '71% 단축' },
      { label: 'MTTR', value: '14분', note: '73% 단축' },
    ],
    showcase: {
      visuals: {
        gauges: [
          { label: '가용성', value: 99.95, unit: '%' },
          { label: 'p95 지연', value: 182, unit: 'ms' },
          { label: 'RPS', value: 1.2, unit: 'k' },
        ],
        process: [
          { label: 'Build' },
          { label: 'Test' },
          { label: 'Deploy' },
          { label: 'Health Check' },
          { label: 'Monitor' },
        ],
      },
    },
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
    id: 'designer',
    label: '프로덕트 디자인',
    short: 'UX / UI',
    icon: Palette,
    accent: '#db2777',
    activeClass: 'border-pink-600 bg-pink-600 text-white shadow-pink-200',
    softClass: 'border-pink-100 bg-pink-50 text-pink-700',
    title: '복잡한 경험 입력 화면의 단계형 UX 개선',
    subtitle: '리서치부터 프로토타입, 디자인 토큰과 사용성 검증 결과까지 시각화',
    metrics: [
      { label: '과업 성공률', value: '84%', note: '+38%p' },
      { label: '입력 시간', value: '11분', note: '59% 단축' },
      { label: 'SUS 점수', value: '78점', note: '+24점' },
    ],
    showcase: {
      visuals: {
        compare: [{ label: '과업 성공률', before: '46%', after: '84%' }],
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
  {
    id: 'hr',
    label: 'HR·채용',
    short: 'PEOPLE',
    icon: Users,
    accent: '#d97706',
    activeClass: 'border-amber-600 bg-amber-600 text-white shadow-amber-200',
    softClass: 'border-amber-100 bg-amber-50 text-amber-700',
    title: '지원자 경험 기반 채용 프로세스 개선',
    subtitle: '지원 퍼널, 단계별 전환과 면접 일정 자동화 효과를 ATS 보드로 정리',
    metrics: [
      { label: '지원 완료율', value: '81%', note: '+19%p' },
      { label: '반복 문의', value: '11건', note: '68% 감소' },
      { label: '온보딩 만족도', value: '4.5점', note: '+1.1점' },
    ],
    showcase: {
      visuals: {
        funnel: [
          { label: '지원 시작', value: 520 },
          { label: '지원 제출', value: 421 },
          { label: '서류 통과', value: 148 },
          { label: '면접', value: 62 },
          { label: '최종 합격', value: 18 },
        ],
        compare: [{ label: '채용 리드타임', before: '32일', after: '14일' }],
      },
    },
  },
  {
    id: 'sales',
    label: 'B2B 영업',
    short: 'SALES / BD',
    icon: Briefcase,
    accent: '#059669',
    activeClass: 'border-emerald-600 bg-emerald-600 text-white shadow-emerald-200',
    softClass: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    title: '대학 취업센터 대상 파일럿 제안 및 계약',
    subtitle: 'ICP, 아웃바운드 시퀀스와 고객 ROI를 영업 워크스페이스로 변환',
    metrics: [
      { label: '유효 리드', value: '18개', note: '42개 기관 조사' },
      { label: '미팅 전환율', value: '44%', note: '8개 기관' },
      { label: '첫 계약', value: '1,200만', note: '연간 계약' },
    ],
    showcase: {
      keyExps: [
        { jobData: { client: '학생 3천 명 이상 대학' } },
        { jobData: { client: '취업상담 인력 5명 이하' } },
        { jobData: { client: '포트폴리오 교육 운영 기관' } },
      ],
      visuals: {},
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

export default function Resultt() {
  const [selectedRole, setSelectedRole] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('job');
    return ROLES.some(item => item.id === requested) ? requested : 'dev';
  });
  const role = ROLES.find(item => item.id === selectedRole) || ROLES[0];

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
              경험정리 결과가 <span className="text-[#002f6c]">직무별 포트폴리오 화면</span>으로
            </h1>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              직무를 선택하면 실제 서비스에서 생성되는 대표 시각 산출물을 한눈에 확인할 수 있습니다.
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

        <RoleTabs activeId={selectedRole} onChange={setSelectedRole} />

        <div className="my-2 flex items-center justify-center gap-2 text-[8.5px] font-bold text-slate-400">
          <Clock3 size={11} />
          <span>직무 탭을 누르면 결과 화면이 즉시 전환됩니다</span>
          <ArrowRight size={11} />
          <span style={{ color: role.accent }}>{role.label} 산출물 표시 중</span>
        </div>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-[#f8fafc] shadow-[0_24px_80px_rgba(15,23,42,0.09)]">
          <style>{`
            .resultt-output-scale {
              width: 153.8462%;
              transform: scale(0.65);
              transform-origin: top left;
            }
            @media (max-width: 1023px) {
              .resultt-output-scale { width: 100%; transform: none; }
            }
          `}</style>
          <div className="resultt-output-scale">
            <ResultHeader role={role} />
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
