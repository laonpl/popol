import { useState, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronUp, ExternalLink, Globe, FileText } from 'lucide-react';
import api from '../services/api';

const JOB_SITES = [
  { name: '잡코리아', domain: 'jobkorea.co.kr', color: 'bg-blue-500', url: 'https://www.jobkorea.co.kr/starter/calendar' },
  { name: '사람인', domain: 'saramin.co.kr', color: 'bg-green-500', url: 'https://calendar.saramin.co.kr' },
  { name: '자소설닷컴', domain: 'jasoseol.com', color: 'bg-purple-500', url: 'https://jasoseol.com/recruit' },
];

/* AI 응답 항목이 객체({description, weight})이거나 JSON 문자열로 직렬화된 경우에도 표시용 텍스트만 추출 */
function textFromItem(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    return String(v.description || v.requirement || v.text || v.content || v.name || '');
  }
  const s = String(v).trim();
  if (/^\{[\s\S]*\}$/.test(s)) {
    try {
      const parsed = JSON.parse(s);
      return String(parsed.description || parsed.requirement || parsed.text || parsed.content || parsed.name || '');
    } catch { /* JSON이 아니면 원문 유지 */ }
  }
  return s;
}

function toCleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(v => stripMd(textFromItem(v))).filter(Boolean);
}

function stripMd(s) {
  return s ? String(s).replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s/gm, '').replace(/^[-•]\s/gm, '').trim() : '';
}

function firstFilled(...values) {
  return values.find(v => typeof v === 'string' && v.trim())?.trim() || '';
}

