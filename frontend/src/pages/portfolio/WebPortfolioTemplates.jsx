/**
 * WebPortfolioTemplates — 노션식 문서 레이아웃을 벗어난 "웹사이트형" 포트폴리오 템플릿 3종.
 * 실제 개인 웹사이트에서 쓰이는 3가지 대표 유형을 기반으로 제작 (뷰 전용, 수정 UI 없음):
 *
 *  web-1 「Bold One-Page」  : 어워즈형 원페이지 랜딩 — 풀스크린 히어로 + 초대형 타이포,
 *                             스킬 마퀴 티커, 넘버링된 풀와이드 프로젝트 쇼케이스, 블랙 CTA 푸터
 *  web-2 「Bento Grid」     : bento.me / Apple식 타일 대시보드 — 한 화면에 프로필·프로젝트·
 *                             스탯·스킬·연락처를 타일로 조합, hover 인터랙션
 *  web-3 「Editorial Finder」: 초대형 검색형 타이포 + 선형 프로젝트 아카이브
 *  web-6 「Impact Grid」     : 미션 문구 + 가로 프로젝트 레일 + 임팩트 카드
 *
 * 공통: portfolio 객체를 받아 렌더만 한다. 스크롤 리빌은 IntersectionObserver 기반.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, Phone, Globe, MapPin, ArrowUpRight, ArrowDown, ExternalLink, Search, Plane, Film, Palette, PenTool, LayoutGrid, Code, Plus, X, ImagePlus, Trash2, Database, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { mapPortfolioToTemplateData, EditText, EditTextarea, VHtml, inlineHtmlToPlainText } from './VisualPortfolioTemplates';

const ProjectDetailModal = lazy(() => import('../../components/ProjectDetailModal'));

// ── 테마 (배경/글자/포인트 3색 — 사용자 커스텀은 portfolio.webTheme 에 저장) ──

export const DEFAULT_WEB_THEMES = {
  'web-1': { bg: '#f4f1ea', ink: '#141414', accent: '#ff4d00' },
  'web-2': { bg: '#eef0f4', ink: '#0f172a', accent: '#002a61' },
  'web-3': { bg: '#f5f5f2', ink: '#090909', accent: '#b7ff22' },
  'web-4': { bg: '#ffffff', ink: '#1b1b1b', accent: '#1E3FA0' },
  'web-5': { bg: '#d7d9db', ink: '#171717', accent: '#171717' },
  'web-6': { bg: '#ffffff', ink: '#111111', accent: '#00bd66' },
};

export const WEB_THEME_PRESETS = {
  'web-1': [
    { name: '크림 오렌지', bg: '#f4f1ea', ink: '#141414', accent: '#ff4d00' },
    { name: '아이보리 블루', bg: '#f6f5f0', ink: '#101425', accent: '#2743ff' },
    { name: '민트 그린', bg: '#eef4ee', ink: '#0d2b1a', accent: '#0d9455' },
    { name: '블러시 핑크', bg: '#f9f0f0', ink: '#2a0f14', accent: '#e0355c' },
    { name: '옐로 블랙', bg: '#f7e94e', ink: '#111111', accent: '#111111' },
    { name: '다크 네온', bg: '#141414', ink: '#f4f1ea', accent: '#d6ff3f' },
  ],
  'web-3': [
    { name: '에디토리얼 라임', bg: '#f5f5f2', ink: '#090909', accent: '#b7ff22' },
    { name: '화이트 핑크', bg: '#ffffff', ink: '#111111', accent: '#ff3b9d' },
    { name: '페이퍼 블루', bg: '#eef4ff', ink: '#101828', accent: '#3974ff' },
    { name: '크림 오렌지', bg: '#fff9ee', ink: '#17120d', accent: '#ff6b2c' },
    { name: '민트 블랙', bg: '#effaf3', ink: '#0c1b12', accent: '#39e58c' },
    { name: '나이트 라임', bg: '#11120f', ink: '#f4f5ef', accent: '#b7ff22' },
  ],
  'web-4': [
    { name: '로열 블루', bg: '#ffffff', ink: '#1b1b1b', accent: '#1E3FA0' },
    { name: '포레스트', bg: '#ffffff', ink: '#14201a', accent: '#1a5c3a' },
    { name: '와인', bg: '#fffbf7', ink: '#26100e', accent: '#8c1f2f' },
    { name: '블랙', bg: '#ffffff', ink: '#111111', accent: '#111111' },
    { name: '코랄', bg: '#fffaf5', ink: '#331408', accent: '#e8542f' },
    { name: '퍼플', bg: '#fdfbff', ink: '#1c1026', accent: '#6d28d9' },
  ],
  'web-6': [
    { name: '임팩트 그린', bg: '#ffffff', ink: '#111111', accent: '#00bd66' },
    { name: '소셜 블루', bg: '#ffffff', ink: '#101828', accent: '#246bfe' },
    { name: '웜 코랄', bg: '#fffdf9', ink: '#24130f', accent: '#ff5c45' },
    { name: '퍼플 임팩트', bg: '#fdfbff', ink: '#1d1127', accent: '#8b5cf6' },
    { name: '선샤인', bg: '#fffef5', ink: '#17150b', accent: '#f4cf22' },
    { name: '다크 임팩트', bg: '#111312', ink: '#f4f7f5', accent: '#39e58c' },
  ],
};

export function getWebTheme(portfolio) {
  const base = DEFAULT_WEB_THEMES[portfolio?.templateId] || DEFAULT_WEB_THEMES['web-1'];
  const custom = portfolio?.webTheme || {};
  return {
    bg: custom.bg || base.bg,
    ink: custom.ink || base.ink,
    accent: custom.accent || base.accent,
  };
}

/** hex(#rgb/#rrggbb) + 알파(0~1) → rgba 8자리 hex */
export function alphaHex(hex, a) {
  let h = String(hex || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const byte = Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0');
  return `#${h.slice(0, 6)}${byte}`;
}

// ── 편집 프리미티브 (edit 없으면 순수 뷰) ─────────────────────────────────────

/** 한 줄 텍스트: 편집=EditText / 뷰=VHtml */
function WT({ edit, value, onChange, className = '', placeholder = '클릭하여 입력', as = 'span' }) {
  if (edit) return <EditText value={value} onChange={onChange} placeholder={placeholder} className={className} />;
  return <VHtml as={as} value={value} className={className} />;
}

/** 여러 줄 텍스트 */
function WTArea({ edit, value, onChange, className = '', placeholder = '클릭하여 입력' }) {
  if (edit) return <EditTextarea value={value} onChange={onChange} placeholder={placeholder} className={className} />;
  return <VHtml as="div" value={value} className={`${className} whitespace-pre-wrap`} />;
}

/** 항목 삭제 × (hover 시 표시) */
function WRm({ edit, onClick }) {
  if (!edit) return null;
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick(); }}
      className="absolute -top-2 -right-2 z-20 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
      <X size={8} />
    </button>
  );
}

/** 항목 추가 버튼 */
function WAdd({ edit, onClick, label, tone = 'rgba(0,0,0,.35)' }) {
  if (!edit) return null;
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed rounded-lg text-xs font-bold opacity-70 hover:opacity-100 transition-opacity mt-3"
      style={{ borderColor: tone, color: tone }}>
      <Plus size={9.6} /> {label}
    </button>
  );
}

/** 템플릿 고정 카피도 portfolio.webCopy에 저장해 화면에서 직접 바꿀 수 있게 한다. */
function WCopy({ portfolio, edit, copyKey, defaultValue, className = '', placeholder, as = 'span' }) {
  const value = portfolio?.webCopy?.[copyKey] ?? defaultValue;
  const onChange = (nextValue) => edit?.update('webCopy', { ...(portfolio.webCopy || {}), [copyKey]: nextValue });
  return <WT edit={edit} value={value} onChange={onChange} className={className} placeholder={placeholder || inlineHtmlToPlainText(defaultValue)} as={as} />;
}

function WImportExperience({ edit, tone }) {
  if (!edit) return null;
  return (
    <button type="button" onClick={() => edit.openExperiencePicker?.()}
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs font-bold opacity-75 transition-opacity hover:opacity-100"
      style={{ borderColor: tone, color: tone }}>
      <Database size={9.6} /> 내 경험정리에서 추가
    </button>
  );
}

/** 프로젝트 카드의 빈 영역을 누르면 상세 모달을 열고, 인라인 편집 컨트롤의 클릭은 그대로 유지한다. */
function projectCardInteraction(onOpenProject, idx, title) {
  if (!onOpenProject) return {};
  const open = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button, a, input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
    onOpenProject(idx);
  };
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': `${inlineHtmlToPlainText(title || '') || `프로젝트 ${idx + 1}`} 상세 보기`,
    onClick: open,
    onKeyDown: (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
        event.preventDefault();
        onOpenProject(idx);
      }
    },
  };
}

/** 스킬을 (카테고리,인덱스) 포함 평탄 목록으로 */
function flatSkills(portfolio) {
  const out = [];
  ['tools', 'languages', 'frameworks', 'others'].forEach(cat => {
    (portfolio?.skills?.[cat] || []).forEach((s, idx) => {
      const name = typeof s === 'string' ? s : (s?.name || '');
      if (name || true) out.push({ name, cat, idx });
    });
  });
  return out;
}

/** 순수 텍스트 첫 줄 (HTML 제거) */
function firstLine(value) {
  return inlineHtmlToPlainText(String(value || '')).split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
}

// ── 공통 유틸 ────────────────────────────────────────────────────────────────

function projImg(proj) {
  const t = proj?.thumbnailUrl;
  if (typeof t === 'string' && t.trim()) return t;
  if (t && typeof t === 'object' && typeof t.url === 'string' && t.url.trim()) return t.url;
  return null; // 웹 템플릿은 로고 폴백 대신 그라디언트 플레이스홀더 사용
}

const IMAGE_ASPECT_OPTIONS = [
  ['3 / 2', '에디토리얼'],
  ['16 / 10', '가로형'],
  ['16 / 9', '와이드'],
  ['4 / 3', '기본'],
  ['1 / 1', '정사각'],
  ['3 / 4', '세로형'],
];

const IMAGE_SHAPES = [
  ['square', '각진', '0px'],
  ['soft', '살짝 둥근', '8px'],
  ['round', '둥근', '22.4px'],
  ['pill', '원·타원', '799.2px'],
  ['arch', '아치', '50% 50% 11.2px 11.2px'],
  ['leaf', '리프', '58% 8% 58% 8%'],
  ['blob', '블롭', '58% 42% 55% 45% / 48% 58% 42% 52%'],
];

function normalizeImageStyle(style = {}, defaultAspect = '16 / 9', defaultShape = 'soft') {
  return {
    positionX: Number.isFinite(Number(style.positionX)) ? Number(style.positionX) : 50,
    positionY: Number.isFinite(Number(style.positionY)) ? Number(style.positionY) : 50,
    zoom: Number.isFinite(Number(style.zoom)) ? Math.min(3, Math.max(0.2, Number(style.zoom))) : 1,
    fit: style.fit === 'contain' ? 'contain' : 'cover',
    aspect: IMAGE_ASPECT_OPTIONS.some(([value]) => value === style.aspect) ? style.aspect : defaultAspect,
    shape: IMAGE_SHAPES.some(([value]) => value === style.shape) ? style.shape : defaultShape,
    backgroundColor: typeof style.backgroundColor === 'string' ? style.backgroundColor : '',
  };
}

function imageFrameStyle(style, defaultAspect, defaultShape = 'soft') {
  const settings = normalizeImageStyle(style, defaultAspect, defaultShape);
  const radius = IMAGE_SHAPES.find(([value]) => value === settings.shape)?.[2] || '8px';
  return { aspectRatio: settings.aspect, borderRadius: radius };
}

function imageContentStyle(settings) {
  const resolved = normalizeImageStyle(settings);
  const origin = `${resolved.positionX}% ${resolved.positionY}%`;
  return {
    objectFit: resolved.fit,
    objectPosition: origin,
    transform: `scale(${resolved.zoom})`,
    transformOrigin: origin,
  };
}

