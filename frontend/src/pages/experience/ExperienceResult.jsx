import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from '../../services/firestoreProxy';
import toast from 'react-hot-toast';
import { db } from '../../config/firebase';
import { mergeCaseStudyIntoStructured } from '../../utils/caseStudySync';
import useExperienceStore from '../../stores/experienceStore';
import { DEMO_MARKETER_EXPERIENCE } from './demoExperience';
import FeedbackModal, { isFeedbackSnoozed } from '../../components/FeedbackModal';

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
function AutoText({ value, onChange, placeholder, className = '', dark = false, prose = false, dense = false }) {
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

      <div className="mt-3 flex items-center gap-2 pt-1">
        <button type="button" onClick={() => insertAfter(body.length - 1, textSeg('', 'paragraph'))} className="rounded-lg border border-surface-200 px-3 py-1.5 text-[12.5px] font-semibold text-bluewood-500 hover:border-primary-300 hover:text-primary-600">＋ 텍스트 추가</button>
        <button type="button" onClick={() => addImage(body.length - 1)} className="rounded-lg border border-surface-200 px-3 py-1.5 text-[12.5px] font-semibold text-bluewood-500 hover:border-primary-300 hover:text-primary-600">＋ 사진 추가</button>
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
  const [exp, setExp] = useState(state?.analysis ? { structuredResult: state.analysis, title: state.title } : null);
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
          const full = { title: data.title, structuredResult: data.structuredResult || {}, keywords: data.keywords || [], caseStudy: data.caseStudy || null, jobCategory: data.jobCategory || 'common' };
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

  return (
    <>
    <FeedbackModal
      open={feedbackOpen}
      onClose={closeFeedback}
      context={feedbackContext}
      experienceId={id}
      title={cs?.title || exp?.title || state?.title || ''}
    />
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
              <span className="px-3 sm:px-3.5 py-1.5 rounded-lg bg-white text-[13px] font-bold text-bluewood-900 shadow-sm">핵심 경험</span>
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

      <article className={isMarketer ? 'mx-auto max-w-[1080px] px-5 py-9 sm:px-10 print:max-w-none print:p-0' : 'max-w-6xl mx-auto px-5 sm:px-8 py-7 sm:py-9'}>
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
        ) : (
        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] lg:gap-10">

          {/* ════ 왼쪽 — 한눈에 보는 정보 (선으로 구분된 단일 페이지, sticky) ════ */}
          <div className="lg:sticky lg:top-[72px] lg:pr-2">
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
            {/* 기술 */}
            {cs.tech.length > 0 && (
              <div className="mt-4 border-t border-surface-200 pt-4">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-bluewood-300 mb-2">기술</p>
                <div className="flex flex-wrap gap-1.5">
                  {cs.tech.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-surface-100 text-[11px] font-semibold text-bluewood-600">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {/* 핵심 역량 */}
            {(() => {
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

          {/* ════ 오른쪽 — 핵심 경험 리포트 (성과를 시각 지표로) ════ */}
          <section className="min-w-0">
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

            {/* 내용 — 자유 편집(부가 설명) */}
            <div className="mt-8 border-t border-surface-200 pt-7">
              <h2 className="text-[11.5px] font-black uppercase tracking-[0.16em] text-bluewood-400 mb-2">내용</h2>
              <CaseBody body={cs.body} onChange={(next) => setField('body', next)} />
            </div>
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
