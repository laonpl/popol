import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Github, Loader2, Sparkles } from 'lucide-react';
import { doc, getDoc, updateDoc } from '../../services/firestoreProxy';
import toast from 'react-hot-toast';
import { db } from '../../config/firebase';
import api from '../../services/api';
import { mergeCaseStudyIntoStructured } from '../../utils/caseStudySync';
import { CodeSnippet, toLines } from '../../components/portfolio/GitInsights';
import { ArchitectureDiagram, ArchitectureEditorCanvas, buildFallbackDiagram, computeNodeMetrics, autoLayoutPositions, hasXY, PAD } from '../../components/portfolio/ArchDiagram';
import FeedbackModal, { isFeedbackSnoozed } from '../../components/FeedbackModal';
import YooptaMiniEditor from '../../components/YooptaMiniEditor';
import { blocksToYooptaValue } from '../../utils/projectSections';

/* GitHub 커밋 분석 기반 딥다이브를 쓰는 개발 직군 — 케이스 스터디 구조가 직군별로 갈라지는 첫 분기 */
const DEV_GIT_JOBS = ['dev', 'aiml', 'devops'];

/* 마크다운/플레이스홀더 정리 */
const isDraft = (v) => {
  const t = String(v || '').trim();
  if (!t) return true;
  if (t.startsWith('[작성 필요]') || t.startsWith('[검증 필요]')) return true;
  if (/\(예시\)/.test(t)) return true;
  if (/【[^】]*】/.test(t)) return true;
  if (/(공식에 맞춰|작성하세요|반영하세요|포함하세요|서술하세요|남기세요|적어주세요)/.test(t)) return true;
  return false;
};
const clean = (v) => isDraft(v) ? '' : String(v).replace(/\*\*/g, '').replace(/^#+\s/gm, '').trim();

const ACCENT = '#002F6C';
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const SEG_VARIANTS = {
  heading: { label: '제목', cls: 'text-[16px] sm:text-[18px] font-extrabold leading-snug text-bluewood-900' },
  paragraph: { label: '본문', cls: 'text-[14px] leading-[1.7] text-bluewood-600' },
  bullet: { label: '글머리', cls: 'text-[14px] leading-[1.7] text-bluewood-600' },
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

const YOOPTA_TEXT_TYPES = {
  heading: ['HeadingThree', 'heading-three'],
  paragraph: ['Paragraph', 'paragraph'],
  bullet: ['BulletedList', 'bulleted-list'],
};

function makeYooptaTextBlock(content = '', variant = 'paragraph') {
  const [blockType, elementType] = YOOPTA_TEXT_TYPES[variant] || YOOPTA_TEXT_TYPES.paragraph;
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
      id: k.id || uid(), title: k.title || '', metric: k.metric || '',
      problem: k.problem || '', action: k.action || '', result: k.result || '', learning: k.learning || '',
      images: normalizeImages(k.images),
    })),
    body,
    skills: Array.isArray(cs.skills) ? cs.skills : [],
  };
}

