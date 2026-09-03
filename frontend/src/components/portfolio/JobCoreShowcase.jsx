/**
 * JobCoreShowcase — 직군별 핵심 경험 페이지의 디자인을 그대로 옮긴 프로젝트 상세용 시각화.
 *
 * ProjectDetailModal(노션 프로젝트 화면 구성/미리보기/링크공유)에서 핵심 경험 슬라이더처럼
 * 고정 컴포넌트로 렌더링된다 — 캔버스 텍스트가 아니라 실제 디자인으로 내보내진다.
 *  - 개발(dev·aiml·devops): 서비스 소개(문제 정의·해결 방법·주요 성과 표) + GitHub 기여도 + 문제 해결 기록
 *  - 기획/PM: 린 캔버스 격자 + 가설 검증 표
 *  - 마케터: 캠페인 스토리 + KPI 타일 + 이력서 문장
 */
import { useState } from 'react';
import { GitProjectCard } from './GitInsights';
import { KpiTileRow, FunnelChart, DumbbellCompare, MixBar, GoalBoard, GaugeRow, ProcessFlow } from './JobVisuals';
import { getJobPortfolioMeta, normalizePortfolioVisuals } from '../../utils/devPortfolio';
import { JOB_CATEGORIES, JOB_SPECIFIC_FIELDS } from '../../stores/experienceStore';
import { PriorityMatrix } from './JobSignature';
import { ArchitectureDiagram, buildFallbackDiagram } from './ArchDiagram';
import { uploadDocumentFile } from '../../services/uploadImage';
import toast from 'react-hot-toast';

const ACCENT = '#002F6C';
// 개발자(FE/BE)만 GitHub 중심 레이아웃을 사용한다.
// AI/ML·DevOps는 원본 직군 특화 페이지의 전용 쇼케이스를 사용한다.
const DEV_GIT_JOBS = ['dev'];

function clean(v) {
  const t = String(v || '').trim();
  if (!t || t.startsWith('[작성 필요]') || t.startsWith('[검증 필요]') || /【[^】]*】/.test(t)) return '';
  return t.replace(/\*\*/g, '').replace(/^#+\s/gm, '').trim();
}

function SectionLabel({ en, children }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2">
      {en && <span className="font-mono text-[10.5px] font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>{en}</span>}
      <p className="text-[13px] font-extrabold text-bluewood-900">{children}</p>
    </div>
  );
}

function EditField({ label, value, onChange, multiline = true, type = 'text', placeholder = '' }) {
  const shared = 'w-full rounded-lg border border-surface-200 bg-white px-2.5 py-2 text-[12px] leading-[1.55] text-bluewood-700 outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100';
  return (
    <label className="block min-w-0">
      {label && <span className="mb-1 block text-[11.5px] font-bold text-bluewood-400">{label}</span>}
      {multiline ? (
        <textarea rows={2} value={value ?? ''} onChange={event => onChange(event.target.value)} placeholder={placeholder} className={`${shared} resize-y`} />
      ) : (
        <input type={type} value={value ?? ''} onChange={event => onChange(type === 'number' ? Number(event.target.value) : event.target.value)} placeholder={placeholder} className={shared} />
      )}
    </label>
  );
}

function EditPanel({ children }) {
  return <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50/35 p-3.5 print:hidden">{children}</div>;
}

function EditFrame({ editing, setEditing, canEdit, children }) {
  return (
    <div>
      {canEdit && (
        <div className="mb-4 flex justify-end print:hidden">
          <button type="button" onClick={() => setEditing(value => !value)} className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-colors ${editing ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-600 hover:bg-primary-100'}`}>
            {editing ? '편집 완료' : '전체 편집'}
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

/* dense — 기획/PM처럼 블록이 많은 직군은 한 화면에 들어오도록 간격을 좁힌다. */
function JobCoreLayout({ sidebar, lead, children, dense = false }) {
  if (!sidebar) {
    return (
      <div className={`min-w-0 ${dense ? 'space-y-4' : 'space-y-7'}`}>
        {lead && <div className="min-w-0">{lead}</div>}
        {children && <div className="min-w-0">{children}</div>}
      </div>
    );
  }

  return (
    <div className={`grid w-full min-w-0 grid-cols-1 items-start md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] ${
      dense ? 'gap-4 md:gap-5 lg:gap-6' : 'gap-7 md:gap-8 lg:gap-10'
    }`}>
      <div className="min-w-0">{sidebar}</div>
      <div className="min-w-0">{lead}</div>
      {children && <div className="min-w-0 md:col-span-2">{children}</div>}
    </div>
  );
}

function collectDeliverables(sr = {}) {
  const repoName = clean(sr.gitAnalysis?.repoName) || clean(sr.githubStats?.repoName);
  const repoUrl = repoName
    ? (/^https?:\/\//i.test(repoName) ? repoName : `https://github.com/${repoName.replace(/^github\.com\//i, '')}`)
    : '';
  return [
    ...(Array.isArray(sr.deliverables) ? sr.deliverables : []),
    ...(Array.isArray(sr.pmFiles) ? sr.pmFiles : []),
    ...(repoUrl ? [{ id: 'derived-github-repository', kind: 'link', name: 'GitHub 리포지토리', url: repoUrl, source: 'github' }] : []),
  ].filter((item, index, list) => item?.url && item?.name && list.findIndex(other => other?.url === item.url) === index);
}

function DeliverableEditor({ items = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const onPick = async event => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (picked.length === 0) return;
    setUploading(true);
    const added = [];
    for (const file of picked) {
      try {
        const uploaded = await uploadDocumentFile(file);
        added.push({
          id: `deliverable-${Date.now()}-${added.length}`,
          kind: 'file',
          name: uploaded.name || file.name,
          url: uploaded.url,
          filename: uploaded.filename,
          size: uploaded.size || file.size,
          ext: String(file.name || '').split('.').pop().toLowerCase(),
        });
      } catch (error) {
        toast.error(error?.response?.data?.error || `'${file.name}' 업로드에 실패했어요`);
      }
    }
    if (added.length > 0) onChange([...items, ...added]);
    setUploading(false);
  };
  const addLink = () => {
    const raw = linkInput.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(url);
      const isGithub = /(^|\.)github\.com$/i.test(parsed.hostname);
      onChange([...items, {
        id: `deliverable-link-${Date.now()}`,
        kind: 'link',
        name: isGithub ? 'GitHub 리포지토리' : parsed.hostname.replace(/^www\./, ''),
        url,
        source: isGithub ? 'github' : 'link',
      }]);
      setLinkInput('');
    } catch {
      toast.error('올바른 웹 링크를 입력해 주세요');
    }
  };
  return (
    <EditPanel>
      <p className="mb-2 text-[11.5px] font-black text-bluewood-600">산출물 파일 · 링크 편집</p>
      {items.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {items.map((item, index) => (
            <div key={item.id || `${item.url}-${index}`} className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2 text-[11.5px]">
              <span className="min-w-0 truncate text-bluewood-600">{item.name}</span>
              <button type="button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} className="flex-shrink-0 font-bold text-red-400">삭제</button>
            </div>
          ))}
        </div>
      )}
      <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-primary-200 bg-white px-2.5 py-2 text-[11.5px] font-bold text-primary-600">
        {uploading ? '업로드 중…' : '＋ 파일 추가'}
        <input type="file" multiple disabled={uploading} accept=".pdf,.ppt,.pptx,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.key,.txt,.md,.zip,.jpg,.jpeg,.png,.webp" className="hidden" onChange={onPick} />
      </label>
      <div className="mt-2 flex gap-1.5">
        <input value={linkInput} onChange={event => setLinkInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addLink(); } }} placeholder="GitHub·Notion·Figma 등 URL" className="min-w-0 flex-1 rounded-lg border border-surface-200 bg-white px-2.5 py-2 text-[11.5px] outline-none focus:border-primary-300" />
        <button type="button" onClick={addLink} className="flex-shrink-0 rounded-lg bg-primary-600 px-2.5 text-[11.5px] font-bold text-white">추가</button>
      </div>
    </EditPanel>
  );
}

function JobCoreSidebar({ exp, sr, jobCategory, editing = false, onChange }) {
  const overview = sr.projectOverview || {};
  const caseMeta = exp?.caseStudy?.meta || {};
  const meta = getJobPortfolioMeta(jobCategory);
  const jobLabel = JOB_CATEGORIES.flatMap(group => group.items).find(item => item.value === jobCategory)?.label || '직군 특화';
  const title = clean(exp?.caseStudy?.title) || clean(exp?.title) || '핵심 경험';
  const summary = clean(exp?.caseStudy?.summary)
    || clean(exp?.description)
    || clean(overview.summary)
    || clean(overview.background);
  const info = [
    { label: '역할', value: clean(caseMeta.role) || clean(overview.role) || clean(exp?.role) },
    { label: '기간', value: clean(caseMeta.duration) || clean(overview.duration) || clean(exp?.date) },
    { label: '팀 구성', value: clean(caseMeta.team) || clean(overview.team) },
  ];
  const stack = [
    ...(Array.isArray(overview.techStack) ? overview.techStack : []),
    ...(Array.isArray(exp?.skills) ? exp.skills : []),
    ...(Array.isArray(sr.keywords) ? sr.keywords : []),
    ...(Array.isArray(exp?.keywords) ? exp.keywords : []),
  ].map(item => clean(typeof item === 'string' ? item : item?.name || item?.label))
    .filter(Boolean);
  const tags = [...new Set(stack)].slice(0, 12);
  const visuals = sr.portfolioVisuals || {};
  const metrics = [
    ...(Array.isArray(visuals.kpis) ? visuals.kpis : []).map(item => ({
      label: clean(item?.label || item?.name),
      value: clean(item?.value ?? item?.actual),
    })),
    ...(Array.isArray(visuals.goals) ? visuals.goals : []).map(item => ({
      label: clean(item?.label || item?.name),
      value: clean(item?.actual ?? item?.target ?? item?.value),
    })),
  ].filter(item => item.label || item.value).slice(0, 3);
  const impact = clean(overview.scopeOfImpact) || clean(overview.goal);
  const deliverables = collectDeliverables(sr);

  return (
    <aside className="min-w-0 break-words md:sticky md:top-4 md:pr-1" style={{ overflowWrap: 'anywhere' }}>
      <p className="text-[11.5px] font-black uppercase tracking-[0.18em]" style={{ color: meta.accent }}>{jobLabel} · {meta.kicker}</p>
      <h3 className="mt-3 text-[22px] font-black leading-[1.22] tracking-tight text-bluewood-900">{title}</h3>
      {summary && <p className="mt-2 whitespace-pre-line text-[12.5px] leading-[1.65] text-bluewood-500">{summary}</p>}

      <div className="mt-5 grid grid-cols-3 gap-x-3 gap-y-3 border-t border-surface-200 pt-4">
        {info.map(item => (
          <div key={item.label} className="min-w-0">
            <p className="mb-0.5 text-[9.5px] font-bold uppercase tracking-wide text-bluewood-300">{item.label}</p>
            <p className="text-[11.5px] font-semibold leading-[1.45] text-bluewood-700">{item.value || '—'}</p>
          </div>
        ))}
      </div>

      {impact && (
        <div className="mt-5 border-t border-surface-200 pt-4">
          <p className="mb-1.5 text-[11.5px] font-bold text-bluewood-400">목표 · 영향 범위</p>
          <p className="whitespace-pre-line text-[12px] leading-[1.65] text-bluewood-600">{impact}</p>
        </div>
      )}

      {metrics.length > 0 && (
        <div className="mt-5 border-t border-surface-200 pt-4">
          <p className="mb-2 text-[11.5px] font-bold text-bluewood-400">핵심 지표</p>
          <div className="space-y-2">
            {metrics.map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex min-w-0 items-baseline justify-between gap-3 rounded-lg bg-surface-50 px-2.5 py-2">
                <span className="min-w-0 text-[12px] leading-[1.4] text-bluewood-500">{item.label || '지표'}</span>
                <span className="flex-shrink-0 text-[12px] font-black text-bluewood-900">{item.value || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="mt-5 border-t border-surface-200 pt-4">
          <p className="mb-2 text-[11.5px] font-bold text-bluewood-400">기술 · 핵심 역량</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => <span key={tag} className="rounded-md bg-surface-100 px-2 py-1 text-[11.5px] font-semibold text-bluewood-600">{tag}</span>)}
          </div>
        </div>
      )}

      {deliverables.length > 0 && <div className="mt-5 border-t border-surface-200 pt-4"><PmDeliverableFiles files={deliverables} compact /></div>}
      {editing && onChange && <DeliverableEditor items={deliverables} onChange={items => onChange({ ...sr, deliverables: items, pmFiles: [] })} />}
    </aside>
  );
}

/* ── 개발 — 서비스 소개: 이름·태그라인 + 문제 정의/해결 방법 + 주요 성과 표 + 핵심 기능 ── */
function ProductIntroCard({ product = {}, embedded = false, editing = false, onChange }) {
  const name = clean(product.name);
  const tagline = clean(product.tagline);
  const problem = clean(product.problem);
  const solution = clean(product.solution);
  const outcomes = (Array.isArray(product.outcomes) ? product.outcomes : [])
    .map(o => ({ label: clean(o?.label), value: clean(o?.value) })).filter(o => o.label || o.value);
  const features = (Array.isArray(product.features) ? product.features : [])
    .map(f => ({ name: clean(f?.name), desc: clean(f?.desc) })).filter(f => f.name || f.desc);
  if (!editing && !name && !problem && !solution && outcomes.length === 0 && features.length === 0) return null;

  return (
    <div className={embedded ? '' : 'rounded-2xl border border-surface-200 p-5'}>
      <SectionLabel en="Product">서비스 소개</SectionLabel>
      {(name || tagline) && (
        <div className="mb-4">
          {name && <p className="text-[19px] font-black leading-tight text-bluewood-900">{name}</p>}
          {tagline && <p className="mt-1 text-[13px] leading-[1.6] text-bluewood-500">{tagline}</p>}
        </div>
      )}
      {(problem || solution) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {problem && (
            <div>
              <p className="mb-1 text-[12px] font-bold text-bluewood-700">문제 정의</p>
              <p className="whitespace-pre-line text-[13px] leading-[1.75] text-bluewood-600">{problem}</p>
            </div>
          )}
          {solution && (
            <div>
              <p className="mb-1 text-[12px] font-bold" style={{ color: ACCENT }}>해결 방법</p>
              <p className="whitespace-pre-line text-[13px] leading-[1.75] text-bluewood-600">{solution}</p>
            </div>
          )}
        </div>
      )}
      {outcomes.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12px] font-bold text-bluewood-700">주요 성과</p>
          <div className="overflow-hidden rounded-xl border border-surface-200">
            {outcomes.map((o, i) => (
              <div key={i} className={`flex items-stretch ${i > 0 ? 'border-t border-surface-100' : ''}`}>
                <span className="min-w-0 flex-1 px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-bluewood-600">{o.label || '—'}</span>
                <span className="flex w-[38%] flex-shrink-0 items-center border-l border-surface-100 bg-surface-50/60 px-3.5 py-2.5 text-[12.5px] font-bold text-bluewood-900">{o.value || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {features.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12px] font-bold text-bluewood-700">핵심 기능</p>
          <ul className="space-y-1.5">
            {features.map((f, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-[1.6] text-bluewood-600">
                <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: ACCENT }} />
                <span className="min-w-0">{f.name && <span className="font-semibold text-bluewood-800">{f.name}</span>}{f.name && f.desc ? ' — ' : ''}{f.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {editing && (
        <EditPanel>
          <div className="grid gap-3 sm:grid-cols-2">
            <EditField label="서비스명" value={product.name} multiline={false} onChange={value => onChange({ ...product, name: value })} />
            <EditField label="한 줄 소개" value={product.tagline} multiline={false} onChange={value => onChange({ ...product, tagline: value })} />
            <EditField label="문제 정의" value={product.problem} onChange={value => onChange({ ...product, problem: value })} />
            <EditField label="해결 방법" value={product.solution} onChange={value => onChange({ ...product, solution: value })} />
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between"><p className="text-[12px] font-black text-bluewood-600">주요 성과</p><button type="button" onClick={() => onChange({ ...product, outcomes: [...(product.outcomes || []), { label: '', value: '' }] })} className="text-[12px] font-bold text-primary-600">＋ 추가</button></div>
            <div className="space-y-2">
              {(product.outcomes || []).map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><EditField value={item?.label} multiline={false} placeholder="성과명" onChange={value => onChange({ ...product, outcomes: product.outcomes.map((row, i) => i === index ? { ...row, label: value } : row) })} /><EditField value={item?.value} multiline={false} placeholder="결과·수치" onChange={value => onChange({ ...product, outcomes: product.outcomes.map((row, i) => i === index ? { ...row, value } : row) })} /><button type="button" onClick={() => onChange({ ...product, outcomes: product.outcomes.filter((_, i) => i !== index) })} className="px-2 text-[12px] font-bold text-red-400">삭제</button></div>)}
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between"><p className="text-[12px] font-black text-bluewood-600">핵심 기능</p><button type="button" onClick={() => onChange({ ...product, features: [...(product.features || []), { name: '', desc: '' }] })} className="text-[12px] font-bold text-primary-600">＋ 추가</button></div>
            <div className="space-y-2">
              {(product.features || []).map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[0.8fr_1.5fr_auto]"><EditField value={item?.name} multiline={false} placeholder="기능명" onChange={value => onChange({ ...product, features: product.features.map((row, i) => i === index ? { ...row, name: value } : row) })} /><EditField value={item?.desc} placeholder="기능 설명" onChange={value => onChange({ ...product, features: product.features.map((row, i) => i === index ? { ...row, desc: value } : row) })} /><button type="button" onClick={() => onChange({ ...product, features: product.features.filter((_, i) => i !== index) })} className="px-2 text-[12px] font-bold text-red-400">삭제</button></div>)}
            </div>
          </div>
        </EditPanel>
      )}
    </div>
  );
}

function CommitActivity({ days = [] }) {
  const valid = days.filter(day => /^\d{4}-\d{2}-\d{2}$/.test(String(day?.d || '')));
  if (valid.length === 0) return null;
  const counts = new Map(valid.map(day => [day.d, Number(day.count) || 0]));
  const max = Math.max(1, ...valid.map(day => Number(day.count) || 0));
  const sorted = [...valid].sort((a, b) => a.d.localeCompare(b.d));
  const parse = value => { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d); };
  const format = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const last = parse(sorted[sorted.length - 1].d);
  const start = new Date(last);
  start.setDate(start.getDate() - start.getDay() - (25 * 7));
  const weeks = Array.from({ length: 26 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i * 7); return d; });
  const colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  const color = count => colors[count <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4)))];

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, dayIndex) => {
                const date = new Date(week); date.setDate(date.getDate() + dayIndex);
                const key = format(date); const count = counts.get(key) || 0;
                return <span key={dayIndex} title={`${key} · 커밋 ${count}개`} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: color(count) }} />;
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11.5px] text-bluewood-300">적음 {colors.map((item, i) => <span key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: item }} />)} 많음</div>
    </div>
  );
}

