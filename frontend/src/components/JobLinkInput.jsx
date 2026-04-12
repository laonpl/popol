import { useState } from 'react';
import { Globe, ClipboardPaste, Search, Loader2, X, Building2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
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

  const detectedSite = JOB_SITES.find(s => url.includes(s.domain));

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
      {/* 사이트 바로가기 */}
      <div className="relative">
        <button
          onClick={() => setShowSites(!showSites)}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Search size={14} />
          지원할 공고 찾기
          {showSites ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showSites && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1">
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

      {/* 모드 탭 */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors
            ${mode === 'url' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
        >
          <Globe size={13} /> URL 입력
        </button>
        <button
          onClick={() => setMode('text')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors
            ${mode === 'text' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
        >
          <ClipboardPaste size={13} /> 직접 입력
        </button>
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

      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <X size={14} /> {error}
        </p>
      )}

      {/* 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={handleAnalyze}
          disabled={loading || (mode === 'url' ? !url.trim() : !text.trim())}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" /> 분석 중...</>
          ) : (
            <><Building2 size={14} /> 공고 분석하기</>
          )}
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            disabled={loading}
            className="px-6 py-3 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
          >
            건너뛰기
          </button>
        )}
      </div>
    </div>
  );
}

/* ── 상세 기업 분석 패널 (에디터에서 표시용) ── */
export function JobAnalysisBadge({ analysis, onRemove }) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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
    { key: 'overview', label: '종합' },
    { key: 'company', label: '기업 분석' },
    { key: 'position', label: '직무 분석' },
    { key: 'strategy', label: '지원 전략' },
    { key: 'trends', label: '산업 트렌드' },
  ];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-blue-100/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-blue-900">
              {analysis.company || '기업'} · {analysis.position || '직무'}
            </p>
            <p className="text-[11px] text-blue-500">
              AI 기업 분석 완료 {analysis.deadline && `· 마감 ${analysis.deadline}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRemove && (
            <span onClick={e => { e.stopPropagation(); onRemove(); }} className="text-gray-400 hover:text-red-500 cursor-pointer p-1">
              <X size={14} />
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-blue-400" /> : <ChevronDown size={16} className="text-blue-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-blue-200">
          <div className="px-5 py-3 bg-white/60 flex flex-wrap gap-2">
            {analysis.skills?.slice(0, 6).map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{s}</span>
            ))}
            {analysis.coreValues?.slice(0, 3).map((v, i) => (
              <span key={`v${i}`} className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">{v}</span>
            ))}
          </div>

          <div className="flex border-b border-blue-200 px-3 bg-white/40 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap
                  ${activeTab === tab.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-5 py-4 max-h-[520px] overflow-y-auto text-xs space-y-3">

            {activeTab === 'overview' && (
              <>
                {skillImp.length > 0 && (
                  <AnalysisCard title="스킬 중요도 분석">
                    <div className="space-y-2">
                      {skillImp.slice(0, 8).map((s, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-gray-700 font-medium">{s.skill}</span>
                            <span className="text-[10px] text-gray-400">{s.weight}/10</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${s.weight >= 8 ? 'bg-red-400' : s.weight >= 5 ? 'bg-blue-400' : 'bg-gray-300'}`}
                              style={{ width: `${s.weight * 10}%` }} />
                          </div>
                          {s.reason && <p className="text-[10px] text-gray-400 mt-0.5">{s.reason}</p>}
                        </div>
                      ))}
                    </div>
                  </AnalysisCard>
                )}
                {fitFactors.length > 0 && (
                  <AnalysisCard title="적합도 평가 기준">
                    <div className="space-y-2">
                      {fitFactors.map((f, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-gray-700 font-medium">{f.factor}</span>
                            <span className="text-[10px] font-bold text-primary-600">{f.maxScore}점</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-gradient-to-r from-primary-400 to-primary-600" style={{ width: `${f.maxScore}%` }} />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">{f.description}</p>
                        </div>
                      ))}
                    </div>
                  </AnalysisCard>
                )}
                {salaryRange && (
                  <AnalysisCard title="예상 연봉 범위">
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-2xl font-bold text-gray-800">{salaryRange.min?.toLocaleString()} ~ {salaryRange.max?.toLocaleString()}</span>
                      <span className="text-gray-500 text-[11px] mb-1">{salaryRange.unit}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 relative">
                      <div className="absolute h-3 rounded-full bg-gradient-to-r from-green-300 to-green-500"
                        style={{ left: `${(salaryRange.min / 10000) * 100}%`, width: `${Math.min(((salaryRange.max - salaryRange.min) / 10000) * 100, 80)}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{salaryRange.basis}</p>
                  </AnalysisCard>
                )}
                {ca.companySize && (
                  <div className="grid grid-cols-3 gap-2">
                    {ca.companySize.founded && <div className="bg-white rounded-xl border border-gray-100 p-2.5 text-center"><p className="text-[10px] text-gray-400 mb-0.5">설립</p><p className="text-sm font-bold text-gray-800">{ca.companySize.founded}</p></div>}
                    {ca.companySize.employees && <div className="bg-white rounded-xl border border-gray-100 p-2.5 text-center"><p className="text-[10px] text-gray-400 mb-0.5">직원</p><p className="text-sm font-bold text-gray-800">{ca.companySize.employees}</p></div>}
                    {ca.companySize.revenue && <div className="bg-white rounded-xl border border-gray-100 p-2.5 text-center"><p className="text-[10px] text-gray-400 mb-0.5">매출</p><p className="text-sm font-bold text-gray-800">{ca.companySize.revenue}</p></div>}
                  </div>
                )}
              </>
            )}

            {activeTab === 'company' && (
              <>
                {ca.overview && <AnalysisCard title="기업 개요"><p className="text-gray-700 leading-relaxed">{ca.overview}</p></AnalysisCard>}
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
                        <ul className="space-y-1">{ca.strengths.map((s, i) => <li key={i} className="flex items-start gap-1.5 text-gray-700"><span className="text-green-500 flex-shrink-0">+</span>{s}</li>)}</ul>
                      </AnalysisCard>
                    )}
                    {ca.weaknesses?.length > 0 && (
                      <AnalysisCard title="약점/리스크 (W)">
                        <ul className="space-y-1">{ca.weaknesses.map((w, i) => <li key={i} className="flex items-start gap-1.5 text-gray-700"><span className="text-orange-400 flex-shrink-0">-</span>{w}</li>)}</ul>
                      </AnalysisCard>
                    )}
                  </div>
                )}
                {ca.competitors?.length > 0 && (
                  <AnalysisCard title="경쟁사 비교">
                    <div className="space-y-2">{ca.competitors.map((c, i) => <div key={i} className="p-2 bg-gray-50 rounded-lg"><p className="font-bold text-gray-800 text-[11px]">{c.name}</p><p className="text-gray-600 text-[10px] mt-0.5">{c.comparison}</p></div>)}</div>
                  </AnalysisCard>
                )}
                {ca.culture && <AnalysisCard title="기업 문화"><p className="text-gray-700 leading-relaxed">{ca.culture}</p></AnalysisCard>}
                {ca.recentTrends && <AnalysisCard title="최근 동향"><p className="text-gray-700 leading-relaxed">{ca.recentTrends}</p></AnalysisCard>}

                {/* 포트폴리오 요건 */}
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
              </>
            )}

            {activeTab === 'position' && (
              <>
                {pa.roleDescription && <AnalysisCard title="직무 설명"><p className="text-gray-700 leading-relaxed">{pa.roleDescription}</p></AnalysisCard>}
                {pa.dailyTasks && <AnalysisCard title="주요 업무"><p className="text-gray-700 leading-relaxed">{typeof pa.dailyTasks === 'string' ? pa.dailyTasks : ''}</p></AnalysisCard>}
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
                              <span className="font-medium text-amber-700">{name}</span>
                              <span className="text-[10px] text-gray-400">{weight}/10</span>
                            </div>
                            <div className="w-full bg-amber-50 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${weight * 10}%` }} />
                            </div>
                            {desc && <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </AnalysisCard>
                )}
                {pa.teamStructure && <AnalysisCard title="예상 팀 구조"><p className="text-gray-700">{pa.teamStructure}</p></AnalysisCard>}
                {pa.challengeLevel && (
                  <AnalysisCard title="직무 난이도">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <span className="text-lg font-black text-indigo-700">{pa.challengeLevel.score}</span>
                      </div>
                      <p className="text-gray-700 flex-1">{pa.challengeLevel.description}</p>
                    </div>
                  </AnalysisCard>
                )}
                {pa.growthPath && <AnalysisCard title="성장 경로"><p className="text-gray-700 leading-relaxed">{pa.growthPath}</p></AnalysisCard>}
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
                              <div><p className="font-medium">{point}</p>{how && <p className="text-[10px] text-gray-400 mt-0.5">활용 방법: {how}</p>}</div>
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
                            {intent && <p className="text-[10px] text-blue-500 mt-1">면접관 의도: {intent}</p>}
                            {tip && <p className="text-[10px] text-green-600 mt-0.5">답변 전략: {tip}</p>}
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
                  <div className="space-y-2">
                    {trends.map((t, i) => {
                      const trend = typeof t === 'string' ? t : t.trend;
                      const desc = typeof t === 'string' ? '' : t.description;
                      const impact = typeof t === 'string' ? '' : t.impact;
                      return (
                        <div key={i} className="p-3 bg-white rounded-xl border border-gray-100">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                            <div>
                              <p className="font-medium text-gray-800">{trend}</p>
                              {desc && <p className="text-gray-600 mt-1 leading-relaxed">{desc}</p>}
                              {impact && <p className="text-[10px] text-blue-500 mt-1">직무 영향: {impact}</p>}
                            </div>
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
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ title, compact, children }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 ${compact ? 'p-2.5' : 'p-3'}`}>
      <p className={`font-semibold text-gray-800 ${compact ? 'text-[11px] mb-1' : 'text-xs mb-2'}`}>{title}</p>
      {children}
    </div>
  );
}

