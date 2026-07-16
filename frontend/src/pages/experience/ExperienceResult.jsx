import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Github, Loader2, Search, Lightbulb, FlaskConical, GitBranch, Scale, Wrench, BarChart3, Target, ChevronUp, ChevronDown, Trash2, Plus, RotateCcw, SlidersHorizontal, Link2 } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart as ReLineChart,
  Line,
} from 'recharts';
import { doc, getDoc, updateDoc } from '../../services/firestoreProxy';
import toast from 'react-hot-toast';
import { db } from '../../config/firebase';
import api from '../../services/api';
import { uploadDocumentFile } from '../../services/uploadImage';
import { mergeCaseStudyIntoStructured } from '../../utils/caseStudySync';
import { CodeSnippet, toLines } from '../../components/portfolio/GitInsights';
import { ArchitectureDiagram, ArchitectureEditorCanvas, buildFallbackDiagram, computeNodeMetrics, autoLayoutPositions, hasXY, PAD } from '../../components/portfolio/ArchDiagram';
import { PriorityMatrix } from '../../components/portfolio/JobSignature';
import VisualDataEditor from '../../components/portfolio/VisualDataEditor';
import { normalizePortfolioVisuals } from '../../utils/devPortfolio';
import useExperienceStore from '../../stores/experienceStore';
import { DEMO_MARKETER_EXPERIENCE } from './demoExperience';
import FeedbackModal, { isFeedbackSnoozed } from '../../components/FeedbackModal';
import YooptaMiniEditor from '../../components/YooptaMiniEditor';
import { blocksToYooptaValue } from '../../utils/projectSections';
import { normalizeExperienceForCurrentJob } from '../../utils/experienceCompatibility';

/* GitHub 커밋 분석 기반 딥다이브를 쓰는 개발 직군 */
const DEV_GIT_JOBS = ['dev', 'aiml', 'devops'];

/* 마크다운/플레이스홀더 정리 */
const isDraft = (v) => {
  const t = String(v || '').trim();
  if (!t) return true;
  if (/\[(작성|검증|확인) 필요\]/.test(t)) return true;
  if (/\(예시\)/.test(t)) return true;
  if (/【[^】]*】/.test(t)) return true;
  if (/(공식에 맞춰|작성하세요|반영하세요|포함하세요|서술하세요|남기세요|적어주세요)/.test(t)) return true;
  return false;
};
const clean = (v) => isDraft(v) ? '' : String(v).replace(/\*\*/g, '').replace(/^#+\s/gm, '').trim();

const ACCENT = '#002F6C';
const ACCENT_LIGHT = '#5f92c7'; // primary-400 — 전/후 비교의 '이전' 명암 (한 색상 두 단계, 흰 배경 대비 3:1 충족)

/* 역량 유형별 형광펜 하이라이트 색 (핵심=파랑 / 파생=주황 / 성장=초록 / 기술=회색) */
const HL_TONES = {
  core: 'rgba(37,99,235,0.34)',
  derived: 'rgba(217,119,6,0.36)',
  growth: 'rgba(5,150,105,0.34)',
  tech: 'rgba(100,116,139,0.24)',
};
const hlStyle = (tone) => ({
  background: `linear-gradient(180deg, transparent 38%, ${HL_TONES[tone] || HL_TONES.tech} 38%)`,
  padding: '0 4px 1px',
  borderRadius: '2px',
  boxDecorationBreak: 'clone',
  WebkitBoxDecorationBreak: 'clone',
});

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 본문 안에서 중요한 부분을 자동 강조 — 수치(굵게+밑줄), 키워드(형광펜)
const METRIC_RE_SRC = '\\d[\\d,.]*\\s*(?:%p?|배|명|건|회|차|원|만원|억원|억|점|위|개|시간|분|초|일|주|개월|년|ms|명당|배수)';
function EmphasizedText({ text, keywords = [], tone = 'core', className = '' }) {
  const str = String(text || '');
  if (!str) return null;
  const kws = [...new Set(keywords.map(k => String(k || '').trim()).filter(k => k.length >= 2))]
    .sort((a, b) => b.length - a.length);
  const kwSrc = kws.length ? `|${kws.map(escapeRe).join('|')}` : '';
  let re;
  try { re = new RegExp(`(${METRIC_RE_SRC}${kwSrc})`, 'g'); } catch { re = new RegExp(`(${METRIC_RE_SRC})`, 'g'); }
  const metricTest = new RegExp(`^(?:${METRIC_RE_SRC})$`);
  const kwSet = new Set(kws);
  const parts = str.split(re);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (!p) return null;
        if (metricTest.test(p)) {
          return <strong key={i} className="font-black text-bluewood-900" style={hlStyle('core')}>{p}</strong>;
        }
        if (kwSet.has(p)) return <span key={i} className="font-bold text-bluewood-900" style={hlStyle(tone)}>{p}</span>;
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

/* 성과 문자열에서 숫자 추출 (지표 시각화용) */
const parseMetricNum = (v) => {
  const m = String(v || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
/* "저장률 35% 증가" → { value: '35', unit: '%' } — KPI 타일의 큰 숫자용 */
const splitMetricValue = (v) => {
  const m = String(v || '').trim().replace(/,/g, '')
    .match(/(-?\d+(?:\.\d+)?)\s*(%|배|건|명|원|만원|억|회|점|위|개|명|ms|초|분|시간|일|주|개월|년)?/);
  if (!m) return null;
  return { value: m[1], unit: m[2] || '' };
};
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const SEG_VARIANTS = {
  heading: { label: '제목', cls: 'text-[16px] sm:text-[18px] font-extrabold leading-snug text-bluewood-900' },
  paragraph: { label: '본문', cls: 'text-[14px] leading-[1.7] text-bluewood-600' },
};

// 이미지 → 압축 Base64 (Canvas 리사이즈)
const resizeToBase64 = (file, maxPx = 1200, quality = 0.75) =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });

const textSeg = (content = '', variant = 'paragraph') => ({ id: uid(), type: 'text', variant, content });

function makeYooptaTextBlock(content = '', variant = 'paragraph') {
  const map = {
    heading: ['HeadingOne', 'heading-one'],
    subheading: ['HeadingTwo', 'heading-two'],
    quote: ['Blockquote', 'blockquote'],
    bullet: ['BulletedList', 'bulleted-list'],
    paragraph: ['Paragraph', 'paragraph'],
  };
  const [blockType, elementType] = map[variant] || map.paragraph;
  return {
    id: `overview-${uid()}`,
    type: blockType,
    value: [{ id: `overview-el-${uid()}`, type: elementType, children: [{ text: content || '' }] }],
    meta: { depth: 0 },
  };
}

function makeYooptaImageBlock(src, width = '100%') {
  return {
    id: `overview-img-${uid()}`,
    type: 'Image',
    value: [{
      id: `overview-img-el-${uid()}`,
      type: 'image',
      children: [{ text: '' }],
      props: { src, alt: 'image', sizes: { width: width === '100%' ? 720 : 520, height: 420 }, fit: 'contain', nodeType: 'void' },
    }],
    meta: { depth: 0, align: 'center' },
  };
}

function isYooptaDoc(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).some(block => block?.type && block?.value));
}

function caseBodyToYooptaValue(segments = []) {
  const blocks = (Array.isArray(segments) ? segments : [])
    .map(seg => {
      if (seg?.type === 'image' && seg.content) return makeYooptaImageBlock(seg.content, seg.width);
      if (seg?.type === 'text') return makeYooptaTextBlock(seg.content || '', seg.variant);
      return null;
    })
    .filter(Boolean);
  return blocksToYooptaValue(blocks);
}

/* 키워드 기반 역량 추출 — 본문 하이라이트/핵심경험 키워드를 유형별로 정리 */
const COMP_GROUPS = [
  { key: 'core', label: '핵심 역량', desc: '이 경험에서 발휘한 역량', color: '#002F6C' },
  { key: 'derived', label: '파생 역량', desc: '핵심에서 확장된 역량', color: '#b45309' },
  { key: 'growth', label: '성장 역량', desc: '이 경험으로 새로 얻은 역량', color: '#047857' },
];
function deriveCompetencies(sr, fallbackSkills = []) {
  const groups = { core: [], derived: [], growth: [] };
  const seen = new Set();
  const add = (type, kw) => {
    const k = String(kw || '').trim();
    if (!k) return;
    const lk = k.toLowerCase();
    if (seen.has(lk)) return;
    seen.add(lk);
    groups[['core', 'derived', 'growth'].includes(type) ? type : 'core'].push(k);
  };
  (sr?.highlights || []).forEach(h => (h.keywords || []).forEach(kw => add(h.type, kw)));
  (sr?.keyExperiences || []).forEach(ke => (ke.keywords || []).forEach(kw => add('core', kw)));
  if (groups.core.length + groups.derived.length + groups.growth.length === 0) {
    fallbackSkills.forEach(kw => add('core', kw));
  }
  return groups;
}

/* 개발 언어·프레임워크·DB·인프라처럼 구현에 직접 쓰인 기술명만 허용한다. */
const CODING_TECH_RE = /(?:^|[\s.(])(?:c\+\+|c#|\.net|java|kotlin|scala|groovy|python|django|flask|fastapi|ruby|rails|php|laravel|go(?:lang)?|rust|swift|objective-c|dart|flutter|javascript|typescript|node(?:\.js)?|deno|bun|react|next(?:\.js)?|vue|nuxt|angular|svelte|solid(?:js)?|remix|astro|vite|webpack|rollup|babel|tailwind(?:css)?|sass|scss|less|html5?|css3?|jquery|redux|zustand|recoil|mobx|express|nestjs|spring(?:\s*boot)?|hibernate|jpa|mybatis|gradle|maven|graphql|rest(?:ful)?|grpc|websocket|socket\.io|mysql|mariadb|postgres(?:ql)?|sqlite|oracle|mongodb|redis|elasticsearch|opensearch|dynamodb|firestore|firebase|supabase|prisma|sequelize|typeorm|docker|kubernetes|k8s|helm|terraform|ansible|jenkins|github actions|gitlab ci|circleci|travis ci|aws|amazon web services|ec2|s3|lambda|cloudfront|rds|ecs|eks|gcp|google cloud|azure|vercel|netlify|render|cloudflare|nginx|apache|linux|git|github|gitlab|bitbucket|jest|vitest|mocha|cypress|playwright|selenium|storybook|junit|pytest|pytorch|tensorflow|keras|scikit-learn|pandas|numpy|opencv|hugging face|langchain|llamaindex|openai api|gemini api|jupyter|unity|unreal engine|electron|react native|android|ios|xcode|android studio)(?:$|[\s)./\d-])/i;
const NON_CODING_TECH_RE = /가설|검증|kpi|지표|설계|기획|전략|분석|리서치|협업|커뮤니케이션|문제\s*해결|성과|인사이트|figma|notion|slack|jira|confluence|trello|ga4|google analytics|amplitude|mixpanel/i;
const RAW_CODE_TECH_PATTERNS = [
  ['TensorFlow Lite', /\b(?:tensorflow\s*lite|tflite)\b/i], ['TensorFlow', /\btensorflow\b/i],
  ['PyTorch', /\bpytorch\b/i], ['OpenCV', /\bopencv\b/i], ['ONNX', /\bonnx\b/i],
  ['Python', /\bpython\b/i], ['Kotlin', /\bkotlin\b/i], ['Java', /\bjava\b/i],
  ['C++', /c\+\+/i], ['C#', /c#/i], ['Swift', /\bswift\b/i], ['Dart', /\bdart\b/i],
  ['TypeScript', /\btypescript\b/i], ['JavaScript', /\bjavascript\b/i],
  ['React Native', /\breact\s*native\b/i], ['React', /\breact\b/i], ['Next.js', /\bnext\.?js\b/i],
  ['Node.js', /\bnode\.?js\b/i], ['Spring Boot', /\bspring\s*boot\b/i], ['FastAPI', /\bfastapi\b/i],
  ['Django', /\bdjango\b/i], ['Flask', /\bflask\b/i], ['Flutter', /\bflutter\b/i],
  ['Android', /\bandroid\b/i], ['iOS', /\bios\b/i], ['Firebase', /\bfirebase\b/i],
  ['Firestore', /\bfirestore\b/i], ['MySQL', /\bmysql\b/i], ['PostgreSQL', /\bpostgres(?:ql)?\b/i],
  ['MongoDB', /\bmongodb\b/i], ['Redis', /\bredis\b/i], ['Docker', /\bdocker\b/i],
  ['Kubernetes', /\bkubernetes\b|\bk8s\b/i], ['AWS', /\baws\b|amazon web services/i],
];

function isCodingTechName(value) {
  const tech = String(value || '').trim();
  // 예전 분석 결과의 "[작성 필요] (예: Python...)"는 기술명이 포함되어 있어도
  // 실제 사용 기술이 아니므로 기술 스택에 노출하지 않는다.
  if (!tech || isDraft(tech) || NON_CODING_TECH_RE.test(tech)) return false;
  // 기술 설명 문장 전체가 하나의 태그가 되는 것도 방지한다.
  if (tech.length > 60 || /[가-힣]/.test(tech)) return false;
  return CODING_TECH_RE.test(tech);
}

/* 개발 프로젝트에서 실제 사용한 기술 스택을 프로젝트 개요·GitHub 분석 결과에서 통합 */
function deriveDevTechStack(exp, fallbackTech = []) {
  const sr = exp?.structuredResult || {};
  const overviewTech = Array.isArray(sr.projectOverview?.techStack) ? sr.projectOverview.techStack : [];
  const gitExperiences = Array.isArray(sr.gitAnalysis?.experiences) ? sr.gitAnalysis.experiences : [];
  const languages = Array.isArray(sr.githubStats?.languages) ? sr.githubStats.languages : [];
  const fallbackTechList = Array.isArray(fallbackTech) ? fallbackTech : String(fallbackTech || '').split(/[,|\n]/);
  const jobSpecificTech = Array.isArray(sr.jobSpecific?.techStack)
    ? sr.jobSpecific.techStack
    : String(sr.jobSpecific?.techStack || '').split(/[,|\n]/);
  const candidates = [
    ...overviewTech.map(t => ({ name: typeof t === 'string' ? t : t?.name || '', verifiedLanguage: false })),
    ...jobSpecificTech.map(t => ({ name: typeof t === 'string' ? t : t?.name || '', verifiedLanguage: false })),
    ...fallbackTechList.map(t => ({ name: t, verifiedLanguage: false })),
    ...gitExperiences.flatMap(item => String(item?.core_tech_stack || '').split(/[,|]/).map(name => ({ name, verifiedLanguage: false }))),
    ...languages.map(language => ({ name: typeof language === 'string' ? language : language?.name || '', verifiedLanguage: true })),
  ];
  const seen = new Set();
  const explicitTech = candidates
    .map(({ name, verifiedLanguage }) => ({ tech: String(name || '').trim(), verifiedLanguage }))
    .filter(({ tech, verifiedLanguage }) => {
      const key = tech.toLowerCase();
      if (!key || seen.has(key) || (!verifiedLanguage && !isCodingTechName(tech))) return false;
      seen.add(key);
      return true;
    })
    .map(({ tech }) => tech);
  if (explicitTech.length) return explicitTech;

  // 과거 완료본의 기술 스택 칸이 예시값뿐이면 원본에서 코드 기술명만 제한적으로 복구한다.
  const raw = getRawMaterialText(exp)
    .split(/(?:^|\n)===\s*AI\s*추출\s*핵심\s*경험\s*===/)[0];
  if (!raw) return [];
  const detected = RAW_CODE_TECH_PATTERNS.filter(([, pattern]) => pattern.test(raw)).map(([name]) => name);
  return detected.filter(name => name !== 'TensorFlow' || !detected.includes('TensorFlow Lite'));
}

/* structuredResult → 편집 가능한 케이스 스터디 초안 도출 */
function deriveCaseStudy(exp) {
  const sr = exp?.structuredResult || {};
  const ov = sr.projectOverview || {};
  const rawKeyExps = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
  const tech = (ov.techStack && ov.techStack.length ? ov.techStack : [])
    .map(t => (typeof t === 'string' ? t : t?.name || '')).filter(Boolean);

  const keyExps = rawKeyExps
    .map(k => ({
      id: uid(),
      title: clean(k.title),
      metric: clean(k.afterMetric) || clean(k.metric),
      beforeMetric: clean(k.beforeMetric),
      problem: clean(k.context || k.situation),
      action: clean(k.action),
      result: clean(k.result),
      learning: clean(k.learning),
      images: [],
    }))
    .filter(k => k.title || k.problem || k.action || k.result || k.learning || k.metric);

  const body = [];
  const background = clean(ov.background) || clean(ov.goal);
  const summary = clean(ov.summary) || clean(sr.intro);
  if (background && background !== summary) {
    body.push(textSeg('배경', 'heading'));
    body.push(textSeg(background, 'paragraph'));
  }

  const skills = [...new Set([
    ...rawKeyExps.flatMap(k => (k.keywords || []).map(clean)),
    ...(exp?.keywords || sr.keywords || []).map(clean),
  ].filter(Boolean))];

  return {
    title: clean(exp?.title) || summary || '경험 정리',
    summary,
    meta: { role: clean(ov.role), duration: clean(ov.duration), team: clean(ov.team) },
    tech,
    keyExps,
    body,
    skills,
  };
}

/* 저장된 caseStudy를 안전하게 정규화 */
function normalizeImages(arr) {
  return (Array.isArray(arr) ? arr : []).map(i => ({ id: i.id || uid(), url: i.url, width: i.width || '100%' })).filter(i => i.url);
}
function normalizeCaseStudy(cs) {
  const body = (Array.isArray(cs.body) ? cs.body : [])
    .map(s => s?.type === 'image'
      ? { id: s.id || uid(), type: 'image', content: s.content, width: s.width || '100%' }
      : { id: s?.id || uid(), type: 'text', variant: SEG_VARIANTS[s?.variant] ? s.variant : 'paragraph', content: s?.content || '' })
    .filter(s => s.type !== 'image' || s.content);
  return {
    title: cs.title || '',
    summary: cs.summary || '',
    meta: { role: cs.meta?.role || '', duration: cs.meta?.duration || '', team: cs.meta?.team || '' },
    tech: Array.isArray(cs.tech) ? cs.tech : [],
    keyExps: (Array.isArray(cs.keyExps) ? cs.keyExps : []).map(k => ({
      id: k.id || uid(), title: k.title || '', metric: k.metric || '', beforeMetric: k.beforeMetric || '',
      problem: k.problem || '', action: k.action || '', result: k.result || '', learning: k.learning || '',
      images: normalizeImages(k.images),
    })),
    body,
    skills: Array.isArray(cs.skills) ? cs.skills : [],
  };
}

/* ── 자동 높이 조절 + 자동 줄바꿈 인라인 텍스트 (글자 잘림 방지) ── */
function AutoText({ value, onChange, placeholder, className = '', dark = false, prose = false, dense = false, autoFocus = false, onBlur }) {
  const ref = useRef(null);
  const resize = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; } };
  // 값이 바뀔 때마다 페인트 전에 높이를 글자량에 맞춘다.
  useLayoutEffect(() => { resize(ref.current); }, [value]);
  // 너비가 바뀔 때(아코디언 펼침·반응형 등) 다시 측정 — 좁은 상태에서 잘못 측정돼 박스가 커지는 문제 방지.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // 그리드 폭 확정 전에 좁은 폭으로 측정돼 부풀어 있을 수 있으므로, 레이아웃이 안정된 뒤 한 번 더 측정
    resize(el);
    const raf = requestAnimationFrame(() => resize(el));
    if (typeof document !== 'undefined' && document.fonts?.ready) document.fonts.ready.then(() => resize(el));
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(raf);
    let lastW = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth !== lastW) { lastW = el.offsetWidth; resize(el); }
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  const tone = dark
    ? 'border border-white/10 bg-white/[0.06] placeholder:text-white/45 hover:bg-white/[0.1] focus:bg-white/[0.14] focus:border-white/30'
    : prose
      // 큰 본문·제목: 점선 밑줄 + hover (문서 느낌 유지)
      ? 'border border-transparent border-dashed border-b-bluewood-200 placeholder:text-bluewood-300 hover:bg-surface-50 focus:bg-surface-50/70 focus:border-b-primary-400'
      : dense
        // 촘촘한 본문 필드: 평문처럼 보이다가 hover/포커스에만 강조 (회색 박스 없음)
        ? 'border border-transparent bg-transparent placeholder:text-bluewood-300 hover:bg-surface-100/60 focus:bg-surface-50 focus:border-surface-200'
        // 짧은 입력 필드: 은은한 회색 필드
        : 'border border-transparent bg-surface-50/70 placeholder:text-bluewood-300 hover:bg-surface-100 hover:border-surface-200 focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100';
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={autoFocus}
      onBlur={onBlur}
      onChange={(e) => { onChange(e.target.value); resize(e.target); }}
      className={`w-full resize-none whitespace-pre-wrap break-words rounded-md -ml-2 px-2 ${dense ? 'py-0.5' : 'py-1'} outline-none transition-colors duration-150 cursor-text ${tone} ${className}`}
      style={{ overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word', boxSizing: 'border-box' }}
    />
  );
}

function DraftEnhanceGuideModal({ open, onClose, onEnhance }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-bluewood-950/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-primary-100 bg-white p-5 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-500">Draft Ready</p>
        <h2 className="mt-2 text-xl font-extrabold text-bluewood-900">빠른 초안이 만들어졌어요</h2>
        <p className="mt-3 text-sm leading-6 text-bluewood-500">
          지금 화면은 답변을 바탕으로 만든 1차 초안입니다. 스토리, 핵심 경험, 역량 분석, 시장 지표를 더 탄탄하게 만들려면
          자세히 보기에서 <span className="font-bold text-primary-600">AI로 보강하기</span> 버튼을 눌러주세요.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-surface-200 px-4 py-2.5 text-sm font-bold text-bluewood-500 transition-colors hover:bg-surface-50"
          >
            초안 먼저 볼게요
          </button>
          <button
            type="button"
            onClick={onEnhance}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700"
          >
            AI로 보강하기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 자유롭게 크기 조절되는 이미지 (모서리/측면 드래그) ── */
function ResizableFigure({ src, width, onWidth, onReplace, onDelete }) {
  const ref = useRef(null);
  const start = (pos) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const box = ref.current;
    const container = box?.parentElement;
    if (!box || !container) return;
    const startX = e.clientX;
    const startW = box.offsetWidth;
    const maxW = container.offsetWidth;
    const dir = pos.includes('r') ? 1 : -1;
    const onMove = (ev) => {
      const w = Math.max(80, Math.min(maxW, startW + dir * (ev.clientX - startX)));
      box.style.width = `${w}px`;
    };
    const onUp = () => {
      const pct = Math.round((box.offsetWidth / maxW) * 100);
      onWidth(`${pct}%`);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const corner = 'absolute h-4 w-4 z-10 opacity-0 group-hover/img:opacity-100 transition-opacity';
  const side = 'absolute top-1/2 z-10 h-8 w-2.5 -translate-y-1/2 opacity-0 transition-opacity group-hover/img:opacity-100';
  return (
    <div ref={ref} className="group/img relative inline-block max-w-full align-top" style={{ width: width || '100%' }}>
      <img src={src} alt="" draggable="false" className="block w-full select-none rounded-lg border border-surface-200" onDragStart={(e) => e.preventDefault()} />
      <div className="absolute left-2 right-2 top-2 flex items-center justify-between opacity-0 transition-opacity group-hover/img:opacity-100">
        {onReplace ? (
          <label className="cursor-pointer rounded bg-black/60 px-2 py-0.5 text-[12px] font-semibold text-white hover:bg-black/80">
            교체<input type="file" accept="image/*" className="hidden" onChange={onReplace} />
          </label>
        ) : <span />}
        <button type="button" onClick={onDelete} className="rounded bg-black/60 px-2 py-0.5 text-[12px] font-semibold text-white hover:bg-red-500/80">삭제</button>
      </div>
      <div onMouseDown={start('tl')} className={`${corner} left-0 top-0 cursor-nwse-resize`} style={{ background: 'radial-gradient(circle at 0% 0%, rgba(0,47,108,0.85) 40%, transparent 70%)' }} />
      <div onMouseDown={start('tr')} className={`${corner} right-0 top-0 cursor-nesw-resize`} style={{ background: 'radial-gradient(circle at 100% 0%, rgba(0,47,108,0.85) 40%, transparent 70%)' }} />
      <div onMouseDown={start('bl')} className={`${corner} bottom-0 left-0 cursor-nesw-resize`} style={{ background: 'radial-gradient(circle at 0% 100%, rgba(0,47,108,0.85) 40%, transparent 70%)' }} />
      <div onMouseDown={start('br')} className={`${corner} bottom-0 right-0 cursor-nwse-resize`} style={{ background: 'radial-gradient(circle at 100% 100%, rgba(0,47,108,0.85) 40%, transparent 70%)' }} />
      <div onMouseDown={start('ml')} className={`${side} left-0 cursor-ew-resize rounded-l`} style={{ background: 'rgba(0,47,108,0.45)' }} />
      <div onMouseDown={start('mr')} className={`${side} right-0 cursor-ew-resize rounded-r`} style={{ background: 'rgba(0,47,108,0.45)' }} />
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-white opacity-0 transition-opacity group-hover/img:opacity-100">{width || '100%'}</div>
    </div>
  );
}

/* ── 노션식 자유 편집 본문: 어디에든 텍스트·사진을 넣고, 드래그로 옮기고, 자유롭게 크기 조절 ── */
function CaseBody({ body, onChange }) {
  const fileRef = useRef(null);
  const pendingAfter = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const update = (i, changes) => onChange(body.map((s, si) => si === i ? { ...s, ...changes } : s));
  const removeAt = (i) => onChange(body.filter((_, si) => si !== i));
  const move = (from, to) => { if (from === to) return; const n = [...body]; const [m] = n.splice(from, 1); n.splice(to, 0, m); onChange(n); };
  const insertAfter = (i, seg) => { const n = [...body]; n.splice(i + 1, 0, seg); onChange(n); };
  const addImage = (i) => { pendingAfter.current = i; fileRef.current?.click(); };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('사진 크기 초과 (10MB)'); return; }
    try {
      const content = await resizeToBase64(file);
      const i = pendingAfter.current ?? body.length - 1;
      insertAfter(i, { id: uid(), type: 'image', content, width: '100%' });
    } catch { toast.error('사진 처리에 실패했어요.'); }
    pendingAfter.current = null;
  };

  return (
    <div className="mt-2 space-y-1">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {body.map((seg, i) => (
        <div
          key={seg.id}
          draggable="true"
          onDragStart={(e) => {
            const sel = window.getSelection();
            if (sel && sel.toString().length > 0) { e.preventDefault(); return; }
            e.dataTransfer.setData('cs-idx', String(i));
            e.dataTransfer.effectAllowed = 'move';
            e.currentTarget.style.opacity = '0.4';
          }}
          onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
          onDrop={(e) => {
            e.preventDefault();
            const from = parseInt(e.dataTransfer.getData('cs-idx'), 10);
            if (!isNaN(from) && from !== i) move(from, i);
            setDragOver(null);
          }}
          className={`group/row relative flex items-start gap-2 py-1 transition-all ${dragOver === i ? 'bg-primary-50/40' : ''}`}
        >
          <div className="mt-2 flex-shrink-0 cursor-grab select-none px-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 active:cursor-grabbing" title="드래그해서 이동">
            <div className="grid grid-cols-2 gap-x-0.5 gap-y-[3px]">
              {Array.from({ length: 6 }).map((_, d) => <span key={d} className="h-[3px] w-[3px] rounded-full bg-bluewood-200" />)}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {seg.type === 'text' ? (
              <div className="relative">
                <AutoText
                  prose
                  value={seg.content}
                  onChange={(v) => update(i, { content: v })}
                  placeholder={seg.variant === 'heading' ? '제목' : '본문을 입력하세요'}
                  className={SEG_VARIANTS[seg.variant]?.cls || SEG_VARIANTS.paragraph.cls}
                />
                <div className="mt-0.5 flex items-center gap-2 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                  <button type="button" onClick={() => update(i, { variant: seg.variant === 'heading' ? 'paragraph' : 'heading' })}
                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-bluewood-400 hover:bg-surface-100">
                    {seg.variant === 'heading' ? '본문으로' : '제목으로'}
                  </button>
                  {body.length > 1 && (
                    <button type="button" onClick={() => removeAt(i)} className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-bluewood-300 hover:bg-red-50 hover:text-red-500">삭제</button>
                  )}
                </div>
              </div>
            ) : (
              <ResizableFigure
                src={seg.content}
                width={seg.width}
                onWidth={(w) => update(i, { width: w })}
                onReplace={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { update(i, { content: await resizeToBase64(f) }); } catch { toast.error('사진 처리에 실패했어요.'); } }}
                onDelete={() => removeAt(i)}
              />
            )}

            <div className="mt-1 flex items-center gap-1.5 opacity-0 transition-opacity group-hover/row:opacity-100">
              <button type="button" onClick={() => insertAfter(i, textSeg('', 'paragraph'))} className="rounded-md border border-surface-200 px-2 py-0.5 text-[11px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600">＋ 텍스트</button>
              <button type="button" onClick={() => addImage(i)} className="rounded-md border border-surface-200 px-2 py-0.5 text-[11px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600">＋ 사진</button>
            </div>
          </div>
        </div>
      ))}

      <div className="mt-3 flex items-center gap-2 pt-1 print:hidden">
        <button type="button" onClick={() => insertAfter(body.length - 1, textSeg('', 'paragraph'))} className="rounded-lg border border-surface-200 px-3 py-1.5 text-[12.5px] font-semibold text-bluewood-500 hover:border-primary-300 hover:text-primary-600">＋ 텍스트 추가</button>
        <button type="button" onClick={() => addImage(body.length - 1)} className="rounded-lg border border-surface-200 px-3 py-1.5 text-[12.5px] font-semibold text-bluewood-500 hover:border-primary-300 hover:text-primary-600">＋ 사진 추가</button>
      </div>
    </div>
  );
}

