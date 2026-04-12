import { useState } from 'react';
import { Globe, ClipboardPaste, Search, Loader2, X, Building2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import api from '../services/api';

const JOB_SITES = [
  { name: '자소설닷컴', domain: 'jasoseol.com', color: 'bg-purple-500', url: 'https://jasoseol.com/recruit' },
  { name: '잡코리아', domain: 'jobkorea.co.kr', color: 'bg-blue-500', url: 'https://www.jobkorea.co.kr/starter/calendar' },
  { name: '사람인', domain: 'saramin.co.kr', color: 'bg-green-500', url: 'https://calendar.saramin.co.kr' },
];

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
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('company');

  if (!analysis) return null;

  const ca = analysis.companyAnalysis || {};
  const pa = analysis.positionAnalysis || {};
  const as_ = analysis.applicationStrategy || {};
  const trends = analysis.industryTrends || [];

  const tabs = [
    { key: 'company', label: '기업 분석', icon: '🏢' },
    { key: 'position', label: '직무 분석', icon: '💼' },
    { key: 'strategy', label: '지원 전략', icon: '🎯' },
    { key: 'trends', label: '산업 트렌드', icon: '📈' },
  ];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
      {/* 헤더 */}
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
          {expanded
            ? <ChevronUp size={16} className="text-blue-400" />
            : <ChevronDown size={16} className="text-blue-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-blue-200">
          {/* 기본 정보 요약 바 */}
          <div className="px-5 py-3 bg-white/60 flex flex-wrap gap-2">
            {analysis.skills?.slice(0, 6).map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{s}</span>
            ))}
            {analysis.coreValues?.slice(0, 3).map((v, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">{v}</span>
            ))}
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex border-b border-blue-200 px-3 bg-white/40">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors 
                  ${activeTab === tab.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <span className="text-sm">{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div className="px-5 py-4 max-h-[420px] overflow-y-auto text-xs space-y-3">
            {/* ── 기업 분석 탭 ── */}
            {activeTab === 'company' && (
              <>
                {ca.overview && (
                  <AnalysisCard title="기업 개요" icon="📋">
                    <p className="text-gray-700 leading-relaxed">{ca.overview}</p>
                  </AnalysisCard>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {ca.industry && (
                    <AnalysisCard title="업종" icon="🏭" compact>
                      <p className="text-gray-700">{ca.industry}</p>
                    </AnalysisCard>
                  )}
                  {ca.homepage && (
                    <AnalysisCard title="홈페이지" icon="🌐" compact>
                      <a href={ca.homepage} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate block">{ca.homepage}</a>
                    </AnalysisCard>
                  )}
                </div>
                {ca.businessAreas?.length > 0 && (
                  <AnalysisCard title="사업 영역" icon="📊">
                    <div className="flex flex-wrap gap-1.5">
                      {ca.businessAreas.map((a, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">{a}</span>
                      ))}
                    </div>
                  </AnalysisCard>
                )}
                {ca.strengths?.length > 0 && (
                  <AnalysisCard title="기업 강점" icon="💪">
                    <ul className="space-y-1">
                      {ca.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-gray-700">
                          <span className="text-green-500 mt-0.5">✓</span> {s}
                        </li>
                      ))}
                    </ul>
                  </AnalysisCard>
                )}
                {ca.culture && (
                  <AnalysisCard title="기업 문화" icon="🤝">
                    <p className="text-gray-700 leading-relaxed">{ca.culture}</p>
                  </AnalysisCard>
                )}
                {ca.recentTrends && (
                  <AnalysisCard title="최근 동향" icon="📰">
                    <p className="text-gray-700 leading-relaxed">{ca.recentTrends}</p>
                  </AnalysisCard>
                )}
              </>
            )}

            {/* ── 직무 분석 탭 ── */}
            {activeTab === 'position' && (
              <>
                {pa.roleDescription && (
                  <AnalysisCard title="직무 설명" icon="📝">
                    <p className="text-gray-700 leading-relaxed">{pa.roleDescription}</p>
                  </AnalysisCard>
                )}
                {pa.dailyTasks && (
                  <AnalysisCard title="주요 업무" icon="📋">
                    <p className="text-gray-700 leading-relaxed">{pa.dailyTasks}</p>
                  </AnalysisCard>
                )}
                {pa.keyCompetencies?.length > 0 && (
                  <AnalysisCard title="핵심 역량" icon="⭐">
                    <div className="flex flex-wrap gap-1.5">
                      {pa.keyCompetencies.map((c, i) => (
                        <span key={i} className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg font-medium">{c}</span>
                      ))}
                    </div>
                  </AnalysisCard>
                )}
                {pa.growthPath && (
                  <AnalysisCard title="성장 경로" icon="🚀">
                    <p className="text-gray-700 leading-relaxed">{pa.growthPath}</p>
                  </AnalysisCard>
                )}
                {analysis.requirements?.essential?.length > 0 && (
                  <AnalysisCard title="필수 요건" icon="🔴">
                    <ul className="space-y-1">
                      {analysis.requirements.essential.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-gray-700">
                          <span className="text-red-400 mt-0.5">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </AnalysisCard>
                )}
                {analysis.requirements?.preferred?.length > 0 && (
                  <AnalysisCard title="우대 요건" icon="🔵">
                    <ul className="space-y-1">
                      {analysis.requirements.preferred.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-gray-700">
                          <span className="text-blue-400 mt-0.5">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </AnalysisCard>
                )}
              </>
            )}

            {/* ── 지원 전략 탭 ── */}
            {activeTab === 'strategy' && (
              <>
                {as_.motivationPoints?.length > 0 && (
                  <AnalysisCard title="지원동기 포인트" icon="💡">
                    <ul className="space-y-2">
                      {as_.motivationPoints.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-700">
                          <span className="w-5 h-5 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </AnalysisCard>
                )}
                {as_.interviewQuestions?.length > 0 && (
                  <AnalysisCard title="면접 예상 질문" icon="🎤">
                    <ul className="space-y-2">
                      {as_.interviewQuestions.map((q, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-700">
                          <span className="text-indigo-400 font-bold">Q{i + 1}.</span> {q}
                        </li>
                      ))}
                    </ul>
                  </AnalysisCard>
                )}
                {as_.appealPoints?.length > 0 && (
                  <AnalysisCard title="어필 포인트" icon="✨">
                    <div className="flex flex-wrap gap-1.5">
                      {as_.appealPoints.map((p, i) => (
                        <span key={i} className="px-2 py-1 bg-green-50 text-green-700 rounded-lg">{p}</span>
                      ))}
                    </div>
                  </AnalysisCard>
                )}
                {as_.cautionPoints?.length > 0 && (
                  <AnalysisCard title="주의 사항" icon="⚠️">
                    <ul className="space-y-1">
                      {as_.cautionPoints.map((p, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-gray-700">
                          <span className="text-orange-400 mt-0.5">!</span> {p}
                        </li>
                      ))}
                    </ul>
                  </AnalysisCard>
                )}
                {analysis.applicationFormat?.questions?.length > 0 && (
                  <AnalysisCard title="자소서 문항" icon="📄">
                    <ul className="space-y-2">
                      {analysis.applicationFormat.questions.map((q, i) => (
                        <li key={i} className="text-gray-700 bg-gray-50 p-2 rounded-lg">
                          <span className="font-medium text-gray-800">{i + 1}.</span> {q.question}
                          {q.maxLength && <span className="ml-1 text-[10px] text-gray-400">({q.maxLength}자)</span>}
                        </li>
                      ))}
                    </ul>
                  </AnalysisCard>
                )}
              </>
            )}

            {/* ── 산업 트렌드 탭 ── */}
            {activeTab === 'trends' && (
              <>
                {trends.length > 0 ? (
                  <div className="space-y-2">
                    {trends.map((t, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100">
                        <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                        <p className="text-gray-700 leading-relaxed">{t}</p>
                      </div>
                    ))}
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

/* ─ 분석 카드 서브 컴포넌트 ─ */
function AnalysisCard({ title, icon, compact, children }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 ${compact ? 'p-2.5' : 'p-3'}`}>
      <p className={`font-semibold text-gray-800 flex items-center gap-1.5 ${compact ? 'text-[11px] mb-1' : 'text-xs mb-2'}`}>
        <span>{icon}</span> {title}
      </p>
      {children}
    </div>
  );
}
