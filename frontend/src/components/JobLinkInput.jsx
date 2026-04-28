import { useState, useEffect } from 'react';
import { Globe, ClipboardPaste, Search, Loader2, X, Building2, ChevronDown, ChevronUp, ExternalLink, Sparkles, Check } from 'lucide-react';
import api from '../services/api';

const JOB_SITES = [
  { name: '자소설닷컴', domain: 'jasoseol.com', color: 'bg-purple-500', url: 'https://jasoseol.com/recruit' },
  { name: '잡코리아', domain: 'jobkorea.co.kr', color: 'bg-blue-500', url: 'https://www.jobkorea.co.kr/starter/calendar' },
  { name: '사람인', domain: 'saramin.co.kr', color: 'bg-green-500', url: 'https://calendar.saramin.co.kr' },
];

function toCleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
}

function stripMd(s) {
  return s ? String(s).replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s/gm, '').replace(/^[-•]\s/gm, '').trim() : '';
}

export function buildDisplayPortfolioRequirements(analysis) {
  const raw = analysis?.portfolioRequirements || {};
  const required = toCleanList(raw.required);
  const format = toCleanList(raw.format);
  const content = toCleanList(raw.content);
  let submission = typeof raw.submission === 'string' ? raw.submission.trim() : '';

  const docs = toCleanList(analysis?.applicationFormat?.documents);
  const fileConstraints = analysis?.applicationFormat?.fileConstraints || {};
  const portfolioTips = toCleanList(analysis?.applicationStrategy?.portfolioTips);

  // AI가 샘플 텍스트 그대로 넣거나 너무 부실하게 채운 경우 보강
  const isBarelyFilled =
    required.length + format.length + content.length < 2 ||
    required.some(r => r.includes('예:') || r.includes('서류1') || r.includes('서류2'));

  if (isBarelyFilled) {
    // required 보강
    if (required.length === 0) {
      const portfolioDocs = docs.filter(d => /포트폴리오|portfolio|github|링크|url/i.test(d));
      if (portfolioDocs.length > 0) {
        portfolioDocs.forEach(d => { if (!required.includes(d)) required.push(d); });
      } else if (docs.length > 0) {
        required.push(`제출 서류: ${docs.join(', ')}`);
      } else {
        const isDevRole = /개발|엔지니어|프로그래|백엔드|프론트|풀스택|devops/i.test(
          (analysis?.position || '') + (analysis?.skills || []).join('')
        );
        const isDesignRole = /디자인|designer|ux|ui|브랜드/i.test(analysis?.position || '');
        if (isDevRole) {
          required.push('PDF 포트폴리오 또는 GitHub 프로필 링크');
        } else if (isDesignRole) {
          required.push('PDF 포트폴리오 필수');
          required.push('Behance / 개인 사이트 링크 (선택)');
        } else {
          required.push('포트폴리오 또는 업무 결과물 파일');
        }
      }
    }

    // format 보강
    if (format.length === 0) {
      if (fileConstraints.format) format.push(`허용 형식: ${fileConstraints.format}`);
      if (fileConstraints.maxSize) format.push(`최대 파일 크기: ${fileConstraints.maxSize}`);
      if (format.length === 0) {
        format.push('PDF 형식 권장 (링크 제출 가능한 경우 URL 기재)');
        format.push('파일 크기 10MB 이하 권장');
      }
    }

    // content 보강
    if (content.length === 0 && portfolioTips.length > 0) {
      content.push(...portfolioTips.slice(0, 5));
    }
    if (content.length === 0) {
      content.push('본인이 참여한 주요 프로젝트 2~3개 이상');
      content.push('각 프로젝트의 본인 기여 범위 및 역할 명시');
      content.push('사용 기술 스택 목록 기재');
      content.push('정량적 성과 또는 결과 포함 (가능한 경우 수치 제시)');
    }
  }

  if (!submission) {
    if (docs.length > 0) {
      submission = '지원서 파일 첨부란 또는 링크 입력란에 기재';
    } else {
      submission = '채용 플랫폼의 지원 절차에 따라 제출';
    }
  }

  return {
    required: [...new Set(required)].filter(Boolean),
    format: [...new Set(format)].filter(Boolean),
    content: [...new Set(content)].filter(Boolean),
    submission,
  };
}

