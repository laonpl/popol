import { useState } from 'react';
import { Globe, ClipboardPaste, Search, Loader2, X, Building2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import api from '../services/api';

const JOB_SITES = [
  { name: '자소설닷컴', domain: 'jasoseol.com', color: 'bg-purple-500', url: 'https://jasoseol.com' },
  { name: '잡코리아', domain: 'jobkorea.co.kr', color: 'bg-blue-500', url: 'https://www.jobkorea.co.kr' },
  { name: '사람인', domain: 'saramin.co.kr', color: 'bg-green-500', url: 'https://www.saramin.co.kr' },
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

/* ── 분석 결과 요약 뱃지 (에디터에서 표시용) ── */
export function JobAnalysisBadge({ analysis, onRemove }) {
  const [expanded, setExpanded] = useState(false);

  if (!analysis) return null;

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            {analysis.company || '기업'} · {analysis.position || '직무'}
          </span>
          {analysis.deadline && (
            <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
              마감: {analysis.deadline}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRemove && (
            <span
              onClick={e => { e.stopPropagation(); onRemove(); }}
              className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"
            >
              <X size={14} />
            </span>
          )}
          {expanded ? <ChevronUp size={14} className="text-blue-400" /> : <ChevronDown size={14} className="text-blue-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2 text-xs border-t border-blue-100 pt-2">
          {analysis.skills?.length > 0 && (
            <div>
              <span className="font-medium text-blue-700">요구 스킬: </span>
              <span className="text-blue-600">{analysis.skills.join(', ')}</span>
            </div>
          )}
          {analysis.requirements?.essential?.length > 0 && (
            <div>
              <span className="font-medium text-red-600">필수: </span>
              <span className="text-gray-600">{analysis.requirements.essential.join(' / ')}</span>
            </div>
          )}
          {analysis.requirements?.preferred?.length > 0 && (
            <div>
              <span className="font-medium text-blue-600">우대: </span>
              <span className="text-gray-600">{analysis.requirements.preferred.join(' / ')}</span>
            </div>
          )}
          {analysis.coreValues?.length > 0 && (
            <div>
              <span className="font-medium text-purple-600">인재상: </span>
              <span className="text-gray-600">{analysis.coreValues.join(', ')}</span>
            </div>
          )}
          {analysis.applicationFormat?.questions?.length > 0 && (
            <div>
              <span className="font-medium text-green-600">자소서 문항 {analysis.applicationFormat.questions.length}개 </span>
              {analysis.applicationFormat.questions.map((q, i) => (
                <p key={i} className="text-gray-500 ml-2">
                  {i + 1}. {q.question} {q.maxLength && `(${q.maxLength}자)`}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