function normalizeAnalysisForDisplay(analysis) {
  const company = analysis?.company || '해당 기업';
  const position = analysis?.position || '지원 직무';
  const skills = toCleanList(analysis?.skills);
  const tasks = toCleanList(analysis?.tasks);
  const essential = toCleanList(analysis?.requirements?.essential);
  const preferred = toCleanList(analysis?.requirements?.preferred);
  const coreValues = toCleanList(analysis?.coreValues);
  const rawCompany = analysis?.companyAnalysis || {};
  const rawPosition = analysis?.positionAnalysis || {};
  const rawStrategy = analysis?.applicationStrategy || {};
  const isManualGuide = analysis?._sourceType === 'manual-entry' || analysis?._sourceType === 'manual-entry-guide';
  const sourceLooksThin =
    isManualGuide ||
    !firstFilled(rawCompany.overview, rawPosition.roleDescription, rawStrategy.portfolioTips?.[0]) ||
    /확인하지 못했습니다|공고 원문 확인 필요/.test(firstFilled(rawCompany.overview, ''));
  const guideSkills = skills.length ? skills : ['문제 해결', '협업', '데이터 기반 판단', '실행력'];
  const guideTasks = tasks.length ? tasks : [
    `${position} 직무와 관련된 핵심 업무 수행`,
    '유관 부서와 협업하며 실행 계획 수립',
    '성과를 점검하고 개선 방향 도출',
  ];
  const guidePortfolioTips = [
    `${position}와 가장 가까운 프로젝트를 첫 번째 사례로 배치`,
    '문제 상황, 본인 역할, 실행 과정, 결과를 한 흐름으로 정리',
    guideSkills.length ? `관련 역량(${guideSkills.slice(0, 4).join(', ')})을 실제 경험 근거와 연결` : '',
    '공고 원문을 확보하면 담당업무와 제출 조건에 맞춰 문구를 다시 조정',
  ].filter(Boolean);

  const companyAnalysis = {
    ...rawCompany,
    overview: firstFilled(
      rawCompany.overview,
      sourceLooksThin
        ? `${company} ${position} 지원을 위한 준비 가이드입니다. 실제 담당업무와 제출 조건은 공고 원문으로 확인해 주세요.`
        : '공고 원문에서 기업 소개/사업 설명을 확인하지 못했습니다.'
    ),
    industry: firstFilled(rawCompany.industry, sourceLooksThin ? `${position} 관련 직무/사업 영역` : ''),
    businessAreas: toCleanList(rawCompany.businessAreas),
    strengths: toCleanList(rawCompany.strengths).length
      ? toCleanList(rawCompany.strengths)
      : sourceLooksThin
        ? [
            `${company} 맞춤 포트폴리오에서는 기업명보다 ${position} 직무 수행 근거가 먼저 보여야 합니다.`,
            `${guideSkills.slice(0, 3).join(', ')} 역량을 프로젝트 사례로 증명하면 적합도를 빠르게 전달할 수 있습니다.`,
          ]
        : [],
    weaknesses: toCleanList(rawCompany.weaknesses).length
      ? toCleanList(rawCompany.weaknesses)
      : sourceLooksThin
        ? ['공고 원문이 없어 실제 담당업무, 필수요건, 제출 형식은 아직 확정할 수 없습니다.']
        : [],
    competitors: Array.isArray(rawCompany.competitors) ? rawCompany.competitors : [],
    culture: firstFilled(rawCompany.culture, coreValues.length ? coreValues.slice(0, 3).join(', ') : sourceLooksThin ? '협업, 실행력, 학습 속도처럼 대부분의 직무에서 검증 가능한 태도를 경험 근거와 함께 보여주세요.' : ''),
    recentTrends: firstFilled(rawCompany.recentTrends, sourceLooksThin ? `${company}의 최신 사업/채용 페이지를 확인해 포트폴리오의 문제 정의와 성과 표현을 보정하는 것이 좋습니다.` : ''),
  };

  const positionAnalysis = {
    ...rawPosition,
    roleDescription: firstFilled(rawPosition.roleDescription, `${position} 직무는 ${guideTasks.slice(0, 3).join(', ')} 역량을 중심으로 평가될 가능성이 높습니다.`),
    dailyTasks: firstFilled(rawPosition.dailyTasks, guideTasks.join(', ')),
    keyCompetencies: Array.isArray(rawPosition.keyCompetencies) && rawPosition.keyCompetencies.length
      ? rawPosition.keyCompetencies
      : guideSkills.slice(0, 5).map((skill, index) => ({
          name: skill,
          weight: Math.max(6, 9 - index),
          description: `${position} 포트폴리오에서 근거 사례로 보여주면 좋은 역량입니다.`,
        })),
    growthPath: firstFilled(rawPosition.growthPath, `${position} 직무와 가까운 프로젝트를 중심으로 문제 정의, 실행, 결과를 단계적으로 보여주세요.`),
    challengeLevel: rawPosition.challengeLevel || { score: 7, description: '요구 역량과 실제 경험의 연결이 선명할수록 평가자가 빠르게 이해할 수 있습니다.' },
  };

  const applicationStrategy = {
    ...rawStrategy,
    motivationPoints: Array.isArray(rawStrategy.motivationPoints) && rawStrategy.motivationPoints.length
      ? rawStrategy.motivationPoints
      : [{ point: `${company}의 ${position} 요구사항과 본인의 경험을 직접 연결`, how: '첫 화면과 주요 프로젝트 설명에서 공고 키워드를 반복적으로 드러내세요.' }],
    appealPoints: toCleanList(rawStrategy.appealPoints).length
      ? toCleanList(rawStrategy.appealPoints)
      : [...guideSkills.slice(0, 4), ...essential.slice(0, 2)].slice(0, 5),
    portfolioTips: toCleanList(rawStrategy.portfolioTips).length
      ? toCleanList(rawStrategy.portfolioTips)
      : guidePortfolioTips,
    cautionPoints: toCleanList(rawStrategy.cautionPoints).length
      ? toCleanList(rawStrategy.cautionPoints)
      : ['공고에 없는 기업 정보나 성과를 단정적으로 쓰지 말고 검증 가능한 경험 위주로 작성하세요.'],
  };

  const industryTrends = Array.isArray(analysis?.industryTrends) && analysis.industryTrends.length
    ? analysis.industryTrends
    : sourceLooksThin
      ? [
          {
            trend: `${position} 직무의 실무 역량 검증 강화`,
            description: '채용 과정에서 단순 이력 나열보다 실제 문제를 어떻게 해결했는지 확인하는 비중이 큽니다.',
            impact: '포트폴리오에는 결과물뿐 아니라 문제 정의, 본인 역할, 의사결정, 결과를 함께 담는 것이 좋습니다.',
            keywords: guideSkills.slice(0, 4),
            level: 'stable',
          },
        ]
      : [];

  return { companyAnalysis, positionAnalysis, applicationStrategy, industryTrends };
}

export function buildDisplayPortfolioRequirements(analysis) {
  const raw = analysis?.portfolioRequirements || {};
  const required = toCleanList(raw.required);
  const format = toCleanList(raw.format);
  const content = toCleanList(raw.content);
  let submission = stripMd(textFromItem(raw.submission));

  // 공고 원문을 못 읽은 폴백 분석이면 일반론 기본값을 지어내지 않고(실제 공고와 모순될 수 있음)
  // 백엔드가 넣은 값/안내를 그대로 보여준다.
  if (analysis?._scrapeWarning || analysis?._analysisWarning) {
    return {
      required,
      format,
      content,
      submission: submission || '공고 원문 확인 필요',
    };
  }

  const docs = toCleanList(analysis?.applicationFormat?.documents);
  const fileConstraints = analysis?.applicationFormat?.fileConstraints || {};

  // AI가 샘플 텍스트 그대로 넣은 경우만 공고 원문 기반 필드로 정리한다.
  // 공고에 없는 PDF/파일 크기/프로젝트 개수 같은 기본값은 만들지 않는다.
  const isBarelyFilled =
    required.length + format.length + content.length < 2 ||
    required.some(r => r.includes('예:') || r.includes('서류1') || r.includes('서류2'));

  if (isBarelyFilled) {
    if (required.length === 0) {
      const portfolioDocs = docs.filter(d => /포트폴리오|portfolio|github|링크|url/i.test(d));
      if (portfolioDocs.length > 0) {
        portfolioDocs.forEach(d => { if (!required.includes(d)) required.push(d); });
      }
    }

    if (format.length === 0) {
      if (fileConstraints.format) format.push(`허용 형식: ${fileConstraints.format}`);
      if (fileConstraints.maxSize) format.push(`최대 파일 크기: ${fileConstraints.maxSize}`);
    }

  }

  if (!submission) {
    submission = '';
  }

  return {
    required: [...new Set(required)].filter(Boolean),
    format: [...new Set(format)].filter(Boolean),
    content: [...new Set(content)].filter(Boolean),
    submission,
  };
}