export default function JobLinkInput({ onAnalysisComplete, onSkip }) {
  const [mode, setMode] = useState('url'); // url | text
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
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
    if (mode === 'url' && !url.trim()) return;
    if (mode === 'text' && !text.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/job/analyze', {
        url: mode === 'url' ? url.trim() : undefined,
        text: mode === 'text' ? text.trim() : undefined,
      });
      onAnalysisComplete(data.analysis);
    } catch (err) {
      setError(err.response?.data?.error || '채용공고 분석에 실패했습니다');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* 모드 탭 */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors
            ${mode === 'url' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
        >
          URL 입력
        </button>
        <button
          onClick={() => setMode('text')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors
            ${mode === 'text' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
        >
          직접 입력
        </button>
      </div>

      {/* 사이트 바로가기 - 중앙 정렬 */}
      <div className="relative flex justify-center">
        <button
          onClick={() => setShowSites(!showSites)}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Search size={14} />
          지원할 공고 찾기
          {showSites ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showSites && (
          <div className="absolute top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1">
            {JOB_SITES.map(site => (
              <a
                key={site.name}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700"
              >
                <span className={`w-2 h-2 rounded-full ${site.color}`} />
                {site.name} 공채달력
                <ExternalLink size={12} className="text-gray-400 ml-auto" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* 입력 */}
      {mode === 'url' ? (
        <div className="relative">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https:// 공고 링크를 입력하세요"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 pr-28"
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
          />
          {detectedSite && (
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white px-2 py-0.5 rounded ${detectedSite.color}`}>
              {detectedSite.name}
            </span>
          )}
        </div>
      ) : (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="채용공고 내용을 붙여넣으세요"
          rows={6}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      )}

      {/* 로딩 프로그레스 */}
      {loading && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 space-y-4">
          <div className="text-center">
            <div className="text-4xl font-black text-blue-600 mb-1">{progress}%</div>
            <p className="text-sm font-medium text-blue-700">{progressStage}</p>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {STAGES.slice(0, 4).map((s, i) => (
              <div key={i} className={`text-[11px] font-medium transition-colors ${progress >= s.at ? 'text-blue-600' : 'text-gray-300'}`}>
                <div className={`w-6 h-6 mx-auto mb-1 rounded-full flex items-center justify-center text-[10px] ${progress >= s.at ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {progress >= (STAGES[i + 1]?.at || 100) ? '✓' : i + 1}
                </div>
                {s.label.replace(' 중...', '')}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <X size={14} /> {error}
        </p>
      )}

      {/* 버튼 */}
      {!loading && (
        <div className="flex gap-2">
          <button
            onClick={handleAnalyze}
            disabled={mode === 'url' ? !url.trim() : !text.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            공고 분석하기
          </button>
          {onSkip && (
            <button
              onClick={onSkip}
              className="px-6 py-3 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
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

  const ca = analysis.companyAnalysis || {};
  const pa = analysis.positionAnalysis || {};
  const as_ = analysis.applicationStrategy || {};
  const trends = analysis.industryTrends || [];
  const skillImp = analysis.skillImportance || [];
  const fitFactors = analysis.fitScoreFactors || [];
  const salaryRange = analysis.workConditions?.estimatedSalaryRange;
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

  return (
    <div className="relative" style={{ perspective: '1200px' }}>
      {/* 헤더 */}
      <div className="bg-white border border-gray-200 rounded-t-2xl px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-3 flex-1 text-left">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200">
              <Building2 size={20} className="text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 tracking-wide">
                {analysis.company || '기업'} ({analysis.position || '직무'})
              </p>
              <p className="text-[11px] text-gray-400">
                AI 기업 분석 보고서 {analysis.deadline && `· 마감 ${analysis.deadline}`}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="relative bg-white rounded-b-2xl border border-t-0 border-gray-200 shadow-sm overflow-hidden">
          {/* 스킬 태그 */}
          <div className="px-6 py-3 bg-gray-50/80 flex flex-wrap gap-2 border-b border-gray-100">
            {analysis.skills?.slice(0, 6).map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">{s}</span>
            ))}
            {analysis.coreValues?.slice(0, 3).map((v, i) => (
              <span key={`v${i}`} className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full font-medium">{v}</span>
            ))}
          </div>

          {/* 탭 */}
          <div className="flex border-b border-gray-200 px-4 bg-white overflow-x-auto">
            {tabs.map((tab, idx) => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap
                  ${activeTab === tab.key
                    ? 'border-gray-800 text-gray-800'
                    : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 페이지 번호 */}
          <div className="flex items-center justify-between px-6 pt-3 pb-1">
            <p className="text-[10px] text-gray-400 font-medium">Chapter {currentTabIdx + 1}</p>
            <p className="text-[10px] text-gray-400 font-medium">p.{currentTabIdx + 1} / {tabs.length}</p>
          </div>

          {/* 페이지 내용 (넘김 애니메이션) */}
          <div className="relative px-6 py-4 max-h-[520px] overflow-y-auto text-xs space-y-3 bg-white">
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
              <>
                {/* 포트폴리오 요건 — 맨 위 */}
                <AnalysisCard title="기업 포트폴리오 요건">
                  {(() => {
                    const pr = portfolioReq;
                    const hasData = pr.required?.length > 0 || pr.format?.length > 0 || pr.content?.length > 0 || pr.submission;
                    if (!hasData) {
                      return <p className="text-[10px] text-gray-400 text-center py-2">이 채용공고에는 별도의 포트폴리오 요건이 명시되어 있지 않습니다</p>;
                    }
                    return (
                      <div className="space-y-2.5">
                        {pr.required?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-red-500 mb-1">필수 제출 서류</p>
                            <ul className="space-y-1">
                              {pr.required.map((r, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-gray-700">
                                  <span className="text-red-400 flex-shrink-0 font-bold">!</span>{r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {pr.format?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-blue-500 mb-1">포맷/형식 조건</p>
                            <ul className="space-y-1">
                              {pr.format.map((f, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-gray-700">
                                  <span className="text-blue-400 flex-shrink-0">→</span>{f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {pr.content?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-emerald-500 mb-1">담아야 할 내용</p>
                            <ul className="space-y-1">
                              {pr.content.map((c, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-gray-700">
                                  <span className="text-emerald-500 flex-shrink-0">·</span>{c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {pr.submission && (
                          <div className="pt-1.5 border-t border-gray-100">
                            <p className="text-[10px] font-bold text-gray-500 mb-0.5">제출 방법</p>
                            <p className="text-gray-700">{pr.submission}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </AnalysisCard>
                {ca.overview && <AnalysisCard title="기업 개요"><p className="text-gray-700 leading-relaxed">{stripMd(ca.overview)}</p></AnalysisCard>}
                <div className="grid grid-cols-2 gap-3">
                  {ca.industry && <AnalysisCard title="업종" compact><p className="text-gray-700">{ca.industry}</p></AnalysisCard>}
                  {ca.homepage && <AnalysisCard title="홈페이지" compact><a href={ca.homepage} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block">{ca.homepage}</a></AnalysisCard>}
                </div>
                {ca.businessAreas?.length > 0 && (
                  <AnalysisCard title="사업 영역">
                    <div className="flex flex-wrap gap-1.5">{ca.businessAreas.map((a, i) => <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">{a}</span>)}</div>
                  </AnalysisCard>
                )}
                {(ca.strengths?.length > 0 || ca.weaknesses?.length > 0) && (
                  <div className="grid grid-cols-2 gap-3">
                    {ca.strengths?.length > 0 && (
                      <AnalysisCard title="강점 (S)">
                        <ul className="space-y-1">{ca.strengths.map((s, i) => <li key={i} className="flex items-start gap-1.5 text-gray-700"><span className="text-green-500 flex-shrink-0">+</span>{stripMd(s)}</li>)}</ul>
                      </AnalysisCard>
                    )}
                    {ca.weaknesses?.length > 0 && (
                      <AnalysisCard title="약점/리스크 (W)">
                        <ul className="space-y-1">{ca.weaknesses.map((w, i) => <li key={i} className="flex items-start gap-1.5 text-gray-700"><span className="text-orange-400 flex-shrink-0">-</span>{stripMd(w)}</li>)}</ul>
                      </AnalysisCard>
                    )}
                  </div>
                )}
                {ca.competitors?.length > 0 && (
                  <AnalysisCard title="경쟁사 비교">
                    <div className="space-y-2">{ca.competitors.map((c, i) => <div key={i} className="p-2 bg-gray-50 rounded-lg"><p className="font-bold text-gray-800 text-[11px]">{c.name}</p><p className="text-gray-600 text-[10px] mt-0.5">{stripMd(c.comparison)}</p></div>)}</div>
                  </AnalysisCard>
                )}
                {ca.culture && <AnalysisCard title="기업 문화"><p className="text-gray-700 leading-relaxed">{stripMd(ca.culture)}</p></AnalysisCard>}
                {ca.recentTrends && <AnalysisCard title="최근 동향"><p className="text-gray-700 leading-relaxed">{stripMd(ca.recentTrends)}</p></AnalysisCard>}
              </>
            )}

            {activeTab === 'position' && (
              <>
                {pa.roleDescription && <AnalysisCard title="직무 설명"><p className="text-gray-700 leading-relaxed">{stripMd(pa.roleDescription)}</p></AnalysisCard>}
                {pa.dailyTasks && <AnalysisCard title="주요 업무"><p className="text-gray-700 leading-relaxed">{typeof pa.dailyTasks === 'string' ? stripMd(pa.dailyTasks) : ''}</p></AnalysisCard>}
                {pa.keyCompetencies?.length > 0 && (
                  <AnalysisCard title="핵심 역량">
                    <div className="space-y-2">
                      {pa.keyCompetencies.map((c, i) => {
                        const name = typeof c === 'string' ? c : c.name;
                        const weight = typeof c === 'string' ? 5 : (c.weight || 5);
                        const desc = typeof c === 'string' ? '' : c.description;
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-medium text-gray-700">{name}</span>
                              <span className="text-[10px] text-gray-400">{weight}/10</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-gray-500" style={{ width: `${weight * 10}%` }} />
                            </div>
                            {desc && <p className="text-[10px] text-gray-400 mt-0.5">{stripMd(desc)}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </AnalysisCard>
                )}
                {pa.challengeLevel && (
                  <AnalysisCard title="직무 난이도">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <span className="text-lg font-black text-indigo-700">{pa.challengeLevel.score}</span>
                      </div>
                      <p className="text-gray-700 flex-1">{stripMd(pa.challengeLevel.description)}</p>
                    </div>
                  </AnalysisCard>
                )}
                {pa.growthPath && <AnalysisCard title="성장 경로"><p className="text-gray-700 leading-relaxed">{stripMd(pa.growthPath)}</p></AnalysisCard>}
                {analysis.requirements?.essential?.length > 0 && (
                  <AnalysisCard title="필수 요건">
                    <ul className="space-y-1">{analysis.requirements.essential.map((r, i) => <li key={i} className="flex items-start gap-1.5 text-gray-700"><span className="text-red-400 flex-shrink-0">•</span>{r}</li>)}</ul>
                  </AnalysisCard>
                )}
                {analysis.requirements?.preferred?.length > 0 && (
                  <AnalysisCard title="우대 요건">
                    <ul className="space-y-1">{analysis.requirements.preferred.map((r, i) => <li key={i} className="flex items-start gap-1.5 text-gray-700"><span className="text-blue-400 flex-shrink-0">•</span>{r}</li>)}</ul>
                  </AnalysisCard>
                )}
              </>
            )}

            {activeTab === 'strategy' && (
              <>
                {as_.motivationPoints?.length > 0 && (
                  <AnalysisCard title="지원동기 포인트">
                    <ul className="space-y-2">
                      {as_.motivationPoints.map((p, i) => {
                        const point = typeof p === 'string' ? p : p.point;
                        const how = typeof p === 'string' ? '' : p.how;
                        return (
                          <li key={i} className="text-gray-700">
                            <div className="flex items-start gap-2">
                              <span className="w-5 h-5 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                              <div><p className="font-medium">{stripMd(point)}</p>{how && <p className="text-[10px] text-gray-400 mt-0.5">활용 방법: {stripMd(how)}</p>}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </AnalysisCard>
                )}
                {as_.interviewQuestions?.length > 0 && (
                  <AnalysisCard title="면접 예상 질문">
                    <div className="space-y-3">
                      {as_.interviewQuestions.map((q, i) => {
                        const question = typeof q === 'string' ? q : q.question;
                        const intent = typeof q === 'string' ? '' : q.intent;
                        const tip = typeof q === 'string' ? '' : q.answerTip;
                        return (
                          <div key={i} className="p-2.5 bg-gray-50 rounded-lg">
                            <p className="font-medium text-gray-800"><span className="text-indigo-500">Q{i + 1}.</span> {question}</p>
                            {intent && <p className="text-[10px] text-blue-500 mt-1">면접관 의도: {stripMd(intent)}</p>}
                            {tip && <p className="text-[10px] text-green-600 mt-0.5">답변 전략: {stripMd(tip)}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </AnalysisCard>
                )}
                {as_.appealPoints?.length > 0 && (
                  <AnalysisCard title="어필 포인트">
                    <div className="flex flex-wrap gap-1.5">{as_.appealPoints.map((p, i) => <span key={i} className="px-2 py-1 bg-green-50 text-green-700 rounded-lg">{p}</span>)}</div>
                  </AnalysisCard>
                )}
                {as_.portfolioTips?.length > 0 && (
                  <AnalysisCard title="포트폴리오 작성 팁">
                    <ul className="space-y-1">{as_.portfolioTips.map((t, i) => <li key={i} className="flex items-start gap-1.5 text-gray-700"><span className="text-primary-500 flex-shrink-0">→</span>{t}</li>)}</ul>
                  </AnalysisCard>
                )}
                {as_.cautionPoints?.length > 0 && (
                  <AnalysisCard title="주의 사항">
                    <ul className="space-y-1">{as_.cautionPoints.map((p, i) => <li key={i} className="flex items-start gap-1.5 text-gray-700"><span className="text-orange-400 flex-shrink-0">!</span>{p}</li>)}</ul>
                  </AnalysisCard>
                )}
                {analysis.applicationFormat?.questions?.length > 0 && (
                  <AnalysisCard title="자소서 문항">
                    <ul className="space-y-2">{analysis.applicationFormat.questions.map((q, i) => <li key={i} className="text-gray-700 bg-gray-50 p-2 rounded-lg"><span className="font-medium">{i + 1}.</span> {q.question}{q.maxLength && <span className="ml-1 text-[10px] text-gray-400">({q.maxLength}자)</span>}</li>)}</ul>
                  </AnalysisCard>
                )}
              </>
            )}

            {activeTab === 'trends' && (
              <>
                {trends.length > 0 ? (
                  <div className="space-y-3">
                    {trends.map((t, i) => {
                      const trend = typeof t === 'string' ? t : t.trend;
                      const desc = typeof t === 'string' ? '' : t.description;
                      const impact = typeof t === 'string' ? '' : t.impact;
                      const keywords = typeof t === 'string' ? [] : (t.keywords || []);
                      const level = typeof t === 'string' ? '' : t.level;
                      const opportunity = typeof t === 'string' ? '' : t.opportunity;
                      const threat = typeof t === 'string' ? '' : t.threat;
                      const levelConfig = {
                        hot: { label: 'HOT', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100', headerBg: 'from-red-50 to-orange-50' },
                        growing: { label: 'GROWING', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', headerBg: 'from-emerald-50 to-teal-50' },
                        stable: { label: 'STABLE', bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-100', headerBg: 'from-gray-50 to-slate-50' },
                      };
                      const lc = levelConfig[level] || { label: '', bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-100', headerBg: 'from-indigo-50 to-purple-50' };
                      return (
                        <div key={i} className={`rounded-xl border ${lc.border} overflow-hidden shadow-sm`}>
                          <div className={`flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r ${lc.headerBg} border-b ${lc.border}`}>
                            <span className="w-6 h-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0">{i + 1}</span>
                            <p className="font-bold text-gray-800 flex-1 text-[12px] leading-snug">{trend}</p>
                            {level && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${lc.bg} ${lc.text} border ${lc.border} whitespace-nowrap`}>{lc.label}</span>}
                          </div>
                          <div className="p-3 space-y-2 bg-white">
                            {desc && <p className="text-[11px] text-gray-600 leading-relaxed">{stripMd(desc)}</p>}
                            {keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {keywords.map((kw, ki) => (
                                  <span key={ki} className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium border border-indigo-100">#{kw}</span>
                                ))}
                              </div>
                            )}
                            {impact && (
                              <div className="flex items-start gap-1.5 bg-blue-50 border border-blue-100 rounded-lg p-2">
                                <span className="flex-shrink-0 font-bold text-blue-600 text-[10px] whitespace-nowrap">직무 영향</span>
                                <span className="text-[10px] text-blue-700 leading-relaxed">{stripMd(impact)}</span>
                              </div>
                            )}
                            {opportunity && (
                              <div className="flex items-start gap-1.5 bg-green-50 border border-green-100 rounded-lg p-2">
                                <span className="flex-shrink-0 font-bold text-green-700 text-[10px] whitespace-nowrap">✓ 기회</span>
                                <span className="text-[10px] text-green-800 leading-relaxed">{stripMd(opportunity)}</span>
                              </div>
                            )}
                            {threat && (
                              <div className="flex items-start gap-1.5 bg-orange-50 border border-orange-100 rounded-lg p-2">
                                <span className="flex-shrink-0 font-bold text-orange-600 text-[10px] whitespace-nowrap">△ 주의</span>
                                <span className="text-[10px] text-orange-800 leading-relaxed">{stripMd(threat)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">산업 트렌드 정보가 없습니다</p>
                )}
              </>
            )}

            </div>{/* end animation wrapper */}
          </div>

          {/* 하단 페이지 장식 */}
          <div className="flex items-center justify-center py-2 border-t border-gray-100 bg-white">
            <div className="flex items-center gap-1.5">
              {tabs.map((tab, idx) => (
                <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                  className={`w-2 h-2 rounded-full transition-all ${activeTab === tab.key ? 'bg-gray-700 scale-125' : 'bg-gray-300 hover:bg-gray-400'}`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ title, compact, children }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${compact ? 'p-2.5' : 'p-3'}`}>
      <p className={`font-semibold text-gray-800 ${compact ? 'text-[11px] mb-1' : 'text-xs mb-2'}`}>{title}</p>
      {children}
    </div>
  );
}

