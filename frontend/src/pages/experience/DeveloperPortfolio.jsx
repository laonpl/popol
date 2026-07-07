import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc } from '../../services/firestoreProxy';
import { db } from '../../config/firebase';
import toast from 'react-hot-toast';
import { JOB_CATEGORIES, JOB_SPECIFIC_FIELDS } from '../../stores/experienceStore';
import { computeDevDiagnostic, devSectionFilled, getJobPortfolioMeta, normalizePortfolioVisuals } from '../../utils/devPortfolio';
import { KpiTileRow, FunnelChart, DumbbellCompare, MixBar, GoalBoard, ProcessFlow, SectionShell } from '../../components/portfolio/JobVisuals';
import JobHero from '../../components/portfolio/JobHero';
import JobExperienceCard, { hasJobExperienceCard } from '../../components/portfolio/JobExperienceCards';
import { PriorityMatrix, DoubleDiamond, ImageShowcase, PairedBars, MetricLeaderboard, CampaignFlow, TopDealsChart, parseWon, PipelineKanban, normalizeStage, BeforeAfterShowcase, pickBeforeAfterPairs, AimlIcon } from '../../components/portfolio/JobSignature';
import { PipelineDiagram, TopologyDiagram } from '../../components/portfolio/JobDiagram';
import { ContributionStats, GitProjectCard, toLines } from '../../components/portfolio/GitInsights';
import { ArchitectureDiagram, buildFallbackDiagram, computeNodeMetrics, autoLayoutPositions, hasXY, PAD } from '../../components/portfolio/ArchDiagram';
import JobSectionPanel, { hasJobSectionPanel } from '../../components/portfolio/JobStorySections';
import JobShowcase, { hasJobShowcase } from '../../components/portfolio/JobShowcase';
import VisualDataEditor from '../../components/portfolio/VisualDataEditor';
import {
  Github, ExternalLink, Code2, Wrench, Gauge, ArrowLeft,
  PenLine, Check, X, Layers, Cpu, Plus, Trash2, Users,
  ClipboardList, Briefcase,
} from 'lucide-react';

const ACCENT = '#002F6C';