/* 개발 핵심 경험 화면의 왼쪽 GitHub 리포트. 경험 상세 화면과 같은 정보 밀도와 배치를 유지한다. */
function DevGitReport({ exp, stats = {}, gitExps = [], editing = false, onChange }) {
  const pct = Number(stats.contributionPct) || 0;
  const langs = Array.isArray(stats.languages) ? stats.languages : [];
  const types = Array.isArray(stats.commitTypes) ? stats.commitTypes.slice(0, 5) : [];
  const maxType = Math.max(1, ...types.map(t => Number(t?.count) || 0));
  const role = clean(exp?.role || exp?.structuredResult?.projectOverview?.role)
    || clean(gitExps[0]?.role)
    || '개발';
  const title = clean(exp?.caseStudy?.title) || clean(exp?.title) || '핵심 경험';
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0d9488'];
  // 핵심 역할 포인트 + 기술 스택 — 핵심 경험 페이지 좌측 레일과 동일 구성
  const rolePoints = gitExps.map(item => clean(item?.project_name)).filter(Boolean).slice(0, 5);
  const overviewStack = (exp?.structuredResult?.projectOverview?.techStack || [])
    .map(item => (typeof item === 'string' ? item : item?.name || '')).map(clean).filter(Boolean);
  const gitStack = gitExps.flatMap(item => String(item?.core_tech_stack || '').split(/,\s*/)).map(clean).filter(Boolean);
  const techTags = [...new Set([...overviewStack, ...gitStack])].slice(0, 12);

  return (
    <div className="min-w-0 md:pr-2">
      <p className="text-[11.5px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>핵심 경험 리포트</p>
      <h3 className="mt-4 text-[22px] font-black leading-[1.22] tracking-tight text-bluewood-900">{title}</h3>
      <div className="mt-5 border-t border-surface-200 pt-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[12px] font-black uppercase tracking-[0.16em] text-bluewood-400">기여도 · 영향력</p>
          {stats.activePeriod?.first && (
            <span className="text-[12px] tabular-nums text-bluewood-300">{stats.activePeriod.first} ~ {stats.activePeriod.last || ''}</span>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-7 gap-y-4">
          <div>
            <p className="text-[34px] font-black leading-none tracking-tight" style={{ color: ACCENT }}>{pct ? `${pct}%` : (stats.myCommits || '—')}</p>
            <p className="mt-1.5 text-[11.5px] font-semibold text-bluewood-400">{pct ? '커밋 기여 비중' : '내 커밋'}</p>
          </div>
          {pct > 0 && (
            <div>
              <p className="text-[20px] font-extrabold leading-none text-bluewood-900">{stats.myCommits ?? '—'}<span className="text-[13px] font-semibold text-bluewood-400"> / {stats.totalCommits || '—'}</span></p>
              <p className="mt-1.5 text-[12px] text-bluewood-400">내 커밋 / 전체</p>
            </div>
          )}
          <div>
            <p className="text-[20px] font-extrabold leading-none text-bluewood-900">{role}</p>
            <p className="mt-1.5 text-[12px] text-bluewood-400">주 역할</p>
          </div>
        </div>
        {pct > 0 && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: ACCENT }} /></div>
            <p className="mt-1.5 text-[12px] text-bluewood-300">내 커밋 {stats.myCommits} / 전체 {stats.totalCommits} · GitHub 기여자 통계(기본 브랜치) 기준</p>
          </div>
        )}
        {langs.length > 0 && (
          <div className="mt-5">
            <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
              {langs.map((lang, i) => <div key={i} className="rounded-full" style={{ width: `${lang.pct}%`, backgroundColor: colors[i % colors.length] }} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
              {langs.map((lang, i) => <span key={i} className="inline-flex items-center gap-1.5 text-[11.5px] text-bluewood-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />{lang.name} <span className="text-bluewood-300">{lang.pct}%</span></span>)}
            </div>
          </div>
        )}
        {Array.isArray(stats.dailyActivity) && stats.dailyActivity.length > 0 && (
          <div className="mt-6">
            <p className="mb-2.5 text-[12px] font-bold text-bluewood-400">커밋 활동</p>
            <CommitActivity days={stats.dailyActivity} />
          </div>
        )}
        {types.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-[12px] font-bold text-bluewood-400">커밋 유형</p>
            <div className="space-y-1.5">
              {types.map((type, i) => <div key={i} className="flex items-center gap-2.5 text-[11.5px]"><span className="w-16 flex-shrink-0 truncate font-mono text-bluewood-500">{type.type}</span><div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-100"><div className="h-full rounded-full" style={{ width: `${Math.round(((Number(type.count) || 0) / maxType) * 100)}%`, backgroundColor: ACCENT }} /></div><span className="w-9 flex-shrink-0 text-right font-semibold tabular-nums text-bluewood-700">{type.count}</span></div>)}
            </div>
          </div>
        )}
        {rolePoints.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-[12px] font-bold text-bluewood-400">핵심 역할</p>
            <ul className="space-y-1.5">
              {rolePoints.map((point, i) => (
                <li key={i} className="flex gap-2 text-[12px] leading-[1.5] text-bluewood-600">
                  <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: ACCENT }} />
                  <span className="min-w-0">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {techTags.length > 0 && (
          <div className="mt-6 border-t border-surface-200 pt-4">
            <p className="mb-2 text-[12px] font-bold text-bluewood-400">기술 스택</p>
            <div className="flex flex-wrap gap-1.5">
              {techTags.map((tag, i) => <span key={i} className="rounded-md bg-surface-100 px-2 py-0.5 text-[12px] font-semibold text-bluewood-600">{tag}</span>)}
            </div>
          </div>
        )}
        {editing && (
          <EditPanel>
            <p className="mb-3 text-[12px] font-black text-bluewood-600">GitHub 요약</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="내 커밋" type="number" multiline={false} value={stats.myCommits || 0} onChange={value => onChange({ ...stats, myCommits: value })} />
              <EditField label="전체 커밋" type="number" multiline={false} value={stats.totalCommits || 0} onChange={value => onChange({ ...stats, totalCommits: value })} />
              <EditField label="기여 비중(%)" type="number" multiline={false} value={stats.contributionPct || 0} onChange={value => onChange({ ...stats, contributionPct: value })} />
              <EditField label="기여 순위" type="number" multiline={false} value={stats.rank || 0} onChange={value => onChange({ ...stats, rank: value })} />
              <EditField label="활동 시작일" multiline={false} value={stats.activePeriod?.first || ''} onChange={value => onChange({ ...stats, activePeriod: { ...(stats.activePeriod || {}), first: value } })} />
              <EditField label="활동 종료일" multiline={false} value={stats.activePeriod?.last || ''} onChange={value => onChange({ ...stats, activePeriod: { ...(stats.activePeriod || {}), last: value } })} />
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between"><p className="text-[12px] font-black text-bluewood-600">언어 구성</p><button type="button" onClick={() => onChange({ ...stats, languages: [...(stats.languages || []), { name: '', pct: 0 }] })} className="text-[12px] font-bold text-primary-600">＋ 추가</button></div>
              <div className="space-y-2">{(stats.languages || []).map((item, index) => <div key={index} className="grid grid-cols-[1fr_90px_auto] gap-2"><EditField value={item?.name} multiline={false} placeholder="언어" onChange={value => onChange({ ...stats, languages: stats.languages.map((row, i) => i === index ? { ...row, name: value } : row) })} /><EditField value={item?.pct || 0} type="number" multiline={false} onChange={value => onChange({ ...stats, languages: stats.languages.map((row, i) => i === index ? { ...row, pct: value } : row) })} /><button type="button" onClick={() => onChange({ ...stats, languages: stats.languages.filter((_, i) => i !== index) })} className="px-1 text-[12px] font-bold text-red-400">삭제</button></div>)}</div>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between"><p className="text-[12px] font-black text-bluewood-600">커밋 유형</p><button type="button" onClick={() => onChange({ ...stats, commitTypes: [...(stats.commitTypes || []), { type: '', count: 0 }] })} className="text-[12px] font-bold text-primary-600">＋ 추가</button></div>
              <div className="space-y-2">{(stats.commitTypes || []).map((item, index) => <div key={index} className="grid grid-cols-[1fr_90px_auto] gap-2"><EditField value={item?.type} multiline={false} placeholder="feat, fix 등" onChange={value => onChange({ ...stats, commitTypes: stats.commitTypes.map((row, i) => i === index ? { ...row, type: value } : row) })} /><EditField value={item?.count || 0} type="number" multiline={false} onChange={value => onChange({ ...stats, commitTypes: stats.commitTypes.map((row, i) => i === index ? { ...row, count: value } : row) })} /><button type="button" onClick={() => onChange({ ...stats, commitTypes: stats.commitTypes.filter((_, i) => i !== index) })} className="px-1 text-[12px] font-bold text-red-400">삭제</button></div>)}</div>
            </div>
          </EditPanel>
        )}
      </div>
    </div>
  );
}

function EditableGitProjects({ items = [], onChange }) {
  const patch = (index, changes) => onChange(items.map((item, i) => i === index ? { ...item, ...changes } : item));
  return (
    <EditPanel>
      <div className="mb-3 flex items-center justify-between"><p className="text-[12px] font-black text-bluewood-600">문제 해결 기록</p><button type="button" onClick={() => onChange([...items, { project_name: '', period: '', core_tech_stack: '', problem_definition: '', action_and_solution: '', core_impact: '', troubleshooting: '', learning: '' }])} className="text-[12px] font-bold text-primary-600">＋ 기록 추가</button></div>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="rounded-xl border border-surface-200 bg-white p-3">
            <div className="mb-2 flex justify-end"><button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))} className="text-[12px] font-bold text-red-400">기록 삭제</button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="프로젝트명" value={item.project_name} multiline={false} onChange={value => patch(index, { project_name: value })} />
              <EditField label="기간" value={item.period} multiline={false} onChange={value => patch(index, { period: value })} />
              <EditField label="기술 스택" value={item.core_tech_stack} onChange={value => patch(index, { core_tech_stack: value })} />
              <EditField label="성과·임팩트" value={item.core_impact} onChange={value => patch(index, { core_impact: value })} />
              <EditField label="문제 정의" value={Array.isArray(item.problem_definition) ? item.problem_definition.join('\n') : item.problem_definition} onChange={value => patch(index, { problem_definition: value })} />
              <EditField label="해결 과정" value={Array.isArray(item.action_and_solution) ? item.action_and_solution.join('\n') : item.action_and_solution} onChange={value => patch(index, { action_and_solution: value })} />
              <EditField label="트러블슈팅" value={Array.isArray(item.troubleshooting) ? item.troubleshooting.join('\n') : item.troubleshooting} onChange={value => patch(index, { troubleshooting: value })} />
              <EditField label="배운 점" value={Array.isArray(item.learning) ? item.learning.join('\n') : item.learning} onChange={value => patch(index, { learning: value })} />
            </div>
          </div>
        ))}
      </div>
    </EditPanel>
  );
}