export default function JobLinkInput({ onAnalysisComplete, onSkip, compact = false }) {
  const [mode, setMode] = useState(compact ? 'details' : 'url');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSites, setShowSites] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');

  const detectedSite = JOB_SITES.find(s => url.includes(s.domain));

  const STAGES = [
    { at: 0, label: '기업 분석 중...' },
    { at: 25, label: '직무 분석 중...' },
    { at: 50, label: '지원 전략 분석 중...' },
    { at: 75, label: '산업 트렌드 분석 중...' },
    { at: 95, label: '결과 정리 중...' },
  ];

  useEffect(() => {
    if (!loading) { setProgress(0); setProgressStage(''); return; }
    let current = 0;
    setProgressStage(STAGES[0].label);
    const interval = setInterval(() => {
      current += Math.random() * 3 + 0.5;
      if (current > 95) current = 95;
      setProgress(Math.round(current));
      const stage = [...STAGES].reverse().find(s => current >= s.at);
      if (stage) setProgressStage(stage.label);
    }, 200);
    return () => clearInterval(interval);
  }, [loading]);

  const handleAnalyze = async () => {
    const trimmedUrl = url.trim();
    const trimmedCompany = company.trim();
    const trimmedPosition = position.trim();
    const trimmedDeadline = deadline.trim();

    if (mode === 'url' && !trimmedUrl) return;
    if (mode === 'text' && !pastedText.trim()) return;
    if (mode === 'details' && (!trimmedCompany || !trimmedPosition || !trimmedDeadline)) return;

    setLoading(true);
    setError(null);
    try {
      const payload = {
        company: trimmedCompany || undefined,
        position: trimmedPosition || undefined,
        deadline: trimmedDeadline || undefined,
      };
      if (mode === 'url') payload.url = trimmedUrl;
      if (mode === 'text') payload.text = pastedText.trim();

      const { data } = await api.post('/job/analyze', payload, { timeout: 300000 });
      onAnalysisComplete(data.analysis);
    } catch (err) {
      setError(err.response?.data?.error || '채용공고 분석에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    mode === 'url'
      ? !!url.trim()
      : mode === 'text'
        ? !!pastedText.trim()
        : !!(company.trim() && position.trim() && deadline.trim());
  const fieldClassName = 'w-full px-4 py-3 border border-surface-200 rounded-lg text-[14px] text-bluewood-800 placeholder:text-bluewood-300 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-colors bg-white';
  const tabClass = (active) => `flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-bold transition-colors ${active ? 'bg-white text-primary-700 shadow-sm' : 'text-bluewood-400 hover:text-bluewood-700'}`;

  return (
    <div className="space-y-5">
      {!compact && (
        <div className="rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
          <p className="text-[13px] font-semibold text-primary-700">공고 링크 또는 기본 정보로 분석할 수 있어요</p>
          <p className="text-[12px] text-bluewood-400 mt-1 leading-relaxed">
            공고 링크를 넣으면 해당 공고 원문을 우선 분석하고, 기업명/모집분야/접수 기간은 보조 정보로 반영합니다.
          </p>
        </div>
      )}

      {!compact && (
        <div className="flex bg-surface-100 rounded-xl p-1">
          <button type="button" onClick={() => setMode('url')} className={tabClass(mode === 'url')}>
            <Globe size={14} /> 공고 링크
          </button>
          <button type="button" onClick={() => setMode('text')} className={tabClass(mode === 'text')}>
            <FileText size={14} /> 내용 붙여넣기
          </button>
          <button type="button" onClick={() => setMode('details')} className={tabClass(mode === 'details')}>
            <Search size={14} /> 정보로 분석
          </button>
        </div>
      )}

      {!compact && mode === 'url' && (
        <div className="relative flex justify-center">
          <button
            type="button"
            onClick={() => setShowSites(!showSites)}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-bluewood-400 border border-surface-200 rounded-lg hover:border-bluewood-300 hover:text-bluewood-700 bg-white transition-colors"
          >
            <Search size={13} />
            지원할 공고 찾아보기
            {showSites ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showSites && (
            <div className="absolute top-full mt-1.5 bg-white border border-surface-200 rounded-xl shadow-lg z-10 py-1 min-w-[200px]">
              {JOB_SITES.map(site => (
                <a
                  key={site.name}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 text-[13px] text-bluewood-700 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${site.color}`} />
                  {site.name} 공채달력
                  <ExternalLink size={12} className="text-bluewood-300 ml-auto" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'url' && (
        <div className="relative">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            placeholder="https:// 지원할 공고 링크를 입력하세요"
            className={`${fieldClassName} ${detectedSite ? 'pr-28' : ''}`}
          />
          {detectedSite && (
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-white px-2 py-0.5 rounded ${detectedSite.color}`}>
              {detectedSite.name}
            </span>
          )}
        </div>
      )}

      {mode === 'text' && (
        <div className="space-y-1.5">
          <textarea
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            placeholder={'채용공고 페이지의 내용을 그대로 복사해서 붙여넣으세요.\n(자소설닷컴·로그인 필요 사이트 등 링크 분석이 안 될 때 가장 정확합니다)'}
            rows={8}
            className={`${fieldClassName} resize-y min-h-[160px] leading-relaxed`}
          />
          <p className="text-[12px] text-bluewood-300">공고 원문을 그대로 붙여넣으면 자유 양식·제출 조건 등 실제 내용을 정확히 분석합니다.</p>
        </div>
      )}

      {mode === 'details' && (
        <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'md:grid-cols-3'}`}>
          <div className="space-y-1.5">
            <p className="text-[12px] font-semibold text-bluewood-600">기업명</p>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="예: 카카오" className={fieldClassName} />
          </div>
          <div className="space-y-1.5">
            <p className="text-[12px] font-semibold text-bluewood-600">모집분야</p>
            <input value={position} onChange={e => setPosition(e.target.value)} placeholder="예: 백엔드 개발자" className={fieldClassName} />
          </div>
          <div className="space-y-1.5">
            <p className="text-[12px] font-semibold text-bluewood-600">지원서 접수 기간</p>
            <input
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder="예: 2026.05.12 ~ 2026.05.26"
              className={fieldClassName}
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-6 space-y-4">
          <div className="text-center">
            <div className="text-4xl font-black text-primary-600 mb-1">{progress}%</div>
            <p className="text-[13px] font-semibold text-primary-700">{progressStage}</p>
          </div>
          <div className="w-full bg-primary-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-primary-600 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {STAGES.slice(0, 4).map((s, i) => (
              <div key={i} className={`text-[12px] font-medium transition-colors ${progress >= s.at ? 'text-primary-600' : 'text-bluewood-200'}`}>
                <div className={`w-6 h-6 mx-auto mb-1 rounded-full flex items-center justify-center text-[12px] font-bold ${progress >= s.at ? 'bg-primary-600 text-white' : 'bg-surface-200 text-bluewood-300'}`}>
                  {progress >= (STAGES[i + 1]?.at || 100) ? '✓' : i + 1}
                </div>
                {s.label.replace(' 중...', '')}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-[13px] text-red-500 flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
          <X size={13} /> {error}
        </p>
      )}

      {!loading && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!canSubmit}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg text-[14px] font-bold hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-primary-100"
          >
            {mode === 'url' ? '공고 링크로 기업 분석하기' : mode === 'text' ? '붙여넣은 공고로 기업 분석하기' : '기업 분석하기'}
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="px-5 py-3 text-[14px] font-medium text-bluewood-400 hover:text-bluewood-700 rounded-lg hover:bg-surface-100 border border-surface-200 transition-colors"
            >
              건너뛰기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 상세 기업 분석 패널 (에디터에서 표시용) ── */
export function JobAnalysisBadge({ analysis, onRemove, experiences }) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('company');
  const [prevTab, setPrevTab] = useState('company');
  const [animating, setAnimating] = useState(false);

  if (!analysis) return null;

  const {
    companyAnalysis: ca,
    positionAnalysis: pa,
    applicationStrategy: as_,
    industryTrends: trends,
  } = normalizeAnalysisForDisplay(analysis);
  const portfolioReq = buildDisplayPortfolioRequirements(analysis);

  const tabs = [
    { key: 'company', label: '기업 분석' },
    { key: 'position', label: '직무 분석' },
    { key: 'strategy', label: '지원 전략' },
    { key: 'trends', label: '산업 트렌드' },
  ];

  const currentTabIdx = tabs.findIndex(t => t.key === activeTab);

  const handleTabChange = (key) => {
    if (key === activeTab || animating) return;
    setPrevTab(activeTab);
    setAnimating(true);
    setActiveTab(key);
    setTimeout(() => setAnimating(false), 400);
  };

  const flipDir = tabs.findIndex(t => t.key === activeTab) > tabs.findIndex(t => t.key === prevTab) ? 'right' : 'left';

  const NAV = '#002F6C';

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* 헤더 */}
      <div style={{ borderBottom: `2px solid ${NAV}`, paddingBottom: 12, marginBottom: 14 }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
        >
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: NAV, letterSpacing: '-0.01em', margin: 0 }}>
              {analysis.company || '기업'}
            </p>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
              {analysis.position || '직무'}{analysis.deadline ? ` · 마감 ${analysis.deadline}` : ''}
            </p>
          </div>
          <ChevronDown size={16} style={{ color: NAV, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
        </button>
        {(analysis.skills?.length > 0 || analysis.coreValues?.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
            {analysis.skills?.slice(0, 5).map((s, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: '#f1f5f9', color: NAV, fontWeight: 700, letterSpacing: '0.03em', border: `1px solid ${NAV}` }}>{s}</span>
            ))}
            {analysis.coreValues?.slice(0, 2).map((v, i) => (
              <span key={`v${i}`} style={{ fontSize: 11, padding: '3px 8px', background: '#fff', color: '#64748b', border: '1px dotted #94a3b8', fontWeight: 500 }}>{v}</span>
            ))}
          </div>
        )}
        {(analysis._scrapeWarning || analysis._analysisWarning) && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 11.5, color: '#92400e', lineHeight: 1.5 }}>
            {analysis._sourceType === 'manual-entry' || analysis._sourceType === 'manual-entry-guide'
              ? '공고 원문 없이 기업명/모집분야 기반 준비 가이드로 작성했습니다. 담당업무·제출 조건은 실제 공고 원문으로 확인해 주세요.'
              : analysis._sourceType === 'url-search-guide' || analysis._sourceType === 'posting-metadata-fallback'
                ? '공고 원문 자동 수집이 제한된 항목은 공고 메타/공개 기업 정보로 보강했습니다. 제출 조건은 실제 공고 원문으로 확인해 주세요.'
                : '공고 원문을 기준으로 분석했고, 기업 정보는 공개 자료로 보강했습니다.'}
          </div>
        )}
      </div>

      {expanded && (
        <div>
          {/* 탭 */}
          <div style={{ display: 'flex', borderBottom: '1px dotted #d1d5db', marginBottom: 16, overflowX: 'auto' }}>
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                style={{
                  flex: 1, padding: '8px 2px', fontSize: 12,
                  fontWeight: activeTab === tab.key ? 700 : 500,
                  color: activeTab === tab.key ? NAV : '#94a3b8',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.key ? `2px solid ${NAV}` : '2px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1, whiteSpace: 'nowrap',
                  flexShrink: 0, minWidth: 0,
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 페이지 번호 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Chapter {currentTabIdx + 1}</p>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>p.{currentTabIdx + 1} / {tabs.length}</p>
          </div>

          {/* 내용 */}
          <div
            className={animating ? (flipDir === 'right' ? 'animate-page-flip-right' : 'animate-page-flip-left') : ''}
            style={{ transformOrigin: flipDir === 'right' ? 'left center' : 'right center' }}
          >
            <style>{`
              @keyframes pageFlipRight {
                0% { opacity:0; transform: rotateY(-12deg) translateX(30px); }
                100% { opacity:1; transform: rotateY(0) translateX(0); }
              }
              @keyframes pageFlipLeft {
                0% { opacity:0; transform: rotateY(12deg) translateX(-30px); }
                100% { opacity:1; transform: rotateY(0) translateX(0); }
              }
              .animate-page-flip-right { animation: pageFlipRight 0.4s ease-out; }
              .animate-page-flip-left { animation: pageFlipLeft 0.4s ease-out; }
            `}</style>

            {activeTab === 'company' && (
              <div>
                <AnalysisCard title="포트폴리오 요건">
                  {(() => {
                    const pr = portfolioReq;
                    const hasData = pr.required?.length > 0 || pr.format?.length > 0 || pr.content?.length > 0 || pr.submission;
                    if (!hasData) return <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '8px 0' }}>별도 포트폴리오 요건이 없습니다</p>;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {pr.required?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: NAV, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>필수 서류</p>
                            {pr.required.map((r, i) => <p key={i} style={{ fontSize: 13, color: '#374151', paddingLeft: 10, borderLeft: `2px solid ${NAV}`, marginBottom: 4, lineHeight: 1.6 }}>{stripMd(r)}</p>)}
                          </div>
                        )}
                        {pr.format?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>포맷 조건</p>
                            {pr.format.map((f, i) => <p key={i} style={{ fontSize: 13, color: '#374151', paddingLeft: 10, borderLeft: '1px dotted #94a3b8', marginBottom: 4, lineHeight: 1.6 }}>{stripMd(f)}</p>)}
                          </div>
                        )}
                        {pr.content?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>담아야 할 내용</p>
                            {pr.content.map((c, i) => <p key={i} style={{ fontSize: 13, color: '#374151', paddingLeft: 10, borderLeft: '1px dotted #94a3b8', marginBottom: 4, lineHeight: 1.6 }}>{stripMd(c)}</p>)}
                          </div>
                        )}
                        {pr.submission && (
                          <div style={{ borderTop: '1px dotted #e2e8f0', paddingTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>제출 방법</p>
                            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{stripMd(pr.submission)}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </AnalysisCard>
                {ca.overview && <AnalysisCard title="기업 개요"><p style={{ color: '#374151', lineHeight: 1.7, fontSize: 13 }}>{stripMd(ca.overview)}</p></AnalysisCard>}
                {(ca.industry || ca.homepage) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    {ca.industry && <AnalysisCard title="업종" compact><p style={{ color: '#374151', fontSize: 13 }}>{ca.industry}</p></AnalysisCard>}
                    {ca.homepage && <AnalysisCard title="홈페이지" compact><a href={ca.homepage} target="_blank" rel="noopener noreferrer" style={{ color: NAV, fontSize: 12, textDecoration: 'none' }}>{ca.homepage}</a></AnalysisCard>}
                  </div>
                )}
                {ca.businessAreas?.length > 0 && (
                  <AnalysisCard title="사업 영역">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {ca.businessAreas.map((a, i) => <span key={i} style={{ fontSize: 12, padding: '3px 8px', border: `1px solid ${NAV}`, color: NAV }}>{a}</span>)}
                    </div>
                  </AnalysisCard>
                )}
                {(ca.strengths?.length > 0 || ca.weaknesses?.length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    {ca.strengths?.length > 0 && (
                      <AnalysisCard title="강점 (S)">
                        {ca.strengths.map((s, i) => <p key={i} style={{ color: '#374151', paddingLeft: 8, borderLeft: `2px solid ${NAV}`, marginBottom: 5, fontSize: 12, lineHeight: 1.55 }}>{stripMd(s)}</p>)}
                      </AnalysisCard>
                    )}
                    {ca.weaknesses?.length > 0 && (
                      <AnalysisCard title="약점 (W)">
                        {ca.weaknesses.map((w, i) => <p key={i} style={{ color: '#374151', paddingLeft: 8, borderLeft: '1px dotted #94a3b8', marginBottom: 5, fontSize: 12, lineHeight: 1.55 }}>{stripMd(w)}</p>)}
                      </AnalysisCard>
                    )}
                  </div>
                )}
                {ca.competitors?.length > 0 && (
                  <AnalysisCard title="경쟁사">
                    {ca.competitors.map((c, i) => (
                      <div key={i} style={{ borderBottom: '1px dotted #e2e8f0', paddingBottom: 8, marginBottom: 8 }}>
                        <p style={{ fontWeight: 700, color: NAV, fontSize: 13, marginBottom: 3 }}>{c.name}</p>
                        <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.55 }}>{stripMd(c.comparison)}</p>
                      </div>
                    ))}
                  </AnalysisCard>
                )}
                {ca.culture && <AnalysisCard title="기업 문화"><p style={{ color: '#374151', lineHeight: 1.7, fontSize: 13 }}>{stripMd(ca.culture)}</p></AnalysisCard>}
                {ca.recentTrends && <AnalysisCard title="최근 동향"><p style={{ color: '#374151', lineHeight: 1.7, fontSize: 13 }}>{stripMd(ca.recentTrends)}</p></AnalysisCard>}
                {ca.sourceNotes?.length > 0 && (
                  <AnalysisCard title="참고 출처">
                    {ca.sourceNotes.slice(0, 5).map((note, i) => (
                      <p key={i} style={{ color: '#64748b', paddingLeft: 8, borderLeft: '1px dotted #94a3b8', marginBottom: 5, fontSize: 12, lineHeight: 1.55 }}>{stripMd(String(note))}</p>
                    ))}
                  </AnalysisCard>
                )}
              </div>
            )}

            {activeTab === 'position' && (
              <div>
                {pa.roleDescription && <AnalysisCard title="직무 설명"><p style={{ color: '#374151', lineHeight: 1.7, fontSize: 13 }}>{stripMd(pa.roleDescription)}</p></AnalysisCard>}
                {pa.dailyTasks && <AnalysisCard title="주요 업무"><p style={{ color: '#374151', lineHeight: 1.7, fontSize: 13 }}>{typeof pa.dailyTasks === 'string' ? stripMd(pa.dailyTasks) : ''}</p></AnalysisCard>}
                {pa.keyCompetencies?.length > 0 && (
                  <AnalysisCard title="핵심 역량">
                    {pa.keyCompetencies.map((c, i) => {
                      const name = typeof c === 'string' ? c : c.name;
                      const weight = typeof c === 'string' ? 5 : (c.weight || 5);
                      const desc = typeof c === 'string' ? '' : c.description;
                      return (
                        <div key={i} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{name}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{weight}/10</span>
                          </div>
                          <div style={{ width: '100%', height: 2, background: '#e2e8f0' }}>
                            <div style={{ height: 2, background: NAV, width: `${weight * 10}%` }} />
                          </div>
                          {desc && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{stripMd(desc)}</p>}
                        </div>
                      );
                    })}
                  </AnalysisCard>
                )}
                {pa.challengeLevel && (
                  <AnalysisCard title="직무 난이도">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, border: `2px solid ${NAV}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: NAV }}>{pa.challengeLevel.score}</span>
                      </div>
                      <p style={{ color: '#374151', lineHeight: 1.6, fontSize: 13 }}>{stripMd(pa.challengeLevel.description)}</p>
                    </div>
                  </AnalysisCard>
                )}
                {pa.growthPath && <AnalysisCard title="성장 경로"><p style={{ color: '#374151', lineHeight: 1.7, fontSize: 13 }}>{stripMd(pa.growthPath)}</p></AnalysisCard>}
                {analysis.requirements?.essential?.length > 0 && (
                  <AnalysisCard title="필수 요건">
                    {analysis.requirements.essential.map((r, i) => {
                      const text = stripMd(textFromItem(r));
                      const reason = typeof r === 'object' && r ? stripMd(r.reason || '') : '';
                      if (!text) return null;
                      return (
                        <div key={i} style={{ paddingLeft: 10, borderLeft: `2px solid ${NAV}`, marginBottom: 5 }}>
                          <p style={{ color: '#374151', fontSize: 13, lineHeight: 1.55 }}>{text}</p>
                          {reason && <p style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{reason}</p>}
                        </div>
                      );
                    })}
                  </AnalysisCard>
                )}
                {analysis.requirements?.preferred?.length > 0 && (
                  <AnalysisCard title="우대 요건">
                    {analysis.requirements.preferred.map((r, i) => {
                      const text = stripMd(textFromItem(r));
                      const reason = typeof r === 'object' && r ? stripMd(r.reason || '') : '';
                      if (!text) return null;
                      return (
                        <div key={i} style={{ paddingLeft: 10, borderLeft: '1px dotted #94a3b8', marginBottom: 5 }}>
                          <p style={{ color: '#374151', fontSize: 13, lineHeight: 1.55 }}>{text}</p>
                          {reason && <p style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{reason}</p>}
                        </div>
                      );
                    })}
                  </AnalysisCard>
                )}
              </div>
            )}

            {activeTab === 'strategy' && (
              <div>
                {as_.motivationPoints?.length > 0 && (
                  <AnalysisCard title="지원동기 포인트">
                    {as_.motivationPoints.map((p, i) => {
                      const point = typeof p === 'string' ? p : p.point;
                      const how = typeof p === 'string' ? '' : p.how;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                          <span style={{ width: 20, height: 20, border: `1.5px solid ${NAV}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: NAV, flexShrink: 0 }}>{i + 1}</span>
                          <div>
                            <p style={{ fontWeight: 600, color: '#1e293b', fontSize: 13, lineHeight: 1.55 }}>{stripMd(point)}</p>
                            {how && <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>활용 방법: {stripMd(how)}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </AnalysisCard>
                )}
                {as_.interviewQuestions?.length > 0 && (
                  <AnalysisCard title="면접 예상 질문">
                    {as_.interviewQuestions.map((q, i) => {
                      const question = typeof q === 'string' ? q : q.question;
                      const intent = typeof q === 'string' ? '' : q.intent;
                      const tip = typeof q === 'string' ? '' : q.answerTip;
                      return (
                        <div key={i} style={{ borderBottom: '1px dotted #e2e8f0', paddingBottom: 10, marginBottom: 10 }}>
                          <p style={{ fontWeight: 600, color: '#1e293b', fontSize: 13, lineHeight: 1.55 }}>
                            <span style={{ color: NAV, fontWeight: 800 }}>Q{i + 1}.</span> {question}
                          </p>
                          {intent && <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>의도: {stripMd(intent)}</p>}
                          {tip && <p style={{ fontSize: 12, color: '#374151', marginTop: 3 }}>전략: {stripMd(tip)}</p>}
                        </div>
                      );
                    })}
                  </AnalysisCard>
                )}
                {as_.appealPoints?.length > 0 && (
                  <AnalysisCard title="어필 포인트">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {as_.appealPoints.map((p, i) => {
                        const text = typeof p === 'string' ? p : (p.point || p.text || p.content || Object.values(p)[0] || '');
                        return <span key={i} style={{ fontSize: 12, padding: '3px 8px', border: `1px solid ${NAV}`, color: NAV }}>{stripMd(String(text))}</span>;
                      })}
                    </div>
                  </AnalysisCard>
                )}
                {as_.portfolioTips?.length > 0 && (
                  <AnalysisCard title="포트폴리오 팁">
                    {as_.portfolioTips.map((t, i) => {
                      const text = typeof t === 'string' ? t : (t.tip || t.text || t.content || Object.values(t)[0] || '');
                      return <p key={i} style={{ color: '#374151', paddingLeft: 10, borderLeft: `2px solid ${NAV}`, marginBottom: 5, fontSize: 13, lineHeight: 1.55 }}>{stripMd(String(text))}</p>;
                    })}
                  </AnalysisCard>
                )}
                {as_.cautionPoints?.length > 0 && (
                  <AnalysisCard title="주의 사항">
                    {as_.cautionPoints.map((p, i) => {
                      const text = typeof p === 'string' ? p : (p.point || p.text || p.content || Object.values(p)[0] || '');
                      return <p key={i} style={{ color: '#374151', paddingLeft: 10, borderLeft: '1px dotted #f59e0b', marginBottom: 5, fontSize: 13, lineHeight: 1.55 }}>{stripMd(String(text))}</p>;
                    })}
                  </AnalysisCard>
                )}
                {analysis.applicationFormat?.questions?.length > 0 && (
                  <AnalysisCard title="자소서 문항">
                    {analysis.applicationFormat.questions.map((q, i) => (
                      <p key={i} style={{ color: '#374151', paddingLeft: 10, borderLeft: `1px dotted ${NAV}`, marginBottom: 8, fontSize: 13, lineHeight: 1.55 }}>
                        <span style={{ fontWeight: 800, color: NAV }}>{i + 1}.</span> {q.question}
                        {q.maxLength && <span style={{ color: '#94a3b8', fontSize: 11 }}> ({q.maxLength}자)</span>}
                      </p>
                    ))}
                  </AnalysisCard>
                )}
              </div>
            )}

            {activeTab === 'trends' && (
              <div>
                {trends.length > 0 ? trends.map((t, i) => {
                  const trend = typeof t === 'string' ? t : t.trend;
                  const desc = typeof t === 'string' ? '' : t.description;
                  const impact = typeof t === 'string' ? '' : t.impact;
                  const keywords = typeof t === 'string' ? [] : (t.keywords || []);
                  const level = typeof t === 'string' ? '' : t.level;
                  const opportunity = typeof t === 'string' ? '' : t.opportunity;
                  const threat = typeof t === 'string' ? '' : t.threat;
                  const levelLabels = { hot: 'HOT', growing: 'GROWING', stable: 'STABLE' };
                  const levelColors = { hot: '#dc2626', growing: '#059669', stable: '#64748b' };
                  return (
                    <AnalysisCard key={i} title="">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: desc ? 8 : 0 }}>
                        <span style={{ width: 22, height: 22, border: `1.5px solid ${NAV}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: NAV, flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <p style={{ fontWeight: 700, color: '#1e293b', fontSize: 13, lineHeight: 1.4, margin: 0 }}>{trend}</p>
                            {level && <span style={{ fontSize: 10, fontWeight: 700, color: levelColors[level] || '#64748b', border: `1px solid ${levelColors[level] || '#64748b'}`, padding: '2px 6px', letterSpacing: '0.06em', flexShrink: 0 }}>{levelLabels[level] || level.toUpperCase()}</span>}
                          </div>
                        </div>
                      </div>
                      {desc && <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 7, paddingLeft: 32 }}>{stripMd(desc)}</p>}
                      {keywords.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 32, marginBottom: 7 }}>
                          {keywords.map((kw, ki) => <span key={ki} style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #cbd5e1', color: '#64748b' }}>#{kw}</span>)}
                        </div>
                      )}
                      {impact && <p style={{ fontSize: 11, color: NAV, borderLeft: `2px solid ${NAV}`, paddingLeft: 7, marginLeft: 32, marginBottom: 5, lineHeight: 1.5 }}><span style={{ fontWeight: 700 }}>직무 영향</span> {stripMd(impact)}</p>}
                      {opportunity && <p style={{ fontSize: 11, color: '#059669', borderLeft: '2px solid #059669', paddingLeft: 7, marginLeft: 32, marginBottom: 5, lineHeight: 1.5 }}><span style={{ fontWeight: 700 }}>기회</span> {stripMd(opportunity)}</p>}
                      {threat && <p style={{ fontSize: 11, color: '#b45309', borderLeft: '2px solid #f59e0b', paddingLeft: 7, marginLeft: 32, lineHeight: 1.5 }}><span style={{ fontWeight: 700 }}>주의</span> {stripMd(threat)}</p>}
                    </AnalysisCard>
                  );
                }) : (
                  <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '32px 0' }}>산업 트렌드 정보가 없습니다</p>
                )}
              </div>
            )}
          </div>

          {/* 하단 페이지 도트 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 14, borderTop: '1px dotted #e2e8f0', gap: 6, marginTop: 10 }}>
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                style={{ width: activeTab === tab.key ? 20 : 7, height: 7, background: activeTab === tab.key ? NAV : '#d1d5db', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ title, compact, children }) {
  return (
    <div style={{ paddingBottom: compact ? 10 : 16, marginBottom: compact ? 8 : 16, borderBottom: '1px dotted #e2e8f0', fontSize: 13 }}>
      {title && <p style={{ fontSize: 11, fontWeight: 700, color: '#002F6C', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: compact ? 5 : 8, paddingBottom: 4, borderBottom: '1px solid #002F6C', display: 'inline-block' }}>{title}</p>}
      <div>{children}</div>
    </div>
  );
}
