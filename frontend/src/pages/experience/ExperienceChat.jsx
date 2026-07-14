import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Send, Check, FileText, Link2, Github, Paperclip,
  Sparkles, Save, Pencil, TrendingUp, ShieldCheck,
  ArrowLeft, ArrowRight, ChevronRight, CheckCircle2,
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
    intro: '마케팅 산출물은 채널 곳곳에 흩어져 있죠. 인스타그램 게시물, Figma 카드뉴스·대시보드, 캠페인 리포트, 블로그·노션 — 어디에 있든 링크와 파일로 올려주세요. 제가 읽고 성과 중심으로 정리할게요.',
    accept: '.pdf,.doc,.docx,image/*',
    filesHint: '캠페인 리포트 · 카드뉴스/대시보드 캡처 (PDF / DOCX / 이미지)',
    links: [
      { key: 'instagram', label: '인스타그램/SNS 게시물·계정', placeholder: 'https://instagram.com/... 게시물 또는 계정', source: 'blog', icon: Link2 },
      { key: 'figma', label: 'Figma 카드뉴스·대시보드 (선택)', placeholder: 'https://figma.com/...', source: 'blog', icon: Link2 },
      { key: 'campaign', label: '캠페인/블로그/노션 링크 (선택)', placeholder: 'https://... (랜딩페이지, 블로그, 노션)', source: 'blog', icon: Link2 },
    ],
    extraLinks: true, // 채널이 많은 직군 — 링크를 계속 추가할 수 있게
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

/* 마케터 캠페인 스토리 단계 (ma.md: 문제→목표→타깃→전략→실행→성과→인사이트) */
const FUNNEL_STEPS = [
  { key: 'problem', label: '문제' },
  { key: 'goal', label: '목표' },
  { key: 'target', label: '타깃' },
  { key: 'strategy', label: '전략' },
  { key: 'execution', label: '실행' },
  { key: 'result', label: '성과' },
  { key: 'insight', label: '인사이트' },
];

/* 값이 없거나 [확인 필요] 표기인지 */
function needsConfirm(value) {
  const t = asText(value);
  return !t || /\[확인 필요\]|\[작성 필요\]|\[검증 필요\]/.test(t);
}

