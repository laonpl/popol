import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText, Briefcase, Mail, Folder, ChevronRight,
  Code, Palette, List, LayoutGrid, Columns, Search,
  Filter, ArrowUpDown, MoreHorizontal, Plus, ChevronDown,
  Phone, MapPin, Instagram, Star, Lightbulb, CheckCircle2,
  ExternalLink, Target, X, UserCircle2, Database, Trash2, GripVertical, Loader2,
  Upload, GraduationCap, Award, Globe, Sparkles, Camera
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import KeyExperienceSlider from '../../components/KeyExperienceSlider';

// ── 섹션별 AI 내용 추천 버튼 (visual 템플릿 공용) ──
export function VisualSectionRecommend({ sectionType, jobAnalysis }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [show, setShow] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [panelMaxH, setPanelMaxH] = useState('60vh');
  const btnRef = useRef(null);

  const SECTION_LABELS = {
    education: '교육', awards: '수상', skills: '기술',
    goals: '목표와 계획', values: '가치관',
    interviews: '인터뷰', experiences: '프로젝트/경험',
    profile: '프로필/소개', projects: '프로젝트',
    curricular: '교내 활동', extracurricular: '교외 활동',
    contact: '연락처',
  };

  if (!jobAnalysis || !sectionType) return null;

  const handleClick = async (e) => {
    e?.stopPropagation?.();
    if (show && data) { setShow(false); return; }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const PANEL_W = 280;
      const PANEL_H = 340;
      const viewH = window.innerHeight;
      const viewW = window.innerWidth;

      let x = rect.left - PANEL_W - 12;
      if (x < 8) x = Math.min(rect.right + 12, viewW - PANEL_W - 8);

      const available = viewH - rect.top - 24;
      let y = rect.top;
      if (available < PANEL_H) {
        y = Math.max(80, viewH - PANEL_H - 24);
        setPanelMaxH(`${Math.min(PANEL_H, viewH - 104)}px`);
      } else {
        setPanelMaxH(`${available - 24}px`);
      }

      setPanelPos({ x, y });
    }
    setLoading(true);
    setShow(true);
    try {
      const { data: resp } = await api.post('/job/recommend-section', { jobAnalysis, sectionType });
      setData(resp);
    } catch { toast.error('내용 추천에 실패했습니다'); setShow(false); }
    setLoading(false);
  };

  const handleDragStart = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = panelPos.x;
    const startPosY = panelPos.y;

    const onMove = (ev) => {
      setPanelPos({
        x: startPosX + ev.clientX - startX,
        y: startPosY + ev.clientY - startY,
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        disabled={loading}
        type="button"
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
          show ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'
        } disabled:opacity-50`}
      >
        {loading && <Loader2 size={11} className="animate-spin" />}
        내용 추천
      </button>
      {show && createPortal(
        <div
          style={{ position: 'fixed', left: panelPos.x, top: panelPos.y, width: 280, zIndex: 1000, maxHeight: panelMaxH, display: 'flex', flexDirection: 'column' }}
          className="bg-white rounded-2xl border border-indigo-200 shadow-xl overflow-hidden"
        >
          <div
            onMouseDown={handleDragStart}
            className="flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing select-none border-b border-indigo-100 bg-indigo-50/60"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-indigo-700">AI 내용 추천</span>
              <span className="text-[10px] text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded-full">{SECTION_LABELS[sectionType] || sectionType}</span>
            </div>
            <button type="button" onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <div className="p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center py-6">
                <Loader2 size={20} className="animate-spin text-indigo-400 mb-2" />
                <p className="text-xs text-gray-400">추천 내용 생성 중...</p>
              </div>
            ) : data?.recommendations ? (
              <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
                {data.recommendations.map((rec, i) => (
                  <div key={i} className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-700 mb-1">{rec.title}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{rec.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">추천을 불러올 수 없습니다</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// 경험의 세부 내용(bullets/details/sections/structuredResult) 통합 추출 헬퍼
export function getExpDetails(exp) {
  if (!exp) return [];
  if (exp.bullets?.length > 0) return exp.bullets;
  if (exp.details?.length > 0) return exp.details;
  if (exp.sections?.length > 0)
    return exp.sections.map(s => s.title ? `[${s.title}] ${s.content}` : s.content).filter(Boolean);
  // structuredResult에서 추출 (importExperience로 가져온 경험)
  const sr = exp.structuredResult || exp.frameworkContent || {};
  const srKeys = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];
  const srItems = srKeys.map(k => sr[k]).filter(v => v?.trim?.());
  if (srItems.length > 0) return srItems;
  if (exp.detail) return [exp.detail];
  if (exp.description) return [exp.description];
  return [];
}

// ── 공통: 편집 모드용 스킬 목록 생성 (skillLevels 반영) ──
function buildEditSkillList(portfolio) {
  const levels = portfolio.skillLevels || {};
  // skills 배열 요소: string 또는 {name, proficiency} 객체 모두 허용
  const getName = (s) => typeof s === 'string' ? s : (s?.name || '');
  const getPercent = (s, def) => {
    const name = getName(s);
    if (levels[name] != null) return `${levels[name]}%`;
    if (typeof s === 'object' && s?.proficiency) return `${Math.round(s.proficiency * 20)}%`;
    return def;
  };
  return [
    ...(portfolio.skills?.tools || []).map(s => { const name = getName(s); return { name, category: 'tools', percent: getPercent(s, '80%'), desc: name + ' 활용 가능' }; }),
    ...(portfolio.skills?.languages || []).map(s => { const name = getName(s); return { name, category: 'languages', percent: getPercent(s, '75%'), desc: name + ' 개발 경험' }; }),
    ...(portfolio.skills?.frameworks || []).map(s => { const name = getName(s); return { name, category: 'frameworks', percent: getPercent(s, '70%'), desc: name + ' 활용 가능' }; }),
    ...(portfolio.skills?.others || []).map(s => { const name = getName(s); return { name, category: 'others', percent: getPercent(s, '65%'), desc: name }; }),
  ];
}

// ── 스킬 레벨 인라인 편집 배지 ──
function SkillLevelBadge({ skill, ec, dark = false }) {
  const [editing, setEditing] = useState(false);
  const pct = parseInt(skill.percent) || 70;
  if (!ec?.updateSkillLevel) return <span className={`text-xs ${dark ? 'text-[#A0A0A0]' : 'text-gray-400'}`}>{skill.percent}</span>;
  return editing ? (
    <div className="flex items-center gap-1">
      <input type="range" min="10" max="100" step="5" value={pct}
        onChange={e => ec.updateSkillLevel(skill.name, parseInt(e.target.value))}
        className="w-20 h-1.5 accent-indigo-500 cursor-pointer"
      />
      <span className={`text-[10px] font-bold w-8 text-right ${dark ? 'text-[#EBEBEB]' : 'text-gray-600'}`}>{pct}%</span>
      <button type="button" onClick={() => setEditing(false)} className={`text-[10px] ${dark ? 'text-[#A0A0A0] hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>✓</button>
    </div>
  ) : (
    <span onClick={() => setEditing(true)} title="클릭하여 레벨 조절"
      className={`text-xs cursor-pointer hover:underline hover:text-indigo-400 transition-colors ${dark ? 'text-[#A0A0A0]' : 'text-gray-400'}`}
    >{skill.percent}</span>
  );
}

// ── 스킬 배지 with 말풍선 툴팁 ──
function SkillTooltipBadge({ skill, ec, dark = false, levelMode = 'blocks', badgeClassName = '', plain = false }) {
  const [editing, setEditing] = useState(false);
  const pct = parseInt(skill.percent) || 70;
  const blocks = Math.round(pct / 20); // 1-5 blocks
  const blockFill = dark ? 'bg-[#5C7CFA]' : 'bg-primary-500';
  const blockEmpty = dark ? 'bg-[#3A3A3A]' : 'bg-gray-200';

  return (
    <div className="relative group/skill inline-flex">
      {/* Badge or plain text */}
      {plain
        ? <span className={`font-bold text-sm cursor-default group-hover/skill:text-indigo-500 transition-colors ${dark ? 'text-[#EBEBEB]' : 'text-gray-900'}`}>{skill.name}</span>
        : <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm cursor-default select-none transition-all group-hover/skill:ring-2 group-hover/skill:ring-indigo-400/50 ${badgeClassName || (dark ? 'bg-[#2A2A2A] text-[#EBEBEB] border border-[#3A3A3A]' : 'bg-gray-100 text-gray-700')}`}>{skill.name}</span>
      }
      {/* Speech bubble tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 pointer-events-none opacity-0 group-hover/skill:opacity-100 transition-opacity duration-150 min-w-[100px]">
        <div className={`rounded-lg px-3 py-2 shadow-lg text-center ${dark ? 'bg-[#1A1A1A] border border-[#3A3A3A]' : 'bg-white border border-gray-200'}`}>
          <div className={`text-[10px] font-bold mb-1.5 ${dark ? 'text-[#EBEBEB]' : 'text-gray-700'}`}>{skill.name}</div>
          {levelMode === 'blocks' ? (
            <div className="flex items-center justify-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`w-3.5 h-1.5 rounded-sm ${i < blocks ? blockFill : blockEmpty}`} />
              ))}
            </div>
          ) : (
            <div className="w-full">
              <div className={`w-full h-1.5 rounded-full ${dark ? 'bg-[#3A3A3A]' : 'bg-gray-200'} overflow-hidden`}>
                <div className={`h-full rounded-full ${dark ? 'bg-[#5C7CFA]' : 'bg-primary-500'} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <div className={`text-[9px] mt-0.5 ${dark ? 'text-[#A0A0A0]' : 'text-gray-400'}`}>{pct}%</div>
            </div>
          )}
          {ec?.updateSkillLevel && (
            <div className="mt-1.5 pointer-events-auto">
              {editing ? (
                <div className="flex items-center gap-1">
                  <input type="range" min="10" max="100" step="5" value={pct}
                    onChange={e => ec.updateSkillLevel(skill.name, parseInt(e.target.value))}
                    className="w-16 h-1.5 accent-indigo-500 cursor-pointer"
                  />
                  <button type="button" onClick={() => setEditing(false)} className={`text-[9px] ${dark ? 'text-[#5C7CFA]' : 'text-indigo-500'}`}>✓</button>
                </div>
              ) : (
                <button type="button" onClick={() => setEditing(true)} className={`text-[9px] hover:underline ${dark ? 'text-[#5C7CFA]' : 'text-indigo-500'}`}>레벨 조절</button>
              )}
            </div>
          )}
        </div>
        {/* Arrow */}
        <div className={`w-2 h-2 rotate-45 mx-auto -mt-1 border-r border-b ${dark ? 'bg-[#1A1A1A] border-[#3A3A3A]' : 'bg-white border-gray-200'}`} />
      </div>
    </div>
  );
}

// ── 경험 상세 편집 버튼 (모든 템플릿 공유) ──
function ExpDetailBtn({ exp, idx, ec, dark = false }) {
  if (!ec?.onOpenExpDetail) return null;
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); ec.onOpenExpDetail(exp, idx); }}
      className={`absolute bottom-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-all shadow-sm ${
        dark
          ? 'bg-[#2A2A2A] text-[#A0A0A0] hover:text-white border border-[#3A3A3A] hover:border-[#5C7CFA]'
          : 'bg-white/90 text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300'
      }`}
    >
      <ExternalLink size={9} /> 상세편집
    </button>
  );
}

// 섹션 헤더용 래퍼: 헤더 옆에 추천 버튼을 자연스럽게 붙이기 위함
function SectionHeader({ children, sectionType, ec, className = '' }) {
  if (!ec?.jobAnalysis || !sectionType) return children;
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="flex-1 min-w-0">{children}</div>
      <VisualSectionRecommend sectionType={sectionType} jobAnalysis={ec.jobAnalysis} />
    </div>
  );
}

// Inline editable text - used in edit mode
export function EditText({ value, onChange, placeholder = '클릭하여 편집', className = '', tag: Tag = 'span' }) {
  const ref = useRef(null);
  const editing = useRef(false);
  // sync from outside only when not editing
  const prevValue = useRef(value);
  if (!editing.current && prevValue.current !== value) {
    prevValue.current = value;
    if (ref.current && ref.current.textContent !== (value || '')) {
      ref.current.textContent = value || '';
    }
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const br = document.createTextNode('\n');
      range.insertNode(br);
      range.setStartAfter(br);
      range.setEndAfter(br);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => { editing.current = true; if (!ref.current.textContent) ref.current.textContent = ''; }}
      onBlur={e => {
        editing.current = false;
        const t = e.currentTarget.textContent;
        prevValue.current = t;
        if (t !== (value || '')) onChange(t);
      }}
      onKeyDown={handleKeyDown}
      className={`${className} outline-none cursor-text ring-1 ring-transparent focus:ring-blue-400 focus:bg-blue-50/20 rounded-sm transition-all`}
      dangerouslySetInnerHTML={editing.current ? undefined : { __html: value || '' }}
      data-placeholder={!value ? placeholder : undefined}
    />
  );
}

export function EditTextarea({ value, onChange, placeholder = '클릭하여 편집', className = '' }) {
  const ref = useRef(null);
  const editing = useRef(false);
  const prevValue = useRef(value);
  if (!editing.current && prevValue.current !== value) {
    prevValue.current = value;
    if (ref.current && ref.current.innerText !== (value || '')) {
      ref.current.innerText = value || '';
    }
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const br = document.createTextNode('\n');
      range.insertNode(br);
      range.setStartAfter(br);
      range.setEndAfter(br);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => { editing.current = true; if (!ref.current.innerText) ref.current.textContent = ''; }}
      onBlur={e => {
        editing.current = false;
        const t = e.currentTarget.innerText;
        prevValue.current = t;
        if (t !== (value || '')) onChange(t);
      }}
      onKeyDown={handleKeyDown}
      className={`${className} outline-none cursor-text ring-1 ring-transparent focus:ring-blue-400 focus:bg-blue-50/20 rounded-sm transition-all whitespace-pre-wrap`}
      dangerouslySetInnerHTML={editing.current ? undefined : { __html: value || '' }}
    />
  );
}

// ── 편집 가능 섹션 제목 헬퍼 (ec 있으면 인라인 편집, 없으면 정적 텍스트) ──
function EH({ ec, value, sectionKey, className = '' }) {
  if (!ec) return <>{value}</>;
  const stored = ec.portfolio?.sectionTitles?.[sectionKey];
  const displayVal = stored !== undefined ? stored : value;
  return (
    <EditText
      value={displayVal}
      onChange={v => ec.update('sectionTitles', { ...(ec.portfolio?.sectionTitles || {}), [sectionKey]: v })}
      placeholder={value}
      className={className}
    />
  );
}