/* ── 개발 — 시스템 아키텍처 · 프로젝트 흐름 (핵심 경험 페이지의 아키텍처 2탭을 순서대로) ── */
function DevArchitecture({ sr = {} }) {
  const validDiagram = (diagram) => ((Array.isArray(diagram?.nodes) ? diagram.nodes.filter(n => n?.label).length : 0) >= 2 ? diagram : null);
  const techs = (sr.projectOverview?.techStack || []).map(item => (typeof item === 'string' ? item : item?.name || '')).filter(Boolean);
  const arch = validDiagram(sr.architectureDiagram) || buildFallbackDiagram(techs);
  const flow = validDiagram(sr.flowDiagram);
  if (!arch && !flow) return null;
  return (
    <div className="space-y-6">
      {arch && (
        <div>
          <SectionLabel en="Architecture">시스템 아키텍처</SectionLabel>
          <div className="overflow-x-auto rounded-2xl border border-surface-200 p-4">
            <ArchitectureDiagram diagram={arch} />
          </div>
        </div>
      )}
      {flow && (
        <div>
          <SectionLabel en="User Flow">프로젝트 흐름</SectionLabel>
          <div className="overflow-x-auto rounded-2xl border border-surface-200 p-4">
            <ArchitectureDiagram diagram={flow} />
          </div>
        </div>
      )}
    </div>
  );
}

/* Impact×Effort 사분면 라벨 — 핵심 경험 페이지 quadrantOf와 동일 규칙(midpoint 3) */
const quadrantOf = (impact, effort) => {
  if (!(impact >= 1 && effort >= 1)) return null;
  if (impact >= 3 && effort <= 3) return 'QUICK WIN';
  if (impact >= 3) return '전략 과제';
  if (effort <= 3) return '점진 개선';
  return '재검토';
};

