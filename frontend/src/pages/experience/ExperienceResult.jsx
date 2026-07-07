import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Github, Loader2 } from 'lucide-react';
import { doc, getDoc, updateDoc } from '../../services/firestoreProxy';
import toast from 'react-hot-toast';
import { db } from '../../config/firebase';
import api from '../../services/api';
import { mergeCaseStudyIntoStructured } from '../../utils/caseStudySync';
import { CodeSnippet, toLines } from '../../components/portfolio/GitInsights';
import { ArchitectureDiagram, ArchitectureEditorCanvas, buildFallbackDiagram, computeNodeMetrics, autoLayoutPositions, hasXY, PAD } from '../../components/portfolio/ArchDiagram';
import FeedbackModal, { isFeedbackSnoozed } from '../../components/FeedbackModal';

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

/* ── 기여도 · 영향력 — 문서 톤 스탯 블록 (기여 바 · 언어 바 · 월별 활동 · 커밋 유형) ── */
function GitHeroCard({ stats }) {
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

      {/* 메인 수치 — 기여 비중을 크게, 나머지는 보조 */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <p className="text-[34px] font-black leading-none tracking-tight" style={{ color: ACCENT }}>{pct ? `${pct}%` : '—'}</p>
          <p className="mt-1.5 text-[11.5px] font-semibold text-bluewood-400">커밋 기여 비중</p>
        </div>
        <div>
          <p className="text-[20px] font-extrabold leading-none text-bluewood-900">{stats.myCommits ?? '—'}<span className="text-[13px] font-semibold text-bluewood-400"> / {stats.totalCommits || '—'}</span></p>
          <p className="mt-1.5 text-[11px] text-bluewood-400">내 커밋 / 전체</p>
        </div>
        <div>
          <p className="text-[20px] font-extrabold leading-none text-bluewood-900">{stats.rank ? `${stats.rank}위` : '—'}</p>
          <p className="mt-1.5 text-[11px] text-bluewood-400">기여자 {stats.contributorCount || 0}명 중</p>
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
            {impact && (
              <p className="mt-0.5 truncate text-[12px] font-semibold text-bluewood-500">
                <span className="font-black" style={{ color: ACCENT }}>성과 </span>{impact}
              </p>
            )}
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

/* ── 개발 임팩트 — 케이스 스터디의 개발 직군 구조: 기여도 → 아키텍처 → 문제 해결 (문서 톤, 얇은 구분선) ── */
function DevImpactSection({ expId, exp, onApplied, onPatchSr }) {
  const [connectOpen, setConnectOpen] = useState(false);
  const [openProjects, setOpenProjects] = useState([0]); // 첫 항목은 펼친 상태로

  // 아키텍처 편집 상태 (개발자 포트폴리오와 동일한 캔버스)
  const [editDiagram, setEditDiagram] = useState(false);
  const [diagramDraft, setDiagramDraft] = useState({ nodes: [], edges: [] });
  const [editCanvas, setEditCanvas] = useState({ w: 800, h: 420 });

  const sr = exp?.structuredResult || {};
  const ov = sr.projectOverview || {};
  const stats = sr.githubStats || null;
  const gitExps = Array.isArray(sr.gitAnalysis?.experiences) ? sr.gitAnalysis.experiences : [];
  const hasGit = Boolean(stats || gitExps.length > 0);
  const repoName = sr.gitAnalysis?.repoName || stats?.repoName || '';

  // 아키텍처: AI 생성 다이어그램 우선, 없으면 기술스택 기반 기본 구조 폴백
  const savedDiagram = Array.isArray(sr.architectureDiagram?.nodes) && sr.architectureDiagram.nodes.length > 0
    ? sr.architectureDiagram : null;
  const techs = [
    ...(Array.isArray(ov.techStack) ? ov.techStack : []).map(t => (typeof t === 'string' ? t : t?.name || '')),
    ...(sr.keywords || exp?.keywords || []),
    ...gitExps.flatMap(e => String(e.core_tech_stack || '').split(/,\s*/)),
    // 레포 언어 통계도 재료로 — 기술스택·키워드가 비어도 다이어그램이 그려지도록
    ...(Array.isArray(stats?.languages) ? stats.languages.map(l => l.name) : []),
  ];
  const diagram = savedDiagram || buildFallbackDiagram(techs);

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
  const enterEditDiagram = () => {
    const base = diagram || { nodes: [], edges: [] };
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
    onPatchSr({ ...sr, architectureDiagram: cleanNodes.length ? { nodes: cleanNodes, edges: cleanEdges } : null });
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
        {!hasGit ? (
          <GitConnectPanel expId={expId} sr={sr} onApplied={onApplied} />
        ) : (
          <div className="space-y-8">
            {connectOpen && (
              <GitConnectPanel expId={expId} sr={sr} onApplied={(next) => { onApplied(next); setConnectOpen(false); }} onCancel={() => setConnectOpen(false)} compact />
            )}

            {stats && <GitHeroCard stats={stats} />}

            {/* Engineering Highlights — 프로젝트별 핵심 성과 한 줄 (수정하면 아래 성과와 동기화) */}
            {gitExps.length > 0 && (
              <div>
                <h3 className={`${MICRO_LABEL} mb-3`}>Engineering Highlights</h3>
                <div className="space-y-2.5">
                  {gitExps.slice(0, 4).map((e, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="mt-1 flex-shrink-0 font-mono text-[12px] font-black tabular-nums" style={{ color: ACCENT }}>{String(i + 1).padStart(2, '0')}</span>
                      <AutoText
                        dense
                        value={e.core_impact || ''}
                        onChange={(v) => patchGitExp(i, { core_impact: v })}
                        placeholder={`${clean(e.project_name) || `프로젝트 ${i + 1}`}의 핵심 성과 한 줄`}
                        className="min-w-0 flex-1 text-[13.5px] font-bold leading-[1.55] text-bluewood-900"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(diagram || editDiagram) && (
              <div>
                <div className="mb-2.5 flex items-baseline justify-between gap-2">
                  <h3 className={MICRO_LABEL}>아키텍처</h3>
                  {editDiagram ? (
                    <span className="flex items-center gap-1.5">
                      <button type="button" onClick={addNode} className="rounded-md border border-dashed border-primary-300 px-2 py-0.5 text-[11px] font-semibold text-primary-600 hover:bg-primary-50 transition-colors">＋ 박스</button>
                      <button type="button" onClick={saveDiagramEdit} className="rounded-md bg-primary-600 px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-primary-700 transition-colors">완료</button>
                      <button type="button" onClick={() => setEditDiagram(false)} className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-bluewood-400 hover:bg-surface-100 transition-colors">취소</button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {!savedDiagram && <span className="text-[11px] text-bluewood-300">기술 스택 기반 자동 구성</span>}
                      <button type="button" onClick={enterEditDiagram} className="text-[11.5px] font-semibold text-bluewood-300 hover:text-primary-600 transition-colors">구조 편집</button>
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
                ) : (
                  <ArchitectureDiagram diagram={diagram} />
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
          </div>
        )}
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
          const full = { title: data.title, jobCategory: data.jobCategory, structuredResult: data.structuredResult || {}, keywords: data.keywords || [], caseStudy: data.caseStudy || null };
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

          {/* ════ 왼쪽 — 한눈에 보는 정보 (선으로 구분된 단일 페이지, sticky) ════ */}
          <div className="lg:sticky lg:top-[72px] lg:pr-2">
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