/* ── 자동 높이 조절 + 자동 줄바꿈 인라인 텍스트 (글자 잘림 방지) ── */
function AutoText({ value, onChange, placeholder, className = '', dark = false, prose = false, dense = false }) {
  const ref = useRef(null);
  const resize = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; } };
  // 값이 바뀔 때마다 페인트 전에 높이를 글자량에 맞춘다.
  useLayoutEffect(() => { resize(ref.current); }, [value]);
  // 너비가 바뀔 때(아코디언 펼침·반응형 등) 다시 측정 — 좁은 상태에서 잘못 측정돼 박스가 커지는 문제 방지.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let lastW = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth !== lastW) { lastW = el.offsetWidth; resize(el); }
    });
    ro.observe(el);
    return () => ro.disconnect();
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
      onChange={(e) => { onChange(e.target.value); resize(e.target); }}
      className={`w-full resize-none whitespace-pre-wrap break-words rounded-md -ml-2 px-2 ${dense ? 'py-0.5' : 'py-1'} outline-none transition-colors duration-150 cursor-text ${tone} ${className}`}
      style={{ overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word', boxSizing: 'border-box', minHeight: 0 }}
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

/* ── 노션식 자유 편집 본문: 어디에든 텍스트·사진을 넣고, 드래그로 옮기고, 우클릭으로 서식(제목·본문·글머리) ── */
function CaseBody({ body, onChange }) {
  const fileRef = useRef(null);
  const pendingAfter = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, idx } — 우클릭 서식 메뉴

  useEffect(() => {
    if (!ctxMenu) return undefined;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [ctxMenu]);

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
          onContextMenu={(e) => {
            if (seg.type !== 'text') return; // 이미지엔 자체 컨트롤이 있음
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY, idx: i });
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
                <div className={seg.variant === 'bullet' ? 'flex items-start gap-2' : undefined}>
                  {seg.variant === 'bullet' && <span className="mt-[11px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-bluewood-400" />}
                  <AutoText
                    prose
                    value={seg.content}
                    onChange={(v) => update(i, { content: v })}
                    placeholder={seg.variant === 'heading' ? '제목' : seg.variant === 'bullet' ? '항목을 입력하세요' : '본문을 입력하세요'}
                    className={`${SEG_VARIANTS[seg.variant]?.cls || SEG_VARIANTS.paragraph.cls}${seg.variant === 'bullet' ? ' flex-1' : ''}`}
                  />
                </div>
                <div className="mt-0.5 flex items-center gap-2 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                  <button type="button" onClick={() => update(i, { variant: seg.variant === 'heading' ? 'paragraph' : 'heading' })}
                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-bluewood-400 hover:bg-surface-100">
                    {seg.variant === 'heading' ? '본문으로' : '제목으로'}
                  </button>
                  <span className="text-[10.5px] text-bluewood-200">우클릭: 서식</span>
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

      <div className="mt-3 flex items-center gap-2 pt-1">
        <button type="button" onClick={() => insertAfter(body.length - 1, textSeg('', 'paragraph'))} className="rounded-lg border border-surface-200 px-3 py-1.5 text-[12.5px] font-semibold text-bluewood-500 hover:border-primary-300 hover:text-primary-600">＋ 텍스트 추가</button>
        <button type="button" onClick={() => addImage(body.length - 1)} className="rounded-lg border border-surface-200 px-3 py-1.5 text-[12.5px] font-semibold text-bluewood-500 hover:border-primary-300 hover:text-primary-600">＋ 사진 추가</button>
      </div>

      {/* 우클릭 서식 메뉴 — 텍스트 블록 공통 (제목·본문·글머리·삭제) */}
      {ctxMenu && (
        <div
          className="fixed z-[1100] w-40 overflow-hidden rounded-xl border border-surface-200 bg-white py-1 shadow-xl"
          style={{ left: Math.min(ctxMenu.x, window.innerWidth - 170), top: Math.min(ctxMenu.y, window.innerHeight - 190) }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-bluewood-300">서식</p>
          {[
            { v: 'heading', label: '제목 (크게)', cls: 'text-[14px] font-extrabold text-bluewood-900' },
            { v: 'paragraph', label: '본문', cls: 'text-[12.5px] text-bluewood-600' },
            { v: 'bullet', label: '•  글머리 기호', cls: 'text-[12.5px] text-bluewood-600' },
          ].map(o => (
            <button
              key={o.v}
              type="button"
              onClick={() => { update(ctxMenu.idx, { variant: o.v }); setCtxMenu(null); }}
              className={`block w-full px-3 py-1.5 text-left transition-colors hover:bg-surface-50 ${o.cls} ${body[ctxMenu.idx]?.variant === o.v ? 'bg-primary-50/60' : ''}`}
            >
              {o.label}
            </button>
          ))}
          <div className="my-1 border-t border-surface-100" />
          <button
            type="button"
            onClick={() => { removeAt(ctxMenu.idx); setCtxMenu(null); }}
            className="block w-full px-3 py-1.5 text-left text-[12.5px] font-semibold text-red-500 transition-colors hover:bg-red-50"
          >
            블록 삭제
          </button>
        </div>
      )}
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
function GitHeroCard({ stats, role, rolePoints = [] }) {
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
                      placeholder="이 코드가 무엇을 어떻게 바꾸는지 설명"
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
                      placeholder="이 코드로 어떻게 해결했는지 설명"
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

/* 원본 자료에서 GitHub 레포 섹션(개발 중심 README/구조)을 제거 — 서비스 설명 추출을 흐리지 않게. */
function stripGithubSections(raw) {
  const cleaned = String(raw || '')
    .split(/(?:^|\n)===\s*AI\s*추출\s*핵심\s*경험\s*===/)[0]
    .replace(/\r\n/g, '\n');
  const parts = [];
  const re = /(?:^|\n)---[ \t]+(.+?)[ \t]+---[ \t]*(?:\n|$)/g;
  let m, lastIdx = 0, lastLabel = '원본';
  while ((m = re.exec(cleaned)) !== null) {
    if (m.index > lastIdx) parts.push({ label: lastLabel, text: cleaned.slice(lastIdx, m.index) });
    lastLabel = m[1]; lastIdx = re.lastIndex;
  }
  parts.push({ label: lastLabel, text: cleaned.slice(lastIdx) });
  const isGithub = (label) => /github|깃허브|리포지토리|repo/i.test(label);
  const kept = parts.filter(p => !isGithub(p.label)).map(p => p.text.trim()).filter(Boolean).join('\n\n').trim();
  // GitHub 외 섹션이 하나도 없으면(레포만 넣은 경우) 원본 그대로 반환
  return kept || cleaned.trim();
}

function extractReadmeLikeMarkdown(exp) {
  const sr = exp?.structuredResult || {};
  const direct = String(sr.readme || '').trim();
  if (direct) return direct;
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

  const isReadme = (t) => /(^|\n)#{1,2}\s+\S/.test(t) && /(문제\s*정의|해결\s*방법|핵심\s*기능|주요\s*기능)/.test(t);
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
function buildOverviewSeedSegs(exp) {
  const sr = exp?.structuredResult || {};
  const ov = sr.projectOverview || {};
  const product = sr.product && typeof sr.product === 'object' ? sr.product : {};
  const oneLine = (v) => clean(v).replace(/\n+/g, ' ').trim();
  const norm = (v) => clean(v).replace(/\s+/g, '').slice(0, 80);

  // 최우선: AI가 뽑은 서비스(아이템) 설명(product) — 개발 서사보다 앞선다.
  const title = oneLine(product.name) || oneLine(sr.projectName || sr.title || ov.name || exp?.title);
  const tagline = oneLine(product.tagline) || oneLine(sr.intro) || oneLine(ov.summary) || oneLine(ov.goal);
  const problem = clean(product.problem) || clean(ov.background) || clean(ov.goal) || clean(sr.problem) || clean(sr.overview);
  let solution = clean(product.solution) || clean(ov.solution) || clean(ov.summary) || clean(sr.solution) || clean(sr.intro);

  // product가 없을 때만 원본 README 서사로 폴백(핵심기능·성과 섹션만 제거)
  if (!clean(product.problem) && !clean(product.solution)) {
    const readmeLike = extractReadmeLikeMarkdown(exp);
    if (readmeLike) return markdownToSegs(stripReadmeSections(readmeLike, ['핵심기능', '주요기능', '성과', '주요성과']));
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
function ProductFacts({ exp }) {
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

  if (!rows.length && !outcomes.length) return null;

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
function DevImpactSection({ expId, exp, onApplied, onPatchSr }) {
  const [connectOpen, setConnectOpen] = useState(false);
  const [openProjects, setOpenProjects] = useState([0]); // 첫 항목은 펼친 상태로

  // 아키텍처 편집 상태 (개발자 포트폴리오와 동일한 캔버스). archTab: 'system'(개발 구조) | 'flow'(프로젝트 흐름)
  const [archTab, setArchTab] = useState('system');
  const [editDiagram, setEditDiagram] = useState(false);
  const [diagramDraft, setDiagramDraft] = useState({ nodes: [], edges: [] });
  const [editCanvas, setEditCanvas] = useState({ w: 800, h: 420 });
  const [regenProduct, setRegenProduct] = useState(false); // 원본 자료로 서비스 설명 재추출 중

  const sr = exp?.structuredResult || {};
  const ov = sr.projectOverview || {};
  const stats = sr.githubStats || null;
  const gitExps = Array.isArray(sr.gitAnalysis?.experiences) ? sr.gitAnalysis.experiences : [];
  const hasGit = Boolean(stats || gitExps.length > 0);
  const repoName = sr.gitAnalysis?.repoName || stats?.repoName || '';

  // 아키텍처 1) 개발 구조 — AI가 만든 다이어그램 우선, 없으면 실제 기술스택 기반 폴백
  // (키워드는 사업/예시 단어가 섞여 무관한 박스를 만들어 제외 — 실제 기술만)
  const savedSystem = Array.isArray(sr.architectureDiagram?.nodes) && sr.architectureDiagram.nodes.length > 0
    ? sr.architectureDiagram : null;
  const techs = [
    ...(Array.isArray(ov.techStack) ? ov.techStack : []).map(t => (typeof t === 'string' ? t : t?.name || '')),
    ...gitExps.flatMap(e => String(e.core_tech_stack || '').split(/,\s*/)),
    ...(Array.isArray(stats?.languages) ? stats.languages.map(l => l.name) : []),
  ];
  const systemDiagram = savedSystem || buildFallbackDiagram(techs);

  // 아키텍처 2) 프로젝트 흐름 — AI가 만든 서비스 흐름 우선, 없으면 핵심 경험 단계로 폴백
  const savedFlow = Array.isArray(sr.flowDiagram?.nodes) && sr.flowDiagram.nodes.length > 0
    ? sr.flowDiagram : null;
  const flowDiagram = savedFlow || buildFallbackFlow(sr);
  const activeDiagram = archTab === 'flow' ? flowDiagram : systemDiagram;
  const isFlow = archTab === 'flow';

  // 프로젝트 소개 초안 — product(서비스 설명) 최우선, 없으면 README 원본
  const overviewSeed = useMemo(() => buildOverviewSeedSegs(exp), [exp]);
  const overviewDocValue = useMemo(() => {
    const saved = sr.overviewDoc;
    const savedText = (isYooptaDoc(saved) ? collectYooptaText(saved) : collectCaseSegmentText(saved)).replace(/\s+/g, '');
    // product(서비스 설명)가 있는데 저장 문서가 그 문제정의를 아직 반영 안 했으면 시드(product)로 재구성
    const prob = clean(sr.product?.problem).replace(/\s+/g, '').slice(0, 20);
    if (prob && savedText && !savedText.includes(prob)) return null;
    return shouldUseReadmeSeed(exp, saved) ? null : saved;
  }, [exp, sr.overviewDoc, sr.product]);

  // 원본 자료(PDF·문서 등)로 서비스 설명(product)을 AI로 다시 추출 — 개발 서사가 굳은 경우 서비스 관점으로 재정리
  const regenerateProduct = async () => {
    // GitHub 레포 README(개발 내용)를 뺀 '서비스 자료'만으로 재추출 — 문제정의가 개발 서사로 쏠리지 않게
    const raw = stripGithubSections(getRawMaterialText(exp));
    if (!raw) { toast.error('원본 자료가 없어 다시 뽑을 수 없어요. (경험을 새로 만들 때 자료를 첨부해야 해요)'); return; }
    setRegenProduct(true);
    try {
      // 전용 경량 추출 — 전체 초안이 커져 실패하는 문제와 무관하게 서비스 설명만 안정적으로 뽑는다
      const res = await api.post('/experience/extract-product', { material: raw });
      const p = res.data?.product;
      const has = p && (clean(p.problem) || clean(p.solution) || (Array.isArray(p.features) && p.features.length));
      if (!has) { toast.error('자료에서 서비스 설명을 찾지 못했어요. 문제·해결·기능이 담긴 자료인지 확인해주세요.'); setRegenProduct(false); return; }
      // product 반영 + overviewDoc 리셋(→ product 기반 시드로 다시 그려짐)
      onPatchSr({ ...sr, product: p, overviewDoc: null });
      toast.success('서비스 설명을 다시 정리했어요. 상단 저장을 눌러 반영하세요.');
    } catch (e) {
      toast.error(e?.response?.data?.error || '다시 정리에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
    setRegenProduct(false);
  };

  // git 경험 편집 — structuredResult.gitAnalysis.experiences에 반영 (상단 '저장'으로 일괄 저장)
  const patchGitExp = (i, changes) => {
    const experiences = gitExps.map((e, ei) => (ei === i ? { ...e, ...changes } : e));
    onPatchSr({ ...sr, gitAnalysis: { ...(sr.gitAnalysis || {}), experiences } });
  };
  const deleteGitExp = (i) => {
    if (!window.confirm('이 문제 해결 항목을 삭제할까요?')) return;
    const experiences = gitExps.filter((_, ei) => ei !== i);
    onPatchSr({ ...sr, gitAnalysis: { ...(sr.gitAnalysis || {}), experiences } });
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
          <span className="text-[11.5px] font-semibold text-bluewood-300">GitHub 커밋 근거 기반</span>
        )}
      </div>

      <div className="border-t border-surface-200 pt-5">
          <div className="space-y-8">
            {connectOpen && (
              <GitConnectPanel expId={expId} sr={sr} onApplied={(next) => { onApplied(next); setConnectOpen(false); }} onCancel={() => setConnectOpen(false)} compact />
            )}

            {/* 프로젝트 소개 — 서사 문서 (맨 위). 개발 서사로 나오면 원본 자료로 서비스 설명 재추출 */}
            <div>
              <div className="mb-1.5 flex items-center justify-end">
                <button
                  type="button"
                  onClick={regenerateProduct}
                  disabled={regenProduct}
                  title="업로드한 PDF·문서에서 서비스의 문제정의·해결·기능을 AI로 다시 정리합니다"
                  className="inline-flex items-center gap-1.5 rounded-md border border-surface-200 px-2 py-1 text-[11px] font-semibold text-bluewood-400 transition-colors hover:border-primary-300 hover:text-primary-600 disabled:opacity-50"
                >
                  {regenProduct ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {regenProduct ? '서비스 설명 정리 중…' : '서비스 설명 다시 뽑기'}
                </button>
              </div>
              <OverviewDoc
                value={overviewDocValue}
                seed={overviewSeed}
                onChange={(next) => onPatchSr({ ...sr, overviewDoc: next })}
              />
            </div>

            {/* 주요 성과 · 핵심 기능 — 깔끔한 표/칩 (서사와 분리) */}
            <ProductFacts exp={exp} />

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

            {gitExps.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <h3 className={MICRO_LABEL}>문제 해결 과정</h3>
                  <span className="text-[11.5px] font-semibold text-bluewood-300">{gitExps.length}건 · 눌러서 펼치기 · 눌러서 편집</span>
                </div>
                <div className="border-t border-surface-200">
                  {gitExps.map((e, i) => (
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

/* ──────────────────────────────────────────────────────────
   경험 결과 — 내가 프로젝트에서 한 핵심을 정리해 보여주는 한 장의 문서
   (핵심 경험은 구조화해서 보여주고, 글·사진은 자유롭게 편집 → Firestore 저장)
   ────────────────────────────────────────────────────────── */
export default function ExperienceResult() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [exp, setExp] = useState(state?.analysis ? { structuredResult: state.analysis, title: state.title, jobCategory: state.jobCategory } : null);
  const [cs, setCs] = useState(null);
  const [loading, setLoading] = useState(!state?.analysis);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [draftGuideOpen, setDraftGuideOpen] = useState(false);
  const [openExps, setOpenExps] = useState([]); // 펼쳐진 핵심 경험 id 목록 (아코디언)
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
      try {
        const snap = await getDoc(doc(db, 'experiences', id));
        if (snap.exists()) {
          const data = snap.data();
          const full = { title: data.title, jobCategory: data.jobCategory, structuredResult: data.structuredResult || {}, keywords: data.keywords || [], caseStudy: data.caseStudy || null, content: data.content || null };
          setExp(full);
          initCaseStudy(full);
        } else if (exp) {
          initCaseStudy(exp);
        }
      } catch {
        if (exp) initCaseStudy(exp);
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
    if (window.localStorage.getItem(draftGuideKey) === '1') return undefined;
    const timer = window.setTimeout(() => setDraftGuideOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [id, isDraftResult, loading, cs, draftGuideKey]);

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
  const toggleExp = (keId) => setOpenExps(prev => prev.includes(keId) ? prev.filter(x => x !== keId) : [...prev, keId]);
  const addKeyExp = () => {
    const newId = uid();
    patch(prev => ({ ...prev, keyExps: [...prev.keyExps, { id: newId, title: '', metric: '', problem: '', action: '', result: '', learning: '', images: [] }] }));
    setOpenExps(prev => [...prev, newId]); // 새로 추가한 경험은 펼친 상태로
  };
  const removeKeyExp = (keId) => { patch(prev => ({ ...prev, keyExps: prev.keyExps.filter(k => k.id !== keId) })); setOpenExps(prev => prev.filter(x => x !== keId)); };

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
    setSaving(true);
    try {
      // 핵심 경험 사진을 자세히보기(핵심 경험)와 공유 — 경험 순서(index) 기준으로 매핑
      const keyExpImages = {};
      cs.keyExps.forEach((k, i) => {
        if (k.images?.length) keyExpImages[String(i)] = k.images.map(im => ({ url: im.url, width: im.width || '100%' }));
      });
      // 간략 보기의 공통 필드(제목·요약·역할·핵심경험)를 자세히 보기(structuredResult)에도 반영
      const updatedStructured = mergeCaseStudyIntoStructured(exp?.structuredResult, cs);
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

  // 직군별 케이스 스터디 구조 분기 — 개발 직군은 핵심 경험 대신 GitHub 기반 개발 임팩트를 보여준다
  const jobCategory = exp?.jobCategory || exp?.structuredResult?.jobCategory || 'common';
  const isDevJob = DEV_GIT_JOBS.includes(jobCategory);
  const devStats = exp?.structuredResult?.githubStats || null; // 좌측 사이드바용 GitHub 통계
  const devGitExps = Array.isArray(exp?.structuredResult?.gitAnalysis?.experiences) ? exp.structuredResult.gitAnalysis.experiences : [];
  const devRole = devStats ? inferDevRole(devStats, devGitExps) : null; // 순위 대신 표시할 주 역할
  // 커밋 유형 아래에 보여줄 '핵심 역할' 포인트 — git 경험의 작업 단위(project_name) 요약
  const rolePoints = devGitExps.map(e => clean(e.project_name)).filter(Boolean).slice(0, 5);

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
    <div className="min-h-screen bg-white">
      <input ref={keyExpFileRef} type="file" accept="image/*" className="hidden" onChange={onKeyExpFile} />

      {/* ── 상단 액션 바 ── */}
      <div className="sticky top-0 z-20 border-b border-surface-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between gap-3">
          <button onClick={() => guardedNav('/app/experience')} className="shrink-0 text-[13px] font-medium text-bluewood-400 hover:text-bluewood-700 transition-colors">← <span className="hidden sm:inline">경험 목록</span></button>

          {/* 보기 전환 — 케이스 스터디 ↔ 자세히 보기 */}
          <div className="inline-flex items-center gap-0.5 rounded-xl bg-surface-100 p-1">
            <span className="px-3 sm:px-3.5 py-1.5 rounded-lg bg-white text-[13px] font-bold text-bluewood-900 shadow-sm">케이스 스터디</span>
            <button onClick={() => guardedNav(`/app/experience/structured/${id}`)} className="px-3 sm:px-3.5 py-1.5 rounded-lg text-[13px] font-semibold text-bluewood-400 hover:text-bluewood-700 transition-colors">자세히 보기</button>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {dirty && <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-500"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />저장 안 됨</span>}
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

      <article className="max-w-6xl mx-auto px-5 sm:px-8 py-7 sm:py-9">
        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] lg:gap-10">

          {/* ════ 왼쪽 — 한눈에 보는 정보 (비개발 직군만 sticky; 개발 직군은 통계가 길어 자연 스크롤) ════ */}
          <div className={`lg:pr-2 ${isDevJob ? '' : 'lg:sticky lg:top-[72px]'}`}>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-[11.5px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>CASE STUDY</p>
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
              /* 개발 직군 — 요약·메타 대신 GitHub 기여도·활동 통계를 사이드바에 (없으면 우측에서 연결) */
              devStats ? (
                <div className="mt-4 border-t border-surface-200 pt-4">
                  <GitHeroCard stats={devStats} role={devRole} rolePoints={rolePoints} />
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
            {/* 기술 — 개발 직군은 좌측 통계의 언어 바로 대체되어 생략 */}
            {!isDevJob && cs.tech.length > 0 && (
              <div className="mt-4 border-t border-surface-200 pt-4">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-bluewood-300 mb-2">기술</p>
                <div className="flex flex-wrap gap-1.5">
                  {cs.tech.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-surface-100 text-[11px] font-semibold text-bluewood-600">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {/* 핵심 역량 — 진짜 핵심만 (core 우선, 최대 5개) */}
            {(() => {
              const groups = deriveCompetencies(exp?.structuredResult, cs.skills);
              const ordered = ['core', 'derived', 'growth']
                .flatMap(key => (groups[key] || []).map(s => ({ s, color: (COMP_GROUPS.find(g => g.key === key) || {}).color })))
                .slice(0, 5);
              if (ordered.length === 0) return null;
              return (
                <div className="mt-4 border-t border-surface-200 pt-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-bluewood-300 mb-2">핵심 역량</p>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                    {ordered.map(({ s, color }, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ backgroundColor: `${color}14`, color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ════ 오른쪽 — 직군별 구조: 개발 직군은 GitHub 기반 개발 임팩트, 그 외엔 핵심 경험 아코디언 ════ */}
          <section className="min-w-0">
            {isDevJob ? (
              <DevImpactSection
                expId={id}
                exp={exp}
                onApplied={(nextSr) => setExp(prev => ({ ...(prev || {}), structuredResult: nextSr }))}
                onPatchSr={(nextSr) => {
                  // 인라인 편집 → 상태 반영 + 저장 대기(dirty) — 상단 '저장'이 structuredResult까지 일괄 저장
                  setExp(prev => ({ ...(prev || {}), structuredResult: nextSr }));
                  setDirty(true);
                }}
              />
            ) : (<>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[15px] font-extrabold text-bluewood-900">핵심 경험</h2>
              {cs.keyExps.length > 0 && <span className="text-[11.5px] font-semibold text-bluewood-300">{cs.keyExps.length}건 · 눌러서 펼치기</span>}
            </div>
            <div className="border-t border-surface-200">
              {cs.keyExps.map((k, i) => {
                const open = openExps.includes(k.id);
                return (
                  <div key={k.id} className="border-b border-surface-200">
                    {open ? (
                      /* ── 펼침: 편집 가능한 헤더 (번호 + 제목 + 성과) ── */
                      <div className="flex items-start gap-2.5 pt-2.5 pb-1">
                        <span className="mt-0.5 flex flex-shrink-0 items-center justify-center rounded text-[10.5px] font-black text-white" style={{ backgroundColor: ACCENT, height: '18px', width: '18px' }}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <AutoText
                            prose
                            value={k.title}
                            onChange={(v) => setKeyExp(k.id, 'title', v)}
                            placeholder={`핵심 경험 ${i + 1}`}
                            className="text-[14px] sm:text-[14.5px] font-extrabold leading-snug text-bluewood-900"
                          />
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-wide" style={{ color: ACCENT }}>성과</span>
                            <AutoText
                              value={k.metric}
                              onChange={(v) => setKeyExp(k.id, 'metric', v)}
                              placeholder="성과·수치 (예: 누락률 32% 감소)"
                              className="text-[12.5px] font-bold text-bluewood-900"
                            />
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <button type="button" onClick={() => removeKeyExp(k.id)} className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-bluewood-300 hover:bg-red-50 hover:text-red-500">삭제</button>
                          <button
                            type="button"
                            onClick={() => toggleExp(k.id)}
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
                      /* ── 접힘: 행 전체 클릭 · 일반 텍스트 · 컴팩트 ── */
                      <button type="button" onClick={() => toggleExp(k.id)} aria-expanded={false} className="group flex w-full items-center gap-2.5 py-2 text-left">
                        <span className="flex flex-shrink-0 items-center justify-center rounded text-[10.5px] font-black text-white" style={{ backgroundColor: ACCENT, height: '18px', width: '18px' }}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-[14.5px] font-extrabold leading-snug ${k.title ? 'text-bluewood-900' : 'text-bluewood-300'}`}>{k.title || `핵심 경험 ${i + 1}`}</p>
                          {k.metric && (
                            <p className="mt-0.5 truncate text-[12px] font-semibold text-bluewood-500">
                              <span className="font-black" style={{ color: ACCENT }}>성과 </span>{k.metric}
                            </p>
                          )}
                        </div>
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-surface-200 bg-white text-bluewood-400 transition-all group-hover:border-primary-300 group-hover:bg-primary-50 group-hover:text-primary-600">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                        </span>
                      </button>
                    )}

                    {/* 접히는 본문 — 문제/실행/결과/배운점 + 사진 (열렸을 때만 렌더 → 올바른 너비에서 높이 측정) */}
                    {open && (
                      <div className="pb-2 pl-[28px]">
                        <div className="space-y-0.5">
                          {KE_ROWS.map(r => (
                            <div key={r.key} className="flex items-baseline gap-2.5">
                              <span className="w-[38px] flex-shrink-0 text-[11px] font-bold text-bluewood-400">{r.label}</span>
                              <AutoText
                                dense
                                value={k[r.key]}
                                onChange={(v) => setKeyExp(k.id, r.key, v)}
                                placeholder={`${r.label} 입력`}
                                className={`text-[12.5px] leading-[1.45] ${r.strong ? 'font-semibold text-bluewood-900' : 'text-bluewood-600'}`}
                              />
                            </div>
                          ))}
                        </div>
                        {k.images.length > 0 && (
                          <div className="mt-3 flex flex-col gap-2.5">
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
                        <button type="button" onClick={() => addKeyExpImage(k.id)} className="mt-2 rounded-md border border-surface-200 px-2.5 py-1 text-[11px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600">＋ 사진</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addKeyExp} className="mt-4 w-full rounded-lg border border-dashed border-surface-300 py-2.5 text-[12.5px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600 transition-colors">＋ 핵심 경험 추가</button>
            </>)}

            {/* 내용 — 자유 편집(부가 설명) */}
            <div className="mt-8 border-t border-surface-200 pt-7">
              <h2 className="text-[11.5px] font-black uppercase tracking-[0.16em] text-bluewood-400 mb-2">내용</h2>
              <CaseBody body={cs.body} onChange={(next) => setField('body', next)} />
            </div>
          </section>
        </div>

        {/* 하단 CTA */}
        <div className="mt-9 flex flex-wrap gap-3 border-t border-surface-200 pt-7">
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
        </div>
      </article>
    </div>
    </>
  );
}