/* 문자열에서 첫 번째 숫자 추출 (수치 시각화용) */
function parseMetricNum(value) {
  const m = String(value || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 답변 시작을 도와주는 빠른 문구 (탭하면 입력창에 삽입) */
const STARTERS = [
  { label: '+ 수치', text: '수치로 말하면 ' },
  { label: '+ 내가 한 일', text: '제가 직접 한 건 ' },
  { label: '+ 이유', text: '그렇게 한 이유는 ' },
  { label: '+ 어려웠던 점', text: '가장 어려웠던 건 ' },
];

/* 사용자가 인지하는 진행 단계 (내부 phase는 그대로 유지하고 UI만 묶어서 보여준다) */
const FLOW_STEPS = ['경험 선택', '자료 입력', 'AI 인터뷰', '결과 완성'];
const PHASE_STEP = {
  field: 0,
  mkField: 0,
  basics: 0,
  materials: 1,
  extracting: 1,
  moments: 1,
  building: 2,
  fill: 2,
  saving: 3,
};

/* ── 마케터 세부 분야 — 분야별 핵심 목표·역량·평가 지표를 챗봇이 짚어준 뒤 정리 시작 ── */
const MARKETER_FIELDS = [
  {
    key: 'contentPlan', label: '콘텐츠 기획',
    desc: '타깃·채널별 콘텐츠 주제와 톤앤매너 기획, 캠페인 컨셉 설계',
    goal: '타깃이 반응할 콘텐츠 방향과 캠페인 컨셉을 설계해 브랜드 인지→관심→행동으로 이어지는 흐름을 만드는 것',
    skills: '타깃 정의 · 컨셉/톤앤매너 설계 · 기획서 작성 · 채널 이해',
    metrics: '도달·노출, 반응률(좋아요·저장·공유·댓글), 기획안 채택률, 캠페인 목표(KPI) 달성 여부',
  },
  {
    key: 'contentMake', label: '콘텐츠 제작',
    desc: '카피라이팅, 카드뉴스·숏폼·상세페이지 등 제작 및 편집',
    goal: '기획 의도를 실제 결과물(카피·이미지·영상)로 완성도 있게 구현해 클릭과 반응을 끌어내는 것',
    skills: '카피라이팅 · 디자인/편집 툴 활용 · 포맷별 문법 이해(카드뉴스·숏폼·상세페이지) · 마감 관리',
    metrics: '제작물 수·제작 주기, 콘텐츠별 CTR·조회수·완주율, 저장/공유 수, 전환 기여',
  },
  {
    key: 'channelOps', label: '채널 운영',
    desc: '블로그·인스타·유튜브 등 온드미디어 운영, 발행 일정 관리',
    goal: '채널을 꾸준히 운영해 팔로워·구독자를 자산으로 쌓고, 브랜드와 고객의 접점을 유지하는 것',
    skills: '콘텐츠 캘린더 운영 · 커뮤니티 소통 · 채널 알고리즘 이해 · 일관된 브랜딩 유지',
    metrics: '팔로워/구독자 증가율, 게시 빈도·운영 기간, 도달·프로필 방문, 참여율(ER)',
  },
  {
    key: 'analytics', label: '성과 분석',
    desc: '도달·클릭·전환 등 데이터 측정 후 다음 콘텐츠에 반영',
    goal: '데이터로 무엇이 통했는지 검증하고, 다음 실행의 우선순위를 바꿔 성과를 반복 개선하는 것',
    skills: '지표 정의 · 데이터 수집/해석(GA·인사이트 등) · A/B 테스트 · 리포팅과 개선 제안',
    metrics: 'CTR·전환율·CPA/ROAS, 실험 횟수와 개선폭(전/후 비교), 리포트 기반 의사결정 사례',
  },
  {
    key: 'trend', label: '트렌드 리서치',
    desc: '밈·트렌드·경쟁사 모니터링으로 콘텐츠 아이디어 발굴',
    goal: '시장·밈·경쟁사 흐름을 빠르게 포착해 우리 브랜드가 쓸 수 있는 아이디어로 번역하는 것',
    skills: '트렌드 감지력 · 경쟁사/레퍼런스 분석 · 인사이트 요약 · 아이디어 제안',
    metrics: '리서치→실제 반영된 아이디어 수, 반영 콘텐츠의 반응, 리서치 주기·아카이브 축적량',
  },
];

const EXPERIENCE_OPTION_META = {
  common: {
    helper: '직군을 딱 잘라 말하기 어렵거나 여러 역할이 섞인 경험',
    examples: '동아리 프로젝트 · 공모전 · 팀 활동',
    keywords: '상황 · 역할 · 결과',
  },
  dev: {
    helper: '기술 선택, 구현 과정, 트러블슈팅, 성능 개선을 보여줄 경험',
    examples: '웹 서비스 개발 · API 설계 · 성능 최적화',
    keywords: '문제 해결 · 기술 선택 · 성능',
  },
  aiml: {
    helper: '데이터셋, 모델링, 실험, 평가 지표를 설명할 수 있는 경험',
    examples: '모델 학습 · 추천 시스템 · 실험 리포트',
    keywords: '데이터 · 모델 · 평가',
  },
  da: {
    helper: '데이터로 문제를 정의하고 인사이트나 액션을 만든 경험',
    examples: '대시보드 · A/B 테스트 · 지표 분석',
    keywords: '가설 · 분석 · 인사이트',
  },
  devops: {
    helper: '배포, 인프라, 자동화, 비용이나 안정성 개선을 다룬 경험',
    examples: 'CI/CD · 클라우드 인프라 · 모니터링',
    keywords: '자동화 · 안정성 · 비용',
  },
  pm: {
    helper: '문제 정의, 사용자 흐름, 우선순위와 출시 판단을 보여줄 경험',
    examples: 'PRD · 기능 기획 · 런칭 회고',
    keywords: '문제 정의 · 우선순위 · 출시',
  },
  designer: {
    helper: '리서치, 프로토타입, 사용성 개선, 디자인 시스템을 다룬 경험',
    examples: 'UX 리서치 · 프로토타입 · UI 개선',
    keywords: '리서치 · 개선 · 사용성',
  },
  marketer: {
    helper: '타깃, 메시지, 채널, 성과 지표를 중심으로 정리할 경험',
    examples: 'SNS 캠페인 · 콘텐츠 운영 · 퍼포먼스 개선',
    keywords: '타깃 · 메시지 · 성과',
  },
  hr: {
    helper: '채용, 온보딩, 조직문화, 구성원 경험을 개선한 경험',
    examples: '채용 퍼널 · 온보딩 · 리텐션 프로그램',
    keywords: '프로세스 · 구성원 경험 · 전환',
  },
  sales: {
    helper: '리드 발굴, 제안, 협상, 계약 성과를 보여줄 경험',
    examples: 'B2B 제안 · 리드 제너레이션 · 계약 전환',
    keywords: '리드 · 제안 · 계약',
  },
};

const MARKETER_OPTION_META = {
  contentPlan: {
    helper: '캠페인 주제, 타깃, 메시지와 일정을 설계한 경험',
    examples: 'SNS 캠페인 · 뉴스레터 · 프로모션',
    keywords: '타깃 · 목표 · 기획 의도',
  },
  contentMake: {
    helper: '카피, 카드뉴스, 영상 등 실제 콘텐츠를 제작한 경험',
    examples: '상세페이지 · 숏폼 영상 · 광고 소재',
    keywords: '제작 과정 · 표현 방식 · 기여 범위',
  },
  channelOps: {
    helper: '브랜드 채널을 직접 운영하고 콘텐츠를 발행한 경험',
    examples: '블로그 · 인스타그램 · 유튜브',
    keywords: '운영 방식 · 발행 주기 · 반응 변화',
  },
  analytics: {
    helper: '데이터를 분석하고 다음 콘텐츠나 캠페인을 개선한 경험',
    examples: '조회수 분석 · 클릭률 개선 · 전환율 분석',
    keywords: '지표 · 원인 분석 · 개선 결과',
  },
  trend: {
    helper: '시장, 경쟁사, 고객 반응을 조사해 아이디어를 발굴한 경험',
    examples: '경쟁사 분석 · 트렌드 조사 · 고객 인터뷰',
    keywords: '조사 방법 · 발견점 · 실제 반영',
  },
};

const getJobContextLabel = (jobCategory, marketerField) => {
  const job = JOB_LABELS[jobCategory] || '경험';
  if (marketerField?.label) return `${job.replace(/\s*\(.+\)/, '')} · ${marketerField.label}`;
  return `경험 정리 · ${job}`;
};

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
    <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-primary-100 bg-primary-50 text-[13px] font-black text-primary-700">
      F
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
  const text = asText(children);
  const [headline, ...rest] = text.split('\n').filter(Boolean);
  return (
    <article className="flex items-start gap-3 animate-fadeIn" aria-label="FitPoly 질문">
      <AiAvatar />
      <div className="max-w-[760px] rounded-[16px] border border-primary-100 bg-[#F6F8FF] px-5 py-4">
        <p className="text-[12px] font-bold text-primary-700">FitPoly 경험 가이드</p>
        <p className="mt-2 text-[18px] font-bold leading-snug text-bluewood-900 whitespace-pre-wrap" style={{ wordBreak: 'keep-all' }}>
          {headline || text}
        </p>
        {rest.length > 0 && (
          <p className="mt-2 text-[14.5px] leading-relaxed text-bluewood-600 whitespace-pre-wrap" style={{ wordBreak: 'keep-all' }}>
            {rest.join('\n')}
          </p>
        )}
      </div>
    </article>
  );
}

/* AI 입력 중 인디케이터 */
function TypingBubble() {
  return (
    <div className="flex items-start gap-3 animate-fadeIn" aria-live="polite">
      <AiAvatar />
      <div className="flex items-center gap-2 rounded-[14px] border border-primary-100 bg-white px-4 py-3 text-[13px] font-semibold text-bluewood-500">
        <span className="h-2 w-2 rounded-full bg-primary-500 animate-pulse" aria-hidden="true" />
        답변을 경험 노트에 반영하고 있어요
      </div>
    </div>
  );
}

/* 사용자 말풍선 */
function UserBubble({ children }) {
  return (
    <div className="flex justify-end animate-fadeIn" aria-label="사용자 답변">
      <div className="max-w-[82%] rounded-[16px] border border-primary-100 bg-primary-50 px-4 py-3 text-[14.5px] leading-relaxed text-bluewood-800 whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}

/* 진행 단계 스테퍼 — 지금 어디쯤인지 한눈에 */
function FlowStepper({ phase }) {
  const current = PHASE_STEP[phase] ?? 0;
  const percent = ((current + 1) / FLOW_STEPS.length) * 100;
  return (
    <nav aria-label="경험 정리 진행 단계" className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-bold text-primary-700">
          {current + 1} / {FLOW_STEPS.length} 단계 · {FLOW_STEPS[current]}
        </p>
        <ol className="hidden sm:flex items-center gap-2 text-[12px] font-semibold">
          {FLOW_STEPS.map((label, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li
                key={label}
                aria-current={active ? 'step' : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap ${
                  active ? 'text-primary-700' : done ? 'text-bluewood-600' : 'text-bluewood-300'
                }`}
              >
                {done ? <Check size={13} aria-hidden="true" /> : <span className="text-[11px]">{i + 1}</span>}
                {label}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-200" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary-600 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </nav>
  );
}

function ExperienceBackLink({ className = '' }) {
  return (
    <Link
      to="/app/experience"
      className={`inline-flex min-h-[44px] items-center gap-2 text-[14px] font-semibold text-bluewood-500 transition-colors hover:text-bluewood-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 ${className}`}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      경험 목록으로
    </Link>
  );
}

function FocusHeader({ phase }) {
  const saving = phase === 'saving';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-200/70 bg-white/70 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="FitPoly" className="h-7 w-auto" />
        <span className="h-4 w-px bg-surface-200" aria-hidden="true" />
        <span className="text-[13px] font-bold text-bluewood-700">경험 정리</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-bluewood-500" aria-live="polite">
          {saving ? <BarsLoader height={12} /> : <ShieldCheck size={14} className="text-caribbean-600" aria-hidden="true" />}
          {saving ? '저장 중...' : '저장 전까지 자유롭게 수정 가능'}
        </span>
        <Link
          to="/app/experience"
          className="inline-flex min-h-[38px] items-center rounded-lg border border-surface-200 bg-white px-3 text-[13px] font-bold text-bluewood-600 transition-colors hover:border-primary-200 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
        >
          나가기
        </Link>
      </div>
    </div>
  );
}

function FitPolyGuidePanel({ children }) {
  return (
    <section className="flex gap-3 rounded-[14px] bg-[#F1F5FF] px-4 py-4 text-left sm:px-[18px]" aria-label="FitPoly 경험 가이드">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-black text-primary-700 shadow-[0_1px_3px_rgba(16,24,40,0.06)]" aria-hidden="true">
        F
      </span>
      <div>
        <p className="text-[13px] font-bold text-primary-700">FitPoly 경험 가이드</p>
        <p className="mt-1 text-[15px] leading-relaxed text-bluewood-700" style={{ wordBreak: 'keep-all' }}>
          {children}
        </p>
      </div>
    </section>
  );
}

function SelectionOption({ option, selected = false, onSelect, meta }) {
  const helper = meta?.helper || option.description;
  const examples = meta?.examples || option.description;
  const keywords = meta?.keywords;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(option)}
      className={`group flex min-h-[104px] w-full items-start justify-between gap-4 rounded-[14px] border bg-white px-5 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 ${
        selected
          ? 'border-primary-500 ring-1 ring-primary-100'
          : 'border-surface-200 hover:-translate-y-0.5 hover:border-primary-200'
      }`}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[16px] font-bold leading-snug text-bluewood-900">
          {option.label}
          {selected && <span className="text-[12px] font-bold text-primary-700">선택됨</span>}
        </span>
        <span className="mt-1.5 block text-[14px] leading-relaxed text-bluewood-600" style={{ wordBreak: 'keep-all' }}>
          {helper}
        </span>
        <span className="mt-2 block text-[13px] font-semibold leading-relaxed text-bluewood-400" style={{ wordBreak: 'keep-all' }}>
          {examples}
        </span>
        {keywords && (
          <span className="mt-3 inline-flex rounded-lg bg-surface-50 px-2.5 py-1 text-[12px] font-bold text-bluewood-500">
            질문 키워드: {keywords}
          </span>
        )}
      </span>
      <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
        selected ? 'bg-primary-600 text-white' : 'bg-surface-50 text-bluewood-300 group-hover:bg-primary-50 group-hover:text-primary-700'
      }`}>
        {selected ? <Check size={16} aria-hidden="true" /> : <ChevronRight size={17} aria-hidden="true" />}
      </span>
    </button>
  );
}

function CustomMarketerInput({ value, onChange, onSubmit, disabled }) {
  return (
    <div className="rounded-[14px] border border-dashed border-surface-300 bg-white px-5 py-4 animate-fadeIn">
      <label htmlFor="custom-marketer-field" className="block text-[15px] font-bold text-bluewood-800">
        원하는 항목이 없나요?
      </label>
      <p className="mt-1 text-[13.5px] leading-relaxed text-bluewood-500">
        기존 마케터 흐름은 유지하고, 입력한 이름만 경험 유형으로 기록해요.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="custom-marketer-field"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="예: 브랜드 콜라보 캠페인"
          className="min-h-[44px] flex-1 rounded-xl border border-surface-200 bg-white px-3.5 text-[14px] text-bluewood-800 outline-none transition focus:border-primary-300 focus:ring-4 focus:ring-primary-50"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-bluewood-900 px-4 text-[14px] font-bold text-white transition-colors hover:bg-bluewood-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          직접 작성으로 시작
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function ExperienceSelectionWorkspace({
  phase,
  jobCategory,
  marketerField,
  onSelectField,
  onSelectMarketerField,
  customMarketerValue,
  onCustomMarketerChange,
  onCustomMarketerSubmit,
}) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const isMarketerStep = phase === 'mkField';
  const options = isMarketerStep
    ? MARKETER_FIELDS.map(item => ({
        value: item.key,
        label: item.label,
        description: item.desc,
        raw: item,
      }))
    : JOB_CATEGORIES.flatMap(group => group.items.map(item => ({ ...item, group: group.group })));
  const selectedValue = selectedOption?.value || (isMarketerStep ? marketerField?.key : jobCategory);
  const context = isMarketerStep ? '경험 정리 · 마케터' : '경험 정리';
  const question = isMarketerStep ? '어떤 마케팅 경험부터 정리해볼까요?' : '어떤 분야의 경험부터 정리해볼까요?';
  const guide = isMarketerStep
    ? '선택한 경험을 바탕으로 역할, 과정, 성과를 차근차근 질문할게요. 정확히 맞지 않아도 괜찮고, 결과가 완성되기 전까지 언제든 수정할 수 있습니다.'
    : '먼저 경험의 큰 분야를 정해볼게요. 가장 가까운 항목을 고르면 이후 질문과 자료 입력 방식이 그 분야에 맞춰 정리됩니다.';

  return (
    <div className="min-h-full bg-[#F7F9FC]">
      <FocusHeader phase={phase} />
      <main className="mx-auto w-full max-w-[960px] px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <ExperienceBackLink />
        <div className="mt-8">
          <FlowStepper phase={phase} />
        </div>
        <section className="mt-10">
          <p className="text-[13px] font-bold text-primary-700">{context}</p>
          <h1 className="mt-2 max-w-[760px] text-[28px] font-extrabold leading-[1.35] text-bluewood-900 sm:text-[32px]" style={{ wordBreak: 'keep-all' }}>
            {question}
          </h1>
          <p className="mt-3 max-w-[680px] text-[15.5px] leading-relaxed text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
            완벽하게 기억하지 않아도 괜찮아요. 가장 가까운 항목을 하나 선택해주세요.
          </p>
        </section>
        <div className="mt-6">
          <FitPolyGuidePanel>{guide}</FitPolyGuidePanel>
        </div>
        <section className="mt-8" aria-labelledby="experience-type-heading">
          <h2 id="experience-type-heading" className="sr-only">
            경험 유형 선택
          </h2>
          <div role="radiogroup" aria-label={question} className="space-y-3">
            {options.map(option => {
              const actualOption = option.raw || option;
              const meta = isMarketerStep ? MARKETER_OPTION_META[option.value] : EXPERIENCE_OPTION_META[option.value];
              return (
                <SelectionOption
                  key={option.value}
                  option={actualOption}
                  selected={selectedValue === option.value}
                  onSelect={() => {
                    setCustomOpen(false);
                    setSelectedOption(option);
                  }}
                  meta={meta}
                />
              );
            })}
          </div>
        </section>
        {isMarketerStep && (
          <div className="mt-5 space-y-3">
            {!customOpen ? (
              <button
                type="button"
                onClick={() => { setSelectedOption(null); setCustomOpen(true); }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl text-[14px] font-bold text-bluewood-600 transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
              >
                목록에 없는 경험인가요? 직접 작성하기
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            ) : (
              <CustomMarketerInput
                value={customMarketerValue}
                onChange={onCustomMarketerChange}
                onSubmit={onCustomMarketerSubmit}
                disabled={false}
              />
            )}
          </div>
        )}
        <div className="mt-8 flex flex-col gap-4 border-t border-surface-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-[13.5px] leading-relaxed text-bluewood-500">
            <p className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-caribbean-600" aria-hidden="true" />
              선택한 내용은 다음 단계에서 바꿀 수 있어요.
            </p>
            <p>예상 소요 시간은 약 7~10분입니다.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!selectedOption) return;
              const actualOption = selectedOption.raw || selectedOption;
              (isMarketerStep ? onSelectMarketerField : onSelectField)(actualOption);
            }}
            disabled={!selectedOption || customOpen}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-[15px] font-bold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-surface-200 disabled:text-bluewood-400"
          >
            {selectedOption ? '이 경험으로 시작하기' : '경험을 선택해주세요'}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </main>
    </div>
  );
}

function ExperienceBasicsWorkspace({
  phase,
  jobCategory,
  marketerField,
  title,
  onTitleChange,
  startMonth,
  onStartMonthChange,
  endMonth,
  onEndMonthChange,
  onSubmit,
  onBack,
}) {
  const jobContext = getJobContextLabel(jobCategory, marketerField);
  const titlePlaceholder = jobCategory === 'marketer'
    ? '예: 인스타그램 릴스 운영으로 팔로워 3배 성장'
    : '예: 이미지 무단학습 방지 시스템 개발';
  const periodReady = (!startMonth && !endMonth) || (startMonth && endMonth && endMonth >= startMonth);
  const canSubmit = title.trim() && periodReady;

  return (
    <div className="min-h-full bg-[#F7F9FC]">
      <FocusHeader phase={phase} />
      <main className="mx-auto w-full max-w-[880px] px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center gap-2 text-[14px] font-semibold text-bluewood-500 transition-colors hover:text-bluewood-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          경험 유형 다시 선택
        </button>
        <div className="mt-8">
          <FlowStepper phase={phase} />
        </div>

        <section className="mt-10">
          <p className="text-[13px] font-bold text-primary-700">{jobContext}</p>
          <h1 className="mt-2 text-[28px] font-extrabold leading-[1.35] text-bluewood-900 sm:text-[32px]" style={{ wordBreak: 'keep-all' }}>
            인터뷰 전에 기본 정보를 먼저 정해둘게요.
          </h1>
          <p className="mt-3 max-w-[680px] text-[15.5px] leading-relaxed text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
            제목과 기간을 한 번에 입력하면 이후 질문이 더 자연스럽게 이어집니다. 정확하지 않으면 대략적인 이름과 기간으로 시작해도 괜찮아요.
          </p>
        </section>

        <section className="mt-8 rounded-[16px] border border-surface-200 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] sm:px-6 sm:py-6" aria-labelledby="basics-heading">
          <h2 id="basics-heading" className="text-[18px] font-bold text-bluewood-900">경험 기본 정보</h2>
          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor="experience-title" className="block text-[13px] font-bold text-bluewood-700">
                경험 제목
              </label>
              <input
                id="experience-title"
                value={title}
                onChange={e => onTitleChange(e.target.value)}
                placeholder={titlePlaceholder}
                className="mt-2 min-h-[52px] w-full rounded-xl border border-surface-200 bg-white px-4 text-[15px] font-semibold text-bluewood-900 outline-none transition placeholder:font-normal placeholder:text-bluewood-300 focus:border-primary-300 focus:ring-4 focus:ring-primary-50"
              />
            </div>

            <fieldset>
              <legend className="text-[13px] font-bold text-bluewood-700">진행 기간</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <label className="block">
                  <span className="sr-only">시작 월</span>
                  <input
                    type="month"
                    value={startMonth}
                    onChange={e => onStartMonthChange(e.target.value)}
                    className="min-h-[52px] w-full rounded-xl border border-surface-200 bg-white px-4 text-[15px] text-bluewood-800 outline-none transition focus:border-primary-300 focus:ring-4 focus:ring-primary-50"
                  />
                </label>
                <span className="hidden text-bluewood-300 sm:block">~</span>
                <label className="block">
                  <span className="sr-only">종료 월</span>
                  <input
                    type="month"
                    value={endMonth}
                    onChange={e => onEndMonthChange(e.target.value)}
                    className="min-h-[52px] w-full rounded-xl border border-surface-200 bg-white px-4 text-[15px] text-bluewood-800 outline-none transition focus:border-primary-300 focus:ring-4 focus:ring-primary-50"
                  />
                </label>
              </div>
              {!periodReady && (
                <p className="mt-2 text-[13px] font-semibold text-amber-700" role="alert">
                  시작 월과 종료 월을 모두 입력하거나 둘 다 비워주세요. 종료 월은 시작 월보다 빠를 수 없어요.
                </p>
              )}
              <p className="mt-2 text-[13px] leading-relaxed text-bluewood-400">
                기간이 기억나지 않으면 비워두고 넘어가도 됩니다. 나중에 결과 화면에서 수정할 수 있어요.
              </p>
            </fieldset>
          </div>
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13.5px] leading-relaxed text-bluewood-500">
            다음 단계에서 파일, 링크, 메모를 올리면 FitPoly가 핵심 경험을 추출합니다.
          </p>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-[15px] font-bold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-surface-200 disabled:text-bluewood-400"
          >
            자료 입력으로 넘어가기
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </main>
    </div>
  );
}

function MaterialsPrepWorkspace({ phase, jobCategory, marketerField, preset, onSubmit, onBack }) {
  return (
    <div className="min-h-full bg-[#F7F9FC]">
      <FocusHeader phase={phase} />
      <main className="mx-auto w-full max-w-[960px] px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center gap-2 text-[14px] font-semibold text-bluewood-500 transition-colors hover:text-bluewood-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          기본 정보 수정
        </button>
        <div className="mt-8">
          <FlowStepper phase={phase} />
        </div>
        <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div>
            <p className="text-[13px] font-bold text-primary-700">{getJobContextLabel(jobCategory, marketerField)}</p>
            <h1 className="mt-2 text-[28px] font-extrabold leading-[1.35] text-bluewood-900 sm:text-[32px]" style={{ wordBreak: 'keep-all' }}>
              자료를 올리면 경험 조각을 먼저 정리해볼게요.
            </h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
              파일, 링크, 짧은 메모 중 편한 방식으로 넣어주세요. 다음 단계에서 추출된 핵심 경험만 골라 초안을 만듭니다.
            </p>
            <div className="mt-6">
              <FitPolyGuidePanel>{preset.intro}</FitPolyGuidePanel>
            </div>
          </div>
          <aside className="rounded-[16px] border border-surface-200 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
            <h2 className="text-[17px] font-bold text-bluewood-900">자료 입력</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-bluewood-500">
              완벽한 문서가 아니어도 괜찮아요. 가지고 있는 단서만으로 시작할 수 있습니다.
            </p>
            <div className="mt-4">
              <MaterialsWidget bare preset={preset} onSubmit={onSubmit} busy={false} />
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function ProcessingWorkspace({ phase, buildSteps }) {
  const label = phase === 'building' ? '경험 초안을 만드는 중' : '자료에서 경험 조각을 찾는 중';
  return (
    <div className="min-h-full bg-[#F7F9FC]">
      <FocusHeader phase={phase} />
      <main className="mx-auto w-full max-w-[760px] px-4 pb-20 pt-14 sm:px-6">
        <FlowStepper phase={phase} />
        <section className="mt-10 rounded-[18px] border border-surface-200 bg-white px-6 py-6 shadow-[0_1px_3px_rgba(16,24,40,0.06)]" aria-busy="true">
          <p className="text-[13px] font-bold text-primary-700">FitPoly 경험 가이드</p>
          <h1 className="mt-2 text-[26px] font-extrabold text-bluewood-900">{label}</h1>
          <div className="mt-6 space-y-3">
            {buildSteps.map((s, i) => (
              <div key={`${s.label}-${i}`} className="flex items-center gap-3 rounded-xl bg-surface-50 px-4 py-3 text-[14px]">
                <span className="flex h-6 w-6 items-center justify-center">
                  {s.status === 'done'
                    ? <Check size={16} className="text-caribbean-700" aria-hidden="true" />
                    : s.status === 'loading'
                      ? <BarsLoader height={14} />
                      : <span className="h-2 w-2 rounded-full bg-surface-300" aria-hidden="true" />}
                </span>
                <span className={s.status === 'pending' ? 'text-bluewood-400' : 'font-semibold text-bluewood-800'}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function MomentsReviewWorkspace({ phase, moments, onToggle, onConfirm }) {
  const selectedCount = moments.filter(m => m.selected).length;
  return (
    <div className="min-h-full bg-[#F7F9FC]">
      <FocusHeader phase={phase} />
      <main className="mx-auto w-full max-w-[960px] px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <FlowStepper phase={phase} />
        <section className="mt-10">
          <p className="text-[13px] font-bold text-primary-700">핵심 경험 검토</p>
          <h1 className="mt-2 text-[28px] font-extrabold leading-[1.35] text-bluewood-900 sm:text-[32px]" style={{ wordBreak: 'keep-all' }}>
            포트폴리오에 담을 경험만 남겨주세요.
          </h1>
          <p className="mt-3 max-w-[680px] text-[15.5px] leading-relaxed text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
            자료에서 찾은 경험 조각입니다. 선택한 항목을 중심으로 초안을 만들고, 이후 인터뷰에서 부족한 정보를 보완합니다.
          </p>
        </section>
        <div className="mt-8 rounded-[16px] border border-surface-200 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-[14px] font-bold text-bluewood-700">{selectedCount} / {moments.length} 선택</span>
            <button
              type="button"
              onClick={onConfirm}
              disabled={selectedCount === 0 || phase === 'building'}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-[14px] font-bold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-surface-200 disabled:text-bluewood-400"
            >
              선택한 경험으로 초안 만들기
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          <MomentsWidget
            moments={moments}
            onToggle={onToggle}
            onConfirm={onConfirm}
            readOnly={phase === 'building'}
            showConfirm={false}
          />
        </div>
      </main>
    </div>
  );
}

function InterviewProgressRail({ phase, draft, title, startMonth, endMonth, currentQ, completeness }) {
  const railSteps = [
    { key: 'select', label: '경험 선택', done: true },
    { key: 'background', label: '상황과 배경', done: !!title.trim() && (!!draft?.overview && !isWeak(draft.overview)) },
    { key: 'problem', label: '문제와 목표', done: !isWeak(draft?.task) || !isWeak(draft?.overview) },
    { key: 'role', label: '나의 역할', done: !isWeak(draft?.projectOverview?.role) },
    { key: 'process', label: '실행 과정', done: !isWeak(draft?.process) },
    { key: 'result', label: '성과와 변화', done: !isWeak(draft?.output) || (Array.isArray(draft?.keyExperiences) && draft.keyExperiences.some(ke => asText(ke.metric || ke.afterMetric))) },
    { key: 'growth', label: '배운 점', done: !isWeak(draft?.growth) },
    { key: 'finish', label: '최종 정리', done: phase === 'saving' },
  ];
  const currentKey = currentQ?.key === 'role' ? 'role'
    : currentQ?.key === 'process' ? 'process'
    : currentQ?.key === 'output' || currentQ?.widget === 'metric' ? 'result'
    : currentQ?.key === 'growth' ? 'growth'
    : currentQ ? 'background'
    : phase === 'saving' ? 'finish'
    : railSteps.find(step => !step.done)?.key || 'finish';

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-6 rounded-[16px] border border-surface-200 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
        <p className="text-[12px] font-bold text-primary-700">인터뷰 진행</p>
        <ol className="mt-4 space-y-3" aria-label="인터뷰 진행 레일">
          {railSteps.map((step, index) => {
            const active = step.key === currentKey;
            return (
              <li
                key={step.key}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2 text-[13px] font-semibold ${
                  active ? 'text-primary-700' : step.done ? 'text-bluewood-700' : 'text-bluewood-300'
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  step.done ? 'bg-primary-600 text-white' : active ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200' : 'bg-surface-100 text-bluewood-300'
                }`}>
                  {step.done ? <Check size={13} aria-hidden="true" /> : index + 1}
                </span>
                {step.label}
              </li>
            );
          })}
        </ol>
        <div className="mt-5 border-t border-surface-100 pt-4">
          <p className="text-[12px] font-bold text-bluewood-500">경험 완성도</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-200">
            <span className="block h-full rounded-full bg-primary-600" style={{ width: `${completeness}%` }} />
          </div>
          <p className="mt-2 text-[12px] font-semibold text-bluewood-500">{completeness}% · 약간만 더 채우면 좋아요</p>
          {(startMonth && endMonth) && (
            <p className="mt-3 text-[12px] text-bluewood-400">{startMonth} ~ {endMonth}</p>
          )}
        </div>
      </div>
    </aside>
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
    <div className="mt-2 rounded-xl border border-surface-200 bg-surface-50/50 p-4 space-y-3 animate-fadeIn">
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

/* ── 자료 입력 위젯 (분야 프리셋 반영) — bare: 우측 패널에 담을 때 자체 테두리 없이 ── */
function MaterialsWidget({ preset, onSubmit, busy, bare = false }) {
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState({});
  const [extraLinks, setExtraLinks] = useState([]);
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

  const hasInput = files.length > 0 || text.trim() || Object.values(links).some(v => v?.trim()) || extraLinks.some(v => v.trim());

  return (
    <div className={bare ? 'space-y-3' : 'mt-2 rounded-xl border border-surface-200 bg-surface-50/50 p-4 space-y-3 animate-fadeIn'}>
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

      {/* 추가 링크 — 채널이 많은 직군(마케터 등) */}
      {preset.extraLinks && (
        <div className="space-y-2">
          {extraLinks.map((v, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-primary-200">
              <Link2 size={14} className="flex-shrink-0 text-bluewood-300" />
              <input
                value={v}
                onChange={e => setExtraLinks(prev => prev.map((x, xi) => xi === i ? e.target.value : x))}
                placeholder="https://... (추가 산출물 링크)"
                className="flex-1 text-[13px] text-bluewood-800 outline-none placeholder:text-bluewood-300 bg-transparent"
              />
              <button onClick={() => setExtraLinks(prev => prev.filter((_, xi) => xi !== i))} className="flex-shrink-0 text-[11px] font-semibold text-bluewood-400 hover:text-red-500 transition-colors">삭제</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExtraLinks(prev => [...prev, ''])}
            className="text-[12px] font-semibold text-bluewood-400 hover:text-primary-600 transition-colors"
          >
            + 산출물 링크 추가
          </button>
        </div>
      )}

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
          const linkList = [
            ...preset.links.map(l => ({ ...l, url: (links[l.key] || '').trim() })),
            ...extraLinks.map((url, i) => ({ key: `extra-${i}`, label: '산출물 링크', source: 'blog', url: url.trim() })),
          ].filter(l => l.url);
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

/* ── 핵심 경험 검토 — 추출된 경험을 선택/해제 후 확정 (우측 분할 패널에서 사용) ── */
function MomentsWidget({ moments, onToggle, onConfirm, readOnly = false, showConfirm = true }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selectedCount = moments.filter(m => m.selected).length;

  return (
    <div className="space-y-2.5">
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
                disabled={readOnly}
                className={`flex-shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed ${
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
      {showConfirm && !readOnly && (
        <button
          onClick={onConfirm}
          disabled={selectedCount === 0}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-[14px] font-bold hover:bg-primary-700 disabled:opacity-40 transition-colors shadow-sm shadow-primary-600/20"
        >
          <Sparkles size={15} /> 선택한 경험 {selectedCount}개로 초안 만들기
        </button>
      )}
    </div>
  );
}

export default function ExperienceChat() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { createExperience, draftAnalyze, extractMoments } = useExperienceStore();

  const [phase, setPhase] = useState('field'); // field(히어로) | mkField(마케터 세부분야) | basics(제목·기간) | materials | extracting | moments | building | fill | saving
  const [marketerField, setMarketerField] = useState(null); // 마케터 세부 분야 (MARKETER_FIELDS 항목)
  const [customMarketerField, setCustomMarketerField] = useState('');
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
  const [expandedSecs, setExpandedSecs] = useState(() => new Set()); // 우측 패널 섹션 펼침 상태

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
    const key = currentQ.widget === 'metric' ? 'keyExperiences'
      : currentQ.key.startsWith('mk') ? 'marketerKit'
      : currentQ.key;
    const el = panelRefs.current[key];
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentQ, phase]);

  const preset = MATERIAL_PRESETS[jobCategory] || MATERIAL_PRESETS.common;

  /* ── 1) 분야 선택 (히어로) → 기본 정보(제목·기간) ── */
  const selectField = async (item) => {
    setJobCategory(item.value);
    // 마케터는 세부 분야를 먼저 고르고, 분야의 목표·역량·지표를 짚은 뒤 정리 시작
    if (item.value === 'marketer') {
      setPhase('mkField');
      return;
    }
    setPhase('basics');
    setCurrentQ(null);
  };

  /* 마케터 세부 분야 선택 → 분야 브리핑(목표·역량·지표) → 제목 질문 */
  const selectMarketerField = async (f) => {
    setMarketerField(f);
    setPhase('basics');
    setCurrentQ(null);
  };

  const startCustomMarketerField = () => {
    const label = customMarketerField.trim();
    if (!label) return;
    selectMarketerField({
      key: 'custom',
      label,
      desc: '직접 입력한 마케팅 경험 유형',
      goal: '선택한 경험의 역할, 과정, 성과를 포트폴리오에서 설명할 수 있게 정리하는 것',
      skills: '문제 정의 · 실행 과정 설명 · 성과 근거 정리 · 배운 점 도출',
      metrics: '성과 수치, 반응 지표, 전환 지표, 운영 기간, 산출물 등 확보 가능한 근거',
    });
  };

  const submitBasicsInfo = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error('경험 제목을 입력해주세요');
      return;
    }
    if ((startMonth && !endMonth) || (!startMonth && endMonth)) {
      toast.error('기간은 시작 월과 종료 월을 모두 입력하거나 둘 다 비워주세요');
      return;
    }
    if (startMonth && endMonth && endMonth < startMonth) {
      toast.error('종료 월이 시작 월보다 빠를 수 없어요');
      return;
    }
    goMaterials();
  };

  /* 기본 정보 — 기간 질문 */
  const askPeriod = async () => {
    setCurrentQ(null);
    await pushAi('언제부터 언제까지 진행한 경험인가요?\n(건너뛰면 나중에 타임라인에서 추가할 수 있어요)');
    setCurrentQ({ key: 'period', label: '기간', widget: 'period', question: '진행 기간' });
  };

  /* 기본 정보 완료 → 자료 입력 (입력 패널은 오른쪽에 분리) */
  const goMaterials = async () => {
    setCurrentQ(null);
    setPhase('materials');
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
        // URL로 소스 자동 감지. GitHub는 아래 커밋 분석이 별도로 담당하므로 README 내용을 초안 본문에 섞지 않는다.
        const source = /github\.com/i.test(link.url) ? 'github'
          : /notion\.(so|site)/i.test(link.url) ? 'notion'
          : link.source || 'blog';
        if (source !== 'github') {
          let content = '';
          try {
            const data = await importFromUrl(source, link.url, 'experience');
            content = data?.imported?.content || '';
          } catch {
            content = '';
          }
          if (content.trim()) {
            allText += `\n\n--- ${link.label}: ${link.url} ---\n${content.trim()}`;
          } else {
            allText += `\n\n--- 산출물 링크 (${link.label}): ${link.url} ---\n(페이지 내용을 직접 읽지 못했습니다. 이 링크는 지원자의 실제 산출물이므로 증거 자료 목록과 실행 내용에 반영하세요.)`;
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
      // 마케터 세부 분야 컨텍스트 — AI가 분야 관점(목표·지표)으로 정리하도록 자료 앞에 명시
      if (marketerField) {
        allText = `--- 마케팅 세부 분야 ---\n${marketerField.label}: ${marketerField.desc}\n이 경험은 '${marketerField.label}' 관점에서 정리하세요. 이 분야의 주요 지표: ${marketerField.metrics}\n${allText}`;
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
      await pushAi(`자료를 꼼꼼히 읽었어요. 핵심 경험 ${withFlags.length}개를 찾았습니다!${gitNote}
오른쪽 화면에서 포트폴리오에 담을 경험만 남기고 확인을 눌러주세요. 선택한 경험을 중심으로 초안을 만들게요.`);
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
      // 마케터 — 타깃이 비어 있으면 우선 질문 (ma.md: 타깃 없는 마케팅 경험은 설득력이 약함)
      if (jobCategory === 'marketer' && needsConfirm(analysis?.marketerKit?.funnel?.target)) {
        q.push({
          key: 'mkTarget', label: '타깃',
          question: '이 캠페인/콘텐츠는 누구를 타깃으로 했나요?\n(예: 20대 여성 예비 구매자, 가입 후 미구매 고객)',
          placeholder: '타깃과 그렇게 정한 이유를 적어주세요',
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
      // 마케터 — 증거 자료는 마지막에 확인 (포트폴리오 신뢰도의 핵심)
      if (jobCategory === 'marketer') {
        q.push({
          key: 'mkEvidence', label: '증거 자료',
          question: '마지막으로, 증거로 남아 있는 자료가 있나요? (콘텐츠 캡처, 성과 리포트, 링크 등)\n증거 자료가 있으면 포트폴리오 신뢰도가 크게 올라가요. 없으면 건너뛰어도 괜찮아요.',
          placeholder: '예: 카드뉴스 캡처 10장, 인스타그램 인사이트 캡처, 캠페인 링크',
        });
      }

      setMessages([]);
      msgId.current = 1;
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
    } else if (item.key === 'mkTarget') {
      setDraft(prev => ({
        ...prev,
        marketerKit: { ...(prev?.marketerKit || {}), funnel: { ...(prev?.marketerKit?.funnel || {}), target: a } },
      }));
      setFlashKey('marketerKit');
    } else if (item.key === 'mkEvidence') {
      setDraft(prev => ({
        ...prev,
        marketerKit: {
          ...(prev?.marketerKit || {}),
          evidenceChecklist: [a, ...(prev?.marketerKit?.evidenceChecklist || [])],
        },
      }));
      setFlashKey('marketerKit');
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
    setMarketerField(null);
    setCustomMarketerField('');
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
        ...(marketerField ? { marketerField: marketerField.label } : {}),
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

  const canType = !!currentQ && !currentQ.widget && phase === 'fill';

  /* ── 선택 단계: 채팅 입력창을 숨기고 질문 중심 워크스페이스로 시작한다 ── */
  if (phase === 'field' || phase === 'mkField') {
    return (
      <ExperienceSelectionWorkspace
        phase={phase}
        jobCategory={jobCategory}
        marketerField={marketerField}
        onSelectField={selectField}
        onSelectMarketerField={selectMarketerField}
        customMarketerValue={customMarketerField}
        onCustomMarketerChange={setCustomMarketerField}
        onCustomMarketerSubmit={startCustomMarketerField}
      />
    );
  }

  if (phase === 'basics') {
    return (
      <ExperienceBasicsWorkspace
        phase={phase}
        jobCategory={jobCategory}
        marketerField={marketerField}
        title={title}
        onTitleChange={setTitle}
        startMonth={startMonth}
        onStartMonthChange={setStartMonth}
        endMonth={endMonth}
        onEndMonthChange={setEndMonth}
        onSubmit={submitBasicsInfo}
        onBack={changeField}
      />
    );
  }

  if (phase === 'materials' && !draft) {
    return (
      <MaterialsPrepWorkspace
        phase={phase}
        jobCategory={jobCategory}
        marketerField={marketerField}
        preset={preset}
        onSubmit={collectMaterials}
        onBack={() => {
          setCurrentQ(null);
          setPhase('basics');
        }}
      />
    );
  }

  if ((phase === 'extracting' || phase === 'building') && !draft) {
    return <ProcessingWorkspace phase={phase} buildSteps={buildSteps} />;
  }

  if (!draft && moments.length > 0 && phase === 'moments') {
    return (
      <MomentsReviewWorkspace
        phase={phase}
        moments={moments}
        onToggle={(id) => setMoments(prev => prev.map(m => m.id === id ? { ...m, selected: !m.selected } : m))}
        onConfirm={confirmMoments}
      />
    );
  }

  return (
    <div className="animate-fadeIn min-h-full bg-[#F7F9FC] px-4 py-6 pb-16 sm:px-6">
      <div className="mx-auto max-w-[1520px]">
      <FocusHeader phase={phase} />
      <ExperienceBackLink className="mt-4 mb-4" />

      <div className={draft
        ? 'grid grid-cols-1 gap-5 items-start lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[180px_minmax(0,1fr)_360px]'
        : 'max-w-[960px] mx-auto'
      }>
        {draft && (
          <InterviewProgressRail
            phase={phase}
            draft={draft}
            title={title}
            startMonth={startMonth}
            endMonth={endMonth}
            currentQ={currentQ}
            completeness={completeness}
          />
        )}
        {/* ═══ 좌측: AI 채팅 ═══ */}
        <div className="rounded-[14px] border border-surface-200 bg-white overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.06)] flex flex-col h-[calc(100dvh-190px)] min-h-[520px]">
          <div className="px-6 pt-5 pb-4 border-b border-surface-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13px] font-bold text-primary-700">{getJobContextLabel(jobCategory, marketerField)}</p>
                <h1 className="mt-1 text-[24px] font-extrabold leading-snug text-bluewood-900" style={{ wordBreak: 'keep-all' }}>
                  경험의 역할, 과정, 성과를 함께 채워볼게요.
                </h1>
                <p className="text-[14px] text-bluewood-500 mt-1.5" style={{ wordBreak: 'keep-all' }}>
                  자료를 올리고 부족한 부분만 질문으로 보완해 포트폴리오 초안을 만듭니다.
                </p>
              </div>
              {jobCategory && (
                <span className="hidden sm:inline-flex flex-shrink-0 px-2.5 py-1 rounded-md bg-primary-50 border border-primary-100 text-[12px] font-bold text-primary-600 animate-pop-in">
                  {JOB_LABELS[jobCategory]}
                </span>
              )}
            </div>
            <FlowStepper phase={phase} />
          </div>

          {/* 대화 영역 */}
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="AI 인터뷰 대화"
            className="flex-1 min-h-0 px-5 sm:px-6 py-6 overflow-y-auto space-y-5"
          >
            {messages.map((m, idx) => (
              <div key={m.id} ref={idx === messages.length - 1 ? lastMsgRef : null}>
                {m.role === 'ai'
                  ? <AiBubble>{m.text}</AiBubble>
                  : <UserBubble>{m.text}</UserBubble>}
              </div>
            ))}

            {/* AI 입력 중 */}
            {aiTyping && <TypingBubble />}

            {/* 마케터 세부 분야 선택 카드 */}
            {phase === 'mkField' && !aiTyping && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2 animate-fadeIn">
                {MARKETER_FIELDS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => selectMarketerField(f)}
                    className="rounded-xl border border-surface-200 bg-white px-4 py-3 text-left transition-all hover:border-primary-400 hover:bg-primary-50 active:scale-[0.98]"
                  >
                    <p className="text-[13.5px] font-extrabold text-bluewood-900">{f.label}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-bluewood-400" style={{ wordBreak: 'keep-all' }}>{f.desc}</p>
                  </button>
                ))}
              </div>
            )}

            {/* 자료 수집·초안 생성 진행 */}
            {(phase === 'extracting' || phase === 'building') && (
              <div className="mt-2 rounded-xl border border-surface-200 bg-surface-50/50 px-4 py-3.5 space-y-2">
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
              <div className="mt-2 rounded-xl border border-surface-200 bg-surface-50/50 p-4 animate-fadeIn">
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
              <div className="mt-2 rounded-xl border border-caribbean-200 bg-caribbean-50/50 p-4 animate-pop-in">
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
              <div className="mt-2 flex items-center gap-2.5 text-[13.5px] font-semibold text-bluewood-600">
                <BarsLoader height={14} /> 경험을 저장하고 있어요...
              </div>
            )}
          </div>

          {/* 채팅 입력 — 기본 정보와 AI 인터뷰 단계에서만 표시 */}
          {(phase === 'fill' || phase === 'basics') && (
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
                        ? '오른쪽 화면에서 핵심 경험을 확인하고 선택해주세요'
                        : '초안이 만들어지면 대화로 채울 수 있어요'
                }
                className="flex-1 resize-none bg-transparent text-[14px] leading-relaxed text-bluewood-800 outline-none placeholder:text-bluewood-300 disabled:cursor-not-allowed max-h-32"
              />
              <button
                onClick={submitAnswer}
                disabled={!canType || !chatInput.trim()}
                className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-30 transition-all active:scale-95"
                title="보내기"
                aria-label="답변 보내기"
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
          )}
        </div>

        {/* ═══ 우측: 핵심 경험 검토 — 추출되면 화면이 나뉘며 슬라이드 인 ═══ */}
        {/* ═══ 우측: 자료 입력 패널 — 대화와 분리해 간섭 없이 자료를 넣는다 ═══ */}
        {phase === 'materials' && !draft && (
          <div className="lg:sticky lg:top-6 rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-[0_10px_40px_rgba(49,65,87,0.06)] animate-panel-in">
            <div className="px-5 py-4 border-b border-surface-100 bg-gray-50/50 flex items-center gap-2">
              <span className="h-3.5 w-1 rounded-full bg-primary-600" />
              <span className="text-[14px] font-bold text-bluewood-800">자료 올리기</span>
            </div>
            <div className="px-5 py-5 max-h-[calc(100dvh-240px)] overflow-y-auto custom-scrollbar">
              <p className="mb-3 text-[12.5px] text-bluewood-400 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                파일·링크·메모, 있는 대로 편하게 넣어주세요. 완벽하지 않아도 괜찮아요.
              </p>
              <MaterialsWidget bare preset={preset} onSubmit={collectMaterials} busy={false} />
            </div>
          </div>
        )}

        {!draft && moments.length > 0 && (phase === 'moments' || phase === 'building') && (
          <div className="lg:sticky lg:top-6 rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-[0_10px_40px_rgba(49,65,87,0.06)] animate-panel-in">
            <div className="px-5 py-4 border-b border-surface-100 bg-gray-50/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-1 rounded-full bg-primary-600" />
                <span className="text-[14px] font-bold text-bluewood-800">핵심 경험 검토</span>
              </div>
              <span className="text-[12px] font-bold text-bluewood-400 bg-white border border-surface-200 rounded-md px-2 py-1">
                {moments.filter(m => m.selected).length} / {moments.length} 선택
              </span>
            </div>
            <div className="px-5 py-5 max-h-[calc(100dvh-240px)] overflow-y-auto">
              <p className="mb-3 text-[12.5px] text-bluewood-400 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                자료에서 추출한 핵심 경험이에요. 포트폴리오에 담을 경험만 남겨주세요.
              </p>
              <MomentsWidget
                moments={moments}
                onToggle={(id) => setMoments(prev => prev.map(m => m.id === id ? { ...m, selected: !m.selected } : m))}
                onConfirm={confirmMoments}
                readOnly={phase === 'building'}
              />
            </div>
          </div>
        )}

        {/* ═══ 우측: 실시간 경험 노트 — 대화에서 확인된 내용을 정리한다 ═══ */}
        {draft && (
        <div className="lg:sticky lg:top-6 rounded-[16px] border border-surface-200 bg-[#F9FAFC] overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.06)] animate-panel-in">
          <div className="px-5 py-4 border-b border-surface-200/70 bg-white/70 flex items-center justify-between gap-3">
            <div>
              <p className="text-[16px] font-extrabold text-bluewood-900">실시간 경험 노트</p>
              <p className="mt-0.5 text-[12.5px] text-bluewood-400">대화에서 확인된 내용만 반영돼요</p>
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

              {/* ═══ 채우기 파이프라인 — 부족한 부분을 한눈에 보고 바로 채우기 ═══ */}
              {(() => {
                const missing = [];
                if (!title.trim()) missing.push({ key: '__title', label: '제목' });
                SECTION_DEFS.forEach(d => { if (isWeak(draft[d.key])) missing.push({ key: d.key, label: d.label }); });
                const doneCount = SECTION_DEFS.filter(d => !isWeak(draft[d.key])).length;
                return (
                  <div className="rounded-xl border border-surface-100 bg-white px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-bold text-bluewood-400 uppercase tracking-[0.12em]">채우기 진행</p>
                      <span className="text-[11px] font-bold text-primary-600 tabular-nums">{doneCount} / {SECTION_DEFS.length} 섹션</span>
                    </div>
                    {/* 섹션별 세그먼트 바 */}
                    <div className="mb-2.5 flex gap-1">
                      {SECTION_DEFS.map(d => (
                        <span
                          key={d.key}
                          title={d.label}
                          className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                            isWeak(draft[d.key]) ? 'bg-surface-200' : 'bg-primary-500'
                          }`}
                        />
                      ))}
                    </div>
                    {missing.length === 0 ? (
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-caribbean-700">
                        <Check size={12} /> 모든 부분이 채워졌어요
                      </p>
                    ) : phase === 'fill' ? (
                      <div className="flex flex-wrap gap-1.5">
                        {missing.map(m => (
                          <button
                            key={m.key}
                            onClick={() => (m.key === '__title' ? askTitle() : askSection(m.key))}
                            className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11.5px] font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                          >
                            + {m.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11.5px] text-bluewood-300">비어 있는 {missing.length}곳은 대화로 채울 수 있어요</p>
                    )}
                  </div>
                );
              })()}

              {/* ═══ 마케터 전용 산출물 (ma.md 기반) ═══ */}
              {draft.marketerKit && (() => {
                const kit = draft.marketerKit;
                const positioning = displayText(kit.positioning);
                const kpis = Array.isArray(kit.kpis) ? kit.kpis.filter(k => asText(k?.name)) : [];
                const altMetrics = Array.isArray(kit.altMetrics) ? kit.altMetrics.filter(Boolean) : [];
                const bullets = Array.isArray(kit.resumeBullets) ? kit.resumeBullets.filter(Boolean) : [];
                const jdKeywords = Array.isArray(kit.jdKeywords) ? kit.jdKeywords.filter(Boolean) : [];
                const evidence = Array.isArray(kit.evidenceChecklist) ? kit.evidenceChecklist.filter(Boolean) : [];
                return (
                  <div
                    ref={el => { panelRefs.current.marketerKit = el; }}
                    className={`rounded-xl border overflow-hidden transition-colors duration-700 ${
                      flashKey === 'marketerKit' ? 'border-caribbean-300 animate-section-glow' : 'border-primary-100 bg-white'
                    }`}
                  >
                    {/* 포지셔닝 */}
                    {positioning && (
                      <div className="bg-primary-600 px-4 py-3">
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.14em] mb-1">Positioning</p>
                        <p className="text-[12.5px] font-semibold text-white leading-relaxed" style={{ wordBreak: 'keep-all' }}>{positioning}</p>
                      </div>
                    )}
                    <div className="px-4 py-3.5 space-y-4">
                      {/* 캠페인 스토리 퍼널 */}
                      <div>
                        <p className="text-[11px] font-bold text-bluewood-400 uppercase tracking-[0.12em] mb-2">캠페인 스토리</p>
                        <div className="space-y-1.5">
                          {FUNNEL_STEPS.map(step => {
                            const value = displayText(kit.funnel?.[step.key]);
                            const empty = needsConfirm(kit.funnel?.[step.key]);
                            return (
                              <div key={step.key} className="flex items-start gap-2">
                                <span className={`flex-shrink-0 mt-[1px] w-11 text-center px-1 py-0.5 rounded-md text-[10.5px] font-bold ${
                                  empty ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-primary-50 text-primary-600'
                                }`}>{step.label}</span>
                                <p className={`min-w-0 text-[12.5px] leading-relaxed ${empty ? 'text-amber-600/80' : 'text-bluewood-700'}`} style={{ wordBreak: 'keep-all' }}>
                                  {value || '확인 필요 — 채팅에서 채워보세요'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* KPI */}
                      {(kpis.length > 0 || altMetrics.length > 0) && (
                        <div>
                          <p className="text-[11px] font-bold text-bluewood-400 uppercase tracking-[0.12em] mb-1.5">KPI</p>
                          <div className="flex flex-wrap gap-1.5">
                            {kpis.map((k, i) => {
                              const unverified = needsConfirm(k.value) || asText(k.status) === '확인 필요';
                              return (
                                <span key={i} className={`px-2 py-1 rounded-md text-[11px] font-bold border ${
                                  unverified ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-primary-50 text-primary-700 border-primary-100'
                                }`}>
                                  {asText(k.name)}{asText(k.value) ? ` ${asText(k.value)}` : ''}
                                </span>
                              );
                            })}
                          </div>
                          {altMetrics.length > 0 && (
                            <p className="mt-1.5 text-[11.5px] text-bluewood-400 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                              대체 지표 제안: {altMetrics.map(asText).join(' · ')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* 이력서 bullet */}
                      {bullets.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-bluewood-400 uppercase tracking-[0.12em] mb-1.5">이력서 Bullet</p>
                          <div className="space-y-1.5">
                            {bullets.map((b, i) => (
                              <p key={i} className="rounded-lg bg-surface-50 border border-surface-100 px-3 py-2 text-[12px] text-bluewood-700 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                                {displayText(b)}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* JD 키워드 */}
                      {jdKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {jdKeywords.slice(0, 8).map((kw, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-surface-50 border border-surface-200 text-[10.5px] font-semibold text-bluewood-500">#{asText(kw)}</span>
                          ))}
                        </div>
                      )}

                      {/* 증거 자료 체크리스트 */}
                      {evidence.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-bluewood-400 uppercase tracking-[0.12em] mb-1.5">증거 자료</p>
                          <div className="space-y-1">
                            {evidence.slice(0, 6).map((ev, i) => (
                              <p key={i} className="flex items-start gap-1.5 text-[12px] text-bluewood-600 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                                <Check size={12} className="flex-shrink-0 mt-0.5 text-caribbean-600" />
                                {displayText(ev)}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

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
                    ) : (() => {
                      /* 긴 본문은 2줄 요약으로 접어 스캔 피로를 줄인다 */
                      const opened = expandedSecs.has(def.key) || isCurrent || isFlashing;
                      const long = value.length > 90;
                      return (
                        <>
                          <p
                            className={`text-[13px] leading-relaxed whitespace-pre-wrap ${weak ? 'text-bluewood-400' : 'text-bluewood-700'} ${!opened && long ? 'line-clamp-2' : ''}`}
                            style={{ wordBreak: 'keep-all' }}
                          >
                            {value}
                          </p>
                          {long && (
                            <button
                              onClick={() => setExpandedSecs(prev => {
                                const next = new Set(prev);
                                next.has(def.key) ? next.delete(def.key) : next.add(def.key);
                                return next;
                              })}
                              className="mt-0.5 text-[11.5px] font-semibold text-bluewood-300 hover:text-primary-600 transition-colors"
                            >
                              {opened ? '접기' : '더 보기'}
                            </button>
                          )}
                        </>
                      );
                    })()}
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
                            {(() => {
                              /* 전/후 수치가 모두 있으면 미니 비교 막대로 시각화 */
                              const beforeNum = parseMetricNum(ke.beforeMetric);
                              const afterNum = parseMetricNum(ke.afterMetric || ke.metric);
                              if (beforeNum != null && afterNum != null && beforeNum !== afterNum) {
                                const maxV = Math.max(Math.abs(beforeNum), Math.abs(afterNum)) || 1;
                                return (
                                  <div className="mt-1.5 space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-6 flex-shrink-0 text-[9.5px] font-bold text-bluewood-300">이전</span>
                                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-100">
                                        <span className="block h-full rounded-full bg-surface-300" style={{ width: `${Math.abs(beforeNum) / maxV * 100}%`, transition: 'width 0.6s' }} />
                                      </div>
                                      <span className="flex-shrink-0 text-[10px] font-bold text-bluewood-400 tabular-nums">{asText(ke.beforeMetric)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-6 flex-shrink-0 text-[9.5px] font-bold text-primary-600">이후</span>
                                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-100">
                                        <span className="block h-full rounded-full bg-primary-500" style={{ width: `${Math.abs(afterNum) / maxV * 100}%`, transition: 'width 0.6s' }} />
                                      </div>
                                      <span className="flex-shrink-0 text-[10px] font-bold text-primary-700 tabular-nums">{asText(ke.afterMetric || ke.metric)}</span>
                                    </div>
                                  </div>
                                );
                              }
                              const metricText = asText(ke.metric || ke.afterMetric);
                              return metricText ? (
                                <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded bg-primary-50 text-[10.5px] font-bold text-primary-600 animate-pop-in">{metricText}</span>
                              ) : null;
                            })()}
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
    </div>
  );
}