function ImageStylePanel({ anchorRef, value, onChange, onReset, onClose, onReplace, onRemove, hasImage = false, fallbackBackground = '#f3f4f6' }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 320, ready: false });
  const patch = (changes) => onChange({ ...value, ...changes });
  const selectedBackground = value.backgroundColor || fallbackBackground;
  const colorPickerValue = /^#[0-9a-f]{6}$/i.test(selectedBackground) ? selectedBackground : fallbackBackground;
  onCloseRef.current = onClose;

  useEffect(() => {
    const placePanel = () => {
      const anchor = anchorRef?.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const panelWidth = Math.min(320, window.innerWidth - 24);
      const panelHeight = Math.min(panelRef.current?.offsetHeight || 390, window.innerHeight - 24);
      const gap = 12;
      let left;
      let top = Math.min(Math.max(12, rect.top), Math.max(12, window.innerHeight - panelHeight - 12));

      if (window.innerWidth - rect.right >= panelWidth + gap) left = rect.right + gap;
      else if (rect.left >= panelWidth + gap) left = rect.left - panelWidth - gap;
      else {
        left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - panelWidth - 12));
        if (window.innerHeight - rect.bottom >= panelHeight + gap) top = rect.bottom + gap;
        else if (rect.top >= panelHeight + gap) top = rect.top - panelHeight - gap;
      }
      setPosition({ left, top, width: panelWidth, ready: true });
    };

    const frame = requestAnimationFrame(placePanel);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(placePanel) : null;
    if (anchorRef?.current) observer?.observe(anchorRef.current);
    if (panelRef.current) observer?.observe(panelRef.current);
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    const onKeyDown = (event) => { if (event.key === 'Escape') onCloseRef.current?.(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchorRef]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[1000] max-h-[calc(100vh-19.2px)] overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950/95 p-4 text-white shadow-2xl backdrop-blur"
      style={{ left: position.left, top: position.top, width: position.width, visibility: position.ready ? 'visible' : 'hidden' }}
      onClick={event => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[9.6px] font-black"><SlidersHorizontal size={10.4} /> 이미지 맞춤</p>
          <p className="mt-0.5 text-[8px] font-semibold text-white/45">이미지를 가리지 않는 외부 편집 패널</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onReset} className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white" title="기본값으로 초기화"><RotateCcw size={9.6} /></button>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="설정 닫기"><X size={10.4} /></button>
        </div>
      </div>

      {onReplace && (
        <div className={`mb-3 grid gap-2 ${hasImage && onRemove ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button
            type="button"
            onClick={onReplace}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[8.8px] font-black text-neutral-800 transition-colors hover:bg-neutral-100"
          >
            <ImagePlus size={10.4} /> {hasImage ? '이미지 변경' : '이미지 추가'}
          </button>
          {hasImage && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-2 text-[8.8px] font-black text-red-300 transition-colors hover:bg-red-500 hover:text-white"
            >
              <Trash2 size={10.4} /> 이미지 삭제
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[8.4px] font-bold">
        <label className="space-y-1">
          <span className="flex justify-between text-white/65"><span>가로 위치</span><span>{Math.round(value.positionX)}%</span></span>
          <input type="range" min="0" max="100" value={value.positionX} onChange={event => patch({ positionX: Number(event.target.value) })} className="w-full accent-white" />
        </label>
        <label className="space-y-1">
          <span className="flex justify-between text-white/65"><span>세로 위치</span><span>{Math.round(value.positionY)}%</span></span>
          <input type="range" min="0" max="100" value={value.positionY} onChange={event => patch({ positionY: Number(event.target.value) })} className="w-full accent-white" />
        </label>
        <label className="col-span-2 space-y-1">
          <span className="flex justify-between text-white/65"><span>이미지 배율</span><span>{value.zoom.toFixed(2)}×</span></span>
          <input type="range" min="0.2" max="3" step="0.05" value={value.zoom} onChange={event => patch({ zoom: Number(event.target.value) })} className="w-full accent-white" />
        </label>
        <label className="space-y-1">
          <span className="text-white/65">채우기</span>
          <select value={value.fit} onChange={event => patch({ fit: event.target.value })} className="w-full rounded-md border border-white/15 bg-white/10 px-2 py-1.5 text-[8.8px] outline-none">
            <option value="cover" className="text-black">프레임 채우기</option>
            <option value="contain" className="text-black">사진 전체 보기</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-white/65">프레임 비율</span>
          <select value={value.aspect} onChange={event => patch({ aspect: event.target.value })} className="w-full rounded-md border border-white/15 bg-white/10 px-2 py-1.5 text-[8.8px] outline-none">
            {IMAGE_ASPECT_OPTIONS.map(([aspect, label]) => <option key={aspect} value={aspect} className="text-black">{label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[8.4px] font-bold text-white/65">프레임 모양</p>
        <div className="grid grid-cols-4 gap-1.5">
          {IMAGE_SHAPES.map(([shape, label, radius]) => (
            <button key={shape} type="button" onClick={() => patch({ shape })}
              className={`flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[7.2px] ${value.shape === shape ? 'border-white bg-white/20 text-white' : 'border-white/10 text-white/55 hover:bg-white/10'}`}>
              <span className="h-5 w-7 border border-current bg-white/10" style={{ borderRadius: radius }} />{label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[8.4px] font-bold text-white/65">빈 여백 배경색</p>
            <p className="mt-0.5 text-[7.6px] text-white/40">이미지를 축소했을 때 남는 공간에 적용됩니다.</p>
          </div>
          <label className="relative h-8 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white/20" style={{ backgroundColor: selectedBackground }}>
            <input
              type="color"
              value={colorPickerValue}
              onChange={event => patch({ backgroundColor: event.target.value })}
              className="absolute -inset-2 h-12 w-16 cursor-pointer opacity-0"
              aria-label="빈 여백 배경색 선택"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={selectedBackground}
            onChange={event => patch({ backgroundColor: event.target.value })}
            className="min-w-0 flex-1 rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 text-[8.8px] font-semibold text-white outline-none focus:border-white/40"
            placeholder="#f3f4f6"
            aria-label="빈 여백 배경색 값"
          />
          <button type="button" onClick={() => patch({ backgroundColor: '' })} className="rounded-md border border-white/10 px-2.5 py-1.5 text-[8px] font-bold text-white/55 hover:bg-white/10 hover:text-white">
            자동
          </button>
        </div>
        <div className="mt-2 flex gap-1.5">
          {['#ffffff', '#f3f4f6', '#111827', '#dbeafe', '#fef3c7', '#dcfce7'].map(color => (
            <button key={color} type="button" onClick={() => patch({ backgroundColor: color })} className="h-5 flex-1 rounded border border-white/15 transition-transform hover:scale-110" style={{ backgroundColor: color }} aria-label={`${color} 배경색 적용`} />
          ))}
        </div>
      </div>
    </div>
    , document.body
  );
}

/** 스크롤 진입 시 [data-reveal] 요소에 .wp-in 클래스 부여 */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(t => t.classList.add('wp-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('wp-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });
    targets.forEach(t => io.observe(t));
    // failsafe: 앵커 점프·인쇄·캡처 등으로 IO를 건너뛴 요소도 일정 시간 후엔 반드시 노출
    const failsafe = setTimeout(() => targets.forEach(t => t.classList.add('wp-in')), 2500);
    return () => { io.disconnect(); clearTimeout(failsafe); };
  }, []);
  return ref;
}

const SHARED_CSS = `
[data-reveal]{opacity:0;transform:translateY(22.4px);transition:opacity .7s cubic-bezier(.2,.65,.3,1),transform .7s cubic-bezier(.2,.65,.3,1)}
[data-reveal].wp-in{opacity:1;transform:none}
@keyframes wp-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes wp-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){
  [data-reveal]{opacity:1;transform:none;transition:none}
  .wp-marquee-track{animation:none!important}
}
`;

const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(135deg,#ffd8c2 0%,#ffb199 55%,#ff8e6e 100%)',
  'linear-gradient(135deg,#c9e4ff 0%,#a7c8f2 55%,#7fa8e0 100%)',
  'linear-gradient(135deg,#d9f2d0 0%,#b2e0a6 55%,#8cc97e 100%)',
  'linear-gradient(135deg,#eadcff 0%,#cdb4f5 55%,#ab8ce8 100%)',
  'linear-gradient(135deg,#ffe9b8 0%,#ffd88a 55%,#f7c14e 100%)',
];

function Thumb({ proj, idx, className = '', label = true, imageStyle }) {
  const src = projImg(proj);
  if (src) return <img src={src} alt="" className={`${className} w-full h-full transition-transform duration-300`} style={imageContentStyle(imageStyle)} loading="lazy" />;
  return (
    <div className={`${className} w-full h-full flex items-center justify-center`} style={{ background: PLACEHOLDER_GRADIENTS[idx % PLACEHOLDER_GRADIENTS.length] }}>
      {label && <span className="font-black text-black/15 select-none" style={{ fontSize: 'clamp(32px,6.4vw,76.8px)' }}>{String(idx + 1).padStart(2, '0')}</span>}
    </div>
  );
}

function EditableThumb({ edit, proj, idx, className = '', label = true, defaultAspect = '16 / 9', defaultShape = 'soft' }) {
  const inputRef = useRef(null);
  const frameRef = useRef(null);
  const src = projImg(proj);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = normalizeImageStyle(proj.imageStyle, defaultAspect, defaultShape);
  const updateSettings = (next) => edit?.updateItem('experiences', idx, { imageStyle: next });
  return (
    <div ref={frameRef} className="group/image relative h-full w-full" style={{ backgroundColor: settings.backgroundColor || '#f3f4f6' }}>
      <Thumb proj={proj} idx={idx} className={className} label={label} imageStyle={settings} />
      {edit && (
        <>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={event => {
            const file = event.target.files?.[0];
            if (file) edit.uploadProjectImage?.(file, idx);
            event.target.value = '';
          }} />
          {!settingsOpen && (
            <button
              type="button"
              onClick={event => { event.stopPropagation(); setSettingsOpen(true); }}
              className="absolute bottom-[8%] left-1/2 z-20 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-neutral-950/90 text-white opacity-0 shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-neutral-800 group-hover/image:opacity-100 group-focus-within/image:opacity-100"
              title="이미지 편집"
              aria-label="이미지 편집 열기"
            >
              <SlidersHorizontal size={11.2} />
            </button>
          )}
          {settingsOpen && (
            <ImageStylePanel
              anchorRef={frameRef}
              value={settings}
              onChange={updateSettings}
              onReset={() => updateSettings(normalizeImageStyle({}, defaultAspect, defaultShape))}
              onClose={() => setSettingsOpen(false)}
              onReplace={() => inputRef.current?.click()}
              onRemove={src ? () => edit.removeProjectImage?.(idx) : undefined}
              hasImage={!!src}
              fallbackBackground="#f3f4f6"
            />
          )}
        </>
      )}
    </div>
  );
}

function EditableProfileImage({ portfolio, edit, accent }) {
  const inputRef = useRef(null);
  const frameRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = normalizeImageStyle(portfolio.profileImageStyle, '1 / 1', 'soft');
  const frameStyle = imageFrameStyle(settings, '1 / 1', 'soft');
  const updateSettings = (next) => edit?.update('profileImageStyle', next);
  return (
    <div ref={frameRef} className="group/profile relative flex w-full items-center justify-center overflow-hidden transition-all" style={{ background: settings.backgroundColor || accent, ...frameStyle }}>
      {portfolio.profileImageUrl
        ? <img src={portfolio.profileImageUrl} alt="" className="h-full w-full transition-transform duration-300" style={imageContentStyle(settings)} />
        : <span className="select-none text-[70.4px]">🐱</span>}
      {edit && (
        <>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={event => {
            const file = event.target.files?.[0];
            if (file) edit.uploadProfileImage?.(file);
            event.target.value = '';
          }} />
          {!settingsOpen && (
            <button
              type="button"
              onClick={event => { event.stopPropagation(); setSettingsOpen(true); }}
              className="absolute bottom-[8%] left-1/2 z-20 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-neutral-950/90 text-white opacity-0 shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-neutral-800 group-hover/profile:opacity-100 group-focus-within/profile:opacity-100"
              title="프로필 이미지 편집"
              aria-label="프로필 이미지 편집 열기"
            >
              <SlidersHorizontal size={11.2} />
            </button>
          )}
          {settingsOpen && (
            <ImageStylePanel
              anchorRef={frameRef}
              value={settings}
              onChange={updateSettings}
              onReset={() => updateSettings(normalizeImageStyle({}, '1 / 1', 'soft'))}
              onClose={() => setSettingsOpen(false)}
              onReplace={() => inputRef.current?.click()}
              onRemove={portfolio.profileImageUrl ? () => edit.update('profileImageUrl', '') : undefined}
              hasImage={!!portfolio.profileImageUrl}
              fallbackBackground={accent}
            />
          )}
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// web-1 · Bold One-Page — 어워즈형 원페이지 랜딩
// ═════════════════════════════════════════════════════════════════════════════

const W1_CSS = `
.w1-proj-img{transition:transform .8s cubic-bezier(.2,.65,.3,1)}
.w1-proj:hover .w1-proj-img{transform:scale(1.04)}
.w1-proj-arrow{transition:transform .35s ease}
.w1-proj:hover .w1-proj-arrow{transform:translate(4.8px,-4.8px)}
`;

export function WebTemplate1({ portfolio, edit, embedded = false, onOpenProject }) {
  const th = getWebTheme(portfolio);
  const data = mapPortfolioToTemplateData(portfolio);
  const rootRef = useReveal();
  const skills = edit ? flatSkills(portfolio) : (data.skills || []).map((s, i) => ({ name: s.name, cat: null, idx: i })).filter(s => s.name);
  const tickerItems = skills.length ? skills.map(s => s.name) : ['PORTFOLIO'];
  const projList = edit
    ? (portfolio.experiences || [])
    : data.projects.map((project, idx) => ({ ...project, imageStyle: portfolio.experiences?.[idx]?.imageStyle || {} }));
  const expList = edit ? (portfolio.experiences || []) : data.experience;
  const eduList = edit ? (portfolio.education || []) : data.education;
  const awardList = edit ? (portfolio.awards || []) : data.awards;
  const contact = edit ? (portfolio.contact || {}) : { email: data.email, phone: data.phone, website: data.social?.blog };
  const introText = portfolio.webIntro || firstLine(portfolio.about || data.about);
  const ink = (a) => alphaHex(th.ink, a);

  return (
    <div ref={rootRef} className="relative min-h-screen font-sans antialiased overflow-x-hidden" style={{ background: th.bg, color: th.ink }}>
      <style>{SHARED_CSS + W1_CSS}</style>

      {/* 고정 상단 바 */}
      <header className={`${embedded ? 'absolute' : 'fixed'} top-0 inset-x-0 z-40 flex items-center justify-between px-5 md:px-10 py-4 mix-blend-difference text-white ${edit ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <span className="text-[10.4px] font-black tracking-[0.2em] uppercase">
          <WT edit={edit} value={edit ? portfolio.userName : data.name} onChange={value => edit?.update('userName', value)} placeholder="이름" />
        </span>
        <div className="hidden md:flex items-center gap-2 text-[9.6px] font-bold tracking-[0.14em] uppercase">
          <span className="w-2 h-2 rounded-full bg-[#3fff8c]" style={{ animation: 'wp-pulse 2s infinite' }} />
          <WCopy portfolio={portfolio} edit={edit} copyKey="w1Availability" defaultValue="Open to Work" />
        </div>
        <span className="text-[9.6px] font-bold tracking-[0.14em] uppercase underline underline-offset-4"><WCopy portfolio={portfolio} edit={edit} copyKey="w1HeaderContact" defaultValue="Contact" /></span>
      </header>

      {/* 히어로 — 풀 뷰포트 */}
      <section className="min-h-screen flex flex-col justify-between px-5 md:px-10 pt-24 pb-8 relative">
        <div className="flex-1 flex flex-col justify-center">
          <p data-reveal className="text-[10.4px] md:text-[12px] font-bold tracking-[0.3em] uppercase mb-6" style={{ color: th.accent }}>
            <WCopy portfolio={portfolio} edit={edit} copyKey="w1Eyebrow" defaultValue="Portfolio" /> — {new Date().getFullYear()}
          </p>
          <h1 data-reveal className="font-black leading-[0.95] tracking-tighter" style={{ fontSize: 'clamp(44.8px,10.4vw,136px)', wordBreak: 'keep-all' }}>
            <WT edit={edit} value={edit ? portfolio.userName : data.name} onChange={v => edit?.update('userName', v)} placeholder="이름" />
          </h1>
          <h2 data-reveal className="font-black leading-[0.95] tracking-tighter mt-1" style={{ fontSize: 'clamp(24px,5.2vw,67.2px)', wordBreak: 'keep-all', WebkitTextStroke: `2px ${th.ink}`, color: 'transparent', caretColor: th.ink }}>
            <WT edit={edit} value={edit ? portfolio.headline : data.title} onChange={v => edit?.update('headline', v)} placeholder="한 줄 소개" />
          </h2>
          <div data-reveal className="mt-10 max-w-xl">
            <div className="text-[12px] md:text-[13.6px] leading-[1.85]" style={{ wordBreak: 'keep-all', color: ink(0.7) }}>
              <WTArea edit={edit} value={introText} onChange={v => edit?.update('webIntro', v)} placeholder="첫 화면에 보일 짧은 소개" />
            </div>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-6 text-[9.6px] font-bold tracking-[0.16em] uppercase" style={{ color: ink(0.5) }}>
            <span className="inline-flex items-center gap-1.5"><MapPin size={9.6} />
              <WT edit={edit} value={portfolio.location || data.location} onChange={v => edit?.update('location', v)} placeholder="지역" />
            </span>
            <span>{projList.length} <WCopy portfolio={portfolio} edit={edit} copyKey="w1ProjectCountLabel" defaultValue="Projects" /></span>
          </div>
          <div className="flex items-center gap-2 text-[9.6px] font-bold tracking-[0.2em] uppercase" style={{ color: ink(0.5) }}>
            <WCopy portfolio={portfolio} edit={edit} copyKey="w1ScrollLabel" defaultValue="Scroll" /> <ArrowDown size={10.4} className="animate-bounce" />
          </div>
        </div>
      </section>

      {/* 스킬 티커 — 편집 모드에서는 정지 상태로 칩 편집 */}
      <div className="py-4 md:py-5 -rotate-1 scale-[1.02] overflow-hidden select-none" style={{ background: th.ink, color: th.bg }}>
        {edit ? (
          <div className="flex flex-wrap items-center gap-y-2 px-8 select-auto">
            {skills.map((s, i) => (
              <span key={`${s.cat}-${s.idx}-${i}`} className="relative group flex items-center text-[14.4px] md:text-[17.6px] font-black uppercase tracking-wide">
                <WRm edit={edit} onClick={() => edit.removeSkill(s.cat, s.idx)} />
                <span className="px-4"><EditText value={s.name} onChange={v => edit.updateSkill(s.cat, s.idx, inlineHtmlToPlainText(v))} placeholder="스킬" /></span>
                <span style={{ color: th.accent }}>✦</span>
              </span>
            ))}
            <button type="button" onClick={() => edit.addSkill()} className="ml-4 inline-flex items-center gap-1 text-[10.4px] font-bold opacity-70 hover:opacity-100"><Plus size={10.4} /> 스킬</button>
          </div>
        ) : (
          <div className="wp-marquee-track flex whitespace-nowrap w-max" style={{ animation: 'wp-marquee 22s linear infinite' }}>
            {[0, 1].map(dup => (
              <div key={dup} className="flex items-center">
                {tickerItems.map((s, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center text-[14.4px] md:text-[19.2px] font-black uppercase tracking-wide">
                    <span className="px-5">{s}</span><span style={{ color: th.accent }}>✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* About + 스탯 */}
      <section className="px-5 md:px-10 py-24 md:py-36">
        <div className="max-w-6xl mx-auto grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <p data-reveal className="text-[10.4px] font-black tracking-[0.3em] uppercase mb-5" style={{ color: th.accent }}><WCopy portfolio={portfolio} edit={edit} copyKey="w1AboutLabel" defaultValue="About" /></p>
            <h3 data-reveal className="text-[22.4px] md:text-[28.8px] font-black leading-[1.25] tracking-tight" style={{ wordBreak: 'keep-all' }}>
              <WT edit={edit} value={edit ? portfolio.headline : data.title} onChange={v => edit?.update('headline', v)} placeholder="한 줄 소개" />
            </h3>
          </div>
          <div className="md:col-span-7">
            <div data-reveal className="text-[12.8px] md:text-[13.6px] leading-[2]" style={{ wordBreak: 'keep-all', color: ink(0.75) }}>
              <WTArea edit={edit} value={edit ? (portfolio.about || '') : data.about} onChange={v => edit?.update('about', v)} placeholder="자기소개를 입력하세요" />
            </div>
            <div data-reveal className="mt-12 grid grid-cols-3 border-t-2" style={{ borderColor: th.ink }}>
              {[
                [String(expList.length).padStart(2, '0'), '경험 · 프로젝트', 'w1StatProjects'],
                [String(awardList.length).padStart(2, '0'), '수상 · 자격', 'w1StatAwards'],
                [`${skills.length}+`, '스킬', 'w1StatSkills'],
              ].map(([num, label, copyKey]) => (
                <div key={copyKey} className="pt-5 pr-4">
                  <p className="text-[32px] md:text-[43.2px] font-black leading-none tracking-tight">{num}</p>
                  <p className="mt-2 text-[9.6px] font-bold tracking-[0.14em] uppercase" style={{ color: ink(0.5) }}><WCopy portfolio={portfolio} edit={edit} copyKey={copyKey} defaultValue={label} /></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Selected Works — 넘버링 풀와이드 쇼케이스 */}
      <section className="px-5 md:px-10 pb-10">
        <div className="max-w-6xl mx-auto">
          <div data-reveal className="flex items-end justify-between border-b-2 pb-5 mb-4" style={{ borderColor: th.ink }}>
            <h3 className="font-black tracking-tighter leading-none" style={{ fontSize: 'clamp(32px,5.6vw,70.4px)' }}><WCopy portfolio={portfolio} edit={edit} copyKey="w1WorksLabel" defaultValue="WORKS" /></h3>
            <span className="text-[10.4px] font-black tracking-[0.2em] uppercase pb-2" style={{ color: ink(0.5) }}>({projList.length})</span>
          </div>
          {projList.map((proj, idx) => {
            const tech = edit ? (proj.skills || []) : (proj.techStack || []);
            return (
              <article
                key={idx}
                data-reveal
                className="w1-proj group border-b py-12 md:py-16 grid md:grid-cols-12 gap-8 items-center cursor-pointer relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                style={{ borderColor: ink(0.15), outlineColor: th.accent }}
                {...projectCardInteraction(onOpenProject, idx, edit ? (proj.company || proj.title) : proj.name)}
              >
                <WRm edit={edit} onClick={() => edit.removeItem('experiences', idx)} />
                <div className={`md:col-span-6 ${idx % 2 ? 'md:order-2' : ''}`}>
                  <div className="overflow-hidden transition-all" style={imageFrameStyle(proj.imageStyle, '16 / 10', 'square')}>
                    <EditableThumb edit={edit} proj={proj} idx={idx} className="w1-proj-img" defaultAspect="16 / 10" defaultShape="square" />
                  </div>
                </div>
                <div className={`md:col-span-6 ${idx % 2 ? 'md:order-1 md:pr-8' : 'md:pl-8'}`}>
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    <span className="text-[10.4px] font-black" style={{ color: th.accent }}>{String(idx + 1).padStart(2, '0')}</span>
                    <span className="text-[8.8px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 border rounded-full" style={{ borderColor: ink(0.25) }}>
                      <WT edit={edit} value={proj.tag || 'Project'} onChange={v => edit?.updateItem('experiences', idx, { tag: inlineHtmlToPlainText(v) })} placeholder="태그" />
                    </span>
                    <span className="text-[9.6px] font-semibold" style={{ color: ink(0.4) }}>
                      <WT edit={edit} value={proj.period || ''} onChange={v => edit?.updateItem('experiences', idx, { period: inlineHtmlToPlainText(v) })} placeholder="기간" />
                    </span>
                  </div>
                  <h4 className="text-[20.8px] md:text-[27.2px] font-black tracking-tight leading-[1.15] flex items-start gap-2" style={{ wordBreak: 'keep-all' }}>
                    <WT edit={edit} value={edit ? (proj.company || proj.title || '') : proj.name} onChange={v => edit?.updateItem('experiences', idx, { company: v, title: v })} placeholder="프로젝트명" />
                    <ArrowUpRight className="w1-proj-arrow shrink-0 mt-1.5" size={17.6} style={{ color: th.accent }} />
                  </h4>
                  <div className="mt-4 text-[11.6px] leading-[1.85]" style={{ wordBreak: 'keep-all', color: ink(0.65) }}>
                    <WTArea edit={edit} value={edit ? (proj.description || '') : proj.desc} onChange={v => edit?.updateItem('experiences', idx, { description: v })} placeholder="프로젝트 설명" className={edit ? '' : 'line-clamp-3'} />
                  </div>
                  {(tech.length > 0 || edit) && (
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      {tech.slice(0, 6).map((t, ti) => (
                        <span key={ti} className="relative group/chip text-[9.6px] font-bold tracking-[0.08em] uppercase" style={{ color: ink(0.45) }}>
                          {edit
                            ? <>
                                <EditText value={typeof t === 'string' ? t : t?.name || ''} onChange={v => {
                                  const arr = [...(proj.skills || [])]; arr[ti] = inlineHtmlToPlainText(v);
                                  edit.updateItem('experiences', idx, { skills: arr });
                                }} placeholder="기술" />
                                <button type="button" onClick={() => {
                                  const arr = [...(proj.skills || [])]; arr.splice(ti, 1);
                                  edit.updateItem('experiences', idx, { skills: arr });
                                }} className="absolute -top-2.5 -right-2.5 w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center hidden group-hover/chip:flex"><X size={7.2} /></button>
                              </>
                            : (typeof t === 'string' ? t : t?.name)}
                        </span>
                      ))}
                      {edit && (
                        <button type="button" onClick={() => edit.updateItem('experiences', idx, { skills: [...(proj.skills || []), ''] })}
                          className="text-[8.8px] font-bold opacity-50 hover:opacity-100"><Plus size={9.6} className="inline" /> 기술</button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          <WImportExperience edit={edit} tone={ink(0.45)} />
        </div>
      </section>

      {/* Experience — 라인 테이블 */}
      {(expList.length > 0 || edit) && (
        <section className="px-5 md:px-10 py-24">
          <div className="max-w-6xl mx-auto">
            <p data-reveal className="text-[10.4px] font-black tracking-[0.3em] uppercase mb-8" style={{ color: th.accent }}><WCopy portfolio={portfolio} edit={edit} copyKey="w1ExperienceLabel" defaultValue="Experience" /></p>
            {expList.map((exp, idx) => (
              <div key={idx} data-reveal className="grid md:grid-cols-12 gap-2 md:gap-8 py-6 border-t items-baseline relative group" style={{ borderColor: ink(0.15) }}>
                <span className="md:col-span-3 text-[10.4px] font-bold" style={{ color: ink(0.4) }}>
                  <WT edit={edit} value={exp.period || '—'} onChange={v => edit?.updateItem('experiences', idx, { period: inlineHtmlToPlainText(v) })} placeholder="기간" />
                </span>
                <span className="md:col-span-5 text-[15.2px] md:text-[17.6px] font-black tracking-tight" style={{ wordBreak: 'keep-all' }}>
                  <WT edit={edit} value={exp.company || exp.title || ''} onChange={v => edit?.updateItem('experiences', idx, { company: v, title: v })} placeholder="경험명" />
                </span>
                <span className="md:col-span-4 text-[11.2px] font-semibold" style={{ color: ink(0.55) }}>
                  <WT edit={edit} value={exp.role || ''} onChange={v => edit?.updateItem('experiences', idx, { role: v })} placeholder="역할" />
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 학력 · 수상 */}
      {(eduList.length > 0 || awardList.length > 0 || edit) && (
        <section className="px-5 md:px-10 pb-24">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14">
            <div data-reveal>
              <p className="text-[10.4px] font-black tracking-[0.3em] uppercase mb-6" style={{ color: th.accent }}><WCopy portfolio={portfolio} edit={edit} copyKey="w1EducationLabel" defaultValue="Education" /></p>
              {eduList.map((edu, i) => (
                <div key={i} className="py-4 border-t relative group" style={{ borderColor: ink(0.15) }}>
                  <WRm edit={edit} onClick={() => edit.removeItem('education', i)} />
                  <p className="text-[13.6px] font-black">
                    <WT edit={edit} value={edit ? (edu.name || edu.school || '') : edu.school} onChange={v => edit?.updateItem('education', i, { name: v })} placeholder="학교명" />
                  </p>
                  <p className="text-[10.8px] mt-0.5" style={{ color: ink(0.55) }}>
                    <WT edit={edit} value={edit ? (edu.degree || edu.major || '') : edu.major} onChange={v => edit?.updateItem('education', i, { degree: v })} placeholder="전공/학위" />
                  </p>
                  <p className="text-[9.6px] font-bold mt-1" style={{ color: ink(0.35) }}>
                    <WT edit={edit} value={edu.period || ''} onChange={v => edit?.updateItem('education', i, { period: inlineHtmlToPlainText(v) })} placeholder="기간" />
                  </p>
                </div>
              ))}
              <WAdd edit={edit} onClick={() => edit.addItem('education', { name: '', degree: '', period: '' })} label="학력 추가" tone={ink(0.45)} />
            </div>
            <div data-reveal>
              <p className="text-[10.4px] font-black tracking-[0.3em] uppercase mb-6" style={{ color: th.accent }}><WCopy portfolio={portfolio} edit={edit} copyKey="w1AwardsLabel" defaultValue="Awards" /></p>
              {awardList.map((award, i) => (
                <div key={i} className="py-4 border-t flex items-baseline justify-between gap-4 relative group" style={{ borderColor: ink(0.15) }}>
                  <WRm edit={edit} onClick={() => edit.removeItem('awards', i)} />
                  <p className="text-[12.8px] font-black" style={{ wordBreak: 'keep-all' }}>
                    <WT edit={edit} value={award.title || ''} onChange={v => edit?.updateItem('awards', i, { title: v })} placeholder="수상명" />
                  </p>
                  <p className="text-[9.6px] font-bold shrink-0" style={{ color: ink(0.35) }}>
                    <WT edit={edit} value={award.date || ''} onChange={v => edit?.updateItem('awards', i, { date: inlineHtmlToPlainText(v) })} placeholder="날짜" />
                  </p>
                </div>
              ))}
              <WAdd edit={edit} onClick={() => edit.addItem('awards', { title: '', date: '' })} label="수상/자격 추가" tone={ink(0.45)} />
            </div>
          </div>
        </section>
      )}

      {/* CTA 푸터 */}
      <footer className="px-5 md:px-10 pt-24 pb-10" style={{ background: th.ink, color: th.bg }}>
        <div className="max-w-6xl mx-auto">
          <p data-reveal className="text-[10.4px] font-black tracking-[0.3em] uppercase mb-6" style={{ color: th.accent }}><WCopy portfolio={portfolio} edit={edit} copyKey="w1ContactLabel" defaultValue="Contact" /></p>
          <h3 data-reveal className="font-black tracking-tighter leading-[0.95] mb-12" style={{ fontSize: 'clamp(35.2px,7.2vw,96px)', wordBreak: 'keep-all' }}>
            <WCopy portfolio={portfolio} edit={edit} copyKey="w1Cta" defaultValue={"LET'S WORK<br>TOGETHER"} /><span style={{ color: th.accent }}>.</span>
          </h3>
          <div data-reveal className="inline-flex items-center gap-3 text-[16px] md:text-[22.4px] font-black border-b-[2.4px] pb-1.5" style={{ borderColor: th.accent }}>
            {edit
              ? <EditText value={contact.email || ''} onChange={v => edit.updateContact('email', inlineHtmlToPlainText(v))} placeholder="이메일" />
              : (contact.email ? <a href={`mailto:${contact.email}`} className="hover:opacity-70 transition-opacity">{contact.email}</a> : null)}
            <ArrowUpRight size={20.8} />
          </div>
          <div className="mt-20 pt-6 border-t flex flex-wrap items-center justify-between gap-3 text-[9.6px] font-bold tracking-[0.14em] uppercase" style={{ borderColor: alphaHex(th.bg, 0.15), color: alphaHex(th.bg, 0.45) }}>
            <span>© {new Date().getFullYear()} <WT edit={edit} value={edit ? portfolio.userName : data.name} onChange={value => edit?.update('userName', value)} placeholder="이름" /></span>
            <div className="flex items-center gap-6">
              <WT edit={edit} value={contact.phone || ''} onChange={v => edit?.updateContact('phone', inlineHtmlToPlainText(v))} placeholder="전화번호" />
              <WT edit={edit} value={edit ? (contact.website || '') : (data.social?.blog || '')} onChange={v => edit?.updateContact('website', inlineHtmlToPlainText(v))} placeholder="웹사이트/블로그" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// web-2 · Bento Grid — 타일 대시보드형
// ═════════════════════════════════════════════════════════════════════════════

const W2_CSS = `
.w2-tile{transition:transform .35s cubic-bezier(.2,.65,.3,1),box-shadow .35s cubic-bezier(.2,.65,.3,1)}
.w2-tile:hover{transform:translateY(-3.2px);box-shadow:0 14.4px 32px -14.4px rgba(15,23,42,.22)}
.w2-cover{transition:transform .7s cubic-bezier(.2,.65,.3,1)}
.w2-tile:hover .w2-cover{transform:scale(1.05)}
`;

function W2Label({ children }) {
  return <p className="text-[8.8px] font-black tracking-[0.18em] uppercase text-slate-400 mb-3">{children}</p>;
}

export function WebTemplate2({ portfolio }) {
  const data = mapPortfolioToTemplateData(portfolio);
  const rootRef = useReveal();
  const skills = (data.skills || []).map(s => s.name).filter(Boolean);
  const projects = data.projects || [];
  const [featured, ...restProjects] = projects;
  const expList = data.experience || [];
  const tile = 'w2-tile rounded-[22.4px] bg-white border border-slate-200/70 shadow-[0_2px_11.2px_-6.4px_rgba(15,23,42,.12)] overflow-hidden';

  return (
    <div ref={rootRef} className="min-h-screen bg-[#eef0f4] text-slate-900 font-sans antialiased py-8 md:py-14 px-4 md:px-8">
      <style>{SHARED_CSS + W2_CSS}</style>
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-12 auto-rows-[minmax(70.4px,auto)] gap-4">

        {/* 인트로 타일 */}
        <div data-reveal className={`${tile} col-span-2 md:col-span-7 md:row-span-2 p-7 md:p-9 flex flex-col justify-between`}>
          <div>
            <span className="inline-flex items-center gap-2 text-[9.6px] font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'wp-pulse 2s infinite' }} />구직 중 · Open to Work
            </span>
            <h1 className="text-[27.2px] md:text-[35.2px] font-black tracking-tight leading-[1.08]" style={{ wordBreak: 'keep-all' }}>
              안녕하세요,<br />{data.name}입니다 <span className="inline-block origin-bottom-right hover:rotate-12 transition-transform cursor-default">👋</span>
            </h1>
            <p className="mt-4 text-[13.6px] md:text-[15.2px] font-bold text-indigo-600" style={{ wordBreak: 'keep-all' }}>{data.title}</p>
            <p className="mt-4 text-[11.2px] leading-[1.85] text-slate-500 max-w-lg whitespace-pre-wrap" style={{ wordBreak: 'keep-all' }}>
              {(data.about || '').split('\n').slice(0, 2).join('\n')}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {data.email && (
              <a href={`mailto:${data.email}`} className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-5 py-2.5 text-[10.8px] font-bold hover:bg-indigo-600 transition-colors">
                <Mail size={11.2} /> 메일 보내기
              </a>
            )}
            {data.location && <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2.5 text-[10.4px] font-bold text-slate-500"><MapPin size={10.4} />{data.location}</span>}
          </div>
        </div>

        {/* 프로필 사진 타일 */}
        <div data-reveal className={`${tile} col-span-2 md:col-span-5 md:row-span-2 min-h-[192px] relative`}>
          {portfolio.profileImageUrl
            ? <img src={portfolio.profileImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(140deg,#c7d2fe 0%,#a5b4fc 45%,#818cf8 100%)' }}>
                <span className="text-[76.8px] select-none">🧑‍💻</span>
              </div>
            )}
          <div className="absolute bottom-4 left-4 rounded-2xl bg-white/85 backdrop-blur px-4 py-2.5">
            <p className="text-[10.4px] font-black">{data.name}</p>
            <p className="text-[9.2px] font-semibold text-slate-500">{data.location || 'Portfolio'}</p>
          </div>
        </div>

        {/* 스탯 타일 3종 */}
        {[
          [String(expList.length).padStart(2, '0'), '경험·프로젝트', 'text-indigo-600'],
          [String((data.awards || []).length).padStart(2, '0'), '수상·자격', 'text-amber-500'],
          [`${skills.length}+`, '스킬', 'text-emerald-600'],
        ].map(([num, label, color], i) => (
          <div key={label} data-reveal className={`${tile} col-span-1 md:col-span-2 p-5 flex flex-col justify-center ${i === 2 ? 'col-span-2 md:col-span-2' : ''}`}>
            <p className={`text-[27.2px] md:text-[32px] font-black leading-none tracking-tight ${color}`}>{num}</p>
            <p className="mt-2 text-[9.2px] font-bold tracking-[0.08em] uppercase text-slate-400">{label}</p>
          </div>
        ))}

        {/* 연락 CTA 타일 (액센트) */}
        <div data-reveal className={`${tile} col-span-2 md:col-span-6 md:row-span-1 p-6 flex items-center justify-between !bg-indigo-600 !border-indigo-500 text-white`}>
          <div>
            <p className="text-[12.8px] md:text-[14.4px] font-black" style={{ wordBreak: 'keep-all' }}>함께 일해보고 싶다면?</p>
            <p className="text-[11.5px] text-white/70 font-semibold mt-1">{data.email || '이메일을 등록해 주세요'}</p>
          </div>
          {data.email && (
            <a href={`mailto:${data.email}`} className="shrink-0 w-11 h-11 rounded-full bg-white text-indigo-600 flex items-center justify-center hover:scale-110 transition-transform">
              <ArrowUpRight size={15.2} />
            </a>
          )}
        </div>

        {/* 대표 프로젝트 타일 */}
        {featured && (
          <div data-reveal className={`${tile} col-span-2 md:col-span-7 md:row-span-2 relative min-h-[240px] group cursor-default`}>
            <div className="absolute inset-0 w2-cover"><Thumb proj={featured} idx={0} label={false} /></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/10 to-transparent" />
            <div className="absolute top-4 left-4"><span className="rounded-full bg-white/90 backdrop-blur px-3 py-1 text-[8.8px] font-black tracking-[0.12em] uppercase">⭐ Featured</span></div>
            <div className="absolute bottom-0 inset-x-0 p-6 md:p-7 text-white">
              <span className="text-[8.8px] font-black tracking-[0.16em] uppercase text-white/60">{featured.tag || 'Project'} {featured.period && `· ${featured.period}`}</span>
              <h3 className="mt-1.5 text-[19.2px] md:text-[22.4px] font-black tracking-tight" style={{ wordBreak: 'keep-all' }}>{featured.name}</h3>
              {featured.desc && <p className="mt-1.5 text-[10.8px] text-white/75 line-clamp-2 max-w-xl" style={{ wordBreak: 'keep-all' }}>{featured.desc}</p>}
            </div>
          </div>
        )}

        {/* 스킬 타일 */}
        <div data-reveal className={`${tile} col-span-2 md:col-span-5 md:row-span-2 p-6 md:p-7`}>
          <W2Label>🛠 Skills & Tools</W2Label>
          <div className="flex flex-wrap gap-2">
            {(data.skills || []).map((s, i) => (
              <span key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10.4px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-default">
                {s.name}
              </span>
            ))}
          </div>
        </div>

        {/* 다른 프로젝트 타일들 */}
        {restProjects.slice(0, 2).map((proj, i) => (
          <div key={i} data-reveal className={`${tile} col-span-1 md:col-span-4 relative min-h-[160px] group cursor-default`}>
            <div className="absolute inset-0 w2-cover"><Thumb proj={proj} idx={i + 1} label={false} /></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-5 text-white">
              <span className="text-[8.4px] font-black tracking-[0.14em] uppercase text-white/60">{proj.tag || 'Project'}</span>
              <h4 className="mt-1 text-[13.2px] font-black leading-snug" style={{ wordBreak: 'keep-all' }}>{proj.name}</h4>
            </div>
          </div>
        ))}

        {/* 경력 타임라인 타일 */}
        <div data-reveal className={`${tile} col-span-2 md:col-span-4 ${restProjects.length ? '' : 'md:col-span-8'} p-6 md:p-7`}>
          <W2Label>💼 Experience</W2Label>
          <div className="space-y-4">
            {expList.slice(0, 4).map((exp, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center pt-1.5">
                  <span className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                  {i < Math.min(expList.length, 4) - 1 && <span className="flex-1 w-px bg-slate-200 mt-1" />}
                </div>
                <div className="pb-1 min-w-0">
                  <p className="text-[11.2px] font-black leading-tight" style={{ wordBreak: 'keep-all' }}>{exp.company}</p>
                  <p className="text-[9.6px] font-semibold text-slate-400 mt-0.5">{exp.role}{exp.period && ` · ${exp.period}`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 학력 타일 */}
        {(data.education || []).length > 0 && (
          <div data-reveal className={`${tile} col-span-1 md:col-span-4 p-6`}>
            <W2Label>🎓 Education</W2Label>
            {data.education.slice(0, 2).map((edu, i) => (
              <div key={i} className={i ? 'mt-4 pt-4 border-t border-slate-100' : ''}>
                <p className="text-[11.2px] font-black leading-tight" style={{ wordBreak: 'keep-all' }}>{edu.school}</p>
                <p className="text-[9.6px] font-semibold text-slate-400 mt-0.5">{edu.major}</p>
                <p className="text-[8.8px] font-bold text-slate-300 mt-0.5">{edu.period}</p>
              </div>
            ))}
          </div>
        )}

        {/* 수상 타일 */}
        {(data.awards || []).length > 0 && (
          <div data-reveal className={`${tile} col-span-1 md:col-span-4 p-6`}>
            <W2Label>🏆 Awards</W2Label>
            {data.awards.slice(0, 3).map((award, i) => (
              <div key={i} className={`flex items-baseline justify-between gap-2 ${i ? 'mt-3 pt-3 border-t border-slate-100' : ''}`}>
                <p className="text-[10.8px] font-black leading-snug" style={{ wordBreak: 'keep-all' }}>{award.title}</p>
                <span className="text-[8.8px] font-bold text-slate-300 shrink-0">{award.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* 연락처 정보 타일 */}
        <div data-reveal className={`${tile} col-span-2 md:col-span-4 p-6 flex flex-col justify-center gap-2.5`}>
          <W2Label>✉️ Contact</W2Label>
          {data.email && <p className="flex items-center gap-2.5 text-[10.4px] font-bold text-slate-600"><Mail size={11.2} className="text-indigo-500" />{data.email}</p>}
          {data.phone && <p className="flex items-center gap-2.5 text-[10.4px] font-bold text-slate-600"><Phone size={11.2} className="text-indigo-500" />{data.phone}</p>}
          {data.social?.blog && <p className="flex items-center gap-2.5 text-[10.4px] font-bold text-slate-600"><Globe size={11.2} className="text-indigo-500" />{data.social.blog}</p>}
        </div>
      </div>

      <p className="text-center text-[9.2px] font-bold tracking-[0.14em] uppercase text-slate-400 mt-10">© {new Date().getFullYear()} {data.name} — Portfolio</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// web-3 · Dark Spotlight — 좌측 고정 인트로 + 우측 스크롤, 글로우 다크
// ═════════════════════════════════════════════════════════════════════════════

const W3_CSS = `
.w3-card{transition:border-color .3s ease,background .3s ease,transform .3s ease;border-color:var(--w3-line);background:var(--w3-panel)}
.w3-card:hover{border-color:var(--w3-acc45);background:var(--w3-panel2);transform:translateY(-2px)}
@media(min-width:1024px){.w3-sticky-profile{top:var(--w3-sticky-top,0px);height:calc(100vh - var(--w3-sticky-top,0px))}}
`;

const W3_MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

function W3SectionLabel({ index, children, accent, ink }) {
  return (
    <p className="text-[11.5px] font-bold mb-6 flex items-center gap-3" style={{ fontFamily: W3_MONO, color: accent }}>
      <span style={{ color: alphaHex(ink, 0.25) }}>{'//'}</span> {String(index).padStart(2, '0')}. {children}
      <span className="flex-1 h-px" style={{ background: alphaHex(ink, 0.1) }} />
    </p>
  );
}

function LegacyWebTemplate3({ portfolio, edit, onOpenProject, stickyTop = 0 }) {
  const th = getWebTheme(portfolio);
  const data = mapPortfolioToTemplateData(portfolio);
  const rootRef = useReveal();
  const projList = edit
    ? (portfolio.experiences || [])
    : data.projects.map((project, idx) => ({ ...project, imageStyle: portfolio.experiences?.[idx]?.imageStyle || {} }));
  const expList = edit ? (portfolio.experiences || []) : data.experience;
  const eduList = edit ? (portfolio.education || []) : data.education;
  const awardList = edit ? (portfolio.awards || []) : data.awards;
  const contact = edit ? (portfolio.contact || {}) : { email: data.email, phone: data.phone, website: data.social?.blog };
  const skills = edit ? flatSkills(portfolio) : (data.skills || []).map((s, i) => ({ name: s.name, cat: null, idx: i })).filter(s => s.name);
  const introText = portfolio.webIntro || firstLine(portfolio.about || data.about);
  const ink = (a) => alphaHex(th.ink, a);
  const cssVars = {
    '--w3-line': ink(0.1),
    '--w3-panel': ink(0.035),
    '--w3-panel2': ink(0.06),
    '--w3-acc45': alphaHex(th.accent, 0.45),
    '--w3-sticky-top': `${stickyTop}px`,
  };

  return (
    <div ref={rootRef} className="min-h-screen font-sans antialiased relative" style={{ background: th.bg, color: ink(0.88), ...cssVars }}>
      <style>{SHARED_CSS + W3_CSS}</style>
      <div className="absolute inset-x-0 top-0 h-[496px] pointer-events-none" style={{
        background: `radial-gradient(448px 304px at 18% 8%, ${alphaHex(th.accent, 0.22)}, transparent 62%), radial-gradient(384px 256px at 82% 0%, ${alphaHex(th.accent, 0.13)}, transparent 60%)`,
      }} />

      <div className="relative max-w-6xl mx-auto px-6 md:px-10 lg:grid lg:grid-cols-[320px,1fr] lg:gap-16">

        {/* ── 좌측 고정 인트로 ── */}
        <aside className="w3-sticky-profile pt-16 pb-8 lg:sticky lg:flex lg:flex-col lg:justify-between lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 text-[9.2px] font-bold px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 mb-7" style={{ fontFamily: W3_MONO }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'wp-pulse 2s infinite', boxShadow: '0 0 8px rgba(52,211,153,.9)' }} />
              <WCopy portfolio={portfolio} edit={edit} copyKey="w3Availability" defaultValue="OPEN_TO_WORK = true" />
            </span>
            <h1 className="text-[30.4px] md:text-[36.8px] font-black tracking-tight leading-[1.05]" style={{ wordBreak: 'keep-all', color: th.ink }}>
              <WT edit={edit} value={edit ? portfolio.userName : data.name} onChange={v => edit?.update('userName', v)} placeholder="이름" />
            </h1>
            <h2 className="mt-3 text-[13.6px] md:text-[15.2px] font-bold" style={{ wordBreak: 'keep-all', color: th.accent }}>
              <WT edit={edit} value={edit ? portfolio.headline : data.title} onChange={v => edit?.update('headline', v)} placeholder="한 줄 소개" />
            </h2>
            <div className="mt-5 text-[11.2px] leading-[1.9] max-w-sm" style={{ wordBreak: 'keep-all', color: ink(0.6) }}>
              <WTArea edit={edit} value={introText} onChange={v => edit?.update('webIntro', v)} placeholder="짧은 소개" />
            </div>

            {/* 앵커 내비게이션 */}
            <nav className="hidden lg:block mt-12 space-y-1.5">
              {[['about', 'ABOUT'], ['experience', 'EXPERIENCE'], ['projects', 'PROJECTS'], ['skills', 'SKILLS']].map(([id, label], i) => (
                <a key={id} href={edit ? undefined : `#w3-${id}`} onClick={event => { if (edit) event.preventDefault(); }} className="group flex items-center gap-3 py-1.5 text-[11.5px] font-bold transition-colors" style={{ fontFamily: W3_MONO, color: ink(0.45) }}>
                  <span style={{ color: ink(0.2) }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="h-px w-8 group-hover:w-14 transition-all" style={{ background: ink(0.35) }} />
                  <WCopy portfolio={portfolio} edit={edit} copyKey={`w3Nav${id[0].toUpperCase()}${id.slice(1)}`} defaultValue={label} />
                </a>
              ))}
            </nav>
          </div>

          <div className="mt-10 lg:mt-0 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10.4px] font-semibold" style={{ color: ink(0.6) }}>
            <span className="inline-flex items-center gap-1.5"><Mail size={11.2} />
              <WT edit={edit} value={contact.email || ''} onChange={v => edit?.updateContact('email', inlineHtmlToPlainText(v))} placeholder="이메일" />
            </span>
            <span className="inline-flex items-center gap-1.5"><Phone size={11.2} />
              <WT edit={edit} value={contact.phone || ''} onChange={v => edit?.updateContact('phone', inlineHtmlToPlainText(v))} placeholder="전화번호" />
            </span>
            <span className="inline-flex items-center gap-1.5"><Globe size={11.2} />
              <WT edit={edit} value={edit ? (contact.website || '') : (data.social?.blog || '')} onChange={v => edit?.updateContact('website', inlineHtmlToPlainText(v))} placeholder="웹사이트" />
            </span>
          </div>
        </aside>

        {/* ── 우측 스크롤 콘텐츠 ── */}
        <main className="pb-24 lg:pt-20 space-y-24">

          {/* About */}
          <section id="w3-about" data-reveal>
            <W3SectionLabel index={1} accent={th.accent} ink={th.ink}><WCopy portfolio={portfolio} edit={edit} copyKey="w3AboutLabel" defaultValue="ABOUT" /></W3SectionLabel>
            <div className="text-[12px] leading-[2]" style={{ wordBreak: 'keep-all', color: ink(0.8) }}>
              <WTArea edit={edit} value={edit ? (portfolio.about || '') : data.about} onChange={v => edit?.update('about', v)} placeholder="자기소개를 입력하세요" />
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                [String(expList.length).padStart(2, '0'), 'PROJECTS', 'w3StatProjects'],
                [String(awardList.length).padStart(2, '0'), 'AWARDS', 'w3StatAwards'],
                [`${skills.length}+`, 'SKILLS', 'w3StatSkills'],
              ].map(([num, label, copyKey]) => (
                <div key={copyKey} className="rounded-xl border px-4 py-4" style={{ borderColor: ink(0.1), background: ink(0.035) }}>
                  <p className="text-[20.8px] md:text-[25.6px] font-black leading-none" style={{ color: th.ink }}>{num}</p>
                  <p className="mt-1.5 text-[8.4px] font-bold tracking-[0.14em]" style={{ fontFamily: W3_MONO, color: ink(0.45) }}><WCopy portfolio={portfolio} edit={edit} copyKey={copyKey} defaultValue={label} /></p>
                </div>
              ))}
            </div>
          </section>

          {/* Experience */}
          {(expList.length > 0 || edit) && (
            <section id="w3-experience" data-reveal>
              <W3SectionLabel index={2} accent={th.accent} ink={th.ink}><WCopy portfolio={portfolio} edit={edit} copyKey="w3ExperienceLabel" defaultValue="EXPERIENCE" /></W3SectionLabel>
              <div className="space-y-3">
                {expList.map((exp, idx) => (
                  <div key={idx} className="w3-card rounded-2xl border px-6 py-5 grid md:grid-cols-[112px,1fr] gap-2 md:gap-6 relative group">
                    <WRm edit={edit} onClick={() => edit.removeItem('experiences', idx)} />
                    <span className="text-[9.6px] font-bold pt-0.5" style={{ fontFamily: W3_MONO, color: ink(0.45) }}>
                      <WT edit={edit} value={exp.period || '—'} onChange={v => edit?.updateItem('experiences', idx, { period: inlineHtmlToPlainText(v) })} placeholder="기간" />
                    </span>
                    <div>
                      <p className="text-[13.2px] font-black" style={{ wordBreak: 'keep-all', color: th.ink }}>
                        <WT edit={edit} value={exp.company || exp.title || ''} onChange={v => edit?.updateItem('experiences', idx, { company: v, title: v })} placeholder="경험명" />
                      </p>
                      <p className="text-[10.4px] font-semibold mt-0.5" style={{ color: alphaHex(th.accent, 0.8) }}>
                        <WT edit={edit} value={exp.role || ''} onChange={v => edit?.updateItem('experiences', idx, { role: v })} placeholder="역할" />
                      </p>
                      {edit ? (
                        <div className="mt-2.5 text-[10.4px] leading-relaxed" style={{ color: ink(0.6) }}>
                          <WTArea edit={edit} value={exp.description || ''} onChange={v => edit.updateItem('experiences', idx, { description: v })} placeholder="설명 / 성과" />
                        </div>
                      ) : (exp.details || []).length > 0 && (
                        <ul className="mt-2.5 space-y-1">
                          {exp.details.slice(0, 3).map((d, di) => (
                            <li key={di} className="flex gap-2 text-[10.4px] leading-relaxed" style={{ wordBreak: 'keep-all', color: ink(0.6) }}>
                              <span className="shrink-0" style={{ fontFamily: W3_MONO, color: alphaHex(th.accent, 0.7) }}>▹</span>{d}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <WImportExperience edit={edit} tone={ink(0.45)} />
            </section>
          )}

          {/* Projects */}
          {(projList.length > 0 || edit) && (
            <section id="w3-projects" data-reveal>
              <W3SectionLabel index={3} accent={th.accent} ink={th.ink}><WCopy portfolio={portfolio} edit={edit} copyKey="w3ProjectsLabel" defaultValue="PROJECTS" /></W3SectionLabel>
              <div className="grid sm:grid-cols-2 gap-4">
                {projList.map((proj, idx) => {
                  const tech = edit ? (proj.skills || []) : (proj.techStack || []);
                  return (
                    <div
                      key={idx}
                      className="w3-card group rounded-2xl border overflow-hidden cursor-pointer relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ outlineColor: th.accent }}
                      {...projectCardInteraction(onOpenProject, idx, edit ? (proj.company || proj.title) : proj.name)}
                    >
                      <WRm edit={edit} onClick={() => edit.removeItem('experiences', idx)} />
                      <div className="overflow-hidden border-b relative transition-all" style={{ borderColor: ink(0.1), ...imageFrameStyle(proj.imageStyle, '16 / 9', 'square') }}>
                        <EditableThumb edit={edit} proj={proj} idx={idx} label={false} defaultAspect="16 / 9" defaultShape="square" />
                        <div className="pointer-events-none absolute inset-0 group-hover:bg-transparent transition-colors" style={{ background: alphaHex(th.bg, 0.35) }} />
                      </div>
                      <div className="p-5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[8.4px] font-bold tracking-[0.14em] uppercase" style={{ fontFamily: W3_MONO, color: alphaHex(th.accent, 0.8) }}>
                            <WT edit={edit} value={proj.tag || 'PROJECT'} onChange={v => edit?.updateItem('experiences', idx, { tag: inlineHtmlToPlainText(v) })} placeholder="태그" />
                          </span>
                          <ExternalLink size={10.4} style={{ color: ink(0.35) }} />
                        </div>
                        <h3 className="mt-2 text-[13.6px] font-black leading-snug" style={{ wordBreak: 'keep-all', color: th.ink }}>
                          <WT edit={edit} value={edit ? (proj.company || proj.title || '') : proj.name} onChange={v => edit?.updateItem('experiences', idx, { company: v, title: v })} placeholder="프로젝트명" />
                        </h3>
                        <div className="mt-1.5 text-[11.5px] leading-relaxed" style={{ wordBreak: 'keep-all', color: ink(0.6) }}>
                          <WTArea edit={edit} value={edit ? (proj.description || '') : proj.desc} onChange={v => edit?.updateItem('experiences', idx, { description: v })} placeholder="설명" className={edit ? '' : 'line-clamp-2'} />
                        </div>
                        {(tech.length > 0) && (
                          <div className="mt-3.5 flex flex-wrap gap-1.5">
                            {tech.slice(0, 4).map((t, ti) => (
                              <span key={ti} className="text-[8.4px] font-bold px-2 py-0.5 rounded-md border" style={{ fontFamily: W3_MONO, borderColor: alphaHex(th.accent, 0.25), background: alphaHex(th.accent, 0.1), color: alphaHex(th.accent, 0.9) }}>
                                {typeof t === 'string' ? t : t?.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <WImportExperience edit={edit} tone={ink(0.45)} />
            </section>
          )}

          {/* Skills */}
          {(skills.length > 0 || edit) && (
            <section id="w3-skills" data-reveal>
              <W3SectionLabel index={4} accent={th.accent} ink={th.ink}><WCopy portfolio={portfolio} edit={edit} copyKey="w3SkillsLabel" defaultValue="SKILLS" /></W3SectionLabel>
              <div className="flex flex-wrap gap-2">
                {skills.map((s, i) => (
                  <span key={`${s.cat}-${s.idx}-${i}`} className="relative group text-[11.5px] font-bold px-3.5 py-1.5 rounded-lg border cursor-default" style={{ fontFamily: W3_MONO, borderColor: ink(0.1), background: ink(0.04), color: ink(0.75) }}>
                    <WRm edit={edit} onClick={() => edit.removeSkill(s.cat, s.idx)} />
                    {edit
                      ? <EditText value={s.name} onChange={v => edit.updateSkill(s.cat, s.idx, inlineHtmlToPlainText(v))} placeholder="스킬" />
                      : s.name}
                  </span>
                ))}
                {edit && (
                  <button type="button" onClick={() => edit.addSkill()} className="text-[11.5px] font-bold px-3.5 py-1.5 rounded-lg border border-dashed opacity-60 hover:opacity-100" style={{ borderColor: ink(0.3), color: ink(0.6) }}>
                    <Plus size={9.6} className="inline" /> 스킬
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Education & Awards */}
          {(eduList.length > 0 || awardList.length > 0 || edit) && (
            <section data-reveal className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border p-6" style={{ borderColor: ink(0.1), background: ink(0.035) }}>
                <p className="text-[8.8px] font-bold tracking-[0.18em] mb-4" style={{ fontFamily: W3_MONO, color: ink(0.45) }}><WCopy portfolio={portfolio} edit={edit} copyKey="w3EducationLabel" defaultValue="EDUCATION" /></p>
                {eduList.map((edu, i) => (
                  <div key={i} className={`relative group ${i ? 'mt-4 pt-4 border-t' : ''}`} style={i ? { borderColor: ink(0.08) } : {}}>
                    <WRm edit={edit} onClick={() => edit.removeItem('education', i)} />
                    <p className="text-[11.6px] font-black" style={{ color: th.ink }}>
                      <WT edit={edit} value={edit ? (edu.name || edu.school || '') : edu.school} onChange={v => edit?.updateItem('education', i, { name: v })} placeholder="학교명" />
                    </p>
                    <p className="text-[11.5px] mt-0.5" style={{ color: ink(0.6) }}>
                      <WT edit={edit} value={edit ? (edu.degree || edu.major || '') : edu.major} onChange={v => edit?.updateItem('education', i, { degree: v })} placeholder="전공/학위" />
                    </p>
                    <p className="text-[8.8px] mt-0.5" style={{ fontFamily: W3_MONO, color: ink(0.4) }}>
                      <WT edit={edit} value={edu.period || ''} onChange={v => edit?.updateItem('education', i, { period: inlineHtmlToPlainText(v) })} placeholder="기간" />
                    </p>
                  </div>
                ))}
                <WAdd edit={edit} onClick={() => edit.addItem('education', { name: '', degree: '', period: '' })} label="학력 추가" tone={ink(0.45)} />
              </div>
              <div className="rounded-2xl border p-6" style={{ borderColor: ink(0.1), background: ink(0.035) }}>
                <p className="text-[8.8px] font-bold tracking-[0.18em] mb-4" style={{ fontFamily: W3_MONO, color: ink(0.45) }}><WCopy portfolio={portfolio} edit={edit} copyKey="w3AwardsLabel" defaultValue="AWARDS" /></p>
                {awardList.map((award, i) => (
                  <div key={i} className={`flex items-baseline justify-between gap-3 relative group ${i ? 'mt-3 pt-3 border-t' : ''}`} style={i ? { borderColor: ink(0.08) } : {}}>
                    <WRm edit={edit} onClick={() => edit.removeItem('awards', i)} />
                    <p className="text-[10.8px] font-bold" style={{ wordBreak: 'keep-all', color: ink(0.85) }}>
                      <WT edit={edit} value={award.title || ''} onChange={v => edit?.updateItem('awards', i, { title: v })} placeholder="수상명" />
                    </p>
                    <span className="text-[8.8px] shrink-0" style={{ fontFamily: W3_MONO, color: ink(0.4) }}>
                      <WT edit={edit} value={award.date || ''} onChange={v => edit?.updateItem('awards', i, { date: inlineHtmlToPlainText(v) })} placeholder="날짜" />
                    </span>
                  </div>
                ))}
                <WAdd edit={edit} onClick={() => edit.addItem('awards', { title: '', date: '' })} label="수상/자격 추가" tone={ink(0.45)} />
              </div>
            </section>
          )}

          <footer className="pt-4 text-[9.2px]" style={{ fontFamily: W3_MONO, color: ink(0.4) }}>
            <span style={{ color: ink(0.2) }}>{'//'}</span> © {new Date().getFullYear()} <WT edit={edit} value={edit ? portfolio.userName : data.name} onChange={value => edit?.update('userName', value)} placeholder="이름" /> — <WCopy portfolio={portfolio} edit={edit} copyKey="w3FooterCopy" defaultValue="built with FitPoly" />
          </footer>
        </main>
      </div>
    </div>
  );
}

// web-3의 새 방향: 러닝 크루 검색 페이지처럼 큰 활자, 넓은 여백, 선명한 구획선으로
// 콘텐츠를 빠르게 훑을 수 있는 화이트 에디토리얼 포트폴리오.
const W3_EDITORIAL_CSS = `
.w3e-display{font-size:clamp(52.8px,9.8vw,136px);line-height:.78;letter-spacing:-.085em;text-transform:uppercase;padding:.13em 0 .16em;overflow:visible}
.w3e-display .fp-rich-inline{line-height:.9;overflow:visible}
.w3e-display .fp-rich-inline[data-empty="true"]{line-height:1!important;padding-block:.08em}
.w3e-project{transition:background-color .25s ease,transform .25s ease}
.w3e-project:hover{background:var(--w3e-hover);transform:translateY(-2px)}
.w3e-project:hover .w3e-arrow{transform:translate(3.2px,-3.2px)}
.w3e-arrow{transition:transform .25s ease}
.w3e-pill{transition:background-color .2s ease,color .2s ease}
.w3e-pill:hover{background:var(--w3e-ink);color:var(--w3e-bg)}
@media(max-width:767px){
  .w3e-display{font-size:clamp(43.2px,16vw,84px);line-height:.82}
}
`;

function W3EditorialHeading({ number, children, ink, accent }) {
  return (
    <div className="grid gap-3 border-t py-5 md:grid-cols-[144px,1fr] md:items-end" style={{ borderColor: ink }}>
      <p className="text-[8px] font-black tracking-[0.16em] uppercase" style={{ color: alphaHex(ink, 0.58) }}>SECTION {String(number).padStart(2, '0')}</p>
      <h2 className="text-[24.8px] font-black uppercase leading-none tracking-[-0.055em] md:text-[38.4px]" style={{ color: accent }}>{children}</h2>
    </div>
  );
}

export function WebTemplate3({ portfolio, edit, onOpenProject }) {
  const th = getWebTheme(portfolio);
  const data = mapPortfolioToTemplateData(portfolio);
  const rootRef = useReveal();
  const projList = edit
    ? (portfolio.experiences || [])
    : data.projects.map((project, idx) => ({ ...project, imageStyle: portfolio.experiences?.[idx]?.imageStyle || {} }));
  const expList = edit ? (portfolio.experiences || []) : data.experience;
  const eduList = edit ? (portfolio.education || []) : data.education;
  const awardList = edit ? (portfolio.awards || []) : data.awards;
  const contact = edit ? (portfolio.contact || {}) : { email: data.email, phone: data.phone, website: data.social?.blog };
  const skills = edit ? flatSkills(portfolio) : (data.skills || []).map((s, i) => ({ name: s.name, cat: null, idx: i })).filter(s => s.name);
  const introText = portfolio.webIntro || firstLine(portfolio.about || data.about);
  const line = alphaHex(th.ink, 0.86);
  const muted = alphaHex(th.ink, 0.58);
  const faint = alphaHex(th.ink, 0.08);
  const soft = alphaHex(th.ink, 0.045);
  const hot = '#ff3b9d';
  const cssVars = { '--w3e-hover': alphaHex(th.accent, 0.16), '--w3e-ink': th.ink, '--w3e-bg': th.bg };

  const navItems = [
    ['projects', 'PROJECTS', 'w3NavProjects'],
    ['experience', 'EXPERIENCE', 'w3NavExperience'],
    ['skills', 'SKILLS', 'w3NavSkills'],
    ['contact', 'CONTACT', 'w3NavContact'],
  ];
  const filters = [
    ['프로젝트', String(projList.length).padStart(2, '0'), 'w3FilterProjects'],
    ['사용 기술', `${skills.length}+`, 'w3FilterSkills'],
    ['수상·자격', String(awardList.length).padStart(2, '0'), 'w3FilterAwards'],
    ['상태', 'OPEN', 'w3FilterStatus'],
  ];

  return (
    <div ref={rootRef} className="min-h-screen font-sans antialiased" style={{ background: th.bg, color: th.ink, ...cssVars }}>
      <style>{SHARED_CSS + W3_EDITORIAL_CSS}</style>
      <div className="mx-auto max-w-[1056px] px-5 py-5 sm:px-8 md:px-12 md:py-8">

        <header className="flex items-center justify-between gap-6 border-b pb-4" style={{ borderColor: line }}>
          <div className="shrink-0 text-[13.6px] font-black uppercase leading-[0.8] tracking-[-0.07em] md:text-[17.6px]">
            <span className="block"><WCopy portfolio={portfolio} edit={edit} copyKey="w3BrandTop" defaultValue="WORK" /></span>
            <span className="block"><WCopy portfolio={portfolio} edit={edit} copyKey="w3BrandBottom" defaultValue="FINDER" /></span>
          </div>
          <nav className="hidden items-center gap-7 text-[8px] font-black uppercase tracking-[-0.02em] md:flex">
            {navItems.map(([id, label, key]) => (
              <a key={id} href={edit ? undefined : `#w3-${id}`} onClick={event => { if (edit) event.preventDefault(); }} className="transition-opacity hover:opacity-45">
                <WCopy portfolio={portfolio} edit={edit} copyKey={key} defaultValue={label} />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-[8px] font-black uppercase tracking-[0.08em]">
            <span className="hidden sm:inline"><WT edit={edit} value={edit ? portfolio.userName : data.name} onChange={value => edit?.update('userName', value)} placeholder="이름" /></span>
            <span className="h-3 w-3 rounded-full" style={{ background: th.accent, boxShadow: `0 0 0 4px ${alphaHex(th.accent, 0.2)}` }} />
          </div>
        </header>

        <section className="grid border-b py-8 md:grid-cols-[144px,1fr] md:py-14" style={{ borderColor: line }}>
          <div className="mb-8 flex items-end md:mb-0">
            <div className="max-w-[108px] text-[8.4px] font-bold leading-[1.45]">
              <WCopy portfolio={portfolio} edit={edit} copyKey="w3HeroAside" defaultValue="좋은 프로젝트와 경험을 한눈에 찾아보세요" />
              <span className="mt-4 flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: th.ink }}>?</span>
            </div>
          </div>
          <div className="min-w-0 overflow-visible">
            <div className="w3e-display font-black">
              <span className="block"><WCopy portfolio={portfolio} edit={edit} copyKey="w3HeroLine1" defaultValue="FIND" placeholder="빈 텍스트" /></span>
              <span className="block"><WCopy portfolio={portfolio} edit={edit} copyKey="w3HeroLine2" defaultValue="YOUR BEST" placeholder="빈 텍스트" /></span>
              <span className="flex items-center gap-[0.12em]">
                <WCopy portfolio={portfolio} edit={edit} copyKey="w3HeroLine3" defaultValue="WORK" placeholder="빈 텍스트" />
                <span className="flex h-[0.62em] w-[0.62em] shrink-0 items-center justify-center rounded-full" style={{ background: th.accent }}><Search size="0.27em" strokeWidth={2.8} /></span>
              </span>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-[1fr,1.25fr] md:items-start">
              <div>
                <p className="text-[10.4px] font-black uppercase tracking-[-0.025em]">
                  <WT edit={edit} value={edit ? portfolio.headline : data.title} onChange={value => edit?.update('headline', value)} placeholder="한 줄 소개" />
                </p>
                <div className="mt-2 max-w-md text-[9.6px] font-medium leading-[1.75]" style={{ color: muted }}>
                  <WTArea edit={edit} value={introText} onChange={value => edit?.update('webIntro', value)} placeholder="짧은 소개" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {filters.map(([label, value, key]) => (
                  <div key={key} className="w3e-pill flex min-h-11 items-center justify-between rounded-full border px-4 text-[8px] font-black uppercase" style={{ borderColor: line }}>
                    <span style={{ color: muted }}><WCopy portfolio={portfolio} edit={edit} copyKey={key} defaultValue={label} /></span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="w3-projects" className="py-10 md:py-16" data-reveal>
          <div className="flex items-baseline gap-3 pb-7 sm:gap-4">
            <span className="text-[38.4px] font-black leading-none tracking-[-0.075em] sm:text-[49.6px] md:text-[60.8px]" style={{ color: hot }}>{projList.length}</span>
            <h2 className="text-[38.4px] font-black uppercase leading-none tracking-[-0.065em] sm:text-[49.6px] md:text-[60.8px]"><WCopy portfolio={portfolio} edit={edit} copyKey="w3ProjectsLabel" defaultValue="PROJECTS" /></h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projList.map((proj, idx) => {
              const tech = edit ? (proj.skills || []) : (proj.techStack || []);
              return (
                <article
                  key={idx}
                  className="w3e-project group relative flex min-w-0 cursor-pointer flex-col rounded-[17.6px] border p-4 md:p-5"
                  style={{ borderColor: line, background: soft }}
                  {...projectCardInteraction(onOpenProject, idx, edit ? (proj.company || proj.title) : proj.name)}
                >
                  <WRm edit={edit} onClick={() => edit.removeItem('experiences', idx)} />
                  <div className="flex justify-between gap-3 text-[7.6px] font-black uppercase tracking-[0.08em]">
                    <p><WCopy portfolio={portfolio} edit={edit} copyKey="w3ProjectItemLabel" defaultValue="PROJECT" /> {String(idx + 1).padStart(2, '0')}</p>
                    <p style={{ color: hot }}><WT edit={edit} value={proj.tag || 'CASE STUDY'} onChange={value => edit?.updateItem('experiences', idx, { tag: inlineHtmlToPlainText(value) })} placeholder="분류" /></p>
                  </div>
                  <div className="mx-auto mt-5 w-full max-w-[144px] overflow-hidden transition-all" style={imageFrameStyle(proj.imageStyle, '1 / 1', 'pill')}>
                    <EditableThumb edit={edit} proj={proj} idx={idx} label={false} defaultAspect="1 / 1" defaultShape="pill" />
                  </div>
                  <div className="mt-5 flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: faint }}>
                      <h3 className="text-[20px] font-black leading-[1] tracking-[-0.05em] md:text-[23.2px]">
                        <WT edit={edit} value={edit ? (proj.company || proj.title || '') : proj.name} onChange={value => edit?.updateItem('experiences', idx, { company: value, title: value })} placeholder="프로젝트명" />
                      </h3>
                      <ArrowUpRight className="w3e-arrow shrink-0" size={19.2} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 text-[8.4px]">
                      <div><p className="mb-1 text-[6.8px] font-black uppercase" style={{ color: hot }}>DATE</p><WT edit={edit} value={proj.period || ''} onChange={value => edit?.updateItem('experiences', idx, { period: inlineHtmlToPlainText(value) })} placeholder="기간" /></div>
                      <div><p className="mb-1 text-[6.8px] font-black uppercase" style={{ color: hot }}>ROLE</p><WT edit={edit} value={proj.role || ''} onChange={value => edit?.updateItem('experiences', idx, { role: value })} placeholder="역할" /></div>
                      <div className="col-span-2"><p className="mb-1 text-[6.8px] font-black uppercase" style={{ color: hot }}>TOOLS</p><span>{tech.slice(0, 4).map(t => typeof t === 'string' ? t : t?.name).filter(Boolean).join(', ') || '—'}</span></div>
                    </div>
                    <div className="mt-auto text-[9.2px] font-medium leading-[1.7]" style={{ color: muted }}>
                      <WTArea edit={edit} value={edit ? (proj.description || '') : proj.desc} onChange={value => edit?.updateItem('experiences', idx, { description: value })} placeholder="프로젝트 설명과 성과" />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <WImportExperience edit={edit} tone={muted} />
        </section>

        {(expList.length > 0 || edit) && (
          <section id="w3-experience" data-reveal>
            <W3EditorialHeading number={2} ink={th.ink} accent={hot}><WCopy portfolio={portfolio} edit={edit} copyKey="w3ExperienceLabel" defaultValue="EXPERIENCE LOG" /></W3EditorialHeading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {expList.map((exp, idx) => (
                <div key={idx} className="group relative flex min-h-[168px] min-w-0 flex-col rounded-[14.4px] border p-5" style={{ borderColor: line, background: soft }}>
                  <WRm edit={edit} onClick={() => edit.removeItem('experiences', idx)} />
                  <p className="text-[8px] font-black uppercase" style={{ color: muted }}><WT edit={edit} value={exp.period || '—'} onChange={value => edit?.updateItem('experiences', idx, { period: inlineHtmlToPlainText(value) })} placeholder="기간" /></p>
                  <div className="mt-5 border-b pb-4" style={{ borderColor: faint }}>
                    <p className="text-[16.8px] font-black leading-[1.08] tracking-[-0.04em]"><WT edit={edit} value={exp.company || exp.title || ''} onChange={value => edit?.updateItem('experiences', idx, { company: value, title: value })} placeholder="경험명" /></p>
                    <p className="mt-1 text-[8.4px] font-black uppercase" style={{ color: hot }}><WT edit={edit} value={exp.role || ''} onChange={value => edit?.updateItem('experiences', idx, { role: value })} placeholder="역할" /></p>
                  </div>
                  <div className="mt-auto pt-4 text-[9.2px] leading-[1.7]" style={{ color: muted }}><WTArea edit={edit} value={exp.description || ''} onChange={value => edit?.updateItem('experiences', idx, { description: value })} placeholder="주요 업무와 성과" /></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {(skills.length > 0 || edit) && (
          <section id="w3-skills" className="pt-12" data-reveal>
            <W3EditorialHeading number={3} ink={th.ink} accent={th.accent}><WCopy portfolio={portfolio} edit={edit} copyKey="w3SkillsLabel" defaultValue="SKILLS & TOOLS" /></W3EditorialHeading>
            <div className="flex flex-wrap gap-2 border-b pb-10" style={{ borderColor: line }}>
              {skills.map((skill, i) => (
                <span key={`${skill.cat}-${skill.idx}-${i}`} className="w3e-pill group relative rounded-full border px-4 py-2 text-[8.8px] font-black uppercase" style={{ borderColor: line }}>
                  <WRm edit={edit} onClick={() => edit.removeSkill(skill.cat, skill.idx)} />
                  {edit ? <EditText value={skill.name} onChange={value => edit.updateSkill(skill.cat, skill.idx, inlineHtmlToPlainText(value))} placeholder="스킬" /> : skill.name}
                </span>
              ))}
              {edit && <button type="button" onClick={() => edit.addSkill()} className="rounded-full border border-dashed px-4 py-2 text-[8.8px] font-black" style={{ borderColor: muted }}><Plus size={9.6} className="inline" /> 스킬 추가</button>}
            </div>
          </section>
        )}

        {(eduList.length > 0 || awardList.length > 0 || edit) && (
          <section className="grid gap-12 py-12 md:grid-cols-2" data-reveal>
            <div>
              <h3 className="border-b pb-3 text-[17.6px] font-black uppercase tracking-[-0.045em]" style={{ borderColor: line }}><WCopy portfolio={portfolio} edit={edit} copyKey="w3EducationLabel" defaultValue="EDUCATION" /></h3>
              {eduList.map((edu, i) => (
                <div key={i} className="group relative border-b py-4" style={{ borderColor: line }}>
                  <WRm edit={edit} onClick={() => edit.removeItem('education', i)} />
                  <p className="text-[12.8px] font-black"><WT edit={edit} value={edit ? (edu.name || edu.school || '') : edu.school} onChange={value => edit?.updateItem('education', i, { name: value })} placeholder="학교명" /></p>
                  <p className="mt-1 text-[8.8px]" style={{ color: muted }}><WT edit={edit} value={edit ? (edu.degree || edu.major || '') : edu.major} onChange={value => edit?.updateItem('education', i, { degree: value })} placeholder="전공/학위" /> · <WT edit={edit} value={edu.period || ''} onChange={value => edit?.updateItem('education', i, { period: inlineHtmlToPlainText(value) })} placeholder="기간" /></p>
                </div>
              ))}
              <WAdd edit={edit} onClick={() => edit.addItem('education', { name: '', degree: '', period: '' })} label="학력 추가" tone={muted} />
            </div>
            <div>
              <h3 className="border-b pb-3 text-[17.6px] font-black uppercase tracking-[-0.045em]" style={{ borderColor: line }}><WCopy portfolio={portfolio} edit={edit} copyKey="w3AwardsLabel" defaultValue="AWARDS" /></h3>
              {awardList.map((award, i) => (
                <div key={i} className="group relative flex items-start justify-between gap-5 border-b py-4" style={{ borderColor: line }}>
                  <WRm edit={edit} onClick={() => edit.removeItem('awards', i)} />
                  <p className="text-[12px] font-black"><WT edit={edit} value={award.title || ''} onChange={value => edit?.updateItem('awards', i, { title: value })} placeholder="수상/자격명" /></p>
                  <p className="shrink-0 text-[8px] font-black" style={{ color: hot }}><WT edit={edit} value={award.date || ''} onChange={value => edit?.updateItem('awards', i, { date: inlineHtmlToPlainText(value) })} placeholder="날짜" /></p>
                </div>
              ))}
              <WAdd edit={edit} onClick={() => edit.addItem('awards', { title: '', date: '' })} label="수상/자격 추가" tone={muted} />
            </div>
          </section>
        )}

        <footer id="w3-contact" className="grid gap-6 border-t py-8 md:grid-cols-[144px,1fr]" style={{ borderColor: line }}>
          <p className="text-[8px] font-black uppercase tracking-[0.12em]"><WCopy portfolio={portfolio} edit={edit} copyKey="w3ContactLabel" defaultValue="CONTACT" /></p>
          <div>
            <div className="flex flex-wrap gap-x-7 gap-y-3 text-[9.6px] font-black">
              <span className="inline-flex items-center gap-2"><Mail size={10.4} /><WT edit={edit} value={contact.email || ''} onChange={value => edit?.updateContact('email', inlineHtmlToPlainText(value))} placeholder="이메일" /></span>
              <span className="inline-flex items-center gap-2"><Phone size={10.4} /><WT edit={edit} value={contact.phone || ''} onChange={value => edit?.updateContact('phone', inlineHtmlToPlainText(value))} placeholder="전화번호" /></span>
              <span className="inline-flex items-center gap-2"><Globe size={10.4} /><WT edit={edit} value={contact.website || ''} onChange={value => edit?.updateContact('website', inlineHtmlToPlainText(value))} placeholder="웹사이트" /></span>
            </div>
            <p className="mt-8 text-[7.6px] font-black uppercase tracking-[0.12em]" style={{ color: muted }}>© {new Date().getFullYear()} <WT edit={edit} value={edit ? portfolio.userName : data.name} onChange={value => edit?.update('userName', value)} placeholder="이름" /> — <WCopy portfolio={portfolio} edit={edit} copyKey="w3FooterCopy" defaultValue="PORTFOLIO ARCHIVE" /></p>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// web-4 · Blue Ticket — 여행 티켓 콘셉트의 그래픽 포트폴리오 (레퍼런스 1 재현)
// ═════════════════════════════════════════════════════════════════════════════

const W4_BLUE = '#1E3FA0';

const W4_CSS = `
.w4-barcode{background:
  repeating-linear-gradient(90deg,currentColor 0 2px,transparent 2px 3.2px,currentColor 3.2px 4px,transparent 4px 7.2px,currentColor 7.2px 9.6px,transparent 9.6px 11.2px),
  repeating-linear-gradient(90deg,currentColor 0 1px,transparent 1px 5.6px)}
`;

/** 레퍼런스의 콜라주 워드마크 — 글자마다 서체·기울기를 다르게 섞고 o는 스타버스트로.
 *  ink: 아웃라인 글자의 스트로크 색 (color:transparent 상태에선 currentColor가 투명이 되므로 명시값 필요) */
function W4Wordmark({ word, size = 'clamp(41.6px,7.2vw,104px)', ink = '#ffffff' }) {
  const chars = String(word || '').split('');
  const variants = [
    { fontWeight: 900, letterSpacing: '-0.04em' },
    { fontFamily: 'Georgia,\'Times New Roman\',serif', fontStyle: 'italic', fontWeight: 700, transform: 'rotate(-5deg) translateY(-4%)', display: 'inline-block' },
    { fontWeight: 900, transform: 'rotate(7deg) translateY(5%)', display: 'inline-block' },
    { fontFamily: 'Georgia,\'Times New Roman\',serif', fontWeight: 700, transform: 'translateY(-7%)', display: 'inline-block' },
    { fontWeight: 900, display: 'inline-block' },
  ];
  let burstUsed = false;
  return (
    <span className="inline-block select-none leading-[1.04] whitespace-nowrap py-[0.06em]" style={{ fontSize: size }}>
      {chars.map((ch, i) => {
        if (!burstUsed && (ch === 'o' || ch === 'O') && i > 0) {
          burstUsed = true;
          return (
            <svg key={i} viewBox="0 0 100 100" className="inline-block align-baseline -mb-[0.06em]" style={{ width: '0.82em', height: '0.82em' }} aria-hidden>
              <polygon fill="currentColor" points="50,2 60,32 88,15 70,42 98,50 70,58 88,85 60,68 50,98 40,68 12,85 30,58 2,50 30,42 12,15 40,32" />
            </svg>
          );
        }
        const v = variants[i % variants.length];
        const outline = i % 7 === 3;
        const style = outline ? { ...v, WebkitTextStroke: `2px ${ink}`, color: 'transparent' } : v;
        return <span key={i} style={style}>{ch}</span>;
      })}
    </span>
  );
}

/** 콜라주 워드마크를 클릭하면 같은 자리에서 입력 모드로 전환한다. */
function W4WordmarkField({ edit, value, onChange, size = 'clamp(41.6px,7.2vw,104px)', ink = '#ffffff', placeholder = '빈 텍스트' }) {
  const plainValue = inlineHtmlToPlainText(value || '');
  const [editing, setEditing] = useState(false);
  const inputColor = ink;
  return (
    <span
      className="group/wordmark relative inline-block max-w-full overflow-visible align-middle"
      style={!plainValue ? { minWidth: 'min(100%, clamp(144px, 30.4vw, 336px))', minHeight: '1.24em', paddingBlock: '0.08em', fontSize: size, lineHeight: 1.04 } : undefined}
    >
      <span className={`block transition-opacity ${editing ? 'opacity-10' : 'opacity-100'}`}>
        <W4Wordmark word={plainValue} size={size} ink={ink} />
      </span>
      {edit && (
        <input
          value={plainValue}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onChange={event => onChange?.(event.target.value)}
          onClick={event => event.stopPropagation()}
          placeholder={placeholder}
          title="클릭해서 텍스트 수정"
          aria-label={placeholder}
          className={`absolute inset-0 z-10 h-full w-full overflow-visible rounded-lg bg-transparent px-[0.04em] py-[0.08em] text-center font-black tracking-tight outline-none transition-all hover:ring-2 hover:ring-white/45 focus:bg-black/10 focus:ring-2 focus:ring-white/80 ${editing ? 'opacity-100' : 'cursor-text text-transparent caret-transparent'}`}
          style={{ boxSizing: 'border-box', fontSize: size, lineHeight: 1.04, color: (editing || !plainValue) ? inputColor : 'transparent', caretColor: inputColor }}
        />
      )}
    </span>
  );
}

/** 점선 비행 경로 + 비행기 */
function W4FlightPath({ className = '' }) {
  return (
    <div className={`relative ${className}`} aria-hidden>
      <svg viewBox="0 0 560 150" fill="none" className="w-full">
        <path d="M8 128 C 120 20, 400 10, 508 44" stroke="currentColor" strokeWidth="2.5" strokeDasharray="9 10" strokeLinecap="round" />
      </svg>
      <Plane size={24} className="absolute -right-1 top-3 rotate-[18deg]" />
    </div>
  );
}

/** 필름 프레임 아이콘 (섹션 우측 장식) */
function W4Film({ className = '' }) {
  return <Film size={16} className={className} />;
}

/** 티켓 카드 — form/to + 목록 + 바코드 */
function W4Ticket({ name, fromCaption = 'from', toCaption = 'to', fromLabel, toLabel, rows = [], accent = W4_BLUE, ink = '#1b1b1b' }) {
  return (
    <div className="relative rounded-[20.8px] bg-white px-8 py-9 shadow-xl" style={{ color: ink }}>
      {/* 좌측 점선 절취선 */}
      <div className="absolute left-14 top-6 bottom-6 border-l-2 border-dashed" style={{ borderColor: alphaHex(accent, 0.25) }} />
      <div className="pl-14">
        <div className="flex items-center gap-3 mb-8">
          <Plane size={17.6} style={{ color: accent }} />
          <span className="text-[12.8px] font-black tracking-[0.08em] uppercase" style={{ color: accent }}>{name}</span>
        </div>
        <div className="space-y-4 mb-10">
          <div>
            <p className="text-[10.4px] font-bold text-neutral-400">{fromCaption}</p>
            <p className="text-[11.6px] font-bold mt-0.5" style={{ color: accent }}>{fromLabel}</p>
          </div>
          <div>
            <p className="text-[10.4px] font-bold text-neutral-400">{toCaption}</p>
            <p className="text-[11.6px] font-bold mt-0.5" style={{ color: accent }}>{toLabel}</p>
          </div>
        </div>
        {rows.length > 0 && (
          <div className="space-y-2.5 pt-5 border-t border-neutral-200/70">
            {rows.map(([label, val], i) => (
              <div key={i} className="flex items-baseline justify-between gap-4">
                <span className="text-[11.2px] font-black" style={{ wordBreak: 'keep-all' }}><VHtml value={label} /></span>
                <span className="text-[11.5px] font-bold text-neutral-400 shrink-0">{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function WebTemplate4({ portfolio, edit, onOpenProject }) {
  const th = getWebTheme(portfolio);
  const data = mapPortfolioToTemplateData(portfolio);
  const rootRef = useReveal();
  const skills = edit ? flatSkills(portfolio) : (data.skills || []).map((s, i) => ({ name: s.name, cat: null, idx: i })).filter(s => s.name);
  const projList = edit
    ? (portfolio.experiences || [])
    : data.projects.map((project, idx) => ({
        ...project,
        wordmark: portfolio.experiences?.[idx]?.wordmark || '',
        stamp: portfolio.experiences?.[idx]?.stamp || '',
        imageStyle: portfolio.experiences?.[idx]?.imageStyle || {},
      }));
  const expList = edit ? (portfolio.experiences || []) : data.experience;
  const eduList = edit ? (portfolio.education || []) : data.education;
  const awardList = edit ? (portfolio.awards || []) : data.awards;
  const contact = edit ? (portfolio.contact || {}) : { email: data.email, phone: data.phone, website: data.social?.blog };
  const topTags = skills.slice(0, 3).map(s => s.name).filter(Boolean).join('  ·  ').toUpperCase() || 'PORTFOLIO';
  const keywords = skills.slice(0, 5);
  const acc = th.accent;
  // Contents 목차용 페이지 번호 (레퍼런스처럼 6p부터 9쪽씩)
  const pageRows = projList.map((p, i) => [edit ? (p.company || p.title || '') : p.name, `${6 + i * 9}-${13 + i * 9}p`]);

  return (
    <div ref={rootRef} className="min-h-screen font-sans antialiased overflow-x-hidden" style={{ background: th.bg, color: th.ink }}>
      <style>{SHARED_CSS + W4_CSS}</style>

      {/* ── 컬러 히어로 ── */}
      <section className="text-white px-7 md:px-14 pt-8 pb-20" style={{ background: acc }}>
        <div className="flex items-center justify-between">
          <p className="text-[9.6px] md:text-[10.4px] font-bold tracking-[0.22em]"><WCopy portfolio={portfolio} edit={edit} copyKey="w4TopTags" defaultValue={topTags} /></p>
          <Globe size={20.8} strokeWidth={1.5} />
        </div>
        <div className="max-w-3xl mx-auto mt-16 md:mt-24 relative" data-reveal>
          <W4FlightPath className="absolute -top-14 inset-x-0 opacity-95" />
          <div className="text-center pt-10">
            <W4WordmarkField
              edit={edit}
              value={portfolio.webCopy?.w4HeroWordmark ?? 'portfolio'}
              onChange={value => edit?.update('webCopy', { ...(portfolio.webCopy || {}), w4HeroWordmark: value })}
            />
          </div>
        </div>
        <div className="flex justify-end mt-20"><W4Film /></div>
      </section>

      {/* ── COVER LETTER ── */}
      <section className="px-7 md:px-14 py-14">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-[12px] font-black tracking-[0.18em] text-neutral-500"><WCopy portfolio={portfolio} edit={edit} copyKey="w4CoverLabel" defaultValue="COVER LETTER" /></h2>
            <W4Film className="text-neutral-500" />
          </div>
          <div className="grid md:grid-cols-[192px,1fr] gap-12" data-reveal>
            <div>
              <EditableProfileImage portfolio={portfolio} edit={edit} accent={acc} />
              <div className="mt-8 space-y-2.5 text-[10.4px]">
                <div className="grid grid-cols-[64px,1fr] items-baseline">
                  <span className="font-black tracking-[0.06em]" style={{ color: acc }}><WCopy portfolio={portfolio} edit={edit} copyKey="w4NameLabel" defaultValue="NAME" /></span>
                  <span className="font-semibold" style={{ color: alphaHex(th.ink, 0.75) }}>
                    <WT edit={edit} value={edit ? portfolio.userName : data.name} onChange={v => edit?.update('userName', v)} placeholder="이름" />
                  </span>
                </div>
                <div className="grid grid-cols-[64px,1fr] items-baseline">
                  <span className="font-black tracking-[0.06em]" style={{ color: acc }}><WCopy portfolio={portfolio} edit={edit} copyKey="w4MailLabel" defaultValue="MAIL" /></span>
                  <span className="font-semibold" style={{ color: alphaHex(th.ink, 0.75) }}>
                    <WT edit={edit} value={contact.email || ''} onChange={v => edit?.updateContact('email', inlineHtmlToPlainText(v))} placeholder="이메일" />
                  </span>
                </div>
                <div className="grid grid-cols-[64px,1fr] items-baseline">
                  <span className="font-black tracking-[0.06em]" style={{ color: acc }}><WCopy portfolio={portfolio} edit={edit} copyKey="w4NumberLabel" defaultValue="NUMBER" /></span>
                  <span className="font-semibold" style={{ color: alphaHex(th.ink, 0.75) }}>
                    <WT edit={edit} value={contact.phone || ''} onChange={v => edit?.updateContact('phone', inlineHtmlToPlainText(v))} placeholder="전화번호" />
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-[12px] font-black tracking-[0.12em] mb-7" style={{ color: acc }}><WCopy portfolio={portfolio} edit={edit} copyKey="w4AboutLabel" defaultValue="ABOUT ME" /></h3>
              <div className="text-[11.2px] leading-[2]" style={{ wordBreak: 'keep-all', color: alphaHex(th.ink, 0.85) }}>
                <WTArea edit={edit} value={edit ? (portfolio.about || '') : data.about} onChange={v => edit?.update('about', v)} placeholder="자기소개를 입력하세요" />
              </div>
              {(keywords.length > 0 || edit) && (
                <>
                  <h3 className="text-[12px] font-black tracking-[0.12em] mt-12 mb-5" style={{ color: acc }}><WCopy portfolio={portfolio} edit={edit} copyKey="w4KeywordLabel" defaultValue="KEYWORD" /></h3>
                  <div className="flex flex-wrap gap-2.5">
                    {keywords.map((kw, i) => (
                      <span key={`${kw.cat}-${kw.idx}-${i}`} className="relative group px-5 py-2 border text-[11.5px] font-bold" style={{ borderColor: acc, color: acc, borderRadius: '50% / 45%' }}>
                        <WRm edit={edit} onClick={() => edit.removeSkill(kw.cat, kw.idx)} />
                        {edit
                          ? <EditText value={kw.name} onChange={v => edit.updateSkill(kw.cat, kw.idx, inlineHtmlToPlainText(v))} placeholder="키워드" />
                          : kw.name}
                      </span>
                    ))}
                    {edit && (
                      <button type="button" onClick={() => edit.addSkill()} className="px-4 py-2 border border-dashed text-[11.5px] font-bold opacity-60 hover:opacity-100" style={{ borderColor: acc, color: acc, borderRadius: '50% / 45%' }}>
                        <Plus size={9.6} className="inline" /> 추가
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── RESUME ── */}
      <section className="px-7 md:px-14 py-14 border-t" style={{ borderColor: alphaHex(th.ink, 0.08) }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-[12px] font-black tracking-[0.18em] text-neutral-500"><WCopy portfolio={portfolio} edit={edit} copyKey="w4ResumeLabel" defaultValue="RESUME" /></h2>
            <W4Film className="text-neutral-500" />
          </div>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-12" data-reveal>
            {/* EXPERIENCE */}
            <div>
              <h3 className="text-[11.2px] font-black tracking-[0.12em] mb-6" style={{ color: acc }}><WCopy portfolio={portfolio} edit={edit} copyKey="w4ExperienceLabel" defaultValue="EXPERIENCE" /></h3>
              <div className="space-y-7">
                {expList.map((exp, i) => (
                  <div key={i} className="grid grid-cols-[51.2px,1fr] gap-4 relative group">
                    <WRm edit={edit} onClick={() => edit.removeItem('experiences', i)} />
                    <span className="text-[10.8px] font-black">
                      <WT edit={edit} value={edit ? (exp.period || '') : ((exp.period || '').slice(0, 4) || '—')} onChange={v => edit?.updateItem('experiences', i, { period: inlineHtmlToPlainText(v) })} placeholder="기간" />
                    </span>
                    <div>
                      <p className="text-[10.8px] font-bold leading-snug" style={{ wordBreak: 'keep-all' }}>
                        <WT edit={edit} value={exp.company || exp.title || ''} onChange={v => edit?.updateItem('experiences', i, { company: v, title: v })} placeholder="경험명" />
                      </p>
                      <p className="text-[9.6px] font-semibold text-neutral-500 mt-1">·{' '}
                        <WT edit={edit} value={exp.role || ''} onChange={v => edit?.updateItem('experiences', i, { role: v })} placeholder="역할" />
                      </p>
                      {edit ? (
                        <div className="text-[9.2px] text-neutral-400 mt-1 leading-relaxed">
                          <WTArea edit={edit} value={exp.description || ''} onChange={v => edit.updateItem('experiences', i, { description: v })} placeholder="설명 / 성과" />
                        </div>
                      ) : (exp.details || []).slice(0, 3).map((d, di) => (
                        <p key={di} className="text-[9.2px] text-neutral-400 mt-1 leading-relaxed" style={{ wordBreak: 'keep-all' }}>- {d}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <WImportExperience edit={edit} tone={alphaHex(th.ink, 0.45)} />
            </div>
            <div className="space-y-12">
              {/* EDUCATION */}
              {(eduList.length > 0 || edit) && (
                <div>
                  <h3 className="text-[11.2px] font-black tracking-[0.12em] mb-6" style={{ color: acc }}><WCopy portfolio={portfolio} edit={edit} copyKey="w4EducationLabel" defaultValue="EDUCATION" /></h3>
                  <div className="space-y-4">
                    {eduList.map((edu, i) => (
                      <div key={i} className="grid grid-cols-[57.6px,1fr,auto] gap-3 items-baseline relative group">
                        <WRm edit={edit} onClick={() => edit.removeItem('education', i)} />
                        <span className="text-[10.4px] font-black">
                          <WT edit={edit} value={edit ? (edu.period || '') : (edu.period || '').slice(0, 7)} onChange={v => edit?.updateItem('education', i, { period: inlineHtmlToPlainText(v) })} placeholder="기간" />
                        </span>
                        <span className="text-[10.8px] font-bold">
                          <WT edit={edit} value={edit ? (edu.name || edu.school || '') : edu.school} onChange={v => edit?.updateItem('education', i, { name: v })} placeholder="학교명" />
                        </span>
                        <span className="text-[9.2px] text-neutral-400 text-right">
                          <WT edit={edit} value={edit ? (edu.degree || edu.major || '') : edu.major} onChange={v => edit?.updateItem('education', i, { degree: v })} placeholder="전공" />
                        </span>
                      </div>
                    ))}
                  </div>
                  <WAdd edit={edit} onClick={() => edit.addItem('education', { name: '', degree: '', period: '' })} label="학력 추가" tone={alphaHex(th.ink, 0.45)} />
                </div>
              )}
              {/* CERTIFICATE (수상·자격) */}
              {(awardList.length > 0 || edit) && (
                <div>
                  <h3 className="text-[11.2px] font-black tracking-[0.12em] mb-6" style={{ color: acc }}><WCopy portfolio={portfolio} edit={edit} copyKey="w4CertificateLabel" defaultValue="CERTIFICATE" /></h3>
                  <div className="space-y-4">
                    {awardList.map((a, i) => (
                      <div key={i} className="grid grid-cols-[57.6px,1fr] gap-3 items-baseline relative group">
                        <WRm edit={edit} onClick={() => edit.removeItem('awards', i)} />
                        <span className="text-[10.4px] font-black">
                          <WT edit={edit} value={a.date || ''} onChange={v => edit?.updateItem('awards', i, { date: inlineHtmlToPlainText(v) })} placeholder="날짜" />
                        </span>
                        <span className="text-[10.8px] font-bold" style={{ wordBreak: 'keep-all' }}>
                          <WT edit={edit} value={a.title || ''} onChange={v => edit?.updateItem('awards', i, { title: v })} placeholder="수상명/자격증" />
                        </span>
                      </div>
                    ))}
                  </div>
                  <WAdd edit={edit} onClick={() => edit.addItem('awards', { title: '', date: '' })} label="수상/자격 추가" tone={alphaHex(th.ink, 0.45)} />
                </div>
              )}
              {/* TOOLS */}
              {skills.length > 0 && (
                <div>
                  <h3 className="text-[11.2px] font-black tracking-[0.12em] mb-6" style={{ color: acc }}><WCopy portfolio={portfolio} edit={edit} copyKey="w4ToolsLabel" defaultValue="TOOLS" /></h3>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s, i) => (
                      <span key={i} className="px-3.5 py-1 rounded-full border border-neutral-300 text-[9.2px] font-bold text-neutral-600">{s.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTENTS 티켓 밴드 ── */}
      <section className="text-white px-7 md:px-14 py-20 relative" style={{ background: acc }}>
        {/* 상단 절취 삼각형 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12.8px] border-r-[12.8px] border-t-[14.4px] border-l-transparent border-r-transparent" style={{ borderTopColor: th.bg }} />
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-14 items-center">
          <div data-reveal>
            <W4WordmarkField
              edit={edit}
              value={portfolio.webCopy?.w4ContentsWordmark ?? 'Contents'}
              onChange={value => edit?.update('webCopy', { ...(portfolio.webCopy || {}), w4ContentsWordmark: value })}
              size="clamp(36.8px,6vw,83.2px)"
            />
            <div className="w4-barcode h-9 w-64 mt-16 opacity-90" />
          </div>
          <div data-reveal>
            <W4Ticket
              name={<WT edit={edit} value={edit ? portfolio.userName : data.name} onChange={value => edit?.update('userName', value)} placeholder="이름" />}
              fromCaption={<WCopy portfolio={portfolio} edit={edit} copyKey="w4FromCaption" defaultValue="from" />}
              toCaption={<WCopy portfolio={portfolio} edit={edit} copyKey="w4ToCaption" defaultValue="to" />}
              fromLabel={<WCopy portfolio={portfolio} edit={edit} copyKey="w4FromValue" defaultValue="Job Seeker" />}
              toLabel={<WT edit={edit} value={edit ? (portfolio.headline || '') : (data.title || '')} onChange={value => edit?.update('headline', value)} placeholder="직무/한 줄 소개" />}
              rows={pageRows}
              accent={acc}
              ink={th.ink}
            />
          </div>
        </div>
      </section>

      {/* ── 프로젝트 섹션 (컬러/화이트 교차 티켓) ── */}
      {projList.map((proj, idx) => {
        const dark = idx % 2 === 1;
        const tech = edit ? (proj.skills || []) : (proj.techStack || []);
        const wordSrc = inlineHtmlToPlainText(proj.tag || '') || `Work ${idx + 1}`;
        const projectTitle = edit ? (proj.company || proj.title || '') : proj.name;
        const projectLabel = inlineHtmlToPlainText(proj.wordmark || wordSrc || `Project ${idx + 1}`).slice(0, 24);
        const hasVisual = !!projImg(proj);
        const mediaFrame = imageFrameStyle(proj.imageStyle, '3 / 2', 'soft');
        return (
          <section key={idx} className={`px-7 py-20 md:px-14 md:py-28 relative ${dark ? 'text-white' : ''}`} style={dark ? { background: acc } : {}}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12.8px] border-r-[12.8px] border-t-[14.4px] border-l-transparent border-r-transparent" style={{ borderTopColor: dark ? th.bg : acc }} />
            <div
              className="max-w-5xl mx-auto grid items-center gap-12 md:grid-cols-[minmax(0,0.88fr)_minmax(360px,1.12fr)] md:gap-16 relative group/proj cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8"
              style={{ outlineColor: dark ? '#ffffff' : acc }}
              {...projectCardInteraction(onOpenProject, idx, projectTitle)}
            >
              {edit && (
                <button type="button" onClick={() => edit.removeItem('experiences', idx)}
                  className="absolute -top-8 right-0 z-20 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/proj:opacity-100 transition-opacity shadow-sm"><X size={9.6} /></button>
              )}
              <div data-reveal className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11.5px] font-black ${dark ? 'border-white/35 text-white' : 'border-current'}`} style={!dark ? { color: acc } : undefined}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className={`h-px w-9 ${dark ? 'bg-white/35' : 'bg-neutral-300'}`} />
                  <span className={`min-w-0 truncate text-[11.5px] font-black uppercase tracking-[0.2em] ${dark ? 'text-white/72' : 'text-neutral-500'}`}>
                    {edit
                      ? <EditText value={proj.wordmark || wordSrc} onChange={value => edit.updateItem('experiences', idx, { wordmark: inlineHtmlToPlainText(value) })} placeholder="프로젝트 라벨" />
                      : projectLabel}
                  </span>
                </div>

                <h3 className="mt-7 text-[clamp(28px,3.2vw,42px)] font-black leading-[1.12] tracking-[-0.045em]" style={{ wordBreak: 'keep-all', color: dark ? '#ffffff' : th.ink }}>
                  <WT edit={edit} value={projectTitle} onChange={v => edit?.updateItem('experiences', idx, { company: v, title: v })} placeholder="프로젝트명" />
                </h3>

                <div className={`mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] font-bold ${dark ? 'text-white/62' : 'text-neutral-500'}`}>
                  <span><WT edit={edit} value={proj.period || 'PROJECT'} onChange={v => edit?.updateItem('experiences', idx, { period: inlineHtmlToPlainText(v) })} placeholder="기간" /></span>
                  {(proj.role || edit) && <><span className="opacity-45">/</span><span><WT edit={edit} value={proj.role || ''} onChange={v => edit?.updateItem('experiences', idx, { role: inlineHtmlToPlainText(v) })} placeholder="역할" /></span></>}
                </div>

                <div className={`mt-6 max-w-[46rem] text-[12.5px] font-medium leading-[1.9] md:text-[13.5px] ${dark ? 'text-white/78' : 'text-neutral-600'}`} style={{ wordBreak: 'keep-all' }}>
                  <WTArea edit={edit} value={edit ? (proj.description || '') : proj.desc} onChange={v => edit?.updateItem('experiences', idx, { description: v })} placeholder="프로젝트 설명" />
                </div>

                {(tech.length > 0) && (
                  <div className="mt-7 flex flex-wrap gap-2">
                    {tech.slice(0, 5).map((t, ti) => (
                      <span key={ti} className={`rounded-full border px-3.5 py-1.5 text-[9.5px] font-extrabold ${dark ? 'border-white/28 bg-white/5 text-white/88' : 'border-neutral-300 bg-white/55 text-neutral-600'}`}>{typeof t === 'string' ? t : t?.name}</span>
                    ))}
                  </div>
                )}

                <div className={`mt-9 inline-flex items-center gap-2 border-b pb-1.5 text-[9.5px] font-black uppercase tracking-[0.16em] ${dark ? 'border-white/45 text-white' : 'border-neutral-400 text-neutral-800'}`}>
                  View case study <ArrowUpRight size={12.8} />
                </div>
              </div>

              <div data-reveal className="min-w-0">
                <div className="overflow-hidden rounded-[24px] border bg-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] transition-transform duration-300 group-hover/proj:-translate-y-1" style={{ borderColor: dark ? alphaHex('#ffffff', 0.26) : alphaHex(th.ink, 0.12) }}>
                  <div className="relative overflow-hidden bg-neutral-100" style={mediaFrame}>
                    <EditableThumb edit={edit} proj={proj} idx={idx} label={false} defaultAspect="3 / 2" defaultShape="soft" />
                    {!hasVisual && (
                      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-7 text-neutral-900 md:p-9">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[10.5px] font-black uppercase tracking-[0.22em] opacity-55">Project visual</span>
                          <span className="text-[12px] font-black opacity-35">{String(idx + 1).padStart(2, '0')}</span>
                        </div>
                        <p className="max-w-[82%] text-[clamp(20px,2.6vw,32px)] font-black leading-[1.12] tracking-[-0.04em]" style={{ wordBreak: 'keep-all' }}>{inlineHtmlToPlainText(projectTitle) || `Project ${idx + 1}`}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-5 border-t border-neutral-200 bg-white px-5 py-4 text-neutral-900 md:px-6">
                    <div className="min-w-0">
                      <p className="text-[8.5px] font-black uppercase tracking-[0.2em] text-neutral-400">Selected work · {String(idx + 1).padStart(2, '0')}</p>
                      <p className="mt-1 truncate text-[11.5px] font-extrabold">{inlineHtmlToPlainText(projectLabel)}</p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: acc }}><ArrowUpRight size={14.4} /></span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}
      {edit && (
        <div className="px-7 md:px-14 pb-10 max-w-5xl mx-auto">
          <WImportExperience edit={edit} tone={alphaHex(th.ink, 0.45)} />
        </div>
      )}

      {/* ── 푸터 ── */}
      <footer className="text-white px-7 md:px-14 py-12" style={{ background: acc }}>
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <p className="text-[10.4px] font-black tracking-[0.2em] uppercase"><WCopy portfolio={portfolio} edit={edit} copyKey="w4FooterCopy" defaultValue="Thank You For Watching" /></p>
          <div className="flex items-center gap-5 text-[9.6px] font-bold text-white/70">
            <WT edit={edit} value={contact.email || ''} onChange={v => edit?.updateContact('email', inlineHtmlToPlainText(v))} placeholder="이메일" />
            <WT edit={edit} value={contact.phone || ''} onChange={v => edit?.updateContact('phone', inlineHtmlToPlainText(v))} placeholder="전화번호" />
          </div>
        </div>
      </footer>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// web-5 · Paper Resume — 회색 배경 위 A4 종이 한 장, 흑백 이력서 (레퍼런스 2 재현)
// ═════════════════════════════════════════════════════════════════════════════

function W5SectionTitle({ ko, en }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <p className="text-[10.4px] font-black text-neutral-900 shrink-0">{ko} <span className="font-semibold text-neutral-400">/ {en}</span></p>
      <span className="flex-1 h-px bg-neutral-200" />
    </div>
  );
}

const W5_SPECIALITY_ICONS = [Palette, LayoutGrid, PenTool, Code];

export function WebTemplate5({ portfolio }) {
  const data = mapPortfolioToTemplateData(portfolio);
  const rootRef = useReveal();
  const skillObjs = data.skills || [];
  const expList = data.experience || [];
  const initial = (String(data.name || 'P').trim())[0];

  return (
    <div ref={rootRef} className="min-h-screen bg-[#d7d9db] font-sans antialiased py-10 md:py-16 px-4">
      <style>{SHARED_CSS}</style>
      <div data-reveal className="max-w-[688px] mx-auto bg-white text-neutral-900 shadow-[0_19.2px_48px_-19.2px_rgba(0,0,0,.45)] px-8 md:px-14 py-12 md:py-14">

        {/* 헤더 */}
        <header className="flex items-center justify-between pb-8 border-b border-neutral-200">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 border-[2px] border-neutral-900 rotate-45 flex items-center justify-center">
              <span className="-rotate-45 text-[12.8px] font-black">{initial}</span>
            </div>
            <div>
              <p className="text-[15.2px] font-black tracking-tight leading-none">{data.name}</p>
              <p className="text-[8.8px] font-semibold text-neutral-400 mt-1.5 tracking-[0.06em]">{data.title}</p>
            </div>
          </div>
          <p className="text-[9.2px] font-semibold text-neutral-400 hidden sm:block">{data.social?.blog || data.email}</p>
        </header>

        <div className="grid md:grid-cols-[38%,1fr] gap-x-12 pt-10">
          {/* ── 좌측 컬럼 ── */}
          <div className="space-y-11">
            {/* 기본 정보 */}
            <section>
              <W5SectionTitle ko="기본 정보" en="Basic Info" />
              <div className="space-y-3 text-[11.5px] font-medium text-neutral-600">
                {data.location && <p className="flex items-center gap-3"><MapPin size={11.2} className="text-neutral-900 shrink-0" />{data.location}</p>}
                {data.phone && <p className="flex items-center gap-3"><Phone size={11.2} className="text-neutral-900 shrink-0" />{data.phone}</p>}
                {data.email && <p className="flex items-center gap-3"><Mail size={11.2} className="text-neutral-900 shrink-0" />{data.email}</p>}
                {data.social?.blog && <p className="flex items-center gap-3"><Globe size={11.2} className="text-neutral-900 shrink-0" />{data.social.blog}</p>}
              </div>
            </section>

            {/* 나의 기술 (아이콘 원) */}
            {skillObjs.length > 0 && (
              <section>
                <W5SectionTitle ko="나의 기술" en="My Specialities" />
                <div className="grid grid-cols-4 gap-2">
                  {skillObjs.slice(0, 4).map((s, i) => {
                    const Icon = W5_SPECIALITY_ICONS[i % W5_SPECIALITY_ICONS.length];
                    return (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full border-[1.5px] border-neutral-900 flex items-center justify-center"><Icon size={14.4} /></div>
                        <p className="text-[8.4px] font-bold text-neutral-500 text-center leading-tight">{s.name}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 응용 도구 (슬라이더 바) */}
            {skillObjs.length > 0 && (
              <section>
                <W5SectionTitle ko="응용 도구" en="Software Skills" />
                <div className="space-y-4">
                  {skillObjs.slice(0, 6).map((s, i) => {
                    const pct = Math.min(100, Math.max(10, parseInt(s.percent) || 70));
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-[4.8px] bg-neutral-900 text-white text-[8.8px] font-black flex items-center justify-center shrink-0">
                          {String(s.name).replace(/[^A-Za-z가-힣0-9]/g, '').slice(0, 2)}
                        </span>
                        <div className="flex-1">
                          <p className="text-[9.6px] font-bold mb-1.5">{s.name}</p>
                          <div className="relative h-[2.4px] bg-neutral-200 rounded-full">
                            <div className="absolute inset-y-0 left-0 bg-neutral-900 rounded-full" style={{ width: `${pct}%` }} />
                            <span className="absolute w-[7.2px] h-[7.2px] rounded-full bg-neutral-900 top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 나에 대해 */}
            {data.about && (
              <section>
                <W5SectionTitle ko="나에 대해" en="About Me" />
                <p className="text-[9.6px] leading-[2] text-neutral-500 whitespace-pre-wrap" style={{ wordBreak: 'keep-all', textAlign: 'justify' }}>{data.about}</p>
              </section>
            )}
          </div>

          {/* ── 우측 컬럼 ── */}
          <div className="space-y-11 mt-11 md:mt-0">
            {/* 업무 경험 — 큰 숫자 */}
            {expList.length > 0 && (
              <section>
                <W5SectionTitle ko="업무 경험" en="Work Experience" />
                <div>
                  {expList.map((exp, i) => (
                    <div key={i} className={`grid grid-cols-[41.6px,1fr] gap-4 ${i ? 'mt-7 pt-7 border-t border-neutral-100' : ''}`}>
                      <span className="text-[36.8px] font-extralight leading-none text-neutral-900 select-none">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                          <h3 className="text-[11.6px] font-black" style={{ wordBreak: 'keep-all' }}>{exp.company}</h3>
                          {exp.period && <span className="text-[8.4px] font-bold text-neutral-400">({exp.period})</span>}
                        </div>
                        {exp.role && <p className="text-[9.2px] font-bold text-neutral-500 mt-1.5">직무: {exp.role}</p>}
                        {(exp.details || []).length > 0 && (
                          <p className="text-[9.2px] leading-[1.9] text-neutral-400 mt-2" style={{ wordBreak: 'keep-all', textAlign: 'justify' }}>
                            {exp.details.slice(0, 3).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 학력 */}
            {(data.education || []).length > 0 && (
              <section>
                <W5SectionTitle ko="학력" en="Education" />
                <div className="space-y-3">
                  {data.education.map((edu, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3">
                      <p className="text-[11.5px] font-black">{edu.school} <span className="font-semibold text-neutral-400">— {edu.major}</span></p>
                      <span className="text-[8.4px] font-bold text-neutral-400 shrink-0">{edu.period}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 수상 및 자격 */}
            {(data.awards || []).length > 0 && (
              <section>
                <W5SectionTitle ko="수상 및 자격" en="Awards & Certificates" />
                <div className="space-y-3">
                  {data.awards.map((a, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3">
                      <p className="text-[11.5px] font-black" style={{ wordBreak: 'keep-all' }}>{a.title}</p>
                      <span className="text-[8.4px] font-bold text-neutral-400 shrink-0">{a.date}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 작업 & 연락처 */}
            <section>
              <W5SectionTitle ko="작업 & 연락처" en="Works & Contact" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {[
                  [Mail, data.email],
                  [Phone, data.phone],
                  [Globe, data.social?.blog],
                  [MapPin, data.location],
                ].filter(([, v]) => v).map(([Icon, v], i) => (
                  <p key={i} className="flex items-center gap-2.5 text-[9.2px] font-bold text-neutral-600 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center shrink-0"><Icon size={9.6} /></span>
                    <span className="truncate">{v}</span>
                  </p>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
      <p className="text-center text-[8.8px] font-bold tracking-[0.14em] text-neutral-400 mt-8">© {new Date().getFullYear()} {data.name}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// web-6 · Impact Grid — 미션 문구 + 가로 프로젝트 레일 + 임팩트 카드
// ═════════════════════════════════════════════════════════════════════════════
const W6_CSS = `
.w6-rail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,31.5%);overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding-bottom:6.4px}
.w6-rail::-webkit-scrollbar{display:none}
.w6-project-card{scroll-snap-align:start;transition:transform .3s ease,box-shadow .3s ease}
.w6-project-card:hover{transform:translateY(-4.8px);box-shadow:0 14.4px 36px rgba(0,0,0,.12)}
.w6-news-card{transition:transform .3s ease}
.w6-news-card:hover{transform:translateY(-3.2px)}
@media(max-width:767px){.w6-rail{grid-auto-columns:84%}}
`;

function W6CopyArea({ portfolio, edit, copyKey, defaultValue, className = '', placeholder = '내용을 입력하세요' }) {
  const value = portfolio?.webCopy?.[copyKey] ?? defaultValue;
  return (
    <WTArea
      edit={edit}
      value={value}
      onChange={next => edit?.update('webCopy', { ...(portfolio.webCopy || {}), [copyKey]: next })}
      className={className}
      placeholder={placeholder}
    />
  );
}

export function WebTemplate6({ portfolio, edit, onOpenProject }) {
  const th = getWebTheme(portfolio);
  const data = mapPortfolioToTemplateData(portfolio);
  const rootRef = useReveal();
  const projects = edit
    ? (portfolio.experiences || [])
    : data.projects.map((project, idx) => ({ ...project, imageStyle: portfolio.experiences?.[idx]?.imageStyle || {} }));
  const skills = edit ? flatSkills(portfolio) : (data.skills || []).map((s, i) => ({ name: s.name, cat: null, idx: i })).filter(s => s.name);
  const awards = edit ? (portfolio.awards || []) : data.awards;
  const education = edit ? (portfolio.education || []) : data.education;
  const contact = edit ? (portfolio.contact || {}) : { email: data.email, phone: data.phone, website: data.social?.blog };
  const line = alphaHex(th.ink, 0.11);
  const muted = alphaHex(th.ink, 0.55);
  const soft = alphaHex(th.ink, 0.055);
  const cardTones = [th.ink, th.accent, '#f4eee7', '#2559c7', '#8fd8f7'];
  const cardText = index => index % cardTones.length === 0 || index % cardTones.length === 1 || index % cardTones.length === 3 ? '#ffffff' : '#171717';
  const nav = [
    ['projects', '프로젝트', 'w6NavProjects'],
    ['stories', '경험 이야기', 'w6NavStories'],
    ['impact', '나의 임팩트', 'w6NavImpact'],
    ['contact', '연락처', 'w6NavContact'],
  ];

  return (
    <div ref={rootRef} className="min-h-screen font-sans antialiased" style={{ background: th.bg, color: th.ink }}>
      <style>{SHARED_CSS + W6_CSS}</style>

      <header className="border-b" style={{ borderColor: line }}>
        <div className="mx-auto flex max-w-[1008px] items-center justify-between gap-6 px-5 py-5 sm:px-8 md:px-12">
          <div className="text-[14.4px] font-black tracking-[-0.06em]">
            <WCopy portfolio={portfolio} edit={edit} copyKey="w6Brand" defaultValue="portfolio!mpact" />
          </div>
          <nav className="hidden items-center gap-8 text-[8.8px] font-black md:flex">
            {nav.map(([id, label, key]) => (
              <a key={id} href={edit ? undefined : `#w6-${id}`} onClick={event => { if (edit) event.preventDefault(); }} className="transition-opacity hover:opacity-45">
                <WCopy portfolio={portfolio} edit={edit} copyKey={key} defaultValue={label} />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-[8px] font-bold sm:inline"><WT edit={edit} value={edit ? portfolio.userName : data.name} onChange={value => edit?.update('userName', value)} placeholder="이름" /></span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: line }}><LayoutGrid size={12} /></span>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1008px] px-5 pb-10 pt-12 sm:px-8 md:px-12 md:pb-14 md:pt-20" data-reveal>
          <h1 className="max-w-3xl text-[31.2px] font-black leading-[1.16] tracking-[-0.055em] md:text-[51.2px]">
            <W6CopyArea portfolio={portfolio} edit={edit} copyKey="w6Hero" defaultValue={'경험과 사람이 만드는\n더 나은 결과'} placeholder="메인 문구" />
          </h1>
          <div className="mt-9 flex flex-wrap gap-2">
            {[
              ['전체', 'w6FilterAll'], ['Product', 'w6FilterProduct'], ['Design', 'w6FilterDesign'], ['Technology', 'w6FilterTech'],
            ].map(([label, key], index) => (
              <span key={key} className="rounded-full px-4 py-2 text-[8px] font-black" style={index === 0 ? { background: th.ink, color: th.bg } : { background: soft, color: muted }}>
                <WCopy portfolio={portfolio} edit={edit} copyKey={key} defaultValue={label} />
              </span>
            ))}
          </div>
        </section>

        <section id="w6-projects" className="mx-auto max-w-[1104px] overflow-hidden px-5 sm:px-8 md:px-12" data-reveal>
          <div className="mb-5 flex items-end justify-between gap-5">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.14em]" style={{ color: th.accent }}><WCopy portfolio={portfolio} edit={edit} copyKey="w6ProjectEyebrow" defaultValue="FEATURED WORK" /></p>
              <h2 className="mt-1 text-[20px] font-black tracking-[-0.045em] md:text-[28.8px]"><WCopy portfolio={portfolio} edit={edit} copyKey="w6ProjectTitle" defaultValue="기술과 경험으로 만든 변화" /></h2>
            </div>
            <p className="hidden max-w-xs text-right text-[8.8px] leading-[1.6] md:block" style={{ color: muted }}><WCopy portfolio={portfolio} edit={edit} copyKey="w6ProjectHint" defaultValue="카드를 눌러 프로젝트의 과정과 결과를 확인하세요" /></p>
          </div>

          <div className="w6-rail gap-4">
            {projects.map((project, idx) => {
              const tone = cardTones[idx % cardTones.length];
              const textColor = cardText(idx);
              return (
                <article
                  key={idx}
                  className="w6-project-card group relative flex min-h-[376px] cursor-pointer flex-col overflow-hidden rounded-[19.2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ background: tone, color: textColor, outlineColor: th.accent }}
                  {...projectCardInteraction(onOpenProject, idx, edit ? (project.company || project.title) : project.name)}
                >
                  <WRm edit={edit} onClick={() => edit.removeItem('experiences', idx)} />
                  <div className="shrink-0 overflow-hidden transition-all" style={imageFrameStyle(project.imageStyle, '4 / 3', 'square')}>
                    <EditableThumb edit={edit} proj={project} idx={idx} label={false} defaultAspect="4 / 3" defaultShape="square" />
                  </div>
                  <div className="flex flex-1 flex-col p-5 md:p-6">
                    <p className="text-[7.6px] font-black uppercase tracking-[0.08em] opacity-70">
                      <WT edit={edit} value={project.tag || 'PROJECT'} onChange={value => edit?.updateItem('experiences', idx, { tag: inlineHtmlToPlainText(value) })} placeholder="분류" />
                    </p>
                    <h3 className="mt-2 text-[19.2px] font-black leading-[1.06] tracking-[-0.045em]">
                      <WT edit={edit} value={edit ? (project.company || project.title || '') : project.name} onChange={value => edit?.updateItem('experiences', idx, { company: value, title: value })} placeholder="프로젝트명" />
                    </h3>
                    <div className="mt-auto pt-5 text-[8.8px] font-medium leading-[1.65] opacity-75">
                      <WTArea edit={edit} value={edit ? (project.description || '') : project.desc} onChange={value => edit?.updateItem('experiences', idx, { description: value })} placeholder="프로젝트 설명" className={edit ? '' : 'line-clamp-3'} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <WImportExperience edit={edit} tone={muted} />
        </section>

        <section id="w6-stories" className="mx-auto max-w-[1008px] px-5 py-20 sm:px-8 md:px-12 md:py-28" data-reveal>
          <h2 className="max-w-lg text-[24.8px] font-black leading-[1.25] tracking-[-0.05em] md:text-[36px]">
            <W6CopyArea portfolio={portfolio} edit={edit} copyKey="w6StoriesTitle" defaultValue={'차근차근 쌓아온\n경험 이야기'} placeholder="경험 섹션 제목" />
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {projects.slice(0, 3).map((project, idx) => (
              <article
                key={idx}
                className="w6-news-card group relative flex min-h-[344px] cursor-pointer flex-col overflow-hidden rounded-[17.6px]"
                style={{ background: soft }}
                {...projectCardInteraction(onOpenProject, idx, edit ? (project.company || project.title) : project.name)}
              >
                <div className="flex min-h-[168px] flex-1 flex-col p-5 md:p-6">
                  <p className="w-fit rounded-full px-3 py-1 text-[7.2px] font-black" style={{ background: th.bg }}><WT edit={edit} value={project.tag || '경험'} onChange={value => edit?.updateItem('experiences', idx, { tag: inlineHtmlToPlainText(value) })} placeholder="분류" /></p>
                  <h3 className="mt-5 text-[16.8px] font-black leading-[1.2] tracking-[-0.04em]"><WT edit={edit} value={edit ? (project.company || project.title || '') : project.name} onChange={value => edit?.updateItem('experiences', idx, { company: value, title: value })} placeholder="경험 제목" /></h3>
                  <p className="mt-auto pt-4 text-[7.6px]" style={{ color: muted }}>{project.period || 'PORTFOLIO STORY'}</p>
                </div>
                <div className="overflow-hidden transition-all" style={imageFrameStyle(project.imageStyle, '4 / 3', 'square')}><EditableThumb edit={edit} proj={project} idx={idx} label={false} defaultAspect="4 / 3" defaultShape="square" /></div>
              </article>
            ))}
          </div>
        </section>

        <section id="w6-impact" className="mx-auto max-w-[1008px] px-5 pb-24 sm:px-8 md:px-12 md:pb-32" data-reveal>
          <h2 className="max-w-xl text-[24.8px] font-black leading-[1.25] tracking-[-0.05em] md:text-[36px]">
            <W6CopyArea portfolio={portfolio} edit={edit} copyKey="w6ImpactTitle" defaultValue={'더 나은 내일을 만드는\n나의 임팩트'} placeholder="임팩트 섹션 제목" />
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-[0.72fr,1.45fr]">
            <div className="grid gap-4">
              <div className="rounded-[17.6px] p-6 md:p-8" style={{ background: soft }}>
                <p className="text-[28.8px] font-black tracking-[-0.06em]">{String(projects.length).padStart(2, '0')}</p>
                <p className="mt-2 text-[11.2px] font-black"><WCopy portfolio={portfolio} edit={edit} copyKey="w6ImpactProjects" defaultValue="완성한 프로젝트" /></p>
                <p className="mt-7 text-[8px]" style={{ color: muted }}>{skills.length} SKILLS · {awards.length} AWARDS</p>
              </div>
              <div className="rounded-[17.6px] p-6 md:p-8" style={{ background: soft }}>
                <p className="text-[11.2px] font-black"><WCopy portfolio={portfolio} edit={edit} copyKey="w6ImpactPath" defaultValue="배우고 성장해 온 길" /></p>
                <div className="mt-5 space-y-3">
                  {education.slice(0, 2).map((edu, index) => (
                    <div key={index} className="border-t pt-3 text-[8.4px]" style={{ borderColor: line }}>
                      <WT edit={edit} value={edit ? (edu.name || edu.school || '') : edu.school} onChange={value => edit?.updateItem('education', index, { name: value })} placeholder="학교명" />
                    </div>
                  ))}
                </div>
                <span className="mt-6 flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: th.ink }}><ArrowUpRight size={11.2} /></span>
              </div>
            </div>
            <div className="relative flex min-h-[344px] flex-col overflow-hidden rounded-[17.6px] p-7 md:p-10" style={{ background: alphaHex(th.accent, 0.72), color: th.ink }}>
              <h3 className="max-w-lg text-[20.8px] font-black leading-[1.22] tracking-[-0.045em] md:text-[31.2px]"><WCopy portfolio={portfolio} edit={edit} copyKey="w6ImpactStatement" defaultValue="좋은 경험과 기술의 가치가 사람을 이롭게 한다는 믿음" /></h3>
              <div className="mt-auto select-none text-[clamp(48px,8vw,116px)] font-black leading-[0.72] tracking-[-0.09em] opacity-25">impact</div>
              <div className="absolute -bottom-10 -right-8 h-52 w-52 rounded-full border-[22.4px] opacity-20" style={{ borderColor: th.ink }} />
            </div>
          </div>
        </section>
      </main>

      <footer id="w6-contact" className="border-t" style={{ borderColor: line, background: soft }}>
        <div className="mx-auto grid max-w-[1008px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1fr,1.5fr] md:px-12 md:py-16">
          <div>
            <p className="text-[12.8px] font-black"><WCopy portfolio={portfolio} edit={edit} copyKey="w6FooterBrand" defaultValue="portfolio!mpact" /></p>
            <p className="mt-3 max-w-sm text-[8.4px] leading-[1.7]" style={{ color: muted }}><WCopy portfolio={portfolio} edit={edit} copyKey="w6FooterIntro" defaultValue="경험과 기술로 가치 있는 변화를 만드는 포트폴리오입니다." /></p>
          </div>
          <div className="flex flex-wrap items-start gap-x-7 gap-y-3 text-[8.4px] font-bold md:justify-end">
            <span><Mail size={9.6} className="mr-1.5 inline" /><WT edit={edit} value={contact.email || ''} onChange={value => edit?.updateContact('email', inlineHtmlToPlainText(value))} placeholder="이메일" /></span>
            <span><Phone size={9.6} className="mr-1.5 inline" /><WT edit={edit} value={contact.phone || ''} onChange={value => edit?.updateContact('phone', inlineHtmlToPlainText(value))} placeholder="전화번호" /></span>
            <span><Globe size={9.6} className="mr-1.5 inline" /><WT edit={edit} value={contact.website || ''} onChange={value => edit?.updateContact('website', inlineHtmlToPlainText(value))} placeholder="웹사이트" /></span>
          </div>
          <p className="text-[7.2px] md:col-span-2" style={{ color: muted }}>© {new Date().getFullYear()} <WT edit={edit} value={edit ? portfolio.userName : data.name} onChange={value => edit?.update('userName', value)} placeholder="이름" />. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// ── 라우터 ───────────────────────────────────────────────────────────────────

export const WEB_TEMPLATE_IDS = ['web-1', 'web-2', 'web-3', 'web-4', 'web-5', 'web-6'];
// 템플릿 선택 화면에 노출되는 것들 (web-2/5는 실험용 랩 전용)
export const WEB_SELECTABLE_IDS = ['web-1', 'web-3', 'web-4', 'web-6'];

export default function WebPortfolioRenderer({
  portfolio,
  edit = null,
  embedded = false,
  editorToolbarOffset = 0,
  enableProjectModal = true,
  resizeToBase64,
}) {
  const templateId = portfolio?.templateId;
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(null);
  const experiences = portfolio?.experiences || [];
  const selectedRaw = Number.isInteger(selectedProjectIndex) ? experiences[selectedProjectIndex] : null;
  const selectedProject = selectedRaw ? {
    ...selectedRaw,
    title: selectedRaw.title || selectedRaw.company || `프로젝트 ${selectedProjectIndex + 1}`,
    date: selectedRaw.date || selectedRaw.period || '',
  } : null;
  const onOpenProject = enableProjectModal ? setSelectedProjectIndex : null;

  let template = null;
  if (templateId === 'web-1') template = <WebTemplate1 portfolio={portfolio} edit={edit} embedded={embedded} onOpenProject={onOpenProject} />;
  else if (templateId === 'web-2') template = <WebTemplate2 portfolio={portfolio} />;
  else if (templateId === 'web-3') template = <WebTemplate3 portfolio={portfolio} edit={edit} onOpenProject={onOpenProject} stickyTop={editorToolbarOffset} />;
  else if (templateId === 'web-4') template = <WebTemplate4 portfolio={portfolio} edit={edit} onOpenProject={onOpenProject} />;
  else if (templateId === 'web-5') template = <WebTemplate5 portfolio={portfolio} />;
  else if (templateId === 'web-6') template = <WebTemplate6 portfolio={portfolio} edit={edit} onOpenProject={onOpenProject} />;

  return (
    <>
      {template}
      {selectedProject && (
        <Suspense fallback={null}>
          <ProjectDetailModal
            key={`${selectedProjectIndex}-${selectedProject.experienceId || selectedProject.id || 'project'}`}
            exp={selectedProject}
            readOnly={!edit}
            onUpdate={edit ? (changes => {
              const synced = { ...changes };
              if (Object.prototype.hasOwnProperty.call(changes, 'title')) synced.company = changes.title;
              if (Object.prototype.hasOwnProperty.call(changes, 'date')) synced.period = changes.date;
              edit.updateItem('experiences', selectedProjectIndex, synced);
            }) : undefined}
            onClose={() => setSelectedProjectIndex(null)}
            resizeToBase64={resizeToBase64}
            jobAnalysis={portfolio?.jobAnalysis}
          />
        </Suspense>
      )}
    </>
  );
}

// 선택 화면 카드/모달 미리보기용 샘플 데이터
export const WEB_SAMPLE_PORTFOLIO = {
  userName: '홍길동',
  headline: '데이터로 문제를 해결하는 프로덕트 매니저',
  about: '안녕하세요. 사용자 경험을 설계하는 프로덕트 매니저 홍길동입니다.\n문제 해결을 위한 기획을 고민하고, 데이터로 검증하는 과정까지 즐깁니다. 지난 3년간 두 개의 서비스에서 전환율을 평균 28% 개선했습니다.',
  location: '서울, 대한민국',
  contact: { email: 'hello@fitpoly.kr', phone: '010-1234-5678', website: 'velog.io/@hong' },
  education: [
    { name: '한국대학교', degree: '시각디자인학과 학사', period: '2018.03 - 2024.02' },
    { name: 'IT 부트캠프', degree: '프론트엔드 개발 과정 수료', period: '2023.01 - 2023.06' },
  ],
  experiences: [
    { company: 'FitPoly 취준생 포트폴리오 서비스', role: 'PM · 팀 리드', period: '2024.03 - 현재', tag: 'Product', description: 'AI 기반 포트폴리오 생성 서비스를 기획하고 8명 팀을 리드했습니다. 베타 출시 2주 만에 가입자 84명을 모았습니다.', bullets: ['베타 가입자 84명 · 온보딩 전환율 68%', 'AI 파이프라인 기획'], skills: ['Figma', 'GA4'] },
    { company: '유저익스피리언스 리뉴얼', role: 'UI/UX Designer', period: '2022.03 - 2023.12', tag: 'Design', description: '자사 서비스 UI/UX 리뉴얼과 디자인 시스템 구축을 주도해 이탈률을 23% 낮췄습니다.', bullets: ['디자인 시스템 42종 구축'], skills: ['Figma'] },
    { company: '웹에이전시 반응형 프로젝트', role: 'Web Publisher', period: '2021.01 - 2022.02', tag: 'Web', description: '12개 클라이언트 사이트를 반응형으로 구축하고 크로스 브라우징을 최적화했습니다.', bullets: ['Lighthouse 성능 평균 92점'], skills: ['HTML/CSS'] },
  ],
  skills: { tools: ['Figma', 'Notion', 'GA4'], languages: ['HTML/CSS', 'React', 'SQL'], frameworks: ['Tailwind'] },
  awards: [
    { date: '2023.11', title: 'K-디자인 어워드 위너' },
    { date: '2022.05', title: '교내 웹 기획 공모전 대상' },
  ],
};