/* ── GitHub 연결 — 레포 URL + 내 아이디로 커밋 기여도·코드·트러블슈팅 분석 ── */
function GitConnectPanel({ expId, sr, onApplied, onCancel, compact = false }) {
  const [repoUrl, setRepoUrl] = useState(sr?.githubStats?.repoName ? `https://github.com/${sr.githubStats.repoName}` : '');
  const [ghUser, setGhUser] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const runAnalyze = async () => {
    if (!repoUrl.trim() || !ghUser.trim()) {
      toast.error('레포 URL과 GitHub 아이디를 모두 입력해주세요');
      return;
    }
    setAnalyzing(true);
    try {
      const res = await api.post('/experience/analyze-git', {
        repoUrl: repoUrl.trim(),
        authorParam: ghUser.trim(),
      });
      const d = res.data;
      const nextSr = {
        ...(sr || {}),
        ...(d?.contributionStats ? { githubStats: { ...d.contributionStats, repoName: d.repoName } } : {}),
        ...(d?.experiences?.length ? { gitAnalysis: { repoName: d.repoName, experiences: d.experiences } } : {}),
      };
      if (expId) {
        await updateDoc(doc(db, 'experiences', expId), { structuredResult: nextSr, updatedAt: new Date() });
      }
      onApplied(nextSr);
      toast.success('GitHub 분석을 반영했어요.');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'GitHub 분석에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
    setAnalyzing(false);
  };

  return (
    <div className={`rounded-2xl border border-dashed border-surface-300 bg-surface-50/50 ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      {!compact && (
        <>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: ACCENT }}><Github size={17} /></span>
            <div>
              <h3 className="text-[15px] font-extrabold text-bluewood-900">GitHub으로 내 개발 경험 분석하기</h3>
              <p className="text-[12px] text-bluewood-400">레포와 아이디만 입력하면 커밋을 읽고 아래 내용을 채워드려요</p>
            </div>
          </div>
          <ul className="mt-3.5 mb-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-bluewood-500">
            <li>· 기여도 · 영향력 (커밋 비중·순위)</li>
            <li>· 아키텍처 구조 시각화</li>
            <li>· 트러블슈팅 과정</li>
            <li>· 실제 코드 기반 문제 해결 설명</li>
          </ul>
        </>
      )}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary-200">
          <Github size={14} className="flex-shrink-0 text-bluewood-300" />
          <input
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            placeholder="https://github.com/username/repo"
            className="flex-1 text-[13px] text-bluewood-800 outline-none placeholder:text-bluewood-300 bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary-200">
          <span className="flex-shrink-0 text-[13px] font-bold text-bluewood-300">@</span>
          <input
            value={ghUser}
            onChange={e => setGhUser(e.target.value)}
            placeholder="내 GitHub 아이디 — 이 레포에서 내 커밋을 찾아요"
            className="flex-1 text-[13px] text-bluewood-800 outline-none placeholder:text-bluewood-300 bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runAnalyze}
            disabled={analyzing}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-[13.5px] font-bold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />}
            {analyzing ? '커밋 분석 중… (최대 1분)' : '내 기여 분석하기'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-bluewood-400 hover:bg-surface-100 transition-colors">닫기</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* 문서 톤 마이크로 라벨 — '내용' 헤더와 동일한 위계 */
const MICRO_LABEL = 'text-[11.5px] font-black uppercase tracking-[0.16em] text-bluewood-400';

/* ── 커밋 잔디 — GitHub 컨트리뷰션 그래프 (열=주, 행=요일, 진하기=그날 커밋 수) ── */
const GRASS_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
const GRASS_CELL = 10, GRASS_GAP = 3;

function CommitGrass({ days }) {
  const map = new Map(days.map(x => [x.d, x.count]));
  const total = days.reduce((s, x) => s + (x.count || 0), 0);
  const max = Math.max(1, ...days.map(x => x.count || 0));
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  const sorted = [...days].sort((a, b) => (a.d < b.d ? -1 : 1));
  const firstDt = parse(sorted[0].d);
  const lastDt = parse(sorted[sorted.length - 1].d);
  // 첫 커밋 주의 일요일로 스냅해 주 단위 열 구성 — 최근 30주만 표시
  const weeks = [];
  const cursor = new Date(firstDt);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  while (cursor <= lastDt) {
    weeks.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  const shown = weeks.slice(-30);

  // 0 = 빈 칸, 1~4 = 최댓값 대비 사분위 (GitHub 방식)
  const level = (c) => (c <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((c / max) * 4))));

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div style={{ width: 26 + shown.length * (GRASS_CELL + GRASS_GAP) }}>
          {/* 월 라벨 — 월이 바뀌는 열에만 */}
          <div className="flex" style={{ paddingLeft: 26, gap: GRASS_GAP }}>
            {shown.map((ws, i) => {
              const m = ws.getMonth();
              const label = (i === 0 || shown[i - 1].getMonth() !== m) ? `${m + 1}월` : '';
              return (
                <span key={i} className="whitespace-nowrap text-[9.5px] leading-none text-bluewood-300" style={{ width: GRASS_CELL, overflow: 'visible' }}>{label}</span>
              );
            })}
          </div>
          <div className="mt-1.5 flex" style={{ gap: GRASS_GAP }}>
            {/* 요일 라벨 (월·수·금) */}
            <div className="flex flex-shrink-0 flex-col" style={{ gap: GRASS_GAP, width: 26 - GRASS_GAP }}>
              {['', '월', '', '수', '', '금', ''].map((lb, i) => (
                <span key={i} className="pr-1 text-right text-[9px] text-bluewood-300" style={{ height: GRASS_CELL, lineHeight: `${GRASS_CELL}px` }}>{lb}</span>
              ))}
            </div>
            {/* 주 열 × 요일 행 */}
            {shown.map((ws, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: GRASS_GAP }}>
                {Array.from({ length: 7 }, (_, dow) => {
                  const dt = new Date(ws);
                  dt.setDate(dt.getDate() + dow);
                  if (dt > lastDt) return <span key={dow} style={{ width: GRASS_CELL, height: GRASS_CELL }} />;
                  const key = fmt(dt);
                  const c = map.get(key) || 0;
                  return (
                    <span
                      key={dow}
                      title={`${key} · 커밋 ${c}개`}
                      className="rounded-[2px] transition-transform hover:scale-125"
                      style={{ width: GRASS_CELL, height: GRASS_CELL, backgroundColor: GRASS_COLORS[level(c)] }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* 근거 + 범례 */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10.5px] text-bluewood-300">분석된 최근 커밋 {total}개 기준</span>
        <span className="flex items-center gap-1 text-[10px] text-bluewood-300">
          적음
          {GRASS_COLORS.map((c, i) => (
            <span key={i} className="rounded-[2px]" style={{ width: GRASS_CELL, height: GRASS_CELL, backgroundColor: c }} />
          ))}
          많음
        </span>
      </div>
    </div>
  );
}

/* 내 역할 추론 — 코드 스니펫의 파일 경로 + 언어 구성으로 프론트/백엔드/풀스택 판별 */
function inferDevRole(stats, gitExps) {
  const paths = [];
  (gitExps || []).forEach(e => {
    (e.code_snippets || []).forEach(s => s?.file && paths.push(String(s.file)));
    (e.troubleshooting_snippets || []).forEach(s => s?.file && paths.push(String(s.file)));
  });
  let fe = 0, be = 0;
  paths.forEach(p => {
    const s = p.toLowerCase();
    const beDir = /(^|\/)(routes?|controllers?|services?|models?|api|server|middleware|migrations?|repository|handlers?|backend|db)\//.test(s);
    const feDir = /(^|\/)(components?|pages?|views?|styles?|hooks|layouts?|frontend|client)\//.test(s);
    const beExt = /\.(py|go|java|rb|php|rs|cs|kt|sql)$/.test(s);
    const feExt = /\.(jsx|tsx|vue|svelte|css|scss|less|html)$/.test(s);
    if (beDir || beExt) be++;
    else if (feDir || feExt) fe++;   // 경로 없는 순수 .js/.ts는 모호 → 건너뜀
  });
  // 파일 근거가 약하면 언어 구성으로 보강 (JS/TS는 모호해서 제외)
  const langs = Array.isArray(stats?.languages) ? stats.languages : [];
  const langPct = (re) => langs.filter(l => re.test(l.name)).reduce((a, l) => a + (l.pct || 0), 0);
  const feScore = fe * 2 + langPct(/^(html|css|scss|less|vue|svelte)$/i) / 12;
  const beScore = be * 2 + langPct(/^(python|java|go|ruby|php|rust|c#|c\+\+|kotlin|scala|elixir|sql|shell|dockerfile)$/i) / 12;
  if (feScore < 0.5 && beScore < 0.5) return null;
  const lo = Math.min(feScore, beScore), hi = Math.max(feScore, beScore);
  if (lo > 0 && lo / hi >= 0.35) return '풀스택';
  return feScore >= beScore ? '프론트엔드' : '백엔드';
}

/* ── 기여도 · 영향력 — 문서 톤 스탯 블록 (기여 바 · 언어 바 · 월별 활동 · 커밋 유형 · 핵심 역할) ── */
function GitHeroCard({ stats, role, rolePoints = [], onChange }) {
  const pct = Number(stats.contributionPct) || 0;
  const langs = Array.isArray(stats.languages) ? stats.languages : [];
  const types = Array.isArray(stats.commitTypes) ? stats.commitTypes.slice(0, 5) : [];
  const grassDays = Array.isArray(stats.dailyActivity) ? stats.dailyActivity : [];
  const maxType = Math.max(1, ...types.map(t => t.count || 0));
  // 언어 식별 색 — 고정 순서 배정 (검증 통과 팔레트, 범례에 이름·% 라벨 병기)
  const LANG_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0d9488'];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className={MICRO_LABEL}>기여도 · 영향력</h3>
        {stats.activePeriod && (
          <span className="text-[11px] tabular-nums text-bluewood-300">{stats.activePeriod.first} ~ {stats.activePeriod.last}</span>
        )}
      </div>

      {/* 메인 수치 — 기여 비중을 크게. 통계 일부가 비면(레이트리밋 등) 내 커밋 수를 메인으로 폴백 */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <p className="text-[34px] font-black leading-none tracking-tight" style={{ color: ACCENT }}>{pct ? `${pct}%` : (stats.myCommits || '—')}</p>
          <p className="mt-1.5 text-[11.5px] font-semibold text-bluewood-400">{pct ? '커밋 기여 비중' : '내 커밋'}</p>
        </div>
        {pct > 0 && (
          <div>
            <p className="text-[20px] font-extrabold leading-none text-bluewood-900">{stats.myCommits ?? '—'}<span className="text-[13px] font-semibold text-bluewood-400"> / {stats.totalCommits || '—'}</span></p>
            <p className="mt-1.5 text-[11px] text-bluewood-400">내 커밋 / 전체</p>
          </div>
        )}
        <div>
          <p className="text-[20px] font-extrabold leading-none text-bluewood-900">{role || '—'}</p>
          <p className="mt-1.5 text-[11px] text-bluewood-400">주 역할</p>
        </div>
      </div>

      {/* 기여 비중 바 */}
      {pct > 0 && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-100">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: ACCENT }} />
          </div>
          <p className="mt-1.5 text-[11px] text-bluewood-300">내 커밋 {stats.myCommits} / 전체 {stats.totalCommits} · GitHub 기여자 통계(기본 브랜치) 기준</p>
        </div>
      )}

      {/* 언어 구성 — 스택 바 + 이름·% 범례 */}
      {langs.length > 0 && (
        <div className="mt-5">
          <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
            {langs.map((l, i) => (
              <div key={i} className="rounded-full" style={{ width: `${l.pct}%`, backgroundColor: LANG_COLORS[i % LANG_COLORS.length] }} title={`${l.name} ${l.pct}%`} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
            {langs.map((l, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[11.5px] text-bluewood-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LANG_COLORS[i % LANG_COLORS.length] }} />
                {l.name} <span className="text-bluewood-300">{l.pct}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 커밋 잔디 — 언제 얼마나 꾸준히 기여했는지 (GitHub 컨트리뷰션 그래프) */}
      {grassDays.length > 0 && (
        <div className="mt-6">
          <p className="mb-2.5 text-[11px] font-bold text-bluewood-400">커밋 활동</p>
          <CommitGrass days={grassDays} />
        </div>
      )}

      {/* 커밋 유형 분포 — 무슨 일을 주로 했는지 (feat/fix/refactor …) */}
      {types.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[11px] font-bold text-bluewood-400">커밋 유형</p>
          <div className="space-y-1.5">
            {types.map((t, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[11.5px]">
                <span className="w-16 flex-shrink-0 truncate font-mono text-bluewood-500">{t.type}</span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-100">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((t.count / maxType) * 100)}%`, backgroundColor: ACCENT }} />
                </div>
                <span className="w-9 flex-shrink-0 text-right font-semibold tabular-nums text-bluewood-700">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 핵심 역할 — 이 개발에서 내가 맡아 해결한 작업 포인트 (git 경험 요약) */}
      {rolePoints.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[11px] font-bold text-bluewood-400">핵심 역할</p>
          <ul className="space-y-1.5">
            {rolePoints.map((p, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-[1.5] text-bluewood-600">
                <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: ACCENT }} />
                <span className="min-w-0">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {onChange && (
        <details className="mt-6 rounded-xl border border-primary-100 bg-primary-50/35 print:hidden">
          <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-primary-600">기여도·언어·커밋 유형 전체 편집</summary>
          <div className="space-y-4 border-t border-primary-100 p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['myCommits', '내 커밋'], ['totalCommits', '전체 커밋'], ['contributionPct', '기여 비중(%)'], ['rank', '기여 순위'],
              ].map(([key, label]) => <label key={key} className="text-[10.5px] font-bold text-bluewood-400">{label}<input type="number" value={stats[key] || 0} onChange={e => onChange({ ...stats, [key]: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-[12px] text-bluewood-700 outline-none focus:border-primary-300" /></label>)}
              <label className="text-[10.5px] font-bold text-bluewood-400">활동 시작일<input value={stats.activePeriod?.first || ''} onChange={e => onChange({ ...stats, activePeriod: { ...(stats.activePeriod || {}), first: e.target.value } })} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-[12px] text-bluewood-700 outline-none focus:border-primary-300" /></label>
              <label className="text-[10.5px] font-bold text-bluewood-400">활동 종료일<input value={stats.activePeriod?.last || ''} onChange={e => onChange({ ...stats, activePeriod: { ...(stats.activePeriod || {}), last: e.target.value } })} className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-[12px] text-bluewood-700 outline-none focus:border-primary-300" /></label>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between"><span className="text-[10.5px] font-bold text-bluewood-400">언어 구성</span><button type="button" onClick={() => onChange({ ...stats, languages: [...langs, { name: '', pct: 0 }] })} className="text-[10.5px] font-bold text-primary-600">＋ 추가</button></div>
              <div className="space-y-1.5">{langs.map((item, index) => <div key={index} className="grid grid-cols-[1fr_70px_auto] gap-1.5"><input value={item.name || ''} onChange={e => onChange({ ...stats, languages: langs.map((row, i) => i === index ? { ...row, name: e.target.value } : row) })} className="rounded border border-surface-200 px-2 py-1 text-[11px]" /><input type="number" value={item.pct || 0} onChange={e => onChange({ ...stats, languages: langs.map((row, i) => i === index ? { ...row, pct: Number(e.target.value) } : row) })} className="rounded border border-surface-200 px-2 py-1 text-[11px]" /><button type="button" onClick={() => onChange({ ...stats, languages: langs.filter((_, i) => i !== index) })} className="text-[10px] font-bold text-red-400">삭제</button></div>)}</div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between"><span className="text-[10.5px] font-bold text-bluewood-400">커밋 유형</span><button type="button" onClick={() => onChange({ ...stats, commitTypes: [...types, { type: '', count: 0 }] })} className="text-[10.5px] font-bold text-primary-600">＋ 추가</button></div>
              <div className="space-y-1.5">{types.map((item, index) => <div key={index} className="grid grid-cols-[1fr_70px_auto] gap-1.5"><input value={item.type || ''} onChange={e => onChange({ ...stats, commitTypes: types.map((row, i) => i === index ? { ...row, type: e.target.value } : row) })} className="rounded border border-surface-200 px-2 py-1 text-[11px]" /><input type="number" value={item.count || 0} onChange={e => onChange({ ...stats, commitTypes: types.map((row, i) => i === index ? { ...row, count: Number(e.target.value) } : row) })} className="rounded border border-surface-200 px-2 py-1 text-[11px]" /><button type="button" onClick={() => onChange({ ...stats, commitTypes: types.filter((_, i) => i !== index) })} className="text-[10px] font-bold text-red-400">삭제</button></div>)}</div>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

/* ── 코드 창 — 보기: IDE 스타일, hover '수정' → 다크 에디터에서 파일·코드 직접 수정 ── */
function EditableCodeWindow({ file, code, onPatch }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="group/cw relative">
        <CodeSnippet file={file} code={code} />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="absolute right-2 top-1.5 hidden rounded border border-[#30363d] bg-[#161b22] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#8b949e] hover:text-white group-hover/cw:block"
        >수정</button>
      </div>
    );
  }
  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-primary-400 bg-[#0d1117] shadow-md">
      <div className="flex items-center gap-2 border-b border-[#21262d] bg-[#161b22] px-3 py-1.5">
        <input
          value={file || ''}
          onChange={e => onPatch({ file: e.target.value })}
          placeholder="파일 경로 (예: src/auth/middleware.ts)"
          className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-[#e6edf3] outline-none placeholder:text-[#4d5566]"
        />
        <button type="button" onClick={() => setEditing(false)} className="flex-shrink-0 rounded bg-primary-600 px-2 py-0.5 text-[10.5px] font-bold text-white hover:bg-primary-500">완료</button>
      </div>
      <textarea
        autoFocus
        value={code || ''}
        onChange={e => onPatch({ code: e.target.value })}
        rows={Math.min(16, Math.max(4, String(code || '').split('\n').length + 1))}
        spellCheck={false}
        className="block w-full resize-y bg-transparent px-3 py-2 font-mono text-[11.5px] leading-[1.7] text-[#d4d4d4] outline-none placeholder:text-[#4d5566]"
        placeholder="코드를 입력하세요"
      />
    </div>
  );
}

/* 여러 줄 리스트 편집 블록 — 라벨 + AutoText(dense). (행 내부 정의 시 재마운트로 포커스가 끊겨 모듈 레벨로 둠) */
function GitListEdit({ label, color, value, onChange, placeholder }) {
  return (
    <div>
      <p className="mb-0.5 text-[11px] font-bold" style={{ color }}>{label}</p>
      <AutoText
        dense
        value={value}
        onChange={onChange}
        placeholder={placeholder || `${label} 입력 (줄바꿈으로 항목 구분)`}
        className="text-[12.5px] leading-[1.6] text-bluewood-600"
      />
    </div>
  );
}

/* ── 문제 해결 아코디언 행 — 핵심 경험 아코디언과 같은 인터랙션 문법 + 전 필드 인라인 편집 ── */
function GitProjectRow({ exp, index, open, onToggle, onPatch, onDelete }) {
  const title = clean(exp.project_name) || `프로젝트 ${index + 1}`;
  const impact = clean(exp.core_impact);
  const problemLine = toLines(exp.problem_definition)[0] || '';  // 접힘 상태에 보여줄 '어떤 문제'
  const snippets = Array.isArray(exp.code_snippets) ? exp.code_snippets.filter(s => s && (s.code || s.why || s.file)) : [];
  const troubleSnippets = Array.isArray(exp.troubleshooting_snippets) ? exp.troubleshooting_snippets.filter(s => s && (s.code || s.solution || s.issue)) : [];
  const trouble = toLines(exp.troubleshooting);

  // 배열 필드 ↔ 여러 줄 텍스트 편집 (한 줄 = 한 항목)
  const linesVal = (v) => toLines(v).join('\n');
  const setLines = (key) => (v) => onPatch({ [key]: v.split('\n') });
  const patchSnippet = (listKey) => (i, changes) => {
    const list = Array.isArray(exp[listKey]) ? [...exp[listKey]] : [];
    list[i] = { ...(list[i] || {}), ...changes };
    onPatch({ [listKey]: list });
  };
  const patchCode = patchSnippet('code_snippets');
  const patchTrouble = patchSnippet('troubleshooting_snippets');

  return (
    <div className="border-b border-surface-200">
      {open ? (
        /* ── 펼침: 편집 가능한 헤더 (번호 + 제목) ── */
        <div className="flex items-start gap-2.5 pt-2.5 pb-1">
          <span className="mt-0.5 flex flex-shrink-0 items-center justify-center rounded text-[10.5px] font-black text-white" style={{ backgroundColor: ACCENT, height: '18px', width: '18px' }}>{index + 1}</span>
          <div className="min-w-0 flex-1">
            <AutoText
              prose
              value={exp.project_name || ''}
              onChange={(v) => onPatch({ project_name: v })}
              placeholder={`프로젝트 ${index + 1}`}
              className="text-[14px] sm:text-[14.5px] font-extrabold leading-snug text-bluewood-900"
            />
            <div className="mt-1 flex items-start gap-2">
              <div className="w-44 flex-shrink-0">
                <AutoText
                  value={exp.period || ''}
                  onChange={(v) => onPatch({ period: v })}
                  placeholder="기간 (예: 2026.05 ~ 2026.07)"
                  className="text-[11px] text-bluewood-400"
                />
              </div>
              <div className="min-w-0 flex-1">
                <AutoText
                  value={exp.core_tech_stack || ''}
                  onChange={(v) => onPatch({ core_tech_stack: v })}
                  placeholder="기술 태그 (쉼표로 구분)"
                  className="text-[11px] text-bluewood-500"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button type="button" onClick={onDelete} className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-bluewood-300 hover:bg-red-50 hover:text-red-500">삭제</button>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded
              aria-label="접기"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-surface-200 bg-white text-bluewood-500 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
              style={{ transform: 'rotate(180deg)' }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
          </div>
        </div>
      ) : (
        /* ── 접힘: 행 전체 클릭 · 컴팩트 ── */
        <button type="button" onClick={onToggle} aria-expanded={false} className="group flex w-full items-center gap-2.5 py-2.5 text-left">
          <span className="flex flex-shrink-0 items-center justify-center rounded text-[10.5px] font-black text-white" style={{ backgroundColor: ACCENT, height: '18px', width: '18px' }}>{index + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-extrabold leading-snug text-bluewood-900">{title}</p>
            {problemLine ? (
              <p className="mt-0.5 truncate text-[12px] text-bluewood-500">
                <span className="font-bold" style={{ color: '#314157' }}>문제 </span>{problemLine}
              </p>
            ) : impact ? (
              <p className="mt-0.5 truncate text-[12px] font-semibold text-bluewood-500">
                <span className="font-black" style={{ color: ACCENT }}>성과 </span>{impact}
              </p>
            ) : null}
          </div>
          {/* 접힘 상태에서도 깊이가 보이도록 — 코드·픽스 카운트 */}
          {(snippets.length > 0 || troubleSnippets.length > 0 || trouble.length > 0) && (
            <span className="hidden flex-shrink-0 items-center gap-1.5 font-mono text-[10px] sm:flex">
              {snippets.length > 0 && <span className="rounded border border-surface-200 bg-surface-50 px-1.5 py-0.5 text-bluewood-400">{'</>'} {snippets.length}</span>}
              {(troubleSnippets.length > 0 || trouble.length > 0) && <span className="rounded px-1.5 py-0.5 font-semibold" style={{ color: '#b45309', backgroundColor: '#fef7ec' }}>fix {troubleSnippets.length || trouble.length}</span>}
            </span>
          )}
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-surface-200 bg-white text-bluewood-400 transition-all group-hover:border-primary-300 group-hover:bg-primary-50 group-hover:text-primary-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </span>
        </button>
      )}

      {open && (
        <div className="space-y-3.5 pb-4 pl-[28px]">
          <GitListEdit label="문제" color="#314157" value={linesVal(exp.problem_definition)} onChange={setLines('problem_definition')} />
          <GitListEdit label="해결" color={ACCENT} value={linesVal(exp.action_and_solution)} onChange={setLines('action_and_solution')} />

          {/* 성과 — 접힘 요약·하이라이트와 동기화 */}
          <div className="flex items-baseline gap-2">
            <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-wide" style={{ color: ACCENT }}>성과</span>
            <AutoText
              dense
              value={exp.core_impact || ''}
              onChange={(v) => onPatch({ core_impact: v })}
              placeholder="이 작업의 핵심 성과 한 줄"
              className="text-[12.5px] font-bold leading-[1.55] text-bluewood-900"
            />
          </div>

          {/* 코드 변경 — 파일·코드·설명 모두 편집 가능 */}
          {snippets.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-bluewood-700">코드 변경</p>
              {exp.code_snippets.map((s, i) => (
                (s && (s.code || s.why || s.file)) ? (
                  <div key={i} className="mb-3">
                    <EditableCodeWindow file={s.file} code={s.code} onPatch={(ch) => patchCode(i, ch)} />
                    <AutoText
                      dense
                      value={s.why || s.change || ''}
                      onChange={(v) => patchCode(i, { why: v })}
                      placeholder="핵심 로직이 처리하는 내용과 이 방식을 선택한 이유·효과를 설명"
                      className="-mt-2 text-[12.5px] leading-[1.7] text-bluewood-600"
                    />
                  </div>
                ) : null
              ))}
            </div>
          ) : (
            <GitListEdit label="코드 변경" color="#334155" value={linesVal(exp.code_changes)} onChange={setLines('code_changes')} placeholder="핵심 코드 변경 내용 (줄바꿈으로 항목 구분)" />
          )}

          {/* 트러블슈팅 — 이슈·파일·코드·해결 설명 편집 가능 */}
          {troubleSnippets.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] font-bold" style={{ color: '#b45309' }}>트러블슈팅</p>
              {exp.troubleshooting_snippets.map((s, i) => (
                (s && (s.code || s.solution || s.issue)) ? (
                  <div key={i} className="mb-3">
                    <AutoText
                      dense
                      value={s.issue || ''}
                      onChange={(v) => patchTrouble(i, { issue: v })}
                      placeholder="발생한 문제 한 줄"
                      className="mb-1 text-[12.5px] font-semibold text-bluewood-800"
                    />
                    <EditableCodeWindow file={s.file} code={s.code} onPatch={(ch) => patchTrouble(i, ch)} />
                    <AutoText
                      dense
                      value={s.solution || ''}
                      onChange={(v) => patchTrouble(i, { solution: v })}
                      placeholder="문제의 원인과 코드로 해결한 방식·효과를 설명"
                      className="-mt-2 text-[12.5px] leading-[1.7] text-bluewood-600"
                    />
                  </div>
                ) : null
              ))}
            </div>
          ) : (
            <GitListEdit label="트러블슈팅" color="#b45309" value={linesVal(exp.troubleshooting)} onChange={setLines('troubleshooting')} placeholder="발생한 문제 → 원인 → 해결 흐름" />
          )}

          <GitListEdit label="배운 점" color="#94a3b8" value={linesVal(exp.learning)} onChange={setLines('learning')} placeholder="이 작업으로 배운 점" />
        </div>
      )}
    </div>
  );
}

/* 레거시 README 마크다운 → 일반 문서 세그먼트 변환 (한 번 저장했던 사용자 데이터 보존) */
function markdownToSegs(md) {
  const segs = [];
  const strip = (s) => s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
  const push = (variant, content) => content && segs.push({ id: uid(), type: 'text', variant, content });
  String(md).replace(/\r\n/g, '\n').split('\n').forEach(line => {
    const t = line.trim();
    if (/^---\s*[^-]+?\s*---$/.test(t)) return; // 수집 단계 메타 라벨 생략
    if (!t || /^(-{3,}|\*{3,}|_{3,})$/.test(t) || /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(t)) return; // 빈 줄·구분선·표 구분행 생략
    const h = t.match(/^#{1,6}\s+(.*)$/);
    if (h) return push('heading', strip(h[1]));
    if (/^>\s?/.test(t)) return push('paragraph', strip(t.replace(/^>\s?/, '')));
    if (/^([-*+]|\d+\.)\s+/.test(t)) return push('bullet', strip(t.replace(/^([-*+]|\d+\.)\s+/, '')));
    if (t.includes('|')) {
      const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => strip(c)).filter(Boolean);
      if (cells.length >= 2 && cells[0] !== '기능') push('bullet', `${cells[0]} — ${cells.slice(1).join(' · ')}`);
      return;
    }
    push('paragraph', strip(t));
  });
  return segs;
}

function getRawMaterialText(exp) {
  return String(
    exp?.content?.rawInput
    || exp?.rawInput
    || exp?.structuredResult?.rawInput
    || '',
  ).trim();
}

/* 원본 기획 문서의 H1, H2… 가설 표를 보존해 PM 가설 셀에 사용 */
function extractNumberedPmHypotheses(exp) {
  const raw = getRawMaterialText(exp);
  if (!raw) return [];
  const found = new Map();
  const add = (number, value) => {
    const text = String(value || '')
      .split('|')[0]
      .replace(/^[\s>*`_~-]+|[\s*`_~-]+$/g, '')
      .replace(/^['"]|['"]$/g, '')
      .trim();
    if (text && text !== '가설' && text.length <= 180 && !found.has(number)) found.set(number, text);
  };
  raw.replace(/"H(\d{1,2})"\s*:\s*"([^"\n]+)"/gi, (_, number, value) => {
    add(Number(number), value);
    return _;
  });
  raw.split(/\r?\n/).forEach(line => {
    const normalized = String(line || '').replace(/^\s*[-*+]\s+/, '').trim();
    const match = normalized.match(/^\|?\s*H(\d{1,2})\s*(?:\||[:：.)-]|\s)\s*(.+?)\s*\|?$/i);
    if (match) add(Number(match[1]), match[2]);
  });
  return [...found.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, 12)
    .map(([, hypothesis]) => hypothesis);
}

function extractReadmeLikeMarkdown(exp) {
  const sr = exp?.structuredResult || {};
  const direct = String(sr.readme || '').trim();
  if (direct) return isNoisyLegacyDocumentText(direct) ? '' : direct;
  const raw = getRawMaterialText(exp);
  if (!raw) return '';
  const cleaned = raw
    .split(/(?:^|\n)===\s*AI\s*추출\s*핵심\s*경험\s*===/)[0]
    .replace(/\r\n/g, '\n')
    .trim();

  // 자료를 '--- 라벨 ---' 구분자로 섹션 분할 (업로드 파일 vs GitHub 레포 README 구분)
  // ⚠ 한 줄로 한정([ \t]*) — 마크다운 수평선(---)을 섹션 구분자로 오인하지 않도록.
  const parts = [];
  const re = /(?:^|\n)---[ \t]+(.+?)[ \t]+---[ \t]*(?:\n|$)/g;
  let m, lastIdx = 0, lastLabel = '원본';
  while ((m = re.exec(cleaned)) !== null) {
    if (m.index > lastIdx) parts.push({ label: lastLabel, text: cleaned.slice(lastIdx, m.index).trim() });
    lastLabel = m[1]; lastIdx = re.lastIndex;
  }
  parts.push({ label: lastLabel, text: cleaned.slice(lastIdx).trim() });

  const isReadme = (t) => !isNoisyLegacyDocumentText(t)
    && /(^|\n)#{1,2}\s+\S/.test(t)
    && /(문제\s*정의|해결\s*방법|핵심\s*기능|주요\s*기능)/.test(t);
  const isGithub = (label) => /github|깃허브|리포지토리|repo/i.test(label);
  // 1순위: 업로드한 서비스 파일 README, 2순위: GitHub 레포 README, 3순위: 전체
  // (내 깃허브 README는 개발 README라 서비스 설명 파일보다 뒤로)
  const fileReadme = parts.find(p => !isGithub(p.label) && isReadme(p.text));
  if (fileReadme) return fileReadme.text;
  const ghReadme = parts.find(p => isGithub(p.label) && isReadme(p.text));
  if (ghReadme) return ghReadme.text;
  return isReadme(cleaned) ? cleaned : '';
}

function sectionTextFromMarkdown(markdown, heading) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex(line => new RegExp(`^#{1,4}\\s*${heading}\\s*$`).test(line.trim()));
  if (start < 0) return '';
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,4}\s+\S/.test(line.trim())) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

function featureRowsFromMarkdown(markdown) {
  const block = sectionTextFromMarkdown(markdown, '핵심 기능') || sectionTextFromMarkdown(markdown, '주요 기능');
  const rows = [];
  String(block).split('\n').forEach(line => {
    const t = line.trim();
    if (!t || /^\|?\s*[-:]+\s*\|/.test(t)) return;
    if (t.includes('|')) {
      const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.replace(/\*\*/g, '').trim()).filter(Boolean);
      if (cells.length >= 2 && !/^기능$/i.test(cells[0])) rows.push({ name: cells[0], desc: cells.slice(1).join(' · ') });
      return;
    }
    const bullet = t.match(/^[-*+]\s+(.+)$/);
    if (bullet) rows.push({ name: bullet[1], desc: '' });
  });
  return rows;
}

function firstMarkdownHeading(markdown) {
  const hit = String(markdown || '').match(/^#{1,2}\s+(.+)$/m);
  return clean(hit?.[1] || '').replace(/^>\s*/, '').trim();
}

function collectYooptaText(value) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === 'string') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== 'object') return;
    if (typeof node.text === 'string') out.push(node.text);
    Object.values(node).forEach(walk);
  };
  walk(value);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

function collectCaseSegmentText(value) {
  if (!Array.isArray(value)) return '';
  return value.map(seg => clean(seg?.content || '')).filter(Boolean).join(' ');
}

/* 과거 업로드 PDF/설계서 전체가 README로 오인된 문서인지 판별한다. */
function isNoisyLegacyDocumentText(value) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return false;
  const signals = [
    /\b\d+\s+of\s+\d+\b/i,
    /팀번호\s*[:：]?/,
    /(?:^|\n)\s*팀원\s*[•·:：]/m,
    /학번\s*[:：]?/,
    /(?:졸업작품|프로젝트)\s*설계서/,
  ].filter(re => re.test(text)).length;
  return text.length > 12000 || signals >= 2 || (text.length > 2500 && signals >= 1);
}

function shouldUseReadmeSeed(exp, savedOverviewDoc) {
  const readme = extractReadmeLikeMarkdown(exp);
  if (!readme) return false;
  const savedText = (isYooptaDoc(savedOverviewDoc) ? collectYooptaText(savedOverviewDoc) : collectCaseSegmentText(savedOverviewDoc));
  if (!savedText) return true;
  const title = firstMarkdownHeading(readme);
  if (title && !savedText.includes(title)) return true;
  const hasReadmeSections = /(문제\s*정의|해결\s*방법|핵심\s*기능|주요\s*기능)/.test(savedText);
  if (title && savedText.includes(title) && hasReadmeSections) return false;
  const looksDevHeavy = /(프론트엔드|백엔드|HMR|Zustand|Firebase|Firestore|Node\.?js|Express|커밋|개발\s*환경|기술\s*스택)/i.test(savedText);
  return !hasReadmeSections || looksDevHeavy;
}

/* 경험 내용 → 프로젝트 소개 문서 초안 (일반 글 세그먼트).
 * 우선순위: ① 원본 README 흐름 → ② 내 아이템의 문제정의/해결/핵심 기능.
 * 코드·트러블슈팅은 아래 '문제 해결 과정'에서 다루므로 여기엔 넣지 않는다. */
/* README 마크다운에서 특정 섹션(핵심 기능·성과)을 제거 — 그 내용은 아래 표(ProductFacts)로 별도 표시 */
function stripReadmeSections(md, headings) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let skip = false;
  for (const line of lines) {
    const h = line.trim().match(/^#{1,4}\s+(.*)$/);
    if (h) { const name = h[1].replace(/\s+/g, ''); skip = headings.some(hd => name.includes(hd)); if (skip) continue; }
    if (!skip) out.push(line);
  }
  return out.join('\n').trim();
}

/* 프로젝트 소개 초안 — 서사(제목·소개·문제정의·해결방법)만. 핵심기능·성과는 ProductFacts 표로 분리.
 * 우선순위: ① 원본 README 흐름 → ② 사업(아이템) 관점 문제정의 → (없으면) 개발 관점. */
