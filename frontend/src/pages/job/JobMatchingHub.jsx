import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ArrowRight, ArrowLeft, Building2, Target, FileText,
  Briefcase, Star, AlertTriangle, CheckCircle2, Copy, Download,
  Loader2, Globe, ClipboardPaste, Sparkles, TrendingUp, Shield,
  ChevronDown, ChevronUp, RefreshCw, Save, Clock, MapPin, Zap,
} from 'lucide-react';
import useJobStore from '../../stores/jobStore';

/* ───────── 사이트 정보 ───────── */
const JOB_SITES = [
  { name: '잡코리아', domain: 'jobkorea.co.kr', color: 'bg-blue-500' },
  { name: '사람인', domain: 'saramin.co.kr', color: 'bg-green-500' },
  { name: '자소설닷컴', domain: 'jasoseol.com', color: 'bg-purple-500' },
];

const STEPS = [
  { key: 'input', label: '채용공고 입력', icon: Search },
  { key: 'analysis', label: '공고 분석', icon: Building2 },
  { key: 'matched', label: '경험 매칭', icon: Target },
  { key: 'result', label: '맞춤 생성', icon: Sparkles },
];

/* ───────── 메인 컴포넌트 ───────── */
export default function JobMatchingHub() {
  const {
    step, loading, error, jobAnalysis, matchResult, coverLetter,
    portfolioSuggestion, savedItems,
    reset, analyzePosting, matchExperiences,
    generateCoverLetter, generatePortfolio, saveResult, fetchSavedItems,
  } = useJobStore();

  useEffect(() => { fetchSavedItems(); }, []);

  const currentStepIdx = STEPS.findIndex(s =>
    s.key === step || (step === 'analyzing' && s.key === 'input')
    || (step === 'matching' && s.key === 'analysis')
    || (step === 'generating' && s.key === 'matched')
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">기업 매칭 분석</h1>
          <p className="text-sm text-gray-500 mt-1">
            채용공고를 분석하고 맞춤형 자소서·포트폴리오를 생성하세요
          </p>
        </div>
        {step !== 'input' && (
          <button onClick={reset} className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            <RefreshCw size={14} /> 새로 시작
          </button>
        )}
      </div>

      {/* 진행 스텝 바 */}
      <div className="flex items-center gap-2 bg-white rounded-2xl p-4 border border-gray-100">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === currentStepIdx;
          const isDone = i < currentStepIdx;
          return (
            <div key={s.key} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all w-full justify-center
                ${isActive ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200' : ''}
                ${isDone ? 'text-primary-600' : ''}
                ${!isActive && !isDone ? 'text-gray-400' : ''}`}>
                {isDone ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight size={14} className="mx-1 text-gray-300 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
          <AlertTriangle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* 스텝별 UI */}
      {(step === 'input' || step === 'analyzing') && <InputStep />}
      {(step === 'analysis' || step === 'matching') && <AnalysisStep />}
      {(step === 'matched' || step === 'generating') && <MatchedStep />}
      {step === 'result' && <ResultStep />}

      {/* 이전 분석 기록 */}
      {step === 'input' && savedItems.length > 0 && <SavedList items={savedItems} />}
    </div>
  );
}

/* ═══════════════════════════════════════
   1단계: 채용공고 입력
   ═══════════════════════════════════════ */
function InputStep() {
  const { loading, analyzePosting } = useJobStore();
  const [mode, setMode] = useState('url'); // url | text
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');

  const detectedSite = JOB_SITES.find(s => url.includes(s.domain));

  const handleAnalyze = () => {
    if (mode === 'url' && !url.trim()) return;
    if (mode === 'text' && !text.trim()) return;
    analyzePosting(mode === 'url' ? url.trim() : null, mode === 'text' ? text.trim() : null);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* 탭 */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors
            ${mode === 'url' ? 'text-primary-700 border-b-2 border-primary-500 bg-primary-50/30' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Globe size={16} /> URL로 분석
        </button>
        <button
          onClick={() => setMode('text')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors
            ${mode === 'text' ? 'text-primary-700 border-b-2 border-primary-500 bg-primary-50/30' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ClipboardPaste size={16} /> 텍스트 직접 입력
        </button>
      </div>

      <div className="p-6 space-y-5">
        {mode === 'url' ? (
          <>
            {/* 지원 사이트 안내 */}
            <div className="flex gap-3">
              {JOB_SITES.map(site => (
                <div key={site.name} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-600">
                  <span className={`w-2 h-2 rounded-full ${site.color}`} />
                  {site.name}
                </div>
              ))}
            </div>

            {/* URL 입력 */}
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="채용공고 URL을 붙여넣으세요 (잡코리아 / 사람인 / 자소설닷컴)"
                className="w-full px-4 py-3.5 pr-24 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              />
              {detectedSite && (
                <span className={`absolute right-20 top-1/2 -translate-y-1/2 text-xs text-white px-2 py-0.5 rounded ${detectedSite.color}`}>
                  {detectedSite.name}
                </span>
              )}
            </div>
          </>
        ) : (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`채용공고 내용을 복사하여 붙여넣으세요.\n\n예시:\n[기업명] OO 그룹\n[직무] 소프트웨어 엔지니어\n[자격요건]...\n[우대사항]...\n[제출서류]...`}
            rows={12}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading || (mode === 'url' ? !url.trim() : !text.trim())}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-xl font-medium text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              채용공고 분석 중... (최대 30초 소요)
            </>
          ) : (
            <>
              <Search size={16} /> 채용공고 분석하기
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   2단계: 분석 결과
   ═══════════════════════════════════════ */
function AnalysisStep() {
  const { jobAnalysis, loading, matchExperiences } = useJobStore();
  const a = jobAnalysis;
  if (!a) return null;

  return (
    <div className="space-y-4">
      {/* 기업 개요 카드 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <Building2 size={24} className="text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{a.company || '기업명 미확인'}</h2>
                <p className="text-sm text-gray-500">{a.position || '직무 미확인'}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {a.deadline && (
              <span className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded-lg">
                <Clock size={14} /> {a.deadline}
              </span>
            )}
            {a.workConditions?.location && (
              <span className="flex items-center gap-1 px-3 py-1 bg-gray-50 rounded-lg">
                <MapPin size={14} /> {a.workConditions.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 그리드: 업무 + 요건 + 스킬 + 제출형식 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 주요 업무 */}
        <InfoCard icon={Briefcase} title="주요 업무" color="blue">
          <ul className="space-y-1.5">
            {(a.tasks || []).map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </InfoCard>

        {/* 자격 요건 */}
        <InfoCard icon={Shield} title="자격 요건" color="amber">
          {a.requirements?.essential?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-red-500 mb-1.5">필수</p>
              <ul className="space-y-1">
                {a.requirements.essential.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1 text-red-400">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.requirements?.preferred?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-500 mb-1.5">우대</p>
              <ul className="space-y-1">
                {a.requirements.preferred.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1 text-blue-400">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </InfoCard>

        {/* 요구 스킬 */}
        <InfoCard icon={Zap} title="요구 스킬/역량" color="purple">
          <div className="flex flex-wrap gap-2">
            {(a.skills || []).map((s, i) => (
              <span key={i} className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs rounded-lg font-medium">
                {s}
              </span>
            ))}
          </div>
        </InfoCard>

        {/* 제출 형식 */}
        <InfoCard icon={FileText} title="제출 서류 / 형식" color="green">
          {a.applicationFormat?.documents?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-gray-500 mb-1">제출 서류</p>
              <div className="flex gap-2">
                {a.applicationFormat.documents.map((d, i) => (
                  <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded">{d}</span>
                ))}
              </div>
            </div>
          )}
          {a.applicationFormat?.questions?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-gray-500 mb-1">자소서 문항</p>
              {a.applicationFormat.questions.map((q, i) => (
                <p key={i} className="text-sm text-gray-700 mb-1">
                  {i + 1}. {q.question}
                  {q.maxLength && <span className="text-xs text-orange-500 ml-1">({q.maxLength}자)</span>}
                </p>
              ))}
            </div>
          )}
          {(a.applicationFormat?.fileConstraints?.maxSize || a.applicationFormat?.fileConstraints?.format) && (
            <div className="mt-2 text-xs text-gray-500">
              {a.applicationFormat.fileConstraints.format && `형식: ${a.applicationFormat.fileConstraints.format}`}
              {a.applicationFormat.fileConstraints.maxSize && ` | 용량: ${a.applicationFormat.fileConstraints.maxSize}`}
            </div>
          )}
        </InfoCard>
      </div>

      {/* 인재상 */}
      {a.coreValues?.length > 0 && (
        <div className="bg-gradient-to-r from-primary-50 to-emerald-50 rounded-2xl p-5 border border-primary-100">
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-primary-600" />
            <h3 className="font-semibold text-primary-800">인재상 / 핵심가치</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.coreValues.map((v, i) => (
              <span key={i} className="px-3 py-1.5 bg-white/70 text-primary-700 rounded-lg text-sm font-medium shadow-sm">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 다음 단계 */}
      <button
        onClick={matchExperiences}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" /> 내 경험과 매칭 분석 중...</>
        ) : (
          <><Target size={16} /> 내 경험과 매칭 분석하기</>
        )}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════
   3단계: 매칭 결과
   ═══════════════════════════════════════ */
function MatchedStep() {
  const { jobAnalysis, matchResult, loading, generateCoverLetter, generatePortfolio } = useJobStore();
  const m = matchResult;
  if (!m) return null;

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* 적합도 스코어 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <p className="text-sm text-gray-500 mb-2">기업 적합도</p>
        <div className="relative inline-flex items-center justify-center w-32 h-32">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none"
              stroke={m.overallFitScore >= 70 ? '#16a34a' : m.overallFitScore >= 40 ? '#f59e0b' : '#ef4444'}
              strokeWidth="8" strokeDasharray={`${2.64 * (m.overallFitScore || 0)} 264`} strokeLinecap="round" />
          </svg>
          <span className="absolute text-3xl font-bold text-gray-900">{m.overallFitScore || 0}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">100점 만점</p>
      </div>

      {/* 강점/약점 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
          <h3 className="flex items-center gap-2 font-semibold text-green-800 mb-3">
            <TrendingUp size={16} /> 강점
          </h3>
          <ul className="space-y-1.5">
            {(m.strengths || []).map((s, i) => (
              <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" /> {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
          <h3 className="flex items-center gap-2 font-semibold text-amber-800 mb-3">
            <AlertTriangle size={16} /> 보완 필요
          </h3>
          <ul className="space-y-1.5">
            {(m.weaknesses || []).map((w, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 요건별 매칭 상세 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
        >
          <h3 className="font-semibold text-gray-900">요건별 매칭 상세</h3>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {expanded && (
          <div className="px-5 pb-5 space-y-3">
            {(m.matchResults || []).map((mr, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      mr.type === 'essential' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {mr.type === 'essential' ? '필수' : '우대'}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{mr.requirement}</span>
                  </div>
                  <ScoreBadge score={mr.coverageScore} />
                </div>
                {mr.matchedExperiences?.length > 0 ? (
                  <div className="space-y-1.5 mt-2">
                    {mr.matchedExperiences.map((me, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                        <RelevanceDot level={me.relevance} />
                        <span className="font-medium">{me.title}</span>
                        <span className="text-gray-400">- {me.reason}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">매칭되는 경험 없음</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 강조 포인트 & 보완 전략 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-primary-50 rounded-2xl p-5 border border-primary-100">
          <h3 className="flex items-center gap-2 font-semibold text-primary-800 mb-3">
            <Sparkles size={16} /> 강조 포인트
          </h3>
          <ul className="space-y-1.5">
            {(m.emphasisPoints || []).map((p, i) => (
              <li key={i} className="text-sm text-primary-700">{i + 1}. {p}</li>
            ))}
          </ul>
        </div>
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
          <h3 className="flex items-center gap-2 font-semibold text-slate-800 mb-3">
            <Shield size={16} /> 보완 전략
          </h3>
          <ul className="space-y-1.5">
            {(m.improvementStrategy || []).map((s, i) => (
              <li key={i} className="text-sm text-slate-700">{i + 1}. {s}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 생성 버튼 */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={generateCoverLetter}
          disabled={loading}
          className="flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          맞춤 자소서 생성
        </button>
        <button
          onClick={async () => { await generatePortfolio(); }}
          disabled={loading}
          className="flex items-center justify-center gap-2 py-4 bg-white text-primary-600 border-2 border-primary-200 rounded-xl font-medium hover:bg-primary-50 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Briefcase size={16} />}
          포트폴리오 제안
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   4단계: 생성 결과
   ═══════════════════════════════════════ */
function ResultStep() {
  const { jobAnalysis, coverLetter, portfolioSuggestion, saveResult, generatePortfolio, loading } = useJobStore();
  const [tab, setTab] = useState('coverletter');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(null);

  const handleSave = async () => {
    const id = await saveResult();
    if (id) setSaved(true);
  };

  const copyText = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* 탭 */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('coverletter')}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors
              ${tab === 'coverletter' ? 'text-primary-700 border-b-2 border-primary-500 bg-primary-50/30' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FileText size={14} className="inline mr-1.5" /> 맞춤 자소서
          </button>
          <button
            onClick={() => { setTab('portfolio'); if (!portfolioSuggestion) generatePortfolio(); }}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors
              ${tab === 'portfolio' ? 'text-primary-700 border-b-2 border-primary-500 bg-primary-50/30' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Briefcase size={14} className="inline mr-1.5" /> 포트폴리오 제안
          </button>
        </div>

        <div className="p-6">
          {tab === 'coverletter' && coverLetter && (
            <div className="space-y-5">
              {(coverLetter.answers || []).map((ans, i) => (
                <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">문항 {i + 1}: {ans.question}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ans.wordCount}자 / {ans.maxWordCount || '제한없음'}자
                        {ans.highlightedValues?.length > 0 && (
                          <span className="ml-2 text-primary-600">
                            반영 가치: {ans.highlightedValues.join(', ')}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => copyText(ans.answer, i)}
                      className="flex items-center gap-1 px-3 py-1 text-xs text-gray-500 hover:text-primary-600 bg-white rounded-lg border border-gray-200"
                    >
                      {copied === i ? <><CheckCircle2 size={12} /> 복사됨</> : <><Copy size={12} /> 복사</>}
                    </button>
                  </div>
                  <div className="px-4 py-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ans.answer}</p>
                    {ans.usedExperiences?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {ans.usedExperiences.map((e, j) => (
                          <span key={j} className="text-[10px] px-2 py-0.5 bg-primary-50 text-primary-600 rounded">
                            📌 {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {coverLetter.tips?.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <p className="text-xs font-medium text-amber-700 mb-2">💡 작성 팁</p>
                  <ul className="space-y-1">
                    {coverLetter.tips.map((t, i) => (
                      <li key={i} className="text-sm text-amber-800">{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tab === 'portfolio' && (
            portfolioSuggestion ? (
              <div className="space-y-5">
                {portfolioSuggestion.headline && (
                  <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
                    <p className="text-xs text-primary-600 mb-1">추천 헤드라인</p>
                    <p className="text-lg font-bold text-primary-800">{portfolioSuggestion.headline}</p>
                  </div>
                )}

                {portfolioSuggestion.skillsToHighlight?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">강조할 스킬</h4>
                    <div className="flex flex-wrap gap-2">
                      {portfolioSuggestion.skillsToHighlight.map((s, i) => (
                        <span key={i} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {portfolioSuggestion.recommendedExperiences?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">추천 경험 배치</h4>
                    <div className="space-y-2">
                      {portfolioSuggestion.recommendedExperiences.map((re, i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                          <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {re.priority}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{re.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{re.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {portfolioSuggestion.sections?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">섹션별 제안</h4>
                    <div className="space-y-2">
                      {portfolioSuggestion.sections.map((sec, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              sec.action === '강조' ? 'bg-green-100 text-green-600' :
                              sec.action === '수정' ? 'bg-amber-100 text-amber-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>{sec.action}</span>
                            <span className="text-sm font-medium text-gray-800">{sec.section}</span>
                          </div>
                          <p className="text-sm text-gray-600">{sec.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {portfolioSuggestion.overallAdvice && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-xs font-medium text-slate-600 mb-1">📋 종합 조언</p>
                    <p className="text-sm text-slate-800">{portfolioSuggestion.overallAdvice}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-primary-400" />
                <span className="ml-2 text-sm text-gray-500">포트폴리오 제안 생성 중...</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* 조치 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saved}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:bg-gray-300 transition-colors"
        >
          {saved ? <><CheckCircle2 size={16} /> 저장 완료</> : <><Save size={16} /> 결과 저장</>}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   이전 기록 목록
   ═══════════════════════════════════════ */
function SavedList({ items }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Clock size={16} /> 이전 분석 기록
      </h3>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <Building2 size={16} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-800">{item.company || '알 수 없음'}</p>
                <p className="text-xs text-gray-500">{item.position}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {item.overallFitScore != null && (
                <ScoreBadge score={item.overallFitScore} />
              )}
              <span className="text-xs text-gray-400">
                {item.createdAt?.toDate
                  ? item.createdAt.toDate().toLocaleDateString('ko-KR')
                  : new Date(item.createdAt?._seconds * 1000).toLocaleDateString('ko-KR')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   유틸 컴포넌트
   ═══════════════════════════════════════ */
function InfoCard({ icon: Icon, title, color, children }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
    green: 'bg-green-50 border-green-100 text-green-700',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[color]?.split(' ')[0]} border ${colorMap[color]?.split(' ')[1]}`}>
          <Icon size={14} className={colorMap[color]?.split(' ')[2]} />
        </div>
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 70 ? 'bg-green-100 text-green-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}%</span>;
}

function RelevanceDot({ level }) {
  const map = { '높음': 'bg-green-400', '보통': 'bg-amber-400', '낮음': 'bg-red-400' };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${map[level] || 'bg-gray-300'}`} />;
}
