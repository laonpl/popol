import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Send, Check, FileText, Link2, Github, Paperclip,
  Sparkles, Save, Pencil, TrendingUp, ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import useExperienceStore, { JOB_CATEGORIES } from '../../stores/experienceStore';
import { importFileUpload, importFromUrl } from '../../services/importAI';
import api from '../../services/api';
import { buildDraftStructuredResult, cleanRawText } from '../../utils/experienceDraft';
import { stripMd } from '../../utils/textUtils';

/* ── 값을 표시용 텍스트로 정규화 (AI 응답이 배열/객체일 수 있음) ── */
function asText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('\n');
  if (typeof value === 'object') return Object.values(value).map(asText).filter(Boolean).join('\n');
  return String(value).trim();
}

/* 섹션이 비어 있거나 초안 플레이스홀더인지 판정 */
function isWeak(value) {
  const t = asText(value);
  if (!t || t.length < 30) return true;
  return /보강해 주세요|입력해 주세요|초안을 만들었습니다|초안입니다/.test(t);
}

/* 표시용 텍스트 정규화 — 들여쓰기·마크다운·과도한 공백 제거 (채팅/초안 공용) */
function displayText(value) {
  return stripMd(asText(value))
    .split('\n')
    .map(line => line.replace(/^[\s ]+/, '').replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ── 분야별 자료 수집 프리셋 — 사람들이 경험을 자주 남겨두는 곳에 맞춤 ── */
const MATERIAL_PRESETS = {
  dev: {
    intro: '개발 경험은 GitHub 리포지토리와 README·기술문서에 가장 잘 남아 있어요. GitHub 아이디를 함께 입력하면 내 커밋 기여도·트러블슈팅·코드까지 분석해드려요.',
    accept: '.pdf,.doc,.docx,.md,.txt,image/*',
    filesHint: 'README · 기술문서 · 발표자료 (PDF / DOCX / MD / 이미지)',
    links: [
      { key: 'github', label: 'GitHub 리포지토리', placeholder: 'https://github.com/username/repo', source: 'github', icon: Github },
      { key: 'blog', label: '기술 블로그 (선택)', placeholder: 'https://velog.io/... 또는 블로그 글 주소', source: 'blog', icon: Link2 },
    ],
  },
  aiml: {
    intro: 'AI/ML 경험은 코드 저장소와 실험 리포트에 잘 남아 있어요. GitHub 아이디를 함께 입력하면 내 커밋 기여도·코드까지 분석해드려요.',
    accept: '.pdf,.doc,.docx,.md,.txt,image/*',
    filesHint: '실험 리포트 · 논문/발표자료 (PDF / DOCX / MD / 이미지)',
    links: [
      { key: 'github', label: 'GitHub 리포지토리', placeholder: 'https://github.com/username/repo', source: 'github', icon: Github },
      { key: 'blog', label: '블로그/아카이브 (선택)', placeholder: 'https://...', source: 'blog', icon: Link2 },
    ],
  },
  da: {
    intro: '데이터 분석 경험은 분석 리포트나 대시보드 정리 문서에 잘 남아 있어요. 리포트 파일이나 Notion 링크를 올려주세요.',
    accept: '.pdf,.doc,.docx,.md,.txt,image/*',
    filesHint: '분석 리포트 · 대시보드 캡처 (PDF / DOCX / 이미지)',
    links: [
      { key: 'notion', label: 'Notion 페이지', placeholder: 'https://notion.so/...', source: 'notion', icon: Link2 },
      { key: 'blog', label: '블로그/기타 링크 (선택)', placeholder: 'https://...', source: 'blog', icon: Link2 },
    ],
  },
  devops: {
    intro: '인프라/데브옵스 경험은 GitHub과 구축 문서에 잘 남아 있어요. 아키텍처 문서나 리포지토리 링크를 올려주세요.',
    accept: '.pdf,.doc,.docx,.md,.txt,image/*',
    filesHint: '아키텍처 문서 · 구축 기록 (PDF / DOCX / 이미지)',
    links: [
      { key: 'github', label: 'GitHub 리포지토리', placeholder: 'https://github.com/username/repo', source: 'github', icon: Github },
      { key: 'blog', label: '기술 블로그 (선택)', placeholder: 'https://...', source: 'blog', icon: Link2 },
    ],
  },
  pm: {
    intro: '기획 경험은 기획서·PRD·회고 문서에 가장 잘 남아 있어요. 문서 파일이나 Notion 링크를 올려주세요.',
    accept: '.pdf,.doc,.docx,.md,.txt,image/*',
    filesHint: '기획서 · PRD · 회고 문서 (PDF / DOCX)',
    links: [
      { key: 'notion', label: 'Notion 페이지', placeholder: 'https://notion.so/...', source: 'notion', icon: Link2 },
      { key: 'blog', label: '서비스/기타 링크 (선택)', placeholder: 'https://...', source: 'blog', icon: Link2 },
    ],
  },
  designer: {
    intro: '디자인 경험은 포트폴리오 시안과 케이스 스터디에 잘 남아 있어요. 시안 이미지나 PDF, 링크를 올려주세요.',
    accept: 'image/*,.pdf',
    filesHint: '시안 · 포트폴리오 (이미지 / PDF)',
    links: [
      { key: 'behance', label: 'Behance / 포트폴리오 링크', placeholder: 'https://behance.net/...', source: 'blog', icon: Link2 },
      { key: 'notion', label: 'Notion 페이지 (선택)', placeholder: 'https://notion.so/...', source: 'notion', icon: Link2 },
    ],
  },
  marketer: {
    intro: '마케팅 경험은 캠페인 리포트와 콘텐츠 링크에 잘 남아 있어요. 성과 리포트나 캠페인 링크를 올려주세요.',
    accept: '.pdf,.doc,.docx,image/*',
    filesHint: '캠페인 리포트 · 성과 자료 (PDF / DOCX / 이미지)',
    links: [
      { key: 'campaign', label: '캠페인/콘텐츠 링크', placeholder: 'https://...', source: 'blog', icon: Link2 },
      { key: 'notion', label: 'Notion 페이지 (선택)', placeholder: 'https://notion.so/...', source: 'notion', icon: Link2 },
    ],
  },
  hr: {
    intro: '인사/채용 경험은 프로세스 문서와 온보딩 자료에 잘 남아 있어요. 문서 파일이나 Notion 링크를 올려주세요.',
    accept: '.pdf,.doc,.docx,.md,.txt,image/*',
    filesHint: '프로세스 문서 · 온보딩 자료 (PDF / DOCX / 이미지)',
    links: [
      { key: 'notion', label: 'Notion 페이지', placeholder: 'https://notion.so/...', source: 'notion', icon: Link2 },
      { key: 'blog', label: '기타 링크 (선택)', placeholder: 'https://...', source: 'blog', icon: Link2 },
    ],
  },
  sales: {
    intro: '세일즈/사업개발 경험은 제안서와 성과 정리 문서에 잘 남아 있어요. 문서 파일이나 링크를 올려주세요.',
    accept: '.pdf,.doc,.docx,.md,.txt,image/*',
    filesHint: '제안서 · 성과 정리 문서 (PDF / DOCX / 이미지)',
    links: [
      { key: 'notion', label: 'Notion 페이지', placeholder: 'https://notion.so/...', source: 'notion', icon: Link2 },
      { key: 'blog', label: '기타 링크 (선택)', placeholder: 'https://...', source: 'blog', icon: Link2 },
    ],
  },
  common: {
    intro: '가지고 있는 자료(이력서·활동 기록·문서)를 올리거나, 아래에 편하게 적어주세요. 제가 읽고 초안을 만들게요.',
    accept: '.pdf,.doc,.docx,.md,.txt,image/*',
    filesHint: '이력서 · 활동 기록 · 문서 (PDF / DOCX / 이미지)',
    links: [
      { key: 'notion', label: 'Notion 페이지 (선택)', placeholder: 'https://notion.so/...', source: 'notion', icon: Link2 },
      { key: 'blog', label: '기타 링크 (선택)', placeholder: 'https://...', source: 'blog', icon: Link2 },
    ],
  },
};

/* ── 초안 섹션 정의 + 채우기 질문 ── */
const SECTION_DEFS = [
  { key: 'intro', label: '프로젝트 소개', q: '이 경험을 한두 문장으로 소개한다면 어떻게 말할 수 있을까요? 시작하게 된 계기도 좋아요.' },
  { key: 'overview', label: '프로젝트 개요', q: '프로젝트의 배경과 목표는 무엇이었나요?' },
  { key: 'task', label: '진행한 일', q: '어떤 문제를 인식했고, 본인이 직접 맡아서 한 일은 무엇인가요?' },
  { key: 'process', label: '과정', q: '진행하면서 가장 어려웠던 지점은 무엇이었고, 어떻게 해결했나요?' },
  { key: 'output', label: '결과물', q: '최종 결과물과 성과는 무엇인가요? 수치(%, 시간, 건수 등)가 있으면 함께 적어주세요.' },
  { key: 'growth', label: '성장한 점', q: '이 경험을 통해 배우거나 성장한 점은 무엇인가요?' },
  { key: 'competency', label: '나의 역량', q: '이 경험에서 드러난 본인의 역량은 무엇이라고 생각하나요?' },
];

const JOB_LABELS = Object.fromEntries(
  JOB_CATEGORIES.flatMap(g => g.items.map(it => [it.value, it.label]))
);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 답변 시작을 도와주는 빠른 문구 (탭하면 입력창에 삽입) */
const STARTERS = [
  { label: '+ 수치', text: '수치로 말하면 ' },
  { label: '+ 내가 한 일', text: '제가 직접 한 건 ' },
  { label: '+ 이유', text: '그렇게 한 이유는 ' },
  { label: '+ 어려웠던 점', text: '가장 어려웠던 건 ' },
];

/* 진행 단계 표시 (챗 헤더 스테퍼) */
const FLOW_STEPS = ['분야 선택', '기본 정보', '자료 입력', '핵심 경험', '초안 생성', '대화로 완성'];
const PHASE_STEP = { field: 0, basics: 1, materials: 2, extracting: 3, moments: 3, building: 4, fill: 5, saving: 5 };

function Spinner({ light = false, size = 16 }) {
  return (
    <span
      className={`inline-block rounded-full animate-spin ${light ? 'border-white/40 border-t-white' : 'border-primary-200 border-t-primary-600'}`}
      style={{ width: size, height: size, borderWidth: 2 }}
    />
  );
}

/* 챗봇 얼굴 — 눈 2개(주기적으로 깜빡임) + 텍스트 라인 입 */
function BotFace({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <ellipse className="bot-eye" cx="17" cy="18" rx="3" ry="4.2" fill="#3c4551" />
      <ellipse className="bot-eye" cx="31" cy="18" rx="3" ry="4.2" fill="#3c4551" style={{ animationDelay: '0.06s' }} />
      <rect x="13" y="29" width="22" height="2.8" rx="1.4" fill="#c9d2dc" />
      <rect x="13" y="34.5" width="15" height="2.8" rx="1.4" fill="#c9d2dc" />
    </svg>
  );
}

/* AI 아바타 — 챗봇 캐릭터, 대화 내내 숨쉬듯 떠 있는 모션 */
function AiAvatar() {
  return (
    <span className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-[10px] bg-white border border-surface-200 shadow-sm mt-0.5 animate-bot-idle">
      <BotFace size={23} />
    </span>
  );
}

/* 히어로 — 챗봇 위로 자료 아이콘들이 둥둥 떠오르는 장면 */
const HERO_FLOATERS = [
  { cls: 'left-1 top-16', delay: 0,   type: 'doc' },
  { cls: 'left-12 top-3', delay: 0.6, type: 'img' },
  { cls: 'left-1/2 -translate-x-1/2 top-0', delay: 1.1, type: 'doc' },
  { cls: 'right-12 top-4', delay: 0.3, type: 'sq' },
  { cls: 'right-0 top-16', delay: 0.9, type: 'doc' },
  { cls: 'left-[86px] top-[104px]', delay: 1.5, type: 'dot' },
  { cls: 'right-[86px] top-[100px]', delay: 0.4, type: 'dot' },
];

function HeroFloater({ type }) {
  if (type === 'doc') {
    return (
      <div className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-xl bg-white border border-surface-200 shadow-sm">
        <span className="h-[3px] w-5 rounded-full bg-surface-200" />
        <span className="h-[3px] w-3.5 rounded-full bg-surface-200" />
      </div>
    );
  }
  if (type === 'img') {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-surface-200 shadow-sm">
        <span className="rounded-md bg-primary-100" style={{ height: 18, width: 20 }} />
      </div>
    );
  }
  if (type === 'sq') return <div className="h-8 w-8 rounded-lg bg-amber-100/90 border border-amber-100 shadow-sm" />;
  return <div className="h-2.5 w-2.5 rounded-full bg-surface-300" />;
}

function HeroBot() {
  return (
    <div className="relative mx-auto mb-8 h-44 w-full max-w-[320px]">
      {HERO_FLOATERS.map((f, i) => (
        <div key={i} className={`absolute ${f.cls}`}>
          <div className="animate-float-y" style={{ animationDelay: `${f.delay}s` }}>
            <HeroFloater type={f.type} />
          </div>
        </div>
      ))}
      {/* 챗봇 본체 */}
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 flex h-24 w-24 items-center justify-center rounded-[26px] bg-white border border-surface-200 shadow-[0_18px_44px_rgba(49,65,87,0.14)] animate-bot-idle">
        {/* 머리 위 따뜻한 글로우 */}
        <div className="pointer-events-none absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rounded-full bg-amber-100/90 blur-md" />
        <BotFace size={62} />
      </div>
    </div>
  );
}

/* 부드러운 바 로더 — 로딩 단계용 */
function BarsLoader({ height = 14 }) {
  return (
    <span className="flex items-center gap-[2.5px]" style={{ height }}>
      {[0, 1, 2].map(i => (
        <span key={i} className="w-[3px] rounded-full bg-primary-500 loader-bar" style={{ height: '100%', animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

/* 타닥타닥 타이핑 효과 — 초안이 실시간으로 고쳐지는 느낌 */
function TypewriterText({ text, startIndex = 0, className, style }) {
  const [len, setLen] = useState(() => Math.min(startIndex, text.length));
  useEffect(() => {
    const from = Math.min(startIndex, text.length);
    setLen(from);
    if (text.length <= from) return;
    // 길이에 관계없이 1.2초 내외로 끝나도록 스텝 조절
    const step = Math.max(1, Math.round((text.length - from) / 55));
    const iv = setInterval(() => {
      setLen(prev => {
        const next = prev + step;
        if (next >= text.length) { clearInterval(iv); return text.length; }
        return next;
      });
    }, 20);
    return () => clearInterval(iv);
  }, [text, startIndex]);
  const done = len >= text.length;
  return (
    <p className={className} style={style}>
      {text.slice(0, len)}
      {!done && <span className="type-caret" />}
    </p>
  );
}

/* AI 말풍선 */
function AiBubble({ children }) {
  return (
    <div className="flex items-start gap-3 animate-fadeIn">
      <AiAvatar />
      <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-surface-100/70 px-4 py-3 text-[14px] text-bluewood-800 leading-relaxed whitespace-pre-wrap" style={{ wordBreak: 'keep-all' }}>
        {children}
      </div>
    </div>
  );
}

/* AI 입력 중 인디케이터 */
function TypingBubble() {
  return (
    <div className="flex items-start gap-3 animate-fadeIn">
      <AiAvatar />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-surface-100/70 px-4 py-[15px]">
        {[0, 1, 2].map(i => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-bluewood-300 animate-chat-typing" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

/* 사용자 말풍선 */
function UserBubble({ children }) {
  return (
    <div className="flex justify-end animate-fadeIn">
      <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary-600 text-white px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap shadow-sm shadow-primary-600/20">
        {children}
      </div>
    </div>
  );
}

/* 진행 단계 스테퍼 — 지금 어디쯤인지 한눈에 */
function FlowStepper({ phase }) {
  const current = PHASE_STEP[phase] ?? 0;
  return (
    /* ring이 잘리지 않도록 스크롤 영역에 여유 패딩 확보 */
    <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 py-1">
      {FLOW_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-1 flex-shrink-0">
            {i > 0 && <span className={`h-px w-4 sm:w-6 ${done || active ? 'bg-primary-300' : 'bg-surface-200'}`} />}
            <div className="flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black transition-all ${
                done ? 'bg-primary-600 text-white' :
                active ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/40' :
                'bg-surface-100 text-bluewood-300'
              }`}>
                {done ? <Check size={11} /> : i + 1}
              </span>
              <span className={`text-[11.5px] font-semibold whitespace-nowrap ${active ? 'text-primary-700' : done ? 'text-bluewood-500' : 'text-bluewood-300'} hidden sm:inline`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* 초안 완성도 링 (우측 패널 인포그래픽) */
function ProgressRing({ percent }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-2" title={`초안 완성도 ${percent}%`}>
      <div className="relative">
        <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
          <circle
            cx="18" cy="18" r={r} fill="none" stroke="#002F6C" strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-primary-700 tabular-nums">{percent}</span>
      </div>
      <div className="leading-tight">
        <p className="text-[11px] font-bold text-bluewood-600">완성도</p>
        <p className="text-[10px] text-bluewood-300">{percent >= 80 ? '거의 다 됐어요!' : percent >= 50 ? '절반 넘었어요' : '채워가는 중'}</p>
      </div>
    </div>
  );
}

/* ── 성과 수치 가이드 위젯 — 이전/이후/단위로 간단히 채우기 ── */
const METRIC_SUGGESTIONS = ['응답 속도 40% 개선', '작업 시간 3일 → 반나절 단축', '사용자 1,200명 달성', '비용 300만원 절감'];
const METRIC_UNITS = ['%', '배', 'ms', '초', '건', '명', '만원'];

function MetricWidget({ target, onSubmit, onSkip }) {
  const [mode, setMode] = useState('guided'); // guided | free
  const [beforeVal, setBeforeVal] = useState('');
  const [afterVal, setAfterVal] = useState('');
  const [unit, setUnit] = useState('%');
  const [freeText, setFreeText] = useState('');

  const preview = beforeVal && afterVal
    ? `${beforeVal}${unit} → ${afterVal}${unit}`
    : afterVal ? `${afterVal}${unit} 달성` : '';

  const targetTitle = displayText(target?.title);
  const targetSnippet = displayText(target?.result || target?.context || target?.action);

  return (
    <div className="ml-11 mt-2 rounded-xl border border-surface-200 bg-surface-50/50 p-4 space-y-3 animate-fadeIn">
      {/* 어떤 핵심 경험을 채우는지 명확하게 보여주는 대상 카드 */}
      {targetTitle && (
        <div className="rounded-xl bg-white border-l-4 border border-primary-200 border-l-primary-600 px-3.5 py-2.5">
          <p className="text-[10.5px] font-bold text-primary-600 uppercase tracking-wider mb-1">지금 채우는 핵심 경험</p>
          <p className="text-[13px] font-bold text-bluewood-900 leading-snug" style={{ wordBreak: 'keep-all' }}>{targetTitle}</p>
          {targetSnippet && (
            <p className="mt-1 text-[12px] text-bluewood-400 leading-relaxed line-clamp-2" style={{ wordBreak: 'keep-all' }}>{targetSnippet}</p>
          )}
        </div>
      )}
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-primary-600">
        <TrendingUp size={13} /> 정확하지 않아도 괜찮아요 — 대략적인 수치면 충분해요
      </div>

      <div className="flex flex-wrap gap-1.5">
        {METRIC_SUGGESTIONS.map(sg => (
          <button key={sg} type="button" onClick={() => { setFreeText(sg); setMode('free'); }}
            className="px-2.5 py-1 rounded-full border border-surface-200 bg-white text-[11.5px] font-semibold text-bluewood-500 hover:border-primary-300 hover:text-primary-600 transition-colors">
            {sg}
          </button>
        ))}
      </div>

      {mode === 'guided' ? (
        <div className="rounded-xl border border-surface-200 bg-white px-3.5 py-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-bluewood-300 w-14 flex-shrink-0">이전 (선택)</span>
            <input value={beforeVal} onChange={e => setBeforeVal(e.target.value)} placeholder="예: 800"
              className="flex-1 text-[13px] text-bluewood-700 border-b border-surface-200 px-1 py-1 outline-none focus:border-primary-400 bg-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-bluewood-600 w-14 flex-shrink-0">이후 *</span>
            <input value={afterVal} onChange={e => setAfterVal(e.target.value)} placeholder="예: 480"
              className="flex-1 text-[13px] text-bluewood-800 border-b border-surface-200 px-1 py-1 outline-none focus:border-primary-400 bg-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-bluewood-300 w-14 flex-shrink-0">단위</span>
            <div className="flex flex-wrap gap-1">
              {METRIC_UNITS.map(u => (
                <button key={u} type="button" onClick={() => setUnit(u)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                    unit === u ? 'bg-primary-600 text-white border-primary-600' : 'border-surface-200 text-bluewood-400 hover:border-primary-300'
                  }`}>{u}</button>
              ))}
            </div>
          </div>
          {preview && (
            <p className="rounded-lg bg-primary-50/70 border border-primary-100 px-3 py-1.5 text-[12.5px] font-bold text-primary-700 animate-pop-in">
              ✦ {preview}
            </p>
          )}
        </div>
      ) : (
        <textarea
          value={freeText}
          onChange={e => setFreeText(e.target.value)}
          rows={2}
          placeholder="기억나는 성과를 자유롭게 적어주세요"
          className="w-full resize-y rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200 placeholder:text-bluewood-300"
        />
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setMode(m => m === 'guided' ? 'free' : 'guided')}
          className="text-[11.5px] font-semibold text-bluewood-400 hover:text-primary-600 underline underline-offset-2 transition-colors">
          {mode === 'guided' ? '직접 쓰기' : '수치로 채우기'}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onSkip} className="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-bluewood-400 hover:bg-surface-100 transition-colors">건너뛰기</button>
          <button
            type="button"
            onClick={() => {
              const text = mode === 'guided' ? preview : freeText.trim();
              if (text) onSubmit(text);
            }}
            disabled={mode === 'guided' ? !afterVal.trim() : !freeText.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-[13px] font-bold hover:bg-primary-700 disabled:opacity-40 transition-colors"
          >
            추가하기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 채팅 내 자료 입력 위젯 (분야 프리셋 반영) ── */
function MaterialsWidget({ preset, onSubmit, busy }) {
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState({});
  const [ghUser, setGhUser] = useState(''); // GitHub 아이디 — 내 커밋 기여도·코드 분석용
  const [text, setText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (picked) => {
    if (picked.length === 0) return;
    setFiles(prev => {
      if (prev.length + picked.length > 10) toast.error('파일은 최대 10개까지 첨부할 수 있어요');
      return [...prev, ...picked].slice(0, 10);
    });
  };

  const hasInput = files.length > 0 || text.trim() || Object.values(links).some(v => v?.trim());

  return (
    <div className="ml-11 mt-2 rounded-xl border border-surface-200 bg-surface-50/50 p-4 space-y-3 animate-fadeIn">
      {/* 파일 */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
        onDrop={e => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files || [])); }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-xl border border-dashed px-4 py-3.5 cursor-pointer transition-colors ${
          isDragging ? 'border-primary-400 bg-primary-50' : 'border-surface-300 bg-white hover:bg-surface-50'
        }`}
      >
        <input
          ref={fileInputRef} type="file" multiple accept={preset.accept}
          onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
          className="hidden"
        />
        <div className="flex items-center gap-2.5">
          <Paperclip size={15} className="text-primary-600 flex-shrink-0" />
          <span className="text-[12.5px] text-bluewood-500">
            {isDragging ? '여기에 놓으세요' : preset.filesHint}
          </span>
        </div>
        {files.length > 0 && (
          <ul className="mt-2.5 space-y-1.5" onClick={e => e.stopPropagation()}>
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-white border border-surface-200 px-3 py-1.5 text-[12.5px] text-bluewood-700">
                <span className="flex items-center gap-1.5 truncate pr-3"><FileText size={12} className="flex-shrink-0 text-bluewood-300" />{f.name}</span>
                <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="flex-shrink-0 text-[11px] font-semibold text-bluewood-400 hover:text-red-500 transition-colors">삭제</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 링크 */}
      {preset.links.map(link => {
        const Icon = link.icon;
        return (
          <div key={link.key}>
            <label className="block text-[12px] font-bold text-bluewood-600 mb-1">{link.label}</label>
            <div className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-primary-200">
              <Icon size={14} className="flex-shrink-0 text-bluewood-300" />
              <input
                value={links[link.key] || ''}
                onChange={e => setLinks(prev => ({ ...prev, [link.key]: e.target.value }))}
                placeholder={link.placeholder}
                className="flex-1 text-[13px] text-bluewood-800 outline-none placeholder:text-bluewood-300 bg-transparent"
              />
            </div>
            {/* GitHub 레포 링크 아래 — 내 아이디를 입력하면 커밋 기여도·트러블슈팅·코드까지 분석 */}
            {link.source === 'github' && (links[link.key] || '').trim() && (
              <div className="mt-1.5 animate-fadeIn">
                <div className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50/40 px-3 py-2 focus-within:ring-2 focus-within:ring-primary-200">
                  <Github size={14} className="flex-shrink-0 text-primary-400" />
                  <input
                    value={ghUser}
                    onChange={e => setGhUser(e.target.value)}
                    placeholder="GitHub 아이디 — 내 커밋 기여도·코드 분석 (권장)"
                    className="flex-1 text-[13px] text-bluewood-800 outline-none placeholder:text-bluewood-300 bg-transparent"
                  />
                </div>
                <p className="mt-1 text-[11px] leading-snug text-bluewood-400">아이디를 입력하면 이 레포에서 내 커밋을 찾아 기여도 · 영향력 · 트러블슈팅 · 코드 근거까지 분석해요.</p>
              </div>
            )}
          </div>
        );
      })}

      {/* 직접 입력 */}
      <div>
        <label className="block text-[12px] font-bold text-bluewood-600 mb-1">또는 직접 적어주세요 <span className="text-bluewood-300 font-medium">(두서없어도 괜찮아요)</span></label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          placeholder="무슨 프로젝트였고, 어떤 문제를 어떻게 해결했는지 기억나는 대로 적어주세요."
          className="w-full resize-y rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200 placeholder:text-bluewood-300"
        />
      </div>

      <button
        onClick={() => {
          const linkList = preset.links
            .map(l => ({ ...l, url: (links[l.key] || '').trim() }))
            .filter(l => l.url);
          onSubmit({ files, links: linkList, text: text.trim(), githubUsername: ghUser.trim() });
        }}
        disabled={!hasInput || busy}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-[14px] font-bold hover:bg-primary-700 disabled:opacity-40 transition-colors shadow-sm shadow-primary-600/20"
      >
        {busy ? <Spinner light /> : <Sparkles size={15} />}
        {busy ? '초안을 만드는 중...' : '이 자료로 초안 만들기'}
      </button>
    </div>
  );
}

/* ── 채팅 내 핵심 경험 검토 위젯 — 추출된 경험을 선택/해제 후 확정 ── */
function MomentsWidget({ moments, onToggle, onConfirm }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selectedCount = moments.filter(m => m.selected).length;

  return (
    <div className="ml-11 mt-2 space-y-2.5">
      {moments.map((m, i) => {
        const isOpen = expanded.has(m.id);
        const desc = displayText(m.description);
        return (
          <div
            key={m.id}
            className={`rounded-xl border bg-white p-3.5 transition-all animate-slide-in-file ${
              m.selected ? 'border-primary-300 ring-1 ring-primary-100' : 'border-surface-200 opacity-60'
            }`}
            style={{ animationDelay: `${i * 0.08}s`, animationFillMode: 'backwards' }}
          >
            <div className="flex items-start gap-2.5">
              <button
                onClick={() => onToggle(m.id)}
                className={`flex-shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                  m.selected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-surface-300 text-transparent hover:border-primary-300'
                }`}
                title={m.selected ? '선택 해제' : '선택'}
              >
                <Check size={12} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold text-bluewood-900 leading-snug" style={{ wordBreak: 'keep-all' }}>
                  <span className="text-primary-600 mr-1">{i + 1}.</span>{displayText(m.title)}
                </p>
                {desc && (
                  <>
                    <p className={`mt-1 text-[12.5px] text-bluewood-500 leading-relaxed whitespace-pre-wrap ${isOpen ? '' : 'line-clamp-3'}`} style={{ wordBreak: 'keep-all' }}>
                      {desc}
                    </p>
                    {desc.length > 100 && (
                      <button onClick={() => toggleExpand(m.id)} className="mt-0.5 text-[11.5px] font-semibold text-bluewood-300 hover:text-primary-600 transition-colors">
                        {isOpen ? '접기' : '더 보기'}
                      </button>
                    )}
                  </>
                )}
                {(m.keywords || []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.keywords.slice(0, 5).map((kw, ki) => (
                      <span key={ki} className="px-1.5 py-0.5 rounded bg-surface-50 border border-surface-100 text-[10.5px] font-semibold text-bluewood-400">#{asText(kw)}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <button
        onClick={onConfirm}
        disabled={selectedCount === 0}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-[14px] font-bold hover:bg-primary-700 disabled:opacity-40 transition-colors shadow-sm shadow-primary-600/20"
      >
        <Sparkles size={15} /> 선택한 경험 {selectedCount}개로 초안 만들기
      </button>
    </div>
  );
}

export default function ExperienceChat() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { createExperience, draftAnalyze, extractMoments } = useExperienceStore();

  const [phase, setPhase] = useState('field'); // field(히어로) | basics(제목·기간) | materials | extracting | moments | building | fill | saving
  const [messages, setMessages] = useState([]);
  const [aiTyping, setAiTyping] = useState(false);
  const [fillDone, setFillDone] = useState(false);
  const [jobCategory, setJobCategory] = useState('');
  const [buildSteps, setBuildSteps] = useState([]);
  const [sourceText, setSourceText] = useState('');
  const [moments, setMoments] = useState([]);           // 추출된 핵심 경험 (selected 플래그 포함)
  const [reviewedMoments, setReviewedMoments] = useState([]); // 사용자가 확정한 핵심 경험

  const gitRef = useRef(null); // GitHub 커밋 분석 결과(githubStats·gitAnalysis) — 초안·저장에 보존

  const [draft, setDraft] = useState(null);
  const [title, setTitle] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [flashKey, setFlashKey] = useState(null);
  const [typeFx, setTypeFx] = useState(null);   // { key, from } — 방금 수정된 섹션 타이핑 연출
  const [history, setHistory] = useState([]);   // 답변 되돌리기용 스냅샷 스택

  const [queue, setQueue] = useState([]);       // 남은 질문
  const [currentQ, setCurrentQ] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [qaLog, setQaLog] = useState([]);       // 저장용 Q&A 기록

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const msgId = useRef(1);

  const pushMsg = (role, text) => {
    const id = `m${msgId.current++}`;
    setMessages(prev => [...prev, { id, role, text }]);
  };

  /* AI 메시지 — 타이핑 인디케이터를 잠깐 보여준 뒤 출력 (신뢰감 있는 대화 리듬) */
  const pushAi = async (text) => {
    setAiTyping(true);
    await sleep(Math.min(1300, 400 + text.length * 5));
    setAiTyping(false);
    pushMsg('ai', text);
  };

  /* 스크롤 — 새 메시지가 길어도 잘리지 않도록, 마지막 메시지의 '시작'이 보이게 맞춘다 */
  const lastMsgRef = useRef(null);
  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    if (aiTyping) {
      c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
      return;
    }
    const el = lastMsgRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop;
      c.scrollTo({ top: Math.max(0, top - 10), behavior: 'smooth' });
    }
  }, [messages, phase, currentQ, aiTyping]);

  /* 채우는 중인 항목이 우측 초안에서 바로 보이도록 자동 스크롤 */
  const panelRefs = useRef({});
  useEffect(() => {
    if (!currentQ || phase !== 'fill') return;
    const key = currentQ.widget === 'metric' ? 'keyExperiences' : currentQ.key;
    const el = panelRefs.current[key];
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentQ, phase]);

  const preset = MATERIAL_PRESETS[jobCategory] || MATERIAL_PRESETS.common;

  /* ── 1) 분야 선택 (히어로) → 기본 정보(제목·기간) ── */
  const selectField = async (item) => {
    setJobCategory(item.value);
    setPhase('basics');
    pushMsg('user', item.label);
    await pushAi(`좋아요, ${item.label} 경험이군요! 😊\n먼저 이 경험의 이름(제목)을 뭐라고 부를까요?`);
    setCurrentQ({ key: 'title', label: '제목', question: '경험 제목', placeholder: '예: 이미지 무단학습 방지 시스템 개발' });
  };

  /* 기본 정보 — 기간 질문 */
  const askPeriod = async () => {
    setCurrentQ(null);
    await pushAi('언제부터 언제까지 진행한 경험인가요?\n(건너뛰면 나중에 타임라인에서 추가할 수 있어요)');
    setCurrentQ({ key: 'period', label: '기간', widget: 'period', question: '진행 기간' });
  };

  /* 기본 정보 완료 → 자료 입력 */
  const goMaterials = async () => {
    setCurrentQ(null);
    setPhase('materials');
    const p = MATERIAL_PRESETS[jobCategory] || MATERIAL_PRESETS.common;
    await pushAi(p.intro);
  };

  /* 핵심 경험 목록 → rawInput/AI 프롬프트용 텍스트 */
  const buildMomentsText = (list) => list.map((m, i) =>
    `[경험 ${i + 1}] ${m.title}\n${m.description || ''}\n키워드: ${(m.keywords || []).join(', ')}`
  ).join('\n\n');

  /* ── 2) 자료 수집 → 핵심 경험 추출 ── */
  const collectMaterials = async ({ files, links, text, githubUsername }) => {
    const ghLink = links.find(l => l.source === 'github' && l.url);
    const runGitAnalysis = Boolean(ghLink && githubUsername);

    const parts = [];
    if (files.length > 0) parts.push(`파일 ${files.length}개`);
    links.forEach(l => parts.push(l.label.replace(/\s*\(선택\)/, '')));
    if (runGitAnalysis) parts.push(`@${githubUsername} 커밋 분석`);
    if (text) parts.push('직접 입력');
    pushMsg('user', parts.join(' · '));

    setPhase('extracting');
    const steps = [];
    if (files.length > 0) steps.push({ label: `${files.length}개 파일 분석`, status: 'pending' });
    links.forEach(l => steps.push({ label: `${l.label.replace(/\s*\(선택\)/, '')} 가져오기`, status: 'pending' }));
    if (runGitAnalysis) steps.push({ label: '내 커밋 · 기여도 분석 (코드·트러블슈팅)', status: 'pending' });
    steps.push({ label: '핵심 경험 추출', status: 'pending' });
    setBuildSteps(steps);
    const setStep = (idx, status) => setBuildSteps(prev => prev.map((s, i) => i === idx ? { ...s, status } : s));

    try {
      let allText = '';
      let stepIdx = 0;

      if (files.length > 0) {
        setStep(stepIdx, 'loading');
        for (const file of files) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('targetType', 'experience');
            const data = await importFileUpload(formData);
            const content = data?.imported?.content || '';
            if (content.trim()) allText += `\n\n--- ${file.name} ---\n${content.trim()}`;
          } catch {
            toast.error(`${file.name} 분석에 실패해 건너뛰었어요`);
          }
        }
        setStep(stepIdx, 'done');
        stepIdx++;
      }

      for (const link of links) {
        setStep(stepIdx, 'loading');
        // ⚠ GitHub 레포 README는 개발 중심이라 서비스 문제정의를 흐린다. git은 아래 커밋 분석이
        //   별도로 처리하므로, 레포 README/구조는 초안·서비스 추출 자료(allText)에 넣지 않는다.
        if (link.source !== 'github') {
          try {
            const data = await importFromUrl(link.source, link.url, 'experience');
            if (data?.imported?.content) {
              allText += `\n\n--- ${link.label}: ${link.url} ---\n${data.imported.content}`;
            }
          } catch {
            toast.error(`${link.label} 불러오기에 실패해 건너뛰었어요`);
          }
        }
        setStep(stepIdx, 'done');
        stepIdx++;
      }

      // GitHub 커밋 분석 — 기여도·코드·트러블슈팅은 '문제 해결 과정'으로 별도 보존.
      // (파일/텍스트 분석과 독립 — git이 초안·개요를 지배하지 않게 함)
      gitRef.current = null;
      let gitExpCount = 0;
      if (runGitAnalysis) {
        setStep(stepIdx, 'loading');
        try {
          const res = await api.post('/experience/analyze-git', {
            repoUrl: ghLink.url,
            authorParam: githubUsername,
          });
          const gitData = res.data;
          gitRef.current = {
            ...(gitData?.contributionStats ? { githubStats: { ...gitData.contributionStats, repoName: gitData.repoName } } : {}),
            ...(gitData?.experiences?.length ? { gitAnalysis: { repoName: gitData.repoName, experiences: gitData.experiences } } : {}),
          };
          gitExpCount = gitData?.experiences?.length || 0;
        } catch (gitErr) {
          const msg = gitErr?.response?.data?.error || '';
          if (msg.includes('찾을 수 없습니다')) {
            toast.error(`'${githubUsername}' 사용자의 커밋을 찾을 수 없습니다. GitHub 아이디를 확인해주세요.`, { duration: 5000 });
          } else {
            toast.error(msg || '커밋 분석에 실패해 건너뛰었어요', { duration: 4000 });
          }
        }
        setStep(stepIdx, 'done');
        stepIdx++;
      }

      if (text) allText += `\n\n--- 직접 입력 ---\n${text}`;

      if (!allText.trim() && !gitRef.current) {
        setPhase('materials');
        await pushAi('자료에서 내용을 읽지 못했어요. 다른 자료를 올리거나 직접 조금 적어주시겠어요?');
        return;
      }
      setSourceText(allText.trim());

      // 핵심 경험 추출 — 파일/텍스트 자료 기반 (git 경험은 문제 해결 과정에서 따로 다뤄짐)
      setStep(stepIdx, 'loading');
      let extracted = [];
      if (allText.trim()) {
        try {
          const result = await extractMoments(allText.trim(), '');
          extracted = result?.moments || [];
        } catch (err) {
          console.warn('[ExperienceChat] 핵심 경험 추출 실패 → 자료만으로 초안 진행:', err?.message);
        }
      }
      setStep(stepIdx, 'done');

      const gitNote = gitExpCount > 0 ? `\n(GitHub 커밋에서 찾은 개발 경험 ${gitExpCount}개는 ‘문제 해결 과정’으로 따로 정리했어요)` : '';
      if (extracted.length === 0) {
        await pushAi(`자료에서 핵심 경험을 따로 추출하지 못했어요. 자료 내용으로 초안을 만들게요.${gitNote}`);
        await generateDraft(allText.trim(), []);
        return;
      }

      const withFlags = extracted.map((m, i) => ({ ...m, id: m.id || `moment-${Date.now()}-${i}`, selected: true }));
      setMoments(withFlags);
      setPhase('moments');
      await pushAi(`자료를 꼼꼼히 읽었어요. 핵심 경험 ${withFlags.length}개를 찾았습니다!${gitNote}\n포트폴리오에 담을 경험만 남기고 확인을 눌러주세요. 선택한 경험을 중심으로 초안을 만들게요.`);
    } catch (err) {
      console.error('자료 수집 실패:', err);
      setPhase('materials');
      toast.error(err?.response?.data?.error || '자료 수집에 실패했습니다');
      await pushAi('자료 수집에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  /* ── 3) 핵심 경험 확정 → 초안 생성 ── */
  const confirmMoments = async () => {
    const selected = moments.filter(m => m.selected);
    if (selected.length === 0) {
      toast.error('최소 1개 이상의 경험을 선택해주세요');
      return;
    }
    setReviewedMoments(selected);
    pushMsg('user', `핵심 경험 ${selected.length}개 선택`);
    await generateDraft(sourceText, selected);
  };

  const generateDraft = async (allText, selectedMoments) => {
    setPhase('building');
    setBuildSteps([{ label: 'AI 초안 생성', status: 'loading' }]);

    try {
      // AI 빠른 초안 — 실패 시 로컬 초안 폴백 (기존 플로우와 동일한 전략)
      const momentsText = selectedMoments.length > 0 ? buildMomentsText(selectedMoments) : '';
      let analysis;
      try {
        const cleaned = cleanRawText(allText) || allText;
        // 초안(개요·README)은 파일/텍스트 자료 + 핵심경험으로만 생성 —
        // git 커밋 상세는 개요를 지배하지 않도록 주입하지 않고 '문제 해결 과정'에서 별도 표시.
        // (기술스택 힌트만, 아키텍처 다이어그램 폴백용으로 가볍게 전달)
        const draftContent = { 자료: cleaned, ...(momentsText ? { 핵심경험: momentsText } : {}) };
        const techStacks = (gitRef.current?.gitAnalysis?.experiences || []).map(e => e.core_tech_stack).filter(Boolean);
        if (techStacks.length) draftContent.기술스택 = [...new Set(techStacks.join(', ').split(/,\s*/))].filter(Boolean).join(', ');
        analysis = await draftAnalyze({
          content: draftContent,
          jobCategory: jobCategory || 'common',
        });
      } catch (draftErr) {
        console.warn('[ExperienceChat] AI 초안 실패 → 로컬 초안 폴백:', draftErr?.message);
        analysis = buildDraftStructuredResult({
          title: '',
          jobCategory: jobCategory || 'common',
          moments: selectedMoments,
          collectedText: allText,
          content: { rawInput: allText },
        });
      }
      // 서비스 설명(product)·아키텍처/흐름이 비면 전용 경량 추출로 보강 — 전체 초안 실패/누락 대비
      const needProduct = !asText(analysis?.product?.problem) && !asText(analysis?.product?.solution);
      const needArch = !(analysis?.architectureDiagram?.nodes?.length);
      if ((needProduct || needArch) && allText.trim()) {
        try {
          const pr = await api.post('/experience/extract-product', { material: allText.trim() });
          const d = pr.data || {};
          if (needProduct && d.product) analysis = { ...analysis, product: d.product };
          if (needArch && d.architectureDiagram?.nodes?.length) analysis = { ...analysis, architectureDiagram: d.architectureDiagram };
          if (!(analysis?.flowDiagram?.nodes?.length) && d.flowDiagram?.nodes?.length) analysis = { ...analysis, flowDiagram: d.flowDiagram };
        } catch (e) {
          console.warn('[ExperienceChat] product/다이어그램 전용 추출 실패(무시):', e?.message);
        }
      }
      setBuildSteps([{ label: 'AI 초안 생성', status: 'done' }]);
      // 기본 정보 단계에서 받은 기간을 초안에 반영
      const withPeriod = (startMonth && endMonth)
        ? { ...analysis, projectOverview: { ...(analysis?.projectOverview || {}), duration: `${startMonth} ~ ${endMonth}` } }
        : analysis;
      setDraft(withPeriod);

      // 채우기 질문 큐 구성 — 제목/기간은 기본 정보에서 이미 받았고, 비어 있는 부분만 묻는다
      const q = [];
      if (isWeak(analysis?.projectOverview?.role)) {
        q.push({
          key: 'role', label: '역할',
          question: '이 프로젝트에서 본인의 역할은 무엇이었나요?', placeholder: '예: 프론트엔드 개발 · 팀 리딩',
          chips: ['프론트엔드 개발', '백엔드 개발', '기획 / PM', '디자이너', '데이터 분석', '마케팅'],
        });
      }
      SECTION_DEFS.forEach(def => {
        if (isWeak(analysis?.[def.key])) {
          q.push({ key: def.key, label: def.label, question: `[${def.label}] 부분이 비어 있어요.\n${def.q}`, placeholder: '키워드만 적어도 괜찮아요' });
        }
      });
      // 핵심 경험별 수치 보강 — 수치가 없는 경험을 골라 가이드 위젯으로 질문 (최대 2개)
      const kes = Array.isArray(analysis?.keyExperiences) ? analysis.keyExperiences : [];
      const needMetric = kes
        .map((ke, i) => ({ ke, i }))
        .filter(({ ke }) => !asText(ke.metric || ke.afterMetric) && !/\d/.test(asText(ke.result)))
        .slice(0, 2);
      needMetric.forEach(({ ke, i }) => {
        q.push({
          key: `keMetric-${i}`, label: '성과 수치', widget: 'metric', keIndex: i, keTitle: asText(ke.title),
          question: `핵심 경험 "${asText(ke.title)}"의 성과를 수치로 보여줄 수 있을까요?\n수치가 있는 경험은 채용 담당자에게 훨씬 강하게 남아요.`,
        });
      });
      if (needMetric.length === 0 && !/\d/.test(asText(analysis?.output))) {
        q.push({ key: 'metric', label: '성과 수치', widget: 'metric', keIndex: null, question: '결과를 수치로 표현할 수 있나요?\n예를 들면 응답속도 40% 개선, 사용자 1,200명 달성 같은 형태요.' });
      }

      setFillDone(false);
      setPhase('fill');
      await pushAi('초안이 완성됐어요! 오른쪽에 초안이 나타났어요. ✨');
      if (q.length === 0) {
        await pushAi('필요한 내용이 모두 채워져 있네요! 오른쪽 초안을 확인하고 저장해주세요.');
        setFillDone(true);
      } else {
        const [first, ...rest] = q;
        setQueue(rest);
        await pushAi(`이제 비어 있는 부분을 몇 가지 질문으로 채워볼게요.\n\n${first.question}`);
        setCurrentQ(first);
      }
    } catch (err) {
      console.error('초안 생성 실패:', err);
      setPhase(moments.length > 0 ? 'moments' : 'materials');
      toast.error(err?.response?.data?.error || '초안 생성에 실패했습니다');
      await pushAi('초안 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  /* 답변 반영 전 스냅샷 저장 — 되돌리기용 */
  const pushHistory = (item) => {
    setHistory(prev => [...prev, { item, draft, title, startMonth, endMonth }]);
  };

  /* ── 3) 답변을 초안에 반영 ── */
  const applyAnswer = (item, answer) => {
    const a = answer.trim();
    if (item.key === 'title') {
      setTitle(a);
    } else if (item.key === 'role') {
      setDraft(prev => ({ ...prev, projectOverview: { ...(prev?.projectOverview || {}), role: a } }));
    } else {
      const cur = asText(draft?.[item.key]);
      const wasWeak = isWeak(cur);
      setDraft(prev => ({ ...prev, [item.key]: wasWeak ? a : `${cur}\n\n${a}` }));
      setFlashKey(item.key);
      setTypeFx({ key: item.key, from: wasWeak ? 0 : displayText(cur).length });
    }
    setQaLog(prev => [...prev, { q: item.question.replace(/\n/g, ' '), a }]);
  };

  useEffect(() => {
    if (!flashKey) return;
    const t = setTimeout(() => setFlashKey(null), 1600);
    return () => clearTimeout(t);
  }, [flashKey]);

  /* 성과 수치 답변을 핵심 경험 + 결과물 섹션에 반영 */
  const applyMetricAnswer = (item, text) => {
    const a = text.trim();
    const curOut = asText(draft?.output);
    const outWasWeak = isWeak(curOut);
    if (item.keIndex != null) {
      setDraft(prev => {
        const kes = [...(prev?.keyExperiences || [])];
        if (kes[item.keIndex]) {
          kes[item.keIndex] = { ...kes[item.keIndex], metric: a, afterMetric: a, metricLabel: kes[item.keIndex].metricLabel || '핵심 수치' };
        }
        return { ...prev, keyExperiences: kes, output: outWasWeak ? `${item.keTitle}: ${a}` : `${curOut}\n\n${item.keTitle} 성과: ${a}` };
      });
      setFlashKey('keyExperiences');
    } else {
      setDraft(prev => ({ ...prev, output: outWasWeak ? a : `${curOut}\n\n핵심 수치: ${a}` }));
      setFlashKey('output');
    }
    setTypeFx({ key: 'output', from: outWasWeak ? 0 : displayText(curOut).length });
    setQaLog(prev => [...prev, { q: item.question.replace(/\n/g, ' '), a }]);
  };

  /* ── 되돌리기 — 마지막 답변을 취소하고 그 질문으로 복귀 ── */
  const undoLast = async () => {
    if (history.length === 0 || aiTyping) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setDraft(last.draft);
    setTitle(last.title);
    setStartMonth(last.startMonth);
    setEndMonth(last.endMonth);
    setQaLog(prev => prev.slice(0, -1));
    setTypeFx(null);
    setFillDone(false);
    // 진행 중이던 질문은 큐 앞으로 되돌려두고, 취소한 질문을 다시 진행
    setQueue(prev => (currentQ ? [currentQ, ...prev] : prev));
    setCurrentQ(null);
    pushMsg('user', '↩ 방금 답변 되돌리기');
    await pushAi(`방금 답변을 되돌렸어요. 다시 답해주세요!\n${last.item.question}`);
    setCurrentQ(last.item);
  };

  /* ── 분야 다시 선택 — 히어로 화면으로 복귀 ── */
  const changeField = () => {
    if (aiTyping) return;
    setJobCategory('');
    setCurrentQ(null);
    setChatInput('');
    setPhase('field');
  };

  /* 다음 질문으로 이동 — 타이핑 연출 후 질문 출력 */
  const advance = async () => {
    setCurrentQ(null);
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      await pushAi(next.question);
      setCurrentQ(next);
    } else {
      await pushAi('필요한 내용을 모두 채웠어요! 🎉\n오른쪽 초안을 확인하고 저장해주세요. 저장 후에도 "AI로 완성하기"로 더 풍부하게 다듬을 수 있어요.');
      setFillDone(true);
    }
  };

  const submitAnswer = () => {
    const a = chatInput.trim();
    if (!a || !currentQ) return;
    // 기본 정보 단계 — 제목 입력 후 기간 질문으로
    if (phase === 'basics') {
      pushMsg('user', a);
      setTitle(a);
      setChatInput('');
      askPeriod();
      return;
    }
    pushHistory(currentQ);
    pushMsg('user', a);
    applyAnswer(currentQ, a);
    setChatInput('');
    advance();
  };

  const skipCurrent = () => {
    if (!currentQ) return;
    pushMsg('user', '건너뛰기');
    if (phase === 'basics') {
      if (currentQ.key === 'title') askPeriod();
      else goMaterials();
      return;
    }
    advance();
  };

  /* 수치 위젯 확인 */
  const submitMetric = (text) => {
    if (!currentQ) return;
    pushHistory(currentQ);
    pushMsg('user', text);
    applyMetricAnswer(currentQ, text);
    advance();
  };

  /* 기간 위젯 확인 */
  const submitPeriod = () => {
    if (!startMonth || !endMonth) return toast.error('시작/종료 월을 모두 선택해주세요');
    if (endMonth < startMonth) return toast.error('종료 월이 시작 월보다 빠를 수 없어요');
    if (phase === 'basics') {
      pushMsg('user', `${startMonth} ~ ${endMonth}`);
      goMaterials();
      return;
    }
    pushHistory(currentQ);
    pushMsg('user', `${startMonth} ~ ${endMonth}`);
    setDraft(prev => prev ? { ...prev, projectOverview: { ...(prev.projectOverview || {}), duration: `${startMonth} ~ ${endMonth}` } } : prev);
    setQaLog(prev => [...prev, { q: '진행 기간', a: `${startMonth} ~ ${endMonth}` }]);
    advance();
  };

  /* 우측 패널에서 특정 섹션 채우기 요청 */
  const askSection = async (key) => {
    if (phase !== 'fill') return;
    const def = SECTION_DEFS.find(d => d.key === key);
    if (!def) return;
    if (currentQ?.key === key) { inputRef.current?.focus(); return; }
    const inQueue = queue.find(item => item.key === key);
    const item = inQueue || { key, label: def.label, question: `[${def.label}] ${def.q}`, placeholder: '키워드만 적어도 괜찮아요' };
    // 현재 질문은 큐 앞으로 돌려두고, 선택한 섹션 질문을 먼저 진행
    setQueue(prev => {
      const rest = prev.filter(it => it.key !== key);
      return currentQ ? [currentQ, ...rest] : rest;
    });
    setCurrentQ(null);
    setFillDone(false);
    await pushAi(item.question);
    setCurrentQ(item);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  /* ── 4) 저장 ── */
  const saveExperience = async () => {
    if (!draft) return;
    if (!title.trim()) {
      toast.error('제목을 입력해주세요');
      askTitle();
      return;
    }
    setPhase('saving');
    try {
      const transcript = qaLog.map(({ q, a }) => `Q. ${q}\n→ ${a}`).join('\n\n');
      const momentsText = reviewedMoments.length > 0 ? buildMomentsText(reviewedMoments) : '';
      const finalText = [
        sourceText,
        momentsText ? `=== AI 추출 핵심 경험 ===\n${momentsText}` : '',
        transcript ? `=== AI 채팅 보완 ===\n${transcript}` : '',
      ].filter(Boolean).join('\n\n');
      // GitHub 기여 통계 + 분석 원본(코드·트러블슈팅)을 structuredResult에 보존 → 케이스 스터디·개발자 포트폴리오에서 렌더
      const draftWithGit = { ...draft, ...(gitRef.current || {}) };
      const experienceId = await createExperience(user.uid, {
        title: title.trim(),
        framework: 'STRUCTURED',
        jobCategory: jobCategory || 'common',
        period: (startMonth && endMonth) ? `${startMonth}-01 ~ ${endMonth}-28` : undefined,
        content: { rawInput: finalText },
        momentsCount: reviewedMoments.length || 3,
        ...(reviewedMoments.length > 0 ? { reviewedMoments } : {}),
        structuredResult: draftWithGit,
        keywords: draft.keywords || [],
        analysisMode: 'draft',
      });
      toast.success('빠른 초안이 저장되었습니다. AI로 완성하기를 누르면 더 풍부해져요.');
      navigate(`/app/experience/result/${experienceId}`, {
        state: {
          analysis: draftWithGit,
          title: title.trim(),
          jobCategory: jobCategory || 'common',
          framework: 'STRUCTURED',
          content: { rawInput: finalText },
          showFeedback: true,
          feedbackContext: 'experience_chat_draft_complete',
        },
      });
    } catch (err) {
      console.error('저장 실패:', err);
      toast.error(err?.response?.data?.error || '저장에 실패했어요. 다시 시도해주세요.');
      setPhase('fill');
    }
  };

  const askTitle = async () => {
    if (currentQ?.key === 'title') { inputRef.current?.focus(); return; }
    const item = { key: 'title', label: '제목', question: '이 경험의 제목을 뭐라고 지을까요?', placeholder: '예: 이미지 무단학습 방지 시스템 개발' };
    setQueue(prev => (currentQ ? [currentQ, ...prev.filter(it => it.key !== 'title')] : prev.filter(it => it.key !== 'title')));
    setCurrentQ(null);
    setFillDone(false);
    await pushAi(item.question);
    setCurrentQ(item);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const overview = draft?.projectOverview || {};
  const techStack = useMemo(() => (Array.isArray(overview.techStack) ? overview.techStack : []).slice(0, 6), [overview.techStack]);

  /* 초안 완성도 (%) — 섹션 + 제목/기간/역할 기준 */
  const completeness = useMemo(() => {
    if (!draft) return 0;
    const total = SECTION_DEFS.length + 3;
    let filled = SECTION_DEFS.filter(d => !isWeak(draft[d.key])).length;
    if (title.trim()) filled++;
    if (startMonth && endMonth) filled++;
    if (!isWeak(draft?.projectOverview?.role)) filled++;
    return Math.round((filled / total) * 100);
  }, [draft, title, startMonth, endMonth]);

  const canType = !!currentQ && !currentQ.widget && (phase === 'fill' || phase === 'basics');

  /* ── 첫 화면: 가벼운 웰컴 히어로 — 분야를 고르면 대화가 시작된다 ── */
  if (phase === 'field') {
    return (
      <div className="animate-fadeIn max-w-[1320px] mx-auto px-4 sm:px-6 py-6">
        <Link to="/app/experience" className="inline-block text-[13px] font-medium text-bluewood-400 hover:text-bluewood-700 transition-colors">
          ← 경험 목록으로
        </Link>
        <div className="relative min-h-[72vh] flex flex-col items-center justify-center text-center px-4">
          {/* 은은한 배경 광원 */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-full max-w-[560px] rounded-full bg-primary-100/50 blur-3xl" />
          <div className="relative w-full">
            <HeroBot />
            <h1 className="text-[24px] sm:text-[30px] font-extrabold text-bluewood-900 tracking-[-0.02em] mb-2.5" style={{ wordBreak: 'keep-all' }}>
              <span className="italic font-serif">FitPoly</span>와 함께, 경험을 가볍게 정리해보아요
            </h1>
            <p className="text-[15px] text-bluewood-400 mb-9" style={{ wordBreak: 'keep-all' }}>
              어떤 분야의 경험인가요? 골라주시면 바로 시작할게요.
            </p>
            <div className="space-y-5 max-w-[600px] mx-auto">
              {JOB_CATEGORIES.map(group => (
                <div key={group.group}>
                  <p className="text-[11px] font-bold text-bluewood-300 uppercase tracking-wider mb-2">{group.group}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {group.items.map(it => (
                      <button
                        key={it.value}
                        onClick={() => selectField(it)}
                        title={it.description}
                        className="px-4 py-2 rounded-full border border-surface-200 bg-white text-[13.5px] font-semibold text-bluewood-700 shadow-sm hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 hover:shadow transition-all active:scale-95"
                      >
                        {it.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn max-w-[1320px] mx-auto px-4 sm:px-6 py-6 pb-16">
      <Link to="/app/experience" className="inline-block text-[13px] font-medium text-bluewood-400 hover:text-bluewood-700 transition-colors mb-4">
        ← 경험 목록으로
      </Link>

      <div className={draft
        ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start'
        : 'max-w-[860px] mx-auto'
      }>
        {/* ═══ 좌측: AI 채팅 ═══ */}
        <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-[0_10px_40px_rgba(49,65,87,0.06)] flex flex-col h-[calc(100dvh-170px)] min-h-[520px]">
          <div className="h-1 w-full bg-primary-600" />
          <div className="px-6 pt-5 pb-4 border-b border-surface-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-[17px] font-extrabold text-bluewood-900">AI와 함께 경험 정리</h1>
                <p className="text-[12.5px] text-bluewood-400 mt-0.5">분야를 고르고 자료를 올리면, 대화하면서 초안을 완성해요.</p>
              </div>
              {jobCategory && (
                <span className="flex-shrink-0 px-2.5 py-1 rounded-md bg-primary-50 border border-primary-100 text-[12px] font-bold text-primary-600 animate-pop-in">
                  {JOB_LABELS[jobCategory]}
                </span>
              )}
            </div>
            <FlowStepper phase={phase} />
          </div>

          {/* 대화 영역 */}
          <div ref={scrollRef} className="flex-1 min-h-0 px-5 sm:px-6 py-6 overflow-y-auto space-y-5">
            {messages.map((m, idx) => (
              <div key={m.id} ref={idx === messages.length - 1 ? lastMsgRef : null}>
                {m.role === 'ai'
                  ? <AiBubble>{m.text}</AiBubble>
                  : <UserBubble>{m.text}</UserBubble>}
              </div>
            ))}

            {/* AI 입력 중 */}
            {aiTyping && <TypingBubble />}

            {/* 자료 입력 위젯 */}
            {phase === 'materials' && !aiTyping && (
              <MaterialsWidget preset={preset} onSubmit={collectMaterials} busy={false} />
            )}

            {/* 핵심 경험 검토 위젯 */}
            {phase === 'moments' && !aiTyping && (
              <MomentsWidget
                moments={moments}
                onToggle={(id) => setMoments(prev => prev.map(m => m.id === id ? { ...m, selected: !m.selected } : m))}
                onConfirm={confirmMoments}
              />
            )}

            {/* 자료 수집·초안 생성 진행 */}
            {(phase === 'extracting' || phase === 'building') && (
              <div className="ml-11 mt-2 rounded-xl border border-surface-200 bg-surface-50/50 px-4 py-3.5 space-y-2">
                {buildSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-[13px]">
                    <span className="flex h-5 w-5 items-center justify-center">
                      {s.status === 'done'
                        ? <Check size={14} className="text-primary-600" />
                        : s.status === 'loading'
                          ? <BarsLoader height={12} />
                          : <span className="h-1.5 w-1.5 rounded-full bg-surface-300" />}
                    </span>
                    <span className={s.status === 'pending' ? 'text-bluewood-300' : 'font-semibold text-bluewood-700'}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 성과 수치 가이드 위젯 */}
            {phase === 'fill' && currentQ?.widget === 'metric' && !aiTyping && (
              <MetricWidget
                target={currentQ.keIndex != null ? draft?.keyExperiences?.[currentQ.keIndex] : null}
                onSubmit={submitMetric}
                onSkip={skipCurrent}
              />
            )}

            {/* 기간 입력 위젯 */}
            {(phase === 'fill' || phase === 'basics') && currentQ?.widget === 'period' && !aiTyping && (
              <div className="ml-11 mt-2 rounded-xl border border-surface-200 bg-surface-50/50 p-4 animate-fadeIn">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)}
                    className="flex-1 rounded-xl border border-surface-200 bg-white px-3 py-2 text-[13.5px] text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200"
                  />
                  <span className="text-bluewood-300">~</span>
                  <input
                    type="month" value={endMonth} onChange={e => setEndMonth(e.target.value)}
                    className="flex-1 rounded-xl border border-surface-200 bg-white px-3 py-2 text-[13.5px] text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={skipCurrent} className="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-bluewood-400 hover:bg-surface-100 transition-colors">건너뛰기</button>
                  <button onClick={submitPeriod} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-[13px] font-bold hover:bg-primary-700 transition-colors">확인</button>
                </div>
              </div>
            )}

            {/* 완료 상태 — 완성 카드 + 저장 버튼 */}
            {phase === 'fill' && fillDone && !aiTyping && (
              <div className="ml-11 mt-2 rounded-xl border border-caribbean-200 bg-caribbean-50/50 p-4 animate-pop-in">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-caribbean-500 text-white animate-pulse-check">
                    <Check size={16} />
                  </span>
                  <div>
                    <p className="text-[14px] font-extrabold text-bluewood-900">초안 준비 완료!</p>
                    <p className="text-[12px] text-bluewood-500">완성도 {completeness}% · 저장 후에도 언제든 수정할 수 있어요</p>
                  </div>
                </div>
                <button
                  onClick={saveExperience}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-[14px] font-bold hover:bg-primary-700 transition-colors shadow-sm shadow-primary-600/20"
                >
                  <Save size={15} /> 경험 저장하기
                </button>
              </div>
            )}

            {phase === 'saving' && (
              <div className="ml-11 mt-2 flex items-center gap-2.5 text-[13.5px] font-semibold text-bluewood-600">
                <BarsLoader height={14} /> 경험을 저장하고 있어요...
              </div>
            )}
          </div>

          {/* 채팅 입력 — 채우기 단계에서만 활성화 */}
          <div className="px-5 sm:px-6 py-4 border-t border-surface-100">
            {/* 빠른 답변 칩 — 선택지 또는 문장 시작 도우미 */}
            {phase === 'fill' && currentQ && !currentQ.widget && !aiTyping && (
              <div className="mb-2.5 flex flex-wrap gap-1.5 animate-fadeIn">
                {currentQ.chips
                  ? currentQ.chips.map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => { setChatInput(chip); inputRef.current?.focus(); }}
                        className="px-3 py-1.5 rounded-full border border-primary-200 bg-primary-50/60 text-[12.5px] font-semibold text-primary-700 hover:bg-primary-100 transition-colors"
                      >
                        {chip}
                      </button>
                    ))
                  : STARTERS.map(s => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => {
                          setChatInput(prev => {
                            const sep = prev && !prev.endsWith('\n') && !prev.endsWith(' ') ? '\n' : '';
                            return prev + sep + s.text;
                          });
                          inputRef.current?.focus();
                        }}
                        className="px-2.5 py-1 rounded-full border border-surface-200 bg-surface-50 text-[12px] font-semibold text-bluewood-600 hover:border-primary-300 hover:text-primary-600 transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
              </div>
            )}
            <div className={`flex items-end gap-2 rounded-2xl border px-4 py-2.5 transition-all ${
              canType
                ? 'border-surface-200 bg-white shadow-sm focus-within:border-primary-300 focus-within:ring-4 focus-within:ring-primary-50'
                : 'border-surface-100 bg-surface-50/60'
            }`}>
              <textarea
                ref={inputRef}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submitAnswer();
                  }
                }}
                rows={1}
                disabled={!canType}
                placeholder={
                  canType
                    ? (currentQ.placeholder || '키워드만 적어도 괜찮아요')
                    : (phase === 'fill' || phase === 'basics')
                      ? '위 버튼으로 진행해주세요'
                      : phase === 'moments'
                        ? '위에서 핵심 경험을 확인하고 선택해주세요'
                        : '초안이 만들어지면 대화로 채울 수 있어요'
                }
                className="flex-1 resize-none bg-transparent text-[14px] leading-relaxed text-bluewood-800 outline-none placeholder:text-bluewood-300 disabled:cursor-not-allowed max-h-32"
              />
              <button
                onClick={submitAnswer}
                disabled={!canType || !chatInput.trim()}
                className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-30 transition-all active:scale-95"
                title="보내기"
              >
                <Send size={15} className="-ml-0.5" />
              </button>
            </div>
            {canType ? (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[12px] text-bluewood-300">Enter로 전송 · Shift+Enter 줄바꿈</p>
                <div className="flex items-center gap-3">
                  {phase === 'basics' && (
                    <button onClick={changeField} className="text-[12px] font-semibold text-bluewood-400 hover:text-primary-600 transition-colors">
                      ← 분야 다시 선택
                    </button>
                  )}
                  {phase === 'fill' && history.length > 0 && (
                    <button onClick={undoLast} className="text-[12px] font-semibold text-bluewood-400 hover:text-primary-600 transition-colors">
                      ↩ 이전 답변 되돌리기
                    </button>
                  )}
                  <button onClick={skipCurrent} className="text-[12px] text-bluewood-300 hover:text-bluewood-500 underline underline-offset-2 transition-colors">
                    이 질문 건너뛰기
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11.5px] text-bluewood-300">
                  <ShieldCheck size={12} className="text-caribbean-600" />
                  답변은 초안에만 반영되고, 저장 전까지 언제든 수정할 수 있어요
                </p>
                {phase === 'fill' && history.length > 0 && (
                  <button onClick={undoLast} className="flex-shrink-0 text-[12px] font-semibold text-bluewood-400 hover:text-primary-600 transition-colors">
                    ↩ 이전 답변 되돌리기
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ 우측: 초안 미리보기 — 초안이 생기면 부드럽게 슬라이드 인 ═══ */}
        {draft && (
        <div className="lg:sticky lg:top-6 rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-[0_10px_40px_rgba(49,65,87,0.06)] animate-panel-in">
          <div className="px-5 py-4 border-b border-surface-100 bg-gray-50/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-1 rounded-full bg-primary-600" />
              <span className="text-[14px] font-bold text-bluewood-800">경험 초안</span>
            </div>
            <div className="flex items-center gap-3">
              {draft && <ProgressRing percent={completeness} />}
              {draft && phase !== 'saving' && (
                <button
                  onClick={saveExperience}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-[12.5px] font-bold hover:bg-primary-700 transition-colors"
                >
                  <Save size={12} /> 저장
                </button>
              )}
            </div>
          </div>

          <div className="px-5 py-5 space-y-4 max-h-[calc(100dvh-240px)] overflow-y-auto">
              {/* 제목 + 메타 */}
              <div>
                {title ? (
                  <p className="text-[17px] font-extrabold text-bluewood-900 leading-snug" style={{ wordBreak: 'keep-all' }}>{stripMd(title)}</p>
                ) : (
                  <button
                    onClick={askTitle}
                    disabled={phase !== 'fill'}
                    className="inline-flex items-center gap-1.5 text-[14px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100 disabled:opacity-60 transition-colors"
                  >
                    <Pencil size={12} /> 제목 미정 — 채팅에서 정하기
                  </button>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-primary-50 border border-primary-100 text-[11px] font-bold text-primary-600">{JOB_LABELS[jobCategory] || '공통'}</span>
                  {(startMonth && endMonth) && (
                    <span className="px-2 py-0.5 rounded-md bg-surface-50 border border-surface-200 text-[11px] font-semibold text-bluewood-500">{startMonth} ~ {endMonth}</span>
                  )}
                  {asText(overview.role) && (
                    <span className="px-2 py-0.5 rounded-md bg-surface-50 border border-surface-200 text-[11px] font-semibold text-bluewood-500">{asText(overview.role)}</span>
                  )}
                </div>
                {techStack.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {techStack.map((t, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-surface-50 text-[10.5px] font-semibold text-bluewood-400">{asText(t)}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 섹션들 */}
              {SECTION_DEFS.map(def => {
                const value = displayText(draft[def.key]);
                const weak = isWeak(draft[def.key]);
                const isFlashing = flashKey === def.key;
                const isCurrent = currentQ?.key === def.key;
                return (
                  <div
                    key={def.key}
                    ref={el => { panelRefs.current[def.key] = el; }}
                    className={`rounded-xl border px-4 py-3 transition-colors duration-700 ${
                      isFlashing ? 'border-caribbean-300 animate-section-glow' :
                      isCurrent ? 'border-primary-300 bg-primary-50/40 ring-1 ring-primary-200' :
                      weak ? 'border-dashed border-amber-200 bg-amber-50/30' : 'border-surface-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold text-bluewood-400 uppercase tracking-[0.12em]">
                        {def.label}
                        {!weak && <Check size={11} className="text-caribbean-600" />}
                      </p>
                      {isCurrent ? (
                        <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-bold animate-pop-in">지금 채우는 중</span>
                      ) : weak && phase === 'fill' && (
                        <button
                          onClick={() => askSection(def.key)}
                          className="flex-shrink-0 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-600 hover:bg-amber-100 transition-colors"
                        >
                          채팅으로 채우기
                        </button>
                      )}
                    </div>
                    {weak && !value ? (
                      <p className="text-[12.5px] text-bluewood-300">아직 비어 있어요</p>
                    ) : typeFx?.key === def.key ? (
                      <TypewriterText
                        text={value}
                        startIndex={typeFx.from}
                        className="text-[13px] leading-relaxed whitespace-pre-wrap text-bluewood-700"
                        style={{ wordBreak: 'keep-all' }}
                      />
                    ) : (
                      <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${weak ? 'text-bluewood-400' : 'text-bluewood-700'}`} style={{ wordBreak: 'keep-all' }}>
                        {value}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* 핵심 경험 */}
              {Array.isArray(draft.keyExperiences) && draft.keyExperiences.length > 0 && (
                <div
                  ref={el => { panelRefs.current.keyExperiences = el; }}
                  className={`rounded-xl border px-4 py-3 transition-colors duration-700 ${
                    flashKey === 'keyExperiences' ? 'border-caribbean-300 animate-section-glow' : 'border-surface-100 bg-white'
                  }`}
                >
                  <p className="text-[11px] font-bold text-bluewood-400 uppercase tracking-[0.12em] mb-2">핵심 경험</p>
                  <div className="space-y-1.5">
                    {draft.keyExperiences.slice(0, 5).map((ke, i) => {
                      const isTarget = phase === 'fill' && currentQ?.widget === 'metric' && currentQ?.keIndex === i;
                      const snippet = displayText(ke.result || ke.context || ke.action);
                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
                            isTarget ? 'bg-primary-50/80 ring-1 ring-primary-200' : ''
                          }`}
                        >
                          <span className={`flex-shrink-0 mt-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-black ${
                            isTarget ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-600'
                          }`}>{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12.5px] font-semibold text-bluewood-700 leading-snug" style={{ wordBreak: 'keep-all' }}>{displayText(ke.title)}</p>
                              {isTarget && (
                                <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-bold animate-pop-in">지금 채우는 중</span>
                              )}
                            </div>
                            {isTarget && snippet && (
                              <p className="mt-0.5 text-[11.5px] text-bluewood-400 leading-relaxed line-clamp-2" style={{ wordBreak: 'keep-all' }}>{snippet}</p>
                            )}
                            {asText(ke.metric || ke.afterMetric) && (
                              <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded bg-primary-50 text-[10.5px] font-bold text-primary-600 animate-pop-in">{asText(ke.metric || ke.afterMetric)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 키워드 */}
              {Array.isArray(draft.keywords) && draft.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {draft.keywords.slice(0, 8).map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-surface-50 border border-surface-200 text-[11px] font-semibold text-bluewood-500">#{asText(kw)}</span>
                  ))}
                </div>
              )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