function buildOverviewSeedSegs(exp, caseStudy) {
  const sr = exp?.structuredResult || {};
  const ov = sr.projectOverview || {};
  const product = sr.product && typeof sr.product === 'object' ? sr.product : {};
  const completedCaseStudy = caseStudy || exp?.caseStudy || {};
  const completedExperience = (Array.isArray(completedCaseStudy.keyExps) ? completedCaseStudy.keyExps : [])
    .find(item => clean(item?.problem || item?.action || item?.result));
  const legacyExperience = completedExperience || (Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [])
    .find(item => clean(item?.context || item?.situation || item?.action || item?.result));
  const oneLine = (v) => clean(v).replace(/\n+/g, ' ').trim();
  const norm = (v) => clean(v).replace(/\s+/g, '').slice(0, 80);

  // 최우선: AI가 뽑은 서비스(아이템) 설명(product) — 개발 서사보다 앞선다.
  const title = oneLine(product.name) || oneLine(completedCaseStudy.title) || oneLine(sr.projectName || sr.title || ov.name || exp?.title);
  const tagline = oneLine(product.tagline) || oneLine(completedCaseStudy.summary) || oneLine(sr.intro) || oneLine(ov.summary) || oneLine(ov.goal);
  const problem = clean(product.problem) || clean(completedExperience?.problem)
    || clean(ov.background) || clean(ov.goal) || clean(sr.problem) || clean(sr.overview)
    || clean(legacyExperience?.context || legacyExperience?.situation);
  let solution = clean(product.solution) || clean(completedExperience?.action)
    || clean(ov.solution) || clean(ov.summary) || clean(sr.solution) || clean(sr.intro)
    || clean(legacyExperience?.action);

  // 구조화된 기존 경험도 없을 때만 README로 폴백한다. 예전 PDF 원문 전체가
  // 프로젝트 소개로 들어가던 문제를 막고, 완료된 핵심 경험을 우선 재사용한다.
  const hasStructuredNarrative = Boolean(problem || solution || tagline || legacyExperience);
  if (!clean(product.problem) && !clean(product.solution) && !hasStructuredNarrative) {
    const readmeLike = extractReadmeLikeMarkdown(exp);
    if (readmeLike && !isNoisyLegacyDocumentText(readmeLike)) {
      return markdownToSegs(stripReadmeSections(readmeLike, ['핵심기능', '주요기능', '성과', '주요성과']));
    }
  }

  // 문제·해결·소개가 같은 문장으로 3중 중복되는 것 방지
  if (norm(solution) && norm(solution) === norm(problem)) solution = clean(sr.process) || clean(sr.task) || '';
  const showTagline = tagline && norm(tagline) !== norm(problem) && norm(tagline) !== norm(solution);

  const segs = [];
  const push = (variant, content) => content && segs.push({ id: uid(), type: 'text', variant, content });
  if (title) push('heading', title);
  if (showTagline) push('paragraph', tagline);
  push('heading', '문제 정의');
  push('paragraph', problem || '이 아이템이 해결하려는 사업적 문제 — 누가, 어떤 상황에서, 어떤 불편을 겪는지 적어주세요.');
  push('heading', '해결 방법');
  push('paragraph', solution || '이 서비스가 문제를 푸는 방식을 개념 위주로 적어주세요.');
  return segs;
}

/* 성과 문장을 지표/값 쌍으로 파싱 — "만족도 70%", "사용자 400명 달성", "조회수 78,881회" 등 */
function parseMetricPair(s) {
  const t = clean(s).replace(/\n+/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); // 괄호 부연 제거
  if (!t) return null;
  const UNIT = '%|명|건|원|점|배|분|초|시간|일|주|개월|년|만|천|억|회|k|K|x|X';
  const m = t.match(new RegExp(`^(.*?)[\\s:·]*((?:[\\d.,]+\\s*(?:${UNIT})?)(?:\\s*(?:이상|이하|달성|증가|감소|단축|초과|돌파))?)\\s*$`));
  if (m && /\d/.test(m[2])) {
    const label = m[1].replace(/[:·\-]\s*$/, '').trim();
    return { label: label || '성과', value: m[2].trim() };
  }
  return { label: t, value: '' };
}

/* ── 주요 성과 · 핵심 기능 — 서사 문서와 분리한 깔끔한 표 (product 우선) ── */
function ProductFacts({ exp, onChange }) {
  const sr = exp?.structuredResult || {};
  const ov = sr.projectOverview || {};
  const product = sr.product && typeof sr.product === 'object' ? sr.product : {};
  const oneLine = (v) => clean(v).replace(/\n+/g, ' ').trim();
  const clip = (s, n = 150) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  const readme = extractReadmeLikeMarkdown(exp);

  const kes = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];

  // 핵심 기능 — '서비스 기능'만: product.features → 서비스 README 표 → 전체 자료에서 기능 표 탐색.
  // (개발 성과 keyExp는 여기 넣지 않음. 단, 어느 자료에서든 기능 표가 있으면 반드시 찾아 비지 않게 함)
  let rows = (Array.isArray(product.features) ? product.features : [])
    .map(f => ({ name: oneLine(f?.name), desc: oneLine(f?.desc) })).filter(r => r.name || r.desc);
  if (!rows.length) rows = featureRowsFromMarkdown(readme);
  if (!rows.length) rows = featureRowsFromMarkdown(getRawMaterialText(exp));
  rows = rows.map(r => ({ name: clip(oneLine(r.name) || '기능', 40), desc: clip(oneLine(r.desc) || '', 160) })).filter(r => r.name).slice(0, 10);

  // 주요 성과 — product.outcomes(지표|값) → 핵심 경험의 성과(제목|성과 설명/수치)
  let outcomes = (Array.isArray(product.outcomes) ? product.outcomes : [])
    .map(o => ({ label: oneLine(o?.label), value: oneLine(o?.value) })).filter(o => o.label || o.value);
  if (!outcomes.length) {
    outcomes = kes
      .map(k => {
        const label = oneLine(k.title);
        const value = oneLine(k.result) || oneLine(k.metric || k.afterMetric) || oneLine(k.context);
        return label || value ? { label: label || '성과', value } : null;
      })
      .filter(Boolean);
  }
  outcomes = outcomes.map(o => ({ label: clip(o.label || '성과', 60), value: clip(o.value || '', 200) })).slice(0, 8);

  if (!onChange && !rows.length && !outcomes.length) return null;

  const Table = ({ label, rowsData }) => (
    <div>
      <h3 className={`${MICRO_LABEL} mb-2.5`}>{label}</h3>
      <div className="overflow-hidden rounded-xl border border-surface-200">
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {rowsData.map((r, i) => (
              <tr key={i} className="border-b border-surface-100 last:border-0">
                <td className="w-[34%] border-r border-surface-100 bg-surface-50/50 px-3 py-2 align-top font-bold text-bluewood-800">{r.name}</td>
                <td className="px-3 py-2 align-top leading-[1.6] text-bluewood-600">{r.desc || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      {outcomes.length > 0 && <Table label="주요 성과" rowsData={outcomes.map(o => ({ name: o.label, desc: o.value }))} />}
      {rows.length > 0 && <Table label="핵심 기능" rowsData={rows} />}
      {onChange && (
        <details className="rounded-xl border border-primary-100 bg-primary-50/35 print:hidden">
          <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-primary-600">주요 성과·핵심 기능 전체 편집</summary>
          <div className="space-y-4 border-t border-primary-100 p-3">
            <div>
              <div className="mb-2 flex items-center justify-between"><p className="text-[10.5px] font-bold text-bluewood-500">주요 성과</p><button type="button" onClick={() => onChange({ ...product, outcomes: [...(product.outcomes || []), { label: '', value: '' }] })} className="text-[10.5px] font-bold text-primary-600">＋ 추가</button></div>
              <div className="space-y-2">{(product.outcomes || []).map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><AutoText dense value={item.label || ''} onChange={value => onChange({ ...product, outcomes: product.outcomes.map((row, i) => i === index ? { ...row, label: value } : row) })} placeholder="성과명" className="text-[11.5px]" /><AutoText dense value={item.value || ''} onChange={value => onChange({ ...product, outcomes: product.outcomes.map((row, i) => i === index ? { ...row, value } : row) })} placeholder="결과·수치" className="text-[11.5px]" /><button type="button" onClick={() => onChange({ ...product, outcomes: product.outcomes.filter((_, i) => i !== index) })} className="text-[10px] font-bold text-red-400">삭제</button></div>)}</div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><p className="text-[10.5px] font-bold text-bluewood-500">핵심 기능</p><button type="button" onClick={() => onChange({ ...product, features: [...(product.features || []), { name: '', desc: '' }] })} className="text-[10.5px] font-bold text-primary-600">＋ 추가</button></div>
              <div className="space-y-2">{(product.features || []).map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[0.8fr_1.5fr_auto]"><AutoText dense value={item.name || ''} onChange={value => onChange({ ...product, features: product.features.map((row, i) => i === index ? { ...row, name: value } : row) })} placeholder="기능명" className="text-[11.5px]" /><AutoText dense value={item.desc || ''} onChange={value => onChange({ ...product, features: product.features.map((row, i) => i === index ? { ...row, desc: value } : row) })} placeholder="기능 설명" className="text-[11.5px]" /><button type="button" onClick={() => onChange({ ...product, features: product.features.filter((_, i) => i !== index) })} className="text-[10px] font-bold text-red-400">삭제</button></div>)}</div>
            </div>
          </div>
        </details>
      )}
    </>
  );
}

/* 프로젝트 흐름 폴백 — AI 흐름도가 없으면 핵심 경험(기능)을 사용자 여정 단계로 체인 */
function buildFallbackFlow(sr) {
  const kes = Array.isArray(sr?.keyExperiences) ? sr.keyExperiences : [];
  const steps = kes
    .map(k => clean(k.title).split('\n')[0].trim())
    .filter(Boolean)
    .map(s => (s.length > 24 ? `${s.slice(0, 23)}…` : s))
    .slice(0, 5);
  if (steps.length < 2) return null;
  const nodes = [
    { id: 'flow0', label: '사용자 진입', tech: '', tier: 0 },
    ...steps.map((s, i) => ({ id: `flow${i + 1}`, label: s, tech: '', tier: i + 1 })),
  ];
  const edges = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id, label: '' }));
  return { nodes, edges };
}

/* 기존 핵심 경험(CARL)을 새 개발자 문제 해결 과정 형식으로 비파괴 변환한다. */
function deriveLegacyDevProblemSolving(sr, caseStudy) {
  const ov = sr?.projectOverview || {};
  const jobSpecific = sr?.jobSpecific || {};
  const compact = (value, max = 1200) => {
    const normalized = clean(value).replace(/\s+/g, ' ').trim();
    return normalized.length > max ? `${normalized.slice(0, max - 1).trimEnd()}…` : normalized;
  };
  const list = (...values) => [...new Set(values.map(value => compact(value)).filter(Boolean))];
  const caseTech = Array.isArray(caseStudy?.tech) ? caseStudy.tech : [];
  const techStack = deriveDevTechStack(
    { structuredResult: { ...sr, gitAnalysis: null } },
    [...caseTech, ...(Array.isArray(sr?.keywords) ? sr.keywords : [])],
  );
  const period = compact(caseStudy?.meta?.duration || ov.duration, 120);
  const projectName = compact(caseStudy?.title || sr?.projectName || sr?.title || ov.name, 160);
  const structuredExperiences = Array.isArray(sr?.keyExperiences) ? sr.keyExperiences : [];
  const completedExperiences = Array.isArray(caseStudy?.keyExps) ? caseStudy.keyExps : [];
  const keyExperiences = completedExperiences.length ? completedExperiences : structuredExperiences;

  const mapped = keyExperiences.map((experience, index) => {
    const structured = structuredExperiences[index] || {};
    const jobData = structured?.jobData || experience?.jobData || {};
    const obstacle = compact(jobData.obstacle || structured?.obstacle || experience?.obstacle);
    const resolution = compact(jobData.resolution || structured?.resolution || experience?.resolution);
    const troubleshooting = list(
      obstacle && resolution ? `${obstacle} → ${resolution}` : obstacle || resolution,
      index === 0 ? jobSpecific.troubleshooting : '',
    );
    return {
      project_name: compact(experience?.title || structured?.title, 180) || projectName || `문제 해결 ${index + 1}`,
      period,
      core_tech_stack: techStack.join(', '),
      problem_definition: list(experience?.problem || experience?.context || experience?.situation || structured?.context || structured?.situation),
      action_and_solution: list(experience?.action || structured?.action),
      core_impact: compact(
        experience?.afterMetric || experience?.metric || experience?.result
        || structured?.afterMetric || structured?.metric || structured?.result,
      ),
      code_changes: list(index === 0 ? jobSpecific.optimization : ''),
      code_snippets: [],
      troubleshooting,
      troubleshooting_snippets: [],
      learning: list(experience?.learning || structured?.learning),
    };
  }).filter(item => (
    item.problem_definition.length || item.action_and_solution.length || item.core_impact
    || item.troubleshooting.length || item.learning.length
  ));

  if (mapped.length) return mapped;

  const fallback = {
    project_name: projectName || '개발 프로젝트',
    period,
    core_tech_stack: techStack.join(', '),
    problem_definition: list(sr?.overview || ov.background || ov.goal),
    action_and_solution: list(sr?.task, sr?.process),
    core_impact: compact(sr?.output),
    code_changes: list(jobSpecific.optimization),
    code_snippets: [],
    troubleshooting: list(jobSpecific.troubleshooting),
    troubleshooting_snippets: [],
    learning: list(sr?.growth),
  };
  return fallback.problem_definition.length || fallback.action_and_solution.length || fallback.core_impact
    || fallback.troubleshooting.length || fallback.learning.length ? [fallback] : [];
}

/* ── 프로젝트 소개 — 일반 글 형식 문서 (내용 섹션과 같은 편집기: 클릭 편집 + 우클릭 서식) ── */
function OverviewDoc({ value, seed, onChange }) {
  const doc = useMemo(() => (
    isYooptaDoc(value) ? value : caseBodyToYooptaValue(Array.isArray(value) && value.length > 0 ? value : seed)
  ), [value, seed]);
  const isSeed = !isYooptaDoc(value) && !(Array.isArray(value) && value.length > 0);
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h3 className={MICRO_LABEL}>프로젝트 소개</h3>
        <span className="text-[11px] text-bluewood-300">{isSeed ? '내용 기반 자동 초안 · ' : ''}노션형 편집 · 우클릭 서식</span>
      </div>
      <div className="rounded-lg border border-transparent px-1 py-1 transition-colors hover:border-surface-100 hover:bg-surface-50/40">
        <YooptaMiniEditor
          value={doc}
          onChange={onChange}
          minHeight={24}
          placeholder="프로젝트 소개를 입력하세요..."
          className="dev-impact-overview-doc"
        />
      </div>
    </div>
  );
}

