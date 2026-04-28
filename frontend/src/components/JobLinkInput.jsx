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
  return s ? String(s).replace(/\*\*/g, '').replace(/\*/g, '').replace(/<\/?u>/g, '').replace(/^#+\s/gm, '').replace(/^[-•]\s/gm, '').trim() : '';
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
      </div>

      {expanded && (
        <div>
          {/* 탭 */}
          <div style={{ display: 'flex', borderBottom: '1px dotted #d1d5db', marginBottom: 16 }}>
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                style={{
                  flex: 1, padding: '8px 2px', fontSize: 13,
                  fontWeight: activeTab === tab.key ? 700 : 500,
                  color: activeTab === tab.key ? NAV : '#94a3b8',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.key ? `2px solid ${NAV}` : '2px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1, whiteSpace: 'nowrap',
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
                            {pr.required.map((r, i) => <p key={i} style={{ fontSize: 13, color: '#374151', paddingLeft: 10, borderLeft: `2px solid ${NAV}`, marginBottom: 4, lineHeight: 1.6 }}>{r}</p>)}
                          </div>
                        )}
                        {pr.format?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>포맷 조건</p>
                            {pr.format.map((f, i) => <p key={i} style={{ fontSize: 13, color: '#374151', paddingLeft: 10, borderLeft: '1px dotted #94a3b8', marginBottom: 4, lineHeight: 1.6 }}>{f}</p>)}
                          </div>
                        )}
                        {pr.content?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>담아야 할 내용</p>
                            {pr.content.map((c, i) => <p key={i} style={{ fontSize: 13, color: '#374151', paddingLeft: 10, borderLeft: '1px dotted #94a3b8', marginBottom: 4, lineHeight: 1.6 }}>{c}</p>)}
                          </div>
                        )}
                        {pr.submission && (
                          <div style={{ borderTop: '1px dotted #e2e8f0', paddingTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>제출 방법</p>
                            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{pr.submission}</p>
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
                    {analysis.requirements.essential.map((r, i) => <p key={i} style={{ color: '#374151', paddingLeft: 10, borderLeft: `2px solid ${NAV}`, marginBottom: 5, fontSize: 13, lineHeight: 1.55 }}>{r}</p>)}
                  </AnalysisCard>
                )}
                {analysis.requirements?.preferred?.length > 0 && (
                  <AnalysisCard title="우대 요건">
                    {analysis.requirements.preferred.map((r, i) => <p key={i} style={{ color: '#374151', paddingLeft: 10, borderLeft: '1px dotted #94a3b8', marginBottom: 5, fontSize: 13, lineHeight: 1.55 }}>{r}</p>)}
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
                      {as_.appealPoints.map((p, i) => <span key={i} style={{ fontSize: 12, padding: '3px 8px', border: `1px solid ${NAV}`, color: NAV }}>{p}</span>)}
                    </div>
                  </AnalysisCard>
                )}
                {as_.portfolioTips?.length > 0 && (
                  <AnalysisCard title="포트폴리오 팁">
                    {as_.portfolioTips.map((t, i) => <p key={i} style={{ color: '#374151', paddingLeft: 10, borderLeft: `2px solid ${NAV}`, marginBottom: 5, fontSize: 13, lineHeight: 1.55 }}>{t}</p>)}
                  </AnalysisCard>
                )}
                {as_.cautionPoints?.length > 0 && (
                  <AnalysisCard title="주의 사항">
                    {as_.cautionPoints.map((p, i) => <p key={i} style={{ color: '#374151', paddingLeft: 10, borderLeft: '1px dotted #f59e0b', marginBottom: 5, fontSize: 13, lineHeight: 1.55 }}>{p}</p>)}
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