/* 마크다운/플레이스홀더 정리 */
function clean(v) {
  const t = String(v || '').trim();
  if (!t || t.startsWith('[작성 필요]') || t.startsWith('[검증 필요]')) return '';
  return t.replace(/\*\*/g, '').replace(/^#+\s/gm, '').trim();
}

const SECTION_ICONS = {
  techStack: Code2,
  architecture: Layers,
  troubleshooting: Wrench,
  optimization: Gauge,
};

/* ── 아키텍처 편집 캔버스 (HTML div 박스: 드래그·리사이즈·인라인 편집 + SVG 연결선) ── */
const EDIT_W = 168, EDIT_H = 76, EDIT_MIN_W = 112, EDIT_MIN_H = 64;
const rectOf = (n) => ({
  x: Number.isFinite(n.x) ? n.x : 0,
  y: Number.isFinite(n.y) ? n.y : 0,
  w: Number.isFinite(n.w) ? n.w : EDIT_W,
  h: Number.isFinite(n.h) ? n.h : EDIT_H,
});

function ArchitectureEditorCanvas({ nodes, edges, canvas, onMoveNode, onResizeNode, onUpdateNode, onRemoveNode, onMoveEdge, onUpdateEdge, onRemoveEdge, onConnect }) {
  const wrapRef = useRef(null);
  const drag = useRef(null);
  const [connect, setConnect] = useState(null); // 포트 드래그로 노드 연결 중 { from, x, y }
  const W = canvas.w, H = canvas.h;

  const toCanvas = (e) => {
    const el = wrapRef.current;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left + el.scrollLeft, y: e.clientY - r.top + el.scrollTop };
  };
  const nodeAt = (x, y) => nodes.find(n => { const r = rectOf(n); return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; });

  // 엣지 기하: 시작/끝 앵커 + 제어점(mx,my). 커스텀 mx/my 있으면 그 지점으로 선이 휘고 라벨도 그 자리.
  const edgeGeom = (e) => {
    const sn = nodes.find(n => n.id === e.from), tn = nodes.find(n => n.id === e.to);
    if (!sn || !tn) return null;
    const s = rectOf(sn), t = rectOf(tn);
    const scx = s.x + s.w / 2, tcx = t.x + t.w / 2;
    const down = (t.y + t.h / 2) >= (s.y + s.h / 2);
    const sy = down ? s.y + s.h : s.y;
    const ty = down ? t.y : t.y + t.h;
    const mx = Number.isFinite(e.mx) ? e.mx : (scx + tcx) / 2;
    const my = Number.isFinite(e.my) ? e.my : (sy + ty) / 2;
    return { scx, sy, tcx, ty, mx, my };
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = toCanvas(e);
    const dx = p.x - d.startX, dy = p.y - d.startY;
    if (d.kind === 'edge') {
      onMoveEdge(d.idx, Math.round(Math.max(0, Math.min(W, d.omx + dx))), Math.round(Math.max(0, Math.min(H, d.omy + dy))));
      return;
    }
    if (d.mode === 'move') {
      const nx = Math.max(0, Math.min(W - d.ow, d.ox + dx));
      const ny = Math.max(0, Math.min(H - d.oh, d.oy + dy));
      onMoveNode(d.id, Math.round(nx), Math.round(ny));
    } else {
      let { ox: nx, oy: ny, ow: nw, oh: nh } = d;
      if (d.mode.includes('e')) nw = Math.min(W - d.ox, Math.max(EDIT_MIN_W, d.ow + dx));
      if (d.mode.includes('s')) nh = Math.min(H - d.oy, Math.max(EDIT_MIN_H, d.oh + dy));
      if (d.mode.includes('w')) { nw = Math.max(EDIT_MIN_W, d.ow - dx); nx = Math.max(0, d.ox + (d.ow - nw)); }
      if (d.mode.includes('n')) { nh = Math.max(EDIT_MIN_H, d.oh - dy); ny = Math.max(0, d.oy + (d.oh - nh)); }
      onResizeNode(d.id, { x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) });
    }
  };
  const onPointerUp = () => {
    drag.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };
  const startNodeDrag = (e, n, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const p = toCanvas(e);
    const r = rectOf(n);
    drag.current = { kind: 'node', id: n.id, mode, startX: p.x, startY: p.y, ox: r.x, oy: r.y, ow: r.w, oh: r.h };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };
  const startEdgeDrag = (e, idx, g) => {
    e.preventDefault();
    e.stopPropagation();
    const p = toCanvas(e);
    drag.current = { kind: 'edge', idx, startX: p.x, startY: p.y, omx: g.mx, omy: g.my };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // 포트에서 드래그 → 다른 박스 위에서 놓으면 연결(화살표) 생성
  const onConnectMove = (e) => { const p = toCanvas(e); setConnect(c => (c ? { ...c, x: p.x, y: p.y } : c)); };
  const onConnectUp = (e) => {
    window.removeEventListener('pointermove', onConnectMove);
    window.removeEventListener('pointerup', onConnectUp);
    const p = toCanvas(e);
    const target = nodeAt(p.x, p.y);
    setConnect(c => { if (c && target && target.id !== c.from) onConnect(c.from, target.id); return null; });
  };
  const startConnect = (e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    const p = toCanvas(e);
    setConnect({ from: nodeId, x: p.x, y: p.y });
    window.addEventListener('pointermove', onConnectMove);
    window.addEventListener('pointerup', onConnectUp);
  };

  useEffect(() => () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointermove', onConnectMove);
    window.removeEventListener('pointerup', onConnectUp);
  });

  const CORNERS = [
    { k: 'nw', cls: 'left-[-5px] top-[-5px] cursor-nwse-resize' },
    { k: 'ne', cls: 'right-[-5px] top-[-5px] cursor-nesw-resize' },
    { k: 'sw', cls: 'left-[-5px] bottom-[-5px] cursor-nesw-resize' },
    { k: 'se', cls: 'right-[-5px] bottom-[-5px] cursor-nwse-resize' },
  ];
  const PORTS = [
    { k: 't', cls: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2' },
    { k: 'b', cls: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2' },
    { k: 'l', cls: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' },
    { k: 'r', cls: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2' },
  ];

  const connFrom = connect ? rectOf(nodes.find(n => n.id === connect.from) || {}) : null;

  return (
    <div ref={wrapRef} className="relative overflow-auto rounded-2xl border border-surface-200 bg-surface-50/30" style={{ maxHeight: 560 }}>
      <div className="relative" style={{ width: W, height: H }}>
        {/* 연결선 (제어점 통과 곡선) + 연결 중 임시 선 */}
        <svg width={W} height={H} className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          <defs>
            <marker id="edit-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const g = edgeGeom(e);
            if (!g) return null;
            return <path key={i} d={`M ${g.scx} ${g.sy} Q ${g.mx} ${g.my} ${g.tcx} ${g.ty}`} fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#edit-arrow)" />;
          })}
          {connect && connFrom && (
            <line x1={connFrom.x + connFrom.w / 2} y1={connFrom.y + connFrom.h / 2} x2={connect.x} y2={connect.y}
              stroke="#2563eb" strokeWidth="1.8" strokeDasharray="5 4" markerEnd="url(#edit-arrow)" />
          )}
        </svg>

        {/* 박스 */}
        {nodes.map(n => {
          const r = rectOf(n);
          return (
            <div key={n.id}
              onPointerDown={(e) => startNodeDrag(e, n, 'move')}
              className="group absolute flex flex-col overflow-visible rounded-xl border border-primary-300 bg-white shadow-sm"
              style={{ left: r.x, top: r.y, width: r.w, height: r.h, cursor: 'grab', touchAction: 'none' }}>
              {/* 드래그 핸들 바 (확실한 이동 그립) */}
              <div onPointerDown={(e) => startNodeDrag(e, n, 'move')} title="드래그해서 이동"
                className="flex h-4 flex-shrink-0 items-center justify-center gap-[3px] rounded-t-xl bg-surface-100/70 hover:bg-surface-100"
                style={{ cursor: 'grab' }}>
                <span className="h-[3px] w-[3px] rounded-full bg-bluewood-300" />
                <span className="h-[3px] w-[3px] rounded-full bg-bluewood-300" />
                <span className="h-[3px] w-[3px] rounded-full bg-bluewood-300" />
              </div>
              <div className="flex flex-1 flex-col justify-center gap-0.5 px-2.5 py-1">
                <input value={n.label || ''} onChange={(e) => onUpdateNode(n.id, { label: e.target.value })}
                  onPointerDown={(e) => e.stopPropagation()} placeholder="컴포넌트명"
                  className="w-full bg-transparent text-center text-[12.5px] font-bold text-bluewood-900 outline-none placeholder:text-bluewood-300" />
                <input value={n.tech || ''} onChange={(e) => onUpdateNode(n.id, { tech: e.target.value })}
                  onPointerDown={(e) => e.stopPropagation()} placeholder="기술·역할"
                  className="w-full bg-transparent text-center text-[10.5px] text-bluewood-500 outline-none placeholder:text-bluewood-300" />
              </div>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onRemoveNode(n.id)}
                className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border border-surface-200 bg-white text-bluewood-400 shadow-sm hover:text-red-500 group-hover:flex">
                <X size={11} />
              </button>
              {/* 연결 포트 (드래그해서 다른 박스로) */}
              {PORTS.map(pt => (
                <div key={pt.k} onPointerDown={(e) => startConnect(e, n.id)} title="드래그해서 다른 박스로 연결"
                  className={`absolute z-10 h-3 w-3 rounded-full border-2 border-white bg-primary-500 opacity-0 shadow transition-opacity hover:scale-125 group-hover:opacity-100 ${pt.cls}`}
                  style={{ cursor: 'crosshair' }} />
              ))}
              {CORNERS.map(c => (
                <div key={c.k} onPointerDown={(e) => startNodeDrag(e, n, c.k)}
                  className={`absolute h-[10px] w-[10px] rounded-sm border border-primary-400 bg-white opacity-0 transition-opacity group-hover:opacity-100 ${c.cls}`} />
              ))}
            </div>
          );
        })}

        {/* 엣지 컨트롤 (드래그 이동 + 라벨 인라인 편집) */}
        {edges.map((e, i) => {
          const g = edgeGeom(e);
          if (!g) return null;
          return (
            <div key={`e${i}`}
              onPointerDown={(ev) => startEdgeDrag(ev, i, g)}
              title="드래그해서 선 이동"
              className="group absolute flex items-center gap-1 rounded-full border border-primary-300 bg-white/95 py-0.5 pl-1 pr-1.5 shadow-sm"
              style={{ left: g.mx, top: g.my, transform: 'translate(-50%, -50%)', cursor: 'move', touchAction: 'none' }}>
              <span className="flex flex-col gap-[2px] px-0.5 text-bluewood-300" title="드래그해서 선 이동">
                <span className="h-[2px] w-[7px] rounded-full bg-current" />
                <span className="h-[2px] w-[7px] rounded-full bg-current" />
              </span>
              <input value={e.label || ''} onChange={(ev) => onUpdateEdge(i, { label: ev.target.value })}
                onPointerDown={(ev) => ev.stopPropagation()} placeholder="라벨"
                style={{ width: `${Math.max(46, (e.label || '').length * 7 + 16)}px` }}
                className="bg-transparent text-center text-[10.5px] text-bluewood-600 outline-none placeholder:text-bluewood-300" />
              <button onPointerDown={(ev) => ev.stopPropagation()} onClick={() => onRemoveEdge(i)}
                className="hidden text-bluewood-300 hover:text-red-500 group-hover:block"><X size={10} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 기술 분석 카드 (기본 4줄로 접고 더보기) ── */
function TechAnalysisCard({ label, subtitle, icon: Icon, text, accent = ACCENT }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 150;
  const clampStyle = open || !long ? {} : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-surface-100 bg-surface-50/50 px-4 py-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: accent }}><Icon size={15} /></span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-extrabold leading-tight text-bluewood-900">{label}</h3>
          {subtitle && <p className="truncate text-[11px] text-bluewood-400">{subtitle}</p>}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 py-3.5">
        <p className="text-[13px] leading-[1.75] text-bluewood-600 whitespace-pre-wrap" style={clampStyle}>{text}</p>
        {long && (
          <button onClick={() => setOpen(o => !o)} className="mt-1.5 self-start text-[11.5px] font-semibold text-primary-600 hover:underline">
            {open ? '접기' : '더보기'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DeveloperPortfolio() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  // 생성 직후 진입 시 Firestore 전파 지연 대비 — 네비게이션 state를 초기값으로 사용
  const [data, setData] = useState(state?.structuredResult ? { id, ...state } : null);
  const [loading, setLoading] = useState(!state?.structuredResult);

  // 아키텍처 다이어그램 편집 상태
  const [editDiagram, setEditDiagram] = useState(false);
  const [diagramDraft, setDiagramDraft] = useState({ nodes: [], edges: [] });
  const [savingDiagram, setSavingDiagram] = useState(false);
  const [editCanvas, setEditCanvas] = useState({ w: 800, h: 420 }); // 편집 캔버스 고정 크기

  // 직군 특화 경험 인라인 편집 상태 (섹션 텍스트 + 차트 데이터를 이 화면에서 바로 편집)
  const [editContent, setEditContent] = useState(false);
  const [jsDraft, setJsDraft] = useState({});   // jobSpecific 초안
  const [pvDraft, setPvDraft] = useState({});   // portfolioVisuals 초안
  const [savingContent, setSavingContent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'experiences', id));
        if (snap.exists()) setData({ id: snap.id, ...snap.data() });
      } catch (err) {
        console.error('개발자 포트폴리오 로딩 실패:', err);
      }
      setLoading(false);
    })();
  }, [id]);

  // 로드된 데이터로 편집 초안 초기화 (AI 다이어그램 없으면 기술스택으로 기본 구조 폴백)
  useEffect(() => {
    const d = data?.structuredResult?.architectureDiagram;
    if (Array.isArray(d?.nodes) && d.nodes.length > 0) {
      setDiagramDraft({ nodes: d.nodes.map(n => ({ ...n })), edges: Array.isArray(d?.edges) ? d.edges.map(e => ({ ...e })) : [] });
      return;
    }
    // 다이어그램 직군(dev/aiml/devops)만 기술스택 기반 기본 구조 폴백 — 그 외 직군엔 다이어그램 미노출
    const jc = data?.jobCategory || data?.structuredResult?.jobCategory || 'dev';
    if (!getJobPortfolioMeta(jc).diagramKey) { setDiagramDraft({ nodes: [], edges: [] }); return; }
    const srx = data?.structuredResult || {};
    const ovx = srx.projectOverview || {};
    const techs = [
      ...(Array.isArray(ovx.techStack) ? ovx.techStack : []).map(t => (typeof t === 'string' ? t : t?.name || '')),
      ...(srx.keywords || data?.keywords || []),
      ...(Array.isArray(srx.gitAnalysis?.experiences) ? srx.gitAnalysis.experiences : []).flatMap(e => String(e.core_tech_stack || '').split(/,\s*/)),
    ];
    const fb = buildFallbackDiagram(techs);
    setDiagramDraft(fb ? { nodes: fb.nodes.map(n => ({ ...n })), edges: fb.edges.map(e => ({ ...e })) } : { nodes: [], edges: [] });
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="inline-block w-9 h-9 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-bluewood-500">
        <p className="text-[15px] font-semibold">포트폴리오를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/app/experience')} className="text-[13px] text-primary-600 hover:underline">← 경험 목록으로</button>
      </div>
    );
  }

  const sr = data.structuredResult || {};
  const ov = sr.projectOverview || {};
  const jobCategory = data.jobCategory || sr.jobCategory || 'dev';
  const jobMeta = JOB_CATEGORIES.flatMap(g => g.items).find(it => it.value === jobCategory);
  const jobLabel = jobMeta?.label || '개발자';
  const pmeta = getJobPortfolioMeta(jobCategory);
  const jobSections = JOB_SPECIFIC_FIELDS[jobCategory] || [];
  const jobSpecific = sr.jobSpecific || {};
  const keyExps = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
  const githubStats = sr.githubStats || null;
  const gitExps = Array.isArray(sr.gitAnalysis?.experiences) ? sr.gitAnalysis.experiences : [];
  const hasDiagram = diagramDraft.nodes.length > 0;

  // ── 아키텍처 편집 핸들러 ──
  // 편집 진입 — 좌표 없는 노드를 자동배치 좌표로 시딩하고 캔버스 크기 고정
  const enterEditDiagram = () => {
    const metrics = computeNodeMetrics(diagramDraft.nodes);
    const autoPos = autoLayoutPositions(diagramDraft.nodes, metrics);
    const seeded = diagramDraft.nodes.map(n => {
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
    setDiagramDraft(d => ({ ...d, nodes: seeded }));
    setEditDiagram(true);
  };

  const addNode = () => setDiagramDraft(d => ({
    ...d,
    nodes: [...d.nodes, { id: `n${Date.now().toString(36)}`, label: '새 컴포넌트', tech: '', tier: 0, x: 24, y: 24 }],
  }));
  const updateNodeById = (nodeId, patch) => setDiagramDraft(d => ({ ...d, nodes: d.nodes.map(n => (n.id === nodeId ? { ...n, ...patch } : n)) }));
  const moveNode = (nodeId, x, y) => updateNodeById(nodeId, { x, y });
  const resizeNode = (nodeId, patch) => updateNodeById(nodeId, patch); // { x, y, w, h }
  const removeNodeById = (nodeId) => setDiagramDraft(d => ({
    nodes: d.nodes.filter(n => n.id !== nodeId),
    edges: d.edges.filter(e => e.from !== nodeId && e.to !== nodeId),
  }));
  const addEdge = () => setDiagramDraft(d => ({ ...d, edges: [...d.edges, { from: d.nodes[0]?.id || '', to: d.nodes[1]?.id || d.nodes[0]?.id || '', label: '' }] }));
  // 포트 드래그로 연결 생성 (중복·자기연결 무시)
  const connectNodes = (from, to) => setDiagramDraft(d => (
    from && to && from !== to && !d.edges.some(e => e.from === from && e.to === to)
      ? { ...d, edges: [...d.edges, { from, to, label: '' }] }
      : d
  ));
  const updateEdge = (i, patch) => setDiagramDraft(d => ({ ...d, edges: d.edges.map((e, ei) => (ei === i ? { ...e, ...patch } : e)) }));
  const moveEdge = (i, mx, my) => updateEdge(i, { mx, my });
  const removeEdge = (i) => setDiagramDraft(d => ({ ...d, edges: d.edges.filter((_, ei) => ei !== i) }));

  const saveDiagram = async () => {
    setSavingDiagram(true);
    try {
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
      const nextDiagram = cleanNodes.length ? { nodes: cleanNodes, edges: cleanEdges } : null;
      const nextSr = { ...sr, architectureDiagram: nextDiagram };
      await updateDoc(doc(db, 'experiences', id), { structuredResult: nextSr, updatedAt: new Date() });
      setData(prev => ({ ...prev, structuredResult: nextSr }));
      setDiagramDraft({ nodes: cleanNodes.map(n => ({ ...n })), edges: cleanEdges.map(e => ({ ...e })) });
      setEditDiagram(false);
      toast.success('아키텍처를 저장했어요.');
    } catch (err) {
      toast.error(err?.message || '저장에 실패했어요.');
    }
    setSavingDiagram(false);
  };

  // ── 직군 특화 경험 인라인 편집: 진입/취소/저장 ──
  const enterEditContent = () => {
    setJsDraft({ ...(sr.jobSpecific || {}) });
    setPvDraft({ ...(sr.portfolioVisuals || {}) });
    setEditContent(true);
    setTimeout(() => document.getElementById('portfolio-inline-edit')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const cancelEditContent = () => setEditContent(false);
  const saveEditContent = async () => {
    setSavingContent(true);
    try {
      const nextSr = { ...sr, jobSpecific: { ...(sr.jobSpecific || {}), ...jsDraft }, portfolioVisuals: pvDraft };
      await updateDoc(doc(db, 'experiences', id), { structuredResult: nextSr, updatedAt: new Date() });
      setData(prev => ({ ...prev, structuredResult: nextSr }));
      setEditContent(false);
      toast.success('직군 특화 경험을 저장했어요.');
    } catch (err) {
      toast.error(err?.message || '저장에 실패했어요.');
    }
    setSavingContent(false);
  };

  const headline = clean(ov.summary) || clean(sr.intro);
  const role = clean(ov.role);
  const duration = clean(ov.duration);
  const team = clean(ov.team);

  const techList = [...new Set([
    ...(Array.isArray(ov.techStack) ? ov.techStack : []).map(t => (typeof t === 'string' ? t : t?.name || '')),
    ...(sr.keywords || data.keywords || []),
  ].map(s => String(s).trim()).filter(Boolean))];

  const link = clean(data.link);
  const isGithubLink = /github\.com/i.test(link);

  // 트러블슈팅 섹션이 비어 있으면 GitHub 분석의 트러블슈팅으로 보강
  const effectiveJobSpecific = { ...jobSpecific };
  if (!devSectionFilled(jobSpecific.troubleshooting) && gitExps.length) {
    const gitTrouble = gitExps.flatMap(e => toLines(e.troubleshooting));
    if (gitTrouble.length) effectiveJobSpecific.troubleshooting = gitTrouble.map(t => `• ${t}`).join('\n');
  }

  const diag = computeDevDiagnostic({ jobSpecific: effectiveJobSpecific, content: sr, keyExperiences: keyExps.length ? keyExps : gitExps, jobSections });
  const diagBar = diag.score >= 80 ? 'bg-emerald-400' : diag.score >= 50 ? 'bg-amber-400' : 'bg-rose-400';
  const diagScoreColor = diag.score >= 80 ? 'text-emerald-600' : diag.score >= 50 ? 'text-amber-600' : 'text-rose-500';

  // ── 직군 인식형 개성 ──
  const isDev = jobCategory === 'dev';
  // 다이어그램: 직군별 다이어그램 섹션(dev/aiml/devops)이거나 이미 다이어그램이 있으면 표시
  const diagramKey = pmeta.diagramKey;
  const showDiagram = Boolean(diagramKey) || hasDiagram;
  const diagramTitle = pmeta.diagramTitle || '아키텍처';
  const diagramDesc = diagramKey ? effectiveJobSpecific[diagramKey] : '';

  // 직무 전용 시각화 데이터 — AI 생성(portfolioVisuals) 우선, 없으면 서술 텍스트에서 추출 폴백
  const narrativeTexts = [
    ...jobSections.map(f => effectiveJobSpecific[f.key]).filter(Boolean),
    ...keyExps.flatMap(k => [k.context || k.situation, k.action, k.result, k.metric, k.afterMetric]),
  ].filter(Boolean).map(String);
  const visuals = normalizePortfolioVisuals(sr, { jobSections, keyExperiences: keyExps, texts: narrativeTexts, jobSpecific: effectiveJobSpecific });

  // 직무별 전용 히어로 사용 여부 (dev·common은 기존 헤더)
  const hasCustomHero = ['marketer', 'sales', 'hr', 'pm', 'da', 'designer', 'aiml', 'devops'].includes(jobCategory);
  // 히어로·쇼케이스가 이미 보여주는 블록은 본문에서 중복 제거 (같은 데이터를 두 번 그리지 않기)
  const HERO_CONSUMED = { marketer: ['kpis'], sales: ['kpis'], hr: ['funnel'], aiml: ['kpis'], designer: ['process'], devops: ['process'] };
  const SHOWCASE_CONSUMED = { marketer: ['mix'], hr: ['funnel'], devops: ['process'] };
  const consumed = [...(HERO_CONSUMED[jobCategory] || []), ...(SHOWCASE_CONSUMED[jobCategory] || [])];
  // 직무별 구성(meta.visuals)에 따라 데이터가 있는 블록만 순서대로 렌더
  const visualBlocks = (pmeta.visuals || []).filter(v => !consumed.includes(v.type)).filter(v => (
    v.type === 'kpis' ? visuals.kpis.length
    : v.type === 'funnel' ? visuals.funnel
    : v.type === 'compare' ? visuals.compare.length
    : v.type === 'mix' ? visuals.mix
    : v.type === 'goals' ? visuals.goals
    : v.type === 'process' ? visuals.process
    : false
  ));

  // 다이어그램으로 시각화하는 섹션은 텍스트 카드에서 제외 (dev=architecture, aiml=datasetArch, devops=infraArch)
  const analysisSections = jobSections.filter(f => f.key !== diagramKey && devSectionFilled(effectiveJobSpecific[f.key]));
  const projectsTitle = {
    marketer: '핵심 캠페인', sales: '핵심 딜 · 성과', hr: '핵심 프로그램', pm: '핵심 프로덕트',
    da: '핵심 분석 프로젝트', designer: '핵심 프로젝트', aiml: '핵심 모델 · 실험', devops: '핵심 인프라 작업',
  }[jobCategory] || '핵심 프로젝트';
  // 상세 분석 섹션 제목도 직무 어휘로 (골격이 같아 보이지 않게)
  const detailTitle = {
    dev: '기술 분석', aiml: '모델 · 실험 분석', devops: '인프라 · 운영 분석',
    marketer: '캠페인 전략 분석', sales: '세일즈 접근 분석', hr: '제도 · 프로세스 설계',
    pm: '프로덕트 의사결정', da: '분석 프레임워크', designer: '디자인 프로세스 심화',
  }[jobCategory] || '상세 분석';

  // ── 직무 시그니처 아티팩트 데이터 ──
  // PM: 우선순위 매트릭스 — jobData.impact/effort(1~5) 우선, 없으면 휴리스틱(수치 있는 결정=임팩트↑, 좌표는 겹치지 않게 분산)
  const EFFORT_SPREAD = [1.8, 3.9, 2.8, 4.5, 1.4];
  const IMPACT_SPREAD = [4.4, 3.4, 4.0, 2.6, 3.0];
  const clampScale = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 1 && n <= 5 ? n : d; };
  const matrixItems = jobCategory === 'pm' ? keyExps.slice(0, 5).map((k, i) => {
    const hasMetric = Boolean(clean(k.afterMetric) || clean(k.metric));
    return {
      label: clean(k.title) || `결정 ${i + 1}`,
      impact: clampScale(k.jobData?.impact, Math.min(5, IMPACT_SPREAD[i % IMPACT_SPREAD.length] + (hasMetric ? 0.4 : -0.3))),
      effort: clampScale(k.jobData?.effort, EFFORT_SPREAD[i % EFFORT_SPREAD.length]),
      n: i + 1,
    };
  }) : [];
  // DA: A/B 대조군 vs 실험군 (AI 추출 jobData 기반)
  const abRows = jobCategory === 'da' ? keyExps
    .filter(k => k.jobData?.control && k.jobData?.variant)
    .map(k => ({ label: clean(k.title) || '실험', a: String(k.jobData.control), b: String(k.jobData.variant), note: clean(k.jobData.significance) }))
    : [];
  // AI/ML: 베이스라인 대비 성능
  const baselineRows = jobCategory === 'aiml' ? keyExps
    .flatMap(k => (Array.isArray(k.jobData?.metrics) ? k.jobData.metrics : []))
    .filter(m => m?.name && m?.value && m?.baseline)
    .map(m => ({ label: String(m.name), a: String(m.baseline), b: String(m.value) }))
    : [];
  const showcaseImages = jobCategory === 'designer' && Array.isArray(data.images) ? data.images : [];
  // 마케터: 캠페인 전략 맵 — 타겟 → 채널 → 대표 성과 연결도 (jobData 기반)
  const campaignFlows = jobCategory === 'marketer' ? keyExps.slice(0, 4).map((k, i) => {
    const jd = k.jobData || {};
    const kpis = (Array.isArray(jd.kpis) ? jd.kpis : []).filter(x => clean(x?.name) && clean(x?.value));
    return {
      label: clean(k.title) || `캠페인 ${i + 1}`,
      target: clean(jd.target),
      channels: (Array.isArray(jd.channels) ? jd.channels : []).map(c => String(c || '').trim()).filter(Boolean),
      kpi: kpis.length ? `${clean(kpis[0].name)} ${clean(kpis[0].value)}` : (clean(k.afterMetric) || clean(k.metric)),
    };
  }).filter(c => c.target || c.channels.length) : [];
  // 세일즈: 딜 규모 차트 — 계약 규모를 환산해 비교 (금액 파싱 가능한 딜만)
  const topDeals = jobCategory === 'sales' ? keyExps.map((k, i) => {
    const size = clean(k.jobData?.dealSize) || clean(k.afterMetric) || clean(k.metric);
    return { client: clean(k.jobData?.client), title: clean(k.title) || `딜 ${i + 1}`, size, won: parseWon(size) };
  }).filter(d => d.won != null && d.won > 0) : [];
  // HR: 채용 퍼널 개선 전/후 (AI 추출 funnelCompare 기반)
  const hrFunnelCompare = jobCategory === 'hr' ? visuals.funnelCompare : null;
  // 디자이너: Before/After 이미지 슬라이더 — 이미지 이름/캡션에서 전·후 쌍 탐지
  const beforeAfterPairs = jobCategory === 'designer' ? pickBeforeAfterPairs(showcaseImages) : [];
  // 세일즈: 파이프라인 칸반 — jobData.stage(있으면) 기반, 없으면 표시 안 함
  const pipelineDeals = jobCategory === 'sales' ? keyExps.map((k, i) => ({
    stage: normalizeStage(k.jobData?.stage),
    label: clean(k.title) || `딜 ${i + 1}`,
    client: clean(k.jobData?.client),
    size: clean(k.jobData?.dealSize) || clean(k.afterMetric) || clean(k.metric),
  })).filter(d => d.stage) : [];

  // 퍼포먼스 보드 — 핵심 경험의 대표 수치를 랭킹 보드로 (AI 데이터 없이도 항상, PM·디자이너는 매트릭스·다이아몬드가 대신함)
  const BOARD_TITLES = {
    marketer: '캠페인 퍼포먼스 보드', sales: '딜 스코어보드', hr: '프로그램 성과 보드',
    da: '핵심 발견 지표', aiml: '실험 결과 보드', devops: '운영 개선 지표',
  };
  const boardRows = BOARD_TITLES[jobCategory] ? keyExps.slice(0, 5).map((k, i) => ({
    n: i + 1,
    name: clean(k.metricLabel) || clean(k.title) || `핵심 경험 ${i + 1}`,
    value: clean(k.afterMetric) || clean(k.metric),
    before: clean(k.beforeMetric),
    after: clean(k.afterMetric),
  })).filter(r => r.value) : [];
  // 보드가 뜨면 같은 수치를 반복하는 KPI 타일 블록은 숨김 (직무 시그니처가 있으면 보드 대신 시그니처)
  const showBoard = boardRows.length > 0 && abRows.length === 0 && baselineRows.length === 0
    && campaignFlows.length === 0 && topDeals.length === 0;
  const finalVisualBlocks = showBoard ? visualBlocks.filter(v => v.type !== 'kpis') : visualBlocks;

  const isEmpty = analysisSections.length === 0 && keyExps.length === 0 && gitExps.length === 0 && !hasDiagram && visualBlocks.length === 0;

  const KE_ROWS = [
    { key: 'problem', label: '문제', color: '#314157' },
    { key: 'action', label: '해결', color: pmeta.accent },
    { key: 'result', label: '결과', color: '#047857', strong: true },
  ];

  const heroChips = [{ k: '역할', v: role }, { k: '기간', v: duration }, { k: '팀', v: team }];

  /* 완성도 진단 — 전 직군 상단 고정 (개발자 포트폴리오와 동일) */
  const diagSection = (
    <section className="mt-8 rounded-2xl border border-surface-200 bg-surface-50/40 p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[12.5px] font-bold text-bluewood-800">포트폴리오 완성도</span>
        <span className={`text-[16px] font-black ${diagScoreColor}`}>{diag.score}점</span>
        <span className="text-[11.5px] text-bluewood-400">({diag.passed}/{diag.total} 항목)</span>
      </div>
      <div className="h-2 w-full bg-surface-200 rounded-full overflow-hidden mb-4">
        <div className={`h-full rounded-full transition-all ${diagBar}`} style={{ width: `${diag.score}%` }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {diag.checks.map((c, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[12px]">
            {c.ok
              ? <Check size={14} className="text-emerald-500 mt-[1px] flex-shrink-0" />
              : <X size={14} className="text-bluewood-300 mt-[1px] flex-shrink-0" />}
            <span className={c.ok ? 'text-bluewood-600' : 'text-bluewood-400'}>
              {c.label}
              {!c.ok && <span className="block text-[11px] text-amber-600/90">{c.hint}</span>}
            </span>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* ── 상단 액션 바 ── */}
      <div className="sticky top-0 z-20 border-b border-surface-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between gap-3">
          <button onClick={() => navigate('/app/experience')} className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-bluewood-400 hover:text-bluewood-700 transition-colors">
            <ArrowLeft size={14} /> <span className="hidden sm:inline">경험 목록</span>
          </button>
          <div className="inline-flex items-center gap-0.5 rounded-xl bg-surface-100 p-1">
            <button onClick={() => navigate(`/app/experience/result/${id}`)} className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-bluewood-400 hover:text-bluewood-700 transition-colors">케이스 스터디</button>
            <span className="px-3 py-1.5 rounded-lg bg-white text-[12.5px] font-bold text-bluewood-900 shadow-sm">직군 특화 경험</span>
            <button onClick={() => navigate(`/app/experience/structured/${id}`)} className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-bluewood-400 hover:text-bluewood-700 transition-colors">자세히 보기</button>
          </div>
          {editContent ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button onClick={cancelEditContent} className="rounded-lg border border-surface-200 px-3 py-2 text-[12.5px] font-semibold text-bluewood-500 hover:bg-surface-50 transition-colors">취소</button>
              <button onClick={saveEditContent} disabled={savingContent} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-[12.5px] font-bold text-white hover:bg-primary-700 disabled:opacity-40 transition-colors shadow-sm shadow-primary-600/20">
                <Check size={13} /> {savingContent ? '저장 중…' : '저장'}
              </button>
            </div>
          ) : (
            <button onClick={enterEditContent} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-[12.5px] font-bold text-white hover:bg-primary-700 transition-colors shadow-sm shadow-primary-600/20">
              <PenLine size={13} /> 편집
            </button>
          )}
        </div>
      </div>

      <article className="max-w-5xl mx-auto px-5 sm:px-8 py-9 sm:py-12">
        {/* ════ 히어로 — 직무별로 구조가 다름 ════ */}
        {hasCustomHero ? (
          <>
            <JobHero
              job={jobCategory} accent={pmeta.accent} jobLabel={jobLabel}
              title={clean(data.title) || '프로젝트'} headline={headline}
              chips={heroChips} link={link} isGithubLink={isGithubLink} techList={techList}
              jobSpecific={effectiveJobSpecific}
              kpis={visuals.kpis}
              funnel={jobCategory === 'hr' ? null : visuals.funnel}
              processSteps={jobCategory === 'devops' ? null : visuals.process}
            />
            {/* aiml·devops는 히어로 안에서 스택을 보여줌 */}
            {techList.length > 0 && !['aiml', 'devops'].includes(jobCategory) && (
              <div className="mt-5 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-bluewood-300"><Cpu size={12} /> Tools</span>
                {techList.slice(0, 10).map((t, i) => (
                  <span key={i} className="rounded-md bg-surface-100 px-2 py-0.5 text-[11.5px] font-semibold text-bluewood-600">{t}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <header>
            <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: pmeta.accent }}>{jobLabel} · {pmeta.kicker}</p>
            <h1 className="mt-3 text-[28px] sm:text-[38px] font-black leading-[1.12] tracking-tight text-bluewood-900">{clean(data.title) || '프로젝트'}</h1>
            {headline && <p className="mt-3.5 max-w-2xl text-[15px] sm:text-[16px] leading-relaxed text-bluewood-500">{headline}</p>}

            {(role || duration || team || link) && (
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13px]">
                {role && <span className="text-bluewood-400"><span className="text-bluewood-300">역할 </span><span className="font-semibold text-bluewood-700">{role}</span></span>}
                {duration && <span className="text-bluewood-400"><span className="text-bluewood-300">기간 </span><span className="font-semibold text-bluewood-700">{duration}</span></span>}
                {team && <span className="text-bluewood-400"><span className="text-bluewood-300">팀 </span><span className="font-semibold text-bluewood-700">{team}</span></span>}
                {link && (
                  <a href={link} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-[12.5px] font-bold text-bluewood-700 hover:border-primary-300 hover:text-primary-600 transition-colors">
                    {isGithubLink ? <Github size={14} /> : <ExternalLink size={14} />}
                    {isGithubLink ? 'GitHub' : '바로가기'}
                  </a>
                )}
              </div>
            )}

            {techList.length > 0 && (
              <div className="mt-6 border-t border-surface-200 pt-5">
                <p className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-bluewood-300">
                  <Cpu size={12} /> Tech Stack
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {techList.map((t, i) => (
                    <span key={i} className="rounded-md bg-surface-100 px-2.5 py-1 text-[12.5px] font-semibold text-bluewood-700">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </header>
        )}

        {/* ════ 완성도 진단 — 전 직군 상단 고정 (개발자 포트폴리오와 동일) ════ */}
        {diagSection}

        {/* ════ 직군 특화 경험 인라인 편집 — 이 화면에서 바로 섹션 텍스트·차트 데이터 수정 ════ */}
        {editContent && (
          <div id="portfolio-inline-edit" className="scroll-mt-24">
            {jobSections.length > 0 && (
              <SectionShell icon={PenLine} title="직군 특화 경험 편집" accent={pmeta.accent}>
                <p className="-mt-2 mb-4 text-[12px] text-bluewood-400">이 화면에서 바로 수정하고 상단의 <span className="font-bold text-bluewood-600">저장</span>을 누르세요. 저장하면 포트폴리오에 반영됩니다.</p>
                <div className="space-y-4">
                  {jobSections.map(f => {
                    const raw = jsDraft[f.key] ?? '';
                    const val = typeof raw === 'string' && raw.startsWith('[작성 필요]') ? raw.replace(/^\[작성 필요\]\s*/, '') : raw;
                    return (
                      <div key={f.key}>
                        <label className="mb-1.5 flex flex-wrap items-center gap-2 text-[12.5px] font-bold text-bluewood-800">
                          {f.label}
                          {f.subtitle && <span className="font-medium text-bluewood-300">{f.subtitle}</span>}
                        </label>
                        <textarea
                          value={val}
                          onChange={e => setJsDraft(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder || '내용을 입력하세요'}
                          rows={4}
                          className="w-full resize-y rounded-xl border border-surface-200 p-3.5 text-[13px] leading-[1.8] text-bluewood-800 outline-none transition-shadow focus:ring-2 focus:ring-primary-200"
                        />
                      </div>
                    );
                  })}
                </div>
              </SectionShell>
            )}
            <VisualDataEditor jobCategory={jobCategory} value={pvDraft} accent={pmeta.accent} onChange={setPvDraft} />
          </div>
        )}

        {!editContent && (<>
        {/* ════ 직무 SaaS 쇼케이스 — 각 직무의 실무 툴(W&B·Grafana·Tableau·CRM...)을 재현한 라이브 대시보드 ════ */}
        {hasJobShowcase(jobCategory) && (
          <JobShowcase job={jobCategory} accent={pmeta.accent} visuals={visuals} keyExps={keyExps}
            jobSpecific={effectiveJobSpecific} techList={techList} />
        )}

        {/* ════ GitHub 기여도 (개발자) ════ */}
        {githubStats && <ContributionStats stats={githubStats} />}

        {/* ════ 직무 시그니처 아티팩트 — 개발자의 아키텍처·코드에 해당하는 킬러 시각화 ════ */}
        {matrixItems.length > 0 && <PriorityMatrix items={matrixItems} accent={pmeta.accent} />}
        {jobCategory === 'designer' && <DoubleDiamond steps={visuals.process} accent={pmeta.accent} />}
        {beforeAfterPairs.length > 0 && <BeforeAfterShowcase pairs={beforeAfterPairs} accent={pmeta.accent} />}
        {showcaseImages.length > 0 && <ImageShowcase images={showcaseImages} accent={pmeta.accent} />}
        {abRows.length > 0 && <PairedBars title="A/B 실험 결과 — 대조군 vs 실험군" rows={abRows} aLabel="대조군" bLabel="실험군" accent={pmeta.accent} />}
        {baselineRows.length > 0 && <PairedBars title="베이스라인 대비 성능" rows={baselineRows} aLabel="Baseline" bLabel="제안 모델" accent={pmeta.accent} icon={AimlIcon} />}
        {campaignFlows.length > 0 && <CampaignFlow campaigns={campaignFlows} accent={pmeta.accent} />}
        {topDeals.length > 0 && <TopDealsChart deals={topDeals} accent={pmeta.accent} />}
        {pipelineDeals.length > 0 && <PipelineKanban deals={pipelineDeals} accent={pmeta.accent} />}
        {hrFunnelCompare && <PairedBars title="채용 퍼널 개선 — 개선 전 vs 후" rows={hrFunnelCompare} aLabel="개선 전" bLabel="개선 후" accent={pmeta.accent} icon={Users} />}
        {showBoard && (
          <MetricLeaderboard title={BOARD_TITLES[jobCategory]} rows={boardRows} accent={pmeta.accent}
            note="핵심 경험에서 자동 추출된 대표 수치입니다 — 아래 카드 순서와 같습니다" />
        )}

        {/* ════ 직무 전용 시각화 — 직군별 구성·순서·제목이 다름 ════ */}
        {finalVisualBlocks.map((v, i) => {
          const a = pmeta.accent;
          switch (v.type) {
            case 'kpis':    return <KpiTileRow key={i} title={v.title} items={visuals.kpis} accent={a} />;
            case 'funnel':  return <FunnelChart key={i} title={v.title} stages={visuals.funnel} accent={a} />;
            case 'compare': return <DumbbellCompare key={i} title={v.title} rows={visuals.compare} accent={a} />;
            case 'mix':     return <MixBar key={i} title={v.title} items={visuals.mix} accent={a} />;
            case 'goals':   return <GoalBoard key={i} title={v.title} goals={visuals.goals} accent={a} />;
            case 'process': return <ProcessFlow key={i} title={v.title} steps={visuals.process} accent={a} />;
            default: return null;
          }
        })}

        {/* ════ 아키텍처 다이어그램 (dev/aiml/devops · 편집 가능) ════ */}
        {showDiagram && (
        <section className="mt-8">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-100" style={{ color: pmeta.accent }}><Layers size={15} /></span>
              <h2 className="text-[16px] font-extrabold text-bluewood-900">{diagramTitle}</h2>
            </div>
            {editDiagram ? (
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setEditDiagram(false); setDiagramDraft({ nodes: (data.structuredResult?.architectureDiagram?.nodes || []).map(n => ({ ...n })), edges: (data.structuredResult?.architectureDiagram?.edges || []).map(e => ({ ...e })) }); }}
                  className="rounded-lg border border-surface-200 px-3 py-1.5 text-[12px] font-semibold text-bluewood-500 hover:bg-surface-50 transition-colors">취소</button>
                <button onClick={saveDiagram} disabled={savingDiagram}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-primary-700 disabled:opacity-40 transition-colors">
                  <Check size={13} /> {savingDiagram ? '저장 중…' : '저장'}
                </button>
              </div>
            ) : (
              <button onClick={enterEditDiagram}
                className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-[12px] font-semibold text-bluewood-500 hover:border-primary-300 hover:text-primary-600 transition-colors">
                <PenLine size={12} /> 구조 편집
              </button>
            )}
          </div>

          {devSectionFilled(diagramDesc) && (
            <p className="mb-5 max-w-3xl text-[13.5px] leading-[1.85] text-bluewood-600 whitespace-pre-wrap">{clean(diagramDesc)}</p>
          )}

          {/* 편집 안내 툴바 */}
          {editDiagram && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-500">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse" /> 상단 손잡이로 이동 · 모서리로 크기 조절 · 파란 점을 다른 박스로 끌어 연결 · 글자는 바로 수정
              </p>
              <button onClick={addNode} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary-300 px-3 py-1.5 text-[12px] font-semibold text-primary-600 hover:bg-primary-50 transition-colors"><Plus size={13} /> 박스 추가</button>
            </div>
          )}

          {/* 다이어그램(보기) / 편집 캔버스 */}
          {editDiagram ? (
            hasDiagram ? (
              <ArchitectureEditorCanvas
                nodes={diagramDraft.nodes}
                edges={diagramDraft.edges}
                canvas={editCanvas}
                onMoveNode={moveNode}
                onResizeNode={resizeNode}
                onUpdateNode={updateNodeById}
                onRemoveNode={removeNodeById}
                onMoveEdge={moveEdge}
                onUpdateEdge={updateEdge}
                onRemoveEdge={removeEdge}
                onConnect={connectNodes}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50/40 p-6 text-center">
                <p className="text-[13px] text-bluewood-500">위 <span className="font-bold text-primary-600">‘박스 추가’</span>를 눌러 첫 컴포넌트를 만들고, 드래그·크기조절로 배치하세요.</p>
              </div>
            )
          ) : (
            hasDiagram ? (
              // 직무 골격에 맞춰 다이어그램 형태 자체를 분기 — aiml=좌→우 파이프라인, devops=존 레인 토폴로지, 그 외=계층 박스
              jobCategory === 'aiml' ? <PipelineDiagram diagram={diagramDraft} accent={pmeta.accent} />
              : jobCategory === 'devops' ? <TopologyDiagram diagram={diagramDraft} accent={pmeta.accent} />
              : <ArchitectureDiagram diagram={diagramDraft} />
            ) : (
              <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50/40 p-6 text-center">
                <p className="text-[13px] text-bluewood-500">아직 아키텍처 구조가 없습니다. <button onClick={enterEditDiagram} className="font-bold text-primary-600 hover:underline">구조 편집</button>으로 박스와 연결을 직접 그려보세요.</p>
              </div>
            )
          )}

          {/* 연결(엣지) 편집 폼 */}
          {editDiagram && (
            <div className="mt-4 rounded-2xl border border-surface-200 bg-surface-50/40 p-4 sm:p-5">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-bluewood-400">연결 (화살표)</p>
                <div className="space-y-2">
                  {diagramDraft.edges.map((e, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-surface-200 bg-white p-2.5">
                      <select value={e.from || ''} onChange={ev => updateEdge(i, { from: ev.target.value })}
                        className="rounded-lg border border-surface-200 px-2 py-1.5 text-[12.5px] text-bluewood-700 outline-none focus:border-primary-300">
                        <option value="">시작</option>
                        {diagramDraft.nodes.map((n, ni) => <option key={ni} value={n.id}>{n.label || `박스 ${ni + 1}`}</option>)}
                      </select>
                      <span className="text-bluewood-300">→</span>
                      <select value={e.to || ''} onChange={ev => updateEdge(i, { to: ev.target.value })}
                        className="rounded-lg border border-surface-200 px-2 py-1.5 text-[12.5px] text-bluewood-700 outline-none focus:border-primary-300">
                        <option value="">끝</option>
                        {diagramDraft.nodes.map((n, ni) => <option key={ni} value={n.id}>{n.label || `박스 ${ni + 1}`}</option>)}
                      </select>
                      <input value={e.label || ''} onChange={ev => updateEdge(i, { label: ev.target.value })} placeholder="라벨 (예: REST)"
                        className="min-w-[100px] flex-1 rounded-lg border border-surface-200 px-2.5 py-1.5 text-[12.5px] text-bluewood-600 outline-none focus:border-primary-300" />
                      <button onClick={() => removeEdge(i)} className="rounded-lg p-1.5 text-bluewood-300 hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <button onClick={addEdge} disabled={diagramDraft.nodes.length < 2}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-surface-300 px-3 py-1.5 text-[12px] font-semibold text-bluewood-500 hover:border-primary-300 hover:text-primary-600 disabled:opacity-40 transition-colors"><Plus size={13} /> 연결 추가</button>
              </div>
            </div>
          )}
        </section>
        )}

        {/* ════ 상세 분석 — 직무 정체성 패널(터미널/모델카드/리포트/캠페인보드 등), dev·common만 기존 카드 그리드 ════ */}
        {analysisSections.length > 0 && (
          <SectionShell icon={ClipboardList} title={detailTitle} accent={pmeta.accent}>
            {hasJobSectionPanel(jobCategory) ? (
              <div className={jobCategory === 'designer' ? 'space-y-9' : 'space-y-4'}>
                {analysisSections.map((f, i) => (
                  <JobSectionPanel
                    key={f.key}
                    job={jobCategory}
                    index={i}
                    label={f.label}
                    subtitle={f.subtitle}
                    text={clean(effectiveJobSpecific[f.key])}
                    accent={pmeta.accent}
                  />
                ))}
              </div>
            ) : (
              <div className="grid items-start gap-4 sm:grid-cols-2">
                {analysisSections.map(f => (
                  <TechAnalysisCard
                    key={f.key}
                    label={f.label}
                    subtitle={f.subtitle}
                    icon={SECTION_ICONS[f.key] || Code2}
                    text={clean(effectiveJobSpecific[f.key])}
                    accent={pmeta.accent}
                  />
                ))}
              </div>
            )}
          </SectionShell>
        )}

        {/* ════ 핵심 프로젝트 ════ */}
        {gitExps.length > 0 ? (
          <SectionShell icon={Briefcase} title={`${projectsTitle} (${gitExps.length})`} accent={pmeta.accent}>
            <p className="-mt-2 mb-3 text-[11.5px] text-bluewood-400">GitHub 커밋 분석에서 자동 추출된 프로젝트입니다</p>
            <div className="space-y-4">
              {gitExps.map((exp, i) => <GitProjectCard key={i} exp={exp} index={i} />)}
            </div>
          </SectionShell>
        ) : keyExps.length > 0 && (
          <SectionShell icon={Briefcase} title={`${projectsTitle} (${keyExps.length})`} accent={pmeta.accent}>
            <div className="space-y-4">
              {/* 직무별 경험 카드 — 직무마다 경험 단위·구성 요소가 다름 (캠페인/의사결정/개선반복/분석/딜/실험/프로그램/인시던트) */}
              {hasJobExperienceCard(jobCategory) ? (
                keyExps.map((k, i) => <JobExperienceCard key={i} job={jobCategory} exp={k} index={i} accent={pmeta.accent} />)
              ) : (
              keyExps.map((k, i) => {
                const metric = clean(k.afterMetric) || clean(k.metric);
                const rows = { problem: clean(k.context || k.situation), action: clean(k.action), result: clean(k.result) };
                const learning = clean(k.learning);
                const tags = (k.keywords || []).map(s => String(s).trim()).filter(Boolean);
                return (
                  <div key={i} className="rounded-2xl border border-surface-200 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10.5px] font-black text-white" style={{ backgroundColor: pmeta.accent }}>{i + 1}</span>
                        <h3 className="text-[15px] font-extrabold leading-snug text-bluewood-900">{clean(k.title) || `프로젝트 ${i + 1}`}</h3>
                      </div>
                      {metric && <span className="flex-shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold text-emerald-600">{metric}</span>}
                    </div>

                    {tags.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[30px]">
                        {tags.slice(0, 6).map((t, ti) => (
                          <span key={ti} className="rounded bg-surface-100 px-1.5 py-0.5 text-[10.5px] font-medium text-bluewood-500">#{t}</span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3.5 space-y-2 pl-[30px]">
                      {KE_ROWS.map(r => rows[r.key] && (
                        <div key={r.key} className="flex gap-2.5">
                          <span className="w-9 flex-shrink-0 pt-[1px] text-[11px] font-black" style={{ color: r.color }}>{r.label}</span>
                          <p className={`flex-1 text-[13px] leading-[1.6] ${r.strong ? 'font-semibold text-bluewood-900' : 'text-bluewood-600'}`}>{rows[r.key]}</p>
                        </div>
                      ))}
                      {learning && (
                        <div className="flex gap-2.5 pt-1">
                          <span className="w-9 flex-shrink-0 pt-[1px] text-[11px] font-bold text-bluewood-300">배운 점</span>
                          <p className="flex-1 text-[12.5px] italic leading-[1.55] text-bluewood-400">{learning}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </SectionShell>
        )}

        {/* ════ 빈 상태 ════ */}
        {isEmpty && (
          <section className="mt-10 rounded-2xl border border-dashed border-surface-300 bg-surface-50/40 p-8 text-center">
            <p className="text-[14px] font-semibold text-bluewood-700">아직 채워진 내용이 없습니다.</p>
            <p className="mt-1.5 text-[12.5px] text-bluewood-400">‘편집’에서 {isDev ? '기술 스택·아키텍처·트러블슈팅' : '직군 특화 섹션'}과 핵심 경험을 채워보세요.</p>
            <button onClick={enterEditContent} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-primary-700 transition-colors">
              <PenLine size={13} /> 내용 채우러 가기
            </button>
          </section>
        )}
        </>)}
      </article>
    </div>
  );
}