function ContextMenuHost() {
  const [menu, setMenu] = useState(null);
  useEffect(() => {
    const onOpen = (event) => {
      const items = event.detail?.items;
      if (!items?.length) return;
      const x = Math.max(8, Math.min(event.detail.x, window.innerWidth - 180));
      const y = Math.max(8, Math.min(event.detail.y, window.innerHeight - (items.length * 40 + 16)));
      setMenu({ x, y, items });
    };
    const onClose = () => setMenu(null);
    const onKey = (event) => { if (event.key === 'Escape') setMenu(null); };
    window.addEventListener('fitpoly:open-context-menu', onOpen);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('fitpoly:open-context-menu', onOpen);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  if (!menu) return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[1000]"
        onClick={() => setMenu(null)}
        onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
      />
      <div
        className="fixed z-[1001] min-w-[168px] overflow-y-auto rounded-lg border border-surface-200 bg-white py-1 shadow-xl"
        style={{ top: menu.y, left: menu.x, maxHeight: 'min(520px, calc(100vh - 16px))' }}
      >
        {menu.items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { item.onClick?.(); setMenu(null); }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors ${item.danger ? 'text-red-500 hover:bg-red-50' : 'text-bluewood-700 hover:bg-surface-50'}`}
          >
            {item.icon && <item.icon size={14} />} {item.label}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}

/* ── 개발 임팩트 — 케이스 스터디의 개발 직군 구조: README → 아키텍처 → 문제 해결 (기여도 통계는 좌측 사이드바로 이동) ── */
function DevImpactSection({ expId, exp, caseStudy, onApplied, onPatchSr }) {
  const [connectOpen, setConnectOpen] = useState(false);
  const [openProjects, setOpenProjects] = useState([0]); // 첫 항목은 펼친 상태로

  // 아키텍처 편집 상태 (개발자 포트폴리오와 동일한 캔버스). archTab: 'system'(개발 구조) | 'flow'(프로젝트 흐름)
  const [archTab, setArchTab] = useState('system');
  const [editDiagram, setEditDiagram] = useState(false);
  const [diagramDraft, setDiagramDraft] = useState({ nodes: [], edges: [] });
  const [editCanvas, setEditCanvas] = useState({ w: 800, h: 420 });

  const sr = exp?.structuredResult || {};
  const ov = sr.projectOverview || {};
  const stats = sr.githubStats || null;
  const gitExps = Array.isArray(sr.gitAnalysis?.experiences) ? sr.gitAnalysis.experiences : [];
  const repoName = sr.gitAnalysis?.repoName || stats?.repoName || '';
  const hasGit = Boolean(stats || repoName || (gitExps.length > 0 && sr.gitAnalysis?.source !== 'legacy'));
  const legacyDevExps = useMemo(() => deriveLegacyDevProblemSolving(sr, caseStudy), [sr, caseStudy]);
  // 저장된 Git 분석이 없으면 예전에 완료한 핵심 경험을 새 문제 해결 형식으로 보여준다.
  // 한 번 편집한 레거시 항목은 gitAnalysis.source='legacy'로 보존해 삭제도 유지한다.
  const useLegacyExps = gitExps.length === 0 && sr.gitAnalysis?.source !== 'legacy';
  const displayDevExps = useLegacyExps ? legacyDevExps : gitExps;

  // 아키텍처 1) 개발 구조 — AI가 만든 다이어그램 우선, 없으면 실제 기술스택 기반 폴백
  // (키워드는 사업/예시 단어가 섞여 무관한 박스를 만들어 제외 — 실제 기술만)
  const savedSystem = Array.isArray(sr.architectureDiagram?.nodes) && sr.architectureDiagram.nodes.length > 0
    ? sr.architectureDiagram : null;
  const techs = [
    ...(Array.isArray(ov.techStack) ? ov.techStack : []).map(t => (typeof t === 'string' ? t : t?.name || '')),
    ...displayDevExps.flatMap(e => String(e.core_tech_stack || '').split(/,\s*/)),
    ...(Array.isArray(stats?.languages) ? stats.languages.map(l => l.name) : []),
  ].filter(isCodingTechName);
  const systemDiagram = savedSystem || buildFallbackDiagram(techs);

  // 아키텍처 2) 프로젝트 흐름 — AI가 만든 서비스 흐름 우선, 없으면 핵심 경험 단계로 폴백
  const savedFlow = Array.isArray(sr.flowDiagram?.nodes) && sr.flowDiagram.nodes.length > 0
    ? sr.flowDiagram : null;
  const flowDiagram = savedFlow || buildFallbackFlow(sr);
  const activeDiagram = archTab === 'flow' ? flowDiagram : systemDiagram;
  const isFlow = archTab === 'flow';

  // 프로젝트 소개 초안 — product(서비스 설명) 최우선, 없으면 README 원본
  const overviewSeed = useMemo(() => buildOverviewSeedSegs(exp, caseStudy), [exp, caseStudy]);
  const overviewDocValue = useMemo(() => {
    const saved = sr.overviewDoc;
    const rawSavedText = isYooptaDoc(saved) ? collectYooptaText(saved) : collectCaseSegmentText(saved);
    if (isNoisyLegacyDocumentText(rawSavedText)) return null;
    const savedText = rawSavedText.replace(/\s+/g, '');
    // product(서비스 설명)가 있는데 저장 문서가 그 문제정의를 아직 반영 안 했으면 시드(product)로 재구성
    const prob = clean(sr.product?.problem).replace(/\s+/g, '').slice(0, 20);
    if (prob && savedText && !savedText.includes(prob)) return null;
    return shouldUseReadmeSeed(exp, saved) ? null : saved;
  }, [exp, sr.overviewDoc, sr.product]);

  // git 경험 편집 — 레거시 변환 항목도 첫 편집 시 동일 구조로 저장한다 (상단 '저장'으로 일괄 저장)
  const patchGitExp = (i, changes) => {
    const experiences = displayDevExps.map((e, ei) => (ei === i ? { ...e, ...changes } : e));
    onPatchSr({
      ...sr,
      gitAnalysis: {
        ...(sr.gitAnalysis || {}),
        ...(useLegacyExps ? { source: 'legacy' } : {}),
        experiences,
      },
    });
  };
  const deleteGitExp = (i) => {
    if (!window.confirm('이 문제 해결 항목을 삭제할까요?')) return;
    const experiences = displayDevExps.filter((_, ei) => ei !== i);
    onPatchSr({
      ...sr,
      gitAnalysis: {
        ...(sr.gitAnalysis || {}),
        ...(useLegacyExps ? { source: 'legacy' } : {}),
        experiences,
      },
    });
    setOpenProjects(prev => prev.filter(x => x !== i).map(x => (x > i ? x - 1 : x)));
  };

  const toggleProject = (i) => setOpenProjects(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  // ── 아키텍처 편집 — 진입 시 좌표 없는 노드를 자동배치 좌표로 시딩하고 캔버스 크기 고정 ──
  // 흐름 탭이 비어 있으면 시작 노드 2개를 깔아 바로 그릴 수 있게 한다.
  const flowStarter = { nodes: [{ id: 'f1', label: '시작', tech: '사용자 진입', tier: 0 }, { id: 'f2', label: '다음 단계', tech: '', tier: 1 }], edges: [{ from: 'f1', to: 'f2', label: '' }] };
  const enterEditDiagram = () => {
    const base = activeDiagram || (isFlow ? flowStarter : { nodes: [], edges: [] });
    const metrics = computeNodeMetrics(base.nodes);
    const autoPos = autoLayoutPositions(base.nodes, metrics);
    const seeded = base.nodes.map(n => {
      const m = metrics[n.id];
      const p = hasXY(n) ? { x: n.x, y: n.y } : (autoPos[n.id] || { x: PAD, y: PAD });
      return {
        ...n,
        x: Math.round(p.x), y: Math.round(p.y),
        w: Number.isFinite(n.w) ? n.w : Math.round(m.w),
        h: Number.isFinite(n.h) ? n.h : Math.round(m.h),
      };
    });
    let maxX = 0, maxY = 0;
    seeded.forEach(n => { maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h); });
    setEditCanvas({ w: Math.max(720, Math.ceil(maxX) + 90), h: Math.max(340, Math.ceil(maxY) + 90) });
    setDiagramDraft({ nodes: seeded, edges: (base.edges || []).map(e => ({ ...e })) });
    setEditDiagram(true);
  };
  const addNode = () => setDiagramDraft(d => ({
    ...d,
    nodes: [...d.nodes, { id: `n${Date.now().toString(36)}`, label: '새 컴포넌트', tech: '', tier: 0, x: 24, y: 24 }],
  }));
  const updateNodeById = (nodeId, patch) => setDiagramDraft(d => ({ ...d, nodes: d.nodes.map(n => (n.id === nodeId ? { ...n, ...patch } : n)) }));
  const removeNodeById = (nodeId) => setDiagramDraft(d => ({
    nodes: d.nodes.filter(n => n.id !== nodeId),
    edges: d.edges.filter(e => e.from !== nodeId && e.to !== nodeId),
  }));
  const connectNodes = (from, to) => setDiagramDraft(d => (
    from && to && from !== to && !d.edges.some(e => e.from === from && e.to === to)
      ? { ...d, edges: [...d.edges, { from, to, label: '' }] }
      : d
  ));
  const updateEdge = (i, patch) => setDiagramDraft(d => ({ ...d, edges: d.edges.map((e, ei) => (ei === i ? { ...e, ...patch } : e)) }));
  const removeEdge = (i) => setDiagramDraft(d => ({ ...d, edges: d.edges.filter((_, ei) => ei !== i) }));
  const saveDiagramEdit = () => {
    const cleanNodes = diagramDraft.nodes
      .map((n, i) => {
        const node = { id: String(n.id || `n${i}`).trim() || `n${i}`, label: String(n.label || '').trim(), tech: String(n.tech || '').trim(), tier: Number(n.tier) || 0 };
        if (Number.isFinite(n.x) && Number.isFinite(n.y)) { node.x = Math.round(n.x); node.y = Math.round(n.y); }
        if (Number.isFinite(n.w)) node.w = Math.round(n.w);
        if (Number.isFinite(n.h)) node.h = Math.round(n.h);
        return node;
      })
      .filter(n => n.label);
    const ids = new Set(cleanNodes.map(n => n.id));
    const cleanEdges = diagramDraft.edges
      .map(e => {
        const edge = { from: String(e.from || '').trim(), to: String(e.to || '').trim(), label: String(e.label || '').trim() };
        if (Number.isFinite(e.mx) && Number.isFinite(e.my)) { edge.mx = Math.round(e.mx); edge.my = Math.round(e.my); }
        return edge;
      })
      .filter(e => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
    const next = cleanNodes.length ? { nodes: cleanNodes, edges: cleanEdges } : null;
    // 현재 탭에 해당하는 다이어그램 필드에 저장 (개발 구조 ↔ 프로젝트 흐름)
    onPatchSr({ ...sr, [isFlow ? 'flowDiagram' : 'architectureDiagram']: next });
    setEditDiagram(false);
  };

  return (
    <>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-bluewood-900">개발 임팩트</h2>
        {hasGit ? (
          <button
            type="button"
            onClick={() => setConnectOpen(o => !o)}
            className="inline-flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-bluewood-300 transition-colors hover:text-primary-600"
          >
            <Github size={12} className="flex-shrink-0" /><span className="truncate">{repoName}</span><span className="flex-shrink-0">· 다시 분석</span>
          </button>
        ) : (
          <span className="text-[11.5px] font-semibold text-bluewood-300">
            {displayDevExps.length ? '기존 경험 변환 · GitHub 연결 가능' : 'GitHub 커밋 근거 기반'}
          </span>
        )}
      </div>

      <div className="border-t border-surface-200 pt-5">
          <div className="space-y-8">
            {connectOpen && (
              <GitConnectPanel expId={expId} sr={sr} onApplied={(next) => { onApplied(next); setConnectOpen(false); }} onCancel={() => setConnectOpen(false)} compact />
            )}

            {/* 프로젝트 소개 — 서사 문서 (맨 위) */}
            <div>
              <OverviewDoc
                value={overviewDocValue}
                seed={overviewSeed}
                onChange={(next) => onPatchSr({ ...sr, overviewDoc: next })}
              />
            </div>

            {/* 주요 성과 · 핵심 기능 — 깔끔한 표/칩 (서사와 분리) */}
            <ProductFacts
              exp={exp}
              onChange={(nextProduct) => onPatchSr({ ...sr, product: nextProduct })}
            />

            {(systemDiagram || flowDiagram || hasGit) && (
              <div>
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className={MICRO_LABEL}>아키텍처</h3>
                    {/* 탭 — 1) 개발 구조  2) 프로젝트 흐름 */}
                    <div className="inline-flex items-center gap-0.5 rounded-lg bg-surface-100 p-0.5">
                      {[{ k: 'system', label: '개발 구조' }, { k: 'flow', label: '프로젝트 흐름' }].map(t => (
                        <button
                          key={t.k}
                          type="button"
                          onClick={() => { setEditDiagram(false); setArchTab(t.k); }}
                          className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${archTab === t.k ? 'bg-white text-bluewood-900 shadow-sm' : 'text-bluewood-400 hover:text-bluewood-700'}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {editDiagram ? (
                    <span className="flex items-center gap-1.5">
                      <button type="button" onClick={addNode} className="rounded-md border border-dashed border-primary-300 px-2 py-0.5 text-[11px] font-semibold text-primary-600 hover:bg-primary-50 transition-colors">＋ 박스</button>
                      <button type="button" onClick={saveDiagramEdit} className="rounded-md bg-primary-600 px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-primary-700 transition-colors">완료</button>
                      <button type="button" onClick={() => setEditDiagram(false)} className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-bluewood-400 hover:bg-surface-100 transition-colors">취소</button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {!isFlow && !savedSystem && activeDiagram && <span className="text-[11px] text-bluewood-300">기술 스택 기반 자동 구성 · 편집으로 다듬어 주세요</span>}
                      {isFlow && !savedFlow && activeDiagram && <span className="text-[11px] text-bluewood-300">핵심 경험 기반 자동 구성 · 편집으로 다듬어 주세요</span>}
                      {activeDiagram && <button type="button" onClick={enterEditDiagram} className="text-[11.5px] font-semibold text-bluewood-300 hover:text-primary-600 transition-colors">{isFlow ? '흐름 편집' : '구조 편집'}</button>}
                    </span>
                  )}
                </div>
                {editDiagram ? (
                  <>
                    <ArchitectureEditorCanvas
                      nodes={diagramDraft.nodes}
                      edges={diagramDraft.edges}
                      canvas={editCanvas}
                      onMoveNode={(id, x, y) => updateNodeById(id, { x, y })}
                      onResizeNode={(id, patch) => updateNodeById(id, patch)}
                      onUpdateNode={updateNodeById}
                      onRemoveNode={removeNodeById}
                      onMoveEdge={(i, mx, my) => updateEdge(i, { mx, my })}
                      onUpdateEdge={updateEdge}
                      onRemoveEdge={removeEdge}
                      onConnect={connectNodes}
                    />
                    <p className="mt-1.5 text-[11px] text-bluewood-300">박스를 드래그해 배치하고, 파란 포트를 다른 박스로 끌어 연결하세요 · ‘완료’ 후 상단 저장으로 반영됩니다</p>
                  </>
                ) : activeDiagram ? (
                  <ArchitectureDiagram diagram={activeDiagram} />
                ) : (
                  /* 빈 상태 (주로 프로젝트 흐름) — 직접 그리기 유도 */
                  <button
                    type="button"
                    onClick={enterEditDiagram}
                    className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-surface-300 bg-surface-50/40 py-8 text-bluewood-400 transition-colors hover:border-primary-300 hover:text-primary-600"
                  >
                    <span className="text-[13px] font-bold">＋ {isFlow ? '프로젝트 흐름 그리기' : '아키텍처 그리기'}</span>
                    <span className="text-[11.5px]">{isFlow ? '사용자·데이터가 서비스를 어떻게 흐르는지 단계로 그려보세요' : '컴포넌트 박스를 놓고 연결해 구조를 표현하세요'}</span>
                  </button>
                )}
              </div>
            )}

            {displayDevExps.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <h3 className={MICRO_LABEL}>문제 해결 과정</h3>
                  <span className="text-[11.5px] font-semibold text-bluewood-300">{displayDevExps.length}건 · 눌러서 펼치기 · 눌러서 편집</span>
                </div>
                <div className="border-t border-surface-200">
                  {displayDevExps.map((e, i) => (
                    <GitProjectRow
                      key={i}
                      exp={e}
                      index={i}
                      open={openProjects.includes(i)}
                      onToggle={() => toggleProject(i)}
                      onPatch={(changes) => patchGitExp(i, changes)}
                      onDelete={() => deleteGitExp(i)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* GitHub 미연결 — README 아래에서 연결 유도 (연결하면 기여도·아키텍처·문제해결이 채워짐) */}
            {!hasGit && !connectOpen && (
              <GitConnectPanel expId={expId} sr={sr} onApplied={onApplied} />
            )}
          </div>
      </div>
    </>
  );
}

/* 2026-06-22 공통 직군 결과 화면 — 이후 추가된 직군별 문서와 분리해 당시 CASE STUDY 구성을 유지 */
function CommonLegacyDoc({
  id, exp, cs, KE_ROWS, saving, dirty,
  setField, setMeta, setKeyExp, addKeyExp, removeKeyExp,
  addKeyExpImage, setKeyExpImage, deleteKeyExpImage,
  handleSave, guardedNav,
}) {
  return (
    <>
      <div className="max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[12px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>CASE STUDY</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-[11.5px] font-semibold text-bluewood-400">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            회색으로 표시된 영역을 눌러 바로 편집할 수 있어요
          </span>
        </div>
        <AutoText prose value={cs.title} onChange={(v) => setField('title', v)} placeholder="경험 제목을 입력하세요" className="text-[30px] sm:text-[40px] font-black leading-[1.18] text-bluewood-900 tracking-tight" />
        <AutoText prose value={cs.summary} onChange={(v) => setField('summary', v)} placeholder="한 줄 요약 — 이 경험이 무엇이고 왜 중요한지" className="mt-4 text-[17px] sm:text-[19px] leading-[1.6] text-bluewood-500" />
        <div className="mt-7 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          {[{ k: 'role', label: '역할' }, { k: 'duration', label: '기간' }, { k: 'team', label: '팀 구성' }].map(m => (
            <div key={m.k} className="min-w-0">
              <p className="mb-0.5 text-[12px] font-bold text-bluewood-300">{m.label}</p>
              <AutoText value={cs.meta[m.k]} onChange={(v) => setMeta(m.k, v)} placeholder="—" className="text-[15px] font-semibold text-bluewood-700" />
            </div>
          ))}
        </div>
        {cs.tech.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {cs.tech.map((t, i) => <span key={i} className="rounded-md bg-surface-100 px-2.5 py-1 text-[12px] font-semibold text-bluewood-600">{t}</span>)}
          </div>
        )}
      </div>

      <div className="mt-10 grid grid-cols-1 items-start gap-x-10 gap-y-12 border-t border-surface-200 pt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:gap-x-16">
        <div className="min-w-0">
          <section>
            <h2 className="mb-3 text-[12.5px] font-black uppercase tracking-[0.16em] text-bluewood-400">내용</h2>
            <CaseBody body={cs.body} onChange={(next) => setField('body', next)} />
          </section>
          {(() => {
            const groups = deriveCompetencies(exp?.structuredResult, cs.skills);
            const active = COMP_GROUPS.filter(g => groups[g.key].length > 0);
            if (active.length === 0) return null;
            return (
              <section className="mt-10 border-t border-surface-200 pt-8">
                <h2 className="mb-5 text-[12.5px] font-black uppercase tracking-[0.16em] text-bluewood-400">핵심 역량</h2>
                <div className="space-y-5">
                  {active.map(g => (
                    <div key={g.key}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="text-[13.5px] font-bold text-bluewood-800">{g.label}</span>
                        <span className="text-[12px] text-bluewood-300">{g.desc}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {groups[g.key].map((s, i) => <span key={i} className="rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold" style={{ backgroundColor: `${g.color}14`, color: g.color }}>{s}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}
        </div>

        <aside className="order-first min-w-0 lg:order-none lg:border-l lg:border-surface-200 lg:pl-10 xl:pl-14">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-[16px] font-extrabold text-bluewood-900">핵심 경험</h2>
            {cs.keyExps.length > 0 && <span className="text-[12px] font-semibold text-bluewood-300">{cs.keyExps.length}건</span>}
          </div>
          <div className="divide-y divide-surface-100">
            {cs.keyExps.map((k, i) => (
              <div key={k.id} className="py-7 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[11px] font-black text-white" style={{ backgroundColor: ACCENT }}>{i + 1}</span>
                    <AutoText prose value={k.title} onChange={(v) => setKeyExp(k.id, 'title', v)} placeholder={`핵심 경험 ${i + 1}`} className="text-[20px] sm:text-[22px] font-extrabold leading-snug text-bluewood-900" />
                  </div>
                  <button type="button" onClick={() => removeKeyExp(k.id)} className="mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-bluewood-300 hover:bg-red-50 hover:text-red-500">삭제</button>
                </div>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="w-[56px] flex-shrink-0 pt-1.5 text-[13px] font-bold" style={{ color: ACCENT }}>성과</span>
                  <AutoText value={k.metric} onChange={(v) => setKeyExp(k.id, 'metric', v)} placeholder="성과·수치 (예: 누락률 32% 감소)" className="text-[16px] font-bold text-bluewood-900" />
                </div>
                <div className="mt-2 space-y-2.5">
                  {KE_ROWS.map(r => (
                    <div key={r.key} className="flex items-baseline gap-3">
                      <span className="w-[56px] flex-shrink-0 pt-1.5 text-[13px] font-bold text-bluewood-400">{r.label}</span>
                      <AutoText value={k[r.key]} onChange={(v) => setKeyExp(k.id, r.key, v)} placeholder={`${r.label} 입력`} className={`text-[15.5px] leading-[1.8] ${r.strong ? 'font-semibold text-bluewood-900' : 'text-bluewood-600'}`} />
                    </div>
                  ))}
                </div>
                {k.images.length > 0 && (
                  <div className="mt-4 flex flex-col gap-3">
                    {k.images.map(im => (
                      <ResizableFigure
                        key={im.id} src={im.url} width={im.width}
                        onWidth={(w) => setKeyExpImage(k.id, im.id, { width: w })}
                        onReplace={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setKeyExpImage(k.id, im.id, { url: await resizeToBase64(f) }); } catch { toast.error('사진 처리에 실패했어요.'); } }}
                        onDelete={() => deleteKeyExpImage(k.id, im.id)}
                      />
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => addKeyExpImage(k.id)} className="mt-3 rounded-md border border-surface-200 px-2.5 py-1 text-[11.5px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600">＋ 사진</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addKeyExp} className="mt-5 w-full rounded-lg border border-dashed border-surface-300 py-2.5 text-[13px] font-semibold text-bluewood-400 transition-colors hover:border-primary-300 hover:text-primary-600">＋ 핵심 경험 추가</button>
        </aside>
      </div>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-surface-200 pt-8">
        <button onClick={handleSave} disabled={saving || !dirty} className="rounded-xl bg-primary-600 px-5 py-3 text-[14px] font-bold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700 disabled:opacity-40">{saving ? '저장 중…' : '저장하기'}</button>
        <button onClick={() => guardedNav(`/app/experience/structured/${id}`)} className="inline-flex items-center gap-1.5 rounded-xl border border-surface-200 bg-white px-5 py-3 text-[14px] font-bold text-bluewood-700 transition-colors hover:border-surface-300 hover:bg-surface-50">
          자세히 보기로 전환
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </button>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   기획/PM 전용 — "프로덕트 스펙 문서" 렌더링
   (개발자=GitHub 딥다이브, 마케터=캠페인 한 장 문서에 대응하는 PM 시그니처.
    공용 케이스 스터디 그리드를 쓰지 않고 문서 전체를 대체한다)
   레이아웃: 번호 섹션 문서(본문) + 우측 스펙 패널(Notion/Linear 속성 패널 문법)
   01 문제 정의 → 02 전략 → 03 의사결정 로그(채택/기각 비교 타임라인 + Impact×Effort)
   → 04 가설 및 검증 → 05 검증 스코어보드(PASS/MISS 도장) → 06 성과와 배움
   데이터: cs.keyExps(CARL) + sr.keyExperiences[i].jobData(가설·결정·대안·설득·검증·임팩트·리소스)
         + sr.jobSpecific(strategy·msc·businessImpact) + sr.product(problem·solution)
         + sr.portfolioVisuals(goals·kpis)
   ══════════════════════════════════════════════════════════ */

/* 문서 섹션 헤더 — 한글 제목 · 영문 라벨 · 헤어라인 + 리드 문장(desc: 이 섹션이 무엇을 증명하는지) */
function PmDocHeader({ en, ko, desc, right }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3">
        <h2 className="flex-shrink-0 text-[16px] font-extrabold tracking-tight text-bluewood-900">{ko}</h2>
        <span className="hidden flex-shrink-0 font-mono text-[9.5px] font-bold uppercase tracking-[0.22em] text-bluewood-300 sm:inline">{en}</span>
        <div className="h-px min-w-4 flex-1 self-center bg-surface-200" />
        {right}
      </div>
      {desc && <p className="mt-1.5 text-[12px] leading-[1.6] text-bluewood-400">{desc}</p>}
    </div>
  );
}

/* 원형 링 게이지 — MSC 달성률 */
function RingGauge({ pct, size = 92, label }) {
  const safe = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const sw = size < 72 ? 7 : 9;
  const R = (size - sw - 3) / 2;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="#eef1f5" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={R} fill="none" stroke={ACCENT} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${(safe / 100) * C} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black leading-none text-bluewood-900" style={{ fontSize: size < 72 ? 14 : 19 }}>{Math.round(safe)}%</span>
        {label && size >= 72 && <span className="mt-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.18em] text-bluewood-400">{label}</span>}
      </div>
    </div>
  );
}

/* Impact×Effort 사분면 라벨 — PriorityMatrix의 midpoint(3)와 동일 규칙 */
const quadrantOf = (impact, effort) => {
  if (!(impact >= 1 && effort >= 1)) return null;
  if (impact >= 3 && effort <= 3) return 'QUICK WIN';
  if (impact >= 3) return '전략 과제';
  if (effort <= 3) return '점진 개선';
  return '재검토';
};

/* PM 지표 추출용 섹션 키 — extractMetricTiles가 jobSpecific 본문에서 수치 구절을 뽑을 때 사용 */
const PM_METRIC_SECTIONS = [
  { key: 'strategy', label: '전략' },
  { key: 'msc', label: 'MSC' },
  { key: 'businessImpact', label: '임팩트' },
];

/* 긴 문단을 캔버스 불릿으로 정리한다.
   쉼표·가운뎃점·세미콜론은 문장 중간의 연결 표현일 수 있으므로 절대 자르지 않고,
   실제 줄바꿈 또는 문장 종결부호에서만 나눈다. 소수점(5.2)은 마침표로 오인하지 않는다. */
const CANVAS_META_TEXT = /(?:자소서|면접\s*(?:답변|질문).*재사용|사실\s*[·,/와과및]*\s*추정|추정\s*(?:여부|구분|표시)|기여\s*근거\s*검증|작성\s*(?:가이드|규칙|원칙)|경험정리\s*(?:방법|기준)|포트폴리오\s*문장\s*작성|검증\s*필요|확인\s*필요)/i;
const CANVAS_GENERIC_FRAGMENT = /^(?:성과|사실|수치|추정|검증|키워드|재사용|구조화|자동화|고도화|기타)$/;

function toBullets(text, max = 4) {
  const raw = clean(text);
  if (!raw) return [];
  const parts = raw.split(/\n+/).flatMap((line) => {
    const guarded = line.trim().replace(/(\d)\.(\d)/g, '$1￿$2');
    const sentences = guarded.match(/[^.!?。]+(?:[.!?。]+|$)/g) || [guarded];
    return sentences.map(s => s.replace(/￿/g, '.').trim().replace(/^[-–—•·]\s*/, '')).filter(Boolean);
  });
  const readable = parts.filter(s => s.length >= 3);
  const relevant = readable.filter((s) => {
    const normalized = s.replace(/[.!?。]$/, '').trim();
    if (CANVAS_GENERIC_FRAGMENT.test(normalized)) return false;
    // 긴 서비스 설명 안에 '자소서' 같은 단어가 포함됐다는 이유로 문장 전체를 없애지 않는다.
    // 메타 안내 자체가 독립된 짧은 항목으로 들어온 경우에만 제외한다.
    return !(s.length <= 70 && CANVAS_META_TEXT.test(s));
  });
  // 필터가 모든 내용을 제거해 캔버스가 비는 상황을 방지한다.
  return (relevant.length > 0 ? relevant : readable).slice(0, max);
}

/* ── 캔버스 셀 본문 — 평소엔 짧은 불릿으로 깔끔하게, 클릭하면 원문 그대로 편집.
   긴 문제/솔루션 문단도 캔버스에선 핵심 항목들로 정리돼 한눈에 읽힌다(데이터는 그대로 보존). ── */
function CanvasField({ value, onChange, placeholder, className = '', max = 4 }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <AutoText dense autoFocus value={value} onChange={onChange} onBlur={() => setEditing(false)} placeholder={placeholder} className={className} />
    );
  }
  const bullets = toBullets(value, max);
  const openEdit = () => setEditing(true);

  if (bullets.length === 0) {
    return (
      <div role="button" tabIndex={0} onClick={openEdit} onFocus={openEdit} className={`-ml-2 cursor-text rounded-md px-2 py-0.5 transition-colors hover:bg-surface-100/60 ${className}`}>
        <span className="text-bluewood-300">{placeholder}</span>
      </div>
    );
  }
  if (bullets.length === 1) {
    return (
      <div
        role="button" tabIndex={0} onClick={openEdit} onFocus={openEdit} title={bullets[0]}
        className={`-ml-2 cursor-text rounded-md px-2 py-0.5 transition-colors hover:bg-surface-100/60 ${className}`}
        style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {bullets[0]}
      </div>
    );
  }
  return (
    <ul role="button" tabIndex={0} onClick={openEdit} onFocus={openEdit} className={`-ml-2 cursor-text space-y-1 rounded-md px-2 py-0.5 transition-colors hover:bg-surface-100/60 ${className}`}>
      {bullets.map((b, i) => (
        <li key={i} className="flex gap-1.5" title={b}>
          <span className="mt-[6px] h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: ACCENT, opacity: 0.55 }} />
          <span className="min-w-0 flex-1 whitespace-pre-wrap" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{b}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── 린 캔버스 셀 — 라벨(한글+영문) + 편집 본문. 격자선은 부모 그리드의 gap-px 배경으로 그려짐 ── */
function CanvasCell({ label, en, className = '', children }) {
  return (
    <div className={`flex min-w-0 flex-col bg-[#fefefe] p-4 ${className}`}>
      <div className="mb-3 text-center">
        <p className="text-[13px] font-black tracking-tight text-[#3d5262]">{label}</p>
        {en && <span className="mt-0.5 block font-mono text-[7.5px] font-bold uppercase tracking-[0.12em] text-[#91a0ab]">{en}</span>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* ── 리너 캔버스 — 문제·가치·고객을 3열로 압축하고 핵심지표를 검증 데이터와 연결한다. ── */
function LeanCanvas({ product, patchProduct, canvas, patchCanvas, goals, kpis, onOpenData }) {
  const metricItems = [
    ...kpis.map(k => ({ label: clean(k.label), value: clean(k.value) })),
    ...goals.map(g => ({ label: clean(g.label), value: clean(g.actual) || clean(g.target) })),
  ].filter(m => m.label || m.value).filter((m, i, arr) => arr.findIndex(x => `${x.label}|${x.value}` === `${m.label}|${m.value}`) === i).slice(0, 3);
  const existingSolutions = clean(canvas.existingAlternatives) || clean(product.solution);
  const cellText = 'text-[12px] leading-[1.65] text-bluewood-600';
  return (
    <section>
      <div className="mb-4 bg-[#3d5262] px-5 py-3.5 text-center text-white">
        <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
          <h2 className="text-[21px] font-bold tracking-tight sm:text-[24px]">리너 캔버스</h2>
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">Leaner Canvas</span>
        </div>
        <p className="mt-1 text-[10.5px] leading-[1.5] text-white/65">문제, 차별화된 가치, 핵심 고객과 검증 지표를 한 장에 압축했습니다.</p>
      </div>
      <div className="grid border-[4px] border-[#3d5262] bg-[#3d5262] gap-[4px] sm:grid-cols-3">
        <div className="grid gap-[4px] bg-[#3d5262] sm:grid-rows-[minmax(190px,auto)_minmax(130px,auto)]">
          <CanvasCell label="문제" en="Problem" className="min-h-[150px] sm:min-h-0">
            <CanvasField value={clean(product.problem)} onChange={(v) => patchProduct('problem', v)} placeholder="핵심 고객이 반복해서 겪는 문제" max={4} className={`${cellText} font-medium text-bluewood-800`} />
          </CanvasCell>
          <CanvasCell label="기존 솔루션" en="Existing Alternatives" className="min-h-[110px] sm:min-h-0">
            <CanvasField value={existingSolutions} onChange={(v) => patchCanvas('existingAlternatives', v)} placeholder="고객이 현재 문제를 해결하는 방식" max={3} className={cellText} />
          </CanvasCell>
        </div>

        <div className="grid gap-[4px] bg-[#3d5262] sm:grid-rows-[minmax(190px,auto)_minmax(130px,auto)]">
          <CanvasCell label="고유 가치 제안" en="Unique Value Proposition" className="min-h-[150px] sm:min-h-0">
            <CanvasField value={clean(canvas.uvp)} onChange={(v) => patchCanvas('uvp', v)} placeholder="고객이 이 제품을 선택해야 하는 한 줄 이유" max={4} className={`${cellText} font-medium text-bluewood-800`} />
          </CanvasCell>
          <CanvasCell label="핵심지표" en="Key Metrics" className="min-h-[110px] sm:min-h-0">
            {metricItems.length > 0 ? (
              <ul className="space-y-1.5">
                {metricItems.map((m, i) => (
                  <li key={`${m.label}-${i}`} className="flex items-start justify-between gap-3 text-[11.5px] leading-[1.55]">
                    <span className="min-w-0 text-bluewood-500">{m.label || '검증 지표'}</span>
                    <span className="flex-shrink-0 font-black" style={{ color: ACCENT }}>{m.value || '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <button type="button" onClick={onOpenData} className="text-[11.5px] font-semibold text-primary-500 transition-colors hover:text-primary-700">＋ 지표 입력</button>
            )}
          </CanvasCell>
        </div>

        <div className="grid gap-[4px] bg-[#3d5262] sm:grid-rows-[minmax(190px,auto)_minmax(130px,auto)]">
          <CanvasCell label="고객 세그먼트" en="Customer Segments" className="min-h-[150px] sm:min-h-0">
            <CanvasField value={clean(canvas.customers)} onChange={(v) => patchCanvas('customers', v)} placeholder="가장 먼저 해결해야 할 핵심 고객군" max={4} className={cellText} />
          </CanvasCell>
          <CanvasCell label="얼리어답터" en="Early Adopters" className="min-h-[110px] sm:min-h-0">
            <CanvasField value={clean(canvas.earlyAdopters)} onChange={(v) => patchCanvas('earlyAdopters', v)} placeholder="문제가 가장 절실해 먼저 사용할 고객" max={3} className={cellText} />
          </CanvasCell>
        </div>
      </div>
      <p className="mt-2 text-[10.5px] text-bluewood-300 print:hidden">칸을 눌러 내용을 편집할 수 있으며, 핵심지표는 검증 데이터와 자동 연결됩니다.</p>
    </section>
  );
}

/* 타임라인 문장 — 평소에는 3줄로 정돈하고, 클릭할 때만 전체 편집창을 연다. */
function TimelineEditableText({ value, onChange, placeholder, className = '' }) {
  const [editing, setEditing] = useState(false);
  const display = clean(value);
  const firstSentence = toBullets(display || placeholder, 1)[0] || display || placeholder;
  if (editing) {
    return (
      <div className="relative z-20 mt-1.5 w-[230px] rounded-lg border border-primary-200 bg-white p-2 shadow-[0_12px_28px_rgba(0,30,70,0.18)]">
        <AutoText
          dense
          autoFocus
          value={value || ''}
          onChange={onChange}
          onBlur={() => setEditing(false)}
          placeholder={placeholder}
          className="text-[10.5px] leading-[1.55] text-bluewood-600"
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="클릭해서 편집"
      className={`group relative mt-1.5 block w-full rounded-md text-left outline-none transition-colors hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-primary-200 ${className}`}
    >
      <span
        className={`block whitespace-normal break-words px-1 py-0.5 text-[9.5px] leading-[1.5] ${display ? 'text-bluewood-500' : 'text-bluewood-300'}`}
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >{firstSentence}</span>
      <span className="absolute right-1 top-0 hidden text-[8px] font-bold text-primary-400 group-hover:inline print:hidden">편집</span>
    </button>
  );
}

const TIMELINE_ICONS = { search: Search, lightbulb: Lightbulb, flask: FlaskConical, branch: GitBranch, scale: Scale, wrench: Wrench, chart: BarChart3, target: Target };
const TIMELINE_ICON_OPTIONS = [
  ['search', '탐색'], ['lightbulb', '인사이트'], ['flask', '가설'], ['branch', '우선순위'],
  ['scale', '판단'], ['wrench', '실행'], ['chart', '검증'], ['target', '목표'],
];

/* ── 서비스 타임라인 — 내용뿐 아니라 단계·순서·아이콘·색상까지 편집한다. ── */
function PmServiceTimeline({ cs, sr, onPatchSr }) {
  const [editingLayout, setEditingLayout] = useState(false);
  const srKE = Array.isArray(sr?.keyExperiences) ? sr.keyExperiences : [];
  const jobData = srKE.map(k => k?.jobData || {});
  const product = sr?.product || {};
  const js = sr?.jobSpecific || {};
  const canvas = sr?.leanCanvas || {};
  const firstOf = (values) => values.map(clean).find(Boolean) || '';
  const learning = firstOf(cs.keyExps.map(k => k.learning));
  const defaults = [
    { phase: 'Discover', label: '문제 발견', iconKey: 'search', color: ACCENT, value: clean(product.problem), fallback: '반복되는 핵심 문제를 발견합니다.' },
    { phase: 'Insight', label: '고객 인사이트', iconKey: 'lightbulb', color: ACCENT, value: clean(canvas.customers) || firstOf(cs.keyExps.map(k => k.problem)), fallback: '문제가 가장 절실한 고객을 좁힙니다.' },
    { phase: 'Hypothesize', label: '가설 설정', iconKey: 'flask', color: ACCENT, value: firstOf(jobData.map(j => j.hypothesis)) || clean(product.solution), fallback: '검증 가능한 제품 가설을 세웁니다.' },
    { phase: 'Decide', label: '방향 결정', iconKey: 'scale', color: ACCENT, value: firstOf(jobData.map(j => j.decision)) || clean(js.strategy), fallback: '대안을 비교해 실행 방향을 정합니다.' },
    { phase: 'Validate', label: '검증', iconKey: 'chart', color: ACCENT, value: firstOf(jobData.map(j => j.validation)), fallback: '사용자 반응과 데이터로 확인합니다.' },
    { phase: 'Evolve', label: '결과와 배움', iconKey: 'target', color: ACCENT, value: firstOf(cs.keyExps.map(k => k.result)) || clean(js.businessImpact) || learning, fallback: '결과를 다음 제품 판단으로 연결합니다.' },
  ];
  const storedItems = Array.isArray(sr?.pmTimeline?.items) && sr.pmTimeline.items.length ? sr.pmTimeline.items : null;
  const items = (storedItems || defaults).slice(0, 8).map((item) => ({
    phase: String(item.phase || 'Stage'),
    label: String(item.label || '새 단계'),
    iconKey: TIMELINE_ICONS[item.iconKey] ? item.iconKey : 'target',
    color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : ACCENT,
    value: String(item.value || ''),
    fallback: String(item.fallback || '이 단계의 핵심 내용을 입력해 주세요.'),
  }));
  const timelineTitle = String(sr?.pmTimeline?.title || '서비스 타임라인');
  const timelineDescription = String(sr?.pmTimeline?.description || '문제 발견부터 검증과 배움까지, 제품이 발전한 핵심 흐름입니다.');
  const serializableItems = (next) => next.map(({ phase, label, iconKey, color, value, fallback }) => ({ phase, label, iconKey, color, value, fallback }));
  const persist = (changes = {}) => onPatchSr({
    ...sr,
    pmTimeline: {
      title: timelineTitle,
      description: timelineDescription,
      items: serializableItems(items),
      ...changes,
    },
  });
  const persistItems = (next) => persist({ items: serializableItems(next) });
  const patchItem = (index, changes) => persistItems(items.map((item, i) => i === index ? { ...item, ...changes } : item));
  const moveItem = (index, direction) => {
    const to = index + direction;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    persistItems(next);
  };
  const addItem = () => {
    if (items.length >= 8) return;
    persistItems([...items, { phase: 'New stage', label: '새 단계', iconKey: 'target', color: ACCENT, value: '', fallback: '이 단계의 핵심 내용을 입력해 주세요.' }]);
  };
  const resetTimeline = () => {
    const next = { ...sr };
    delete next.pmTimeline;
    onPatchSr(next);
  };
  const positions = [
    { left: '7%', nodeTop: 150, cardLeft: '2%', cardTop: 172 },
    { left: '25%', nodeTop: 80, cardLeft: '18%', cardTop: 102 },
    { left: '50%', nodeTop: 80, cardLeft: '43%', cardTop: 102 },
    { left: '75%', nodeTop: 80, cardLeft: '68%', cardTop: 102 },
    { left: '75%', nodeTop: 250, cardLeft: '68%', cardTop: 272 },
    { left: '50%', nodeTop: 250, cardLeft: '43%', cardTop: 272 },
    { left: '25%', nodeTop: 250, cardLeft: '18%', cardTop: 272 },
    { left: '10%', nodeTop: 250, cardLeft: '3%', cardTop: 272 },
  ];
  const slotSets = {
    1: [0], 2: [0, 4], 3: [0, 2, 5], 4: [0, 1, 3, 5],
    5: [0, 1, 2, 4, 6], 6: [0, 1, 2, 3, 4, 6], 7: [0, 1, 2, 3, 4, 5, 6], 8: [0, 1, 2, 3, 4, 5, 6, 7],
  };
  const activePositions = slotSets[items.length] || slotSets[8];
  const maxSummaryLength = Math.max(0, ...items.map((item) => {
    const summary = toBullets(clean(item.value) || item.fallback, 1)[0] || '';
    return summary.length;
  }));
  const desktopTimelineHeight = Math.max(400, 330 + Math.ceil(maxSummaryLength / 18) * 14);

  return (
    <section>
      <PmDocHeader
        en="Product Journey"
        ko="제품 여정"
        desc={timelineDescription}
        right={(
          <button
            type="button"
            onClick={() => setEditingLayout(v => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold transition-colors print:hidden ${editingLayout ? 'bg-primary-600 text-white' : 'bg-surface-100 text-bluewood-500 hover:bg-surface-200'}`}
          >
            <SlidersHorizontal size={12} />{editingLayout ? '편집 닫기' : '전체 편집'}
          </button>
        )}
      />

      {editingLayout && (
        <div className="mb-4 rounded-2xl border border-primary-100 bg-primary-50/35 p-4 print:hidden">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
              <input
                value={timelineTitle}
                onChange={e => persist({ title: e.target.value })}
                placeholder="타임라인 제목"
                className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-[12px] font-bold text-bluewood-800 outline-none focus:border-primary-300"
              />
              <AutoText
                dense
                value={timelineDescription}
                onChange={v => persist({ description: v })}
                placeholder="타임라인 설명"
                className="rounded-lg bg-white text-[11.5px] leading-[1.5] text-bluewood-500"
              />
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={resetTimeline} className="inline-flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-2.5 py-2 text-[10px] font-bold text-bluewood-400 hover:text-bluewood-700"><RotateCcw size={11} />자동 구성</button>
              <button type="button" onClick={addItem} disabled={items.length >= 8} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[10px] font-bold text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }}><Plus size={11} />단계 추가</button>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {items.map((item, i) => (
              <div key={`editor-${i}`} className="grid items-start gap-2 rounded-xl border border-surface-200 bg-white p-2.5 lg:grid-cols-[32px_105px_125px_minmax(180px,1fr)_72px]">
                <input type="color" value={item.color} onChange={e => patchItem(i, { color: e.target.value })} title="포인트 색상" className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                <select value={item.iconKey} onChange={e => patchItem(i, { iconKey: e.target.value })} className="h-8 rounded-md border border-surface-200 bg-white px-2 text-[10.5px] font-semibold text-bluewood-500 outline-none focus:border-primary-300">
                  {TIMELINE_ICON_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <div className="grid gap-1">
                  <input value={item.phase} onChange={e => patchItem(i, { phase: e.target.value })} placeholder="영문 라벨" className="rounded-md border border-surface-200 px-2 py-1 text-[9.5px] font-mono text-bluewood-400 outline-none focus:border-primary-300" />
                  <input value={item.label} onChange={e => patchItem(i, { label: e.target.value })} placeholder="단계 제목" className="rounded-md border border-surface-200 px-2 py-1 text-[11px] font-bold text-bluewood-800 outline-none focus:border-primary-300" />
                </div>
                <AutoText dense value={item.value} onChange={v => patchItem(i, { value: v })} placeholder={item.fallback} className="text-[11px] leading-[1.5] text-bluewood-600" />
                <div className="flex justify-end gap-1">
                  <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} title="앞으로" className="rounded-md p-1.5 text-bluewood-400 hover:bg-surface-100 disabled:opacity-25"><ChevronUp size={13} /></button>
                  <button type="button" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} title="뒤로" className="rounded-md p-1.5 text-bluewood-400 hover:bg-surface-100 disabled:opacity-25"><ChevronDown size={13} /></button>
                  <button type="button" onClick={() => persistItems(items.filter((_, idx) => idx !== i))} disabled={items.length <= 1} title="삭제" className="rounded-md p-1.5 text-bluewood-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-25"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative hidden overflow-hidden rounded-2xl border border-[#d8e4f0] bg-white xl:block" style={{ height: `${desktopTimelineHeight}px` }}>
        <svg className="absolute left-0 top-0 h-[400px] w-full" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 70 150 C 70 108, 105 80, 155 80 H 845 C 892 80, 915 108, 915 165 C 915 220, 886 250, 840 250 H 95" fill="none" stroke="#91a9c0" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        {items.map((item, i) => {
          const pos = positions[activePositions[i]];
          const Icon = TIMELINE_ICONS[item.iconKey] || Target;
          const number = String(i).padStart(2, '0');
          return (
            <div key={`${item.phase}-${i}`}>
              <span
                className={`absolute z-[2] flex items-center justify-center rounded-full text-[7.5px] font-black text-white ${i === 0 ? 'h-[22px] w-[42px] rounded-[11px]' : 'h-[22px] w-[22px]'}`}
                style={{ left: pos.left, top: pos.nodeTop, transform: 'translate(-50%, -50%)', backgroundColor: item.color }}
              >
                {number}
              </span>
              <div
                className="absolute z-[1] w-[190px]"
                style={{ left: pos.cardLeft, top: pos.cardTop }}
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={11} strokeWidth={1.7} style={{ color: item.color }} />
                  <p className="font-mono text-[7.5px] font-bold uppercase tracking-[0.1em] text-bluewood-300">{item.phase}</p>
                </div>
                <p className="mt-0.5 text-[10.5px] font-black leading-tight text-bluewood-900">{item.label}</p>
                <TimelineEditableText value={item.value} onChange={v => patchItem(i, { value: v })} placeholder={item.fallback} />
              </div>
            </div>
          );
        })}
      </div>

      <ol className="relative space-y-0 overflow-hidden rounded-2xl border border-[#d8e4f0] bg-white px-4 py-3 xl:hidden">
        <span className="absolute bottom-9 left-[27px] top-9 w-px bg-[#91a9c0]" />
        {items.map((item, i) => (
          <li key={`${item.phase}-${i}`} className="relative flex gap-3 py-3">
            <span className="relative z-[1] mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[7.5px] font-black text-white" style={{ backgroundColor: item.color }}>
              {String(i).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-bluewood-300">{item.phase}</p>
              <p className="text-[12px] font-extrabold text-bluewood-900">{item.label}</p>
              <TimelineEditableText value={item.value} onChange={v => patchItem(i, { value: v })} placeholder={item.fallback} className="max-w-xl" />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* 스티키 노트 — 화이트보드에 붙인 포스트잇 느낌 (AS-IS/TO-BE 항목) */
const STICKY_COLORS = ['#c4b5fd', '#5eead4', '#fca5a5', '#fde047', '#86efac', '#f9a8d4', '#93c5fd', '#fdba74'];
const STICKY_ROT = [-3, 2.2, -1.6, 3, -2.4, 1.4, -2.8, 2];
function StickyNote({ text, idx = 0, colorIdx }) {
  // colorIdx로 AS-IS↔TO-BE 짝 색을 맞추고, 회전은 idx로 달리해 복제처럼 보이지 않게 함
  const color = STICKY_COLORS[(colorIdx ?? idx) % STICKY_COLORS.length];
  const rot = STICKY_ROT[idx % STICKY_ROT.length];
  return (
    <div
      className="flex min-h-[104px] min-w-[150px] max-w-[260px] items-center justify-center rounded-[2px] px-4 py-4 shadow-[0_6px_14px_-5px_rgba(15,40,80,0.3)] transition-transform hover:z-[2] hover:scale-[1.03]"
      style={{ backgroundColor: color, transform: `rotate(${rot}deg)` }}
    >
      <p
        className="text-center text-[12.5px] font-bold leading-[1.55] text-[#1f2937]"
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {text}
      </p>
    </div>
  );
}

/* AS-IS → PM 개입 → TO-BE — 기능 나열보다 문제를 어떤 상태 변화로 설계했는지 보여준다. */
function PmAsIsToBe({ product, strategy, keyExperiences = [], caseExperiences = [], goals = [], kpis = [] }) {
  const asIs = toBullets(product?.problem, 3);
  const toBe = toBullets(product?.solution, 3);
  const decision = clean(strategy) || keyExperiences.map(k => clean(k?.jobData?.decision)).find(Boolean) || '';
  const matchingCase = (value) => caseExperiences.find(k => clean(k.metric) && clean(value) && clean(k.metric).includes(clean(value))) || {};
  const rawImpacts = [
    ...kpis.map(k => { const matched = matchingCase(k.value); return { label: clean(k.label), actual: clean(k.value), before: clean(matched.beforeMetric), target: clean(k.target) }; }),
    ...goals.map(g => { const matched = matchingCase(g.actual); return { label: clean(g.label), actual: clean(g.actual), before: clean(matched.beforeMetric), target: clean(g.target), achieved: g.achieved }; }),
    ...caseExperiences.map(k => ({ label: clean(k.title) || '핵심 변화', actual: clean(k.metric), before: clean(k.beforeMetric), target: '' })),
  ].filter(m => m.label && m.actual && parseMetricNum(m.actual) != null);
  const seenImpact = new Set();
  const impacts = rawImpacts.filter((m) => {
    const key = m.actual.replace(/[\s,()]/g, '');
    if (seenImpact.has(key)) return false;
    seenImpact.add(key);
    return true;
  }).slice(0, 3);
  if (!asIs.length && !toBe.length && !impacts.length) return null;
  const hasPanels = asIs.length > 0 || toBe.length > 0;
  const asRows = asIs.length ? asIs : ['현재 상태·문제를 입력해 주세요'];
  const toRows = toBe.length ? toBe : ['개선된 목표 상태를 입력해 주세요'];
  return (
    <section>
      <PmDocHeader en="Transformation" ko="AS-IS → TO-BE" desc="문제를 어떤 상태 변화로 설계했고, 실제로 어떤 결과를 만들었는지 보여줍니다." />
      <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
        {hasPanels && (
          <div className="relative p-4 sm:p-6">
            {/* 헤더 — 좌 AS-IS / 우 TO-BE */}
            <div className="grid grid-cols-2">
              <div className="pr-3 text-center sm:pr-8">
                <p className="text-[19px] font-black tracking-tight text-bluewood-500 sm:text-[22px]">AS-IS</p>
                <p className="mt-0.5 text-[10.5px] font-semibold text-bluewood-300">현재 · 문제 상태</p>
              </div>
              <div className="pl-3 text-center sm:pl-8">
                <p className="text-[19px] font-black tracking-tight sm:text-[22px]" style={{ color: ACCENT }}>TO-BE</p>
                <p className="mt-0.5 text-[10.5px] font-semibold text-bluewood-300">개선 · 목표 상태</p>
              </div>
            </div>
            {/* 화이트보드 — 상단 가로선 + 가운데 세로 구분선 + 컬러 스티키 노트 스캐터 */}
            <div className="relative mt-3 grid grid-cols-2 gap-x-2 border-t-2 border-bluewood-200 pt-6 sm:gap-x-6">
              <span className="pointer-events-none absolute -top-[2px] bottom-2 left-1/2 w-[2px] -translate-x-1/2 rounded bg-bluewood-200" />
              <div className="flex flex-wrap content-start justify-center gap-x-3 gap-y-4 pr-1 sm:pr-4">
                {asRows.map((t, i) => <StickyNote key={i} text={t} idx={i} />)}
              </div>
              <div className="flex flex-wrap content-start justify-center gap-x-3 gap-y-4 pl-1 sm:pl-4">
                {toRows.map((t, i) => <StickyNote key={i} text={t} idx={i + 3} colorIdx={i} />)}
              </div>
            </div>
            {decision && (
              <div className="mx-auto mt-5 flex max-w-2xl items-center justify-center gap-2 rounded-xl bg-primary-50/70 px-4 py-2.5 text-center">
                <span className="flex-shrink-0 font-mono text-[8.5px] font-black uppercase tracking-[0.12em] text-primary-400">PM 판단</span>
                <p className="text-[11px] font-semibold leading-[1.55] text-primary-800">{decision}</p>
              </div>
            )}
          </div>
        )}
        {impacts.length > 0 && (
          <div className="border-t border-surface-200 bg-surface-50/45 px-5 py-4 sm:px-6">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-[12.5px] font-extrabold text-bluewood-900">변화를 증명한 핵심 수치</h3>
              <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-bluewood-300">Measured impact</span>
            </div>
            <div className={`grid overflow-hidden rounded-xl border border-surface-200 bg-white ${impacts.length === 1 ? 'sm:grid-cols-1' : impacts.length === 2 ? 'sm:grid-cols-2 sm:divide-x' : 'sm:grid-cols-3 sm:divide-x'} divide-surface-200`}>
            {impacts.map((m, i) => {
              const split = splitMetricValue(m.actual);
              const actual = parseMetricNum(m.actual);
              const before = parseMetricNum(m.before);
              const target = parseMetricNum(m.target);
              const compareMax = Math.max(Math.abs(before || 0), Math.abs(actual || 0), Math.abs(target || 0), 1);
              const displayValue = split ? `${Number(split.value).toLocaleString()}${split.unit}` : m.actual;
              const actualWidth = target != null
                ? Math.min(100, Math.max(4, (Math.abs(actual) / Math.max(Math.abs(actual), Math.abs(target), 1)) * 100))
                : split?.unit === '%' ? Math.min(100, Math.max(4, Math.abs(actual))) : 100;
              return (
                <div key={`${m.label}-${i}`} className={`min-w-0 px-4 py-3.5 ${i > 0 ? 'border-t border-surface-200 sm:border-t-0' : ''}`}>
                  <p className="truncate text-[10.5px] font-bold text-bluewood-400" title={m.label}>{m.label}</p>
                  <p className="mt-1 text-[22px] font-black leading-none tracking-tight text-bluewood-900">{displayValue}</p>
                  {before != null && before !== actual ? (
                    <div className="mt-3 space-y-2">
                      {[
                        { label: '이전', value: before, text: m.before, color: '#cbd5e1' },
                        { label: '이후', value: actual, text: displayValue, color: ACCENT },
                      ].map(row => (
                        <div key={row.label}>
                          <div className="mb-1 flex justify-between text-[8.5px] font-bold text-bluewood-300">
                            <span>{row.label}</span><span className="text-bluewood-500">{row.text}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-surface-100"><span className="block h-full rounded-full" style={{ width: `${Math.max(4, (Math.abs(row.value) / compareMax) * 100)}%`, backgroundColor: row.color }} /></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-100">
                        <span className="block h-full rounded-full" style={{ width: `${actualWidth}%`, backgroundColor: ACCENT }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[8.5px] font-semibold text-bluewood-300">
                        <span>관측 결과</span><span>{m.target ? `목표 ${m.target}` : '실제 데이터'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── 검증 스코어보드 — MSC 기준별 목표→실제 진행 바 + PASS/MISS 도장 ── */
function MscScoreboard({ goals }) {
  if (!goals?.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-surface-200">
      {goals.map((g, i) => {
        const t = parseMetricNum(g.target);
        const a = parseMetricNum(g.actual);
        const pct = t != null && t !== 0 && a != null ? Math.round((a / Math.abs(t)) * 100) : null;
        const tone = g.achieved ? '#047857' : '#be123c';
        return (
          <div key={i} className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? 'border-t border-surface-100' : ''}`}>
            <span className="w-7 flex-shrink-0 font-mono text-[15px] font-black" style={{ color: g.achieved ? ACCENT : '#cbd5e1' }}>{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold leading-snug text-bluewood-900">{g.label}</p>
              {(g.target || g.actual) && (
                <p className="mt-0.5 text-[11.5px] text-bluewood-400">
                  목표 <span className="font-semibold text-bluewood-600">{g.target || '—'}</span>
                  <span className="mx-1.5 text-bluewood-300">→</span>
                  실제 <span className="font-black" style={{ color: tone }}>{g.actual || '—'}</span>
                  {pct != null && <span className="ml-2 text-bluewood-300">달성률 {pct}%</span>}
                </p>
              )}
              {pct != null && (
                <div className="mt-1.5 h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-surface-100">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, pct))}%`, backgroundColor: tone }} />
                </div>
              )}
            </div>
            <span
              className="flex-shrink-0 rounded border-2 px-2 py-0.5 font-mono text-[10.5px] font-black tracking-[0.14em]"
              style={{ transform: 'rotate(-6deg)', borderColor: tone, color: tone }}
            >{g.achieved ? 'PASS' : 'MISS'}</span>
          </div>
        );
      })}
    </div>
  );
}

/* PM 검증 지표 — 데이터 형태에 따라 전후 비교·목표 대비·비율 게이지·단일 관측 플롯을 자동 선택 */
function PmEvidenceMetrics({ kpis = [], keyExperiences = [] }) {
  if (!kpis.length) return null;
  const items = kpis.slice(0, 6).map((k) => {
    const split = splitMetricValue(k.value);
    const actual = parseMetricNum(k.value);
    const matched = keyExperiences.find((ke) => {
      const metric = clean(ke.metric);
      return metric && (metric.includes(clean(k.value)) || metric.includes(clean(k.label)));
    }) || {};
    const beforeText = clean(matched.beforeMetric);
    const before = parseMetricNum(beforeText);
    const target = parseMetricNum(k.target);
    return { ...k, split, actual, before, beforeText, target, unit: split?.unit || '' };
  });
  const unitMax = items.reduce((acc, item) => {
    if (item.actual == null) return acc;
    const key = item.unit || 'number';
    acc[key] = Math.max(acc[key] || 0, Math.abs(item.actual));
    return acc;
  }, {});
  const unitCounts = items.reduce((acc, item) => {
    const key = item.unit || 'number';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const lineGroups = Object.entries(items.reduce((acc, item) => {
    if (item.actual == null || !item.unit) return acc;
    (acc[item.unit] ||= []).push(item);
    return acc;
  }, {})).filter(([, group]) => group.length >= 2);

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-extrabold text-bluewood-800">검증 지표</p>
          <p className="mt-0.5 text-[10.5px] text-bluewood-300">가설을 채택하거나 수정할 때 사용한 실제 관측값</p>
        </div>
        <span className="flex-shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-bluewood-300">Evidence metrics</span>
      </div>
      <div className={`grid gap-4 ${items.length === 1 ? 'grid-cols-1 sm:grid-cols-2' : items.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
        {items.map((item, i) => {
          const isPercent = item.unit === '%' && item.actual != null && item.actual >= 0 && item.actual <= 100 && !/증가|감소|상승|하락|개선/.test(String(item.value));
          const hasBefore = item.before != null && item.actual != null && item.before !== item.actual;
          const hasTarget = !hasBefore && item.target != null && item.actual != null;
          const chartMax = hasTarget ? (Math.max(Math.abs(item.target), Math.abs(item.actual)) || 1) : (unitMax[item.unit || 'number'] || 1);
          const comparable = unitCounts[item.unit || 'number'] > 1;
          return (
            <div key={`${item.label}-${i}`} className="print-break-avoid relative min-h-[245px] overflow-hidden rounded-2xl border border-surface-200 bg-white p-5 shadow-[0_10px_30px_rgba(0,47,108,0.08)]">
              <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: ACCENT }} />
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-[13px] font-extrabold leading-snug text-bluewood-800">{item.label}</p>
                <span className="flex-shrink-0 rounded bg-surface-100 px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase text-bluewood-300">{hasBefore ? 'Before / After' : hasTarget ? 'Target / Actual' : isPercent ? 'Rate' : 'Observed'}</span>
              </div>

              {hasBefore || hasTarget ? (
                <div className="mt-4 h-[150px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart
                      layout="vertical"
                      data={hasBefore ? [
                        { name: '이전', value: Math.abs(item.before), display: item.beforeText, fill: ACCENT_LIGHT },
                        { name: '이후', value: Math.abs(item.actual), display: item.value, fill: ACCENT },
                      ] : [
                        { name: '목표', value: Math.abs(item.target), display: item.target != null ? String(item.target) : '', fill: '#cbd5e1' },
                        { name: '관측', value: Math.abs(item.actual), display: item.value, fill: ACCENT },
                      ]}
                      margin={{ top: 8, right: 16, left: 0, bottom: 2 }}
                      barCategoryGap="30%"
                    >
                      <CartesianGrid stroke="#eef2f7" horizontal={false} />
                      <XAxis type="number" domain={[0, chartMax]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={34} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,47,108,0.04)' }} formatter={(_, __, ctx) => [ctx.payload.display, item.label]} />
                      <Bar dataKey="value" radius={[0, 7, 7, 0]}>
                        {(hasBefore ? [ACCENT_LIGHT, ACCENT] : ['#cbd5e1', ACCENT]).map((fill, ci) => <Cell key={ci} fill={fill} />)}
                      </Bar>
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              ) : isPercent ? (
                <div className="relative mt-2 h-[170px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={[{ value: item.actual }, { value: Math.max(0, 100 - item.actual) }]} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={68} startAngle={90} endAngle={-270} stroke="none">
                        <Cell fill={ACCENT} /><Cell fill="#e9eef5" />
                      </Pie>
                    </RePieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[28px] font-black leading-none tracking-tight" style={{ color: ACCENT }}>{item.split.value}<span className="text-[14px]">%</span></p>
                    <p className="mt-1 font-mono text-[8.5px] font-bold uppercase tracking-wider text-bluewood-300">Observed rate</p>
                  </div>
                </div>
              ) : item.split && item.actual != null ? (
                <div className="mt-4">
                  <p className="text-[30px] font-black leading-none tracking-tight text-bluewood-900">
                    {Number(item.split.value).toLocaleString()}<span className="ml-0.5 text-[13px] font-bold text-bluewood-400">{item.unit}</span>
                  </p>
                  <div className="mt-2 h-[120px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReBarChart data={[{ name: item.label, value: Math.abs(item.actual) }]} margin={{ top: 8, right: 20, left: 6, bottom: 0 }}>
                        <CartesianGrid stroke="#eef2f7" vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={false} axisLine={{ stroke: '#dbe3ed' }} tickLine={false} />
                        <YAxis domain={[0, chartMax]} width={34} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={() => [item.value, item.label]} />
                        <Bar dataKey="value" fill={ACCENT} radius={[8, 8, 0, 0]} maxBarSize={72} />
                      </ReBarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="-mt-1 text-center font-mono text-[8.5px] font-bold uppercase tracking-wider text-bluewood-300">{comparable ? '동일 단위 기준' : '0부터 관측값까지'}</p>
                </div>
              ) : (
                <p className="mt-4 text-[14px] font-bold leading-snug text-bluewood-800">{item.value}</p>
              )}
              {item.note && <p className="mt-3 border-t border-surface-100 pt-2 text-[10.5px] leading-[1.5] text-bluewood-400">{item.note}</p>}
            </div>
          );
        })}
      </div>
      {lineGroups.map(([unit, group]) => (
        <div key={unit} className="print-break-avoid mt-4 overflow-hidden rounded-2xl border border-surface-200 bg-gradient-to-br from-white to-surface-50 p-5 shadow-[0_12px_34px_rgba(0,47,108,0.08)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[13px] font-extrabold text-bluewood-800">동일 단위 지표 비교</p>
              <p className="mt-0.5 text-[10.5px] text-bluewood-300">{unit} 단위의 검증 신호를 한 축에서 비교합니다.</p>
            </div>
            <span className="font-mono text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: ACCENT }}>Signal line</span>
          </div>
          <div className="mt-3 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ReLineChart data={group.map(g => ({ name: g.label, value: g.actual, display: g.value }))} margin={{ top: 14, right: 24, left: 0, bottom: 20 }}>
                <CartesianGrid stroke="#e7edf4" strokeDasharray="4 4" />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis width={42} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(_, __, ctx) => [ctx.payload.display, ctx.payload.name]} />
                <Line type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={4} dot={{ r: 6, fill: '#fff', stroke: ACCENT, strokeWidth: 3 }} activeDot={{ r: 8 }} />
              </ReLineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}

/* 핵심 경험과 분리해 직접 설계·편집할 수 있는 PM 가설 검증표 */
function PmValidationDashboard({ cs, sr, srKE, materialHypotheses, onPatchSr }) {
  const compactCell = (value) => clean(value).replace(/\s+/g, ' ').trim();
  // 각 행은 해당 경험 자체에서만 뽑아 정확하게 채운다 (goals/kpis 인덱스 짝맞춤은 어긋나므로 사용하지 않음)
  const fallbackRows = cs.keyExps.map((experience, index) => {
    const src = srKE[index] || {};
    const jobData = src.jobData || {};
    // 지표 라벨이 "이름 (목표 수치)" 형태면 KPI 이름과 목표를 분리 — 목표 수치는 목표 열로 보낸다
    const kpiRaw = clean(src.metricLabel);
    const kpiMatch = kpiRaw.match(/^(.+?)\s*[（(]\s*(.+?)\s*[）)]\s*$/);
    return {
      // 가설 = 실제 가설 속성만 사용. 실행·성과 중심의 경험 제목은 가설로 대체하지 않는다.
      hypothesis: clean(jobData.hypothesis),
      // 핵심 KPI = 지표 이름만 (목표 수치는 목표 열로)
      kpi: kpiMatch ? kpiMatch[1].trim() : kpiRaw,
      // 설정 근거 = 이 KPI를 왜/어떻게 판단 기준으로 삼았는지 (검증 방법·기준)
      kpiRationale: clean(jobData.validation),
      // 목표 = KPI 라벨 괄호 안 목표 수치 (예: CSAT 4점+)
      target: kpiMatch ? kpiMatch[2].trim() : '',
      // 달성 = 이 경험의 실제 달성 수치만 (긴 서술 금지)
      achievement: clean(experience.metric) || clean(src.afterMetric),
      note: clean(jobData.note) || clean(jobData.failureReason),
    };
  }).filter(row => row.hypothesis || row.kpi || row.kpiRationale || row.target || row.achievement || row.note);

  const storedRows = Array.isArray(sr?.pmHypotheses) ? sr.pmHypotheses : [];
  const extractedHypotheses = Array.isArray(materialHypotheses) ? materialHypotheses : [];
  const sourceRows = sr?.pmHypothesesSource === 'manual' && storedRows.length
    ? storedRows
    : extractedHypotheses.length
      // 원본의 H1… 가설을 우선하고, 같은 행의 KPI·목표·달성 데이터는 기존 표에서 유지한다.
      ? extractedHypotheses.map((hypothesis, index) => ({
          ...(fallbackRows[index] || {}),
          ...(storedRows[index] || {}),
          hypothesis,
        }))
      : storedRows.length
        ? storedRows
        : fallbackRows.length
          ? fallbackRows
          : [{ hypothesis: '', kpi: '', kpiRationale: '', target: '', achievement: '', note: '' }];
  const rows = sourceRows.slice(0, 12).map(row => {
    // 달성은 짧은 수치만 — 실수로 긴 서술이 들어와 있으면 비고로 옮겨 표를 깔끔하게 유지
    const rawAchievement = compactCell(row?.achievement) || compactCell(row?.actual);
    const achievementIsProse = rawAchievement.length > 30;
    const rawNote = compactCell(row?.note) || compactCell(row?.failureReason);
    return {
      hypothesis: compactCell(row?.hypothesis),
      kpi: compactCell(row?.kpi),
      kpiRationale: compactCell(row?.kpiRationale),
      target: compactCell(row?.target),
      achievement: achievementIsProse ? '' : rawAchievement,
      note: compactCell(rawNote || (achievementIsProse ? rawAchievement : '')),
    };
  });

  const persistRows = (nextRows) => onPatchSr({ ...sr, pmHypotheses: nextRows, pmHypothesesSource: 'manual' });
  const patchRow = (index, key, value) => {
    const nextRows = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row);
    persistRows(nextRows);
  };
  const addRow = () => {
    if (rows.length >= 12) return;
    persistRows([...rows, { hypothesis: '', kpi: '', kpiRationale: '', target: '', achievement: '', note: '' }]);
  };
  const removeRow = (index) => {
    if (rows.length <= 1) return;
    persistRows(rows.filter((_, rowIndex) => rowIndex !== index));
  };
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary-50 px-2 py-1 font-mono text-[8.5px] font-black uppercase tracking-[0.12em] text-primary-600">Hypothesis Design</span>
          <p className="text-[12px] font-extrabold text-bluewood-900">가설 검증 설계</p>
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= 12}
          className="flex items-center gap-1 rounded-lg border border-primary-100 bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 print:hidden"
        >
          <Plus size={13} /> 가설 추가
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white shadow-[0_3px_10px_rgba(0,47,108,0.05)]">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-left">
          <thead className="text-white" style={{ backgroundColor: '#0e1526' }}>
            <tr>
              <th className="w-12 px-4 py-3.5 font-mono text-[11px] font-black">#</th>
              <th className="px-4 py-3.5 text-[12px] font-bold">가설</th>
              <th className="w-[28%] px-4 py-3.5 text-[12px] font-bold">핵심 KPI / 설정 근거</th>
              <th className="w-[13%] px-4 py-3.5 text-right text-[12px] font-bold">목표</th>
              <th className="w-[12%] px-4 py-3.5 text-right text-[12px] font-bold">달성</th>
              <th className="w-[22%] px-4 py-3.5 text-[12px] font-bold">비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`hypothesis-${index}`} className="group/hy align-middle odd:bg-white even:bg-[#f6f8fb]">
                <td className="px-4 py-3.5 font-mono text-[13px] font-black text-emerald-500">H{index + 1}</td>
                <td className="px-4 py-2.5">
                  <AutoText
                    dense
                    value={row.hypothesis}
                    onChange={(value) => patchRow(index, 'hypothesis', value)}
                    placeholder="검증할 가설을 입력하세요"
                    className="text-[13px] font-bold leading-[1.5] text-bluewood-900"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <AutoText
                    dense
                    value={row.kpi}
                    onChange={(value) => patchRow(index, 'kpi', value)}
                    placeholder="판단에 사용할 핵심 KPI"
                    className="text-[12px] font-bold leading-[1.5] text-bluewood-700"
                  />
                  <AutoText
                    dense
                    value={row.kpiRationale}
                    onChange={(value) => patchRow(index, 'kpiRationale', value)}
                    placeholder="설정 근거 — 이 KPI로 판단한 이유"
                    className="mt-0.5 text-[11.5px] leading-[1.5] text-bluewood-500"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <AutoText
                    dense
                    value={row.target}
                    onChange={(value) => patchRow(index, 'target', value)}
                    placeholder="≥ 60%"
                    className="text-right text-[12.5px] font-black leading-[1.5] text-bluewood-900"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <AutoText
                    dense
                    value={row.achievement}
                    onChange={(value) => patchRow(index, 'achievement', value)}
                    placeholder="—"
                    className="text-right text-[12.5px] font-black leading-[1.5] text-primary-700"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-start gap-1.5">
                    <AutoText
                      dense
                      value={row.note}
                      onChange={(value) => patchRow(index, 'note', value)}
                      placeholder="성공 및 실패 해설"
                      className="min-w-0 flex-1 text-[11.5px] leading-[1.5] text-bluewood-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={rows.length <= 1}
                      className="mt-0.5 rounded-md p-1 text-bluewood-200 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover/hy:opacity-100 disabled:cursor-not-allowed disabled:opacity-0 print:hidden"
                      aria-label={`가설 H${index + 1} 삭제`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* 의사결정 카드의 단계 행 — 좌측 번호+라벨, 우측 내용 (체계적 기록 느낌). 모듈 레벨이라 자식 입력 포커스가 끊기지 않음 */
function DecisionStage({ no, label, tone, children }) {
  const c = tone === 'amber' ? '#b45309' : ACCENT;
  return (
    <div className="flex gap-3.5 py-3.5 first:pt-1 last:pb-1">
      <div className="w-[54px] flex-shrink-0 pt-0.5">
        <p className="font-mono text-[12px] font-black leading-none" style={{ color: c }}>{no}</p>
        <p className="mt-1 text-[10.5px] font-bold leading-[1.3] text-bluewood-400">{label}</p>
      </div>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </div>
  );
}
/* ── 의사결정 노드 — 번호 단계 기록: 01 상황 → 02 의사결정(채택/기각) → 03 어려움 돌파 → 04 결과 ── */
function DecisionNode({ k, jd, index, onCarl, onJobData, onDelete }) {
  const quad = quadrantOf(Number(jd.impact), Number(jd.effort));
  return (
      <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
        <div className="flex items-start gap-2.5 px-5 pt-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>Decision {String(index + 1).padStart(2, '0')}</p>
              {quad && (
                <span className="rounded px-1.5 py-0.5 font-mono text-[9.5px] font-black tracking-wide" style={{ backgroundColor: quad === 'QUICK WIN' ? 'rgba(4,120,87,0.1)' : 'rgba(0,47,108,0.07)', color: quad === 'QUICK WIN' ? '#047857' : ACCENT }}>{quad}</span>
              )}
            </div>
            <AutoText
              prose
              value={k.title}
              onChange={(v) => onCarl('title', v)}
              placeholder={`의사결정 ${index + 1} — 무엇을 하기로 했는지`}
              className="text-[15px] sm:text-[16px] font-extrabold leading-snug text-bluewood-900"
            />
          </div>
          <div className="w-28 flex-shrink-0 pt-4">
            <AutoText dense value={k.metric} onChange={(v) => onCarl('metric', v)} placeholder="성과 수치" className="text-right text-[12px] font-bold text-caribbean-700" />
          </div>
          <button type="button" onClick={onDelete} className="flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-bluewood-300 hover:bg-red-50 hover:text-red-500 print:hidden">삭제</button>
        </div>

        <div className="px-5 py-3">
          <div className="divide-y divide-surface-100">
            {/* 01 상황 */}
            <DecisionStage no="01" label="상황">
              <AutoText dense value={k.problem} onChange={(v) => onCarl('problem', v)} placeholder="어떤 문제 앞에서 판단이 필요했는지" className="text-[12.5px] leading-[1.65] text-bluewood-600" />
            </DecisionStage>

            {/* 02 의사결정 — 채택 vs 기각 (대안 비교가 곧 PM 판단력의 증거) */}
            <DecisionStage no="02" label="의사결정">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'rgba(0,47,108,0.05)', borderLeft: `2px solid ${ACCENT}` }}>
                  <p className="text-[9px] font-black tracking-wide" style={{ color: ACCENT }}>✓ 채택</p>
                  <AutoText dense value={jd.decision || ''} onChange={(v) => onJobData({ decision: v })} placeholder="선택한 방향과 판단 기준" className="mt-0.5 text-[12.5px] font-bold leading-[1.6] text-bluewood-900" />
                </div>
                <div className="rounded-lg bg-surface-50 px-3 py-2.5">
                  <p className="text-[9px] font-black tracking-wide text-bluewood-400">✕ 기각</p>
                  <AutoText dense value={jd.alternatives || ''} onChange={(v) => onJobData({ alternatives: v })} placeholder="검토한 대안과 기각 이유" className="mt-0.5 text-[12px] leading-[1.6] text-bluewood-500" />
                </div>
              </div>
            </DecisionStage>

            {/* 03 어려움 돌파 — 난관과 돌파 방법 (PM의 문제해결력) */}
            <DecisionStage no="03" label="어려움 돌파" tone="amber">
              <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
                <div>
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">부딪힌 난관</p>
                  <AutoText dense value={jd.obstacle || ''} onChange={(v) => onJobData({ obstacle: v })} placeholder="가장 막혔던 지점·제약" className="text-[12px] leading-[1.6] text-bluewood-600" />
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: ACCENT }}>돌파 방법</p>
                  <AutoText dense value={jd.resolution || ''} onChange={(v) => onJobData({ resolution: v })} placeholder="어떻게 풀어냈는지" className="text-[12px] font-semibold leading-[1.6] text-bluewood-800" />
                </div>
              </div>
            </DecisionStage>

            {/* 04 결과 */}
            <DecisionStage no="04" label="결과">
              <AutoText dense value={k.result} onChange={(v) => onCarl('result', v)} placeholder="결정이 만든 지표·비즈니스 변화" className="text-[12.5px] font-semibold leading-[1.6] text-bluewood-900" />
            </DecisionStage>
          </div>
        </div>
      </div>
  );
}

/* 산출물 파일·링크 아이콘 — 랜딩페이지와 동일한 브랜드 SVG를 재사용 */
const fileExtOf = (name) => String(name || '').split('.').pop().toLowerCase();
const DELIVERABLE_TYPES = {
  pdf: { label: 'PDF', icon: '/brand-icons/pdf.svg' },
  ppt: { label: 'PowerPoint', icon: '/brand-icons/powerpoint.svg?v=2' },
  pptx: { label: 'PowerPoint', icon: '/brand-icons/powerpoint.svg?v=2' },
  key: { label: 'Keynote', short: 'K', color: '#7c3aed' },
  hwp: { label: '한글', icon: '/brand-icons/hwp.svg' },
  hwpx: { label: '한글', icon: '/brand-icons/hwp.svg' },
  doc: { label: 'Word', icon: '/brand-icons/word.svg' },
  docx: { label: 'Word', icon: '/brand-icons/word.svg' },
  xls: { label: 'Excel', icon: '/brand-icons/excel.svg' },
  xlsx: { label: 'Excel', icon: '/brand-icons/excel.svg' },
  txt: { label: 'Text', short: 'TXT', color: '#64748b' },
  zip: { label: 'ZIP', short: 'ZIP', color: '#475569' },
};
const DELIVERABLE_LINK_TYPES = [
  { label: 'KakaoTalk', icon: '/brand-icons/kakaotalk.svg', test: /(^|\.)kakao\.com$|(^|\.)kakaocorp\.com$/i },
  { label: 'Notion', icon: '/brand-icons/notion.svg', test: /(^|\.)notion\.so$|(^|\.)notion\.site$/i },
  { label: 'Google Docs', icon: '/brand-icons/google-docs.svg', test: /(^|\.)docs\.google\.com$/i },
  { label: 'Google Drive', icon: '/brand-icons/google-drive.svg', test: /(^|\.)drive\.google\.com$/i },
  { label: 'Gmail', icon: '/brand-icons/gmail.svg', test: /(^|\.)gmail\.com$|(^|\.)mail\.google\.com$/i },
  { label: 'Slack', icon: '/brand-icons/slack.svg', test: /(^|\.)slack\.com$/i },
  { label: 'Discord', icon: '/brand-icons/discord.svg', bg: '#5865F2', test: /(^|\.)discord\.com$|(^|\.)discord\.gg$/i },
  { label: 'Figma', icon: '/brand-icons/figma.svg', test: /(^|\.)figma\.com$/i },
  { label: 'GitHub', icon: '/brand-icons/github.svg', bg: '#181717', test: /(^|\.)github\.com$/i },
];

const deliverableVisual = (item) => {
  const ext = item?.ext || fileExtOf(item?.name);
  if (DELIVERABLE_TYPES[ext]) return DELIVERABLE_TYPES[ext];
  try {
    const parsed = new URL(item?.url || '');
    const matched = DELIVERABLE_LINK_TYPES.find(type => type.test.test(parsed.hostname));
    if (matched) return matched;
    const urlExt = fileExtOf(parsed.pathname);
    if (DELIVERABLE_TYPES[urlExt]) return DELIVERABLE_TYPES[urlExt];
    return { label: parsed.hostname.replace(/^www\./, '') || '링크', isLink: true };
  } catch {
    return { label: '파일', short: 'FILE', color: '#546e7a' };
  }
};

const normalizeDeliverableUrl = (value) => {
  const trimmed = String(value || '').trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

/* ── 프로젝트 산출물 — 실제 제작 파일(PDF·PPT·HWP)을 올리면 인사담당자가 클릭해 열람 ── */
function PmDeliverables({ files, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const inputRef = useRef(null);
  const list = Array.isArray(files) ? files : [];

  const onPick = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;
    setUploading(true);
    const added = [];
    for (const f of picked) {
      try {
        const { url, name, size } = await uploadDocumentFile(f);
        added.push({ id: uid(), kind: 'file', name, url, ext: fileExtOf(name), size });
      } catch (err) {
        toast.error(err?.response?.data?.error || `'${f.name}' 업로드에 실패했어요`);
      }
    }
    if (added.length) onChange([...list, ...added]);
    setUploading(false);
  };
  const remove = (id) => onChange(list.filter(f => f.id !== id));
  const addLink = (e) => {
    e.preventDefault();
    const url = normalizeDeliverableUrl(linkInput);
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
      const visual = deliverableVisual({ url });
      onChange([...list, {
        id: uid(),
        kind: 'link',
        name: visual.label || parsed.hostname.replace(/^www\./, ''),
        url,
      }]);
      setLinkInput('');
    } catch {
      toast.error('올바른 웹 링크를 입력해 주세요');
    }
  };

  return (
    <div className="mt-4 border-t border-surface-200 pt-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <p className="text-[10.5px] font-black uppercase tracking-[0.14em] text-bluewood-400">프로젝트 산출물</p>
        {list.length > 0 && <span className="text-[10.5px] text-bluewood-300">눌러서 열기</span>}
      </div>
      <input ref={inputRef} type="file" multiple accept=".pdf,.ppt,.pptx,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.key,.txt,.zip" className="hidden" onChange={onPick} />

      {list.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-x-2.5 gap-y-4">
          {list.map(f => {
            const visual = deliverableVisual(f);
            return (
              <div key={f.id} className="group/f relative flex min-w-0 flex-col items-center gap-1.5">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-[90px] w-[90px] items-center justify-center overflow-hidden rounded-[22px] border border-surface-200 bg-white shadow-[0_5px_15px_rgba(0,47,108,0.11)] transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
                  style={visual.bg ? { backgroundColor: visual.bg } : undefined}
                  title={`${f.name || visual.label} 열기`}
                >
                  {visual.icon ? (
                    <img src={visual.icon} alt={visual.label} className="h-[54px] w-[54px] object-contain" loading="lazy" decoding="async" />
                  ) : visual.isLink ? (
                    <Link2 size={38} className="text-primary-600" />
                  ) : (
                    <span className="flex h-[60px] w-[60px] items-center justify-center rounded-2xl text-white" style={{ backgroundColor: visual.color }}>
                      <span className={`font-black tracking-tight ${visual.short?.length > 1 ? 'text-[12px]' : 'text-[24px]'}`}>{visual.short}</span>
                    </span>
                  )}
                  <span className="sr-only">{f.name || visual.label}</span>
                </a>
                <span className="block w-full truncate text-center text-[10px] font-semibold leading-tight text-bluewood-500" title={f.name || visual.label}>
                  {f.name || visual.label}
                </span>
                <button type="button" onClick={() => remove(f.id)} className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full border border-surface-200 bg-white text-bluewood-300 opacity-0 shadow-sm transition hover:text-red-500 group-hover/f:opacity-100 print:hidden" aria-label="삭제">
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-surface-300 py-2.5 text-[12px] font-semibold text-bluewood-400 transition-colors hover:border-primary-300 hover:text-primary-600 disabled:opacity-50 print:hidden"
      >
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
        {uploading ? '올리는 중…' : '파일 추가'}
      </button>

      <form onSubmit={addLink} className="mt-2 flex items-center gap-1.5 print:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-surface-200 bg-white px-2.5 focus-within:border-primary-300">
          <Link2 size={13} className="flex-shrink-0 text-bluewood-300" />
          <input
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="Notion · Figma · Drive 링크"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[11px] text-bluewood-700 outline-none placeholder:text-bluewood-200"
          />
        </div>
        <button
          type="submit"
          disabled={!linkInput.trim()}
          className="flex-shrink-0 rounded-xl bg-primary-600 px-3 py-2.5 text-[10.5px] font-bold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-35"
        >
          추가
        </button>
      </form>
    </div>
  );
}

/* ── 좌측 레일 — 제목 · 요약 · 역할/기간/팀 + 프로젝트 산출물 파일 ── */
function PmHeroRail({ cs, sr, setField, setMeta, onPatchSr }) {
  return (
    <div className="lg:pr-2">
      <AutoText
        prose
        value={cs.title}
        onChange={(v) => setField('title', v)}
        placeholder="프로덕트/기획 케이스 제목"
        className="text-[22px] sm:text-[26px] font-black leading-[1.22] tracking-tight text-bluewood-900"
      />
      <AutoText
        prose
        value={cs.summary}
        onChange={(v) => setField('summary', v)}
        placeholder="이 프로젝트를 한 문장으로"
        className="mt-2 text-[13.5px] leading-[1.55] text-bluewood-500"
      />

      {/* 메타 — 역할·기간·팀 */}
      <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 border-t border-surface-200 pt-4">
        {[{ k: 'role', label: '역할' }, { k: 'duration', label: '기간' }, { k: 'team', label: '팀 구성' }].map(m => (
          <div key={m.k} className="min-w-0">
            <p className="mb-0.5 text-[10.5px] font-bold uppercase tracking-wide text-bluewood-300">{m.label}</p>
            <AutoText value={cs.meta[m.k]} onChange={(v) => setMeta(m.k, v)} placeholder="—" className="text-[12.5px] font-semibold text-bluewood-700" />
          </div>
        ))}
      </div>

      {/* 프로젝트 산출물 — 인사담당자가 원하면 열어보는 실제 제작 파일 */}
      <PmDeliverables files={sr?.pmFiles} onChange={(next) => onPatchSr({ ...sr, pmFiles: next })} />
    </div>
  );
}

/* ── PM 기획 문서 본문 — 좌측 제품 판단 프로필 + 우측(린 캔버스 · 의사결정 · 가설 및 검증) ── */
function PmDoc({ exp, cs, sr, setField, setMeta, setKeyExp, addKeyExp, removeKeyExp, onPatchSr }) {
  const [editData, setEditData] = useState(false);
  const [activeDecision, setActiveDecision] = useState(0); // 의사결정 로그: 번호 탭으로 한 건씩 전환

  const srKE = Array.isArray(sr?.keyExperiences) ? sr.keyExperiences : [];
  const js = sr?.jobSpecific || {};
  const product = sr?.product || {};
  const canvas = sr?.leanCanvas || {};
  const materialHypotheses = useMemo(() => extractNumberedPmHypotheses(exp), [exp]);
  // 핵심 경험 지표·jobSpecific 본문에서 KPI를 자동 추출(폴백) — 원본에 내용이 있으면 그래프가 채워진다.
  const visuals = normalizePortfolioVisuals(sr, { keyExperiences: srKE, jobSections: PM_METRIC_SECTIONS });
  const goals = visuals.goals || [];
  const kpis = visuals.kpis || [];
  const hasLeanCanvasContent = [
    product.problem, product.solution, canvas.existingAlternatives, canvas.uvp,
    canvas.customers, canvas.earlyAdopters, canvas.channels, canvas.costStructure, canvas.revenueStreams,
  ].some(value => clean(value)) || goals.length > 0 || kpis.length > 0;

  // 차트 편집기 시드 — 저장된 portfolioVisuals.kpis가 비어 있으면 자동 추출한 KPI를 미리 채워 보여준다.
  const seededVisuals = useMemo(() => {
    const pv = { ...(sr?.portfolioVisuals || {}) };
    if (!(Array.isArray(pv.kpis) && pv.kpis.length) && kpis.length) {
      pv.kpis = kpis.map(k => ({ label: k.label, value: k.value, target: k.target || '' }));
    }
    return pv;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sr?.portfolioVisuals, JSON.stringify(kpis)]);

  const patchJobSpecific = (key, v) => onPatchSr({ ...sr, jobSpecific: { ...(sr?.jobSpecific || {}), [key]: v } });
  const patchProduct = (key, v) => onPatchSr({ ...sr, product: { ...(sr?.product || {}), [key]: v } });
  // 린 캔버스 전용 블록(고유가치·경쟁우위·채널·고객군·비용·수익)은 sr.leanCanvas에 저장
  const patchCanvas = (key, v) => onPatchSr({ ...sr, leanCanvas: { ...(sr?.leanCanvas || {}), [key]: v } });
  // 의사결정 전용 필드(decision·alternatives·stakeholders·validation·impact·effort)는
  // structuredResult.keyExperiences[i].jobData에 저장 — cs.keyExps와 순서(index) 기준 대응 (저장 merge와 동일 규칙)
  const patchJobData = (i, changes) => {
    const ke = [...srKE];
    ke[i] = { ...(ke[i] || {}), jobData: { ...(ke[i]?.jobData || {}), ...changes } };
    onPatchSr({ ...sr, keyExperiences: ke });
  };
  const removeDecision = (i, keId) => {
    if (!window.confirm('이 의사결정을 삭제할까요?')) return;
    removeKeyExp(keId);
    if (srKE.length > i) onPatchSr({ ...sr, keyExperiences: srKE.filter((_, ei) => ei !== i) });
    setActiveDecision(a => Math.max(0, Math.min(a, cs.keyExps.length - 2)));
  };
  // 새 의사결정 추가 후 그 탭으로 이동 (추가 전 길이 = 새 항목의 인덱스)
  const addDecision = () => { setActiveDecision(cs.keyExps.length); addKeyExp(); };
  const activeIdx = cs.keyExps.length ? Math.min(activeDecision, cs.keyExps.length - 1) : 0;

  // Impact × Effort 좌표가 있는 의사결정만 매트릭스에 배치
  const matrixItems = cs.keyExps.map((k, i) => {
    const jd = srKE[i]?.jobData || {};
    const impact = Number(jd.impact), effort = Number(jd.effort);
    if (!(impact >= 1 && impact <= 5 && effort >= 1 && effort <= 5)) return null;
    return { n: i + 1, label: clean(k.title) || `의사결정 ${i + 1}`, impact, effort };
  }).filter(Boolean);

  return (
    <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] lg:gap-10">
      {/* ════ 좌측 — PM의 문제 프레이밍·판단 원칙·근거·오너십을 보여주는 제품 판단 프로필 ════ */}
      <PmHeroRail cs={cs} sr={sr} setField={setField} setMeta={setMeta} onPatchSr={onPatchSr} />

      {/* ════ 우측 — 린 캔버스 · 의사결정 로그 · 가설 및 검증 ════ */}
      <div className="min-w-0 space-y-9">
      {/* 기획 사이클 스트립 — 이 문서의 읽는 순서이자 일하는 방식 */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-b border-surface-100 pb-3">
        {[['Define', '문제 정의'], ['Hypothesize', '가설 수립'], ['Test', '검증'], ['Decide', '판단']].map(([en2, ko2], i) => (
          <span key={en2} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[10px] text-bluewood-200">→</span>}
            <span className="font-mono text-[9.5px] font-black uppercase tracking-[0.14em]" style={{ color: ACCENT }}>{en2}</span>
            <span className="text-[10.5px] font-semibold text-bluewood-400">{ko2}</span>
          </span>
        ))}
      </div>
      {editData && (
        <div className="print:hidden">
          <VisualDataEditor
            jobCategory="pm"
            value={seededVisuals}
            accent={ACCENT}
            onChange={(pv) => onPatchSr({ ...sr, portfolioVisuals: pv })}
          />
        </div>
      )}

      {/* ── 기획 캔버스 — 한 장 요약 (표준 9블록 린 캔버스) ── */}
      {hasLeanCanvasContent && (
        <LeanCanvas
          product={product}
          patchProduct={patchProduct}
          canvas={canvas}
          patchCanvas={patchCanvas}
          goals={goals}
          kpis={kpis}
          onOpenData={() => setEditData(true)}
        />
      )}

      <PmServiceTimeline cs={cs} sr={sr} onPatchSr={onPatchSr} />

      <PmAsIsToBe product={product} strategy={js.strategy} keyExperiences={srKE} caseExperiences={cs.keyExps} goals={goals} kpis={kpis} />

      {/* ── 의사결정 & 어려움 해결 — 화면: 번호 탭으로 한 건씩 / 인쇄: 전건 펼침 ── */}
      <section className={cs.keyExps.length === 0 ? 'print:hidden' : ''}>
        <PmDocHeader
          en="Decision & Problem-Solving" ko="의사결정 & 어려움 해결"
          desc="무엇을 채택하고 어떤 대안을 왜 버렸는지, 그리고 실행 중 부딪힌 난관을 어떻게 돌파했는지까지 한 흐름으로 담습니다."
          right={cs.keyExps.length > 0 ? <span className="flex-shrink-0 text-[11.5px] font-semibold text-bluewood-300">{cs.keyExps.length}건</span> : null}
        />
        {matrixItems.length > 0 && <div className="mb-3"><PriorityMatrix items={matrixItems} accent={ACCENT} /></div>}

        {cs.keyExps.length > 0 ? (
          <>
            {/* 번호 탭 — 누르면 해당 의사결정으로 전환 (아래로 쌓이지 않음, 인쇄 시 숨김) */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5 print:hidden">
              {cs.keyExps.map((k, i) => {
                const jd = srKE[i]?.jobData || {};
                const q = quadrantOf(Number(jd.impact), Number(jd.effort));
                const on = i === activeIdx;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setActiveDecision(i)}
                    title={clean(k.title) || `의사결정 ${i + 1}`}
                    className={`flex h-8 min-w-[32px] items-center justify-center gap-1 rounded-lg px-2 text-[12.5px] font-black transition-colors ${on ? 'text-white shadow-sm' : 'bg-surface-100 text-bluewood-500 hover:bg-surface-200'}`}
                    style={on ? { backgroundColor: ACCENT } : undefined}
                  >
                    {i + 1}
                    {q === 'QUICK WIN' && <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-white/80' : ''}`} style={on ? undefined : { backgroundColor: '#047857' }} />}
                  </button>
                );
              })}
              <button type="button" onClick={addDecision} className="flex h-8 items-center gap-1 rounded-lg border border-dashed border-surface-300 px-2.5 text-[12px] font-semibold text-bluewood-400 transition-colors hover:border-primary-300 hover:text-primary-600">＋ 추가</button>
            </div>

            {/* 화면에선 활성 카드 한 건만, PDF/인쇄에선 전건 펼침 */}
            <div className="print:space-y-5">
              {cs.keyExps.map((k, i) => (
                <div key={k.id} className={i === activeIdx ? '' : 'hidden print:block'}>
                  <DecisionNode
                    k={k}
                    jd={srKE[i]?.jobData || {}}
                    index={i}
                    onCarl={(key, v) => setKeyExp(k.id, key, v)}
                    onJobData={(changes) => patchJobData(i, changes)}
                    onDelete={() => removeDecision(i, k.id)}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <button type="button" onClick={addDecision} className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-surface-300 bg-surface-50/40 py-8 text-bluewood-400 transition-colors hover:border-primary-300 hover:text-primary-600 print:hidden">
            <span className="text-[13px] font-bold">＋ 첫 의사결정 기록하기</span>
            <span className="text-[11.5px]">채택/기각 대안과 임팩트·리소스를 남기면 우선순위 매트릭스가 그려져요</span>
          </button>
        )}
      </section>

      {/* ── 가설 및 검증 — 문제에서 배움까지 PM의 사고 과정을 포트폴리오로 제시 ── */}
      <section>
        <PmDocHeader
          en="Hypothesis & Validation" ko="가설 및 검증"
          desc="가설별 핵심 KPI·설정 근거·목표·달성·비고를 한 장의 표로 설계합니다."
        />
        <div className="space-y-3">
          <PmValidationDashboard
            cs={cs}
            sr={sr}
            srKE={srKE}
            materialHypotheses={materialHypotheses}
            onPatchSr={onPatchSr}
          />
          {(clean(js.msc) || clean(js.businessImpact)) && (
            <details className="rounded-xl border border-surface-200 bg-surface-50/50 print:hidden">
              <summary className="cursor-pointer px-4 py-2.5 text-[10.5px] font-bold text-bluewood-400">검증 해석 메모 보기</summary>
              <div className="grid gap-3 border-t border-surface-100 p-3 sm:grid-cols-2">
                <AutoText dense value={clean(js.msc)} onChange={(v) => patchJobSpecific('msc', v)} placeholder="성공 기준과 미달 원인" className="text-[11px] leading-[1.5] text-bluewood-600" />
                <AutoText dense value={clean(js.businessImpact)} onChange={(v) => patchJobSpecific('businessImpact', v)} placeholder="지표 변화와 다음 판단" className="text-[11px] leading-[1.5] text-bluewood-600" />
              </div>
            </details>
          )}
        </div>
      </section>

      {/* ── 첨부 — 자유 본문/사진 (내용 없으면 인쇄에서 제외) ── */}
      <section className={`border-t border-surface-200 pt-7 ${cs.body.some(s => (s.type === 'image' ? s.content : String(s.content || '').trim())) ? '' : 'print:hidden'}`}>
        <PmDocHeader en="Appendix" ko="첨부 · 부가 설명" desc="화면 캡처·기획서 발췌 등 이 케이스를 뒷받침하는 증거 자료입니다." />
        <CaseBody body={cs.body} onChange={(next) => setField('body', next)} />
      </section>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   마케터 전용 — 포트폴리오 한 페이지(문서/PDF) 형태 렌더링
   레퍼런스: 키커(영문 라벨) + 헤드라인 + 서브카피 + 세로 라인 카드 + 그래프
   ══════════════════════════════════════════════════════════ */

const emptyKit = () => ({
  positioningReport: { recommendedPositions: [], strengths: [], weaknesses: [], recommendation: '', priorityFixes: [] },
  experienceCards: [],
  portfolioDraft: { pages: [], projects: [] },
  resumeVariants: [],
  coverLetter: { mappings: [], drafts: [], warning: '' },
  interviewScripts: { answers: [] },
  actionPlan: [],
  positioning: '',
  funnel: { problem: '', goal: '', target: '', strategy: '', execution: '', result: '', insight: '' },
  kpis: [], altMetrics: [], resumeBullets: [], jdKeywords: [], evidenceChecklist: [],
});

const keepText = (v) => String(v ?? '').replace(/\*\*/g, '').replace(/^#+\s/gm, '').trim();
const arrText = (a) => (Array.isArray(a) ? a.map(keepText).filter(Boolean) : []);
const arrObj = (a, mapper) => (Array.isArray(a) ? a.map(mapper).filter(Boolean) : []);

function normalizePositioningReport(report = {}, legacy = {}) {
  return {
    recommendedPositions: arrObj(report.recommendedPositions, (p) => ({
      name: keepText(p?.name),
      score: Number.isFinite(Number(p?.score)) ? Math.max(0, Math.min(100, Number(p.score))) : null,
      reason: keepText(p?.reason),
    })).filter(p => p.name),
    strengths: arrText(report.strengths),
    weaknesses: arrText(report.weaknesses),
    recommendation: keepText(report.recommendation || legacy.positioning),
    priorityFixes: arrText(report.priorityFixes),
  };
}

function normalizeExperienceCards(cards = []) {
  return arrObj(cards, (card, index) => ({
    id: keepText(card?.id) || `EXP-${String(index + 1).padStart(3, '0')}`,
    title: keepText(card?.title),
    experienceType: keepText(card?.experienceType),
    period: keepText(card?.period),
    oneLineSummary: keepText(card?.oneLineSummary),
    problem: keepText(card?.problem),
    goal: keepText(card?.goal),
    role: arrText(card?.role),
    tools: arrText(card?.tools),
    execution: arrText(card?.execution),
    results: arrText(card?.results),
    evidence: arrText(card?.evidence),
    portfolioFit: keepText(card?.portfolioFit),
    resumeFit: keepText(card?.resumeFit),
    coverLetterUses: arrText(card?.coverLetterUses),
  })).filter(card => card.title || card.oneLineSummary || card.problem);
}

function normalizePortfolioDraft(draft = {}) {
  return {
    pages: arrObj(draft.pages, (page) => ({
      page: keepText(page?.page),
      title: keepText(page?.title),
      copy: keepText(page?.copy),
      visuals: arrText(page?.visuals),
      revisionNote: keepText(page?.revisionNote),
    })).filter(page => page.title || page.copy),
    projects: arrObj(draft.projects, (project) => ({
      title: keepText(project?.title),
      slides: arrObj(project?.slides, (slide) => ({
        title: keepText(slide?.title),
        purpose: keepText(slide?.purpose),
        role: keepText(slide?.role),
        keyResult: keepText(slide?.keyResult),
        images: arrText(slide?.images),
        problem: keepText(slide?.problem),
        hypothesis: keepText(slide?.hypothesis),
        strategy: arrText(slide?.strategy),
        result: keepText(slide?.result),
        insight: keepText(slide?.insight),
        nextImprovement: keepText(slide?.nextImprovement),
      })).filter(slide => slide.title || slide.purpose || slide.problem || slide.result),
    })).filter(project => project.title || project.slides.length),
  };
}

function normalizeCoverLetter(cover = {}) {
  return {
    mappings: arrObj(cover.mappings, (item) => ({
      questionType: keepText(item?.questionType),
      fit: keepText(item?.fit),
      reason: keepText(item?.reason),
    })).filter(item => item.questionType || item.reason),
    drafts: arrObj(cover.drafts, (item) => ({
      questionType: keepText(item?.questionType),
      text: keepText(item?.text),
    })).filter(item => item.questionType || item.text),
    warning: keepText(cover.warning),
  };
}

function normalizeInterviewScripts(scripts = {}) {
  return {
    answers: arrObj(scripts.answers || scripts.questions, (item) => ({
      question: keepText(item?.question),
      answer30: keepText(item?.answer30),
      answer60: keepText(item?.answer60),
      answer180: keepText(item?.answer180),
      followUps: arrText(item?.followUps),
      defense: keepText(item?.defense),
    })).filter(item => item.question || item.answer30 || item.answer60 || item.answer180),
  };
}

function normalizeActionPlan(plan = []) {
  return arrObj(plan, (item, index) => ({
    priority: keepText(item?.priority) || String(index + 1),
    action: keepText(item?.action),
    why: keepText(item?.why),
    how: keepText(item?.how),
    evidenceToCollect: arrText(item?.evidenceToCollect),
  })).filter(item => item.action || item.why || item.how);
}

function setPathValue(obj, path, value) {
  const root = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  let cursor = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const nextKey = path[i + 1];
    const current = cursor[key];
    const next = Array.isArray(current)
      ? [...current]
      : (current && typeof current === 'object' ? { ...current } : (typeof nextKey === 'number' ? [] : {}));
    cursor[key] = next;
    cursor = next;
  }
  cursor[path[path.length - 1]] = value;
  return root;
}

function getPathValue(obj, path) {
  return path.reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/* structuredResult.marketerKit → 편집 가능한 형태로 정규화 */
function normalizeKit(mk) {
  if (!mk || typeof mk !== 'object') return null;
  const base = emptyKit();
  const f = mk.funnel || {};
  Object.keys(base.funnel).forEach(k => { base.funnel[k] = keepText(f[k]); });
  base.positioning = keepText(mk.positioning);
  base.positioningReport = normalizePositioningReport(mk.positioningReport, mk);
  base.experienceCards = normalizeExperienceCards(mk.experienceCards);
  base.portfolioDraft = normalizePortfolioDraft(mk.portfolioDraft);
  base.resumeVariants = arrObj(mk.resumeVariants, (item, index) => ({
    label: keepText(item?.label) || `${index + 1}안`,
    sentence: keepText(item?.sentence || item?.text),
  })).filter(item => item.sentence);
  base.coverLetter = normalizeCoverLetter(mk.coverLetter);
  base.interviewScripts = normalizeInterviewScripts(mk.interviewScripts);
  base.actionPlan = normalizeActionPlan(mk.actionPlan);
  base.kpis = (Array.isArray(mk.kpis) ? mk.kpis : [])
    .map(k => ({ name: String(k?.name || '').trim(), value: String(k?.value || '').trim(), status: String(k?.status || '').trim() }))
    .filter(k => k.name);
  base.altMetrics = arrText(mk.altMetrics);
  base.resumeBullets = arrText(mk.resumeBullets);
  base.jdKeywords = arrText(mk.jdKeywords);
  base.evidenceChecklist = arrText(mk.evidenceChecklist);
  if (base.resumeVariants.length === 0 && base.resumeBullets.length > 0) {
    base.resumeVariants = base.resumeBullets.map((sentence, index) => ({ label: `${index + 1}안`, sentence }));
  }
  if (base.positioningReport.recommendation && !base.positioning) base.positioning = base.positioningReport.recommendation;
  return base;
}

/* 도넛 — 비율(0~100%) 지표용. 값은 잉크색 텍스트, 링은 브랜드 단일 색 */
function DonutChart({ pct, valueText, unit }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative h-[76px] w-[76px] flex-shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="#e8eef6" strokeWidth="9" />
        <circle
          cx="38" cy="38" r={r} fill="none" stroke={ACCENT} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[15px] font-extrabold leading-none text-bluewood-900">
          {valueText}<span className="text-[10px] font-bold text-bluewood-400">{unit}</span>
        </span>
      </div>
    </div>
  );
}

/* 전/후 비교 가로 막대 — 한 색상 두 명암 + 값 직접 표기 */
function CompareBars({ beforeText, afterText, afterDisplay }) {
  const b = parseMetricNum(beforeText);
  const a = parseMetricNum(afterText);
  if (b == null || a == null) return null;
  const max = Math.max(Math.abs(b), Math.abs(a)) || 1;
  const rows = [
    { label: '이전', val: b, text: String(beforeText), color: ACCENT_LIGHT, cls: 'font-bold text-bluewood-500' },
    { label: '이후', val: a, text: afterDisplay, color: ACCENT, cls: 'font-black text-bluewood-900' },
  ];
  return (
    <div className="w-full space-y-1.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-6 flex-shrink-0 text-[10px] font-bold text-bluewood-400">{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eef2f8]">
            <span className="block h-full rounded-full" style={{ width: `${(Math.abs(r.val) / max) * 100}%`, backgroundColor: r.color, transition: 'width 0.6s' }} />
          </div>
          <span className={`w-16 flex-shrink-0 text-right text-[11px] tabular-nums ${r.cls}`}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

/* 지표 성격에 맞는 그래프 자동 선택 — 전/후 비교막대 > 비율 도넛 > 큰 숫자 스탯 */
function MetricVisual({ metric, beforeMetric }) {
  const split = splitMetricValue(metric);
  const before = parseMetricNum(beforeMetric);
  const after = parseMetricNum(metric);
  if (before != null && after != null && before !== after) {
    return <CompareBars beforeText={String(beforeMetric)} afterText={String(metric)} afterDisplay={split ? `${split.value}${split.unit}` : String(metric)} />;
  }
  if (!split) return null;
  const num = parseFloat(split.value);
  // '35% 증가' 같은 변화량은 전체 대비 비율이 아니므로 도넛 대신 스탯 숫자로
  const isDelta = /증가|감소|상승|하락|단축|개선|절감|성장|초과/.test(String(metric));
  if (split.unit === '%' && !isDelta && num >= 0 && num <= 100) {
    return <DonutChart pct={num} valueText={split.value} unit="%" />;
  }
  return (
    <p className="text-[32px] font-black leading-none tracking-tight text-bluewood-900">
      {split.value}<span className="ml-0.5 text-[15px] font-bold text-bluewood-400">{split.unit}</span>
    </p>
  );
}

/* 섹션 헤더 — 볼드 영문 제목 + 오른쪽으로 뻗는 얇은 선 (레퍼런스: Background ───) */
function RuleHeader({ children }) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="flex-shrink-0 text-[20px] font-black tracking-tight text-bluewood-950 sm:text-[22px]">{children}</h2>
      <span className="h-px flex-1 bg-surface-200" />
    </div>
  );
}

/* KPI 카드 — 세로 중앙 정렬, 값과 중복되는 캡션은 감춤 (레퍼런스 차트 카드) */
function KpiTile({ label, metric, beforeMetric }) {
  const split = splitMetricValue(metric);
  const compactVal = split ? `${split.value}${split.unit}`.replace(/[\s,]/g, '') : '';
  const caption = split && String(metric).replace(/[\s,]/g, '') !== compactVal ? metric : '';
  return (
    <div className="print-break-avoid flex min-h-[150px] flex-col items-center justify-center rounded-2xl bg-white px-5 py-5 text-center shadow-[0_6px_24px_rgba(15,40,80,0.05)] print:border print:border-surface-200">
      <p className="clamp-2 text-[12px] font-semibold leading-snug text-bluewood-600">{label}</p>
      {split ? (
        <>
          <div className="mt-3 flex w-full justify-center"><MetricVisual metric={metric} beforeMetric={beforeMetric} /></div>
          {caption && <p className="mt-2 text-[10.5px] leading-snug text-bluewood-300">{caption}</p>}
        </>
      ) : (
        <p className="mt-2.5 text-[13px] font-extrabold leading-snug text-bluewood-900">{metric}</p>
      )}
    </div>
  );
}

/* 성과 문자열에서 지표 토큰을 모두 추출 (헤드라인 수치·전후 비교 판별용) */
function extractMetricTokens(text) {
  const re = /(-?\d[\d,]*(?:\.\d+)?)\s*(%|배|명|원|만원|억원|억|건|회|차|점|위|개|ms|초|분|시간|일|주|개월|년)?/g;
  const tokens = [];
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    tokens.push({ raw: m[0].trim(), value: parseFloat(m[1].replace(/,/g, '')), unit: m[2] || '', idx: m.index });
  }
  return tokens;
}
/* 결과 문장을 지표 시각화 형태로 해석 — 전/후 비교 > 헤드라인 단일 수치 */
function parseResultMetric(text) {
  const s = String(text || '');
  const tokens = extractMetricTokens(s);
  if (tokens.length === 0) return null;
  const hasTransition = /(에서|부터).*(으로|로|까지)|→|->|➜/.test(s);
  if (tokens.length >= 2 && hasTransition) {
    const [before, after] = tokens;
    const mult = tokens.find(t => t.unit === '배');
    return { kind: 'compare', before, after, badge: mult ? mult.raw : '' };
  }
  // 임팩트가 큰 단위 우선(배·%), 동점이면 뒤쪽(성과 결론부) 우선
  const score = (t) => (t.unit === '배' ? 3 : t.unit === '%' ? 3 : t.unit ? 1 : 0);
  let best = tokens[0];
  tokens.forEach(t => { if (score(t) >= score(best)) best = t; });
  return { kind: 'single', token: best };
}

/* 성과 KPI 타일 — 결과 문자열을 지표로 시각화하고, 수치 텍스트만 인라인 편집 */
function ResultStat({ text, onChange }) {
  const parsed = parseResultMetric(text);
  return (
    <div className="print-break-avoid flex min-h-[132px] flex-col justify-center rounded-2xl bg-white px-4 py-4 shadow-[0_6px_20px_-8px_rgba(15,40,80,0.16)] ring-1 ring-surface-200">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {parsed?.kind === 'compare' ? (
          <div className="w-full">
            {parsed.badge && (
              <p className="mb-2 text-[26px] font-black leading-none tracking-tight text-bluewood-900">
                {parsed.badge}<span className="ml-1 text-[13px] font-bold text-emerald-600">↑</span>
              </p>
            )}
            <CompareBars beforeText={parsed.before.raw} afterText={parsed.after.raw} afterDisplay={parsed.after.raw} />
          </div>
        ) : parsed?.kind === 'single' ? (
          <p className="text-[38px] font-black leading-none tracking-tight text-bluewood-900">
            {parsed.token.value.toLocaleString()}<span className="ml-0.5 text-[18px] font-bold text-bluewood-400">{parsed.token.unit}</span>
          </p>
        ) : (
          <p className="text-[16px] font-black leading-snug text-bluewood-900">{text}</p>
        )}
      </div>
      {onChange ? (
        <input
          value={text}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="mt-2.5 w-full rounded-md bg-transparent px-1 py-0.5 text-center text-[12.5px] font-semibold text-bluewood-500 outline-none transition-colors hover:bg-surface-50 focus:bg-surface-50 focus:ring-1 focus:ring-primary-200"
        />
      ) : (
        <p className="mt-2.5 text-center text-[12.5px] font-semibold leading-snug text-bluewood-500">{text}</p>
      )}
    </div>
  );
}

function clampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function MiniScoreBar({ label, score, tone = 'blue' }) {
  const value = clampScore(score);
  const color = tone === 'pink' ? '#db2777' : tone === 'green' ? '#059669' : ACCENT;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] font-bold text-bluewood-700">{label}</span>
        <span className="text-[11px] font-black tabular-nums" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-100">
        <span className="block h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function InsightPill({ children, tone = 'blue' }) {
  const style = tone === 'pink'
    ? 'bg-pink-50 text-pink-700 ring-pink-100'
    : tone === 'amber'
      ? 'bg-amber-50 text-amber-700 ring-amber-100'
      : tone === 'green'
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
        : 'bg-primary-50 text-primary-700 ring-primary-100';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[12.5px] font-bold leading-none ring-1 ${style}`}>
      {children}
    </span>
  );
}

function PositioningMap({ positions = [] }) {
  const top = positions.slice(0, 3);
  return (
    <div className="rounded-xl border border-surface-200/60 bg-gradient-to-br from-bluewood-950 to-bluewood-900 p-6 shadow-md relative overflow-hidden">
      <div className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/3 w-64 h-64 bg-primary-500/20 blur-3xl rounded-full pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-300">Positioning Target</p>
          <h3 className="mt-1 text-[18px] font-black text-white">최적의 마케터 포지션</h3>
        </div>
        <div className="flex -space-x-2">
          {top.map((pos, index) => (
            <div key={index} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-50 text-[10px] font-black text-bluewood-950 ring-2 ring-bluewood-900 shadow-sm" style={{ zIndex: 3 - index, opacity: 1 - index * 0.15 }}>
              {pos.score}%
            </div>
          ))}
        </div>
      </div>
      <div className="relative z-10 mt-6 grid gap-3">
        {top.map((pos, index) => (
          <div key={index} className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/20">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${index === 0 ? 'bg-primary-500 text-white' : 'bg-surface-100 text-bluewood-600'}`}>{index + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[14px] font-black text-white">{pos.name}</p>
            </div>
            <div className="text-right">
              <span className="text-[15px] font-black text-primary-300">{pos.score}</span>
              <span className="text-[10px] text-bluewood-300 ml-0.5">% Match</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualMetricStrip({ cards = [], kpis = [] }) {
  // 지표성(숫자) 성과만 노출 — 긴 서술형은 카드가 과밀해지므로 제외
  const metrics = [
    ...cards.flatMap(card => (card.results || []).map(r => ({ label: card.title, value: r }))),
    ...kpis.map(kpi => ({ label: kpi.name, value: kpi.value })),
  ].filter(item => item.value && !/확인 필요/.test(item.value) && splitMetricValue(item.value)).slice(0, 4);
  if (metrics.length === 0) return null;
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((item, index) => {
        const split = splitMetricValue(item.value);
        const caption = String(item.value).replace(/\s+/g, ' ').trim();
        return (
          <div key={`${item.label}-${index}`} className="flex flex-col rounded-xl border border-surface-200 bg-white px-4 py-4 shadow-sm">
            <p className="line-clamp-1 text-[12px] font-bold text-bluewood-400">{item.label}</p>
            <p className="mt-2 text-[32px] font-black leading-none tracking-tight text-bluewood-950">
              {split.value}<span className="ml-0.5 text-[16px] font-bold text-primary-600">{split.unit}</span>
            </p>
            {caption !== `${split.value}${split.unit}` && (
              <p className="mt-2 line-clamp-1 text-[12px] font-semibold text-bluewood-400">{caption}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* 스토리보드 섹션 라벨 — 영문 라벨 + 오른쪽으로 뻗는 얇은 선 (레퍼런스: Background ───) */
function StoryLabel({ children, action }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex-shrink-0 text-[18px] font-black tracking-tight text-bluewood-950">{children}</span>
      <span className="h-px flex-1 bg-surface-300" />
      {action}
    </div>
  );
}

/* 좌측 하단 서베이형 막대 — 회색 톤, 최대값 행만 강조 (레퍼런스: 좌측 하단 설문 차트) */
function SurveyBars({ bars = [] }) {
  if (bars.length === 0) return null;
  const max = Math.max(...bars.map(b => Math.abs(b.value) || 0), 1);
  const hi = bars.reduce((m, b, i) => (Math.abs(b.value) > Math.abs(bars[m].value) ? i : m), 0);
  return (
    <div className="space-y-3">
      {bars.map((b, i) => {
        const hot = i === hi;
        const w = Math.max(6, (Math.abs(b.value) / max) * 100);
        return (
          <div key={`${b.label}-${i}`} className="flex items-center gap-3">
            <span className={`w-[44%] flex-shrink-0 text-[12.5px] leading-[1.5] ${hot ? 'font-bold text-bluewood-800' : 'font-medium text-bluewood-400'}`} style={{ wordBreak: 'keep-all' }}>{b.label}</span>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="h-4 flex-shrink-0 rounded-[2px]" style={{ width: `${Math.round(w * 0.72)}%`, backgroundColor: hot ? '#8ba3c7' : '#e3e9f2' }} />
              <span className={`flex-shrink-0 text-[13.5px] tabular-nums ${hot ? 'font-black text-bluewood-900' : 'font-semibold text-bluewood-400'}`}>{b.value}{b.unit || ''}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* 꺾은선 차트 — 점 위 값 라벨 + 축 라벨, 최대값 포인트 강조 (레퍼런스: 연령별 지출액 라인 차트) */
function ResearchLine({ bars = [], unit = '', accent = ACCENT }) {
  const W = 300; const H = 138; const PX = 36; const PT = 28; const PB = 30;
  const vals = bars.map(b => b.value);
  const min = Math.min(...vals); const max = Math.max(...vals);
  const range = max - min || 1;
  const hi = vals.indexOf(max);
  const pts = bars.map((b, i) => ({
    ...b,
    x: PX + (i * (W - PX * 2)) / Math.max(bars.length - 1, 1),
    y: PT + (1 - (b.value - min) / range) * (H - PT - PB),
  }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="추이 차트">
      {[0, 0.5, 1].map(t => {
        const y = PT + t * (H - PT - PB);
        return <line key={t} x1={PX - 12} x2={W - PX + 12} y1={y} y2={y} stroke="#eceff5" strokeWidth="1" />;
      })}
      <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          {i === hi ? (
            <>
              <rect x={p.x - 17} y={p.y - 24} width="34" height="15" rx="7.5" fill={accent} />
              <text x={p.x} y={p.y - 13} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#ffffff">{p.value}{unit}</text>
            </>
          ) : (
            <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8">{p.value}{unit}</text>
          )}
          <circle cx={p.x} cy={p.y} r={i === hi ? 4 : 3} fill={i === hi ? accent : '#ffffff'} stroke={accent} strokeWidth="2" />
          <text x={p.x} y={H - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="#94a3b8">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* 가로 채움 막대 — 값이 막대 안, 라벨은 오른쪽 (레퍼런스: 카테고리 관심도 차트) */
function ResearchHBars({ bars = [], accent = ACCENT }) {
  const max = Math.max(...bars.map(b => Math.abs(b.value) || 0), 1);
  return (
    <div className="space-y-2.5">
      {bars.map((b, i) => {
        const w = Math.max(26, (Math.abs(b.value) / max) * 100);
        const active = i === 0;
        return (
          <div key={`${b.label}-${i}`} className="flex items-center gap-2.5">
            <div
              className="flex h-[26px] flex-shrink-0 items-center justify-end rounded-[3px] px-2"
              style={{ width: `${Math.round(w * 0.6)}%`, minWidth: 64, background: active ? `linear-gradient(90deg, ${accent}, ${accent}d9)` : `${accent}52` }}
            >
              <span className="text-[12px] font-black text-white">{b.value}{b.unit || '%'}</span>
            </div>
            <span className={`min-w-0 truncate text-[13px] ${active ? 'font-black' : 'font-bold'}`} style={{ color: active ? accent : '#8494ab' }}>{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* 시장 리서치 포인트 — 큰 번호 + 헤드라인 + 설명 + 차트 제목/출처 + 차트 (레퍼런스: Desk Research 1·2) */
function ResearchPoint({ index, card, accent = ACCENT }) {
  const chart = card.chartType === 'line' && card.bars.length >= 2
    ? <ResearchLine bars={card.bars} unit={card.bars[0]?.unit || card.unit} accent={accent} />
    : card.bars.length > 0
      ? <ResearchHBars bars={card.bars} accent={accent} />
      : card.value != null
        ? (
          <p className="text-[40px] font-black leading-none tracking-tight" style={{ color: accent }}>
            {card.value}<span className="text-[18px]">{card.unit}</span>
            {card.valueLabel && <span className="ml-2 align-middle text-[13px] font-bold text-bluewood-400">{card.valueLabel}</span>}
          </p>
        )
        : null;
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-start gap-2.5">
        <span className="flex-shrink-0 text-[34px] font-black leading-[0.9]" style={{ color: accent }}>{index}</span>
        <p className="pt-[3px] text-[16.5px] font-black leading-snug text-bluewood-950" style={{ wordBreak: 'keep-all' }}>{card.heading}</p>
      </div>
      {card.desc && <p className="mt-2.5 text-[13.5px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{card.desc}</p>}
      <div className="mt-auto pt-6">
        {(card.chartTitle || card.source) && (
          <div className="mb-3 text-center">
            {card.chartTitle && <p className="text-[14px] font-black text-bluewood-800">{card.chartTitle}</p>}
            {card.source && <p className="mt-0.5 text-[11px] font-semibold text-bluewood-400">{card.source}</p>}
          </div>
        )}
        {chart}
      </div>
    </div>
  );
}

/* sr.research.deskResearchInfographic → 스토리보드용으로 정규화 */
function readDeskResearch(sr) {
  const info = sr?.research?.deskResearchInfographic || sr?.deskResearchInfographic || {};
  const rawCards = Array.isArray(info.cards) ? info.cards : [];
  const cards = rawCards.map(c => {
    const bars = (Array.isArray(c?.bars) ? c.bars : [])
      .map(b => ({ label: keepText(b?.label), value: Number(b?.value), unit: keepText(b?.unit) || keepText(c?.unit) || '%' }))
      .filter(b => b.label && Number.isFinite(b.value))
      .slice(0, 5);
    return {
      heading: keepText(c?.question),
      desc: keepText(c?.finding),
      value: Number.isFinite(Number(c?.value)) ? Number(c.value) : null,
      unit: keepText(c?.unit) || '%',
      valueLabel: keepText(c?.valueLabel),
      chartType: ['line', 'bar', 'donut', 'stat'].includes(c?.chartType) ? c.chartType : (bars.length ? 'bar' : 'stat'),
      chartTitle: keepText(c?.chartTitle) || keepText(c?.sourceTitle),
      bars,
      source: [keepText(c?.sourcePublisher), keepText(c?.checkedAt)].filter(Boolean).join(' · ') || keepText(c?.sourceTitle),
      sourceUrl: keepText(c?.sourceUrl),
    };
  }).filter(c => c.heading && (c.bars.length > 0 || c.value != null)).slice(0, 4);
  return { title: keepText(info.title), subtitle: keepText(info.subtitle), conclusion: keepText(info.conclusion), cards };
}

/* 마케터 포트폴리오 문서 본문 — 프로젝트 흐름을 한 페이지로 정리 (레퍼런스: 리서치 카드 밴드 + 화살표 + 인사이트 배너) */
function MarketerDoc({
  cs, kit, sr,
  setField, setMeta, setKeyExp, addKeyExp, removeKeyExp,
  addKeyExpImage, setKeyExpImage, deleteKeyExpImage,
  updateKit, onAiResearch, researching,
}) {
  const groups = deriveCompetencies(sr, cs.skills);
  const keywords = (kit.jdKeywords.length ? kit.jdKeywords : [...groups.core, ...groups.derived, ...groups.growth]).slice(0, 12);
  // 역량 유형별로 색을 입힌 키워드(형광펜) 목록
  const typedKeywords = (() => {
    const typed = [
      ...groups.core.map(k => [k, 'core']),
      ...groups.derived.map(k => [k, 'derived']),
      ...groups.growth.map(k => [k, 'growth']),
    ];
    const base = typed.length ? typed : keywords.map(k => [k, 'core']);
    const all = [...base, ...cs.tech.map(k => [k, 'tech'])];
    const seen = new Set();
    return all.filter(([k]) => {
      const key = String(k || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 18);
  })();
  const hasKitCards = kit.experienceCards.length > 0;
  const cards = hasKitCards ? kit.experienceCards : cs.keyExps.map((k, i) => ({
    id: `EXP-${String(i + 1).padStart(3, '0')}`,
    sourceId: k.id,
    title: k.title,
    experienceType: keywords.slice(0, 3).join(' / '),
    period: cs.meta.duration,
    oneLineSummary: cs.summary,
    problem: k.problem,
    goal: kit.funnel.goal,
    role: [cs.meta.role].filter(Boolean),
    tools: cs.tech,
    execution: [k.action].filter(Boolean),
    results: [k.result || k.metric].filter(Boolean),
    evidence: kit.evidenceChecklist,
    portfolioFit: k.result || k.metric ? 'A-' : 'B+',
    resumeFit: k.result || k.metric ? 'B+' : 'B',
    coverLetterUses: ['직무역량', '문제해결', '콘텐츠 기획 경험'],
  }));

  const projects = kit.portfolioDraft.projects.length ? kit.portfolioDraft.projects : cards.slice(0, 3).map(card => ({
    title: card.title,
    slides: [
      { title: 'Slide 1. 프로젝트 개요', purpose: card.oneLineSummary, role: card.role.join(', '), keyResult: card.results[0] || '[확인 필요]', images: card.evidence.slice(0, 3) },
      { title: 'Slide 2. 문제 정의와 전략', problem: card.problem, hypothesis: '타깃이 저장하거나 공유할 이유를 만들면 반응이 개선될 가능성이 있습니다.', strategy: card.execution },
      { title: 'Slide 3. 결과와 인사이트', result: card.results[0] || '[확인 필요]', insight: kit.funnel.insight, nextImprovement: '업로드 시간, 썸네일 카피, 콘텐츠 형식별 A/B 테스트를 보완하세요.' },
    ],
  }));
  // ── 포트폴리오 스토리보드 데이터 (Background + Desk Research) ──
  const deskResearch = readDeskResearch(sr);
  const bgCandidates = [
    ...kit.kpis.map(k => ({ label: keepText(k.name), sv: splitMetricValue(k.value) })),
    ...cards.flatMap(c => (c.results || []).map(r => ({ label: keepText(c.title), sv: splitMetricValue(r) }))),
  ].filter(b => b.label && b.sv);
  // 단위가 섞이면 한 축에서 비교가 무너지므로, 가장 많은 단위 그룹만 막대로 사용
  const bgUnitCounts = bgCandidates.reduce((m, b) => { const u = b.sv.unit || ''; m[u] = (m[u] || 0) + 1; return m; }, {});
  const bgTopUnit = Object.keys(bgUnitCounts).sort((a, b) => bgUnitCounts[b] - bgUnitCounts[a])[0];
  const bgBars = bgCandidates
    .filter(b => (b.sv.unit || '') === bgTopUnit)
    .map(b => ({ label: b.label, value: parseFloat(b.sv.value), unit: b.sv.unit || '' }))
    .slice(0, 4);
  const bgHeadline = cs.title || clean(kit.funnel.problem) || '이 프로젝트는 어떤 문제에서 시작됐나요?';
  const bgKicker = [clean(kit.funnel.target), cs.meta.duration].filter(Boolean).join(' · ');
  const bgBody = cs.summary || [clean(kit.funnel.problem), clean(kit.funnel.goal)].filter(Boolean).join(' ');

  const report = {
    ...kit.positioningReport,
    recommendedPositions: kit.positioningReport.recommendedPositions.length
      ? kit.positioningReport.recommendedPositions
      : [
          { name: '콘텐츠 마케터', score: 72, reason: '콘텐츠 제작, 채널 운영, 프로젝트 정리 경험을 우선 근거로 볼 수 있습니다.' },
          { name: '브랜드 마케터', score: 58, reason: '타깃 메시지와 브랜드 관점의 정리가 있으면 보조 포지션으로 활용 가능합니다.' },
          { name: 'CRM 마케터', score: 38, reason: '고객 세그먼트와 메시지 시나리오 증거가 더 필요합니다.' },
          { name: '퍼포먼스 마케터', score: 32, reason: '광고/전환/ROAS 수치가 없으면 우선순위는 낮게 잡는 것이 안전합니다.' },
        ],
    strengths: kit.positioningReport.strengths.length
      ? kit.positioningReport.strengths
      : ['프로젝트 단위로 정리 가능한 실행 경험이 있음', '마케팅 직무 언어로 전환할 수 있는 활동 단서가 있음'],
    weaknesses: kit.positioningReport.weaknesses.length
      ? kit.positioningReport.weaknesses
      : ['성과 수치와 증거 자료 보완 필요', '문제 정의와 본인 역할을 더 구체화할 필요'],
    recommendation: kit.positioningReport.recommendation || kit.positioning || '콘텐츠 기획과 채널 운영 경험을 가진 신입 콘텐츠 마케터로 포지셔닝하는 것이 안전합니다.',
    priorityFixes: kit.positioningReport.priorityFixes.length
      ? kit.positioningReport.priorityFixes
      : ['게시물별 인사이트 캡처', '본인 역할 정리', '콘텐츠 제작 전후 변화 정리'],
  };

  const setKitValue = (path, value) => updateKit(prev => setPathValue(prev || emptyKit(), path, value));
  const displayArrayForPath = (path) => {
    const key = path.join('.');
    if (key === 'portfolioDraft.projects') return projects;
    return getPathValue(kit, path) || [];
  };
  const setArrayItem = (path, index, key, value) => {
    const arr = displayArrayForPath(path);
    const next = [...arr];
    next[index] = { ...(next[index] || {}), [key]: value };
    setKitValue(path, next);
  };
  const updateCardList = (card, index, key, value) => {
    if (hasKitCards) setArrayItem(['experienceCards'], index, key, value.split('\n').map(s => s.trim()).filter(Boolean));
    else if (card.sourceId && key === 'execution') setKeyExp(card.sourceId, 'action', value);
    else if (card.sourceId && key === 'results') setKeyExp(card.sourceId, 'result', value);
  };
  const setCardField = (card, index, key, value) => {
    if (hasKitCards) setArrayItem(['experienceCards'], index, key, value);
    else if (card.sourceId) {
      const map = { title: 'title', problem: 'problem', oneLineSummary: 'context', goal: 'context' };
      if (map[key]) setKeyExp(card.sourceId, map[key], value);
    }
  };
  // 성과 KPI 한 항목의 수치 텍스트만 교체 (그 외 서술은 편집 불가 — 표시 전용)
  const setCardResult = (card, cardIndex, resultIndex, value) => {
    const arr = [...(card.results || [])];
    arr[resultIndex] = value;
    updateCardList(card, cardIndex, 'results', arr.join('\n'));
  };

  return (
    <div className="pb-4">
      <header className="border-b border-surface-200 pb-6">
        <p className="text-[11.5px] font-black uppercase tracking-[0.2em]" style={{ color: ACCENT }}>Marketer Experience Output</p>
        <AutoText
          dense
          value={cs.title}
          onChange={(v) => setField('title', v)}
          placeholder="마케터 경험정리 제목"
          className="mt-2 text-[26px] font-black leading-[1.22] tracking-tight text-bluewood-950 sm:text-[32px]"
        />
        <AutoText
          dense
          value={cs.summary}
          onChange={(v) => setField('summary', v)}
          placeholder="이 경험의 배경, 역할, 결과를 2~3문장으로 요약하세요"
          className="mt-3 max-w-3xl text-[15px] leading-[1.8] text-bluewood-600"
        />
        <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2">
          {[{ k: 'role', label: '역할' }, { k: 'duration', label: '기간' }, { k: 'team', label: '팀' }].map(m => (
            <div key={m.k} className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wide text-bluewood-400">{m.label}</span>
              <div className="min-w-[44px] max-w-[220px]">
                <AutoText
                  dense
                  value={cs.meta[m.k]}
                  onChange={(v) => setMeta(m.k, v)}
                  placeholder="—"
                  className="text-[14px] font-bold text-bluewood-800"
                />
              </div>
            </div>
          ))}
        </div>
        {typedKeywords.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-x-3.5 gap-y-3">
            {typedKeywords.map(([kw, tone], i) => (
              <span key={`${kw}-${i}`} className="text-[14px] font-extrabold text-bluewood-900" style={hlStyle(tone)}>{kw}</span>
            ))}
          </div>
        )}
        <VisualMetricStrip cards={cards} kpis={kit.kpis} />
      </header>

      <details className="mt-6 rounded-2xl border border-primary-100 bg-primary-50/30 print:hidden">
        <summary className="cursor-pointer px-4 py-3 text-[12px] font-black text-primary-600">마케터 핵심 경험 전체 편집</summary>
        <div className="space-y-6 border-t border-primary-100 p-4">
          <div>
            <p className="mb-2 text-[11px] font-black text-bluewood-600">포지셔닝 진단</p>
            <AutoText dense value={report.recommendation || ''} onChange={value => setKitValue(['positioningReport', 'recommendation'], value)} placeholder="추천 포지셔닝 문장" className="text-[12px]" />
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {[
                ['strengths', '핵심 강점'], ['weaknesses', '보완 필요점'], ['priorityFixes', '우선 액션 플랜'],
              ].map(([key, label]) => <div key={key}><p className="mb-1 text-[10.5px] font-bold text-bluewood-400">{label}</p><AutoText dense value={(report[key] || []).join('\n')} onChange={value => setKitValue(['positioningReport', key], value.split('\n').map(line => line.trim()).filter(Boolean))} placeholder="한 줄에 하나씩 입력" className="text-[11.5px]" /></div>)}
            </div>
            <div className="mt-3 space-y-2">
              {(report.recommendedPositions || []).map((position, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_80px_1.5fr]"><AutoText dense value={position.name || ''} onChange={value => setKitValue(['positioningReport', 'recommendedPositions'], report.recommendedPositions.map((row, i) => i === index ? { ...row, name: value } : row))} placeholder="추천 직무" className="text-[11.5px]" /><input type="number" value={position.score || 0} onChange={event => setKitValue(['positioningReport', 'recommendedPositions'], report.recommendedPositions.map((row, i) => i === index ? { ...row, score: Number(event.target.value) } : row))} className="rounded-lg border border-surface-200 bg-white px-2 text-[11.5px]" /><AutoText dense value={position.reason || ''} onChange={value => setKitValue(['positioningReport', 'recommendedPositions'], report.recommendedPositions.map((row, i) => i === index ? { ...row, reason: value } : row))} placeholder="추천 근거" className="text-[11.5px]" /></div>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-black text-bluewood-600">경험정리 카드</p>
            <div className="space-y-3">
              {cards.map((card, index) => <div key={card.id || index} className="rounded-xl border border-surface-200 bg-white p-3"><div className="grid gap-2 sm:grid-cols-2"><AutoText dense value={card.title || ''} onChange={value => setCardField(card, index, 'title', value)} placeholder="카드 제목" className="text-[12px] font-bold" /><AutoText dense value={card.oneLineSummary || ''} onChange={value => setCardField(card, index, 'oneLineSummary', value)} placeholder="한 줄 요약" className="text-[11.5px]" /><AutoText dense value={card.problem || ''} onChange={value => setCardField(card, index, 'problem', value)} placeholder="문제" className="text-[11.5px]" /><AutoText dense value={card.goal || ''} onChange={value => setCardField(card, index, 'goal', value)} placeholder="목표" className="text-[11.5px]" /><AutoText dense value={(card.execution || []).join('\n')} onChange={value => updateCardList(card, index, 'execution', value)} placeholder="실행 — 한 줄에 하나" className="text-[11.5px]" /><AutoText dense value={(card.results || []).join('\n')} onChange={value => updateCardList(card, index, 'results', value)} placeholder="성과 — 한 줄에 하나" className="text-[11.5px]" /></div></div>)}
            </div>
          </div>
        </div>
      </details>

      <section className="mt-8">
        <RuleHeader>1. 마케터 포지셔닝 진단 리포트</RuleHeader>
        <div className="mt-4 rounded-xl border border-surface-200 bg-white p-5 shadow-sm sm:p-6">
          {/* 추천 포지션 — 한 줄 */}
          <div className="flex flex-wrap items-center gap-2.5">
            {(report.recommendedPositions || []).slice(0, 2).map((pos, index) => {
              const isTop = index === 0;
              return (
                <span key={`${pos.name}-${index}`} className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[16px] font-black ${isTop ? 'bg-bluewood-950 text-white' : 'bg-primary-50 text-primary-700 ring-1 ring-primary-100'}`}>
                  <span className={`text-[11px] font-black ${isTop ? 'text-primary-300' : 'text-primary-400'}`}>{index + 1}순위</span>
                  {pos.name || '—'}
                </span>
              );
            })}
            {(report.recommendedPositions || []).length > 2 && (
              <span className="text-[13px] font-semibold text-bluewood-400">
                참고 · {(report.recommendedPositions || []).slice(2).map(p => p.name).filter(Boolean).join(' · ')}
              </span>
            )}
          </div>

          {/* 추천 문장 */}
          {(report.recommendation || kit.positioning) && (
            <p className="mt-4 flex items-start gap-2 text-[15px] font-bold leading-[1.7] text-bluewood-900">
              <span className="mt-0.5 flex-shrink-0 text-[16px] text-primary-500">✓</span>
              {report.recommendation || kit.positioning}
            </p>
          )}

          {/* 강점 · 보완점 · 액션 플랜 — 3열 */}
          <div className="mt-5 grid gap-x-6 gap-y-5 border-t border-surface-100 pt-5 sm:grid-cols-3">
            <div>
              <p className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-black text-emerald-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>핵심 강점
              </p>
              <ul className="space-y-2">
                {(report.strengths || []).map((s, i) => (
                  <li key={i} className="flex gap-2 text-[13.5px] leading-[1.6] text-bluewood-700"><span className="mt-[8px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-black text-rose-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>보완 필요점
              </p>
              <ul className="space-y-2">
                {(report.weaknesses || []).map((w, i) => (
                  <li key={i} className="flex gap-2 text-[13.5px] leading-[1.6] text-bluewood-700"><span className="mt-[8px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-400" />{w}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-black text-indigo-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>우선 액션 플랜
              </p>
              <ol className="space-y-2">
                {(report.priorityFixes || []).map((a, i) => (
                  <li key={i} className="flex gap-2 text-[13.5px] leading-[1.6] text-bluewood-800"><span className="font-black text-indigo-400">{i + 1}.</span>{a}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <RuleHeader>2. 경험정리 카드</RuleHeader>
        <div className="mt-5 space-y-6">
          {cards.map((card, index) => {
            const flip = index % 2 === 1;
            const execution = (card.execution || []).filter(Boolean);
            const results = (card.results || []).map((t, ri) => ({ t, ri })).filter(x => x.t);
            const numeric = results.filter(x => splitMetricValue(x.t));
            const textResults = results.filter(x => !splitMetricValue(x.t));
            const metaRows = [
              ['역할', card.role], ['툴', card.tools], ['증거', card.evidence], ['자소서', card.coverLetterUses],
            ].map(([label, vals]) => [label, (vals || []).filter(Boolean)]).filter(([, vals]) => vals.length);
            const cardImages = card.sourceId ? (cs.keyExps.find(k => k.id === card.sourceId)?.images || []) : [];

            const StoryPanel = (
              <div className="min-w-0">
                {card.problem && (
                  <div className="mb-5">
                    <p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-rose-500">Problem · 문제</p>
                    <p className="text-[15px] font-semibold leading-[1.8] text-bluewood-800"><EmphasizedText text={card.problem} keywords={keywords} /></p>
                  </div>
                )}
                {card.goal && (
                  <div className="mb-5 rounded-xl bg-indigo-50/50 px-4 py-3.5 ring-1 ring-indigo-100/70">
                    <p className="mb-1.5 text-[12px] font-black uppercase tracking-[0.14em] text-indigo-500">Goal · 목표</p>
                    <p className="text-[14px] font-semibold leading-[1.7] text-indigo-900/90">{card.goal}</p>
                  </div>
                )}
                {execution.length > 0 && (
                  <div>
                    <p className="mb-3 text-[12px] font-black uppercase tracking-[0.14em] text-amber-600">Action · 실행</p>
                    <ul className="space-y-3">
                      {execution.map((a, ai) => (
                        <li key={ai} className="flex gap-3">
                          <span className="mt-[2px] flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-black text-amber-700">{ai + 1}</span>
                          <span className="text-[14px] leading-[1.75] text-bluewood-700">{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );

            const ResultsPanel = (
              <div className="rounded-2xl bg-gradient-to-br from-surface-50 to-white p-5 ring-1 ring-surface-200">
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-4 w-1 rounded-full" style={{ backgroundColor: ACCENT }} />
                  <p className="text-[12px] font-black uppercase tracking-[0.14em] text-bluewood-600">Key Results · 성과</p>
                </div>
                {numeric.length > 0 && (
                  <div className={`grid gap-3 ${numeric.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {numeric.map(({ t, ri }) => (
                      <ResultStat key={ri} text={t} onChange={(v) => setCardResult(card, index, ri, v)} />
                    ))}
                  </div>
                )}
                {textResults.length > 0 && (
                  <ul className={`space-y-2.5 ${numeric.length > 0 ? 'mt-4 border-t border-surface-200 pt-4' : ''}`}>
                    {textResults.map(({ t, ri }) => (
                      <li key={ri} className="flex items-start gap-2.5">
                        <span className="mt-[8px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                        <span className="text-[14px] font-bold leading-[1.65] text-bluewood-800"><EmphasizedText text={t} keywords={keywords} tone="growth" /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );

            return (
              <article key={card.id || index} className="relative overflow-hidden rounded-3xl border border-surface-200/70 bg-white p-6 shadow-[0_8px_30px_-14px_rgba(15,40,80,0.16)] sm:p-8 print:break-inside-avoid">
                {/* 헤더: 큰 인덱스 넘버 + 키커 + 헤드라인 + 요약 */}
                <div className="flex items-start gap-5 border-b border-surface-200 pb-5">
                  <span className="hidden select-none text-[54px] font-black leading-none text-surface-200 sm:block">{String(index + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    {[card.experienceType, card.period].filter(Boolean).length > 0 && (
                      <p className="text-[12px] font-black uppercase tracking-[0.12em] text-primary-500">{[card.experienceType, card.period].filter(Boolean).join(' · ')}</p>
                    )}
                    <h3 className="mt-1.5 text-[24px] font-black leading-tight tracking-tight text-bluewood-950 sm:text-[28px]">
                      <span className="mr-2 text-primary-400 sm:hidden">{String(index + 1).padStart(2, '0')}</span>{card.title || '경험 제목'}
                    </h3>
                    {card.oneLineSummary && <p className="mt-2.5 text-[15px] leading-[1.7] text-bluewood-600"><EmphasizedText text={card.oneLineSummary} keywords={keywords} /></p>}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <InsightPill>포폴 {card.portfolioFit || '-'}</InsightPill>
                    <InsightPill tone="green">이력서 {card.resumeFit || '-'}</InsightPill>
                  </div>
                </div>

                {/* 본문: 좌우 교차 배치 (스토리 ↔ 성과) */}
                <div className="mt-6">
                  {results.length > 0 ? (
                    <div className={`grid gap-6 lg:items-start ${flip ? 'lg:grid-cols-[0.82fr_1.18fr]' : 'lg:grid-cols-[1.18fr_0.82fr]'}`}>
                      {flip ? <>{ResultsPanel}{StoryPanel}</> : <>{StoryPanel}{ResultsPanel}</>}
                    </div>
                  ) : (
                    <div className="max-w-3xl">{StoryPanel}</div>
                  )}
                </div>

                {/* 증거 이미지 (원본 경험 카드) */}
                {card.sourceId && (
                  <div className="mt-6 border-t border-dashed border-surface-200 pt-5">
                    {cardImages.length > 0 && (
                      <div className="mb-3 flex flex-col gap-2.5">
                        {cardImages.map(im => (
                          <ResizableFigure
                            key={im.id}
                            src={im.url}
                            width={im.width}
                            onWidth={(w) => setKeyExpImage(card.sourceId, im.id, { width: w })}
                            onReplace={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setKeyExpImage(card.sourceId, im.id, { url: await resizeToBase64(f) }); } catch { toast.error('사진 처리에 실패했어요.'); } }}
                            onDelete={() => deleteKeyExpImage(card.sourceId, im.id)}
                          />
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => addKeyExpImage(card.sourceId)} className="rounded-md border border-surface-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600 print:hidden">＋ 증거 이미지</button>
                  </div>
                )}

                {/* 푸터: 역할 / 툴 / 증거 / 자소서 활용 */}
                {metaRows.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4 border-t border-surface-200 pt-5">
                    {metaRows.map(([label, vals]) => (
                      <div key={label} className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-bluewood-400">{label}</p>
                        <p className="mt-1 text-[13.5px] font-semibold leading-[1.55] text-bluewood-700">{vals.join(' · ')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <button type="button" onClick={addKeyExp} className="mt-6 w-full rounded-xl border border-dashed border-surface-300 py-3 text-[12.5px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600 print:hidden">＋ 경험 카드 추가</button>
      </section>

      <section className="mt-12">
        <RuleHeader>3. 포트폴리오 스토리보드</RuleHeader>

        {/* 히어로 스토리보드 — 좁은 Background(화이트) + 넓은 Desk Research(라이트 그레이), 레퍼런스 비율 재현 */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-surface-200 shadow-[0_12px_44px_-18px_rgba(15,40,80,0.24)] print:break-inside-avoid">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2.15fr)]">
            {/* Background — 좁은 좌측 컬럼 */}
            <div className="bg-white p-7 sm:p-8">
              <StoryLabel>Background</StoryLabel>
              <h3 className="text-[22px] font-black leading-[1.38] tracking-tight sm:text-[24px]" style={{ color: ACCENT, wordBreak: 'keep-all' }}>{bgHeadline}</h3>
              {bgKicker && <p className="mt-3 text-[12px] font-semibold leading-[1.6] text-bluewood-400">{bgKicker}</p>}
              {bgBody && <p className="mt-4 text-[14px] font-medium leading-[1.9] text-bluewood-700" style={{ wordBreak: 'keep-all' }}><EmphasizedText text={bgBody} keywords={keywords} /></p>}
              {bgBars.length > 0 && (
                <div className="mt-10">
                  <p className="text-[14px] font-black text-bluewood-900">&lt;프로젝트 핵심 지표&gt;</p>
                  <p className="mb-4 mt-1 text-[11.5px] font-semibold text-bluewood-400">이 경험에서 검증한 성과 데이터</p>
                  <SurveyBars bars={bgBars} />
                </div>
              )}
            </div>
            {/* Desk Research — 넓은 우측 컬럼 */}
            <div className="bg-[#f7f7fb] p-7 sm:p-8">
              <StoryLabel
                action={onAiResearch && (
                  <button
                    type="button"
                    onClick={onAiResearch}
                    disabled={researching}
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-[11.5px] font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-50 print:hidden"
                  >
                    {researching && <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                    {researching ? '조사 중…' : deskResearch.cards.length > 0 ? 'AI 추가 조사' : 'AI 조사'}
                  </button>
                )}
              >
                Desk Research
              </StoryLabel>
              {deskResearch.cards.length > 0 ? (
                <>
                  {deskResearch.subtitle && <p className="mb-8 text-[13.5px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{deskResearch.subtitle}</p>}
                  <div className={`grid gap-x-12 gap-y-9 ${deskResearch.cards.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                    {deskResearch.cards.map((c, i) => <ResearchPoint key={`dr-${i}`} index={i + 1} card={c} />)}
                  </div>
                  {deskResearch.conclusion && (
                    <p className="mt-9 border-l-[3px] pl-4 text-[14.5px] font-bold leading-[1.75] text-bluewood-800" style={{ borderColor: ACCENT, wordBreak: 'keep-all' }}>{deskResearch.conclusion}</p>
                  )}
                </>
              ) : (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-surface-200 bg-white/60 p-6 text-center">
                  <p className="text-[13px] font-bold text-bluewood-500">시장조사 자료가 아직 없어요</p>
                  <p className="mt-1.5 max-w-md text-[12px] leading-[1.65] text-bluewood-400" style={{ wordBreak: 'keep-all' }}>직접 조사한 시장 데이터가 있으면 우선 반영되고, 없으면 AI가 관련 시장 자료를 출처와 함께 이곳에 정리해 채웁니다.</p>
                  {onAiResearch && (
                    <button
                      type="button"
                      onClick={onAiResearch}
                      disabled={researching}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-50 print:hidden"
                    >
                      {researching && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                      {researching ? 'AI가 시장 자료를 조사하는 중…' : 'AI로 시장조사 채우기'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 프로젝트 스토리보드 — 문제 정의(좌) / 전략·결과(우)를 히어로와 같은 문법으로 */}
        <div className="mt-8 space-y-8">
          {projects.map((project, pi) => {
            const slides = project.slides || [];
            const pick = (k) => {
              for (const sl of slides) {
                const v = sl?.[k];
                if (Array.isArray(v) ? v.length : keepText(v)) return v;
              }
              return '';
            };
            const summary = keepText(pick('oneLineSummary') || pick('purpose'));
            const problem = keepText(pick('problem'));
            const hypothesis = keepText(pick('hypothesis'));
            const execRaw = pick('execution') || pick('strategy');
            const execution = (Array.isArray(execRaw) ? execRaw : [execRaw]).map(keepText).filter(Boolean);
            const result = keepText(pick('result') || pick('keyResult'));
            const insight = keepText(pick('insight'));
            const next = keepText(pick('nextImprovement'));
            const period = keepText(pick('period'));
            const role = keepText(pick('role'));
            const rm = parseResultMetric(result);
            return (
              <div key={`${project.title}-${pi}`} className="overflow-hidden rounded-2xl border border-surface-200 shadow-[0_12px_44px_-18px_rgba(15,40,80,0.24)] print:break-inside-avoid">
                <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2.15fr)]">
                  {/* 좌: 문제 정의 */}
                  <div className="bg-white p-7 sm:p-8">
                    <StoryLabel>Problem Definition</StoryLabel>
                    <p className="text-[11.5px] font-black uppercase tracking-[0.14em] text-bluewood-400">Project {String(pi + 1).padStart(2, '0')}{period ? ` · ${period}` : ''}</p>
                    <AutoText
                      dense
                      value={project.title}
                      onChange={(v) => setArrayItem(['portfolioDraft', 'projects'], pi, 'title', v)}
                      placeholder="대표 프로젝트명"
                      className="mt-2 text-[21px] font-black leading-[1.35] tracking-tight text-[#002F6C] sm:text-[23px]"
                    />
                    {summary && <p className="mt-3.5 text-[14px] font-medium leading-[1.85] text-bluewood-700" style={{ wordBreak: 'keep-all' }}><EmphasizedText text={summary} keywords={keywords} /></p>}
                    {problem && (
                      <div className="mt-6">
                        <p className="text-[14px] font-black text-bluewood-900">&lt;해결할 문제&gt;</p>
                        <p className="mt-2 text-[14px] leading-[1.8] text-bluewood-600" style={{ wordBreak: 'keep-all' }}><EmphasizedText text={problem} keywords={keywords} /></p>
                      </div>
                    )}
                    {hypothesis && (
                      <div className="mt-5">
                        <p className="text-[14px] font-black text-bluewood-900">&lt;가설&gt;</p>
                        <p className="mt-2 text-[14px] leading-[1.8] text-bluewood-600" style={{ wordBreak: 'keep-all' }}>{hypothesis}</p>
                      </div>
                    )}
                    {role && <p className="mt-6 text-[12px] font-semibold text-bluewood-400">역할 · {role}</p>}
                  </div>
                  {/* 우: 전략 · 결과 */}
                  <div className="bg-[#f7f7fb] p-7 sm:p-8">
                    <StoryLabel>Strategy &amp; Result</StoryLabel>
                    <div className="grid gap-x-12 gap-y-8 sm:grid-cols-[1.05fr_0.95fr]">
                      <div>
                        <p className="mb-4 text-[14.5px] font-black text-bluewood-900">실행 전략</p>
                        {execution.length > 0 ? (
                          <div className="space-y-4">
                            {execution.map((a, ai) => (
                              <div key={ai} className="flex items-start gap-3">
                                <span className="flex-shrink-0 text-[23px] font-black leading-[1.05]" style={{ color: ACCENT }}>{ai + 1}</span>
                                <p className="pt-[3px] text-[14px] leading-[1.7] text-bluewood-700" style={{ wordBreak: 'keep-all' }}>{a}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[14px] text-bluewood-300">실행 내용을 정리하면 이곳에 단계별로 표시됩니다.</p>
                        )}
                      </div>
                      <div>
                        <p className="mb-4 text-[14.5px] font-black text-bluewood-900">결과</p>
                        {rm?.kind === 'compare' ? (
                          <div>
                            {rm.badge && (
                              <p className="mb-2.5 text-[30px] font-black leading-none tracking-tight" style={{ color: ACCENT }}>
                                {rm.badge}<span className="ml-1 text-[15px] font-bold text-emerald-600">↑</span>
                              </p>
                            )}
                            <CompareBars beforeText={rm.before.raw} afterText={rm.after.raw} afterDisplay={rm.after.raw} />
                          </div>
                        ) : rm?.kind === 'single' ? (
                          <p className="text-[36px] font-black leading-none tracking-tight" style={{ color: ACCENT }}>
                            {rm.token.value.toLocaleString()}<span className="ml-0.5 text-[17px]">{rm.token.unit}</span>
                          </p>
                        ) : null}
                        {result && <p className={`text-[14px] font-semibold leading-[1.75] text-bluewood-600 ${rm ? 'mt-3' : ''}`} style={{ wordBreak: 'keep-all' }}><EmphasizedText text={result} keywords={keywords} tone="growth" /></p>}
                      </div>
                    </div>
                    {(insight || next) && (
                      <div className="mt-8 border-l-[3px] pl-4" style={{ borderColor: ACCENT }}>
                        {insight && <p className="text-[14.5px] font-bold leading-[1.75] text-bluewood-800" style={{ wordBreak: 'keep-all' }}>{insight}</p>}
                        {next && <p className={`text-[12.5px] leading-[1.7] text-bluewood-400 ${insight ? 'mt-2' : ''}`} style={{ wordBreak: 'keep-all' }}>Next — {next}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {cs.body.some(s => (s.type === 'image' ? s.content : (s.content || '').trim())) && (
        <section className="mt-12">
          <RuleHeader>Appendix</RuleHeader>
          <div className="mt-4">
            <CaseBody body={cs.body} onChange={(next) => setField('body', next)} />
          </div>
        </section>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   경험 결과 — 내가 프로젝트에서 한 핵심을 정리해 보여주는 한 장의 문서
   (핵심 경험은 구조화해서 보여주고, 글·사진은 자유롭게 편집 → Firestore 저장)
   ────────────────────────────────────────────────────────── */
export default function ExperienceResult() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [exp, setExp] = useState(state?.analysis ? normalizeExperienceForCurrentJob({ structuredResult: state.analysis, title: state.title, jobCategory: state.jobCategory }) : null);
  const [cs, setCs] = useState(null);
  const [kit, setKit] = useState(null); // 마케터 전용 산출물(marketerKit) 편집 상태
  const [loading, setLoading] = useState(!state?.analysis);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false); // AI 시장조사 진행 상태
  const { researchMarketMetrics } = useExperienceStore();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [draftGuideOpen, setDraftGuideOpen] = useState(false);
  const keyExpFileRef = useRef(null);
  const pendingKeyExpApply = useRef(null);
  const feedbackContext = state?.feedbackContext || 'experience_complete';
  const feedbackPromptKey = `fitpoly-feedback:${id}:${feedbackContext}`;
  const isDraftResult = Boolean(exp?.structuredResult?._draft || state?.analysis?._draft);
  const draftGuideKey = `fitpoly-draft-enhance-guide:${id}`;

  const initCaseStudy = useCallback((data) => {
    setCs(data.caseStudy ? normalizeCaseStudy(data.caseStudy) : deriveCaseStudy(data));
  }, []);

  useEffect(() => {
    (async () => {
      // 데모 미리보기 — Firestore 없이 샘플 데이터로 전체 섹션을 한눈에 확인
      if (id === 'demo') {
        setExp(DEMO_MARKETER_EXPERIENCE);
        initCaseStudy(DEMO_MARKETER_EXPERIENCE);
        setKit(normalizeKit(DEMO_MARKETER_EXPERIENCE.structuredResult?.marketerKit));
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'experiences', id));
        if (snap.exists()) {
          const data = snap.data();
          const full = normalizeExperienceForCurrentJob({ title: data.title, jobCategory: data.jobCategory, structuredResult: data.structuredResult || {}, keywords: data.keywords || [], caseStudy: data.caseStudy || null, content: data.content || null });
          setExp(full);
          initCaseStudy(full);
          setKit(normalizeKit(full.structuredResult?.marketerKit));
        } else if (exp) {
          initCaseStudy(exp);
          setKit(normalizeKit(exp.structuredResult?.marketerKit));
        }
      } catch {
        if (exp) {
          initCaseStudy(exp);
          setKit(normalizeKit(exp.structuredResult?.marketerKit));
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!state?.showFeedback || !id) return undefined;
    if (isDraftResult) return undefined;
    if (isFeedbackSnoozed()) return undefined;
    if (window.localStorage.getItem(feedbackPromptKey) === '1') return undefined;
    const timer = window.setTimeout(() => {
      if (!document.hidden) setFeedbackOpen(true);
    }, 45000);
    return () => window.clearTimeout(timer);
  }, [state?.showFeedback, id, feedbackPromptKey, isDraftResult]);

  useEffect(() => {
    if (!id || !isDraftResult || loading || !cs) return undefined;
    // 기획/PM은 초안이 곧 린 캔버스로 한눈에 보이므로 별도 안내 모달을 띄우지 않는다.
    const jc = exp?.jobCategory || exp?.structuredResult?.jobCategory || 'common';
    if (jc === 'pm') return undefined;
    if (window.localStorage.getItem(draftGuideKey) === '1') return undefined;
    const timer = window.setTimeout(() => setDraftGuideOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [id, isDraftResult, loading, cs, draftGuideKey, exp?.jobCategory, exp?.structuredResult?.jobCategory]);

  const closeFeedback = () => {
    if (id) window.localStorage.setItem(feedbackPromptKey, '1');
    setFeedbackOpen(false);
  };

  const closeDraftGuide = () => {
    if (id) window.localStorage.setItem(draftGuideKey, '1');
    setDraftGuideOpen(false);
  };

  const goEnhanceDraft = () => {
    closeDraftGuide();
    guardedNav(`/app/experience/structured/${id}`);
  };

  const patch = (updater) => { setCs(prev => updater(prev)); setDirty(true); };
  const setField = (key, val) => patch(prev => ({ ...prev, [key]: val }));
  const setMeta = (key, val) => patch(prev => ({ ...prev, meta: { ...prev.meta, [key]: val } }));
  const setKeyExp = (keId, key, val) => patch(prev => ({ ...prev, keyExps: prev.keyExps.map(k => k.id === keId ? { ...k, [key]: val } : k) }));
  const addKeyExp = () => {
    patch(prev => ({ ...prev, keyExps: [...prev.keyExps, { id: uid(), title: '', metric: '', beforeMetric: '', problem: '', action: '', result: '', learning: '', images: [] }] }));
  };
  const removeKeyExp = (keId) => patch(prev => ({ ...prev, keyExps: prev.keyExps.filter(k => k.id !== keId) }));

  // 마케터 산출물(marketerKit) 편집 — 저장 시 structuredResult.marketerKit로 반영
  const patchKit = (updater) => { setKit(prev => updater(prev || emptyKit())); setDirty(true); };
  const updateKit = patchKit;
  const setKitField = (key, val) => patchKit(p => ({ ...p, [key]: val }));
  const setFunnelField = (key, val) => patchKit(p => ({ ...p, funnel: { ...p.funnel, [key]: val } }));
  const setBullet = (i, val) => patchKit(p => ({ ...p, resumeBullets: p.resumeBullets.map((b, bi) => (bi === i ? val : b)) }));
  const addBullet = () => patchKit(p => ({ ...p, resumeBullets: [...p.resumeBullets, ''] }));
  const removeBullet = (i) => patchKit(p => ({ ...p, resumeBullets: p.resumeBullets.filter((_, bi) => bi !== i) }));

  // 마케터는 포트폴리오 문서(한 페이지) 형태로 렌더링
  const isMarketer = exp?.jobCategory === 'marketer' || !!exp?.structuredResult?.marketerKit || !!kit;
  const kitView = kit || emptyKit();

  // 핵심 경험 카드의 사진 추가/교체/삭제/리사이즈
  const addKeyExpImage = (keId) => {
    pendingKeyExpApply.current = (urlContent) => patch(prev => ({
      ...prev,
      keyExps: prev.keyExps.map(k => k.id === keId ? { ...k, images: [...k.images, { id: uid(), url: urlContent, width: '100%' }] } : k),
    }));
    keyExpFileRef.current?.click();
  };
  const onKeyExpFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingKeyExpApply.current) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('사진 크기 초과 (10MB)'); return; }
    try { pendingKeyExpApply.current(await resizeToBase64(file)); } catch { toast.error('사진 처리에 실패했어요.'); }
    pendingKeyExpApply.current = null;
  };
  const setKeyExpImage = (keId, imgId, changes) => patch(prev => ({
    ...prev,
    keyExps: prev.keyExps.map(k => k.id === keId ? { ...k, images: k.images.map(im => im.id === imgId ? { ...im, ...changes } : im) } : k),
  }));
  const deleteKeyExpImage = (keId, imgId) => patch(prev => ({
    ...prev,
    keyExps: prev.keyExps.map(k => k.id === keId ? { ...k, images: k.images.filter(im => im.id !== imgId) } : k),
  }));

  const handleSave = async () => {
    if (saving || !cs) return;
    if (id === 'demo') { toast('데모 페이지는 저장되지 않아요. 실제 경험에서 편집해주세요.'); return; }
    setSaving(true);
    try {
      // 핵심 경험 사진을 자세히보기(핵심 경험)와 공유 — 경험 순서(index) 기준으로 매핑
      const keyExpImages = {};
      cs.keyExps.forEach((k, i) => {
        if (k.images?.length) keyExpImages[String(i)] = k.images.map(im => ({ url: im.url, width: im.width || '100%' }));
      });
      // 간략 보기의 공통 필드(제목·요약·역할·핵심경험)를 자세히 보기(structuredResult)에도 반영
      const updatedStructured = mergeCaseStudyIntoStructured(exp?.structuredResult, cs);
      if (isMarketer && kit) updatedStructured.marketerKit = kit;
      await updateDoc(doc(db, 'experiences', id), {
        caseStudy: cs,
        keyExpImages,
        title: cs.title || exp?.title || '',
        structuredResult: updatedStructured,
        updatedAt: new Date(),
      });
      setExp(prev => ({ ...(prev || {}), structuredResult: updatedStructured, title: cs.title || prev?.title || '' }));
      setDirty(false);
      toast.success('저장됐어요.');
    } catch (err) {
      toast.error(err?.message || '저장에 실패했어요.');
    }
    setSaving(false);
  };

  // AI 시장조사 — 사용자가 넣은 자료가 있으면 유지·보강하고, 없으면 출처 기반으로 새로 채운다
  const handleAiResearch = async () => {
    if (researching) return;
    setResearching(true);
    try {
      const srPrev = exp?.structuredResult || {};
      // 7개 스토리 섹션은 structuredResult 바로 아래 키로 저장됨 (StructuredResult의 pickSectionFields와 동일 규칙)
      const sections = {};
      ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'].forEach(k => {
        if (typeof srPrev[k] === 'string' && srPrev[k].trim()) sections[k] = srPrev[k];
      });
      const res = await researchMarketMetrics({
        title: cs?.title || exp?.title || '',
        sections,
        keywords: exp?.keywords || [],
        projectOverview: srPrev.projectOverview || {},
        jobCategory: exp?.jobCategory || 'marketer',
      });
      const info = res?.deskResearchInfographic || {};
      const newCards = Array.isArray(info.cards) ? info.cards : [];
      if (newCards.length === 0) {
        toast.error('신뢰할 수 있는 시장 자료를 찾지 못했어요. 잠시 후 다시 시도해주세요.');
        return;
      }
      const prevInfo = srPrev.research?.deskResearchInfographic || {};
      const prevCards = Array.isArray(prevInfo.cards) ? prevInfo.cards : [];
      const norm = (s) => String(s || '').trim().toLowerCase();
      const seen = new Set(prevCards.map(c => norm(c?.sourceUrl) || norm(c?.question)));
      const mergedCards = [
        ...prevCards,
        ...newCards.filter(c => { const k = norm(c?.sourceUrl) || norm(c?.question); return k && !seen.has(k); }),
      ].slice(0, 4);
      const nextStructured = {
        ...srPrev,
        research: {
          ...(srPrev.research || {}),
          deskResearchInfographic: {
            title: prevInfo.title || info.title || '',
            subtitle: prevInfo.subtitle || info.subtitle || '',
            cards: mergedCards,
            conclusion: prevInfo.conclusion || info.conclusion || '',
            limitations: prevInfo.limitations || info.limitations || '',
          },
        },
      };
      setExp(prev => ({ ...(prev || {}), structuredResult: nextStructured }));
      if (id !== 'demo') {
        try {
          await updateDoc(doc(db, 'experiences', id), { structuredResult: nextStructured, updatedAt: new Date() });
        } catch {
          setDirty(true); // 즉시 저장 실패 시 일반 저장 경로로 보존
        }
      }
      const addedCount = mergedCards.length - prevCards.length;
      toast.success(addedCount > 0
        ? `AI가 시장조사 ${addedCount}개를 채웠어요. 게시 전 출처의 원문 수치를 한 번 확인해 주세요.`
        : '이미 반영된 자료와 같은 내용이라 새로 추가된 카드는 없어요.');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'AI 시장조사에 실패했어요.');
    } finally {
      setResearching(false);
    }
  };

  // 저장 안 한 변경이 있으면 이동/새로고침 시 경고
  const guardedNav = (to) => {
    if (dirty && !window.confirm('저장하지 않은 변경사항이 있어요. 저장하지 않고 이동할까요?')) return;
    navigate(to);
  };
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  // Ctrl/Cmd + S 로 저장
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (dirty && !saving) handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, cs]);

  if (loading || !cs) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="inline-block w-9 h-9 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    );
  }

  const KE_ROWS = [
    { key: 'problem', label: '문제' },
    { key: 'action', label: '실행' },
    { key: 'result', label: '결과', strong: true },
    { key: 'learning', label: '배운 점' },
  ];

  // 직군별 케이스 스터디 구조 분기 — 개발 직군은 GitHub 기반 개발 임팩트, 기획/PM은 의사결정 딥다이브를 보여준다.
  const jobCategory = exp?.jobCategory || exp?.structuredResult?.jobCategory || 'common';
  const isCommonJob = jobCategory === 'common';
  const isDevJob = DEV_GIT_JOBS.includes(jobCategory);
  const isPmJob = jobCategory === 'pm';
  const devStats = exp?.structuredResult?.githubStats || null;
  const devGitExps = Array.isArray(exp?.structuredResult?.gitAnalysis?.experiences) ? exp.structuredResult.gitAnalysis.experiences : [];
  const devRole = devStats ? inferDevRole(devStats, devGitExps) : null;
  const rolePoints = devGitExps.map(e => clean(e.project_name)).filter(Boolean).slice(0, 5);
  const devTechStack = isDevJob ? deriveDevTechStack(exp, cs.tech) : [];

  return (
    <>
    <FeedbackModal
      open={feedbackOpen}
      onClose={closeFeedback}
      context={feedbackContext}
      experienceId={id}
      title={cs?.title || exp?.title || state?.title || ''}
    />
    <ContextMenuHost />
    <DraftEnhanceGuideModal open={draftGuideOpen} onClose={closeDraftGuide} onEnhance={goEnhanceDraft} />
    <div className={`min-h-screen ${isMarketer ? 'bg-surface-50 print:bg-white' : 'bg-white'}`}>
      <input ref={keyExpFileRef} type="file" accept="image/*" className="hidden" onChange={onKeyExpFile} />

      {/* ── 상단 액션 바 ── */}
      <div className="sticky top-0 z-20 border-b border-surface-200 bg-white/90 backdrop-blur print:hidden">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => guardedNav('/app/experience')} className="shrink-0 text-[13px] font-medium text-bluewood-400 hover:text-bluewood-700 transition-colors">← <span className="hidden sm:inline">경험 목록</span></button>

            {/* 보기 전환 — 핵심 경험 ↔ 자세히 보기 */}
            <div className="inline-flex items-center gap-0.5 rounded-xl bg-surface-100 p-1">
              <span className="px-3 sm:px-3.5 py-1.5 rounded-lg bg-white text-[13px] font-bold text-bluewood-900 shadow-sm">{isCommonJob ? '케이스 스터디' : '핵심 경험'}</span>
              <button onClick={() => guardedNav(`/app/experience/structured/${id}`)} className="px-3 sm:px-3.5 py-1.5 rounded-lg text-[13px] font-semibold text-bluewood-400 hover:text-bluewood-700 transition-colors">자세히 보기</button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {dirty && <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-500"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />저장 안 됨</span>}
            {isMarketer && (
              <button
                onClick={() => window.print()}
                title="브라우저 인쇄 창에서 'PDF로 저장'을 선택하세요"
                className="hidden sm:inline-flex px-3.5 py-2 rounded-lg border border-surface-200 bg-white text-[13px] font-bold text-bluewood-600 hover:bg-surface-50 hover:border-surface-300 transition-colors"
              >
                PDF 저장
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              title="저장 (Ctrl+S)"
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-[13px] font-bold hover:bg-primary-700 disabled:opacity-40 transition-colors shadow-sm shadow-primary-600/20"
            >
              {saving ? '저장 중…' : dirty ? '저장' : '저장됨'}
            </button>
          </div>
        </div>
      </div>

      <article className={isMarketer ? 'mx-auto max-w-[1080px] px-5 py-9 sm:px-10 print:max-w-none print:p-0' : isPmJob ? 'px-4 sm:px-6 xl:px-8 py-7 sm:py-9' : isCommonJob ? 'mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12' : 'max-w-6xl mx-auto px-5 sm:px-8 py-7 sm:py-9'}>
        {isMarketer ? (
          <MarketerDoc
            cs={cs}
            kit={kitView}
            sr={exp?.structuredResult}
            setField={setField}
            setMeta={setMeta}
            setKeyExp={setKeyExp}
            addKeyExp={addKeyExp}
            removeKeyExp={removeKeyExp}
            addKeyExpImage={addKeyExpImage}
            setKeyExpImage={setKeyExpImage}
            deleteKeyExpImage={deleteKeyExpImage}
            updateKit={updateKit}
            onAiResearch={handleAiResearch}
            researching={researching}
          />
        ) : isPmJob ? (
          <PmDoc
            exp={exp}
            cs={cs}
            sr={exp?.structuredResult || {}}
            setField={setField}
            setMeta={setMeta}
            setKeyExp={setKeyExp}
            addKeyExp={addKeyExp}
            removeKeyExp={removeKeyExp}
            onPatchSr={(nextSr) => {
              setExp(prev => ({ ...(prev || {}), structuredResult: nextSr }));
              setDirty(true);
            }}
          />
        ) : isCommonJob ? (
          <CommonLegacyDoc
            id={id}
            exp={exp}
            cs={cs}
            KE_ROWS={KE_ROWS}
            saving={saving}
            dirty={dirty}
            setField={setField}
            setMeta={setMeta}
            setKeyExp={setKeyExp}
            addKeyExp={addKeyExp}
            removeKeyExp={removeKeyExp}
            addKeyExpImage={addKeyExpImage}
            setKeyExpImage={setKeyExpImage}
            deleteKeyExpImage={deleteKeyExpImage}
            handleSave={handleSave}
            guardedNav={guardedNav}
          />
        ) : (
        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] lg:gap-10">

          {/* ════ 왼쪽 — 한눈에 보는 정보 (선으로 구분된 단일 페이지, sticky) ════ */}
          <div className={`lg:pr-2 ${isDevJob ? '' : 'lg:sticky lg:top-[72px]'}`}>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-[11.5px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>핵심 경험 리포트</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-[11px] font-semibold text-bluewood-400">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                눌러서 편집
              </span>
            </div>
            <AutoText
              prose
              value={cs.title}
              onChange={(v) => setField('title', v)}
              placeholder="경험 제목을 입력하세요"
              className="text-[22px] sm:text-[26px] font-black leading-[1.22] text-bluewood-900 tracking-tight"
            />
            {isDevJob ? (
              devStats ? (
                <div className="mt-4 border-t border-surface-200 pt-4">
                  <GitHeroCard
                    stats={devStats}
                    role={devRole}
                    rolePoints={rolePoints}
                    onChange={(nextStats) => {
                      setExp(prev => ({
                        ...(prev || {}),
                        structuredResult: { ...(prev?.structuredResult || {}), githubStats: nextStats },
                      }));
                      setDirty(true);
                    }}
                  />
                </div>
              ) : (
                <p className="mt-3 text-[13px] leading-[1.6] text-bluewood-400">오른쪽 <span className="font-semibold text-bluewood-500">개발 임팩트</span>에서 GitHub을 연결하면 기여도·커밋 활동이 여기 표시됩니다.</p>
              )
            ) : (<>
            <AutoText
              prose
              value={cs.summary}
              onChange={(v) => setField('summary', v)}
              placeholder="한 줄 요약 — 이 경험이 무엇이고 왜 중요한지"
              className="mt-2 text-[14px] sm:text-[14.5px] leading-[1.55] text-bluewood-500"
            />
            {/* 메타 */}
            <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 border-t border-surface-200 pt-4">
              {[{ k: 'role', label: '역할' }, { k: 'duration', label: '기간' }, { k: 'team', label: '팀 구성' }].map(m => (
                <div key={m.k} className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-bluewood-300 mb-0.5">{m.label}</p>
                  <AutoText
                    value={cs.meta[m.k]}
                    onChange={(v) => setMeta(m.k, v)}
                    placeholder="—"
                    className="text-[12.5px] font-semibold text-bluewood-700"
                  />
                </div>
              ))}
            </div>
            </>)}
            {/* 기술 스택 — 개발 직군은 프로젝트/GitHub 분석 결과를 통합해 표시 */}
            {(isDevJob ? devTechStack : cs.tech).length > 0 && (
              <div className="mt-4 border-t border-surface-200 pt-4">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-bluewood-300 mb-2">{isDevJob ? '기술 스택' : '기술'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(isDevJob ? devTechStack : cs.tech).map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-surface-100 text-[11px] font-semibold text-bluewood-600">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {/* 핵심 역량 — 개발 직군은 위의 기술 스택으로 대체 */}
            {!isDevJob && (() => {
              const groups = deriveCompetencies(exp?.structuredResult, cs.skills);
              const active = COMP_GROUPS.filter(g => groups[g.key].length > 0);
              if (active.length === 0) return null;
              return (
                <div className="mt-4 border-t border-surface-200 pt-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-bluewood-300 mb-2">핵심 역량</p>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                    {active.flatMap(g => groups[g.key].map((s, i) => (
                      <span key={`${g.key}-${i}`} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ backgroundColor: `${g.color}14`, color: g.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: g.color }} />
                        {s}
                      </span>
                    )))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ════ 오른쪽 — 직군별 구조: 개발 직군은 GitHub 기반 개발 임팩트, 기획/PM은 의사결정 딥다이브, 그 외엔 핵심 경험 리포트 ════ */}
          <section className="min-w-0">
            {isDevJob ? (
              <DevImpactSection
                expId={id}
                exp={exp}
                caseStudy={cs}
                onApplied={(nextSr) => setExp(prev => ({ ...(prev || {}), structuredResult: nextSr }))}
                onPatchSr={(nextSr) => {
                  setExp(prev => ({ ...(prev || {}), structuredResult: nextSr }));
                  setDirty(true);
                }}
              />
            ) : (<>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[15px] font-extrabold text-bluewood-900">핵심 경험</h2>
              {cs.keyExps.length > 0 && <span className="text-[11.5px] font-semibold text-bluewood-300">{cs.keyExps.length}건</span>}
            </div>

            {/* ── 성과 KPI 타일 — 수치가 있는 경험을 한눈에 ── */}
            {(() => {
              const tiles = cs.keyExps
                .map((k, i) => ({ i, k, split: splitMetricValue(k.metric) }))
                .filter(t => t.split);
              if (tiles.length === 0) return null;
              return (
                <div className={`mb-5 grid gap-2.5 ${tiles.length === 1 ? 'grid-cols-1 sm:grid-cols-2' : tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  {tiles.map(({ i, k, split }) => {
                    const before = parseMetricNum(k.beforeMetric);
                    const after = parseMetricNum(k.metric);
                    const delta = before != null && after != null && before !== 0
                      ? Math.round(((after - before) / Math.abs(before)) * 100)
                      : null;
                    return (
                      <div key={k.id} className="relative overflow-hidden rounded-xl border border-surface-200 bg-white px-4 py-3.5">
                        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: ACCENT }} />
                        <p className="mb-1.5 truncate text-[10.5px] font-bold uppercase tracking-wide text-bluewood-300">{k.title || `핵심 경험 ${i + 1}`}</p>
                        <p className="text-[26px] font-extrabold leading-none text-bluewood-900">
                          {split.value}<span className="ml-0.5 text-[14px] font-bold text-bluewood-400">{split.unit}</span>
                        </p>
                        {delta != null ? (
                          <p className="mt-1.5 text-[11px] font-bold text-bluewood-600">
                            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}% <span className="font-medium text-bluewood-300">이전 대비</span>
                          </p>
                        ) : (
                          <p className="mt-1.5 truncate text-[11px] text-bluewood-400">{k.metric}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── 경험 리포트 카드 — 전부 펼쳐진 보고서 형태 ── */}
            <div className="space-y-4">
              {cs.keyExps.map((k, i) => {
                const before = parseMetricNum(k.beforeMetric);
                const after = parseMetricNum(k.metric);
                const showBars = before != null && after != null && before !== after;
                const maxV = showBars ? (Math.max(Math.abs(before), Math.abs(after)) || 1) : 1;
                const afterSplit = splitMetricValue(k.metric);
                return (
                  <div key={k.id} className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
                    {/* 헤더 — 번호 + 제목 */}
                    <div className="flex items-start gap-2.5 px-5 pt-4">
                      <span className="mt-1 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md text-[11px] font-black text-white" style={{ backgroundColor: ACCENT }}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <AutoText
                          prose
                          value={k.title}
                          onChange={(v) => setKeyExp(k.id, 'title', v)}
                          placeholder={`핵심 경험 ${i + 1}`}
                          className="text-[15px] sm:text-[16px] font-extrabold leading-snug text-bluewood-900"
                        />
                      </div>
                      <button type="button" onClick={() => removeKeyExp(k.id)} className="flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-bluewood-300 hover:bg-red-50 hover:text-red-500">삭제</button>
                    </div>

                    {/* 성과 — 시각 지표 (전/후 값이 있으면 한 색상 두 명암의 비교 막대) */}
                    <div className="mx-5 mt-2.5 rounded-xl border border-surface-100 bg-surface-50/70 px-4 py-3">
                      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
                        <div className="min-w-[200px] flex-1">
                          <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: ACCENT }}>성과</p>
                          <AutoText
                            dense
                            value={k.metric}
                            onChange={(v) => setKeyExp(k.id, 'metric', v)}
                            placeholder="성과·수치 (예: 저장률 35% 증가)"
                            className="text-[14.5px] font-extrabold text-bluewood-900"
                          />
                          <div className="mt-0.5 flex items-baseline gap-1.5">
                            <span className="flex-shrink-0 text-[10px] font-semibold text-bluewood-300">이전 값 (선택)</span>
                            <div className="w-32">
                              <AutoText
                                dense
                                value={k.beforeMetric}
                                onChange={(v) => setKeyExp(k.id, 'beforeMetric', v)}
                                placeholder="예: 800"
                                className="text-[12px] font-semibold text-bluewood-500"
                              />
                            </div>
                          </div>
                        </div>
                        {showBars && (
                          <div className="w-full space-y-1.5 self-center sm:w-[240px] sm:flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <span className="w-6 flex-shrink-0 text-[10px] font-bold text-bluewood-300">이전</span>
                              <div className="h-2.5 flex-1 overflow-hidden rounded bg-surface-100">
                                <span className="block h-full rounded" style={{ width: `${(Math.abs(before) / maxV) * 100}%`, backgroundColor: ACCENT_LIGHT, transition: 'width 0.6s' }} />
                              </div>
                              <span className="w-14 flex-shrink-0 text-right text-[11px] font-bold tabular-nums text-bluewood-500">{k.beforeMetric}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-6 flex-shrink-0 text-[10px] font-bold text-bluewood-600">이후</span>
                              <div className="h-2.5 flex-1 overflow-hidden rounded bg-surface-100">
                                <span className="block h-full rounded" style={{ width: `${(Math.abs(after) / maxV) * 100}%`, backgroundColor: ACCENT, transition: 'width 0.6s' }} />
                              </div>
                              <span className="w-14 flex-shrink-0 text-right text-[11px] font-black tabular-nums text-bluewood-900">{afterSplit ? `${afterSplit.value}${afterSplit.unit}` : ''}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 문제/실행/결과/배운점 — 2열 리포트 */}
                    <div className="grid gap-x-6 gap-y-2.5 px-5 py-4 sm:grid-cols-2">
                      {KE_ROWS.map(r => (
                        <div key={r.key}>
                          <p className="mb-0.5 text-[10.5px] font-bold uppercase tracking-wide text-bluewood-300">{r.label}</p>
                          <AutoText
                            dense
                            value={k[r.key]}
                            onChange={(v) => setKeyExp(k.id, r.key, v)}
                            placeholder={`${r.label} 입력`}
                            className={`text-[12.5px] leading-[1.5] ${r.strong ? 'font-semibold text-bluewood-900' : 'text-bluewood-600'}`}
                          />
                        </div>
                      ))}
                    </div>

                    {/* 사진 */}
                    <div className="px-5 pb-4">
                      {k.images.length > 0 && (
                        <div className="mb-2 flex flex-col gap-2.5">
                          {k.images.map(im => (
                            <ResizableFigure
                              key={im.id}
                              src={im.url}
                              width={im.width}
                              onWidth={(w) => setKeyExpImage(k.id, im.id, { width: w })}
                              onReplace={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setKeyExpImage(k.id, im.id, { url: await resizeToBase64(f) }); } catch { toast.error('사진 처리에 실패했어요.'); } }}
                              onDelete={() => deleteKeyExpImage(k.id, im.id)}
                            />
                          ))}
                        </div>
                      )}
                      <button type="button" onClick={() => addKeyExpImage(k.id)} className="rounded-md border border-surface-200 px-2.5 py-1 text-[11px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600">＋ 사진</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addKeyExp} className="mt-4 w-full rounded-lg border border-dashed border-surface-300 py-2.5 text-[12.5px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600 transition-colors">＋ 핵심 경험 추가</button>
            </>)}

          </section>
        </div>
        )}

        {/* 하단 CTA */}
        <div className="mt-9 flex flex-wrap gap-3 border-t border-surface-200 pt-7 print:hidden">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-5 py-3 rounded-xl bg-primary-600 text-white text-[14px] font-bold hover:bg-primary-700 disabled:opacity-40 transition-colors shadow-sm shadow-primary-600/20"
          >
            {saving ? '저장 중…' : '저장하기'}
          </button>
          <button onClick={() => guardedNav(`/app/experience/structured/${id}`)} className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-white border border-surface-200 text-bluewood-700 text-[14px] font-bold hover:bg-surface-50 hover:border-surface-300 transition-colors">
            자세히 보기로 전환
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </button>
          {isMarketer && (
            <button onClick={() => window.print()} title="브라우저 인쇄 창에서 'PDF로 저장'을 선택하세요" className="px-5 py-3 rounded-xl bg-white border border-surface-200 text-bluewood-700 text-[14px] font-bold hover:bg-surface-50 hover:border-surface-300 transition-colors">
              PDF로 저장
            </button>
          )}
        </div>
      </article>
    </div>
    </>
  );
}