function ExpControls({ ec, dark = false }) {
  if (!ec) return null;
  const border = dark ? 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200' : 'border-gray-300 text-gray-500 hover:border-primary-400 hover:text-primary-600';
  const borderBlue = dark ? 'border-blue-700 text-blue-400 hover:border-blue-500 hover:bg-blue-900/20' : 'border-blue-300 text-blue-500 hover:border-blue-500 hover:bg-blue-50';
  const borderIndigo = dark ? 'border-indigo-700 text-indigo-400 hover:border-indigo-500' : 'border-indigo-300 text-indigo-500 hover:border-indigo-500 hover:bg-indigo-50';
  const bg = dark ? 'bg-transparent' : 'bg-white';
  const recPanel = ec.recResults;
  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => ec.addToArray('experiences', { company: '새 경험', title: '새 경험', role: '', period: '', bullets: [], description: '', detail: '' })}
          className={`flex items-center gap-1.5 px-3 py-1.5 border border-dashed rounded-lg text-xs transition-colors ${bg} ${border}`}
        >
          <Plus size={12} /> 경험 직접 추가
        </button>
        <button
          type="button"
          onClick={ec.onImportExperience}
          className={`flex items-center gap-1.5 px-3 py-1.5 border border-dashed rounded-lg text-xs transition-colors ${bg} ${borderBlue}`}
        >
          경험 DB에서 가져오기
        </button>
        {ec.jobAnalysis && ec.onFetchRecommendations && (
          <button
            type="button"
            onClick={ec.onFetchRecommendations}
            disabled={ec.recLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 border border-dashed rounded-lg text-xs transition-colors disabled:opacity-50 ${bg} ${borderIndigo}`}
          >
            {ec.recLoading && <Loader2 size={12} className="animate-spin" />}
            기업 맞춤 경험 추천
          </button>
        )}
      </div>
      {recPanel && (
        <div className={`rounded-xl border p-3 ${dark ? 'bg-[#1A1A1A] border-[#3A3A3A]' : 'bg-indigo-50/50 border-indigo-100'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${dark ? 'text-indigo-300' : 'text-indigo-700'}`}>
              {ec.jobAnalysis?.company} 맞춤 추천 경험
            </span>
            <button type="button" onClick={ec.onCloseRec} className={`${dark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
              <X size={12} />
            </button>
          </div>
          {(recPanel.keywords || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {recPanel.keywords.map((kw, i) => (
                <span key={i} className={`px-2 py-0.5 rounded-lg border text-[10px] ${dark ? 'bg-[#2A2A2A] border-[#3A3A3A] text-indigo-300' : 'bg-white border-indigo-200'}`}>
                  <span className={`font-bold ${dark ? 'text-indigo-400' : 'text-indigo-700'}`}>{kw.keyword}</span>
                  <span className={`ml-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{kw.description}</span>
                </span>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            {(recPanel.recommendations || []).map((rec, i) => (
              <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border ${dark ? 'bg-[#2A2A2A] border-[#3A3A3A]' : 'bg-white border-indigo-100'}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${dark ? 'text-[#EBEBEB]' : 'text-gray-800'}`}>{rec.experience?.title}</p>
                  <p className={`text-[10px] mt-0.5 ${dark ? 'text-[#A0A0A0]' : 'text-gray-500'}`}>{rec.reason}</p>
                  {(rec.matchedKeywords || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rec.matchedKeywords.map((mk, mi) => (
                        <span key={mi} className={`px-1 py-0.5 rounded text-[9px] font-medium ${dark ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>{mk}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => ec.onImportRecommendedExp?.(rec)}
                  className="flex-shrink-0 px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-medium hover:bg-indigo-700 transition-colors"
                >
                  추가
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RemoveBtn({ onClick, dark = false }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`absolute -top-2 -right-2 z-20 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${dark ? 'bg-white text-red-500' : 'bg-red-500 text-white'} shadow-sm`}
    >
      <X size={10} />
    </button>
  );
}

// ── 섹션 삭제 버튼 (편집 모드에서 섹션 헤더 옆에 표시) ──
function SectionDeleteBtn({ ec, sectionKey, dark = false }) {
  if (!ec?.hideSection) return null;
  const isHidden = ec.hiddenSections?.includes(sectionKey);
  if (isHidden) return null;
  return (
    <button
      type="button"
      title="섹션 숨기기"
      onClick={e => { e.stopPropagation(); ec.hideSection(sectionKey); }}
      className={`ml-2 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover/section:opacity-100 transition-opacity ${dark ? 'bg-[#3A3A3A] text-[#A0A0A0] hover:bg-red-900 hover:text-red-400' : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500'}`}
    >
      <X size={10} />
    </button>
  );
}

// ── 공통: Experience 타임라인 (모든 템플릿 공용) ──
function ExperienceTimeline({ expList, ec, dark = false, accentDot = '' }) {
  const lineColor = dark ? 'bg-[#3A3A3A]' : 'bg-gray-200';
  const dotBase = accentDot || (dark ? 'bg-[#5C7CFA]' : 'bg-primary-500');
  const titleColor = dark ? 'text-[#EBEBEB]' : 'text-gray-900';
  const subtitleColor = dark ? 'text-[#A0A0A0]' : 'text-gray-500';
  const periodColor = dark ? 'text-[#A0A0A0]' : 'text-gray-400';

  return (
    <div className="relative space-y-3 pl-5">
      <div className={`absolute left-[7px] top-0 bottom-0 w-0.5 ${lineColor} rounded-full`} />
      {expList.map((exp, idx) => (
        <div key={idx} className="flex items-start gap-3 relative group">
          {ec && <RemoveBtn dark={dark} onClick={() => ec.removeFromArray('experiences', idx)} />}
          <div className={`w-2.5 h-2.5 rounded-full ${dotBase} border-2 ${dark ? 'border-[#1F1F1F]' : 'border-white'} z-10 mt-1.5 flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`font-medium text-sm ${titleColor}`}>
                {ec
                  ? <EditText value={exp.company || exp.title || ''} onChange={v => ec.updateArrayItem('experiences', idx, { company: v, title: v })} className={`font-medium text-sm ${titleColor}`} placeholder="프로젝트명" />
                  : (exp.company || exp.title || '')
                }
              </span>
              {(exp.role || exp.subtitle) && (
                <span className={`text-xs ${subtitleColor}`}>{exp.role || exp.subtitle}</span>
              )}
            </div>
            <div className={`text-[11px] ${periodColor} mt-0.5`}>
              {ec
                ? <EditText value={exp.period || ''} onChange={v => ec.updateArrayItem('experiences', idx, { period: v })} className={`text-[11px] ${periodColor}`} placeholder="기간 (예: 2024.03 - 2024.06)" />
                : exp.period
              }
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 이미지 업로드 슬롯: ec 있을 때 클릭하면 파일 선택, 없으면 정적 렌더링 ──
function ImageUploadSlot({ src, onUpload, children, className = '', imgClassName = 'w-full h-full object-cover', rounded = '' }) {
  const ref = useRef(null);
  if (!onUpload) {
    return src
      ? <img src={src} className={`${imgClassName} ${rounded}`} alt="" />
      : <>{children}</>;
  }
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onUpload(f); e.target.value = ''; } }} />
      <div className={`${className} relative group cursor-pointer`} onClick={() => ref.current?.click()}>
        {src
          ? <img src={src} className={`${imgClassName} ${rounded}`} alt="" />
          : children
        }
        <div className={`absolute inset-0 ${rounded} bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`}>
          <Upload size={18} className="text-white drop-shadow" />
        </div>
      </div>
    </>
  );
}

// ── 카메라 아이콘 오버레이 업로드 버튼 ──
function CameraUploadBtn({ onUpload, dark = false, className = 'bottom-2 right-2' }) {
  const ref = useRef(null);
  if (!onUpload) return null;
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onUpload(f); e.target.value = ''; } }} />
      <button
        type="button"
        onClick={e => { e.stopPropagation(); ref.current?.click(); }}
        className={`absolute ${className} z-20 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md ${
          dark ? 'bg-[#2A2A2A] text-[#A0A0A0] hover:text-white border border-[#3A3A3A]' : 'bg-white text-gray-500 hover:text-gray-800 border border-gray-200'
        }`}
      >
        <Camera size={13} />
      </button>
    </>
  );
}

// ── 포트폴리오 데이터 → 템플릿 데이터 매핑 ──
export function mapPortfolioToTemplateData(p) {
  const levels = p.skillLevels || {};
  const getPercent = (name, def) => levels[name] != null ? `${levels[name]}%` : def;
  const _sName = (s) => typeof s === 'string' ? s : (s?.name || '');
  const _sPercent = (s, def) => {
    const name = _sName(s);
    if (levels[name] != null) return `${levels[name]}%`;
    if (typeof s === 'object' && s?.proficiency) return `${Math.round(s.proficiency * 20)}%`;
    return def;
  };
  const skills = [
    ...(p.skills?.tools || []).map(s => { const name = _sName(s); return { name, percent: _sPercent(s, '80%'), desc: name + ' 활용 가능' }; }),
    ...(p.skills?.languages || []).map(s => { const name = _sName(s); return { name, percent: _sPercent(s, '75%'), desc: name + ' 개발 경험' }; }),
    ...(p.skills?.frameworks || []).map(s => { const name = _sName(s); return { name, percent: _sPercent(s, '70%'), desc: name + ' 활용 가능' }; }),
    ...(p.skills?.others || []).map(s => { const name = _sName(s); return { name, percent: _sPercent(s, '65%'), desc: name }; }),
  ].slice(0, 8);

  const tagColors = [
    'bg-blue-100 text-blue-700', 'bg-pink-100 text-pink-700',
    'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
  ];
  const imgBgs = ['bg-blue-50', 'bg-pink-50', 'bg-green-50', 'bg-purple-50', 'bg-amber-50'];

  const experiences = (p.experiences || []);

  const _getDetails = (e) => {
    if (e.bullets?.length > 0) return e.bullets;
    if (e.details?.length > 0) return e.details;
    const sr = e.structuredResult || e.frameworkContent || {};
    const srKeys = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];
    const srItems = srKeys.map(k => sr[k]).filter(v => v?.trim?.());
    if (srItems.length > 0) return srItems;
    if (e.detail) return [e.detail];
    if (e.description) return [e.description];
    return [];
  };

  // 섹션 구조 추출: exportConfig.sections 우선, 없으면 e.sections 폴백
  const _getSections = (e) => {
    const exportSections = e.structuredResult?.exportConfig?.sections;
    if (exportSections?.length > 0)
      return exportSections.filter(s => s.content?.trim()).map(s => ({ label: s.label || s.key, content: s.content }));
    if ((e.sections || []).some(s => s.title && s.content))
      return e.sections.filter(s => s.title && s.content).map(s => ({ label: s.title, content: s.content }));
    return null;
  };

  const projects = experiences.length > 0
    ? experiences.map((e, idx) => {
        const sr = e.structuredResult || e.frameworkContent || {};
        const ov = sr.projectOverview || {};
        const srDesc = sr.intro || sr.overview || ov.summary || '';
        const structuredSections = _getSections(e);
        return {
          name: e.company || e.title || `프로젝트 ${idx + 1}`,
          period: e.period || '',
          tag: e.tag || (e.type === 'project' ? 'Project' : 'Experience'),
          tagColor: tagColors[idx % tagColors.length],
          desc: e.description || srDesc || e.detail || e.sections?.[0]?.content || e.bullets?.[0] || '',
          img: imgBgs[idx % imgBgs.length],
          details: structuredSections ? [] : _getDetails(e),
          sections: structuredSections || [],
          thumbnailUrl: e.thumbnailUrl || '',
          // Notion 스타일 프로퍼티
          duration: ov.duration || e.date || '',
          role: ov.role || e.role || '',
          techStack: (ov.techStack?.length > 0 ? ov.techStack : null) || (e.skills?.length > 0 ? e.skills : null) || [],
          keywords: e.keywords || [],
          goal: ov.goal || '',
          keyExperiences: sr.keyExperiences || [],
          coverImg: sr.exportConfig?.coverImg || '',
        };
      })
    : [
        { name: '프로젝트 1', period: '', tag: 'Project', tagColor: tagColors[0], desc: '프로젝트 설명을 입력해 주세요.', img: imgBgs[0], details: [] },
      ];

  return {
    name: p.userName || '이름',
    title: p.headline || p.title || 'Portfolio',
    catchphrase: p.headline || p.about?.split('\n')[0] || '',
    email: p.contact?.email || '',
    phone: p.contact?.phone || '',
    location: p.location || '',
    social: {
      instagram: p.contact?.instagram || '',
      youtube: '',
      blog: p.contact?.website || p.contact?.linkedin || '',
    },
    about: p.about || p.valuesEssay || '',
    education: (p.education || []).map(e => ({
      period: e.period || '',
      school: e.school || e.name || '',
      major: e.major || e.degree || '',
      details: e.detail ? [e.detail] : [],
    })),
    experience: experiences.map(e => ({
      period: e.period || '',
      company: e.company || e.title || '',
      role: e.role || e.subtitle || '',
      details: _getDetails(e),
    })),
    projects,
    skills: skills.length > 0 ? skills : [{ name: '스킬', percent: '80%', desc: '스킬을 추가해 주세요.' }],
    awards: (p.awards || []).map(a => ({ date: a.date || '', title: a.title || '' })),
  };
}

// ── 공통 프로젝트 모달 (Notion 스타일) ──
const ProjectModal = ({ project, onClose }) => {
  if (!project) return null;
  const keyExperiences = (project.keyExperiences || []).filter(Boolean);
  const sectionsToRender = project.sections?.length > 0
    ? project.sections
    : (project.details?.length > 0 ? project.details.map((d, i) => ({ label: `내용 ${i + 1}`, content: d })) : []);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[4vh] p-4 overflow-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-[780px] rounded-xl shadow-2xl overflow-hidden">
        {/* 커버 이미지 */}
        <div className={`w-full ${project.coverImg ? 'h-44' : 'h-10'} bg-gray-50 flex-shrink-0 relative`}>
          {project.coverImg && <img src={project.coverImg} alt="cover" className="w-full h-full object-cover" />}
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-white/80 backdrop-blur-sm text-gray-500 hover:text-gray-700 rounded-lg shadow-sm">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 문서 본문 */}
        <div className="max-w-[620px] mx-auto px-10 pb-14 pt-8 overflow-y-auto max-h-[75vh]">
          {/* 제목 */}
          <h1 className="text-[32px] font-extrabold text-gray-900 leading-tight mb-7">{project.name}</h1>

          {/* 프로퍼티 */}
          <div className="mb-7 space-y-2 border-b border-gray-100 pb-5">
            {project.duration && (
              <div className="flex items-center gap-4">
                <span className="w-14 text-[12px] text-gray-400 flex-shrink-0">기간</span>
                <span className="text-[13px] text-gray-700">{project.duration}</span>
              </div>
            )}
            {project.role && (
              <div className="flex items-start gap-4">
                <span className="w-14 text-[12px] text-gray-400 flex-shrink-0 mt-0.5">역할</span>
                <span className="text-[13px] text-gray-700 leading-relaxed">{project.role}</span>
              </div>
            )}
            {project.techStack?.length > 0 && (
              <div className="flex items-start gap-4">
                <span className="w-14 text-[12px] text-gray-400 flex-shrink-0 mt-0.5">기술</span>
                <div className="flex flex-wrap gap-1.5">
                  {project.techStack.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[12px]">
                      {typeof t === 'string' ? t : t?.name || ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {project.keywords?.length > 0 && (
              <div className="flex items-start gap-4">
                <span className="w-14 text-[12px] text-gray-400 flex-shrink-0 mt-0.5">키워드</span>
                <div className="flex flex-wrap gap-1.5">
                  {project.keywords.slice(0, 6).map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded text-[12px] font-medium">
                      {typeof kw === 'string' ? kw : kw?.name || kw?.keyword || ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {project.goal && (
              <div className="flex items-start gap-4">
                <span className="w-14 text-[12px] text-gray-400 flex-shrink-0 mt-0.5">목표</span>
                <span className="text-[13px] text-gray-700 leading-relaxed">{project.goal}</span>
              </div>
            )}
          </div>

          {/* 핵심 경험 슬라이드 */}
          {keyExperiences.length > 0 && (
            <div className="mb-7">
              <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2 mb-4">핵심 경험 &amp; 성과</h2>
              <KeyExperienceSlider keyExperiences={keyExperiences} />
            </div>
          )}

          {/* 섹션 본문 */}
          {sectionsToRender.length > 0 && (
            <div className="space-y-7">
              {sectionsToRender.map((sec, i) => (
                <div key={i}>
                  <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2 mb-3">
                    {sec.label}
                  </h2>
                  <p className="text-[14px] text-gray-700 leading-[1.9] whitespace-pre-wrap">{sec.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* 섹션 없을 때 기본 설명 */}
          {sectionsToRender.length === 0 && keyExperiences.length === 0 && project.desc && (
            <p className="text-[14px] text-gray-700 leading-[1.9]">{project.desc}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── 스킬 편집 패널 (모든 Visual 템플릿 공통) ──
const SKILL_VT_PROFICIENCY_LEVELS = [
  { value: 1, label: '기초', color: 'bg-gray-300' },
  { value: 2, label: '초급', color: 'bg-blue-300' },
  { value: 3, label: '중급', color: 'bg-green-400' },
  { value: 4, label: '고급', color: 'bg-amber-400' },
  { value: 5, label: '전문가', color: 'bg-red-400' },
];
const SKILL_VT_PRESETS = {
  tools:      ['Notion', 'Figma', 'Photoshop', 'Illustrator', 'Canva', 'Slack', 'Jira', 'Excel', 'VS Code', 'GitHub', 'Premiere Pro'],
  languages:  ['Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'Go', 'Swift', 'Kotlin', 'SQL', 'R'],
  frameworks: ['React', 'Vue.js', 'Next.js', 'Spring', 'Django', 'Node.js', 'Express.js', 'TensorFlow', 'Flutter', 'Tailwind CSS'],
  others:     ['데이터 분석', 'UI/UX 디자인', '프로젝트 관리', '기획', '마케팅', '글쓰기', '발표', '리더십'],
};
const SKILL_VT_CATEGORY_LABELS = {
  tools: '도구 (Tools)', languages: '프로그래밍 언어', frameworks: '프레임워크/라이브러리', others: '기타 역량',
};

function SkillVTCategoryInput({ category, portfolio, ec }) {
  const [customInput, setCustomInput] = useState('');
  const [editingSkill, setEditingSkill] = useState(null);
  const portfolioSkills = portfolio.skills || {};
  const items = portfolioSkills[category] || [];
  const getItemName = (item) => typeof item === 'string' ? item : (item.name || '');
  const getItemProficiency = (item) => typeof item === 'string' ? 0 : (item.proficiency || 0);
  const selectedNames = items.map(getItemName);

  const toggleSkill = (name) => {
    const currentCat = [...(portfolioSkills[category] || [])];
    if (currentCat.map(getItemName).includes(name)) {
      ec.update('skills', { ...portfolioSkills, [category]: currentCat.filter(item => getItemName(item) !== name) });
    } else {
      ec.update('skills', { ...portfolioSkills, [category]: [...currentCat, { name, proficiency: 3 }] });
    }
  };

  const setProficiency = (name, level) => {
    const currentCat = [...(portfolioSkills[category] || [])];
    ec.update('skills', {
      ...portfolioSkills,
      [category]: currentCat.map(item =>
        getItemName(item) === name
          ? { name, proficiency: level }
          : (typeof item === 'string' ? { name: item, proficiency: 0 } : item)
      ),
    });
    setEditingSkill(null);
  };

  const addCustom = () => {
    const val = customInput.trim();
    if (!val) return;
    const currentCat = [...(portfolioSkills[category] || [])];
    if (currentCat.map(getItemName).includes(val)) return;
    ec.update('skills', { ...portfolioSkills, [category]: [...currentCat, { name: val, proficiency: 3 }] });
    setCustomInput('');
  };

  const presets = SKILL_VT_PRESETS[category] || [];

  return (
    <div className="mb-4">
      <p className="text-[11px] font-semibold text-gray-400 mb-1.5">{SKILL_VT_CATEGORY_LABELS[category]}</p>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {items.map((item, i) => {
            const name = getItemName(item);
            const prof = getItemProficiency(item);
            return (
              <div key={i} className="relative">
                <button
                  type="button"
                  onClick={() => setEditingSkill(editingSkill === name ? null : name)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  {name}
                  {prof > 0 && (
                    <span className="flex gap-0.5 ml-1">
                      {[1,2,3,4,5].map(l => (
                        <span key={l} className={`w-1 h-2.5 rounded-sm ${l <= prof ? SKILL_VT_PROFICIENCY_LEVELS[prof-1].color : 'bg-gray-200'}`} />
                      ))}
                    </span>
                  )}
                  <span role="button" onClick={ev => { ev.stopPropagation(); toggleSkill(name); }} className="hover:text-red-500 ml-0.5">
                    <X size={9} />
                  </span>
                </button>
                {editingSkill === name && (
                  <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[140px]">
                    <p className="text-[10px] text-gray-400 mb-1 px-1">숙련도</p>
                    {SKILL_VT_PROFICIENCY_LEVELS.map(lv => (
                      <button key={lv.value} type="button" onClick={() => setProficiency(name, lv.value)}
                        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-gray-50 ${prof === lv.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600'}`}>
                        <span className="flex gap-0.5">
                          {[1,2,3,4,5].map(l => <span key={l} className={`w-1 h-2.5 rounded-sm ${l <= lv.value ? lv.color : 'bg-gray-200'}`} />)}
                        </span>
                        {lv.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-1 mb-2">
        {presets.map(name => {
          const isSelected = selectedNames.includes(name);
          return (
            <button key={name} type="button" onClick={() => toggleSkill(name)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                isSelected
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}>
              {isSelected ? '✓ ' : ''}{name}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1">
        <input value={customInput} onChange={e => setCustomInput(e.target.value)} placeholder="직접 입력..."
          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded outline-none focus:ring-1 focus:ring-blue-300"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
        <button type="button" onClick={addCustom}
          className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs hover:bg-gray-200">추가</button>
      </div>
    </div>
  );
}

function SkillsEditorPanel({ portfolio, ec }) {
  if (!ec) return null;
  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
      {['tools', 'languages', 'frameworks', 'others'].map(cat => (
        <SkillVTCategoryInput key={cat} category={cat} portfolio={portfolio} ec={ec} />
      ))}
    </div>
  );
}

// 섹션 순서 유틸 (Visual Templates 공통)
function makeSectionOrderUtils(portfolio, ec, defaultSections) {
  const sectionOrder = (portfolio.sectionOrder && portfolio.sectionOrder.length > 0)
    ? portfolio.sectionOrder : defaultSections;
  const getOrder = (key) => { const i = sectionOrder.indexOf(key); return i >= 0 ? i : 99; };
  const swapOrder = (fromKey, toKey) => {
    if (!fromKey || fromKey === toKey || !ec) return;
    const cur = [...sectionOrder];
    const fi = cur.indexOf(fromKey), ti = cur.indexOf(toKey);
    if (fi === -1 || ti === -1) return;
    [cur[fi], cur[ti]] = [cur[ti], cur[fi]];
    ec.update('sectionOrder', cur);
  };
  const dragProps = (key) => ec ? {
    style: { order: getOrder(key) },
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => { e.preventDefault(); swapOrder(e.dataTransfer.getData('text/plain'), key); },
  } : {};
  const gripProps = (key) => ec ? {
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.setData('text/plain', key); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.closest('div[style]').style.opacity = '0.5'; },
    onDragEnd: (e) => { e.currentTarget.closest('div[style]').style.opacity = '1'; },
    className: 'cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors ml-1',
    title: '드래그하여 이동',
  } : {};
  return { getOrder, swapOrder, dragProps, gripProps };
}

// ── 템플릿 1: 기본 버전의 정의 ──
export const VisualTemplate1 = ({ portfolio, ec }) => {
  const [selectedProject, setSelectedProject] = useState(null);
  const data = mapPortfolioToTemplateData(portfolio);
  const expList = ec ? (portfolio.experiences || []) : data.experience;
  const projList = ec ? (portfolio.experiences || []) : data.projects;
  const eduList = ec ? (portfolio.education || []) : data.education;
  const awardList = ec ? (portfolio.awards || []) : data.awards;
  const skillList = ec ? buildEditSkillList(portfolio) : data.skills;
  const contact = ec ? (portfolio.contact || {}) : { email: data.email, phone: data.phone };
  const { dragProps: dp, gripProps: gp } = makeSectionOrderUtils(portfolio, ec, ['education', 'experiences', 'projects', 'awards', 'skills', 'contact']);
  const hidden1 = ec ? (ec.hiddenSections || []) : (portfolio.hiddenSections || []);
  const isHidden1 = (key) => hidden1.includes(key);

  return (
    <div className="min-h-screen bg-white text-[#37352f] font-sans selection:bg-blue-200">
      {/* Cover */}
      <ImageUploadSlot
        src={ec ? portfolio.coverImageUrl : null}
        onUpload={ec?.onUploadCoverImage}
        className="w-full h-52"
        imgClassName="w-full h-52 object-cover"
        rounded=""
      >
        <div className="w-full h-52 bg-gray-400 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
          <h1 className="text-5xl font-light text-white/80 tracking-widest uppercase relative z-10">PORTFOLIO</h1>
        </div>
      </ImageUploadSlot>

      <div className="max-w-4xl mx-auto px-6 md:px-24 pb-32">
        {/* Profile Image */}
        <div className="relative -mt-12 mb-8">
          <ImageUploadSlot
            src={ec ? portfolio.profileImageUrl : null}
            onUpload={ec?.onUploadProfileImage}
            className="w-24 h-24 rounded-full overflow-hidden bg-white shadow-sm border border-gray-100 z-10 relative"
            imgClassName="w-full h-full object-cover"
            rounded="rounded-full"
          >
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 z-10 relative"><UserCircle2 className="w-12 h-12 text-gray-300" /></div>
          </ImageUploadSlot>
        </div>

        <h1 className="text-4xl font-bold mb-4">{ec ? <EditText value={portfolio.portfolioTitle || ('Portfolio of ' + (portfolio.userName || ''))} onChange={v => ec.update('portfolioTitle', v)} placeholder="Portfolio of 이름" className="text-4xl font-bold" /> : (portfolio.portfolioTitle || 'Portfolio of ' + data.name)}</h1>
        {ec
          ? <EditTextarea value={portfolio.about} onChange={v => ec.update('about', v)} className="text-[#787774] text-lg mb-8" />
          : <p className="text-[#787774] text-lg mb-8 whitespace-pre-wrap">{data.about}</p>
        }
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-12">
          {[['이력서 (Resume)', FileText, 't1-education'], ['경력 기술서 (Experience)', Briefcase, 't1-experiences'], ['프로젝트 모음 (Projects)', Folder, 't1-projects'], ['연락처 (Contact)', Mail, 't1-contact']].map(([label, Icon, sectionId]) => (
            <div key={label} onClick={() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md cursor-pointer transition-colors group">
              <Icon className="w-5 h-5 text-gray-500" />
              <span className="border-b border-transparent group-hover:border-gray-400 transition-colors">{label}</span>
            </div>
          ))}
        </div>

        {/* Education */}
        {!isHidden1('education') && (eduList.length > 0 || ec) && (
          <div {...dp('education')} id="t1-education">
            <hr className="border-[#ededed] my-8" />
            <div className="mb-12 group/section">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2"><GraduationCap className="w-6 h-6" /><h2 className="text-2xl font-bold"><EH ec={ec} value="Education" sectionKey="education" /></h2></div>
                <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="education" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('education')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="education" /></div>
              </div>
              <div className="space-y-4">
                {eduList.map((edu, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row gap-2 md:gap-8 hover:bg-gray-50 p-2 -ml-2 rounded-md relative group">
                    {ec && <RemoveBtn onClick={() => ec.removeFromArray('education', idx)} />}
                    <div className="w-full md:w-1/4 text-[#787774] shrink-0 pt-1">
                      {ec ? <EditText value={edu.period || ''} onChange={v => ec.updateArrayItem('education', idx, { period: v })} placeholder="기간" className="text-sm text-[#787774]" /> : edu.period}
                    </div>
                    <div>
                      {ec ? <EditText value={edu.name || edu.school || ''} onChange={v => ec.updateArrayItem('education', idx, { name: v })} className="font-bold block" placeholder="학교명" /> : <h3 className="font-bold">{edu.school}</h3>}
                      {ec ? <EditText value={edu.degree || edu.major || ''} onChange={v => ec.updateArrayItem('education', idx, { degree: v })} className="text-sm text-gray-500 block" placeholder="전공/학위" /> : <p className="text-sm text-gray-500">{edu.major}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {ec && <button type="button" onClick={() => ec.addToArray('education', { name: '', degree: '', period: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors mt-3"><Plus size={12} /> 학력 추가</button>}
            </div>
          </div>
        )}

        {!isHidden1('experiences') && <div {...dp('experiences')} id="t1-experiences">
        <hr className="border-[#ededed] my-8" />
        <div className="mb-12 group/section">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2"><Briefcase className="w-6 h-6" /><h2 className="text-2xl font-bold"><EH ec={ec} value="Work Experience" sectionKey="experiences" /></h2></div>
            <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="experiences" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('experiences')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="experiences" /></div>
          </div>
          <ExperienceTimeline expList={expList} ec={ec} />
        </div>
        </div>}

        {!isHidden1('projects') && <div {...dp('projects')} id="t1-projects">
        <hr className="border-[#ededed] my-8" />
        <div className="mb-12 group/section">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2"><Folder className="w-6 h-6" /><h2 className="text-2xl font-bold"><EH ec={ec} value="Projects" sectionKey="projects" /></h2></div>
            <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="projects" jobAnalysis={ec.jobAnalysis} />}<SectionDeleteBtn ec={ec} sectionKey="projects" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {projList.map((proj, idx) => (
              <div key={idx} onClick={() => ec ? ec.onOpenExpDetail(proj, idx) : setSelectedProject(proj)} className="group cursor-pointer flex flex-col border border-[#ededed] rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white relative">
                {ec && <RemoveBtn onClick={() => ec.removeFromArray('experiences', idx)} />}
                <div className={`aspect-video ${proj.img || 'bg-blue-50'} overflow-hidden relative`}>
                  <ImageUploadSlot
                    src={proj.thumbnailUrl}
                    onUpload={null}
                    className={`aspect-video ${proj.img || 'bg-blue-50'} overflow-hidden`}
                    imgClassName="w-full h-full object-cover"
                    rounded=""
                  >
                    <div className={`aspect-video ${proj.img || 'bg-blue-50'} flex items-center justify-center overflow-hidden`}>
                      <div className="w-3/4 h-3/4 bg-white/40 rounded-md shadow-sm group-hover:scale-105 transition-transform duration-300"></div>
                    </div>
                  </ImageUploadSlot>
                  <CameraUploadBtn onUpload={ec ? f => ec.onUploadExpImage(f, idx) : null} />
                </div>
                <div className="p-4">
                  {ec
                    ? <EditText value={proj.company || proj.title || proj.name || ''} onChange={v => ec.updateArrayItem('experiences', idx, { company: v, title: v })} className="font-bold text-lg mb-1 block" placeholder="프로젝트명" />
                    : <h3 className="font-bold text-lg mb-1 flex items-center gap-1">{proj.name} <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" /></h3>
                  }
                  {ec
                    ? <EditText value={proj.description || proj.desc || ''} onChange={v => ec.updateArrayItem('experiences', idx, { description: v })} className="text-sm text-[#787774] mb-3 block" placeholder="설명" />
                    : <p className="text-sm text-[#787774] mb-3 line-clamp-2">{proj.desc}</p>
                  }
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${proj.tagColor || 'bg-blue-100 text-blue-700'}`}>{proj.tag || 'Project'}</span>
                </div>
              </div>
            ))}
          </div>
          {ec && <ExpControls ec={ec} />}
        </div>
        </div>}{/* end projects */}

        {/* Awards */}
        {!isHidden1('awards') && (awardList.length > 0 || ec) && (
          <div {...dp('awards')} id="t1-awards">
            <hr className="border-[#ededed] my-8" />
            <div className="mb-12 group/section">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2"><Award className="w-6 h-6" /><h2 className="text-2xl font-bold"><EH ec={ec} value="Awards" sectionKey="awards" /></h2></div>
                <div className="flex items-center gap-1">{ec && <span {...gp('awards')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="awards" /></div>
              </div>
              <div className="space-y-3">
                {awardList.map((award, idx) => (
                  <div key={idx} className="flex gap-8 hover:bg-gray-50 p-2 -ml-2 rounded-md relative group">
                    {ec && <RemoveBtn onClick={() => ec.removeFromArray('awards', idx)} />}
                    <div className="w-1/4 text-[#787774] text-sm pt-0.5">
                      {ec ? <EditText value={award.date || ''} onChange={v => ec.updateArrayItem('awards', idx, { date: v })} placeholder="날짜" className="text-sm text-[#787774]" /> : award.date}
                    </div>
                    <div>
                      {ec ? <EditText value={award.title || ''} onChange={v => ec.updateArrayItem('awards', idx, { title: v })} className="font-medium block" placeholder="수상명" /> : <span className="font-medium">{award.title}</span>}
                      {ec && <EditText value={award.org || ''} onChange={v => ec.updateArrayItem('awards', idx, { org: v })} className="text-sm text-gray-500 block" placeholder="수여 기관" />}
                    </div>
                  </div>
                ))}
              </div>
              {ec && <button type="button" onClick={() => ec.addToArray('awards', { title: '', date: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors mt-3"><Plus size={12} /> 수상 추가</button>}
            </div>
          </div>
        )}

        {/* Skills */}
        {!isHidden1('skills') && (skillList.length > 0 || ec) && (
          <div {...dp('skills')} id="t1-skills">
            <hr className="border-[#ededed] my-8" />
            <div className="mb-12 group/section">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2"><Code className="w-6 h-6" /><h2 className="text-2xl font-bold"><EH ec={ec} value="Skills" sectionKey="skills" /></h2></div>
                <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="skills" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('skills')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="skills" /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {skillList.map((skill, idx) => (
                  <div key={idx} className="relative group">
                    {ec && <RemoveBtn onClick={() => {
                      const cat = skill.category || 'tools';
                      const arr = [...(portfolio.skills?.[cat] || [])];
                      const ni = arr.indexOf(skill.name); if (ni > -1) arr.splice(ni, 1);
                      ec.update('skills', { ...portfolio.skills, [cat]: arr });
                    }} />}
                    <SkillTooltipBadge skill={skill} ec={ec} levelMode="blocks" />
                  </div>
                ))}
              </div>
              <SkillsEditorPanel portfolio={portfolio} ec={ec} />
            </div>
          </div>
        )}

        {/* Contact */}
        {!isHidden1('contact') && (data.email || data.phone || ec) && (
          <div {...dp('contact')} id="t1-contact">
            <hr className="border-[#ededed] my-8" />
            <div className="mb-12 group/section">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2"><Mail className="w-6 h-6" /><h2 className="text-2xl font-bold">Contact</h2></div>
                <div className="flex items-center gap-1">{ec && <span {...gp('contact')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="contact" /></div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                {ec ? (
                  <>
                    <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-gray-400 shrink-0" /><input value={contact.email || ''} onChange={e => ec.updateNested('contact','email',e.target.value)} placeholder="이메일" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-200 focus:border-gray-400 py-0.5" /></div>
                    <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-gray-400 shrink-0" /><input value={contact.phone || ''} onChange={e => ec.updateNested('contact','phone',e.target.value)} placeholder="전화번호" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-200 focus:border-gray-400 py-0.5" /></div>
                    <div className="flex items-center gap-3"><Globe className="w-4 h-4 text-gray-400 shrink-0" /><input value={contact.github || ''} onChange={e => ec.updateNested('contact','github',e.target.value)} placeholder="GitHub URL" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-200 focus:border-gray-400 py-0.5" /></div>
                    <div className="flex items-center gap-3"><ExternalLink className="w-4 h-4 text-gray-400 shrink-0" /><input value={contact.website || ''} onChange={e => ec.updateNested('contact','website',e.target.value)} placeholder="웹사이트/LinkedIn" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-200 focus:border-gray-400 py-0.5" /></div>
                  </>
                ) : (
                  <>
                    {data.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> {data.email}</p>}
                    {data.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> {data.phone}</p>}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {ec && (ec.hiddenSections || []).length > 0 && (
          <div className="mt-8 mb-4">
            <div className="border border-dashed border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-3">숨긴 섹션 복원</p>
              <div className="flex flex-wrap gap-2">
                {(ec.hiddenSections || []).map(key => (
                  <button key={key} type="button" onClick={() => ec.showSection(key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-50 text-gray-500 border border-gray-200 hover:border-primary-400 hover:text-primary-400 transition-colors">
                    <Plus size={11} /> {key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </div>
  );
};

// ── 템플릿 2: 베이지 톤 ──
export const VisualTemplate2 = ({ portfolio, ec }) => {
  const [selectedProject, setSelectedProject] = useState(null);
  const data = mapPortfolioToTemplateData(portfolio);
  const expList = ec ? (portfolio.experiences || []) : data.experience;
  const projList = ec ? (portfolio.experiences || []) : data.projects;
  const eduList = ec ? (portfolio.education || []) : data.education;
  const awardList = ec ? (portfolio.awards || []) : data.awards;
  const skillList = ec ? buildEditSkillList(portfolio) : data.skills;
  const contact = ec ? (portfolio.contact || {}) : { email: data.email, phone: data.phone };
  const { dragProps: dp, gripProps: gp } = makeSectionOrderUtils(portfolio, ec, ['resume', 'projects', 'skills', 'contact']);
  const hidden2 = ec ? (ec.hiddenSections || []) : (portfolio.hiddenSections || []);
  const isHidden2 = (key) => hidden2.includes(key);

  return (
    <div className="min-h-screen bg-white text-[#37352f] font-serif pb-32">
      <div className="max-w-3xl mx-auto px-6">
        <div className="py-12 border-b-2 border-gray-100">
          <h1 className="text-6xl font-light text-[#dedbd2] tracking-tighter uppercase mb-4">PORTFOLIO</h1>
          <h2 className="text-2xl font-bold text-gray-800">
            {ec ? <EditText value={portfolio.userName} onChange={v => ec.update('userName', v)} placeholder="이름" className="text-2xl font-bold" /> : data.name}
          </h2>
        </div>
        <div className="py-10 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-500 mb-6">
            {ec ? <EditText value={portfolio.headline} onChange={v => ec.update('headline', v)} placeholder="헤드라인" className="text-xl font-bold text-gray-500" /> : data.title}
          </h3>
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <h4 className="text-lg font-bold mb-4">About me</h4>
              <div className="border-l-4 border-black pl-4 py-1">
                {ec
                  ? <EditTextarea value={portfolio.about} onChange={v => ec.update('about', v)} className="text-sm font-sans text-gray-700 leading-relaxed" />
                  : <p className="text-sm font-sans text-gray-700 leading-relaxed whitespace-pre-wrap">{data.about}</p>
                }
              </div>
            </div>
            {/* Profile Image */}
            <div className="ml-6 shrink-0">
              <ImageUploadSlot src={ec ? portfolio.profileImageUrl : null} onUpload={ec?.onUploadProfileImage} className="w-24 h-24 rounded-full overflow-hidden bg-[#e8e4db]" imgClassName="w-full h-full object-cover" rounded="rounded-full">
                <div className="w-24 h-24 bg-[#e8e4db] rounded-full flex items-center justify-center"><UserCircle2 className="w-12 h-12 text-[#b5a99a]" /></div>
              </ImageUploadSlot>
            </div>
          </div>
        </div>
        <div className="flex justify-between gap-2 py-8 border-b border-gray-100 font-sans text-sm">
          {[['RESUME', 't2-resume'], ['PROJECT', 't2-projects'], ['SKILLS', 't2-skills'], ['CONTACT', 't2-contact']].map(([label, sectionId]) => (
            <div key={label} onClick={() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })} className="flex-1 bg-[#f3f2eb] text-center py-2 rounded text-gray-700 font-bold cursor-pointer hover:bg-[#e8e4db]">{label}</div>
          ))}
        </div>
        {/* Reorderable sections */}
        <div className="flex flex-col">
        {!isHidden2('resume') && <div className="py-10 group/section" id="t2-resume" {...dp('resume')}>
          <div className="flex items-center justify-between gap-3 mb-8">
            <h2 className="text-2xl font-bold border-b border-black inline-block pb-1"><EH ec={ec} value="RESUME" sectionKey="resume" /></h2>
            <div className="flex items-center gap-1">{ec && <span {...gp('resume')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="resume" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 font-sans">
            <div>
              <div className="flex items-center justify-between gap-2 mb-6">
                <div className="bg-[#f3f2eb] text-center py-1 font-bold flex-1">Education</div>
                {ec?.jobAnalysis && <VisualSectionRecommend sectionType="education" jobAnalysis={ec.jobAnalysis} />}
              </div>
              {eduList.map((edu, idx) => (
                <div key={idx} className="mb-8 relative group">
                  {ec && <RemoveBtn onClick={() => ec.removeFromArray('education', idx)} />}
                  {ec
                    ? <EditText value={edu.name || edu.school || ''} onChange={v => ec.updateArrayItem('education', idx, { name: v })} className="font-bold text-lg block" placeholder="학교명" />
                    : <h4 className="font-bold text-lg">{edu.school}</h4>
                  }
                  {ec
                    ? <EditText value={edu.degree || edu.major || ''} onChange={v => ec.updateArrayItem('education', idx, { degree: v })} className="text-sm text-gray-600 mb-2 block" placeholder="전공" />
                    : <p className="text-sm text-gray-600 mb-2">{edu.major}</p>
                  }
                  {ec
                    ? <EditText value={edu.period || ''} onChange={v => ec.updateArrayItem('education', idx, { period: v })} className="text-xs text-gray-400 mb-2 block" placeholder="기간" />
                    : <p className="text-xs text-gray-400 mb-2">{edu.period}</p>
                  }
                </div>
              ))}
              {ec && (
                <button type="button" onClick={() => ec.addToArray('education', { name: '', degree: '', period: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
                  <Plus size={12} /> 학력 추가
                </button>
              )}
            </div>
            <div>
              <div className="bg-[#f3f2eb] text-center py-1 font-bold mb-6">Experience</div>
              <ExperienceTimeline expList={expList} ec={ec} />
              {awardList.length > 0 && (
                <>
                  <div className="flex items-center justify-between gap-2 mb-6 mt-10">
                    <div className="bg-[#f3f2eb] text-center py-1 font-bold flex-1">Awards</div>
                    {ec?.jobAnalysis && <VisualSectionRecommend sectionType="awards" jobAnalysis={ec.jobAnalysis} />}
                  </div>
                  {awardList.map((award, idx) => (
                    <div key={idx} className="mb-8 relative group">
                      {ec && <RemoveBtn onClick={() => ec.removeFromArray('awards', idx)} />}
                      {ec
                        ? <EditText value={award.title || ''} onChange={v => ec.updateArrayItem('awards', idx, { title: v })} className="font-bold text-lg block" placeholder="수상명" />
                        : <h4 className="font-bold text-lg">{award.title}</h4>
                      }
                      {ec
                        ? <EditText value={award.date || ''} onChange={v => ec.updateArrayItem('awards', idx, { date: v })} className="text-xs text-gray-400 block" placeholder="날짜" />
                        : <p className="text-xs text-gray-400">{award.date}</p>
                      }
                    </div>
                  ))}
                  {ec && (
                    <button type="button" onClick={() => ec.addToArray('awards', { title: '', date: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
                      <Plus size={12} /> 수상 추가
                    </button>
                  )}
                </>
              )}
              {ec && awardList.length === 0 && (
                <button type="button" onClick={() => ec.addToArray('awards', { title: '', date: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors mt-4">
                  <Plus size={12} /> 수상 추가
                </button>
              )}
            </div>
          </div>
        </div>}{/* end resume section */}
        {/* Projects */}
        {!isHidden2('projects') && <div className="py-10 border-t border-gray-100 font-sans group/section" id="t2-projects" {...dp('projects')}>
          <div className="flex items-center justify-between gap-3 mb-8">
            <h2 className="text-2xl font-bold border-b border-black inline-block pb-1 font-serif"><EH ec={ec} value="PROJECT" sectionKey="projects" /></h2>
            <div className="flex items-center gap-1">{ec && <span {...gp('projects')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="projects" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projList.map((proj, idx) => (
              <div key={idx} onClick={() => ec ? ec.onOpenExpDetail(proj, idx) : setSelectedProject(proj)} className="border border-gray-200 rounded-md overflow-hidden cursor-pointer hover:shadow-md transition group relative">
                {ec && <RemoveBtn onClick={() => ec.removeFromArray('experiences', idx)} />}
                <div className={`h-40 ${proj.img || 'bg-blue-50'} overflow-hidden relative`}>
                  <ImageUploadSlot src={proj.thumbnailUrl} onUpload={null} className={`h-40 ${proj.img || 'bg-blue-50'} overflow-hidden`} imgClassName="w-full h-40 object-cover" rounded="">
                    <div className={`h-40 ${proj.img || 'bg-blue-50'} flex items-center justify-center font-bold text-lg text-gray-800`}>
                      {ec
                        ? <EditText value={proj.company || proj.title || proj.name || ''} onChange={v => ec.updateArrayItem('experiences', idx, { company: v, title: v })} className="font-bold text-lg text-gray-800" placeholder="프로젝트명" />
                        : proj.name
                      }
                    </div>
                  </ImageUploadSlot>
                  <CameraUploadBtn onUpload={ec ? f => ec.onUploadExpImage(f, idx) : null} />
                </div>
                <div className="p-3 bg-white">
                  {ec
                    ? <EditText value={proj.description || proj.desc || ''} onChange={v => ec.updateArrayItem('experiences', idx, { description: v })} className="text-sm text-gray-600 block" placeholder="설명" />
                    : <div className="text-sm text-gray-600 flex items-center gap-1 group-hover:text-black transition-colors"><ChevronRight className="w-4 h-4"/> 상세보기</div>
                  }
                </div>
              </div>
            ))}
          </div>
          {ec && <ExpControls ec={ec} />}
        </div>}
        {/* Skills */}
        {!isHidden2('skills') && <div className="py-10 border-t border-gray-100 font-sans group/section" id="t2-skills" {...dp('skills')}>
          <div className="flex items-center justify-between gap-3 mb-8">
            <h2 className="text-2xl font-bold border-b border-black inline-block pb-1 font-serif"><EH ec={ec} value="SKILLS" sectionKey="skills" /></h2>
            <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="skills" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('skills')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="skills" /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {skillList.map((skill, idx) => (
              <div key={idx} className="border border-gray-200 p-4 rounded-md bg-white relative group">
                {ec && <RemoveBtn onClick={() => {
                  const cat = skill.category || 'tools';
                  const arr = [...(portfolio.skills?.[cat] || [])];
                  const ni = arr.indexOf(skill.name); if (ni > -1) arr.splice(ni, 1);
                  ec.update('skills', { ...portfolio.skills, [cat]: arr });
                }} />}
                <div className="font-bold text-sm mb-2 flex justify-between items-center">
                  <SkillTooltipBadge skill={skill} ec={ec} plain levelMode="bar" />
                  <span className="text-xs text-gray-400">{skill.percent}</span>
                </div>
                <div className="w-full bg-gray-100 h-2 mb-3 rounded overflow-hidden">
                  <div className="bg-black h-full" style={{ width: skill.percent }}></div>
                </div>
                <div className="text-xs text-gray-500 line-clamp-2">{skill.desc}</div>
              </div>
            ))}
          </div>
          <SkillsEditorPanel portfolio={portfolio} ec={ec} />
        </div>}
        {/* Contact */}
        {!isHidden2('contact') && <div className="py-10 border-t border-gray-100 font-serif pb-20 group/section" id="t2-contact" {...dp('contact')}>
          <div className="flex items-center justify-between gap-3 mb-8">
            <h2 className="text-2xl font-bold border-b border-black inline-block pb-1">Contact</h2>
            <div className="flex items-center gap-1">{ec && <span {...gp('contact')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="contact" /></div>
          </div>
          <div className="border-l-2 border-black pl-4 mb-6 font-sans space-y-2">
            {ec ? (
              <>
                <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 shrink-0" /><input value={contact.phone || ''} onChange={e => ec.updateNested('contact','phone',e.target.value)} placeholder="전화번호" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-black" /></div>
                <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 shrink-0" /><input value={contact.email || ''} onChange={e => ec.updateNested('contact','email',e.target.value)} placeholder="이메일" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-black" /></div>
                <div className="flex items-center gap-2 text-sm"><Globe className="w-4 h-4 shrink-0" /><input value={contact.github || ''} onChange={e => ec.updateNested('contact','github',e.target.value)} placeholder="GitHub" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-black" /></div>
                <div className="flex items-center gap-2 text-sm"><ExternalLink className="w-4 h-4 shrink-0" /><input value={contact.website || ''} onChange={e => ec.updateNested('contact','website',e.target.value)} placeholder="웹사이트" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-black" /></div>
              </>
            ) : (
              <>
                {data.phone && <p className="text-sm mb-1">tel : {data.phone}</p>}
                {data.email && <p className="text-sm">e-mail : {data.email}</p>}
              </>
            )}
          </div>
        </div>}
        </div>{/* end flex col reorderable sections */}
        {ec && (ec.hiddenSections || []).length > 0 && (
          <div className="mt-4 mb-8">
            <div className="border border-dashed border-gray-200 rounded-xl p-4 font-sans">
              <p className="text-xs text-gray-400 mb-3">숨긴 섹션 복원</p>
              <div className="flex flex-wrap gap-2">
                {(ec.hiddenSections || []).map(key => (
                  <button key={key} type="button" onClick={() => ec.showSection(key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-50 text-gray-500 border border-gray-200 hover:border-primary-400 hover:text-primary-400 transition-colors">
                    <Plus size={11} /> {key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </div>
  );
};

// ── 템플릿 3: DB 구조화 ──
const DatabaseHeader = () => (
  <div className="flex justify-between items-center mb-4 text-gray-500 border-b border-gray-100 pb-2">
    <div className="flex gap-1">
      <div className="p-1 hover:bg-gray-100 rounded cursor-pointer"><List className="w-4 h-4" /></div>
      <div className="p-1 hover:bg-gray-100 rounded cursor-pointer"><LayoutGrid className="w-4 h-4" /></div>
      <div className="p-1 hover:bg-gray-100 rounded cursor-pointer"><Columns className="w-4 h-4" /></div>
    </div>
    <div className="flex gap-2 items-center">
      <Filter className="w-4 h-4 cursor-pointer hover:text-gray-800" />
      <ArrowUpDown className="w-4 h-4 cursor-pointer hover:text-gray-800" />
      <Search className="w-4 h-4 cursor-pointer hover:text-gray-800" />
      <MoreHorizontal className="w-4 h-4 cursor-pointer hover:text-gray-800" />
      <button className="bg-blue-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-blue-600">새로 만들기 <ChevronDown className="w-3 h-3"/></button>
    </div>
  </div>
);

export const VisualTemplate3 = ({ portfolio, ec }) => {
  const [selectedProject, setSelectedProject] = useState(null);
  const data = mapPortfolioToTemplateData(portfolio);
  const expList = ec ? (portfolio.experiences || []) : data.experience;
  const projList = ec ? (portfolio.experiences || []) : data.projects;
  const eduList = ec ? (portfolio.education || []) : data.education;
  const awardList = ec ? (portfolio.awards || []) : data.awards;
  const skillList = ec ? buildEditSkillList(portfolio) : data.skills;
  const contact = ec ? (portfolio.contact || {}) : { email: data.email, phone: data.phone, instagram: data.social?.instagram };
  const { dragProps: dp, gripProps: gp } = makeSectionOrderUtils(portfolio, ec, ['education', 'experiences', 'projects', 'awards', 'skills', 'contact']);
  const hidden3 = ec ? (ec.hiddenSections || []) : (portfolio.hiddenSections || []);
  const isHidden3 = (key) => hidden3.includes(key);
  return (
    <div className="min-h-screen bg-[#f9f9f9] pb-32">
      <div className="w-full mb-8"></div>
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-8">
            {ec ? <EditText value={portfolio.userName} onChange={v => ec.update('userName', v)} placeholder="이름" className="text-3xl font-bold" /> : data.name} 포트폴리오
          </h1>
          <div className="flex flex-col md:flex-row items-center gap-8 justify-center">
            {/* Profile Image */}
            <ImageUploadSlot src={ec ? portfolio.profileImageUrl : null} onUpload={ec?.onUploadProfileImage} className="w-32 h-32 rounded-full overflow-hidden bg-pink-100 shadow-sm flex-shrink-0" imgClassName="w-full h-full object-cover" rounded="rounded-full">
              <div className="w-32 h-32 bg-pink-100 rounded-full flex items-center justify-center shadow-sm"><UserCircle2 className="w-16 h-16 text-pink-300" /></div>
            </ImageUploadSlot>
            {!isHidden3('contact') && <div className="text-left border border-gray-200 p-6 rounded-lg shadow-sm w-full md:w-[400px] relative group/section" {...(ec ? dp('contact') : {})}>
              {ec && <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity"><span {...gp('contact')}><GripVertical size={14} className="text-gray-400 cursor-grab" /></span><SectionDeleteBtn ec={ec} sectionKey="contact" /></div>}
              {ec
                ? <EditText value={portfolio.greeting || `안녕하세요! ${portfolio.userName || ''}입니다.`} onChange={v => ec.update('greeting', v)} placeholder="인사말" className="font-bold text-lg mb-2 block" />
                : <h3 className="font-bold text-lg mb-2">{data.greeting || `안녕하세요! ${data.name}입니다.`}</h3>
              }
              {ec
                ? <EditTextarea value={portfolio.about} onChange={v => ec.update('about', v)} className="text-sm text-gray-500 mb-4" />
                : <p className="text-sm text-gray-500 mb-4 line-clamp-2">{data.title}<br />{data.about.split('\n')[0]}</p>
              }
              <h4 className="font-bold text-sm mb-2 border-b pb-1">contact</h4>
              <div className="space-y-1 text-xs text-gray-600">
                {ec ? (
                  <>
                    <div className="flex items-center gap-2"><Phone className="w-3 h-3"/><input value={contact.phone || ''} onChange={e => ec.updateNested('contact','phone',e.target.value)} placeholder="전화번호" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-200 focus:border-gray-500" /></div>
                    <div className="flex items-center gap-2"><Mail className="w-3 h-3"/><input value={contact.email || ''} onChange={e => ec.updateNested('contact','email',e.target.value)} placeholder="이메일" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-200 focus:border-gray-500" /></div>
                    <div className="flex items-center gap-2"><Instagram className="w-3 h-3"/><input value={contact.instagram || ''} onChange={e => ec.updateNested('contact','instagram',e.target.value)} placeholder="Instagram" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-200 focus:border-gray-500" /></div>
                    <div className="flex items-center gap-2"><MapPin className="w-3 h-3"/><input value={portfolio.location || ''} onChange={e => ec.update('location',e.target.value)} placeholder="위치" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-200 focus:border-gray-500" /></div>
                  </>
                ) : (
                  <>
                    {data.phone && <p className="flex items-center gap-2"><Phone className="w-3 h-3"/> {data.phone}</p>}
                    {data.email && <p className="flex items-center gap-2"><Mail className="w-3 h-3"/> {data.email}</p>}
                    {data.social.instagram && <p className="flex items-center gap-2"><Instagram className="w-3 h-3"/> {data.social.instagram}</p>}
                    {data.location && <p className="flex items-center gap-2"><MapPin className="w-3 h-3"/> {data.location}</p>}
                  </>
                )}
              </div>
            </div>}
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-pink-200 via-purple-200 to-blue-200 w-full mb-12 opacity-50"></div>
        {/* Reorderable sections */}
        <div className="flex flex-col">
        {!isHidden3('education') && (ec ? eduList.length > 0 : data.education.length > 0) && (
          <div className="mb-12 group/section" {...dp('education')}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold"><EH ec={ec} value="Education" sectionKey="education" /></h2>
              <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="education" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('education')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="education" /></div>
            </div>
            <DatabaseHeader />
            <div className="space-y-3">
              {eduList.map((edu, idx) => (
                <div key={idx} className="flex items-center gap-4 hover:bg-gray-50 p-1 rounded relative group">
                  {ec && <RemoveBtn onClick={() => ec.removeFromArray('education', idx)} />}
                  {ec
                    ? <EditText value={edu.period || ''} onChange={v => ec.updateArrayItem('education', idx, { period: v })} className="text-sm text-gray-500 w-40" placeholder="기간" />
                    : <span className="text-sm text-gray-500 w-40">{edu.period}</span>
                  }
                  <span className="font-bold text-sm">▶ {ec
                    ? <><EditText value={edu.name || edu.school || ''} onChange={v => ec.updateArrayItem('education', idx, { name: v })} className="font-bold text-sm" placeholder="학교" /> <EditText value={edu.degree || edu.major || ''} onChange={v => ec.updateArrayItem('education', idx, { degree: v })} className="text-sm" placeholder="전공" /></>
                    : <>{edu.school} {edu.major}</>
                  }</span>
                </div>
              ))}
            </div>
            {ec && (
              <button type="button" onClick={() => ec.addToArray('education', { name: '', degree: '', period: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors mt-3">
                <Plus size={12} /> 학력 추가
              </button>
            )}
          </div>
        )}
        {!isHidden3('experiences') && (ec ? true : data.experience.length > 0) && (
          <div className="mb-12 group/section" {...dp('experiences')}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold"><EH ec={ec} value="Experiences" sectionKey="experiences" /></h2>
              <div className="flex items-center gap-1">{ec && <span {...gp('experiences')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="experiences" /></div>
            </div>
            <DatabaseHeader />
            <ExperienceTimeline expList={expList} ec={ec} accentDot="bg-purple-500" />
          </div>
        )}
        {!isHidden3('projects') && <div className="mb-12 group/section" {...dp('projects')}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold"><EH ec={ec} value="Project" sectionKey="projects" /></h2>
            <div className="flex items-center gap-1">{ec && <span {...gp('projects')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="projects" /></div>
          </div>
          <DatabaseHeader />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {projList.map((proj, idx) => (
              <div key={idx} onClick={() => ec ? ec.onOpenExpDetail(proj, idx) : setSelectedProject(proj)} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white group hover:border-gray-300 transition-colors relative cursor-pointer">
                {ec && <RemoveBtn onClick={() => ec.removeFromArray('experiences', idx)} />}
                <div className={`h-40 ${proj.img || 'bg-blue-50'} overflow-hidden relative`}>
                  <ImageUploadSlot src={proj.thumbnailUrl} onUpload={null} className={`h-40 ${proj.img || 'bg-blue-50'} overflow-hidden`} imgClassName="w-full h-40 object-cover" rounded="">
                    <div className={`h-40 ${proj.img || 'bg-blue-50'} flex items-center justify-center text-gray-600/50 text-xs font-bold`}>{proj.name || proj.company || proj.title}</div>
                  </ImageUploadSlot>
                  <CameraUploadBtn onUpload={ec ? f => ec.onUploadExpImage(f, idx) : null} />
                </div>
                <div className="p-4">
                  {ec
                    ? <EditText value={proj.company || proj.title || proj.name || ''} onChange={v => ec.updateArrayItem('experiences', idx, { company: v, title: v })} className="font-bold mb-1 block" placeholder="프로젝트명" />
                    : <h3 className="font-bold mb-1">{proj.name}</h3>
                  }
                  <p className="text-xs text-gray-400 mb-2">{proj.period}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${proj.tagColor || 'bg-blue-100 text-blue-700'}`}>{proj.tag || 'Project'}</span>
                  {ec
                    ? <EditText value={proj.description || proj.desc || ''} onChange={v => ec.updateArrayItem('experiences', idx, { description: v })} className="text-xs text-gray-500 mt-2 block" placeholder="설명" />
                    : <p className="text-xs text-gray-500 mt-2 line-clamp-1">{proj.desc || proj.description}</p>
                  }
                </div>
              </div>
            ))}
          </div>
          {ec && <ExpControls ec={ec} />}
        </div>}{/* end projects */}
        <div className="h-1 bg-gradient-to-r from-pink-200 via-purple-200 to-blue-200 w-full mb-12 opacity-50"></div>
        {/* Awards */}
        {!isHidden3('awards') && (awardList.length > 0 || ec) && (
          <div className="mb-12 group/section" {...dp('awards')}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold"><EH ec={ec} value="Awards" sectionKey="awards" /></h2>
              <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="awards" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('awards')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="awards" /></div>
            </div>
            <DatabaseHeader />
            <div className="space-y-3">
              {awardList.map((award, idx) => (
                <div key={idx} className="flex items-center gap-4 hover:bg-gray-50 p-1 rounded relative group">
                  {ec && <RemoveBtn onClick={() => ec.removeFromArray('awards', idx)} />}
                  {ec ? <EditText value={award.date || ''} onChange={v => ec.updateArrayItem('awards', idx, { date: v })} className="text-sm text-gray-500 w-32" placeholder="날짜" /> : <span className="text-sm text-gray-500 w-32">{award.date}</span>}
                  <span className="font-bold text-sm">▶ {ec ? <EditText value={award.title || ''} onChange={v => ec.updateArrayItem('awards', idx, { title: v })} className="font-bold text-sm" placeholder="수상명" /> : award.title}</span>
                </div>
              ))}
            </div>
            {ec && <button type="button" onClick={() => ec.addToArray('awards', { title: '', date: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors mt-3"><Plus size={12} /> 수상 추가</button>}
          </div>
        )}
        {!isHidden3('skills') && <div className="mb-12 group/section" {...dp('skills')}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold"><EH ec={ec} value="Skill" sectionKey="skills" /></h2>
            <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="skills" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('skills')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="skills" /></div>
          </div>
          <DatabaseHeader />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {skillList.map((skill, idx) => (
              <div key={idx} className="border border-gray-200 rounded-md p-3 shadow-sm bg-white relative group">
                {ec && <RemoveBtn onClick={() => {
                  const cat = skill.category || 'tools';
                  const arr = [...(portfolio.skills?.[cat] || [])];
                  const ni = arr.indexOf(skill.name); if (ni > -1) arr.splice(ni, 1);
                  ec.update('skills', { ...portfolio.skills, [cat]: arr });
                }} />}
                <div className="flex items-center justify-between mb-2">
                  <SkillTooltipBadge skill={skill} ec={ec} plain levelMode="bar" />
                  <span className="text-xs text-gray-400">{skill.percent}</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full" style={{ width: skill.percent }}></div>
                </div>
              </div>
            ))}
          </div>
          <SkillsEditorPanel portfolio={portfolio} ec={ec} />
        </div>}{/* end skills */}
        </div>{/* end flex col reorderable sections */}
        {ec && (ec.hiddenSections || []).length > 0 && (
          <div className="mt-4 mb-8">
            <div className="border border-dashed border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-3">숨긴 섹션 복원</p>
              <div className="flex flex-wrap gap-2">
                {(ec.hiddenSections || []).map(key => (
                  <button key={key} type="button" onClick={() => ec.showSection(key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-50 text-gray-500 border border-gray-200 hover:border-primary-400 hover:text-primary-400 transition-colors">
                    <Plus size={11} /> {key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col md:flex-row items-center gap-6 justify-center mt-20 mb-10">
          <ImageUploadSlot src={ec ? portfolio.profileImageUrl : null} onUpload={ec?.onUploadProfileImage} className="w-24 h-24 rounded-full overflow-hidden bg-pink-100 shadow-sm flex-shrink-0" imgClassName="w-full h-full object-cover" rounded="rounded-full">
            <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center shadow-sm"><UserCircle2 className="w-12 h-12 text-pink-300" /></div>
          </ImageUploadSlot>
          <div className="border border-yellow-200 bg-yellow-50/50 p-6 rounded-lg w-full md:w-[400px]">
            <h4 className="font-bold mb-1 flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500 fill-yellow-500"/> 좋은 인연으로 함께 일하고 싶습니다</h4>
            <p className="text-xs text-gray-500 mb-4 ml-6">감사합니다 :)</p>
            <div className="space-y-1 text-sm text-gray-700 ml-6">
              {ec ? (
                <>
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4"/><input value={contact.phone || ''} onChange={e => ec.updateNested('contact','phone',e.target.value)} placeholder="전화번호" className="flex-1 outline-none bg-transparent border-b border-dashed border-yellow-300 focus:border-yellow-500 text-sm" /></div>
                  <div className="flex items-center gap-2"><Mail className="w-4 h-4"/><input value={contact.email || ''} onChange={e => ec.updateNested('contact','email',e.target.value)} placeholder="이메일" className="flex-1 outline-none bg-transparent border-b border-dashed border-yellow-300 focus:border-yellow-500 text-sm" /></div>
                </>
              ) : (
                <>
                  {data.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4"/> {data.phone}</p>}
                  {data.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4"/> {data.email}</p>}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="h-4 bg-gradient-to-r from-pink-200 via-purple-200 to-blue-200 w-full mt-8 opacity-50"></div>
      <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </div>
  );
};

// ── 템플릿 4: 문제해결 중심형 ──
export const VisualTemplate4 = ({ portfolio, ec }) => {
  const [selectedProject, setSelectedProject] = useState(null);
  const data = mapPortfolioToTemplateData(portfolio);
  const expList = ec ? (portfolio.experiences || []) : data.experience;
  const projList = ec ? (portfolio.experiences || []) : data.projects;
  const skillList = ec ? buildEditSkillList(portfolio) : data.skills;
  const eduList = ec ? (portfolio.education || []) : data.education;
  const awardList = ec ? (portfolio.awards || []) : data.awards;
  const contact = ec ? (portfolio.contact || {}) : { phone: data.phone, email: data.email, github: data.social?.github, website: data.social?.blog };
  const { dragProps: dp, gripProps: gp } = makeSectionOrderUtils(portfolio, ec, ['contact', 'experiences', 'projects', 'education', 'awards', 'skills']);
  const hidden4 = ec ? (ec.hiddenSections || []) : (portfolio.hiddenSections || []);
  const isHidden4 = (key) => hidden4.includes(key);
  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#37352f] font-sans pt-10 pb-32">
      <div className="max-w-4xl mx-auto px-6">
        <header className="mb-12 flex flex-col md:flex-row md:items-start gap-6">
          <ImageUploadSlot src={ec ? portfolio.profileImageUrl : null} onUpload={ec?.onUploadProfileImage} className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm" imgClassName="w-full h-full object-cover" rounded="rounded-2xl">
            <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center shadow-sm"><UserCircle2 className="w-12 h-12 text-gray-400" /></div>
          </ImageUploadSlot>
          <div className="flex-1">
            <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
              {ec ? <EditText value={portfolio.userName} onChange={v => ec.update('userName', v)} placeholder="이름" className="text-4xl font-extrabold" /> : data.name}
            </h1>
            <p className="text-xl text-gray-500 font-medium mb-8">
              {ec ? <EditText value={portfolio.headline} onChange={v => ec.update('headline', v)} placeholder="헤드라인" className="text-xl text-gray-500 font-medium" /> : data.title}
            </p>
            <div className="bg-[#f7f6f3] border border-gray-200 rounded-lg p-5 flex items-start gap-4">
              <div className="flex-1">
                {ec
                  ? <EditTextarea value={portfolio.about} onChange={v => ec.update('about', v)} className="text-gray-600 text-sm leading-relaxed" />
                  : <><p className="font-bold text-lg mb-1">{data.catchphrase}</p><p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{data.about}</p></>
                }
              </div>
            </div>
          </div>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-10">
            {!isHidden4('contact') && <section className="group/section" {...dp('contact')}>
              <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2 mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2"><Mail className="w-5 h-5 text-gray-400" /> Contact</h2>
                <div className="flex items-center gap-1">{ec && <span {...gp('contact')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="contact" /></div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                {ec ? (
                  <>
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4 flex-shrink-0"/><input value={contact.phone || ''} onChange={e => ec.updateNested('contact','phone',e.target.value)} placeholder="전화번호" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-primary-400 text-sm" /></div>
                    <div className="flex items-center gap-2"><Mail className="w-4 h-4 flex-shrink-0"/><input value={contact.email || ''} onChange={e => ec.updateNested('contact','email',e.target.value)} placeholder="이메일" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-primary-400 text-sm" /></div>
                    <div className="flex items-center gap-2"><Globe className="w-4 h-4 flex-shrink-0"/><input value={contact.github || ''} onChange={e => ec.updateNested('contact','github',e.target.value)} placeholder="GitHub" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-primary-400 text-sm" /></div>
                    <div className="flex items-center gap-2"><ExternalLink className="w-4 h-4 flex-shrink-0"/><input value={contact.website || ''} onChange={e => ec.updateNested('contact','website',e.target.value)} placeholder="웹사이트" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-primary-400 text-sm" /></div>
                  </>
                ) : (
                  <>
                    {data.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4"/> {data.phone}</p>}
                    {data.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4"/> {data.email}</p>}
                    {data.social?.blog && <p className="flex items-center gap-2"><ExternalLink className="w-4 h-4"/> {data.social.blog}</p>}
                  </>
                )}
              </div>
            </section>}
            {!isHidden4('education') && (ec ? true : eduList.length > 0) && (
              <section className="group/section">
                <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2 mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2"><GraduationCap className="w-5 h-5 text-gray-400" /> <EH ec={ec} value="Education" sectionKey="education" /></h2>
                  <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="education" jobAnalysis={ec.jobAnalysis} />}<SectionDeleteBtn ec={ec} sectionKey="education" /></div>
                </div>
                <div className="space-y-3">
                  {eduList.map((edu, idx) => (
                    <div key={idx} className="relative group">
                      {ec && <RemoveBtn onClick={() => ec.removeFromArray('education', idx)} />}
                      {ec
                        ? <EditText value={edu.school || ''} onChange={v => ec.updateArrayItem('education', idx, { school: v })} className="font-semibold text-sm text-gray-900 block" placeholder="학교명" />
                        : <p className="font-semibold text-sm text-gray-900">{edu.school}</p>
                      }
                      {ec
                        ? <EditText value={edu.major || edu.degree || ''} onChange={v => ec.updateArrayItem('education', idx, { major: v })} className="text-xs text-gray-500 block" placeholder="전공/학위" />
                        : <p className="text-xs text-gray-500">{edu.major || edu.degree}</p>
                      }
                    </div>
                  ))}
                </div>
                {ec && <button type="button" onClick={() => ec.addToArray('education', { school: '', major: '', period: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-primary-400 hover:text-primary-400 transition-colors mt-3"><Plus size={12}/> 학력 추가</button>}
              </section>
            )}
            {!isHidden4('awards') && (ec ? true : awardList.length > 0) && (
              <section className="group/section">
                <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2 mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2"><Award className="w-5 h-5 text-gray-400" /> <EH ec={ec} value="Awards" sectionKey="awards" /></h2>
                  <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="awards" jobAnalysis={ec.jobAnalysis} />}<SectionDeleteBtn ec={ec} sectionKey="awards" /></div>
                </div>
                <div className="space-y-2">
                  {awardList.map((award, idx) => (
                    <div key={idx} className="relative group">
                      {ec && <RemoveBtn onClick={() => ec.removeFromArray('awards', idx)} />}
                      {ec
                        ? <EditText value={award.title || ''} onChange={v => ec.updateArrayItem('awards', idx, { title: v })} className="text-sm text-gray-800 font-medium block" placeholder="수상명" />
                        : <p className="text-sm text-gray-800 font-medium">{award.title}</p>
                      }
                      {ec
                        ? <EditText value={award.date || ''} onChange={v => ec.updateArrayItem('awards', idx, { date: v })} className="text-xs text-gray-500 block" placeholder="날짜" />
                        : <p className="text-xs text-gray-500">{award.date}</p>
                      }
                    </div>
                  ))}
                </div>
                {ec && <button type="button" onClick={() => ec.addToArray('awards', { title: '', date: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-primary-400 hover:text-primary-400 transition-colors mt-3"><Plus size={12}/> 수상 추가</button>}
              </section>
            )}
            {!isHidden4('skills') && <section className="group/section">
              <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2 mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2"><Target className="w-5 h-5 text-gray-400" /> <EH ec={ec} value="Tools & Skills" sectionKey="skills" /></h2>
                <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="skills" jobAnalysis={ec.jobAnalysis} />}<SectionDeleteBtn ec={ec} sectionKey="skills" /></div>
              </div>
              <div className="space-y-4">
                {skillList.map((skill, idx) => (
                  <div key={idx} className="bg-white border border-gray-100 p-3 rounded shadow-sm relative group">
                    {ec && <RemoveBtn onClick={() => {
                      const cat = skill.category || 'tools';
                      const arr = [...(portfolio.skills?.[cat] || [])];
                      const nameIdx = arr.indexOf(skill.name);
                      if (nameIdx > -1) arr.splice(nameIdx, 1);
                      ec.update('skills', { ...portfolio.skills, [cat]: arr });
                    }} />}
                    <div className="flex items-center gap-2 mb-2">
                      <SkillTooltipBadge skill={skill} ec={ec} levelMode="blocks" badgeClassName="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded" />
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{skill.desc}</p>
                  </div>
                ))}
              </div>
              <SkillsEditorPanel portfolio={portfolio} ec={ec} />
            </section>}
          </div>
          <div className="lg:col-span-2 space-y-12">
            {!isHidden4('experiences') && <section className="group/section" {...dp('experiences')}>
              <div className="flex items-center justify-between gap-2 mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="w-6 h-6 text-gray-800" /> <EH ec={ec} value="Core Experience" sectionKey="experiences" /></h2>
                <div className="flex items-center gap-1">{ec && <span {...gp('experiences')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="experiences" /></div>
              </div>
              <ExperienceTimeline expList={expList} ec={ec} accentDot="bg-blue-500" />
            </section>}
            {!isHidden4('projects') && <section className="group/section" {...dp('projects')}>
              <div className="flex items-center justify-between gap-2 mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2"><Folder className="w-6 h-6 text-gray-800" /> <EH ec={ec} value="Projects" sectionKey="projects" /></h2>
                <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="projects" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('projects')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="projects" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projList.map((proj, idx) => (
                  <div key={idx} onClick={() => ec ? ec.onOpenExpDetail(proj, idx) : setSelectedProject(proj)} className="group bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col relative">
                    {ec && <RemoveBtn onClick={() => ec.removeFromArray('experiences', idx)} />}
                    <div className="h-32 w-full overflow-hidden bg-blue-50 relative">
                      <ImageUploadSlot src={proj.thumbnailUrl} onUpload={null} className="h-32 w-full overflow-hidden bg-blue-50" imgClassName="w-full h-full object-cover" rounded="">
                        <div className={`h-32 ${proj.img || 'bg-blue-50'} w-full flex items-center justify-center overflow-hidden`}>
                          <div className="text-gray-400 text-sm font-bold opacity-50">{proj.name || proj.company || '프로젝트'}</div>
                        </div>
                      </ImageUploadSlot>
                      <CameraUploadBtn onUpload={ec ? f => ec.onUploadExpImage(f, idx) : null} />
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      {ec
                        ? <EditText value={proj.company || proj.title || proj.name || ''} onChange={v => ec.updateArrayItem('experiences', idx, { company: v, title: v })} className="font-bold text-gray-900 block mb-1" placeholder="프로젝트명" />
                        : <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">{proj.name}</h3>
                      }
                      <p className="text-xs text-gray-400 mb-3">{proj.period}</p>
                      {ec
                        ? <EditText value={proj.description || proj.desc || ''} onChange={v => ec.updateArrayItem('experiences', idx, { description: v })} className="text-sm text-gray-600 mb-4 flex-1 block" placeholder="설명" />
                        : <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-1">{proj.desc}</p>
                      }
                      <span className={`text-[10px] px-2 py-1 rounded font-medium ${proj.tagColor || 'bg-blue-100 text-blue-700'}`}>{proj.tag || 'Project'}</span>
                    </div>
                  </div>
                ))}
              </div>
              {ec && <ExpControls ec={ec} />}
            </section>}
          </div>
        </div>
        {ec && (ec.hiddenSections || []).length > 0 && (
          <div className="mt-8 mb-4">
            <div className="border border-dashed border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-3">숨긴 섹션 복원</p>
              <div className="flex flex-wrap gap-2">
                {(ec.hiddenSections || []).map(key => (
                  <button key={key} type="button" onClick={() => ec.showSection(key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-50 text-gray-500 border border-gray-200 hover:border-primary-400 hover:text-primary-400 transition-colors">
                    <Plus size={11} /> {key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </div>
  );
};

// ── 템플릿 5: 프로필 링크형 ──
export const VisualTemplate5 = ({ portfolio, ec }) => {
  const [selectedProject, setSelectedProject] = useState(null);
  const data = mapPortfolioToTemplateData(portfolio);
  const expList = ec ? (portfolio.experiences || []) : data.experience;
  const projList = ec ? (portfolio.experiences || []) : data.projects;
  const skillList = ec ? buildEditSkillList(portfolio) : data.skills;
  const eduList = ec ? (portfolio.education || []) : data.education;
  const awardList = ec ? (portfolio.awards || []) : data.awards;
  const contact = ec ? (portfolio.contact || {}) : { phone: data.phone, email: data.email, github: data.social?.github, website: data.social?.blog };
  const { dragProps: dp, gripProps: gp } = makeSectionOrderUtils(portfolio, ec, ['projects', 'experiences', 'skills', 'education', 'awards', 'contact']);
  const hidden5 = ec ? (ec.hiddenSections || []) : (portfolio.hiddenSections || []);
  const isHidden5 = (key) => hidden5.includes(key);
  return (
    <div className="min-h-screen bg-[#F7F6F3] py-12 flex justify-center">
      <div className="w-full max-w-lg px-6 flex flex-col items-center">
        <ImageUploadSlot src={ec ? portfolio.profileImageUrl : null} onUpload={ec?.onUploadProfileImage} className="w-28 h-28 rounded-full overflow-hidden bg-white border border-gray-200 shadow-sm mb-6 flex-shrink-0" imgClassName="w-full h-full object-cover" rounded="rounded-full">
          <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-200"><UserCircle2 className="w-14 h-14 text-gray-300" /></div>
        </ImageUploadSlot>
        <h1 className="text-3xl font-extrabold mb-2 text-center">
          {ec ? <EditText value={portfolio.userName} onChange={v => ec.update('userName', v)} placeholder="이름" className="text-3xl font-extrabold" /> : data.name}
        </h1>
        <p className="text-gray-500 font-medium mb-6 text-center">
          {ec ? <EditText value={portfolio.headline} onChange={v => ec.update('headline', v)} placeholder="헤드라인" className="text-gray-500 font-medium" /> : data.title}
        </p>
        {!isHidden5('contact') && <div className="w-full grid grid-cols-3 gap-3 mb-10 group/section relative" {...(ec ? dp('contact') : {})}>
          {ec && <div className="absolute -top-5 right-0 flex items-center gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity"><span {...gp('contact')}><GripVertical size={14} className="text-gray-400 cursor-grab" /></span><SectionDeleteBtn ec={ec} sectionKey="contact" /></div>}
          {ec ? (
            <>
              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                <Mail className="w-5 h-5 mb-1 text-blue-500"/>
                <input value={contact.email || ''} onChange={e => ec.updateNested('contact','email',e.target.value)} placeholder="이메일" className="text-xs font-bold text-gray-700 text-center outline-none bg-transparent w-full" />
              </div>
              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                <Phone className="w-5 h-5 mb-1 text-green-500"/>
                <input value={contact.phone || ''} onChange={e => ec.updateNested('contact','phone',e.target.value)} placeholder="전화번호" className="text-xs font-bold text-gray-700 text-center outline-none bg-transparent w-full" />
              </div>
              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                <Globe className="w-5 h-5 mb-1 text-pink-500"/>
                <input value={contact.github || ''} onChange={e => ec.updateNested('contact','github',e.target.value)} placeholder="GitHub" className="text-xs font-bold text-gray-700 text-center outline-none bg-transparent w-full" />
              </div>
            </>
          ) : (
            [['Email', Mail, 'blue-500', data.email], ['Phone', Phone, 'green-500', data.phone], ['GitHub', Globe, 'pink-500', data.social?.github]].map(([label, Icon, color, val]) => (
              val ? <div key={label} className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
                <Icon className={`w-5 h-5 mb-1 text-${color}`}/>
                <span className="text-xs font-bold text-gray-700">{label}</span>
              </div> : null
            ))
          )}
        </div>}
        <div className="w-full bg-white border border-gray-200 p-5 rounded-xl shadow-sm mb-10">
          {ec
            ? <EditTextarea value={portfolio.about} onChange={v => ec.update('about', v)} className="text-sm text-gray-700 leading-relaxed font-medium" />
            : <p className="text-sm text-gray-700 leading-relaxed font-medium">
                {data.catchphrase}<br/><br/>
                <span className="text-gray-500 font-normal whitespace-pre-wrap">{data.about}</span>
              </p>
          }
        </div>
        {!isHidden5('projects') && <div className="w-full mb-10" {...dp('projects')}>
          <div className="flex items-center justify-between gap-3 mb-4 group/section">
            <h2 className="text-xl font-bold flex items-center gap-2"><Folder className="w-5 h-5 text-gray-800" /> <EH ec={ec} value="Selected Projects" sectionKey="projects" /></h2>
            <div className="flex items-center gap-1">{ec && <span {...gp('projects')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="projects" /></div>
          </div>
          <div className="space-y-4">
            {projList.map((proj, idx) => (
              <div key={idx} onClick={() => ec ? ec.onOpenExpDetail(proj, idx) : setSelectedProject(proj)} className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4 relative group">
                {ec && <RemoveBtn onClick={() => ec.removeFromArray('experiences', idx)} />}
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-blue-50 flex-shrink-0 border border-gray-100 relative">
                  <ImageUploadSlot src={proj.thumbnailUrl} onUpload={null} className="w-16 h-16 rounded-lg overflow-hidden bg-blue-50 flex-shrink-0 border border-gray-100" imgClassName="w-full h-full object-cover" rounded="rounded-lg">
                    <div className={`w-16 h-16 rounded-lg ${proj.img || 'bg-blue-50'} flex-shrink-0 border border-gray-100`}></div>
                  </ImageUploadSlot>
                  <CameraUploadBtn onUpload={ec ? f => ec.onUploadExpImage(f, idx) : null} className="bottom-0.5 right-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  {ec
                    ? <EditText value={proj.company || proj.title || proj.name || ''} onChange={v => ec.updateArrayItem('experiences', idx, { company: v, title: v })} className="font-bold text-gray-900 block" placeholder="프로젝트명" />
                    : <h3 className="font-bold text-gray-900 truncate">{proj.name}</h3>
                  }
                  <p className="text-xs text-gray-400 mb-1">{proj.period}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${proj.tagColor || 'bg-blue-100 text-blue-700'}`}>{proj.tag || 'Project'}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            ))}
          </div>
          {ec && <ExpControls ec={ec} />}
        </div>}{/* end projects */}
        {!isHidden5('experiences') && <div className="w-full mb-10" {...dp('experiences')}>
          <div className="flex items-center justify-between gap-3 mb-4 group/section">
            <h2 className="text-xl font-bold flex items-center gap-2"><Briefcase className="w-5 h-5 text-gray-800" /> <EH ec={ec} value="Experience" sectionKey="experiences" /></h2>
            <div className="flex items-center gap-1">{ec && <span {...gp('experiences')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="experiences" /></div>
          </div>
          <ExperienceTimeline expList={expList} ec={ec} />
        </div>}
        {!isHidden5('skills') && (ec ? true : skillList.length > 0) && (
          <div className="w-full mb-10" {...dp('skills')}>
            <div className="flex items-center justify-between gap-2 mb-4 group/section">
              <h2 className="text-xl font-bold flex items-center gap-2"><Target className="w-5 h-5 text-gray-800" /> <EH ec={ec} value="Skills" sectionKey="skills" /></h2>
              <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="skills" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('skills')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="skills" /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {skillList.map((skill, idx) => (
                <div key={idx} className="relative group">
                  {ec && <RemoveBtn onClick={() => {
                    const cat = skill.category || 'tools';
                    const arr = [...(portfolio.skills?.[cat] || [])];
                    const ni = arr.indexOf(skill.name); if (ni > -1) arr.splice(ni, 1);
                    ec.update('skills', { ...portfolio.skills, [cat]: arr });
                  }} />}
                  <SkillTooltipBadge skill={skill} ec={ec} levelMode="blocks" badgeClassName="px-3 py-1.5 bg-white rounded-lg text-sm font-medium text-gray-800 shadow-sm border border-gray-200" />
                </div>
              ))}
            </div>
            <SkillsEditorPanel portfolio={portfolio} ec={ec} />
          </div>
        )}
        {!isHidden5('education') && (ec ? true : eduList.length > 0) && (
          <div className="w-full mb-10" {...dp('education')}>
            <div className="flex items-center justify-between gap-3 mb-4 group/section">
              <h2 className="text-xl font-bold flex items-center gap-2"><GraduationCap className="w-5 h-5 text-gray-800" /> <EH ec={ec} value="Education" sectionKey="education" /></h2>
              <div className="flex items-center gap-1">{ec && <span {...gp('education')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="education" /></div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {eduList.map((edu, idx) => (
                <div key={idx} className="p-4 border-b border-gray-100 last:border-0 relative group">
                  {ec && <RemoveBtn onClick={() => ec.removeFromArray('education', idx)} />}
                  {ec
                    ? <EditText value={edu.school || ''} onChange={v => ec.updateArrayItem('education', idx, { school: v })} className="font-bold text-gray-900 block" placeholder="학교명" />
                    : <h3 className="font-bold text-gray-900">{edu.school}</h3>
                  }
                  {ec
                    ? <EditText value={edu.major || edu.degree || ''} onChange={v => ec.updateArrayItem('education', idx, { major: v })} className="text-sm text-blue-600 font-medium block" placeholder="전공/학위" />
                    : <p className="text-sm text-blue-600 font-medium">{edu.major || edu.degree}</p>
                  }
                </div>
              ))}
            </div>
            {ec && <button type="button" onClick={() => ec.addToArray('education', { school: '', major: '', period: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-primary-400 hover:text-primary-400 transition-colors mt-3"><Plus size={12}/> 학력 추가</button>}
          </div>
        )}
        {!isHidden5('awards') && (ec ? true : awardList.length > 0) && (
          <div className="w-full mb-10" {...dp('awards')}>
            <div className="flex items-center justify-between gap-2 mb-4 group/section">
              <h2 className="text-xl font-bold flex items-center gap-2"><Award className="w-5 h-5 text-gray-800" /> <EH ec={ec} value="Awards" sectionKey="awards" /></h2>
              <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="awards" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('awards')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="awards" /></div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {awardList.map((award, idx) => (
                <div key={idx} className="p-4 border-b border-gray-100 last:border-0 relative group">
                  {ec && <RemoveBtn onClick={() => ec.removeFromArray('awards', idx)} />}
                  {ec
                    ? <EditText value={award.title || ''} onChange={v => ec.updateArrayItem('awards', idx, { title: v })} className="font-bold text-gray-900 block" placeholder="수상명" />
                    : <h3 className="font-bold text-gray-900">{award.title}</h3>
                  }
                  {ec
                    ? <EditText value={award.date || ''} onChange={v => ec.updateArrayItem('awards', idx, { date: v })} className="text-xs text-gray-500 block" placeholder="날짜" />
                    : <p className="text-xs text-gray-500">{award.date}</p>
                  }
                </div>
              ))}
            </div>
            {ec && <button type="button" onClick={() => ec.addToArray('awards', { title: '', date: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-primary-400 hover:text-primary-400 transition-colors mt-3"><Plus size={12}/> 수상 추가</button>}
          </div>
        )}
        <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
        {ec && (ec.hiddenSections || []).length > 0 && (
          <div className="w-full mt-4 mb-10">
            <div className="border border-dashed border-gray-300 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-3">숨긴 섹션 복원</p>
              <div className="flex flex-wrap gap-2">
                {(ec.hiddenSections || []).map(key => (
                  <button key={key} type="button" onClick={() => ec.showSection(key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-50 text-gray-500 border border-gray-200 hover:border-primary-400 hover:text-primary-400 transition-colors">
                    <Plus size={11} /> {key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── 템플릿 6: 비주얼 갤러리형 ──
export const VisualTemplate6 = ({ portfolio, ec }) => {
  const [selectedProject, setSelectedProject] = useState(null);
  const data = mapPortfolioToTemplateData(portfolio);
  const expList = ec ? (portfolio.experiences || []) : data.experience;
  const projList = ec ? (portfolio.experiences || []) : data.projects;
  const skillList = ec ? buildEditSkillList(portfolio) : data.skills;
  const eduList = ec ? (portfolio.education || []) : data.education;
  const awardList = ec ? (portfolio.awards || []) : data.awards;
  const contact = ec ? (portfolio.contact || {}) : { phone: data.phone, email: data.email, github: data.social?.github, website: data.social?.blog };
  const { dragProps: dp6, gripProps: gp6 } = makeSectionOrderUtils(portfolio, ec, ['projects', 'experiences', 'education', 'awards', 'skills', 'contact']);
  const hidden6 = ec ? (ec.hiddenSections || []) : (portfolio.hiddenSections || []);
  const isHidden6 = (key) => hidden6.includes(key);
  return (
    <div className="min-h-screen bg-white text-[#37352f] font-sans pb-32">
      <ImageUploadSlot src={ec ? portfolio.coverImageUrl : null} onUpload={ec?.onUploadCoverImage} className="w-full h-[30vh] overflow-hidden" imgClassName="w-full h-full object-cover" rounded="">
        <div className="w-full h-[30vh] bg-gradient-to-r from-gray-900 to-gray-700 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20"></div>
          <h1 className="text-white/10 text-9xl font-black absolute tracking-tighter mix-blend-overlay">PORTFOLIO</h1>
          {ec && <span className="relative z-10 text-white/60 text-sm flex items-center gap-2"><Upload size={16}/> 커버 이미지 업로드</span>}
        </div>
      </ImageUploadSlot>
      <div className="max-w-6xl mx-auto px-6">
        <div className="relative -mt-16 mb-8 flex flex-col md:flex-row md:items-end gap-6">
          <ImageUploadSlot src={ec ? portfolio.profileImageUrl : null} onUpload={ec?.onUploadProfileImage} className="w-32 h-32 rounded-2xl overflow-hidden bg-white shadow-lg border-4 border-white z-10 relative flex-shrink-0" imgClassName="w-full h-full object-cover" rounded="rounded-2xl">
            <div className="w-32 h-32 bg-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white z-10 relative"><UserCircle2 className="w-16 h-16 text-gray-300" /></div>
          </ImageUploadSlot>
          <div className="pb-2">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
              {ec ? <EditText value={portfolio.userName} onChange={v => ec.update('userName', v)} placeholder="이름" className="text-4xl font-extrabold text-gray-900" /> : data.name}
            </h1>
            <p className="text-lg text-gray-500 font-medium">
              {ec ? <EditText value={portfolio.headline} onChange={v => ec.update('headline', v)} placeholder="헤드라인" className="text-lg text-gray-500 font-medium" /> : data.title}
            </p>
          </div>
        </div>
        {ec
          ? <EditTextarea value={portfolio.about} onChange={v => ec.update('about', v)} className="text-gray-700 text-lg leading-relaxed mb-12 max-w-2xl" />
          : <p className="text-gray-700 text-lg leading-relaxed mb-12 max-w-2xl">{data.catchphrase}<br/><span className="text-sm text-gray-500">{data.about.split('\n')[0]}</span></p>
        }
        {!isHidden6('projects') && <div className="mb-20 group/section" {...dp6('projects')}>
          <div className="flex items-center justify-between gap-3 mb-8">
            <h2 className="text-2xl font-bold border-b-2 border-gray-900 inline-block pb-2"><EH ec={ec} value="Featured Work" sectionKey="projects" /></h2>
            <div className="flex items-center gap-1">{ec && <span {...gp6('projects')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="projects" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {projList.map((proj, idx) => (
              <div key={idx} onClick={() => ec ? ec.onOpenExpDetail(proj, idx) : setSelectedProject(proj)} className="group cursor-pointer flex flex-col relative">
                {ec && <RemoveBtn onClick={() => ec.removeFromArray('experiences', idx)} />}
                <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden mb-4 shadow-sm border border-gray-100 relative">
                  <ImageUploadSlot src={proj.thumbnailUrl} onUpload={null} className="w-full aspect-[4/3] rounded-2xl overflow-hidden mb-4 shadow-sm border border-gray-100" imgClassName="w-full h-full object-cover" rounded="rounded-2xl">
                    <div className={`w-full aspect-[4/3] rounded-2xl ${proj.img || 'bg-blue-50'} overflow-hidden relative`}>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 bg-white text-black px-4 py-2 rounded-full text-sm font-bold transition-opacity shadow-lg transform translate-y-4 group-hover:translate-y-0 duration-300">View Project</span>
                      </div>
                    </div>
                  </ImageUploadSlot>
                  <CameraUploadBtn onUpload={ec ? f => ec.onUploadExpImage(f, idx) : null} />
                </div>
                <div>
                  <div className="flex justify-between items-start mb-1">
                    {ec
                      ? <EditText value={proj.company || proj.title || proj.name || ''} onChange={v => ec.updateArrayItem('experiences', idx, { company: v, title: v })} className="font-bold text-xl text-gray-900" placeholder="프로젝트명" />
                      : <h3 className="font-bold text-xl text-gray-900 group-hover:text-blue-600 transition-colors">{proj.name}</h3>
                    }
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-md font-medium inline-block mb-2 ${proj.tagColor || 'bg-blue-100 text-blue-700'}`}>{proj.tag || 'Project'}</span>
                  {ec
                    ? <EditText value={proj.description || proj.desc || ''} onChange={v => ec.updateArrayItem('experiences', idx, { description: v })} className="text-sm text-gray-500 block" placeholder="설명" />
                    : <p className="text-sm text-gray-500 line-clamp-2">{proj.desc}</p>
                  }
                </div>
              </div>
            ))}
          </div>
          {ec && <ExpControls ec={ec} />}
        </div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-gray-200">
          <div className="space-y-10">
            {!isHidden6('experiences') && <div className="group/section" {...dp6('experiences')}>
              <div className="flex items-center justify-between gap-3 mb-6">
                <h2 className="text-xl font-bold"><EH ec={ec} value="Experience" sectionKey="experiences" /></h2>
                <div className="flex items-center gap-1">{ec && <span {...gp6('experiences')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="experiences" /></div>
              </div>
              <ExperienceTimeline expList={expList} ec={ec} />
            </div>}
            {!isHidden6('education') && (ec ? true : eduList.length > 0) && (
              <div className="group/section" {...dp6('education')}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-xl font-bold"><EH ec={ec} value="Education" sectionKey="education" /></h2>
                  <div className="flex items-center gap-1">{ec && <span {...gp6('education')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="education" /></div>
                </div>
                <div className="space-y-3">
                  {eduList.map((edu, idx) => (
                    <div key={idx} className="flex gap-4 relative group">
                      {ec && <RemoveBtn onClick={() => ec.removeFromArray('education', idx)} />}
                      <div>
                        {ec
                          ? <EditText value={edu.school || ''} onChange={v => ec.updateArrayItem('education', idx, { school: v })} className="font-bold text-gray-900 block" placeholder="학교명" />
                          : <h3 className="font-bold text-gray-900">{edu.school}</h3>
                        }
                        {ec
                          ? <EditText value={edu.major || edu.degree || ''} onChange={v => ec.updateArrayItem('education', idx, { major: v })} className="text-sm text-gray-600 block" placeholder="전공/학위" />
                          : <p className="text-sm text-gray-600">{edu.major || edu.degree}</p>
                        }
                      </div>
                    </div>
                  ))}
                </div>
                {ec && <button type="button" onClick={() => ec.addToArray('education', { school: '', major: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-primary-400 hover:text-primary-400 transition-colors mt-3"><Plus size={12}/> 학력 추가</button>}
              </div>
            )}
            {!isHidden6('awards') && (ec ? true : awardList.length > 0) && (
              <div className="group/section" {...dp6('awards')}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-xl font-bold"><EH ec={ec} value="Awards" sectionKey="awards" /></h2>
                  <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="awards" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp6('awards')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="awards" /></div>
                </div>
                <div className="space-y-2">
                  {awardList.map((award, idx) => (
                    <div key={idx} className="flex gap-4 items-center relative group">
                      {ec && <RemoveBtn onClick={() => ec.removeFromArray('awards', idx)} />}
                      {ec
                        ? <EditText value={award.title || ''} onChange={v => ec.updateArrayItem('awards', idx, { title: v })} className="font-medium text-gray-900 flex-1" placeholder="수상명" />
                        : <span className="font-medium text-gray-900 flex-1">{award.title}</span>
                      }
                      {ec
                        ? <EditText value={award.date || ''} onChange={v => ec.updateArrayItem('awards', idx, { date: v })} className="text-sm text-gray-400 w-20" placeholder="날짜" />
                        : <span className="text-sm text-gray-400">{award.date}</span>
                      }
                    </div>
                  ))}
                </div>
                {ec && <button type="button" onClick={() => ec.addToArray('awards', { title: '', date: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-primary-400 hover:text-primary-400 transition-colors mt-3"><Plus size={12}/> 수상 추가</button>}
              </div>
            )}
          </div>
          {!isHidden6('skills') && <div className="space-y-10" {...dp6('skills')}>
            <div className="group/section">
              <div className="flex items-center justify-between gap-3 mb-6">
                <h2 className="text-xl font-bold"><EH ec={ec} value="Core Skills" sectionKey="skills" /></h2>
                <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="skills" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp6('skills')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="skills" /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {skillList.map((skill, idx) => (
                  <div key={idx} className="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-800 shadow-sm border border-gray-200 relative group">
                    {ec && <RemoveBtn onClick={() => {
                      const cat = skill.category || 'tools';
                      const arr = [...(portfolio.skills?.[cat] || [])];
                      const nameIdx = arr.indexOf(skill.name);
                      if (nameIdx > -1) arr.splice(nameIdx, 1);
                      ec.update('skills', { ...portfolio.skills, [cat]: arr });
                    }} />}
                    <SkillTooltipBadge skill={skill} ec={ec} levelMode="blocks" badgeClassName="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-800 shadow-sm border border-gray-200" />
                  </div>
                ))}
              </div>
              <SkillsEditorPanel portfolio={portfolio} ec={ec} />
            </div>
            {!isHidden6('contact') && <div className="group/section" {...dp6('contact')}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold">Contact</h2>
                <div className="flex items-center gap-1">{ec && <span {...gp6('contact')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="contact" /></div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                {ec ? (
                  <>
                    <div className="flex items-center gap-2"><Mail className="w-4 h-4 flex-shrink-0"/><input value={contact.email || ''} onChange={e => ec.updateNested('contact','email',e.target.value)} placeholder="이메일" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-primary-400 text-sm" /></div>
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4 flex-shrink-0"/><input value={contact.phone || ''} onChange={e => ec.updateNested('contact','phone',e.target.value)} placeholder="전화번호" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-primary-400 text-sm" /></div>
                    <div className="flex items-center gap-2"><Globe className="w-4 h-4 flex-shrink-0"/><input value={contact.github || ''} onChange={e => ec.updateNested('contact','github',e.target.value)} placeholder="GitHub" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-primary-400 text-sm" /></div>
                    <div className="flex items-center gap-2"><ExternalLink className="w-4 h-4 flex-shrink-0"/><input value={contact.website || ''} onChange={e => ec.updateNested('contact','website',e.target.value)} placeholder="웹사이트" className="flex-1 outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-primary-400 text-sm" /></div>
                  </>
                ) : (
                  <>
                    {data.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4"/> {data.email}</p>}
                    {data.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4"/> {data.phone}</p>}
                    {data.social?.github && <p className="flex items-center gap-2"><Globe className="w-4 h-4"/> {data.social.github}</p>}
                    {data.social?.blog && <p className="flex items-center gap-2"><ExternalLink className="w-4 h-4"/> {data.social.blog}</p>}
                  </>
                )}
              </div>
            </div>}
          </div>}
        </div>
        {ec && (ec.hiddenSections || []).length > 0 && (
          <div className="mt-8 mb-4">
            <div className="border border-dashed border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-3">숨긴 섹션 복원</p>
              <div className="flex flex-wrap gap-2">
                {(ec.hiddenSections || []).map(key => (
                  <button key={key} type="button" onClick={() => ec.showSection(key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-50 text-gray-500 border border-gray-200 hover:border-primary-400 hover:text-primary-400 transition-colors">
                    <Plus size={11} /> {key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </div>
  );
};

// ── 템플릿 7: 다크 모드형 ──
export const VisualTemplate7 = ({ portfolio, ec }) => {
  const [selectedProject, setSelectedProject] = useState(null);
  const data = mapPortfolioToTemplateData(portfolio);
  const accentColor = "text-[#5C7CFA]";
  const borderColor = "border-[#3A3A3A]";
  const expList = ec ? (portfolio.experiences || []) : data.experience;
  const projList = ec ? (portfolio.experiences || []) : data.projects;
  const skillList = ec ? buildEditSkillList(portfolio) : data.skills;
  const eduList = ec ? (portfolio.education || []) : data.education;
  const awardList = ec ? (portfolio.awards || []) : data.awards;
  const contact = ec ? (portfolio.contact || {}) : { phone: data.phone, email: data.email, github: data.social?.github, website: data.social?.blog };
  const hidden = ec ? (ec.hiddenSections || []) : (portfolio.hiddenSections || []);
  const isHidden = (key) => hidden.includes(key);
  const { dragProps: dp, gripProps: gp } = makeSectionOrderUtils(portfolio, ec, ['introduce', 'skills', 'projects', 'career', 'education', 'awards', 'contact']);
  return (
    <div className="min-h-screen bg-[#1F1F1F] text-[#EBEBEB] font-sans pb-32 selection:bg-[#5C7CFA] selection:text-white">
      <ImageUploadSlot src={ec ? portfolio.coverImageUrl : null} onUpload={ec?.onUploadCoverImage} className="w-full h-48 overflow-hidden" imgClassName="w-full h-full object-cover" rounded="">
        <div className="w-full h-48 bg-gradient-to-r from-orange-900 via-indigo-900 to-purple-900 opacity-90 flex items-center justify-center">
          {ec && <span className="text-white/40 text-sm flex items-center gap-2"><Upload size={16}/> 커버 이미지 업로드</span>}
        </div>
      </ImageUploadSlot>
      <div className="max-w-4xl mx-auto px-6 -mt-8 relative z-10">
        <div className="text-center mb-16">
          <h1 className="text-3xl font-extrabold mb-12 tracking-wide text-white">
            {ec ? <EditText value={portfolio.portfolioTitle || '디자인 포트폴리오'} onChange={v => ec.update('portfolioTitle', v)} placeholder="포트폴리오 제목" className="text-3xl font-extrabold text-white" /> : (portfolio.portfolioTitle || '디자인 포트폴리오')}
          </h1>
          <h2 className="text-2xl font-bold mb-3">
            {ec ? <EditText value={portfolio.userName} onChange={v => ec.update('userName', v)} placeholder="이름" className="text-2xl font-bold text-[#EBEBEB]" /> : data.name}
          </h2>
          <p className="text-[#EBEBEB] font-medium flex justify-center items-center gap-2 mb-10">
            {ec ? <EditText value={portfolio.headline} onChange={v => ec.update('headline', v)} placeholder="헤드라인" className="text-[#EBEBEB] font-medium" /> : data.title}
          </p>
          {!isHidden('contact') && <div className="flex flex-col items-center text-sm text-[#A0A0A0] gap-3 group/section relative" {...(ec ? dp('contact') : {})}>
            {ec && <div className="absolute -top-5 right-0 flex items-center gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity"><span {...gp('contact')}><GripVertical size={14} className="text-gray-500 cursor-grab" /></span><SectionDeleteBtn ec={ec} sectionKey="contact" dark /></div>}
            {ec ? (
              <>
                <div className="flex w-72 justify-between items-center"><span className="w-16 text-left">phone</span><input value={contact.phone || ''} onChange={e => ec.updateNested('contact','phone',e.target.value)} placeholder="전화번호" className="flex-1 text-[#EBEBEB] bg-transparent outline-none border-b border-dashed border-[#3A3A3A] focus:border-[#5C7CFA]" /></div>
                <div className="flex w-72 justify-between items-center"><span className="w-16 text-left">email</span><input value={contact.email || ''} onChange={e => ec.updateNested('contact','email',e.target.value)} placeholder="이메일" className="flex-1 text-[#EBEBEB] bg-transparent outline-none border-b border-dashed border-[#3A3A3A] focus:border-[#5C7CFA]" /></div>
                <div className="flex w-72 justify-between items-center"><span className="w-16 text-left">github</span><input value={contact.github || ''} onChange={e => ec.updateNested('contact','github',e.target.value)} placeholder="GitHub" className="flex-1 text-[#EBEBEB] bg-transparent outline-none border-b border-dashed border-[#3A3A3A] focus:border-[#5C7CFA]" /></div>
                <div className="flex w-72 justify-between items-center"><span className="w-16 text-left">blog</span><input value={contact.website || ''} onChange={e => ec.updateNested('contact','website',e.target.value)} placeholder="블로그/웹사이트" className="flex-1 text-[#EBEBEB] bg-transparent outline-none border-b border-dashed border-[#3A3A3A] focus:border-[#5C7CFA]" /></div>
              </>
            ) : (
              <>
                {data.phone && <div className="flex w-72 justify-between items-center"><span className="w-16 text-left">phone</span> <span className="text-[#EBEBEB]">{data.phone}</span></div>}
                {data.email && <div className="flex w-72 justify-between items-center"><span className="w-16 text-left">email</span> <span className="text-[#EBEBEB]">{data.email}</span></div>}
                {data.social?.blog && <div className="flex w-72 justify-between items-center"><span className="w-16 text-left">blog</span> <span className="text-[#EBEBEB] hover:text-[#5C7CFA] cursor-pointer">{data.social.blog}</span></div>}
              </>
            )}
          </div>}
        </div>
        <div className="flex flex-col">
        {!isHidden('introduce') && <div {...dp('introduce')}><div className="mb-14 group/section">
          <div className={`flex items-center border-b ${borderColor} pb-2 mb-6`}>
            <h3 className={`text-lg font-bold ${accentColor} uppercase tracking-wider flex-1`}><EH ec={ec} value="Introduce" sectionKey="introduce" /></h3>
            {ec && <span {...gp('introduce')}><GripVertical size={14} /></span>}
            <SectionDeleteBtn ec={ec} sectionKey="introduce" dark />
          </div>
          {ec
            ? <EditText value={portfolio.greeting || `안녕하세요! ${portfolio.userName || ''}입니다!`} onChange={v => ec.update('greeting', v)} placeholder="인사말" className="font-bold mb-4 text-[#EBEBEB] block" />
            : <p className="font-bold mb-4 text-[#EBEBEB]">{data.greeting || `안녕하세요! ${data.name}입니다!`}</p>
          }
          {ec
            ? <EditTextarea value={portfolio.about} onChange={v => ec.update('about', v)} className="text-sm text-[#A0A0A0] leading-relaxed" />
            : <p className="text-sm text-[#A0A0A0] leading-relaxed whitespace-pre-wrap">{data.about}</p>
          }
        </div></div>}{/* end introduce */}
        {!isHidden('skills') && <div {...dp('skills')}><div className="mb-14 group/section">
          <div className={`flex items-center gap-3 border-b ${borderColor} pb-2 mb-6`}>
            <h3 className={`text-lg font-bold ${accentColor} uppercase tracking-wider flex-1`}><EH ec={ec} value="Skills" sectionKey="skills" /></h3>
            {ec?.jobAnalysis && <VisualSectionRecommend sectionType="skills" jobAnalysis={ec.jobAnalysis} />}
            <SectionDeleteBtn ec={ec} sectionKey="skills" dark />
          </div>
          <div className="flex flex-wrap gap-2">
            {skillList.map((skill, idx) => (
              <div key={idx} className="relative group">
                {ec && <RemoveBtn dark onClick={() => {
                  const cat = skill.category || 'tools';
                  const arr = [...(portfolio.skills?.[cat] || [])];
                  const nameIdx = arr.indexOf(skill.name);
                  if (nameIdx > -1) arr.splice(nameIdx, 1);
                  ec.update('skills', { ...portfolio.skills, [cat]: arr });
                }} />}
                <SkillTooltipBadge skill={skill} ec={ec} dark levelMode="blocks" />
              </div>
            ))}
          </div>
          <SkillsEditorPanel portfolio={portfolio} ec={ec} />
        </div></div>}{/* end skills */}
        {!isHidden('projects') && <div {...dp('projects')}><div className="mb-14 group/section">
          <div className={`flex items-center border-b ${borderColor} pb-2 mb-6`}>
            <h3 className={`text-lg font-bold ${accentColor} uppercase tracking-wider flex-1`}><EH ec={ec} value="Projects" sectionKey="projects" /></h3>
            {ec && <span {...gp('projects')}><GripVertical size={14} /></span>}
            <SectionDeleteBtn ec={ec} sectionKey="projects" dark />
          </div>
          <div className="flex items-center gap-2 mb-6">
            <span className="bg-[#2F2F2F] text-sm px-3 py-1.5 rounded-md flex items-center gap-2 font-bold text-white"><LayoutGrid className="w-4 h-4"/> Project</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projList.map((proj, idx) => (
              <div key={idx} className="bg-[#2A2A2A] rounded-xl overflow-hidden shadow-lg border border-[#3A3A3A] hover:border-[#5C7CFA] transition-all cursor-pointer group relative" onClick={() => ec ? ec.onOpenExpDetail(proj, idx) : setSelectedProject(proj)}>
                {ec && <RemoveBtn dark onClick={() => ec.removeFromArray('experiences', idx)} />}
                <div className="p-5 pb-10">
                  {ec
                    ? <EditText value={proj.company || proj.title || proj.name || ''} onChange={v => ec.updateArrayItem('experiences', idx, { company: v, title: v })} className="font-bold text-sm mb-4 text-white block" placeholder="프로젝트명" />
                    : <h4 className="font-bold text-sm mb-4 text-white">{proj.name}</h4>
                  }
                  <p className="text-xs text-[#A0A0A0] mb-2">{proj.period}</p>
                  {ec
                    ? <EditText value={proj.description || proj.desc || ''} onChange={v => ec.updateArrayItem('experiences', idx, { description: v })} className="text-xs text-[#A0A0A0] block" placeholder="설명" />
                    : <p className="text-xs text-[#A0A0A0] line-clamp-2">{proj.desc}</p>
                  }
                </div>
                <div className="bg-[#333333] px-5 py-3 flex items-center gap-2 text-sm font-bold border-t border-[#3A3A3A] group-hover:bg-[#3A3A3A] transition-colors">
                  <FileText className="w-4 h-4 text-white"/> {proj.tag || 'Project'}
                </div>
              </div>
            ))}
          </div>
          {ec && <ExpControls ec={ec} />}
        </div></div>}{/* end projects */}
        {!isHidden('career') && <div {...dp('career')}><div className="mb-14 group/section">
          <div className={`flex items-center border-b ${borderColor} pb-2 mb-6`}>
            <h3 className={`text-lg font-bold ${accentColor} uppercase tracking-wider flex-1`}><EH ec={ec} value="Career" sectionKey="career" /></h3>
            {ec && <span {...gp('career')}><GripVertical size={14} /></span>}
            <SectionDeleteBtn ec={ec} sectionKey="career" dark />
          </div>
          <ExperienceTimeline expList={expList} ec={ec} dark={true} />
        </div></div>}{/* end career */}
        {!isHidden('education') && (ec ? true : eduList.length > 0) && (
          <div {...dp('education')}><div className="mb-14 group/section">
            <div className={`flex items-center border-b ${borderColor} pb-2 mb-6`}>
              <h3 className={`text-lg font-bold ${accentColor} uppercase tracking-wider flex-1`}><EH ec={ec} value="Education" sectionKey="education" /></h3>
              {ec && <span {...gp('education')}><GripVertical size={14} /></span>}
              <SectionDeleteBtn ec={ec} sectionKey="education" dark />
            </div>
            <div className="space-y-4">
              {eduList.map((edu, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-4 md:gap-8 relative group">
                  {ec && <RemoveBtn dark onClick={() => ec.removeFromArray('education', idx)} />}
                  <div className="w-full md:w-36 flex-shrink-0 text-[#A0A0A0] text-sm">
                    {ec ? <EditText value={edu.period || ''} onChange={v => ec.updateArrayItem('education', idx, { period: v })} className="text-[#A0A0A0] text-sm" placeholder="기간" /> : edu.period}
                  </div>
                  <div>
                    {ec
                      ? <EditText value={edu.school || ''} onChange={v => ec.updateArrayItem('education', idx, { school: v })} className="font-bold text-[#EBEBEB] block" placeholder="학교명" />
                      : <h4 className="font-bold text-[#EBEBEB]">{edu.school}</h4>
                    }
                    {ec
                      ? <EditText value={edu.major || edu.degree || ''} onChange={v => ec.updateArrayItem('education', idx, { major: v })} className="text-sm text-[#A0A0A0] block" placeholder="전공/학위" />
                      : <p className="text-sm text-[#A0A0A0]">{edu.major || edu.degree}</p>
                    }
                  </div>
                </div>
              ))}
            </div>
            {ec && <button type="button" onClick={() => ec.addToArray('education', { school: '', major: '', period: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-600 rounded-lg text-xs text-gray-400 hover:border-[#5C7CFA] hover:text-[#5C7CFA] transition-colors mt-3"><Plus size={12}/> 학력 추가</button>}
          </div></div>)}{/* end education */}
        {!isHidden('awards') && (ec ? true : awardList.length > 0) && (
          <div {...dp('awards')}><div className="mb-14 group/section">
            <div className="flex items-center gap-3 border-b border-[#3A3A3A] pb-2 mb-6">
              <h3 className={`text-lg font-bold ${accentColor} uppercase tracking-wider flex-1`}><EH ec={ec} value="Awards" sectionKey="awards" /></h3>
              {ec?.jobAnalysis && <VisualSectionRecommend sectionType="awards" jobAnalysis={ec.jobAnalysis} />}
              {ec && <span {...gp('awards')}><GripVertical size={14} /></span>}
              <SectionDeleteBtn ec={ec} sectionKey="awards" dark />
            </div>
            <div className="space-y-3">
              {awardList.map((award, idx) => (
                <div key={idx} className="flex gap-6 items-center relative group">
                  {ec && <RemoveBtn dark onClick={() => ec.removeFromArray('awards', idx)} />}
                  {ec
                    ? <EditText value={award.date || ''} onChange={v => ec.updateArrayItem('awards', idx, { date: v })} className="text-[#EBEBEB] font-bold w-20 text-sm flex-shrink-0" placeholder="날짜" />
                    : <span className="text-[#EBEBEB] font-bold w-20 text-sm flex-shrink-0">{award.date}</span>
                  }
                  {ec
                    ? <EditText value={award.title || ''} onChange={v => ec.updateArrayItem('awards', idx, { title: v })} className="text-[#A0A0A0] text-sm" placeholder="수상명" />
                    : <span className="text-[#A0A0A0] text-sm">{award.title}</span>
                  }
                </div>
              ))}
            </div>
            {ec && <button type="button" onClick={() => ec.addToArray('awards', { title: '', date: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-600 rounded-lg text-xs text-gray-400 hover:border-[#5C7CFA] hover:text-[#5C7CFA] transition-colors mt-3"><Plus size={12}/> 상장 추가</button>}
          </div></div>)}{/* end awards */}
        </div>{/* end flex col reorderable sections */}
      </div>
      {/* 숨겨진 섹션 복원 버튼 (편집 모드) */}
      {ec && hidden.length > 0 && (
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="border border-dashed border-[#3A3A3A] rounded-xl p-4">
            <p className="text-xs text-[#A0A0A0] mb-3 font-medium">숨긴 섹션 복원</p>
            <div className="flex flex-wrap gap-2">
              {hidden.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => ec.showSection(key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#2A2A2A] text-[#A0A0A0] border border-[#3A3A3A] hover:border-[#5C7CFA] hover:text-[#5C7CFA] transition-colors"
                >
                  <Plus size={11} /> {key}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </div>
  );
};

// ── 템플릿 8: 개발자 다크형 ──
export const VisualTemplate8 = ({ portfolio, ec }) => {
  const [selectedProject, setSelectedProject] = useState(null);
  const data = mapPortfolioToTemplateData(portfolio);
  const expList = ec ? (portfolio.experiences || []) : data.experience;
  const projList = ec ? (portfolio.experiences || []) : data.projects;
  const awardList = ec ? (portfolio.awards || []) : data.awards;
  const skillList = ec ? buildEditSkillList(portfolio) : data.skills;
  const eduList = ec ? (portfolio.education || []) : data.education;
  const contact = ec ? (portfolio.contact || {}) : { phone: data.phone, email: data.email, github: data.social?.github, website: data.social?.blog };

  const { dragProps: dp, gripProps: gp } = makeSectionOrderUtils(portfolio, ec, ['projects', 'skills', 'awards', 'career', 'education', 'contact']);
  const hidden8 = ec ? (ec.hiddenSections || []) : (portfolio.hiddenSections || []);
  const isHidden8 = (key) => hidden8.includes(key);
  const getSkillLevel = (percent) => {
    const num = parseInt(percent);
    if (num >= 90) return 5;
    if (num >= 80) return 4;
    if (num >= 60) return 3;
    if (num >= 40) return 2;
    return 1;
  };
  const Checkboxes = ({ level }) => (
    <div className="flex gap-1 mb-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`w-[14px] h-[14px] rounded-[2px] flex items-center justify-center text-[10px] font-extrabold ${i < level ? 'bg-[#51A15F] text-white' : 'bg-[#D1D1D1]'}`}>
          {i < level ? '✓' : ''}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#191919] text-[#D4D4D4] font-sans pb-32 selection:bg-[#252B36] selection:text-white">
      <ImageUploadSlot src={ec ? portfolio.coverImageUrl : null} onUpload={ec?.onUploadCoverImage} className="w-full h-48 overflow-hidden" imgClassName="w-full h-full object-cover" rounded="">
        <div className="w-full h-48 bg-gradient-to-r from-yellow-700 via-green-800 to-teal-900 opacity-80 flex items-center justify-center">
          {ec && <span className="text-white/40 text-sm flex items-center gap-2"><Upload size={16}/> 커버 이미지 업로드</span>}
        </div>
      </ImageUploadSlot>
      <div className="max-w-4xl mx-auto px-6 -mt-8 relative z-10">
        <h1 className="text-3xl font-extrabold mb-16 tracking-wide text-white text-center">
          {ec ? <EditText value={portfolio.userName} onChange={v => ec.update('userName', v)} placeholder="이름" className="text-3xl font-extrabold text-white" /> : data.name}
        </h1>
        {/* Reorderable sections */}
        <div className="flex flex-col">
        {!isHidden8('projects') && <div className="mb-16 group/section" {...dp('projects')}>
          <div className="bg-[#2B323F] text-[#EBEBEB] p-3 rounded-lg font-bold flex items-center gap-2 mb-8 shadow-sm border border-[#3A4354]">
            <Briefcase className="w-4 h-4 text-[#5C7CFA]" /> <EH ec={ec} value="Project Summary" sectionKey="projects" className="text-[#EBEBEB] font-bold" />
            <div className="ml-auto flex items-center gap-1">{ec && <span {...gp('projects')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="projects" dark /></div>
          </div>
          <div className="space-y-12 pl-2">
            {projList.map((proj, idx) => (
              <div key={idx} className="border-b border-[#333] pb-8 last:border-0 relative group">
                {ec && <RemoveBtn dark onClick={() => ec.removeFromArray('experiences', idx)} />}
                {ec && <ExpDetailBtn exp={proj} idx={idx} ec={ec} dark />}
                {ec
                  ? <EditText value={proj.company || proj.title || proj.name || ''} onChange={v => ec.updateArrayItem('experiences', idx, { company: v, title: v })} className="text-lg font-bold text-white mb-4 block" placeholder="프로젝트명" />
                  : <h3 className="text-lg font-bold text-white mb-4">{proj.name}</h3>
                }
                <div className="space-y-3 text-sm">
                  <p><span className="text-[#A0A0A0] inline-block w-12 font-bold">기간</span> : {proj.period}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[#A0A0A0] inline-block w-12 font-bold">스택</span> :
                    <span className="bg-[#2D2D2D] text-[#EB5757] px-1.5 py-0.5 rounded font-mono text-xs">{proj.tag || 'Project'}</span>
                  </div>
                  {ec
                    ? <EditTextarea value={proj.description || proj.desc || ''} onChange={v => ec.updateArrayItem('experiences', idx, { description: v })} className="text-xs text-[#D4D4D4] ml-14" />
                    : <ul className="list-disc list-outside ml-14 mt-4 space-y-1.5 text-[#D4D4D4]">
                        {proj.details?.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                  }
                </div>
              </div>
            ))}
          </div>
          {ec && <ExpControls ec={ec} />}
        </div>}
        <div className="mb-16">
          <div className="bg-[#2B323F] text-[#EBEBEB] p-3 rounded-lg font-bold flex items-center gap-2 mb-2 shadow-sm border border-[#3A4354]">
            <LayoutGrid className="w-4 h-4 text-[#A0A0A0]" /> Project LIST
          </div>
          <p className="text-xs text-[#51A15F] mb-6 pl-2 font-medium">※ 카드를 누르면 상세 내용을 확인하실 수 있습니다.</p>
          <div className="flex items-center gap-2 mb-6 pl-2">
            <span className="bg-[#2D2D2D] text-sm px-3 py-1 rounded-md flex items-center gap-2 font-bold text-white"><LayoutGrid className="w-4 h-4"/> Gallery view</span>
            <div className="ml-auto flex gap-3 text-[#A0A0A0]">
              <Filter className="w-4 h-4 cursor-pointer hover:text-white transition-colors"/>
              <ArrowUpDown className="w-4 h-4 cursor-pointer hover:text-white transition-colors"/>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pl-2">
            {projList.map((proj, idx) => (
              <div key={idx} className="bg-[#252525] rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:ring-1 ring-[#5C7CFA] transition-all cursor-pointer group relative" onClick={() => ec ? ec.onOpenExpDetail(proj, idx) : setSelectedProject(proj)}>
                {ec && <RemoveBtn dark onClick={() => ec.removeFromArray('experiences', idx)} />}
                <div className="w-full h-36 overflow-hidden relative">
                  <ImageUploadSlot src={proj.thumbnailUrl} onUpload={null} className="w-full h-36 overflow-hidden" imgClassName="w-full h-full object-cover" rounded="">
                    <div className={`w-full h-36 ${proj.img || 'bg-blue-50'} flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                  </ImageUploadSlot>
                  <CameraUploadBtn onUpload={ec ? f => ec.onUploadExpImage(f, idx) : null} dark />
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold text-white mb-3">{proj.period}</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="bg-[#4B3B4B] text-[#D19ED1] text-[10px] px-2 py-0.5 rounded font-bold">{proj.tag || 'Project'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {!isHidden8('skills') && <div className="mb-16 group/section" {...dp('skills')}>
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-[#2B323F] text-[#EBEBEB] p-3 rounded-lg font-bold flex items-center gap-2 shadow-sm border border-[#3A4354] flex-1">
              <Code className="w-4 h-4 text-[#5C7CFA]" /> <EH ec={ec} value="SKILLS" sectionKey="skills" className="text-[#EBEBEB] font-bold" />
            </div>
            <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="skills" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('skills')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="skills" dark /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-2">
            {skillList.map((skill, idx) => (
              <div key={idx} className="flex gap-4 relative group">
                {ec && <RemoveBtn dark onClick={() => {
                  const cat = skill.category || 'tools';
                  const arr = [...(portfolio.skills?.[cat] || [])];
                  const nameIdx = arr.indexOf(skill.name);
                  if (nameIdx > -1) arr.splice(nameIdx, 1);
                  ec.update('skills', { ...portfolio.skills, [cat]: arr });
                }} />}
                <div className="w-16 flex-shrink-0 flex flex-col items-center justify-start gap-1">
                  <div className="w-8 h-8 bg-[#2D2D2D] rounded-full flex items-center justify-center text-xs text-white font-bold">{skill.name[0]}</div>
                  <SkillTooltipBadge skill={skill} ec={ec} dark plain levelMode="blocks" />
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <Checkboxes level={getSkillLevel(skill.percent)} />
                  </div>
                  <p className="text-xs text-[#A0A0A0] leading-relaxed mt-2">{skill.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <SkillsEditorPanel portfolio={portfolio} ec={ec} />
        </div>}{/* end skills */}
        {!isHidden8('awards') && (ec ? true : awardList.length > 0) && (
          <div className="mb-16 group/section" {...dp('awards')}>
            <div className="flex items-center gap-2 mb-8">
              <div className="bg-[#3A2D25] text-[#E0C8B1] p-3 rounded-lg font-bold flex items-center gap-2 shadow-sm border border-[#4A392F] flex-1">
                <Award className="w-4 h-4 text-[#E0C8B1]" /> Awards
              </div>
              <div className="flex items-center gap-1">{ec?.jobAnalysis && <VisualSectionRecommend sectionType="awards" jobAnalysis={ec.jobAnalysis} />}{ec && <span {...gp('awards')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="awards" dark /></div>
            </div>
            <div className="space-y-4 pl-2">
              {awardList.map((award, idx) => (
                <div key={idx} className="flex gap-6 items-center relative group">
                  {ec && <RemoveBtn dark onClick={() => ec.removeFromArray('awards', idx)} />}
                  {ec
                    ? <EditText value={award.date || ''} onChange={v => ec.updateArrayItem('awards', idx, { date: v })} className="text-[#EBEBEB] font-bold w-20 text-sm" placeholder="날짜" />
                    : <span className="text-[#EBEBEB] font-bold w-20 text-sm">{award.date}</span>
                  }
                  {ec
                    ? <EditText value={award.title || ''} onChange={v => ec.updateArrayItem('awards', idx, { title: v })} className="text-[#D4D4D4] text-sm" placeholder="수상명" />
                    : <span className="text-[#D4D4D4] text-sm">{award.title}</span>
                  }
                </div>
              ))}
            </div>
            {ec && (
              <button type="button" onClick={() => ec.addToArray('awards', { title: '', date: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-600 rounded-lg text-xs text-gray-400 hover:border-primary-400 hover:text-primary-400 transition-colors mt-3 ml-2">
                <Plus size={12} /> 수상 추가
              </button>
            )}
          </div>
        )}
        {!isHidden8('career') && (ec ? true : expList.length > 0) && (
          <div className="mb-16 group/section" {...dp('career')}>
            <div className="flex items-center justify-between gap-2 bg-[#3A3A3A] text-[#EBEBEB] p-3 rounded-lg font-bold mb-8 shadow-sm border border-[#4A4A4A]">
              <span><Briefcase className="w-4 h-4 text-[#EBEBEB] inline" /> <EH ec={ec} value="EXPERIENCE" sectionKey="career" className="text-[#EBEBEB] font-bold" /></span>
              <div className="flex items-center gap-1">{ec && <span {...gp('career')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="career" dark /></div>
            </div>
            <ExperienceTimeline expList={expList} ec={ec} dark={true} />
          </div>
        )}
        {!isHidden8('education') && (ec ? true : eduList.length > 0) && (
          <div className="mb-16 group/section" {...dp('education')}>
            <div className="flex items-center justify-between gap-2 bg-[#2B323F] text-[#EBEBEB] p-3 rounded-lg font-bold mb-8 shadow-sm border border-[#3A4354]">
              <span><GraduationCap className="w-4 h-4 text-[#EBEBEB] inline" /> <EH ec={ec} value="EDUCATION" sectionKey="education" className="text-[#EBEBEB] font-bold" /></span>
              <div className="flex items-center gap-1">{ec && <span {...gp('education')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="education" dark /></div>
            </div>
            <div className="space-y-6 pl-2">
              {eduList.map((edu, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-2 md:gap-6 md:items-center relative group">
                  {ec && <RemoveBtn dark onClick={() => ec.removeFromArray('education', idx)} />}
                  {ec
                    ? <EditText value={edu.period || ''} onChange={v => ec.updateArrayItem('education', idx, { period: v })} className="text-[#EBEBEB] font-bold md:w-36 flex-shrink-0 text-sm" placeholder="기간" />
                    : <span className="text-[#EBEBEB] font-bold md:w-36 flex-shrink-0 text-sm">{edu.period}</span>
                  }
                  <span className="text-[#D4D4D4] text-sm">
                    {ec
                      ? <><EditText value={edu.school || ''} onChange={v => ec.updateArrayItem('education', idx, { school: v })} className="text-[#D4D4D4] text-sm" placeholder="학교명" /> - <EditText value={edu.major || edu.degree || ''} onChange={v => ec.updateArrayItem('education', idx, { major: v })} className="text-[#D4D4D4] text-sm" placeholder="전공" /></>
                      : <>{edu.school} - {edu.major || edu.degree}</>
                    }
                  </span>
                </div>
              ))}
            </div>
            {ec && <button type="button" onClick={() => ec.addToArray('education', { school: '', major: '', period: '' })} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-600 rounded-lg text-xs text-gray-400 hover:border-primary-400 hover:text-primary-400 transition-colors mt-3 ml-2"><Plus size={12}/> 학력 추가</button>}
          </div>
        )}
        {!isHidden8('contact') && <div className="mb-16 group/section" {...dp('contact')}>
          <div className="flex items-center justify-between gap-2 bg-[#1E2A3A] text-[#EBEBEB] p-3 rounded-lg font-bold mb-8 shadow-sm border border-[#2A3A4A]">
            <span><Mail className="w-4 h-4 text-[#EBEBEB] inline" /> CONTACT</span>
            <div className="flex items-center gap-1">{ec && <span {...gp('contact')}><GripVertical size={14} /></span>}<SectionDeleteBtn ec={ec} sectionKey="contact" dark /></div>
          </div>
          <div className="space-y-3 pl-2 text-sm">
            {ec ? (
              <>
                <div className="flex gap-6 items-center"><span className="text-[#A0A0A0] w-16">email</span><input value={contact.email || ''} onChange={e => ec.updateNested('contact','email',e.target.value)} placeholder="이메일" className="flex-1 text-[#D4D4D4] bg-transparent outline-none border-b border-dashed border-[#3A3A3A] focus:border-[#5C7CFA]" /></div>
                <div className="flex gap-6 items-center"><span className="text-[#A0A0A0] w-16">phone</span><input value={contact.phone || ''} onChange={e => ec.updateNested('contact','phone',e.target.value)} placeholder="전화번호" className="flex-1 text-[#D4D4D4] bg-transparent outline-none border-b border-dashed border-[#3A3A3A] focus:border-[#5C7CFA]" /></div>
                <div className="flex gap-6 items-center"><span className="text-[#A0A0A0] w-16">github</span><input value={contact.github || ''} onChange={e => ec.updateNested('contact','github',e.target.value)} placeholder="GitHub" className="flex-1 text-[#D4D4D4] bg-transparent outline-none border-b border-dashed border-[#3A3A3A] focus:border-[#5C7CFA]" /></div>
                <div className="flex gap-6 items-center"><span className="text-[#A0A0A0] w-16">blog</span><input value={contact.website || ''} onChange={e => ec.updateNested('contact','website',e.target.value)} placeholder="블로그/웹사이트" className="flex-1 text-[#D4D4D4] bg-transparent outline-none border-b border-dashed border-[#3A3A3A] focus:border-[#5C7CFA]" /></div>
              </>
            ) : (
              <>
                {data.email && <div className="flex gap-6"><span className="text-[#A0A0A0] w-16">email</span><span className="text-[#D4D4D4]">{data.email}</span></div>}
                {data.phone && <div className="flex gap-6"><span className="text-[#A0A0A0] w-16">phone</span><span className="text-[#D4D4D4]">{data.phone}</span></div>}
                {data.social?.github && <div className="flex gap-6"><span className="text-[#A0A0A0] w-16">github</span><span className="text-[#D4D4D4]">{data.social.github}</span></div>}
                {data.social?.blog && <div className="flex gap-6"><span className="text-[#A0A0A0] w-16">blog</span><span className="text-[#D4D4D4]">{data.social.blog}</span></div>}
              </>
            )}
          </div>
        </div>}
        </div>{/* end flex col reorderable sections */}
        {ec && (ec.hiddenSections || []).length > 0 && (
          <div className="mt-8 mb-4">
            <div className="border border-dashed border-[#444] rounded-xl p-4">
              <p className="text-xs text-[#777] mb-3">숨긴 섹션 복원</p>
              <div className="flex flex-wrap gap-2">
                {(ec.hiddenSections || []).map(key => (
                  <button key={key} type="button" onClick={() => ec.showSection(key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#252525] text-[#999] border border-[#444] hover:border-[#5C7CFA] hover:text-[#5C7CFA] transition-colors">
                    <Plus size={11} /> {key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </div>
  );
};

// ── 템플릿 라우터 ──
export const VISUAL_TEMPLATE_IDS = ['visual-1','visual-2','visual-3','visual-4','visual-5','visual-6','visual-7','visual-8'];

export default function VisualPortfolioRenderer({ portfolio, ec }) {
  const templateId = portfolio?.templateId;
  const props = { portfolio, ec };
  if (templateId === 'visual-1') return <VisualTemplate1 {...props} />;
  if (templateId === 'visual-2') return <VisualTemplate2 {...props} />;
  if (templateId === 'visual-3') return <VisualTemplate3 {...props} />;
  if (templateId === 'visual-4') return <VisualTemplate4 {...props} />;
  if (templateId === 'visual-5') return <VisualTemplate5 {...props} />;
  if (templateId === 'visual-6') return <VisualTemplate6 {...props} />;
  if (templateId === 'visual-7') return <VisualTemplate7 {...props} />;
  if (templateId === 'visual-8') return <VisualTemplate8 {...props} />;
  return null;
}