/* ── 기획/PM — 의사결정 & 어려움 해결 (우선순위 매트릭스 + 01 상황 → 02 채택/기각 → 03 난관 돌파 → 04 결과) ── */
function PmDecisionLog({ keyExperiences = [] }) {
  const items = keyExperiences
    .map((ke, index) => ({ ke, jd: ke?.jobData || {}, index }))
    .filter(({ ke, jd }) => clean(ke?.title) || clean(ke?.context || ke?.situation) || clean(ke?.result)
      || clean(jd.decision) || clean(jd.alternatives) || clean(jd.obstacle) || clean(jd.resolution) || clean(jd.stakeholders));
  if (items.length === 0) return null;
  const matrixItems = items.map(({ ke, jd, index }) => {
    const impact = Number(jd.impact), effort = Number(jd.effort);
    if (!(impact >= 1 && impact <= 5 && effort >= 1 && effort <= 5)) return null;
    return { n: index + 1, label: clean(ke?.title) || `의사결정 ${index + 1}`, impact, effort };
  }).filter(Boolean);

  return (
    <div>
      <SectionLabel en="Decision & Problem-Solving">의사결정 &amp; 어려움 해결</SectionLabel>
      {matrixItems.length > 0 && <div className="mb-2.5"><PriorityMatrix items={matrixItems} accent={ACCENT} /></div>}
      <div className="space-y-2.5">
        {items.map(({ ke, jd, index }) => {
          const quad = quadrantOf(Number(jd.impact), Number(jd.effort));
          const metric = clean(ke?.afterMetric) || clean(ke?.metric);
          const stages = [
            { no: '01', label: '상황', body: <p className="text-[12.5px] leading-[1.65] text-bluewood-600">{clean(ke?.context || ke?.situation) || '—'}</p> },
            {
              no: '02', label: '의사결정', body: (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'rgba(0,47,108,0.05)', borderLeft: `2px solid ${ACCENT}` }}>
                    <p className="text-[10.5px] font-black tracking-wide" style={{ color: ACCENT }}>✓ 채택</p>
                    <p className="mt-0.5 text-[12.5px] font-bold leading-[1.6] text-bluewood-900">{clean(jd.decision) || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-surface-50 px-3 py-2.5">
                    <p className="text-[10.5px] font-black tracking-wide text-bluewood-400">✕ 기각</p>
                    <p className="mt-0.5 text-[12px] leading-[1.6] text-bluewood-500">{clean(jd.alternatives) || '—'}</p>
                  </div>
                </div>
              ),
            },
            ...(clean(jd.obstacle) || clean(jd.resolution) ? [{
              no: '03', label: '어려움 돌파', body: (
                <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
                  <div>
                    <p className="mb-0.5 text-[11.5px] font-bold uppercase tracking-wide text-amber-700">부딪힌 난관</p>
                    <p className="text-[12px] leading-[1.6] text-bluewood-600">{clean(jd.obstacle) || '—'}</p>
                  </div>
                  <div>
                    <p className="mb-0.5 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: ACCENT }}>돌파 방법</p>
                    <p className="text-[12px] font-semibold leading-[1.6] text-bluewood-800">{clean(jd.resolution) || '—'}</p>
                  </div>
                </div>
              ),
            }] : []),
            { no: '04', label: '결과', body: <p className="text-[12.5px] font-semibold leading-[1.6] text-bluewood-900">{clean(ke?.result) || '—'}</p> },
          ];
          return (
            <div key={index} className="overflow-hidden rounded-xl border border-surface-200 bg-white">
              <div className="flex items-start gap-2.5 px-4 pt-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>Decision {String(index + 1).padStart(2, '0')}</p>
                    {quad && (
                      <span className="rounded px-1.5 py-0.5 font-mono text-[9.5px] font-black tracking-wide" style={{ backgroundColor: quad === 'QUICK WIN' ? 'rgba(4,120,87,0.1)' : 'rgba(0,47,108,0.07)', color: quad === 'QUICK WIN' ? '#047857' : ACCENT }}>{quad}</span>
                    )}
                  </div>
                  <p className="text-[13.5px] font-extrabold leading-snug text-bluewood-900">{clean(ke?.title) || `의사결정 ${index + 1}`}</p>
                </div>
                {metric && <p className="w-24 flex-shrink-0 pt-1 text-right text-[11.5px] font-bold text-caribbean-700">{metric}</p>}
              </div>
              <div className="px-4 py-2">
                <div className="divide-y divide-surface-100">
                  {stages.map(stage => (
                    <div key={stage.no} className="flex gap-2.5 py-2">
                      <span className="w-14 flex-shrink-0 pt-0.5 font-mono text-[10.5px] font-black text-bluewood-300">{stage.no} <span className="font-sans text-[10.5px] font-bold text-bluewood-400">{stage.label}</span></span>
                      <div className="min-w-0 flex-1">{stage.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 기획/PM — 서비스 타임라인 (저장한 단계 흐름, 없으면 핵심 경험 페이지와 같은 규칙으로 파생) ── */
function PmTimelineStrip({ sr = {} }) {
  const srKE = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
  const jobData = srKE.map(k => k?.jobData || {});
  const product = sr.product || {};
  const canvas = sr.leanCanvas || {};
  const js = sr.jobSpecific || {};
  const firstOf = values => values.map(clean).find(Boolean) || '';
  const defaults = [
    { phase: 'Discover', label: '문제 발견', color: ACCENT, value: clean(product.problem), fallback: '반복되는 핵심 문제를 발견합니다.' },
    { phase: 'Insight', label: '고객 인사이트', color: ACCENT, value: clean(canvas.customers) || firstOf(srKE.map(k => k?.context || k?.situation)), fallback: '문제가 가장 절실한 고객을 좁힙니다.' },
    { phase: 'Hypothesize', label: '가설 설정', color: ACCENT, value: firstOf(jobData.map(j => j.hypothesis)) || clean(product.solution), fallback: '검증 가능한 제품 가설을 세웁니다.' },
    { phase: 'Decide', label: '방향 결정', color: ACCENT, value: firstOf(jobData.map(j => j.decision)) || clean(js.strategy), fallback: '대안을 비교해 실행 방향을 정합니다.' },
    { phase: 'Validate', label: '검증', color: ACCENT, value: firstOf(jobData.map(j => j.validation)), fallback: '사용자 반응과 데이터로 확인합니다.' },
    { phase: 'Evolve', label: '결과와 배움', color: ACCENT, value: firstOf(srKE.map(k => k?.result)) || clean(js.businessImpact) || firstOf(srKE.map(k => k?.learning)), fallback: '결과를 다음 제품 판단으로 연결합니다.' },
  ];
  const stored = Array.isArray(sr.pmTimeline?.items) && sr.pmTimeline.items.length > 0 ? sr.pmTimeline.items : null;
  const items = (stored || defaults)
    .map(item => ({ phase: clean(item?.phase) || 'Stage', label: clean(item?.label) || '새 단계', value: clean(item?.value) || clean(item?.fallback), color: /^#[0-9a-f]{6}$/i.test(item?.color || '') ? item.color : ACCENT }))
    .filter(item => item.label || item.phase)
    .slice(0, 8);
  if (items.length === 0) return null;
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
  const slots = { 1: [0], 2: [0, 4], 3: [0, 2, 5], 4: [0, 1, 3, 5], 5: [0, 1, 2, 4, 6], 6: [0, 1, 2, 3, 4, 6], 7: [0, 1, 2, 3, 4, 5, 6], 8: [0, 1, 2, 3, 4, 5, 6, 7] };
  const activePositions = slots[items.length] || slots[8];
  const timelineDescription = clean(sr.pmTimeline?.description) || '문제 발견부터 검증과 배움까지, 제품이 발전한 핵심 흐름입니다.';
  // 좌표는 원래 설계(높이 400)를 그대로 두고 렌더링에서만 축소한다.
  const CURVE_H = 268;
  const s = CURVE_H / 400;
  return (
    <section>
      <div className="mb-2.5">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>Product Journey</p>
        <h3 className="text-[13.5px] font-extrabold text-bluewood-900">제품 여정</h3>
        <p className="text-[10.5px] leading-[1.5] text-bluewood-400">{timelineDescription}</p>
      </div>
      <div className="relative hidden w-full min-w-0 overflow-hidden rounded-xl border border-[#d8e4f0] bg-white xl:block" style={{ height: CURVE_H }}>
        <svg className="absolute left-0 top-0 w-full" style={{ height: CURVE_H }} viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true"><path d="M 70 150 C 70 108, 105 80, 155 80 H 845 C 892 80, 915 108, 915 165 C 915 220, 886 250, 840 250 H 95" fill="none" stroke="#91a9c0" strokeWidth="1.5" strokeLinecap="round" /></svg>
        {items.map((item, i) => {
          const pos = positions[activePositions[i]];
          return <div key={`${item.phase}-${i}`}><span className={`absolute z-[2] flex items-center justify-center rounded-full text-[7px] font-black text-white ${i === 0 ? 'h-[18px] w-[34px] rounded-[9px]' : 'h-[18px] w-[18px]'}`} style={{ left: pos.left, top: pos.nodeTop * s, transform: 'translate(-50%, -50%)', backgroundColor: item.color }}>{String(i).padStart(2, '0')}</span><div className="absolute z-[1] w-[168px]" style={{ left: pos.cardLeft, top: pos.cardTop * s }}><p className="font-mono text-[7px] font-bold uppercase tracking-[0.1em] text-bluewood-300">{item.phase}</p><p className="text-[10.5px] font-black leading-tight text-bluewood-900">{item.label}</p><p className="mt-1 line-clamp-3 break-words text-[9px] leading-[1.45] text-bluewood-500">{item.value}</p></div></div>;
        })}
      </div>
      <ol className="relative space-y-0 overflow-hidden rounded-xl border border-[#d8e4f0] bg-white px-3 py-2 xl:hidden">
        <span className="absolute bottom-7 left-[22px] top-7 w-px bg-[#91a9c0]" />
        {items.map((item, i) => <li key={`${item.phase}-${i}`} className="relative flex gap-2.5 py-2"><span className="relative z-[1] mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[7px] font-black text-white" style={{ backgroundColor: item.color }}>{String(i).padStart(2, '0')}</span><div className="min-w-0"><p className="font-mono text-[7.5px] font-bold uppercase tracking-[0.12em] text-bluewood-300">{item.phase}</p><p className="text-[11.5px] font-extrabold text-bluewood-900">{item.label}</p><p className="whitespace-pre-wrap break-words text-[11px] leading-[1.5] text-bluewood-500">{item.value}</p></div></li>)}
      </ol>
    </section>
  );
}

/* ── 기획/PM — 프로젝트 산출물 파일 (핵심 경험 페이지 좌측 레일의 PmDeliverables) ── */
const FILE_BADGE_COLORS = { pdf: '#dc2626', ppt: '#ea580c', pptx: '#ea580c', hwp: '#2563eb', hwpx: '#2563eb', doc: '#2563eb', docx: '#2563eb', xls: '#16a34a', xlsx: '#16a34a', key: '#7c3aed' };
function PmDeliverableFiles({ files = [], compact = false }) {
  const list = (Array.isArray(files) ? files : []).filter(file => file?.url && file?.name);
  if (list.length === 0) return null;
  return (
    <div>
      <SectionLabel en="Deliverables">프로젝트 산출물</SectionLabel>
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
        {list.map((file, i) => {
          const ext = String(file.ext || file.name.split('.').pop() || '').toLowerCase();
          const isLink = file.kind === 'link' || !ext || ext === file.name.toLowerCase();
          return (
            <a key={file.id || i} href={file.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2.5 rounded-xl border border-surface-200 bg-white px-3 py-2.5 transition-colors hover:border-primary-200 hover:bg-primary-50/40">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[9.5px] font-black uppercase text-white" style={{ backgroundColor: FILE_BADGE_COLORS[ext] || (file.source === 'github' ? '#181717' : '#5d7186') }}>{file.source === 'github' ? 'GIT' : (isLink ? 'LINK' : (ext.slice(0, 4) || 'FILE'))}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-bluewood-700 group-hover:text-primary-700">{file.name}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/* ── 마케터 — 시장 리서치 스토리보드 (핵심 경험 페이지의 Desk Research 카드·차트) ── */
function MarketerResearchBoard({ sr = {} }) {
  const info = sr.research?.deskResearchInfographic || sr.marketResearch?.deskResearchInfographic || sr.deskResearchInfographic || {};
  const cards = (Array.isArray(info.cards) ? info.cards : []).map(c => {
    const bars = (Array.isArray(c?.bars) ? c.bars : [])
      .map(b => ({ label: clean(b?.label), value: Number(b?.value), unit: clean(b?.unit) || clean(c?.unit) || '%' }))
      .filter(b => b.label && Number.isFinite(b.value)).slice(0, 5);
    return {
      heading: clean(c?.question),
      desc: clean(c?.finding),
      value: Number.isFinite(Number(c?.value)) ? Number(c.value) : null,
      unit: clean(c?.unit) || '%',
      valueLabel: clean(c?.valueLabel),
      bars,
      source: [clean(c?.sourcePublisher), clean(c?.sourceTitle)].filter(Boolean).join(' · '),
    };
  }).filter(c => c.heading && (c.bars.length > 0 || c.value != null)).slice(0, 4);
  if (cards.length === 0) return null;

  return (
    <div>
      <SectionLabel en="Desk Research">{clean(info.title) || '시장 리서치'}</SectionLabel>
      {clean(info.subtitle) && <p className="-mt-1 mb-3 text-[12px] leading-[1.6] text-bluewood-500">{clean(info.subtitle)}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card, i) => {
          const maxBar = Math.max(1, ...card.bars.map(b => Math.abs(b.value)));
          return (
            <div key={i} className="rounded-2xl border border-surface-200 bg-white p-4">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 text-[26px] font-black leading-[0.9]" style={{ color: ACCENT }}>{i + 1}</span>
                <p className="pt-[2px] text-[13.5px] font-black leading-snug text-bluewood-900" style={{ wordBreak: 'keep-all' }}>{card.heading}</p>
              </div>
              {card.desc && <p className="mt-2 text-[12px] leading-[1.65] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{card.desc}</p>}
              <div className="mt-3">
                {card.bars.length > 0 ? (
                  <div className="space-y-1.5">
                    {card.bars.map((bar, bi) => (
                      <div key={bi} className="flex items-center gap-2 text-[12px]">
                        <span className="w-[34%] flex-shrink-0 truncate text-bluewood-500">{bar.label}</span>
                        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-100">
                          <div className="h-full rounded-full" style={{ width: `${Math.round((Math.abs(bar.value) / maxBar) * 100)}%`, backgroundColor: ACCENT }} />
                        </div>
                        <span className="w-14 flex-shrink-0 text-right font-bold tabular-nums text-bluewood-800">{bar.value}{bar.unit}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[30px] font-black leading-none tracking-tight" style={{ color: ACCENT }}>
                    {card.value}<span className="text-[15px]">{card.unit}</span>
                    {card.valueLabel && <span className="ml-2 align-middle text-[11.5px] font-bold text-bluewood-400">{card.valueLabel}</span>}
                  </p>
                )}
              </div>
              {card.source && <p className="mt-2.5 text-[11.5px] text-bluewood-300">출처 · {card.source}</p>}
            </div>
          );
        })}
      </div>
      {clean(info.conclusion) && (
        <p className="mt-3 rounded-xl px-4 py-3 text-[12.5px] font-semibold leading-[1.65] text-white" style={{ backgroundColor: ACCENT }}>{clean(info.conclusion)}</p>
      )}
    </div>
  );
}

/* ── 마케터 — 포지셔닝 리포트 (추천 포지션 · 강점/보완점 · 추천 문장) ── */
function MarketerPositioningReport({ kit = {} }) {
  const report = kit.positioningReport || {};
  const textOf = item => clean(typeof item === 'string' ? item : item?.text || item?.name || '');
  const positions = (Array.isArray(report.recommendedPositions) ? report.recommendedPositions : [])
    .map(p => ({ name: clean(p?.name || (typeof p === 'string' ? p : '')), reason: clean(p?.reason || p?.why || p?.desc) }))
    .filter(p => p.name).slice(0, 3);
  const strengths = (Array.isArray(report.strengths) ? report.strengths : []).map(textOf).filter(Boolean).slice(0, 4);
  const weaknesses = (Array.isArray(report.weaknesses) ? report.weaknesses : []).map(textOf).filter(Boolean).slice(0, 4);
  const recommendation = clean(report.recommendation);
  if (positions.length === 0 && strengths.length === 0 && weaknesses.length === 0 && !recommendation) return null;
  return (
    <div className="rounded-2xl border border-surface-200 p-5">
      <SectionLabel en="Positioning">포지셔닝 리포트</SectionLabel>
      {positions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {positions.map((p, i) => (
            <div key={i} className="rounded-xl border border-surface-200 bg-surface-50/60 px-3 py-2">
              <p className="text-[12px] font-extrabold text-bluewood-900">{p.name}</p>
              {p.reason && <p className="mt-0.5 max-w-[240px] text-[11.5px] leading-[1.5] text-bluewood-500">{p.reason}</p>}
            </div>
          ))}
        </div>
      )}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {strengths.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-bold text-caribbean-700">강점</p>
              <ul className="space-y-1">
                {strengths.map((line, i) => <li key={i} className="flex gap-2 text-[12px] leading-[1.6] text-bluewood-600"><span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-caribbean-500" /><span className="min-w-0">{line}</span></li>)}
              </ul>
            </div>
          )}
          {weaknesses.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-bold text-amber-700">보완점</p>
              <ul className="space-y-1">
                {weaknesses.map((line, i) => <li key={i} className="flex gap-2 text-[12px] leading-[1.6] text-bluewood-600"><span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" /><span className="min-w-0">{line}</span></li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      {recommendation && (
        <p className="mt-4 border-l-2 pl-3 text-[12.5px] font-semibold leading-[1.65] text-bluewood-800" style={{ borderColor: ACCENT }}>{recommendation}</p>
      )}
    </div>
  );
}

/* ── 전 직군 — 본문·첨부 (간략 보기 자유 본문 caseStudy.body: 텍스트 + 사진) ── */
function CaseBodyCard({ caseStudy }) {
  const segs = (Array.isArray(caseStudy?.body) ? caseStudy.body : [])
    .filter(seg => (seg?.type === 'image' ? seg.content : clean(seg?.content)));
  if (segs.length === 0) return null;
  return (
    <div>
      <SectionLabel en="Appendix">본문 · 첨부 자료</SectionLabel>
      <div className="space-y-3">
        {segs.map((seg, i) => (
          seg.type === 'image' ? (
            <img key={seg.id || i} src={seg.content} alt="" className="rounded-xl border border-surface-200" style={{ width: seg.width || '100%', maxWidth: '100%' }} />
          ) : seg.variant === 'heading' ? (
            <p key={seg.id || i} className="pt-1 text-[14.5px] font-extrabold text-bluewood-900">{clean(seg.content)}</p>
          ) : (
            <p key={seg.id || i} className="whitespace-pre-line text-[13px] leading-[1.75] text-bluewood-600">{clean(seg.content)}</p>
          )
        ))}
      </div>
    </div>
  );
}

/* 캔버스 칸 본문 — 핵심 경험 페이지처럼 장문은 짧은 불릿으로 정돈해 칸이 통째로 길어지는 것을 막는다 */
function toCellBullets(value, max = 5) {
  const text = clean(value);
  if (!text) return [];
  let parts = text.split('\n').map(s => s.trim()).filter(Boolean);
  if (parts.length === 1 && parts[0].length > 70) {
    parts = (parts[0].match(/[^.!?。]+[.!?。]?/g) || [parts[0]]).map(s => s.trim()).filter(Boolean);
  }
  return parts.slice(0, max);
}

/* ── 기획/PM — 린 캔버스 격자 (핵심 경험 페이지의 캔버스 전체 칸) ── */
function LeanCanvasCard({ sr = {} }) {
  const product = sr.product || {};
  const canvas = sr.leanCanvas || {};
  const pv = sr.portfolioVisuals || {};
  const metricItems = [
    ...(Array.isArray(pv.kpis) ? pv.kpis : []).map(k => ({ label: clean(k?.label), value: clean(k?.value) })),
    ...(Array.isArray(pv.goals) ? pv.goals : []).map(g => ({ label: clean(g?.label), value: clean(g?.actual) || clean(g?.target) })),
  ].filter(m => m.label || m.value).slice(0, 3);
  const groups = [
    [
      { label: '문제', en: 'Problem', bullets: toCellBullets(product.problem, 4), tall: true },
      { label: '기존 솔루션', en: 'Existing Alternatives', bullets: toCellBullets(canvas.existingAlternatives || product.solution, 3) },
    ],
    [
      { label: '고유 가치 제안', en: 'Unique Value Proposition', bullets: toCellBullets(canvas.uvp, 4), tall: true },
      { label: '핵심지표', en: 'Key Metrics', metrics: metricItems },
    ],
    [
      { label: '고객 세그먼트', en: 'Customer Segments', bullets: toCellBullets(canvas.customers, 4), tall: true },
      { label: '얼리어답터', en: 'Early Adopters', bullets: toCellBullets(canvas.earlyAdopters, 3) },
    ],
  ];
  const hasContent = groups.flat().some(cell => cell.metrics?.length || cell.bullets?.length);
  if (!hasContent) return null;

  const Cell = ({ cell }) => (
    <div className={`flex min-w-0 flex-col bg-[#fefefe] p-3 ${cell.tall ? 'min-h-[104px] sm:min-h-0' : 'min-h-[80px] sm:min-h-0'}`}>
      <div className="mb-2 text-center">
        <p className="text-[12px] font-black tracking-tight text-[#3d5262]">{cell.label}</p>
        <span className="block font-mono text-[7px] font-bold uppercase tracking-[0.12em] text-[#91a0ab]">{cell.en}</span>
      </div>
      {cell.metrics ? (
        cell.metrics.length > 0 ? <ul className="space-y-1.5">{cell.metrics.map((item, i) => <li key={i} className="flex min-w-0 items-start justify-between gap-3 text-[11.5px] leading-[1.55]"><span className="min-w-0 break-words text-bluewood-500">{item.label || '검증 지표'}</span><span className="flex-shrink-0 font-black" style={{ color: ACCENT }}>{item.value || '—'}</span></li>)}</ul> : <p className="text-[11.5px] text-bluewood-300">검증 지표를 입력해 주세요</p>
      ) : cell.bullets.length === 1 ? (
        <p className="min-w-0 whitespace-pre-wrap break-words text-[12px] leading-[1.65] text-bluewood-600">{cell.bullets[0]}</p>
      ) : (
        <ul className="min-w-0 space-y-1">{cell.bullets.map((line, i) => <li key={i} className="flex min-w-0 gap-1.5 text-[12px] leading-[1.55] text-bluewood-600"><span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-bluewood-300" /><span className="min-w-0 whitespace-pre-wrap break-words">{line}</span></li>)}</ul>
      )}
    </div>
  );

  return (
    <section className="w-full min-w-0">
      <div className="mb-2 bg-[#3d5262] px-4 py-2 text-center text-white">
        <div className="flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-0.5">
          <h2 className="text-[15px] font-bold tracking-tight sm:text-[17px]">리너 캔버스</h2>
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">Leaner Canvas</span>
        </div>
        <p className="mt-0.5 text-[10.5px] leading-[1.45] text-white/65">문제, 차별화된 가치, 핵심 고객과 검증 지표를 한 장에 압축했습니다.</p>
      </div>
      <div className="grid w-full min-w-0 gap-[3px] border-[3px] border-[#3d5262] bg-[#3d5262] sm:grid-cols-3">
        {groups.map((group, i) => <div key={i} className="grid min-w-0 gap-[3px] bg-[#3d5262] sm:grid-rows-[minmax(126px,auto)_minmax(88px,auto)]">{group.map(cell => <Cell key={cell.label} cell={cell} />)}</div>)}
      </div>
    </section>
  );
}

/* ── 기획/PM — 기획 사이클 스트립 (문서의 읽는 순서 = 일하는 방식) ── */
function PmCycleStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-b border-surface-100 pb-2">
      {[['Define', '문제 정의'], ['Hypothesize', '가설 수립'], ['Test', '검증'], ['Decide', '판단']].map(([en, ko], i) => (
        <span key={en} className="flex items-center gap-1">
          {i > 0 && <span className="text-[10.5px] text-bluewood-200">→</span>}
          <span className="font-mono text-[8.5px] font-black uppercase tracking-[0.14em]" style={{ color: ACCENT }}>{en}</span>
          <span className="text-[10.5px] font-semibold text-bluewood-400">{ko}</span>
        </span>
      ))}
    </div>
  );
}

/* ── 기획/PM — AS-IS → TO-BE 스티키노트 보드 ── */
const STICKY_COLORS = ['#c4b5fd', '#5eead4', '#fca5a5', '#fde047', '#86efac', '#f9a8d4', '#93c5fd', '#fdba74'];
const STICKY_ROT = [-3, 2.2, -1.6, 3, -2.4, 1.4, -2.8, 2];
function StickyNote({ text, idx = 0, colorIdx }) {
  return (
    <div
      className="flex min-h-[74px] min-w-[104px] max-w-[190px] flex-1 items-center justify-center rounded-[2px] px-2.5 py-2.5 shadow-[0_4px_10px_-4px_rgba(15,40,80,0.3)] transition-transform hover:z-[2] hover:scale-[1.03] sm:min-w-[118px]"
      style={{ backgroundColor: STICKY_COLORS[(colorIdx ?? idx) % STICKY_COLORS.length], transform: `rotate(${STICKY_ROT[idx % STICKY_ROT.length]}deg)` }}
    >
      <p className="text-center text-[10.5px] font-bold leading-[1.45] text-[#1f2937]" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{text}</p>
    </div>
  );
}
function PmAsIsToBeBoard({ sr = {} }) {
  const product = sr.product || {};
  const asIs = toCellBullets(product.problem, 3);
  const toBe = toCellBullets(product.solution, 3);
  const keyExperiences = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
  const pv = sr.portfolioVisuals || {};
  const decision = clean(sr.jobSpecific?.strategy) || keyExperiences.map(item => clean(item?.jobData?.decision)).find(Boolean) || '';
  const parseNum = value => { const match = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return match ? Number(match[0]) : null; };
  const splitValue = value => { const match = String(value || '').trim().match(/(-?[\d,.]+)\s*(.*)/); return match ? { value: Number(match[1].replace(/,/g, '')), unit: match[2] || '' } : null; };
  const rawImpacts = [
    ...(Array.isArray(pv.kpis) ? pv.kpis : []).map(item => ({ label: clean(item?.label), actual: clean(item?.value), target: clean(item?.target) })),
    ...(Array.isArray(pv.goals) ? pv.goals : []).map(item => ({ label: clean(item?.label), actual: clean(item?.actual), target: clean(item?.target) })),
    ...keyExperiences.map(item => ({ label: clean(item?.title) || '핵심 변화', actual: clean(item?.afterMetric || item?.metric), before: clean(item?.beforeMetric), target: '' })),
  ].filter(item => item.label && item.actual && parseNum(item.actual) != null);
  const seen = new Set();
  const impacts = rawImpacts.filter(item => { const key = item.actual.replace(/[\s,()]/g, ''); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 3);
  if (asIs.length === 0 && toBe.length === 0 && impacts.length === 0) return null;
  const hasPanels = asIs.length > 0 || toBe.length > 0;
  const asRows = asIs.length ? asIs : ['현재 상태·문제를 입력해 주세요'];
  const toRows = toBe.length ? toBe : ['개선된 목표 상태를 입력해 주세요'];
  return (
    <section className="w-full min-w-0">
      <div className="mb-2.5"><p className="font-mono text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: ACCENT }}>Transformation</p><h3 className="text-[13.5px] font-extrabold text-bluewood-900">AS-IS → TO-BE</h3><p className="text-[10.5px] leading-[1.5] text-bluewood-400">문제를 어떤 상태 변화로 설계했고, 실제로 어떤 결과를 만들었는지 보여줍니다.</p></div>
      <div className="w-full min-w-0 overflow-hidden rounded-xl border border-surface-200 bg-white">
        {hasPanels && <div className="relative p-3 sm:p-4">
          <div className="grid grid-cols-2"><div className="pr-3 text-center sm:pr-6"><p className="text-[14px] font-black tracking-tight text-bluewood-500 sm:text-[16px]">AS-IS</p><p className="text-[10px] font-semibold text-bluewood-300">현재 · 문제 상태</p></div><div className="pl-3 text-center sm:pl-6"><p className="text-[14px] font-black tracking-tight sm:text-[16px]" style={{ color: ACCENT }}>TO-BE</p><p className="text-[10px] font-semibold text-bluewood-300">개선 · 목표 상태</p></div></div>
          <div className="relative mt-2 grid min-w-0 grid-cols-2 gap-x-2 border-t-2 border-bluewood-200 pt-4 sm:gap-x-4"><span className="pointer-events-none absolute -top-[2px] bottom-1 left-1/2 w-[2px] -translate-x-1/2 rounded bg-bluewood-200" /><div className="flex min-w-0 flex-wrap content-start justify-center gap-x-2 gap-y-2.5 pr-1 sm:pr-3">{asRows.map((text, i) => <StickyNote key={i} text={text} idx={i} />)}</div><div className="flex min-w-0 flex-wrap content-start justify-center gap-x-2 gap-y-2.5 pl-1 sm:pl-3">{toRows.map((text, i) => <StickyNote key={i} text={text} idx={i + 3} colorIdx={i} />)}</div></div>
          {decision && <div className="mx-auto mt-3 flex max-w-2xl items-center justify-center gap-2 rounded-lg bg-primary-50/70 px-3 py-2 text-center"><span className="flex-shrink-0 font-mono text-[8px] font-black uppercase tracking-[0.12em] text-primary-400">PM 판단</span><p className="text-[11px] font-semibold leading-[1.5] text-primary-800">{decision}</p></div>}
        </div>}
        {impacts.length > 0 && <div className="border-t border-surface-200 bg-surface-50/45 px-3.5 py-3 sm:px-4"><div className="mb-2 flex items-baseline justify-between gap-3"><h3 className="text-[11.5px] font-extrabold text-bluewood-900">변화를 증명한 핵심 수치</h3><span className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-bluewood-300">Measured impact</span></div><div className={`grid overflow-hidden rounded-lg border border-surface-200 bg-white ${impacts.length === 2 ? 'sm:grid-cols-2 sm:divide-x' : impacts.length >= 3 ? 'sm:grid-cols-3 sm:divide-x' : ''} divide-surface-200`}>{impacts.map((item, i) => { const split = splitValue(item.actual); const actual = parseNum(item.actual); const before = parseNum(item.before); const max = Math.max(Math.abs(before || 0), Math.abs(actual || 0), 1); return <div key={i} className={`min-w-0 px-3 py-2.5 ${i > 0 ? 'border-t border-surface-200 sm:border-t-0' : ''}`}><p className="truncate text-[10.5px] font-bold text-bluewood-400">{item.label}</p><p className="mt-0.5 text-[17px] font-black leading-none tracking-tight text-bluewood-900">{split ? `${split.value.toLocaleString()}${split.unit}` : item.actual}</p>{before != null && before !== actual && <div className="mt-2 space-y-1.5">{[['이전', before, item.before, '#cbd5e1'], ['이후', actual, item.actual, ACCENT]].map(row => <div key={row[0]}><div className="mb-0.5 flex justify-between text-[8px] font-bold text-bluewood-300"><span>{row[0]}</span><span className="text-bluewood-500">{row[2]}</span></div><div className="h-1 overflow-hidden rounded-full bg-surface-100"><span className="block h-full rounded-full" style={{ width: `${Math.max(4, (Math.abs(row[1]) / max) * 100)}%`, backgroundColor: row[3] }} /></div></div>)}</div>}</div>; })}</div></div>}
      </div>
    </section>
  );
}

/* ── 기획/PM — 검증 성과 (KPI 타일 + 목표 대비 달성 바) ── */
function PmMetricTiles({ sr = {} }) {
  const pv = sr.portfolioVisuals || {};
  const kpis = (Array.isArray(pv.kpis) ? pv.kpis : [])
    .map(k => ({ label: clean(k?.label), value: clean(k?.value), target: clean(k?.target) }))
    .filter(k => k.label && k.value).slice(0, 4);
  const numOf = value => { const m = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };
  const goals = (Array.isArray(pv.goals) ? pv.goals : [])
    .map(g => ({ label: clean(g?.label), target: clean(g?.target), actual: clean(g?.actual) }))
    .filter(g => g.label && (g.target || g.actual)).slice(0, 4);
  if (kpis.length === 0 && goals.length === 0) return null;
  return (
    <div>
      <SectionLabel en="Evidence">검증 성과</SectionLabel>
      {kpis.length > 0 && (
        <div className={`grid gap-2 ${kpis.length === 1 ? 'grid-cols-1 sm:grid-cols-2' : kpis.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {kpis.map((k, i) => (
            <div key={i} className="relative overflow-hidden rounded-lg border border-surface-200 bg-white px-3 py-2">
              <span className="absolute inset-x-0 top-0 h-[2px]" style={{ backgroundColor: ACCENT }} />
              <p className="truncate text-[10.5px] font-bold uppercase tracking-wide text-bluewood-300">{k.label}</p>
              <p className="text-[15px] font-extrabold leading-tight text-bluewood-900">{k.value}</p>
              {k.target && <p className="truncate text-[10.5px] font-semibold text-bluewood-400">목표 {k.target}</p>}
            </div>
          ))}
        </div>
      )}
      {goals.length > 0 && (
        <div className={`space-y-2 rounded-lg border border-surface-200 bg-white p-3 ${kpis.length > 0 ? 'mt-2' : ''}`}>
          {goals.map((goal, i) => {
            const target = numOf(goal.target), actual = numOf(goal.actual);
            const pct = target != null && actual != null && target !== 0 ? Math.max(0, Math.min(100, Math.round((actual / target) * 100))) : null;
            const pass = target != null && actual != null && actual >= target;
            return (
              <div key={i}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-[11.5px]">
                  <span className="min-w-0 truncate font-semibold text-bluewood-700">{goal.label}</span>
                  <span className="flex-shrink-0 tabular-nums text-bluewood-500">
                    {goal.actual || '—'} <span className="text-bluewood-300">/ 목표 {goal.target || '—'}</span>
                    {pct != null && <span className={`ml-1.5 font-black ${pass ? 'text-caribbean-700' : ''}`} style={pass ? undefined : { color: ACCENT }}>{pass ? 'PASS' : `${pct}%`}</span>}
                  </span>
                </div>
                {pct != null && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pass ? '#04bd5e' : ACCENT }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── 기획/PM — 가설 검증 표 (핵심 경험 페이지의 Hypothesis Design 표 축약판) ── */
function PmValidationTable({ sr = {}, keyExperiences = [] }) {
  const stored = Array.isArray(sr.pmHypotheses) ? sr.pmHypotheses : [];
  const rows = (stored.length ? stored : keyExperiences.map(ke => {
    const jd = ke?.jobData || {};
    return {
      hypothesis: jd.hypothesis,
      kpi: ke?.metricLabel,
      target: '',
      achievement: ke?.afterMetric || ke?.metric,
      note: jd.note || jd.failureReason,
    };
  })).map(row => ({
    hypothesis: clean(row?.hypothesis),
    kpi: clean(row?.kpi),
    target: clean(row?.target),
    achievement: clean(row?.achievement || row?.actual),
    note: clean(row?.note),
  })).filter(row => row.hypothesis || row.kpi || row.target || row.achievement || row.note);
  if (rows.length === 0) return null;

  return (
    <div>
      <SectionLabel en="Hypothesis Design">가설 및 검증</SectionLabel>
      <div className="overflow-x-auto rounded-xl border border-surface-200">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead className="text-white" style={{ backgroundColor: '#0e1526' }}>
            <tr>
              <th className="w-9 px-3 py-2.5 font-mono text-[11.5px] font-black">#</th>
              <th className="px-3 py-2.5 text-[12px] font-bold">가설</th>
              <th className="w-[22%] px-3 py-2.5 text-[12px] font-bold">핵심 KPI</th>
              <th className="w-[13%] px-3 py-2.5 text-right text-[12px] font-bold">목표</th>
              <th className="w-[13%] px-3 py-2.5 text-right text-[12px] font-bold">달성</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((row, i) => (
              <tr key={i} className={i % 2 === 1 ? 'bg-surface-50/60' : 'bg-white'}>
                <td className="px-3 py-2.5 align-top font-mono text-[12px] font-black" style={{ color: ACCENT }}>H{i + 1}</td>
                <td className="px-3 py-2.5 align-top text-[12px] leading-[1.6] text-bluewood-700">
                  {row.hypothesis || '—'}
                  {row.note && <p className="mt-1 text-[12px] leading-[1.5] text-bluewood-400">{row.note}</p>}
                </td>
                <td className="px-3 py-2.5 align-top text-[12px] font-semibold leading-[1.5] text-bluewood-800">{row.kpi || '—'}</td>
                <td className="px-3 py-2.5 text-right align-top text-[12px] tabular-nums text-bluewood-500">{row.target || '—'}</td>
                <td className="px-3 py-2.5 text-right align-top text-[12px] font-bold tabular-nums text-bluewood-900">{row.achievement || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── 마케터 — 캠페인 스토리(퍼널) + KPI 타일 + 이력서 문장 ── */
function MarketerCampaignCard({ kit = {} }) {
  const funnel = kit.funnel || {};
  const steps = [
    ['문제', funnel.problem], ['목표', funnel.goal], ['타깃', funnel.target],
    ['전략', funnel.strategy], ['실행', funnel.execution], ['성과', funnel.result], ['인사이트', funnel.insight],
  ].map(([label, value]) => ({ label, text: clean(value) })).filter(step => step.text);
  const kpis = (Array.isArray(kit.kpis) ? kit.kpis : [])
    .map(k => ({ name: clean(k?.name), value: clean(k?.value), status: clean(k?.status) })).filter(k => k.name).slice(0, 4);
  const bullets = ((Array.isArray(kit.resumeVariants) && kit.resumeVariants.length > 0)
    ? kit.resumeVariants.map(v => clean(v?.sentence))
    : (Array.isArray(kit.resumeBullets) ? kit.resumeBullets : []).map(clean)).filter(Boolean).slice(0, 4);
  const positioning = clean(kit.positioning);
  if (steps.length === 0 && kpis.length === 0 && bullets.length === 0 && !positioning) return null;

  return (
    <div className="space-y-5">
      {(steps.length > 0 || positioning) && (
        <div className="rounded-2xl border border-surface-200 p-5">
          <SectionLabel en="Campaign">캠페인 스토리</SectionLabel>
          {positioning && (
            <p className="mb-3 border-l-2 pl-3 text-[13px] font-semibold leading-[1.65] text-bluewood-800" style={{ borderColor: ACCENT }}>{positioning}</p>
          )}
          <div className="space-y-2.5">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="mt-0.5 w-[52px] flex-shrink-0 text-[11.5px] font-black uppercase tracking-wide" style={{ color: ACCENT }}>{step.label}</span>
                <p className="min-w-0 whitespace-pre-line text-[12.5px] leading-[1.65] text-bluewood-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {kpis.length > 0 && (
        <div>
          <SectionLabel en="KPI">캠페인 KPI</SectionLabel>
          <div className={`grid gap-2.5 ${kpis.length === 1 ? 'grid-cols-1 sm:grid-cols-2' : kpis.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
            {kpis.map((k, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-surface-200 bg-white px-3.5 py-3">
                <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: ACCENT }} />
                <p className="truncate text-[11.5px] font-bold uppercase tracking-wide text-bluewood-300">{k.name}</p>
                <p className="mt-1 text-[17px] font-extrabold leading-tight text-bluewood-900">{k.value || '—'}</p>
                {k.status && <p className="mt-0.5 truncate text-[11.5px] font-semibold text-bluewood-400">{k.status}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {bullets.length > 0 && (
        <div className="rounded-2xl border border-surface-200 p-5">
          <SectionLabel en="Resume">이력서 문장</SectionLabel>
          <ul className="space-y-2">
            {bullets.map((line, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-[1.65] text-bluewood-700">
                <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: ACCENT }} />
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PmFullEditor({ sr, onChange }) {
  const product = sr.product || {};
  const canvas = sr.leanCanvas || {};
  const rows = Array.isArray(sr.pmHypotheses) ? sr.pmHypotheses : [];
  const patchProduct = (key, value) => onChange({ ...sr, product: { ...product, [key]: value } });
  const patchCanvas = (key, value) => onChange({ ...sr, leanCanvas: { ...canvas, [key]: value } });
  const patchRow = (index, changes) => onChange({ ...sr, pmHypotheses: rows.map((row, i) => i === index ? { ...row, ...changes } : row), pmHypothesesSource: 'manual' });
  const canvasFields = [
    ['existingAlternatives', '기존 솔루션'], ['uvp', '고유 가치 제안'], ['customers', '고객 세그먼트'],
    ['earlyAdopters', '얼리어답터'], ['channels', '채널'], ['costStructure', '비용 구조'], ['revenueStreams', '수익원'],
  ];
  return (
    <EditPanel>
      <p className="mb-3 text-[12px] font-black text-bluewood-600">서비스·린 캔버스 전체 편집</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <EditField label="서비스명" value={product.name} multiline={false} onChange={value => patchProduct('name', value)} />
        <EditField label="한 줄 소개" value={product.tagline} multiline={false} onChange={value => patchProduct('tagline', value)} />
        <EditField label="문제" value={product.problem} onChange={value => patchProduct('problem', value)} />
        <EditField label="해결 방법" value={product.solution} onChange={value => patchProduct('solution', value)} />
        {canvasFields.map(([key, label]) => <EditField key={key} label={label} value={canvas[key]} onChange={value => patchCanvas(key, value)} />)}
      </div>
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between"><p className="text-[12px] font-black text-bluewood-600">가설 및 검증</p><button type="button" onClick={() => onChange({ ...sr, pmHypotheses: [...rows, { hypothesis: '', kpi: '', target: '', achievement: '', note: '' }], pmHypothesesSource: 'manual' })} className="text-[12px] font-bold text-primary-600">＋ 가설 추가</button></div>
        <div className="space-y-3">
          {rows.map((row, index) => <div key={index} className="rounded-xl border border-surface-200 bg-white p-3"><div className="mb-2 flex justify-end"><button type="button" onClick={() => onChange({ ...sr, pmHypotheses: rows.filter((_, i) => i !== index), pmHypothesesSource: 'manual' })} className="text-[12px] font-bold text-red-400">삭제</button></div><div className="grid gap-2 sm:grid-cols-2"><EditField label="가설" value={row.hypothesis} onChange={value => patchRow(index, { hypothesis: value })} /><EditField label="핵심 KPI" value={row.kpi} onChange={value => patchRow(index, { kpi: value })} /><EditField label="목표" value={row.target} multiline={false} onChange={value => patchRow(index, { target: value })} /><EditField label="달성" value={row.achievement || row.actual} multiline={false} onChange={value => patchRow(index, { achievement: value })} /><EditField label="비고·배움" value={row.note} onChange={value => patchRow(index, { note: value })} /></div></div>)}
        </div>
      </div>
    </EditPanel>
  );
}

function MarketerFullEditor({ sr, onChange }) {
  const kit = sr.marketerKit || {};
  const funnel = kit.funnel || {};
  const kpis = Array.isArray(kit.kpis) ? kit.kpis : [];
  const resume = Array.isArray(kit.resumeVariants) && kit.resumeVariants.length
    ? kit.resumeVariants.map(item => ({ ...item, sentence: item?.sentence || '' }))
    : (kit.resumeBullets || []).map(sentence => ({ sentence }));
  const patchKit = changes => onChange({ ...sr, marketerKit: { ...kit, ...changes } });
  const patchFunnel = (key, value) => patchKit({ funnel: { ...funnel, [key]: value } });
  const funnelFields = [['problem', '문제'], ['goal', '목표'], ['target', '타깃'], ['strategy', '전략'], ['execution', '실행'], ['result', '성과'], ['insight', '인사이트']];
  return (
    <EditPanel>
      <p className="mb-3 text-[12px] font-black text-bluewood-600">캠페인 전체 편집</p>
      <EditField label="포지셔닝" value={kit.positioning} onChange={value => patchKit({ positioning: value })} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{funnelFields.map(([key, label]) => <EditField key={key} label={label} value={funnel[key]} onChange={value => patchFunnel(key, value)} />)}</div>
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between"><p className="text-[12px] font-black text-bluewood-600">캠페인 KPI</p><button type="button" onClick={() => patchKit({ kpis: [...kpis, { name: '', value: '', status: '' }] })} className="text-[12px] font-bold text-primary-600">＋ KPI 추가</button></div>
        <div className="space-y-2">{kpis.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"><EditField value={item.name} multiline={false} placeholder="KPI" onChange={value => patchKit({ kpis: kpis.map((row, i) => i === index ? { ...row, name: value } : row) })} /><EditField value={item.value} multiline={false} placeholder="수치" onChange={value => patchKit({ kpis: kpis.map((row, i) => i === index ? { ...row, value } : row) })} /><EditField value={item.status} multiline={false} placeholder="상태" onChange={value => patchKit({ kpis: kpis.map((row, i) => i === index ? { ...row, status: value } : row) })} /><button type="button" onClick={() => patchKit({ kpis: kpis.filter((_, i) => i !== index) })} className="px-1 text-[12px] font-bold text-red-400">삭제</button></div>)}</div>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between"><p className="text-[12px] font-black text-bluewood-600">이력서 문장</p><button type="button" onClick={() => patchKit({ resumeVariants: [...resume, { sentence: '' }] })} className="text-[12px] font-bold text-primary-600">＋ 문장 추가</button></div>
        <div className="space-y-2">{resume.map((item, index) => <div key={index} className="grid grid-cols-[1fr_auto] gap-2"><EditField value={item.sentence} placeholder="이력서 문장" onChange={value => patchKit({ resumeVariants: resume.map((row, i) => i === index ? { ...row, sentence: value } : row) })} /><button type="button" onClick={() => patchKit({ resumeVariants: resume.filter((_, i) => i !== index) })} className="px-1 text-[12px] font-bold text-red-400">삭제</button></div>)}</div>
      </div>
    </EditPanel>
  );
}

function CoreOverviewEditor({ exp, sr, onChange, onExperienceChange }) {
  const overview = sr.projectOverview || {};
  const caseStudy = exp?.caseStudy || {};
  const caseMeta = caseStudy.meta || {};
  const patchOverview = (key, value) => onChange({ ...sr, projectOverview: { ...overview, [key]: value } });
  const patchCase = (changes) => onExperienceChange?.({ caseStudy: { ...caseStudy, ...changes } });
  const patchMeta = (key, value) => patchCase({ meta: { ...caseMeta, [key]: value } });
  const stackText = (Array.isArray(overview.techStack) ? overview.techStack : []).map(item => typeof item === 'string' ? item : item?.name || '').filter(Boolean).join(', ');
  const keywordText = (Array.isArray(sr.keywords) ? sr.keywords : (Array.isArray(exp?.keywords) ? exp.keywords : [])).join(', ');
  return (
    <details open className="rounded-xl border border-surface-200 bg-white p-3.5">
      <summary className="cursor-pointer text-[11.5px] font-black text-bluewood-700">사이드바 · 프로젝트 기본 정보</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <EditField label="핵심 경험 제목" value={caseStudy.title || exp?.title || ''} multiline={false} onChange={value => patchCase({ title: value })} />
        <EditField label="한 줄 요약" value={caseStudy.summary || ''} onChange={value => patchCase({ summary: value })} />
        <EditField label="역할" value={caseMeta.role || overview.role || exp?.role || ''} multiline={false} onChange={value => { patchMeta('role', value); patchOverview('role', value); }} />
        <EditField label="기간" value={caseMeta.duration || overview.duration || exp?.date || ''} multiline={false} onChange={value => { patchMeta('duration', value); patchOverview('duration', value); }} />
        <EditField label="팀 구성" value={caseMeta.team || overview.team || ''} multiline={false} onChange={value => { patchMeta('team', value); patchOverview('team', value); }} />
        <EditField label="프로젝트 요약" value={overview.summary || ''} onChange={value => patchOverview('summary', value)} />
        <EditField label="배경" value={overview.background || ''} onChange={value => patchOverview('background', value)} />
        <EditField label="목표" value={overview.goal || ''} onChange={value => patchOverview('goal', value)} />
        <EditField label="영향 범위" value={overview.scopeOfImpact || ''} onChange={value => patchOverview('scopeOfImpact', value)} />
        <EditField label="기술·도구 (쉼표 구분)" value={stackText} onChange={value => patchOverview('techStack', value.split(',').map(item => item.trim()).filter(Boolean))} />
        <EditField label="핵심 키워드 (쉼표 구분)" value={keywordText} onChange={value => onChange({ ...sr, keywords: value.split(',').map(item => item.trim()).filter(Boolean) })} />
      </div>
    </details>
  );
}

function KeyExperiencesEditor({ sr, onChange, jobCategory }) {
  const rows = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
  const patch = (index, changes) => onChange({ ...sr, keyExperiences: rows.map((row, i) => i === index ? { ...row, ...changes } : row) });
  const patchJob = (index, changes) => patch(index, { jobData: { ...(rows[index]?.jobData || {}), ...changes } });
  return (
    <details className="rounded-xl border border-surface-200 bg-white p-3.5">
      <summary className="cursor-pointer text-[11.5px] font-black text-bluewood-700">핵심 경험 · 성과 · 판단 근거 ({rows.length})</summary>
      <div className="mt-3 flex justify-end"><button type="button" onClick={() => onChange({ ...sr, keyExperiences: [...rows, { title: '', context: '', action: '', result: '', learning: '', metricLabel: '', metric: '', jobData: {} }] })} className="text-[12px] font-bold text-primary-600">＋ 핵심 경험 추가</button></div>
      <div className="mt-2 space-y-3">
        {rows.map((row, index) => (
          <div key={row.id || index} className="rounded-xl border border-surface-200 bg-surface-50/40 p-3">
            <div className="mb-2 flex items-center justify-between"><b className="text-[12px] text-bluewood-600">경험 {index + 1}</b><button type="button" onClick={() => onChange({ ...sr, keyExperiences: rows.filter((_, i) => i !== index) })} className="text-[11.5px] font-bold text-red-400">삭제</button></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <EditField label="제목" value={row.title || ''} multiline={false} onChange={value => patch(index, { title: value })} />
              <EditField label="지표명" value={row.metricLabel || ''} multiline={false} onChange={value => patch(index, { metricLabel: value })} />
              <EditField label="상황·배경" value={row.context || row.situation || ''} onChange={value => patch(index, { context: value })} />
              <EditField label="행동·해결 과정" value={row.action || ''} onChange={value => patch(index, { action: value })} />
              <EditField label="결과" value={row.result || ''} onChange={value => patch(index, { result: value })} />
              <EditField label="배운 점" value={row.learning || ''} onChange={value => patch(index, { learning: value })} />
              <EditField label="이전 수치" value={row.beforeMetric || ''} multiline={false} onChange={value => patch(index, { beforeMetric: value })} />
              <EditField label="이후·성과 수치" value={row.afterMetric || row.metric || ''} multiline={false} onChange={value => patch(index, { afterMetric: value, metric: value })} />
              {jobCategory === 'pm' && <>
                <EditField label="가설" value={row.jobData?.hypothesis || ''} onChange={value => patchJob(index, { hypothesis: value })} />
                <EditField label="채택한 의사결정" value={row.jobData?.decision || ''} onChange={value => patchJob(index, { decision: value })} />
                <EditField label="검토·기각 대안" value={row.jobData?.alternatives || ''} onChange={value => patchJob(index, { alternatives: value })} />
                <EditField label="검증 방법" value={row.jobData?.validation || ''} onChange={value => patchJob(index, { validation: value })} />
                <EditField label="부딪힌 난관" value={row.jobData?.obstacle || ''} onChange={value => patchJob(index, { obstacle: value })} />
                <EditField label="돌파 방법" value={row.jobData?.resolution || ''} onChange={value => patchJob(index, { resolution: value })} />
                <EditField label="영향도 (1~5)" value={row.jobData?.impact || ''} type="number" multiline={false} onChange={value => patchJob(index, { impact: value })} />
                <EditField label="노력도 (1~5)" value={row.jobData?.effort || ''} type="number" multiline={false} onChange={value => patchJob(index, { effort: value })} />
              </>}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function DiagramDataEditor({ sr, onChange }) {
  const renderDiagram = (field, label) => {
    const diagram = sr[field] || { nodes: [], edges: [] };
    const nodes = Array.isArray(diagram.nodes) ? diagram.nodes : [];
    const edges = Array.isArray(diagram.edges) ? diagram.edges : [];
    const patchDiagram = changes => onChange({ ...sr, [field]: { ...diagram, ...changes } });
    return (
      <details className="rounded-xl border border-surface-200 bg-white p-3.5">
        <summary className="cursor-pointer text-[11.5px] font-black text-bluewood-700">{label} · 노드/연결선</summary>
        <div className="mt-3 flex justify-end"><button type="button" onClick={() => patchDiagram({ nodes: [...nodes, { id: `node-${Date.now()}`, label: '', tech: '', tier: 0 }] })} className="text-[12px] font-bold text-primary-600">＋ 노드 추가</button></div>
        <div className="mt-2 space-y-2">{nodes.map((node, index) => <div key={node.id || index} className="grid gap-2 rounded-lg bg-surface-50 p-2 sm:grid-cols-[1fr_1.2fr_1.2fr_70px_auto]"><EditField label="ID" value={node.id || ''} multiline={false} onChange={value => patchDiagram({ nodes: nodes.map((item, i) => i === index ? { ...item, id: value } : item) })} /><EditField label="노드명" value={node.label || ''} multiline={false} onChange={value => patchDiagram({ nodes: nodes.map((item, i) => i === index ? { ...item, label: value } : item) })} /><EditField label="기술·설명" value={node.tech || ''} multiline={false} onChange={value => patchDiagram({ nodes: nodes.map((item, i) => i === index ? { ...item, tech: value } : item) })} /><EditField label="단계" value={node.tier || 0} type="number" multiline={false} onChange={value => patchDiagram({ nodes: nodes.map((item, i) => i === index ? { ...item, tier: value } : item) })} /><button type="button" onClick={() => patchDiagram({ nodes: nodes.filter((_, i) => i !== index), edges: edges.filter(edge => edge.from !== node.id && edge.to !== node.id) })} className="self-end py-2 text-[11.5px] font-bold text-red-400">삭제</button></div>)}</div>
        <div className="mt-4 flex justify-end"><button type="button" onClick={() => patchDiagram({ edges: [...edges, { from: nodes[0]?.id || '', to: nodes[1]?.id || '', label: '' }] })} className="text-[12px] font-bold text-primary-600">＋ 연결선 추가</button></div>
        <div className="mt-2 space-y-2">{edges.map((edge, index) => <div key={index} className="grid gap-2 rounded-lg bg-surface-50 p-2 sm:grid-cols-[1fr_1fr_1.5fr_auto]"><EditField label="출발 ID" value={edge.from || ''} multiline={false} onChange={value => patchDiagram({ edges: edges.map((item, i) => i === index ? { ...item, from: value } : item) })} /><EditField label="도착 ID" value={edge.to || ''} multiline={false} onChange={value => patchDiagram({ edges: edges.map((item, i) => i === index ? { ...item, to: value } : item) })} /><EditField label="연결 설명" value={edge.label || ''} multiline={false} onChange={value => patchDiagram({ edges: edges.map((item, i) => i === index ? { ...item, label: value } : item) })} /><button type="button" onClick={() => patchDiagram({ edges: edges.filter((_, i) => i !== index) })} className="self-end py-2 text-[11.5px] font-bold text-red-400">삭제</button></div>)}</div>
      </details>
    );
  };
  return <>{renderDiagram('architectureDiagram', '개발 구조')}{renderDiagram('flowDiagram', '프로젝트 흐름')}</>;
}

function PmTimelineEditor({ sr, onChange }) {
  const timeline = sr.pmTimeline || {};
  const rows = Array.isArray(timeline.items) ? timeline.items : [];
  const patch = changes => onChange({ ...sr, pmTimeline: { ...timeline, ...changes } });
  return <details className="rounded-xl border border-surface-200 bg-white p-3.5"><summary className="cursor-pointer text-[11.5px] font-black text-bluewood-700">서비스 타임라인</summary><div className="mt-3"><EditField label="타임라인 설명" value={timeline.description || ''} onChange={value => patch({ description: value })} /></div><div className="mt-3 flex justify-end"><button type="button" onClick={() => patch({ items: [...rows, { phase: '', label: '', value: '', color: ACCENT }] })} className="text-[12px] font-bold text-primary-600">＋ 단계 추가</button></div><div className="mt-2 space-y-2">{rows.map((row, index) => <div key={index} className="grid gap-2 rounded-lg bg-surface-50 p-2 sm:grid-cols-[.8fr_1fr_2fr_90px_auto]"><EditField label="영문 단계" value={row.phase || ''} multiline={false} onChange={value => patch({ items: rows.map((item, i) => i === index ? { ...item, phase: value } : item) })} /><EditField label="단계명" value={row.label || ''} multiline={false} onChange={value => patch({ items: rows.map((item, i) => i === index ? { ...item, label: value } : item) })} /><EditField label="내용" value={row.value || ''} onChange={value => patch({ items: rows.map((item, i) => i === index ? { ...item, value } : item) })} /><EditField label="색상" value={row.color || ACCENT} multiline={false} onChange={value => patch({ items: rows.map((item, i) => i === index ? { ...item, color: value } : item) })} /><button type="button" onClick={() => patch({ items: rows.filter((_, i) => i !== index) })} className="self-end py-2 text-[11.5px] font-bold text-red-400">삭제</button></div>)}</div></details>;
}

function MarketerResearchEditor({ sr, onChange }) {
  const current = sr.research?.deskResearchInfographic || sr.marketResearch?.deskResearchInfographic || sr.deskResearchInfographic || {};
  const cards = Array.isArray(current.cards) ? current.cards : [];
  const patch = changes => onChange({ ...sr, research: { ...(sr.research || {}), deskResearchInfographic: { ...current, ...changes } } });
  const patchCard = (index, changes) => patch({ cards: cards.map((card, i) => i === index ? { ...card, ...changes } : card) });
  return (
    <details className="rounded-xl border border-surface-200 bg-white p-3.5">
      <summary className="cursor-pointer text-[11.5px] font-black text-bluewood-700">시장 리서치 카드</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2"><EditField label="리서치 제목" value={current.title || ''} multiline={false} onChange={value => patch({ title: value })} /><EditField label="부제" value={current.subtitle || ''} onChange={value => patch({ subtitle: value })} /><EditField label="종합 결론" value={current.conclusion || ''} onChange={value => patch({ conclusion: value })} /></div>
      <div className="mt-3 flex justify-end"><button type="button" onClick={() => patch({ cards: [...cards, { question: '', finding: '', value: '', unit: '%', valueLabel: '', sourcePublisher: '', sourceTitle: '', bars: [] }] })} className="text-[12px] font-bold text-primary-600">＋ 리서치 카드 추가</button></div>
      <div className="mt-2 space-y-3">{cards.map((card, index) => { const bars = Array.isArray(card.bars) ? card.bars : []; return <div key={index} className="rounded-xl border border-surface-200 bg-surface-50/40 p-3"><div className="mb-2 flex justify-end"><button type="button" onClick={() => patch({ cards: cards.filter((_, i) => i !== index) })} className="text-[11.5px] font-bold text-red-400">삭제</button></div><div className="grid gap-2 sm:grid-cols-2"><EditField label="질문·카드 제목" value={card.question || ''} onChange={value => patchCard(index, { question: value })} /><EditField label="핵심 발견" value={card.finding || ''} onChange={value => patchCard(index, { finding: value })} /><EditField label="대표 수치" value={card.value ?? ''} multiline={false} onChange={value => patchCard(index, { value })} /><EditField label="단위" value={card.unit || ''} multiline={false} onChange={value => patchCard(index, { unit: value })} /><EditField label="수치 설명" value={card.valueLabel || ''} multiline={false} onChange={value => patchCard(index, { valueLabel: value })} /><EditField label="출처 기관" value={card.sourcePublisher || ''} multiline={false} onChange={value => patchCard(index, { sourcePublisher: value })} /><EditField label="출처 자료명" value={card.sourceTitle || ''} multiline={false} onChange={value => patchCard(index, { sourceTitle: value })} /></div><div className="mt-3 flex justify-end"><button type="button" onClick={() => patchCard(index, { bars: [...bars, { label: '', value: 0, unit: card.unit || '%' }] })} className="text-[11.5px] font-bold text-primary-600">＋ 비교 막대 추가</button></div><div className="mt-2 space-y-2">{bars.map((bar, barIndex) => <div key={barIndex} className="grid gap-2 sm:grid-cols-[1fr_100px_80px_auto]"><EditField label="항목" value={bar.label || ''} multiline={false} onChange={value => patchCard(index, { bars: bars.map((item, i) => i === barIndex ? { ...item, label: value } : item) })} /><EditField label="값" value={bar.value ?? 0} type="number" multiline={false} onChange={value => patchCard(index, { bars: bars.map((item, i) => i === barIndex ? { ...item, value } : item) })} /><EditField label="단위" value={bar.unit || ''} multiline={false} onChange={value => patchCard(index, { bars: bars.map((item, i) => i === barIndex ? { ...item, unit: value } : item) })} /><button type="button" onClick={() => patchCard(index, { bars: bars.filter((_, i) => i !== barIndex) })} className="self-end py-2 text-[11.5px] font-bold text-red-400">삭제</button></div>)}</div></div>; })}</div>
    </details>
  );
}

function MarketerPositioningEditor({ sr, onChange }) {
  const kit = sr.marketerKit || {};
  const report = kit.positioningReport || {};
  const positions = Array.isArray(report.recommendedPositions) ? report.recommendedPositions : [];
  const patch = changes => onChange({ ...sr, marketerKit: { ...kit, positioningReport: { ...report, ...changes } } });
  const listText = value => (Array.isArray(value) ? value : []).map(item => typeof item === 'string' ? item : item?.text || item?.name || '').filter(Boolean).join('\n');
  return (
    <details className="rounded-xl border border-surface-200 bg-white p-3.5">
      <summary className="cursor-pointer text-[11.5px] font-black text-bluewood-700">포지셔닝 리포트</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2"><EditField label="강점 (한 줄에 하나)" value={listText(report.strengths)} onChange={value => patch({ strengths: value.split('\n').map(text => text.trim()).filter(Boolean) })} /><EditField label="보완점 (한 줄에 하나)" value={listText(report.weaknesses)} onChange={value => patch({ weaknesses: value.split('\n').map(text => text.trim()).filter(Boolean) })} /><EditField label="추천 문장" value={report.recommendation || ''} onChange={value => patch({ recommendation: value })} /></div>
      <div className="mt-3 flex justify-end"><button type="button" onClick={() => patch({ recommendedPositions: [...positions, { name: '', reason: '' }] })} className="text-[12px] font-bold text-primary-600">＋ 추천 포지션 추가</button></div>
      <div className="mt-2 space-y-2">{positions.map((position, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><EditField label="포지션" value={typeof position === 'string' ? position : position.name || ''} multiline={false} onChange={value => patch({ recommendedPositions: positions.map((item, i) => i === index ? { ...(typeof item === 'object' ? item : {}), name: value } : item) })} /><EditField label="추천 이유" value={typeof position === 'object' ? position.reason || position.why || position.desc || '' : ''} onChange={value => patch({ recommendedPositions: positions.map((item, i) => i === index ? { ...(typeof item === 'object' ? item : { name: item }), reason: value } : item) })} /><button type="button" onClick={() => patch({ recommendedPositions: positions.filter((_, i) => i !== index) })} className="self-end py-2 text-[11.5px] font-bold text-red-400">삭제</button></div>)}</div>
    </details>
  );
}

function CompleteCoreEditor({ exp, sr, jobCategory, onChange, onExperienceChange }) {
  return (
    <EditPanel>
      <div className="mb-3"><p className="text-[12px] font-black text-bluewood-800">직군 핵심 경험 전체 편집</p><p className="mt-1 text-[11.5px] text-bluewood-400">여기서 바꾼 내용은 원본 핵심 경험과 내보내기 화면에 함께 반영됩니다.</p></div>
      <div className="space-y-3">
        <CoreOverviewEditor exp={exp} sr={sr} onChange={onChange} onExperienceChange={onExperienceChange} />
        <KeyExperiencesEditor sr={sr} onChange={onChange} jobCategory={jobCategory} />
        <details className="rounded-xl border border-surface-200 bg-white p-3.5"><summary className="cursor-pointer text-[11.5px] font-black text-bluewood-700">전체 지표 · 시각화 데이터</summary><GenericVisualEditor visuals={sr.portfolioVisuals || {}} onChange={visuals => onChange({ ...sr, portfolioVisuals: visuals })} /></details>
        {jobCategory === 'pm' && <PmTimelineEditor sr={sr} onChange={onChange} />}
        {jobCategory === 'marketer' && <><MarketerResearchEditor sr={sr} onChange={onChange} /><MarketerPositioningEditor sr={sr} onChange={onChange} /></>}
        {['dev', 'aiml', 'devops'].includes(jobCategory) && <DiagramDataEditor sr={sr} onChange={onChange} />}
      </div>
    </EditPanel>
  );
}

const VISUAL_COLLECTIONS = [
  { key: 'kpis', label: '핵심 지표', fields: [['label', '지표명'], ['value', '값'], ['target', '목표'], ['note', '설명']] },
  { key: 'compare', label: '개선 전후', fields: [['label', '항목'], ['before', '이전'], ['after', '이후'], ['unit', '단위']] },
  { key: 'process', label: '프로세스', nested: 'steps', fields: [['label', '단계'], ['desc', '설명']] },
  { key: 'funnel', label: '퍼널', nested: 'stages', fields: [['label', '단계'], ['value', '수치'], ['unit', '단위']] },
  { key: 'mix', label: '구성 비중', nested: 'items', fields: [['label', '항목'], ['pct', '비중(%)']] },
  { key: 'goals', label: '목표 달성', fields: [['label', '목표'], ['target', '기준'], ['actual', '실제']] },
  { key: 'gauges', label: '운영 지표', fields: [['label', '지표명'], ['value', '값'], ['unit', '단위'], ['target', '목표']] },
  { key: 'timeline', label: '타임라인', nested: 'phases', fields: [['label', '단계'], ['start', '시작'], ['span', '기간'], ['desc', '설명']] },
];

function readVisualRows(visuals, config) {
  const raw = visuals?.[config.key];
  if (config.nested) return Array.isArray(raw?.[config.nested]) ? raw[config.nested] : (Array.isArray(raw) ? raw : []);
  return Array.isArray(raw) ? raw : [];
}

function writeVisualRows(visuals, config, rows) {
  if (config.nested) return { ...visuals, [config.key]: { ...(visuals?.[config.key] && !Array.isArray(visuals[config.key]) ? visuals[config.key] : {}), [config.nested]: rows } };
  return { ...visuals, [config.key]: rows };
}

function GenericVisualEditor({ visuals = {}, onChange }) {
  return (
    <div className="mt-5 space-y-4">
      {VISUAL_COLLECTIONS.map(config => {
        const rows = readVisualRows(visuals, config);
        return (
          <div key={config.key} className="rounded-xl border border-surface-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-black text-bluewood-600">{config.label}</p>
              <button type="button" onClick={() => onChange(writeVisualRows(visuals, config, [...rows, Object.fromEntries(config.fields.map(([key]) => [key, '']))]))} className="text-[12px] font-bold text-primary-600">＋ 추가</button>
            </div>
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                  {config.fields.map(([key, label]) => <EditField key={key} label={label} value={row?.[key] ?? ''} multiline={key === 'desc' || key === 'note'} onChange={value => onChange(writeVisualRows(visuals, config, rows.map((item, i) => i === index ? { ...item, [key]: value } : item)))} />)}
                  <button type="button" onClick={() => onChange(writeVisualRows(visuals, config, rows.filter((_, i) => i !== index)))} className="self-end px-1 py-2 text-[12px] font-bold text-red-400">삭제</button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}


/* 실제 추출된 수치만 그리는 시각화 묶음.
   데이터가 없는 블록은 프리미티브가 null을 반환하므로 자동으로 빠진다. */
function RealDataVisuals({ visuals, accent }) {
  const v = visuals || {};
  const blocks = [
    v.kpis?.length ? <KpiTileRow key="kpis" title="핵심 지표" items={v.kpis} accent={accent} /> : null,
    v.funnel?.length >= 2 ? <FunnelChart key="funnel" title="단계별 전환" stages={v.funnel} accent={accent} /> : null,
    v.compare?.length ? <DumbbellCompare key="compare" title="개선 전 · 후" rows={v.compare} accent={accent} /> : null,
    v.gauges?.length ? <GaugeRow key="gauges" title="목표 대비 현재" items={v.gauges} accent={accent} /> : null,
    v.goals?.length ? <GoalBoard key="goals" title="목표와 결과" goals={v.goals} accent={accent} /> : null,
    v.mix?.length >= 2 ? <MixBar key="mix" title="구성 비중" items={v.mix} accent={accent} /> : null,
    v.steps?.length >= 2 ? <ProcessFlow key="steps" title="수행 단계" steps={v.steps} accent={accent} /> : null,
  ].filter(Boolean);
  if (blocks.length === 0) return null;
  return <div className="space-y-5">{blocks}</div>;
}

function GenericJobCore({ exp, sr, jobCategory, editing, onChange }) {
  const jobFields = JOB_SPECIFIC_FIELDS[jobCategory] || [];
  const jobSpecific = sr.jobSpecific || {};
  const keyExps = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
  const overview = sr.projectOverview || {};
  const techList = Array.isArray(overview.techStack) ? overview.techStack : [];
  const jobLabel = JOB_CATEGORIES.flatMap(group => group.items).find(item => item.value === jobCategory)?.label || '직군 특화 경험';
  const visuals = normalizePortfolioVisuals(sr, {
    jobSections: jobFields,
    keyExperiences: keyExps,
    jobSpecific,
    texts: jobFields.map(field => jobSpecific[field.key]),
  });
  const visibleSections = jobFields.filter(field => clean(jobSpecific[field.key]));
  const patchJob = (key, value) => onChange({ ...sr, jobSpecific: { ...jobSpecific, [key]: value } });

  return (
    <div>
      {/* 실데이터 시각화만 렌더한다.
          기존 JobShowcase는 loss 곡선·GPU 사용률·히트맵을 "연출용 시뮬레이션"으로 그려 넣어
          없는 성과를 있는 것처럼 보이게 했다 — 진정성 기준과 정면으로 충돌해 제거. */}
      <RealDataVisuals visuals={visuals} accent={getJobPortfolioMeta(jobCategory).accent} />

      {visibleSections.length > 0 && (
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {visibleSections.map(field => (
            <section key={field.key} className="rounded-2xl border border-surface-200 bg-white p-4">
              <p className="text-[12.5px] font-extrabold text-bluewood-900">{field.label}</p>
              {field.subtitle && <p className="mt-0.5 text-[11.5px] font-medium text-bluewood-300">{field.subtitle}</p>}
              <p className="mt-2.5 whitespace-pre-line text-[12.5px] leading-[1.7] text-bluewood-600">{clean(jobSpecific[field.key])}</p>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <EditPanel>
          <p className="mb-3 text-[12px] font-black text-bluewood-600">{jobLabel} 핵심 경험 전체 편집</p>
          <div className="space-y-3">
            {jobFields.map(field => <EditField key={field.key} label={field.label} value={jobSpecific[field.key] || ''} placeholder={field.placeholder} onChange={value => patchJob(field.key, value)} />)}
          </div>
          <GenericVisualEditor visuals={sr.portfolioVisuals || {}} onChange={next => onChange({ ...sr, portfolioVisuals: next })} />
        </EditPanel>
      )}
    </div>
  );
}

/* ── 표시할 직군 콘텐츠가 있는지 (모달이 섹션 자체를 감출지 판단) ── */
export function hasJobCoreContent(exp) {
  const sr = exp?.structuredResult || {};
  const jobCategory = exp?.jobCategory || sr.jobCategory || 'common';
  const hasBody = Array.isArray(exp?.caseStudy?.body)
    && exp.caseStudy.body.some(seg => (seg?.type === 'image' ? seg.content : clean(seg?.content)));
  const hasSharedJobContent = (JOB_SPECIFIC_FIELDS[jobCategory] || []).some(field => clean(sr.jobSpecific?.[field.key]))
    || (Array.isArray(sr.keyExperiences) && sr.keyExperiences.length > 0)
    || (Array.isArray(sr.deliverables) && sr.deliverables.length > 0)
    || Object.values(sr.portfolioVisuals || {}).some(value => (
      Array.isArray(value) ? value.length > 0 : value && typeof value === 'object' && Object.keys(value).length > 0
    ));
  if (DEV_GIT_JOBS.includes(jobCategory)) {
    const product = sr.product || {};
    return !!(clean(product.name) || clean(product.problem) || clean(product.solution)
      || sr.githubStats?.myCommits || Number(sr.githubStats?.contributionPct) > 0
      || (Array.isArray(sr.gitAnalysis?.experiences) && sr.gitAnalysis.experiences.length > 0)
      || (Array.isArray(sr.architectureDiagram?.nodes) && sr.architectureDiagram.nodes.length >= 2)
      || (Array.isArray(sr.flowDiagram?.nodes) && sr.flowDiagram.nodes.length >= 2)
      || hasSharedJobContent);
  }
  if (jobCategory === 'pm') {
    const canvas = sr.leanCanvas || {};
    return !!(clean(sr.product?.problem) || clean(canvas.uvp) || clean(canvas.customers)
      || (Array.isArray(sr.pmHypotheses) && sr.pmHypotheses.length > 0)
      || (Array.isArray(sr.keyExperiences) && sr.keyExperiences.some(ke => clean(ke?.jobData?.hypothesis) || clean(ke?.jobData?.decision)))
      || (Array.isArray(sr.pmTimeline?.items) && sr.pmTimeline.items.length > 0)
      || (Array.isArray(sr.pmFiles) && sr.pmFiles.length > 0)
      || hasBody || hasSharedJobContent);
  }
  if (jobCategory === 'marketer') {
    const kit = sr.marketerKit || {};
    const funnel = kit.funnel || {};
    const research = sr.research?.deskResearchInfographic || sr.marketResearch?.deskResearchInfographic || sr.deskResearchInfographic || {};
    return !!(clean(kit.positioning) || Object.values(funnel).some(clean)
      || (Array.isArray(kit.kpis) && kit.kpis.length > 0)
      || (Array.isArray(kit.resumeBullets) && kit.resumeBullets.length > 0)
      || (Array.isArray(kit.resumeVariants) && kit.resumeVariants.length > 0)
      || (Array.isArray(research.cards) && research.cards.length > 0)
      || hasBody || hasSharedJobContent);
  }
  return jobCategory !== 'common' ? (hasBody || hasSharedJobContent) : hasBody;
}

export default function JobCoreShowcase({ exp, readOnly = false, onChange, onExperienceChange }) {
  const sr = exp?.structuredResult || {};
  const jobCategory = exp?.jobCategory || sr.jobCategory || 'common';
  const artifactVariant = sr.exportConfig?.artifactCoverVariant || '';
  const [editing, setEditing] = useState(false);
  const canEdit = !readOnly && typeof onChange === 'function';
  const patchSr = changes => onChange?.({ ...sr, ...changes });

  if (DEV_GIT_JOBS.includes(jobCategory)) {
    const stats = sr.githubStats || {};
    const gitExps = Array.isArray(sr.gitAnalysis?.experiences) ? sr.gitAnalysis.experiences : [];
    const deliverables = collectDeliverables(sr);
    const useContributionSidebar = !artifactVariant || ['code-diff', 'accessibility-audit', 'automation-flow'].includes(artifactVariant);
    const showCodeEvidence = !artifactVariant || ['code-diff', 'accessibility-audit'].includes(artifactVariant);
    const hasDevSidebar = useContributionSidebar && Boolean(
      stats.myCommits
      || Number(stats.contributionPct) > 0
      || deliverables.length > 0
      || editing,
    );
    const devSidebar = hasDevSidebar ? (
      <>
        {(stats.myCommits || Number(stats.contributionPct) > 0 || editing) && (
          <DevGitReport exp={exp} stats={stats} gitExps={gitExps} editing={editing} onChange={next => patchSr({ githubStats: next })} />
        )}
        {deliverables.length > 0 && <div className="mt-5 border-t border-surface-200 pt-4"><PmDeliverableFiles files={deliverables} compact /></div>}
        {editing && <DeliverableEditor items={deliverables} onChange={items => onChange?.({ ...sr, deliverables: items, pmFiles: [] })} />}
      </>
    ) : null;
    const devLead = (
      <>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-surface-200 pb-3">
          <h3 className="text-[15px] font-extrabold text-bluewood-900">개발 임팩트</h3>
          {(sr.gitAnalysis?.repoName || stats.repoName) && <span className="text-[11.5px] font-semibold text-bluewood-300">{sr.gitAnalysis?.repoName || stats.repoName}</span>}
        </div>
        <ProductIntroCard product={sr.product || {}} embedded editing={editing} onChange={next => patchSr({ product: next })} />
      </>
    );
    return (
      <EditFrame editing={editing} setEditing={setEditing} canEdit={canEdit}>
        <div>
          <JobCoreLayout sidebar={devSidebar} lead={devLead}>
            <div className="space-y-8">
              <DevArchitecture sr={sr} />
              {showCodeEvidence && gitExps.length > 0 && (
                <div>
                  <SectionLabel en="Problem Solving">문제 해결 기록</SectionLabel>
                  <div className="space-y-4">
                    {gitExps.map((gitExp, index) => <GitProjectCard key={index} exp={gitExp} index={index} />)}
                  </div>
                </div>
              )}
              {editing && <EditableGitProjects items={gitExps} onChange={items => patchSr({ gitAnalysis: { ...(sr.gitAnalysis || {}), experiences: items } })} />}
              <CaseBodyCard caseStudy={exp?.caseStudy} />
            </div>
          </JobCoreLayout>
          {editing && <CompleteCoreEditor exp={exp} sr={sr} jobCategory={jobCategory} onChange={onChange} onExperienceChange={onExperienceChange} />}
        </div>
      </EditFrame>
    );
  }

  if (jobCategory === 'pm') {
    const keyExperiences = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
    const showLeanCanvas = !artifactVariant || ['product-roadmap', 'discovery-map'].includes(artifactVariant);
    const showTimeline = !artifactVariant || ['product-roadmap', 'service-blueprint'].includes(artifactVariant);
    const showTransformation = !artifactVariant || ['product-roadmap', 'experiment-board', 'discovery-map', 'policy-system'].includes(artifactVariant);
    const showDecisionLog = !artifactVariant || ['product-roadmap', 'service-blueprint', 'policy-system'].includes(artifactVariant);
    const showValidation = !artifactVariant || ['product-roadmap', 'experiment-board', 'discovery-map'].includes(artifactVariant);
    return (
      <EditFrame editing={editing} setEditing={setEditing} canEdit={canEdit}>
        <JobCoreLayout
          dense
          sidebar={<JobCoreSidebar exp={exp} sr={sr} jobCategory={jobCategory} editing={editing} onChange={onChange} />}
          lead={<div className="space-y-3.5"><PmCycleStrip />{showLeanCanvas && <LeanCanvasCard sr={sr} />}</div>}
        >
          <div className="space-y-4">
            {showTimeline && <PmTimelineStrip sr={sr} />}
            {showTransformation && <PmAsIsToBeBoard sr={sr} />}
            {showDecisionLog && <PmDecisionLog keyExperiences={keyExperiences} />}
            {showValidation && <PmValidationTable sr={sr} keyExperiences={keyExperiences} />}
            <PmMetricTiles sr={sr} />
            <CaseBodyCard caseStudy={exp?.caseStudy} />
            {editing && <PmFullEditor sr={sr} onChange={onChange} />}
          </div>
        </JobCoreLayout>
        {editing && <CompleteCoreEditor exp={exp} sr={sr} jobCategory={jobCategory} onChange={onChange} onExperienceChange={onExperienceChange} />}
      </EditFrame>
    );
  }

  if (jobCategory === 'marketer') {
    const showResearch = !artifactVariant || artifactVariant === 'launch-dashboard';
    const showPositioning = !artifactVariant || ['launch-dashboard', 'content-scoreboard', 'growth-report'].includes(artifactVariant);
    return (
      <EditFrame editing={editing} setEditing={setEditing} canEdit={canEdit}>
        <JobCoreLayout
          sidebar={<JobCoreSidebar exp={exp} sr={sr} jobCategory={jobCategory} editing={editing} onChange={onChange} />}
          lead={showResearch ? <MarketerResearchBoard sr={sr} /> : null}
        >
          <div className="space-y-6">
            <MarketerCampaignCard kit={sr.marketerKit} />
            {showPositioning && <MarketerPositioningReport kit={sr.marketerKit} />}
            <CaseBodyCard caseStudy={exp?.caseStudy} />
            {editing && <MarketerFullEditor sr={sr} onChange={onChange} />}
          </div>
        </JobCoreLayout>
        {editing && <CompleteCoreEditor exp={exp} sr={sr} jobCategory={jobCategory} onChange={onChange} onExperienceChange={onExperienceChange} />}
      </EditFrame>
    );
  }

  if (jobCategory !== 'common') {
    return (
      <EditFrame editing={editing} setEditing={setEditing} canEdit={canEdit}>
        <JobCoreLayout
          sidebar={<JobCoreSidebar exp={exp} sr={sr} jobCategory={jobCategory} editing={editing} onChange={onChange} />}
          lead={<GenericJobCore exp={exp} sr={sr} jobCategory={jobCategory} editing={editing} onChange={onChange} />}
        >
          <CaseBodyCard caseStudy={exp?.caseStudy} />
        </JobCoreLayout>
        {editing && <CompleteCoreEditor exp={exp} sr={sr} jobCategory={jobCategory} onChange={onChange} onExperienceChange={onExperienceChange} />}
      </EditFrame>
    );
  }

  return <CaseBodyCard caseStudy={exp?.caseStudy} />;
}
