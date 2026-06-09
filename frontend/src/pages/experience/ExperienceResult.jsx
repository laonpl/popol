import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../config/firebase';
import { mergeCaseStudyIntoStructured } from '../../utils/caseStudySync';

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
  heading: { label: '제목', cls: 'text-[21px] sm:text-[25px] font-extrabold leading-snug text-bluewood-900' },
  paragraph: { label: '본문', cls: 'text-[16px] leading-[1.85] text-bluewood-600' },
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
function AutoText({ value, onChange, placeholder, className = '', dark = false, prose = false }) {
  const ref = useRef(null);
  const resize = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };
  useEffect(() => { resize(ref.current); }, [value]);
  const tone = dark
    ? 'border border-white/10 bg-white/[0.06] placeholder:text-white/45 hover:bg-white/[0.1] focus:bg-white/[0.14] focus:border-white/30'
    : prose
      // 큰 본문·제목: 점선 밑줄 + hover (문서 느낌 유지)
      ? 'border border-transparent border-dashed border-b-bluewood-200 placeholder:text-bluewood-300 hover:bg-surface-50 focus:bg-surface-50/70 focus:border-b-primary-400'
      // 짧은 입력 필드: 은은한 회색 필드
      : 'border border-transparent bg-surface-50/70 placeholder:text-bluewood-300 hover:bg-surface-100 hover:border-surface-200 focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100';
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => { onChange(e.target.value); resize(e.target); }}
      className={`w-full resize-none whitespace-pre-wrap break-words rounded-md -ml-2 px-2 py-1 outline-none transition-all duration-150 cursor-text ${tone} ${className}`}
      style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
    />
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
  const [loading, setLoading] = useState(!state?.analysis);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const keyExpFileRef = useRef(null);
  const pendingKeyExpApply = useRef(null);

  const initCaseStudy = useCallback((data) => {
    setCs(data.caseStudy ? normalizeCaseStudy(data.caseStudy) : deriveCaseStudy(data));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'experiences', id));
        if (snap.exists()) {
          const data = snap.data();
          const full = { title: data.title, structuredResult: data.structuredResult || {}, keywords: data.keywords || [], caseStudy: data.caseStudy || null };
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

  const patch = (updater) => { setCs(prev => updater(prev)); setDirty(true); };
  const setField = (key, val) => patch(prev => ({ ...prev, [key]: val }));
  const setMeta = (key, val) => patch(prev => ({ ...prev, meta: { ...prev.meta, [key]: val } }));
  const setKeyExp = (keId, key, val) => patch(prev => ({ ...prev, keyExps: prev.keyExps.map(k => k.id === keId ? { ...k, [key]: val } : k) }));
  const addKeyExp = () => patch(prev => ({ ...prev, keyExps: [...prev.keyExps, { id: uid(), title: '', metric: '', problem: '', action: '', result: '', learning: '', images: [] }] }));
  const removeKeyExp = (keId) => patch(prev => ({ ...prev, keyExps: prev.keyExps.filter(k => k.id !== keId) }));

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

  return (
    <div className="min-h-screen bg-white">
      <input ref={keyExpFileRef} type="file" accept="image/*" className="hidden" onChange={onKeyExpFile} />

      {/* ── 상단 액션 바 ── */}
      <div className="sticky top-0 z-20 border-b border-surface-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between gap-3">
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

      <article className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-12">
        {/* ════ 히어로 (전체 폭) ════ */}
        <div className="max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-[12px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>CASE STUDY</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-[11.5px] font-semibold text-bluewood-400">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              회색으로 표시된 영역을 눌러 바로 편집할 수 있어요
            </span>
          </div>
          <AutoText
            prose
            value={cs.title}
            onChange={(v) => setField('title', v)}
            placeholder="경험 제목을 입력하세요"
            className="text-[30px] sm:text-[40px] font-black leading-[1.18] text-bluewood-900 tracking-tight"
          />
          <AutoText
            prose
            value={cs.summary}
            onChange={(v) => setField('summary', v)}
            placeholder="한 줄 요약 — 이 경험이 무엇이고 왜 중요한지"
            className="mt-4 text-[17px] sm:text-[19px] leading-[1.6] text-bluewood-500"
          />
          {/* 메타(자동 줄바꿈) + 기술 */}
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
            {[{ k: 'role', label: '역할' }, { k: 'duration', label: '기간' }, { k: 'team', label: '팀 구성' }].map(m => (
              <div key={m.k} className="min-w-0">
                <p className="text-[12px] font-bold text-bluewood-300 mb-0.5">{m.label}</p>
                <AutoText
                  value={cs.meta[m.k]}
                  onChange={(v) => setMeta(m.k, v)}
                  placeholder="—"
                  className="text-[15px] font-semibold text-bluewood-700"
                />
              </div>
            ))}
          </div>
          {cs.tech.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {cs.tech.map((t, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md bg-surface-100 text-[12px] font-semibold text-bluewood-600">{t}</span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 grid grid-cols-1 items-start gap-x-10 gap-y-12 border-t border-surface-200 pt-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(640px,1.2fr)] xl:gap-x-16">

          {/* ════ 내용 · 역량 (데스크탑 왼쪽 / 모바일 아래) ════ */}
          <div className="min-w-0">
            {/* 내용: 노션식 자유 편집 */}
            <section>
              <h2 className="text-[12.5px] font-black uppercase tracking-[0.16em] text-bluewood-400 mb-3">내용</h2>
              <CaseBody body={cs.body} onChange={(next) => setField('body', next)} />
            </section>

            {/* 핵심 역량 — 키워드 기반으로 추출 */}
            {(() => {
              const groups = deriveCompetencies(exp?.structuredResult, cs.skills);
              const active = COMP_GROUPS.filter(g => groups[g.key].length > 0);
              if (active.length === 0) return null;
              return (
                <section className="mt-10 border-t border-surface-200 pt-8">
                  <h2 className="text-[12.5px] font-black uppercase tracking-[0.16em] text-bluewood-400 mb-5">핵심 역량</h2>
                  <div className="space-y-5">
                    {active.map(g => (
                      <div key={g.key}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                          <span className="text-[13.5px] font-bold text-bluewood-800">{g.label}</span>
                          <span className="text-[12px] text-bluewood-300">{g.desc}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {groups[g.key].map((s, i) => (
                            <span key={i} className="rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold" style={{ backgroundColor: `${g.color}14`, color: g.color }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}
          </div>

          {/* ════ 핵심 경험 (데스크탑 오른쪽 / 모바일 위로) ════ */}
          <aside className="order-first min-w-0 lg:order-none lg:border-l lg:border-surface-200 lg:pl-10 xl:pl-14">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="text-[16px] font-extrabold text-bluewood-900">핵심 경험</h2>
              {cs.keyExps.length > 0 && <span className="text-[12px] font-semibold text-bluewood-300">{cs.keyExps.length}건</span>}
            </div>
            <div className="divide-y divide-surface-100">
              {cs.keyExps.map((k, i) => (
                <div key={k.id} className="py-7 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[11px] font-black text-white" style={{ backgroundColor: ACCENT }}>{i + 1}</span>
                      <AutoText
                        prose
                        value={k.title}
                        onChange={(v) => setKeyExp(k.id, 'title', v)}
                        placeholder={`핵심 경험 ${i + 1}`}
                        className="text-[20px] sm:text-[22px] font-extrabold leading-snug text-bluewood-900"
                      />
                    </div>
                    <button type="button" onClick={() => removeKeyExp(k.id)} className="mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-bluewood-300 hover:bg-red-50 hover:text-red-500">삭제</button>
                  </div>

                  {/* 성과 — 강조 줄 */}
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="w-[56px] flex-shrink-0 text-[13px] font-bold pt-1.5" style={{ color: ACCENT }}>성과</span>
                    <AutoText
                      value={k.metric}
                      onChange={(v) => setKeyExp(k.id, 'metric', v)}
                      placeholder="성과·수치 (예: 누락률 32% 감소)"
                      className="text-[16px] font-bold text-bluewood-900"
                    />
                  </div>
                  {/* 문제 / 실행 / 결과 / 배운 점 */}
                  <div className="mt-2 space-y-2.5">
                    {KE_ROWS.map(r => (
                      <div key={r.key} className="flex items-baseline gap-3">
                        <span className="w-[56px] flex-shrink-0 text-[13px] font-bold text-bluewood-400 pt-1.5">{r.label}</span>
                        <AutoText
                          value={k[r.key]}
                          onChange={(v) => setKeyExp(k.id, r.key, v)}
                          placeholder={`${r.label} 입력`}
                          className={`text-[15.5px] leading-[1.8] ${r.strong ? 'font-semibold text-bluewood-900' : 'text-bluewood-600'}`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* 사진 (자유 크기 조절) */}
                  {k.images.length > 0 && (
                    <div className="mt-4 flex flex-col gap-3">
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
                  <button type="button" onClick={() => addKeyExpImage(k.id)} className="mt-3 rounded-md border border-surface-200 px-2.5 py-1 text-[11.5px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600">＋ 사진</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addKeyExp} className="mt-5 w-full rounded-lg border border-dashed border-surface-300 py-2.5 text-[13px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600 transition-colors">＋ 핵심 경험 추가</button>
          </aside>
        </div>

        {/* 하단 CTA */}
        <div className="mt-12 flex flex-wrap gap-3 border-t border-surface-200 pt-8">
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
  );
}
