import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Github,
  X, CheckCircle2, Calendar,
  ChevronRight, ChevronLeft, Link2, Plus, Code2,
  Loader2, Check, FolderOpen, Palette, Monitor,
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import { importFileUpload, importFromUrl } from '../../services/importAI';
import toast from 'react-hot-toast';

const ACCEPT_FILES = '.pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,.hwp,.hwpx';

/* description 텍스트에서 CARL 섹션 파싱 */
function parseCarlDescription(desc) {
  if (!desc) return null;
  const regex = /Context\s*[:：]\s*([\s\S]*?)(?=Action\s*[:：]|Result\s*[:：]|Learning\s*[:：]|\(미확인|$)|Action\s*[:：]\s*([\s\S]*?)(?=Result\s*[:：]|Learning\s*[:：]|\(미확인|$)|Result\s*[:：]\s*([\s\S]*?)(?=Learning\s*[:：]|\(미확인|$)|Learning\s*[:：]\s*([\s\S]*?)(?=\(미확인|$)|\(미확인\s*[:：]?\s*([\s\S]*?)\)\s*$/g;
  const sections = [];
  let match;
  while ((match = regex.exec(desc)) !== null) {
    if      (match[1] !== undefined) sections.push({ key: 'context',  text: match[1].trim() });
    else if (match[2] !== undefined) sections.push({ key: 'action',   text: match[2].trim() });
    else if (match[3] !== undefined) sections.push({ key: 'result',   text: match[3].trim() });
    else if (match[4] !== undefined) sections.push({ key: 'learning', text: match[4].trim() });
    else if (match[5] !== undefined) sections.push({ key: 'missing',  text: match[5].trim() });
  }
  return sections.length === 0 ? null : sections;
}

/* 미확인 질문에서 이유 분리 */
function splitMissingQuestion(text) {
  // "질문 내용. 이유" or "질문 내용? 이유" 형태로 분리
  const dotIdx = text.search(/[.?]\s+[가-힣]/);
  if (dotIdx !== -1) {
    return {
      question: text.slice(0, dotIdx + 1).trim(),
      reason: text.slice(dotIdx + 1).trim(),
    };
  }
  return { question: text, reason: '' };
}

/* 미확인 질문 → 작성 추천 힌트 */
function getMissingSuggestions(q) {
  if (/수치|성과|%|배|개선|향상|단축|절감/.test(q))
    return ['API 응답 속도 40% 향상', '에러율 0.3% → 0.01%로 감소', '처리 시간 3일 → 반나절로 단축'];
  if (/한계|문제|원인|이유|왜/.test(q))
    return ['메모리 한계로 배치 처리 불가', '기존 방식의 확장 불가 구조', '응답 지연으로 UX 심각하게 저하'];
  if (/동기|배경|계기|시작/.test(q))
    return ['팀 내 반복 업무 자동화 필요성', '기존 솔루션 비용 대비 효율이 낮아서', '사용자 이탈률 지속 증가로 인한 대응'];
  if (/기간|일정|시간|기한|언제/.test(q))
    return ['2주 스프린트 내 완료', '운영 3개월 후 성과 측정', '출시 후 1개월 내 목표 달성'];
  if (/역할|담당|기여|비중|몇 %/.test(q))
    return ['백엔드 API 설계 및 구현 전담', '팀 내 유일한 프론트엔드 담당자', '데이터 파이프라인 70% 기여'];
  if (/리소스|절감|비용|시간/.test(q))
    return ['약 40시간/월 반복 작업 제거', '외주 비용 300만원 절감', '배포 주기 2주 → 3일로 단축'];
  if (/방어|성공률|유지|지켰|막았/.test(q))
    return ['예산 삭감 없이 일정 방어 성공', '장애 발생률 80% 이상 감소', '추가 인원 없이 마감 준수'];
  return ['약 40% 수준으로 개선됐어요', '정확한 수치 없이 체감상 절반 이상', '팀 기준으로 가장 높은 수치였어요'];
}

/* 질문이 수치형인지 감지 */
function isNumericQuestion(q) {
  return /수치|성과|%|배|개선|향상|단축|절감|방어|성공률|절약|비용|속도|건수|회|명|ms|TPS|RPS|율|량/.test(q);
}

/* 질문 유형별 단위 옵션 */
function getUnitOptions(q) {
  if (/시간|ms|속도|초|분|latency|지연/.test(q)) return ['ms', '초', '분', '시간', '%'];
  if (/비용|원|만원|budget/.test(q)) return ['만원', '억원', '%'];
  if (/건수|회|명|사용자|DAU/.test(q)) return ['건', '회', '명', '%'];
  return ['%', '배', 'ms', '건', '만원'];
}

/* 미확인 섹션 — 수치형 가이드 플로우 */
function MissingSection({ sectionText, description, onUpdateMissing }) {
  const { question, reason } = splitMissingQuestion(sectionText);
  const suggestions = getMissingSuggestions(sectionText);
  const unitOptions = getUnitOptions(question);

  const [mode, setMode] = useState('intro'); // 항상 intro(선택 화면)로 시작
  const [draft, setDraft] = useState('');
  const [beforeVal, setBeforeVal] = useState('');
  const [afterVal, setAfterVal] = useState('');
  const [unit, setUnit] = useState(unitOptions[0] || '%');

  const buildPreview = () => {
    if (beforeVal && afterVal) return `${beforeVal}${unit} → ${afterVal}${unit}`;
    if (afterVal) return `${afterVal}${unit} 달성`;
    return '';
  };

  const handleApply = (text) => {
    const content = text || draft;
    if (!content.trim()) return;
    const cleaned = description.replace(/\s*\(미확인[\s\S]*?\)\s*$/g, '').trim();
    onUpdateMissing?.(`${cleaned}\n추가 정보: ${content.trim()}`);
    setDraft('');
    setBeforeVal('');
    setAfterVal('');
  };

  return (
    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3 space-y-2">
      <p className="text-[12.5px] text-blue-800 leading-relaxed font-medium">{question}</p>
      {reason && <p className="text-[11px] text-blue-500 leading-relaxed">{reason}</p>}

      {mode === 'intro' && (
        <div className="space-y-2">
          <p className="text-[11px] text-blue-600">정확한 수치가 기억 안 나도 괜찮아요, 대략적으로만 채워도 충분해요</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('guided')}
              className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-[12px] font-medium hover:bg-blue-600 transition-colors">
              수치로 간단히 채우기
            </button>
            <button type="button" onClick={() => setMode('free')}
              className="px-3 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 text-[12px] hover:bg-blue-50 transition-colors">
              직접 쓰기
            </button>
          </div>
        </div>
      )}

      {mode === 'guided' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1">
            {suggestions.map((sg, si) => (
              <button key={si} type="button"
                onClick={() => { setDraft(sg); setMode('free'); }}
                className="px-2 py-0.5 rounded-md bg-white border border-blue-200 text-[10.5px] text-blue-700 hover:bg-blue-50 transition-colors">
                {sg}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-blue-100 px-3 py-2.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-gray-400 w-16 shrink-0">이전 (선택)</span>
              <input value={beforeVal} onChange={e => setBeforeVal(e.target.value)}
                placeholder="ex. 800"
                className="flex-1 text-[12px] text-gray-600 border-b border-gray-200 px-1 py-0.5 focus:outline-none focus:border-blue-300 bg-transparent" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-blue-600 w-16 shrink-0 font-medium">이후 *</span>
              <input value={afterVal} onChange={e => setAfterVal(e.target.value)}
                placeholder="ex. 480"
                className="flex-1 text-[12px] text-blue-700 border-b border-blue-300 px-1 py-0.5 focus:outline-none focus:border-blue-500 bg-transparent" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] text-gray-400 w-16 shrink-0">단위</span>
              <div className="flex gap-1 flex-wrap">
                {unitOptions.map(u => (
                  <button key={u} type="button" onClick={() => setUnit(u)}
                    className={`px-2 py-0.5 rounded-full text-[10.5px] border transition-colors ${
                      unit === u
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'border-gray-200 text-gray-500 hover:border-blue-200'
                    }`}>{u}</button>
                ))}
              </div>
            </div>
          </div>
          {afterVal && (
            <p className="text-[11.5px] text-blue-700 bg-white rounded-lg px-2.5 py-1.5 border border-blue-100">
              ✦ {buildPreview()}
            </p>
          )}
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setMode('free')}
              className="text-[10.5px] text-blue-500 hover:underline">
              직접 입력으로 전환
            </button>
            <button type="button"
              onClick={() => handleApply(buildPreview())}
              disabled={!afterVal.trim()}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              추가
            </button>
          </div>
        </div>
      )}

      {mode === 'free' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {suggestions.map((sg, si) => (
              <button key={si} type="button"
                onClick={() => setDraft(sg)}
                className="px-2 py-0.5 rounded-md bg-white border border-blue-200 text-[10.5px] text-blue-700 hover:bg-blue-50 transition-colors">
                {sg}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={2}
              placeholder="기억나는 내용을 자유롭게 입력해주세요 (선택)"
              className="flex-1 text-[12px] text-gray-700 bg-white border border-blue-100 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-blue-300 leading-relaxed"
            />
            <button type="button"
              onClick={() => handleApply(draft)}
              disabled={!draft.trim()}
              className="self-end px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              추가
            </button>
          </div>
          <button type="button" onClick={() => setMode('guided')}
            className="text-[10.5px] text-blue-500 hover:underline">
            수치 입력으로 전환
          </button>
        </div>
      )}
    </div>
  );
}

/* 자동 높이 textarea */
function AutoSizeTextarea({ value, onChange, className, placeholder }) {
  const taRef = useRef(null);
  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = taRef.current.scrollHeight + 'px';
    }
  }, [value]);
  return (
    <textarea
      ref={taRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={1}
      className={className}
      placeholder={placeholder}
    />
  );
}

/* 인라인 CARL 편집 — 보기 스타일 그대로, 텍스트만 편집 가능 */
function InlineCarlEdit({ description, onChange }) {
  const sections = parseCarlDescription(description);

  if (!sections) {
    return (
      <AutoSizeTextarea
        value={description || ''}
        onChange={onChange}
        className="w-full bg-transparent text-[12.5px] text-bluewood-600 leading-relaxed outline-none resize-none border-b border-transparent focus:border-surface-200 transition-colors"
        placeholder="내용을 입력하세요"
      />
    );
  }

  const mainSections = sections.filter(s => s.key !== 'missing');
  const sectionMap = Object.fromEntries(mainSections.map(s => [s.key, s.text]));

  const updateSection = (key, newText) => {
    const updated = { ...sectionMap, [key]: newText };
    const parts = [];
    if (updated.context)  parts.push(`Context: ${updated.context}`);
    if (updated.action)   parts.push(`Action: ${updated.action}`);
    if (updated.result)   parts.push(`Result: ${updated.result}`);
    if (updated.learning) parts.push(`Learning: ${updated.learning}`);
    onChange(parts.join('\n'));
  };

  const styleMap = {
    context:  'text-bluewood-500',
    action:   'text-bluewood-700',
    result:   'text-bluewood-700 font-medium',
    learning: 'text-bluewood-600 italic',
  };

  return (
    <div className="mt-1 space-y-1.5">
      {mainSections.map((s, i) => (
        <div key={s.key} className="relative flex">
          {i > 0 && <span className="flex-shrink-0 text-bluewood-200 mr-1.5 text-[12.5px] leading-relaxed pt-[1px] select-none">&bull;</span>}
          <AutoSizeTextarea
            value={s.text}
            onChange={v => updateSection(s.key, v)}
            className={`flex-1 bg-transparent outline-none resize-none leading-relaxed text-[12.5px] border-b border-transparent focus:border-surface-200 transition-colors ${styleMap[s.key] || 'text-bluewood-600'}`}
            placeholder={s.key === 'context' ? '배경을 입력하세요' : s.key === 'action' ? '행동을 입력하세요' : s.key === 'result' ? '결과를 입력하세요' : '배운 점을 입력하세요'}
          />
        </div>
      ))}
    </div>
  );
}

/* 키워드 인라인 추가 입력 */
function InlineKeywordInput({ onAdd }) {
  const [val, setVal] = useState('');
  return (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const kw = val.trim().replace(/,$/, '');
          if (kw) { onAdd(kw); setVal(''); }
        }
      }}
      className="mt-1.5 text-[11.5px] text-bluewood-500 bg-transparent border-b border-surface-200 outline-none w-full placeholder:text-surface-300 transition-colors focus:border-bluewood-200"
      placeholder="키워드 추가 (Enter로 확인)"
    />
  );
}

/* CARL 구조화 렌더러 — 라벨 없이 자연스러운 흐름으로 표시 */
function CarlDescription({ description, onUpdateMissing }) {
  const sections = parseCarlDescription(description);
  if (!sections) {
    return <p className="text-[12.5px] text-bluewood-600 leading-relaxed">{description}</p>;
  }

  const mainSections = sections.filter(s => s.key !== 'missing');
  const missingSections = sections.filter(s => s.key === 'missing');

  return (
    <div className="mt-1 space-y-1.5">
      {mainSections.map((s, i) => (
        <p key={i} className={`text-[12.5px] leading-relaxed ${
          s.key === 'context'  ? 'text-bluewood-500' :
          s.key === 'action'   ? 'text-bluewood-700' :
          s.key === 'result'   ? 'text-bluewood-700 font-medium' :
          s.key === 'learning' ? 'text-bluewood-600 italic' :
          'text-bluewood-600'
        }`}>
          {i > 0 && <span className="text-bluewood-200 mr-1.5">•</span>}
          {s.text}
        </p>
      ))}

      {missingSections.map((s, i) => (
        <MissingSection
          key={i}
          sectionText={s.text}
          description={description}
          onUpdateMissing={onUpdateMissing}
        />
      ))}
    </div>
  );
}

/* ── 심화 질문 생성기 — 경험 내용을 분석해 최대 3가지 맞춤 질문 생성 ── */
function getDeepQuestions(m) {
  if (!m) return [];
  const desc = m.description || '';
  const qs = [];

  // 수치 없으면: 정량 성과 유도
  const hasMetric = /\d+\s*%|\d+\s*배|\d+\s*건|\d+\s*ms|\d+\s*초|\d+\s*만원|\d+\s*명/.test(desc);
  if (!hasMetric) {
    qs.push({
      id: 'metric', label: '수치로 표현하기',
      q: '이 결과를 숫자로 표현할 수 있나요?',
      hint: '예: API 응답 40% 개선 / 에러율 0.3%→0.01% / 작업 시간 3일→반나절',
      type: 'numeric',
      chips: ['응답속도 XX% 개선', '에러율 XX% 감소', '처리시간 X배 단축', '비용 XX만원 절감', '누적 사용자 X명 달성'],
    });
  }

  // 어려움/도전 없으면
  if (!/어려|한계|문제|난관|실패|이슈|버그|지연|병목/.test(desc)) {
    qs.push({
      id: 'challenge', label: '핵심 도전 과제',
      q: '가장 어려웠던 기술적/실무적 문제는 무엇이었나요?',
      hint: '막혔던 순간이나 예상치 못한 이슈를 구체적으로 서술할수록 강한 경험이 됩니다',
      type: 'chips',
      chips: ['성능 병목 / 메모리 한계', '레거시 코드 호환 이슈', '데이터 정확도 확보 어려움', '팀 의견 충돌 조율', '일정 내 완료 압박', '요구사항 잦은 변경'],
    });
  }

  // 의사결정 근거 없으면
  if (!/선택|결정|비교|대안|왜|이유/.test(desc)) {
    qs.push({
      id: 'decision', label: '선택의 근거',
      q: '이 방식/기술을 선택한 이유나 비교했던 대안이 있었나요?',
      hint: '단순 구현 사실보다 "왜 이 선택을 했는지"가 면접에서 훨씬 강한 인상을 줍니다',
      type: 'chips',
      chips: ['성능 벤치마크 비교 결과', '팀 기술 스택과 적합성', '개발 속도 우선', '비용 효율이 최선', '유지보수 용이성', '오픈소스 생태계 활발'],
    });
  }

  // 성장/배움 없으면
  if (!/배웠|성장|깨달|이후|다음|앞으로|역량/.test(desc)) {
    qs.push({
      id: 'growth', label: '성장 포인트',
      q: '이 경험에서 가장 크게 성장하거나 깨달은 점은 무엇인가요?',
      hint: '기술 역량 외에 협업, 의사결정, 커뮤니케이션 측면의 성장도 포함하세요',
      type: 'chips',
      chips: ['시스템 설계 사고력', '문제 원인 분석 역량', '빠른 의사결정 경험', '협업·커뮤니케이션', '기술 깊이 이해', '우선순위 판단력'],
    });
  }

  return qs.slice(0, 3);
}

const MOMENT_TYPE_DESC = {
  '유형1': '성공형 — 가설 수립 → 실행/검증 → 정량적 성과. 논리로 성공을 증명하는 경험.',
  '유형2': '실패/트러블슈팅형 — 실패 원인 분석 → 수습 → 교훈 도출. 문제를 직면하고 해결한 경험.',
  '유형3': '의사결정/중단형 — 비효율을 데이터로 판단 → 조기 드랍/피벗 → 리소스 절감. 출시 못 해도 가치 있음.',
  '유형4': '개선/자동화형 — 반복·비효율 발견 → 프로세스 개선·자동화 → 시간/비용 절감.',
  '유형5': '협업/기여분리형 — 팀 전체 목표에서 나의 구체적 기여 지분을 명확히 드러내는 경험.',
  '심화1': '무에서 유 창조형 — 사수 없음, 체계 없음 상황에서 기준/표준을 직접 수립하고 프로세스를 자산화한 경험.',
  '심화2': '극한 자원 부족형 — 예산·시간·인력 부족 속에서 우선순위를 도출해 ROI를 극대화한 경험.',
  '심화3': '사일로 타파형 — 부서 간 KPI 충돌을 데이터로 설득해 협업을 성사시키고 딜레이를 방어한 경험.',
  '심화4': '외부 요인 피벗형 — 요구사항 급변에 기존 산출물을 재활용하며 애자일하게 대응해 데드라인을 지킨 경험.',
  '심화5': '트래픽 제로형 — 출시 없는 사이드/토이 프로젝트에서 기술적 깊이나 가설 검증의 치밀함으로 인사이트를 얻은 경험.',
};

const FIELD_OPTIONS = [
  { value: '개발', label: '개발', icon: Code2 },
  { value: '디자인', label: '디자인', icon: Palette },
  { value: '기획', label: '기획', icon: Monitor },
];

export default function TemplateSelect() {
  const { user } = useAuthStore();
  const { createExperience, analyzeExperience, extractMoments } = useExperienceStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1); // 1: 기본정보, 2: 자료수집, 3: 로딩(추출), 4: 검토, 5: 로딩(최종)
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [field, setField] = useState('');
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [notionUrl, setNotionUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [linkInputs, setLinkInputs] = useState([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadingSteps, setLoadingSteps] = useState([]);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);
  // 핵심 경험 검토 단계용
  const [collectedText, setCollectedText] = useState('');
  const [moments, setMoments] = useState([]); // { id, title, description, keywords }
  const [editingMomentId, setEditingMomentId] = useState(null);
  const [currentMomentIdx, setCurrentMomentIdx] = useState(0);

  /* ── 새 경험 직접 추가 ── */
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newExp, setNewExp] = useState({ title: '', type: '', context: '', action: '', result: '', learning: '', keywords: [] });
  const [newExpKwInput, setNewExpKwInput] = useState('');

  /* ── 심화 Q&A ── */
  const [deepQExpanded, setDeepQExpanded] = useState(true);
  const [deepQAnswers, setDeepQAnswers] = useState({}); // `${momentId}-${qId}` → answer string
  const [deepQDraft, setDeepQDraft] = useState({});     // `${momentId}-${qId}` → draft

  const handleFileAdd = (e) => {
    const newFiles = Array.from(e.target.files || []);
    addValidFiles(newFiles);
    e.target.value = '';
  };

  const addValidFiles = useCallback((newFiles) => {
    if (files.length + newFiles.length > 10) {
      toast.error('파일은 최대 10개까지 업로드할 수 있습니다');
      return;
    }
    for (const f of newFiles) {
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`${f.name}의 크기가 25MB를 초과합니다`);
        return;
      }
    }
    setFiles(prev => [...prev, ...newFiles]);
  }, [files.length]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addValidFiles(Array.from(e.dataTransfer.files));
  };

  const getFileTypeInfo = (name) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return { label: 'PDF', color: 'bg-red-500' };
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { label: 'IMG', color: 'bg-blue-500' };
    return { label: 'HWP', color: 'bg-emerald-600' };
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addLinkInput = () => {
    setLinkInputs(prev => [...prev, '']);
  };

  const updateLink = (index, value) => {
    setLinkInputs(prev => prev.map((v, i) => i === index ? value : v));
  };

  const removeLink = (index) => {
    setLinkInputs(prev => prev.filter((_, i) => i !== index));
  };

  const hasInput = files.length > 0 || textInput.trim() || notionUrl.trim() || githubUrl.trim() || blogUrl.trim() || linkInputs.some(l => l.trim());
  const canNext1 = title.trim() && startDate;

  const updateLoadingStep = (stepIdx, status) => {
    setLoadingSteps(prev => prev.map((s, i) => i === stepIdx ? { ...s, status } : s));
    setCurrentLoadingStep(stepIdx);
  };

  const handleSubmit = async () => {
    if (!hasInput) {
      toast.error('파일이나 텍스트, 링크를 하나 이상 입력해주세요');
      return;
    }

    setStep(3);

    // 로딩 단계 초기화 (자료 수집 단계)
    const steps = [];
    if (files.length > 0) steps.push({ label: `${files.length}개 파일 분석`, status: 'pending' });
    if (textInput.trim()) steps.push({ label: '텍스트 데이터 처리', status: 'pending' });
    if (notionUrl.trim()) steps.push({ label: 'Notion 페이지 가져오기', status: 'pending' });
    if (githubUrl.trim()) steps.push({ label: 'GitHub 리포지토리 분석', status: 'pending' });
    if (blogUrl.trim() || linkInputs.some(l => l.trim())) steps.push({ label: '링크 콘텐츠 수집', status: 'pending' });
    steps.push({ label: '핵심 경험 추출 중', status: 'pending' });
    setLoadingSteps(steps);

    try {
      let allText = '';
      let stepIdx = 0;

      // 1) 파일 업로드
      if (files.length > 0) {
        updateLoadingStep(stepIdx, 'loading');
        for (const file of files) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('targetType', 'experience');
            const data = await importFileUpload(formData);
            if (data.imported?.content) {
              allText += `\n\n--- ${file.name} ---\n${data.imported.content}`;
            }
          } catch (err) {
            console.error(`${file.name} 임포트 실패:`, err);
            toast.error(`${file.name} 처리 실패`);
          }
        }
        updateLoadingStep(stepIdx, 'done');
        stepIdx++;
      }

      // 2) 텍스트
      if (textInput.trim()) {
        updateLoadingStep(stepIdx, 'loading');
        allText += `\n\n--- 직접 입력 ---\n${textInput}`;
        updateLoadingStep(stepIdx, 'done');
        stepIdx++;
      }

      // 3) Notion
      if (notionUrl.trim()) {
        updateLoadingStep(stepIdx, 'loading');
        try {
          const data = await importFromUrl('notion', notionUrl, 'experience');
          if (data.imported?.content) {
            allText += `\n\n--- Notion ---\n${data.imported.content}`;
          }
        } catch (err) {
          toast.error('Notion 페이지 불러오기 실패');
        }
        updateLoadingStep(stepIdx, 'done');
        stepIdx++;
      }

      // 4) GitHub
      if (githubUrl.trim()) {
        updateLoadingStep(stepIdx, 'loading');
        try {
          const data = await importFromUrl('github', githubUrl, 'experience');
          if (data.imported?.content) {
            allText += `\n\n--- GitHub ---\n${data.imported.content}`;
          }
        } catch (err) {
          toast.error('GitHub 리포지토리 불러오기 실패');
        }
        updateLoadingStep(stepIdx, 'done');
        stepIdx++;
      }

      // 5) 블로그/추가 링크
      if (blogUrl.trim() || linkInputs.some(l => l.trim())) {
        updateLoadingStep(stepIdx, 'loading');
        const urls = [blogUrl, ...linkInputs].filter(u => u.trim());
        for (const url of urls) {
          try {
            const source = /github\.com/i.test(url) ? 'github' : /notion\.so/i.test(url) ? 'notion' : 'blog';
            const data = await importFromUrl(source, url, 'experience');
            if (data.imported?.content) {
              allText += `\n\n--- 블로그/링크: ${url} ---\n${data.imported.content}`;
            } else {
              allText += `\n\n--- 링크: ${url} ---\n(내용 추출 실패)`;
            }
          } catch {
            allText += `\n\n--- 링크: ${url} ---\n(링크 참조)`;
          }
        }
        updateLoadingStep(stepIdx, 'done');
        stepIdx++;
      }

      if (!allText.trim()) {
        toast.error('분석할 내용이 없습니다');
        setStep(2);
        return;
      }

      // 6) 핵심 경험 추출 (최대 2회 재시도)
      updateLoadingStep(stepIdx, 'loading');
      let extractResult;
      let extractError;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          extractResult = await extractMoments(allText.trim(), title.trim());
          extractError = null;
          break;
        } catch (err) {
          extractError = err;
          if (attempt === 0) {
            console.warn('핵심 경험 추출 1차 실패, 5초 후 재시도:', err.message);
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      }
      if (extractError) throw extractError;
      updateLoadingStep(stepIdx, 'done');

      setCollectedText(allText.trim());
      setMoments(extractResult.moments || []);
      setStep(4); // 검토 단계로 이동

    } catch (error) {
      console.error('자료 수집 실패:', error);
      const isAiError = error?.response?.status >= 500 || error?.response?.status === 429;
      toast.error(isAiError
        ? 'AI 서버가 일시적으로 바쁩니다. 잠시 후 다시 시도해주세요.'
        : '자료 수집에 실패했습니다. 다시 시도해주세요.');
      setStep(2);
    }
  };

  // 검토 단계 편집
  const updateMoment = (id, field, value) => {
    setMoments(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };
  const deleteMoment = (id) => {
    setMoments(prev => prev.filter(m => m.id !== id));
  };

  /* ── 새 경험 직접 추가 ── */
  const handleAddNewExp = () => {
    if (!newExp.title.trim() || !newExp.action.trim()) {
      toast.error('제목과 행동(Action) 내용은 필수입니다');
      return;
    }
    const parts = [];
    if (newExp.context.trim())  parts.push(`Context: ${newExp.context.trim()}`);
    if (newExp.action.trim())   parts.push(`Action: ${newExp.action.trim()}`);
    if (newExp.result.trim())   parts.push(`Result: ${newExp.result.trim()}`);
    if (newExp.learning.trim()) parts.push(`Learning: ${newExp.learning.trim()}`);
    const newMoment = {
      id: `manual-${Date.now()}`,
      title: newExp.title.trim(),
      type: newExp.type || '',
      description: parts.join('\n'),
      keywords: newExp.keywords || [],
      context: newExp.context.trim(),
      action: newExp.action.trim(),
      result: newExp.result.trim(),
      learning: newExp.learning.trim(),
    };
    const newIdx = moments.length;
    setMoments(prev => [...prev, newMoment]);
    setCurrentMomentIdx(newIdx);
    setIsCreatingNew(false);
    setNewExp({ title: '', type: '', context: '', action: '', result: '', learning: '', keywords: [] });
    setNewExpKwInput('');
    setDeepQExpanded(true);
    toast.success('새 경험이 추가됐습니다');
  };

  /* ── 심화 Q&A 적용 ── */
  const handleApplyDeepQ = (momentId, qId, answer) => {
    if (!answer.trim()) return;
    const labelMap = {
      metric:    '추가 성과',
      challenge: '핵심 도전',
      decision:  '선택 근거',
      growth:    '성장 포인트',
    };
    const prefix = labelMap[qId] || '추가 내용';
    setMoments(prev => prev.map(m => {
      if (m.id !== momentId) return m;
      return { ...m, description: `${m.description || ''}\n${prefix}: ${answer.trim()}` };
    }));
    setDeepQAnswers(prev => ({ ...prev, [`${momentId}-${qId}`]: answer.trim() }));
    setDeepQDraft(prev => { const n = { ...prev }; delete n[`${momentId}-${qId}`]; return n; });
    toast.success('내용이 추가됐습니다 ✓');
  };

  // 검토 완료 후 최종 경험 생성
  const handleFinalSubmit = async () => {
    if (moments.length === 0) {
      toast.error('최소 1개 이상의 경험을 선택해주세요');
      return;
    }

    setStep(5);

    const finalSteps = [
      { label: '경험 데이터 생성', status: 'pending' },
      { label: 'AI 구조화 분석', status: 'pending' },
    ];
    setLoadingSteps(finalSteps);

    try {
      // 사용자가 description을 편집했을 수 있으므로 SAR 섹션을 다시 파싱해서 최신화
      const syncedMoments = moments.map(m => {
        const parsed = parseCarlDescription(m.description);
        const bySection = { context: m.context || m.situation || '', action: m.action || '', result: m.result || '', learning: m.learning || '' };
        if (parsed) {
          for (const s of parsed) {
            if (s.key === 'context')  bySection.context = s.text;
            else if (s.key === 'action')   bySection.action = s.text;
            else if (s.key === 'result')   bySection.result = s.text;
            else if (s.key === 'learning') bySection.learning = s.text;
          }
        }
        return { ...m, ...bySection };
      });

      // 선택된 경험을 rawInput에 포함
      const momentsText = syncedMoments.map((m, i) =>
        `[경험 ${i + 1}] ${m.title}\n${m.description}\n키워드: ${(m.keywords || []).join(', ')}`
      ).join('\n\n');
      const finalText = `${collectedText}\n\n=== AI 추출 핵심 경험 ===\n${momentsText}`;

      // 경험 생성
      updateLoadingStep(0, 'loading');
      const period = startDate ? `${startDate}${endDate ? ` ~ ${endDate}` : ''}` : '';
      const experienceId = await createExperience(user.uid, {
        title: title.trim(),
        framework: 'STRUCTURED',
        period,
        field: field || undefined,
        content: { rawInput: finalText },
        momentsCount: moments.length,
      });
      updateLoadingStep(0, 'done');

      // AI 분석 (최대 2회 재시도)
      updateLoadingStep(1, 'loading');
      let analysis;
      let analysisError;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          analysis = await analyzeExperience(experienceId, {
            momentsCount: syncedMoments.length,
            reviewedMoments: syncedMoments,
          });
          analysisError = null;
          break;
        } catch (err) {
          analysisError = err;
          if (attempt === 0) {
            console.warn('AI 분석 1차 실패, 5초 후 재시도:', err.message);
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      }
      if (analysisError) throw analysisError;
      updateLoadingStep(1, 'done');

      toast.success('경험 정리가 완료되었습니다!');
      navigate(`/app/experience/structured/${experienceId}`, {
        state: { analysis, title: title.trim(), framework: 'STRUCTURED', content: { rawInput: finalText } },
      });
    } catch (error) {
      console.error('경험 생성 실패:', error);
      const isAiError = error?.response?.status >= 500 || error?.response?.status === 429;
      toast.error(isAiError
        ? 'AI 서버가 일시적으로 바쁩니다. 잠시 후 다시 시도해주세요.'
        : '경험 생성에 실패했습니다. 다시 시도해주세요.');
      setStep(4);
    }
  };

  // ===== Step 3: 로딩 화면 =====
  if (step === 3) {
    const doneCount = loadingSteps.filter(s => s.status === 'done').length;
    const progress = loadingSteps.length > 0 ? Math.round((doneCount / loadingSteps.length) * 100) : 0;

    return (
      <div className="animate-fadeIn max-w-lg mx-auto pt-16">
        <div className="bg-white rounded-2xl border border-surface-200 p-8 shadow-sm">
          {/* 진행률 헤더 */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-50 flex items-center justify-center">
              <Loader2 size={28} className="text-primary-500 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-bluewood-900 mb-1">핵심 경험을 추출하고 있습니다</h2>
            <p className="text-sm text-bluewood-400">{progress}% 완료</p>
          </div>

          {/* 프로그레스 바 */}
          <div className="w-full h-2 bg-surface-100 rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 단계별 상태 */}
          <div className="space-y-3">
            {loadingSteps.map((s, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                s.status === 'loading' ? 'bg-primary-50 border border-primary-100' :
                s.status === 'done' ? 'bg-surface-50' : ''
              }`}>
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  {s.status === 'done' && <Check size={16} className="text-green-500" />}
                  {s.status === 'loading' && <Loader2 size={16} className="text-primary-500 animate-spin" />}
                  {s.status === 'pending' && <div className="w-2 h-2 rounded-full bg-surface-300" />}
                </div>
                <span className={`text-sm ${
                  s.status === 'loading' ? 'text-primary-700 font-medium' :
                  s.status === 'done' ? 'text-bluewood-500' : 'text-bluewood-300'
                }`}>{s.label}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-bluewood-300 text-center mt-8">
            AI가 자료를 분석하여 핵심 경험을 추출합니다.<br/>자료량에 따라 최대 5분까지 소요될 수 있어요 — 페이지를 벗어나지 말아주세요.
          </p>
        </div>
      </div>
    );
  }

  // ===== Step 5: 최종 로딩 화면 =====
  if (step === 5) {
    const doneCount = loadingSteps.filter(s => s.status === 'done').length;
    const progress = loadingSteps.length > 0 ? Math.round((doneCount / loadingSteps.length) * 100) : 0;

    return (
      <div className="animate-fadeIn max-w-lg mx-auto pt-16">
        <div className="bg-white rounded-2xl border border-surface-200 p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-50 flex items-center justify-center">
              <Loader2 size={28} className="text-primary-500 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-bluewood-900 mb-1">경험을 구조화하고 있습니다</h2>
            <p className="text-sm text-bluewood-400">{progress}% 완료</p>
          </div>
          <div className="w-full h-2 bg-surface-100 rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="space-y-3">
            {loadingSteps.map((s, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                s.status === 'loading' ? 'bg-primary-50 border border-primary-100' :
                s.status === 'done' ? 'bg-surface-50' : ''
              }`}>
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  {s.status === 'done' && <Check size={16} className="text-green-500" />}
                  {s.status === 'loading' && <Loader2 size={16} className="text-primary-500 animate-spin" />}
                  {s.status === 'pending' && <div className="w-2 h-2 rounded-full bg-surface-300" />}
                </div>
                <span className={`text-sm ${
                  s.status === 'loading' ? 'text-primary-700 font-medium' :
                  s.status === 'done' ? 'text-bluewood-500' : 'text-bluewood-300'
                }`}>{s.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-bluewood-300 text-center mt-8">
            선택한 경험을 바탕으로 7가지 섹션으로 구조화합니다.<br/>최대 5분까지 소요될 수 있어요 — 페이지를 벗어나지 말아주세요.
          </p>
        </div>
      </div>
    );
  }

  // ===== Step 4: 핵심 경험 검토 =====
  if (step === 4) {
    const safeIdx = Math.min(currentMomentIdx, Math.max(0, moments.length - 1));
    const currentM = isCreatingNew ? null : moments[safeIdx];
    const totalKeywords = [...new Set(moments.flatMap(m => m.keywords || []))].length;
    const missingCount = moments.filter(m => m?.description?.includes('(미확인')).length;
    const deepQuestions = getDeepQuestions(currentM);

    const getAiHint = (m) => {
      if (!m) return null;
      if (m.description?.includes('(미확인')) {
        return { text: '성과 수치가 비어 있어요. 아래 질문에 답하면 자동으로 보완됩니다.', level: 'warn' };
      }
      const kws = m.keywords || [];
      if (kws.length >= 2) {
        return { text: `"${kws[0]}", "${kws[1]}" 역량이 확인됩니다. 내용을 검토하고 심화 질문으로 경험을 더 풍부하게 만들어보세요.`, level: 'info' };
      }
      return { text: '내용이 정확한지 확인하고 아래 심화 질문으로 경험을 강화해보세요.', level: 'info' };
    };

    const hint = getAiHint(currentM);

    const handleDeleteAndMove = (id) => {
      deleteMoment(id);
      setCurrentMomentIdx(prev => Math.max(0, Math.min(prev, moments.length - 2)));
      setEditingMomentId(null);
    };

    return (
      <div className="animate-fadeIn max-w-[1180px] mx-auto">
        {/* 뒤로가기 */}
        <button
          onClick={() => setStep(2)}
          className="inline-flex items-center gap-1.5 text-sm text-bluewood-400 hover:text-bluewood-700 mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> 자료 수집으로 돌아가기
        </button>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { label: '기본 정보', done: true },
            { label: '자료 수집', done: true },
            { label: '경험 검토', done: false, active: true },
          ].map((s, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                s.active ? 'bg-bluewood-900 text-white' :
                s.done   ? 'text-bluewood-400' : 'text-bluewood-300'
              }`}>
                {s.done && <Check size={11} strokeWidth={2.5} />}
                {s.label}
              </div>
              {i < arr.length - 1 && <span className="text-bluewood-200 text-xs">/</span>}
            </div>
          ))}
          <span className="ml-auto text-xs text-bluewood-400 tabular-nums">
            {moments.length === 0 ? '0' : isCreatingNew ? '새 경험' : safeIdx + 1} / {moments.length}{isCreatingNew ? '+1' : ''}
          </span>
        </div>

        {/* 빈 상태 */}
        {moments.length === 0 && !isCreatingNew ? (
          <div className="bg-white rounded-xl border border-surface-200 p-12 text-center text-bluewood-300 text-sm mb-5">
            추출된 경험이 없습니다. 자료 수집 단계로 돌아가거나 아래에서 직접 경험을 추가해주세요.
          </div>
        ) : (
          /* 3컬럼 레이아웃 */
          <div className="flex gap-5 mb-6 items-start">

            {/* 사이드바 */}
            <div className="w-[196px] flex-shrink-0">
              <p className="text-[11px] font-medium text-bluewood-400 mb-2 px-0.5 uppercase tracking-wide">경험 목록</p>
              <div className="flex flex-col gap-px mb-2">
                {moments.map((m, idx) => {
                  const isMissing = m.description?.includes('(미확인');
                  const isActive = !isCreatingNew && idx === safeIdx;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setCurrentMomentIdx(idx); setEditingMomentId(null); setIsCreatingNew(false); }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-[12.5px] leading-snug transition-colors ${
                        isActive
                          ? 'bg-bluewood-900 text-white font-medium'
                          : 'text-bluewood-600 hover:bg-surface-100'
                      }`}
                    >
                      <span className={`text-[10px] font-semibold mr-1.5 ${isActive ? 'text-white/50' : 'text-bluewood-300'}`}>{idx + 1}.</span>
                      <span className="line-clamp-2">{m.title}</span>
                      {isMissing && (
                        <span className={`block mt-1 text-[10px] font-medium ${isActive ? 'text-amber-300' : 'text-amber-500'}`}>
                          성과 보완 가능
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* 새 경험 추가 버튼 */}
              <button
                onClick={() => { setIsCreatingNew(true); setEditingMomentId(null); setNewExp({ title: '', type: '', context: '', action: '', result: '', learning: '', keywords: [] }); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-[12px] border border-dashed transition-colors ${
                  isCreatingNew
                    ? 'border-bluewood-400 bg-surface-50 text-bluewood-700 font-medium'
                    : 'border-surface-300 text-bluewood-400 hover:border-bluewood-300 hover:bg-surface-50'
                }`}
              >
                + 새 경험 추가
              </button>
            </div>

            {/* 메인 컨텐츠 */}
            <div className="flex-1 min-w-0 space-y-3">

              {/* ── 새 경험 직접 작성 폼 ── */}
              {isCreatingNew && (
                <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-bluewood-900">새 경험 직접 작성</h3>
                      <span className="text-[10.5px] text-bluewood-400 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200">CARL 구조</span>
                    </div>
                    <button onClick={() => setIsCreatingNew(false)} className="text-xs text-bluewood-400 hover:text-bluewood-700 border border-surface-200 px-2.5 py-1 rounded-lg hover:bg-surface-50 transition-colors">
                      닫기
                    </button>
                  </div>

                  <div className="px-5 py-4 space-y-4">
                    {/* 제목 */}
                    <div>
                      <label className="block text-[11px] font-semibold text-bluewood-600 mb-1.5">경험 제목 <span className="text-red-400">*</span></label>
                      <input
                        value={newExp.title}
                        onChange={e => setNewExp(p => ({ ...p, title: e.target.value }))}
                        placeholder="예: 실시간 이상 감지 파이프라인 개발"
                        className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm text-bluewood-900 outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 placeholder-bluewood-300"
                      />
                    </div>

                    {/* 유형 선택 */}
                    <div>
                      <label className="block text-[11px] font-semibold text-bluewood-600 mb-1.5">경험 유형</label>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(MOMENT_TYPE_DESC).map(([key, desc]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setNewExp(p => ({ ...p, type: p.type === key ? '' : key }))}
                            title={desc}
                            className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
                              newExp.type === key
                                ? 'bg-bluewood-900 text-white border-bluewood-900'
                                : 'border-surface-200 text-bluewood-500 hover:border-bluewood-300 hover:bg-surface-50'
                            }`}
                          >{key}</button>
                        ))}
                      </div>
                    </div>

                    {/* CARL 필드 */}
                    {[
                      { key: 'context',  label: '배경 Context', placeholder: '왜 이 일을 하게 됐나요? 기존의 어떤 문제가 있었나요?', required: false, rows: 2 },
                      { key: 'action',   label: '행동 Action',  placeholder: '구체적으로 무엇을 했나요? 어떤 방식/기술로 해결했나요?', required: true,  rows: 3 },
                      { key: 'result',   label: '결과 Result',  placeholder: '결과가 어떻게 됐나요? 수치(%, ms, 건수)가 있다면 꼭 포함해주세요.', required: false, rows: 2 },
                      { key: 'learning', label: '배운 점 Learning', placeholder: '이 경험에서 무엇을 배웠고 어떻게 성장했나요?', required: false, rows: 2 },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-[11px] font-semibold text-bluewood-600 mb-1.5">
                          {f.label}
                          {f.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <textarea
                          value={newExp[f.key]}
                          onChange={e => setNewExp(p => ({ ...p, [f.key]: e.target.value }))}
                          rows={f.rows}
                          placeholder={f.placeholder}
                          className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-[12.5px] text-bluewood-700 outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 resize-none placeholder-bluewood-300 leading-relaxed"
                        />
                      </div>
                    ))}

                    {/* 키워드 */}
                    <div>
                      <label className="block text-[11px] font-semibold text-bluewood-600 mb-1.5">역량 키워드</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(newExp.keywords || []).map((kw, ki) => (
                          <span key={ki} className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-100 text-bluewood-600 text-[11.5px] rounded-md border border-surface-200">
                            {kw}
                            <button
                              onClick={() => setNewExp(p => ({ ...p, keywords: p.keywords.filter((_, j) => j !== ki) }))}
                              className="text-bluewood-300 hover:text-red-500 transition-colors ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={newExpKwInput}
                          onChange={e => setNewExpKwInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newExpKwInput.trim()) {
                              e.preventDefault();
                              setNewExp(p => ({ ...p, keywords: [...p.keywords, newExpKwInput.trim()] }));
                              setNewExpKwInput('');
                            }
                          }}
                          placeholder="키워드 입력 후 Enter"
                          className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-[11.5px] text-bluewood-700 outline-none focus:ring-2 focus:ring-primary-200"
                        />
                      </div>
                    </div>

                    {/* 제출 */}
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setIsCreatingNew(false)}
                        className="px-4 py-2 text-xs text-bluewood-500 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors"
                      >취소</button>
                      <button
                        onClick={handleAddNewExp}
                        disabled={!newExp.title.trim() || !newExp.action.trim()}
                        className="px-5 py-2 text-xs font-semibold bg-bluewood-900 text-white rounded-lg hover:bg-bluewood-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >경험 추가하기</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 기존 경험 카드 ── */}
              {currentM && (
                <>
                {/* 힌트 바 */}
                {hint && (
                  <div className={`px-4 py-3 rounded-lg border-l-2 text-[12.5px] leading-relaxed ${
                    hint.level === 'warn'
                      ? 'bg-amber-50 border-amber-400 text-amber-800'
                      : 'bg-surface-50 border-bluewood-300 text-bluewood-500'
                  }`}>
                    {hint.text}
                  </div>
                )}

                {/* 경험 카드 */}
                <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">

                  {/* 헤더 */}
                  <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-surface-100">
                    <div className="flex-1 min-w-0">
                      {currentM.type && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {currentM.type.split(',').map(t => t.trim()).filter(Boolean).map((typeKey, ti) => (
                            <span key={ti} className="relative group">
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-surface-100 text-bluewood-500 border border-surface-200 cursor-default">
                                {typeKey}
                              </span>
                              {MOMENT_TYPE_DESC[typeKey] && (
                                <span className="pointer-events-none absolute bottom-full left-0 mb-2 w-56 rounded-lg bg-bluewood-900 text-white text-[11px] leading-relaxed px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-normal">
                                  {MOMENT_TYPE_DESC[typeKey]}
                                  <span className="absolute top-full left-3 border-4 border-transparent border-t-bluewood-900" />
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      <input
                        value={currentM.title}
                        onChange={e => editingMomentId === currentM.id && updateMoment(currentM.id, 'title', e.target.value)}
                        readOnly={editingMomentId !== currentM.id}
                        className={`w-full text-[15px] font-semibold text-bluewood-900 leading-snug bg-transparent outline-none border-b border-transparent transition-colors ${editingMomentId === currentM.id ? 'focus:border-surface-300 cursor-text' : 'cursor-default pointer-events-none'}`}
                      />
                    </div>
                    {editingMomentId === currentM.id ? (
                      <button
                        onClick={() => setEditingMomentId(null)}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-bluewood-900 text-white rounded-lg hover:bg-bluewood-800 transition-colors"
                      >
                        완료
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingMomentId(currentM.id)}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium border border-surface-200 text-bluewood-500 rounded-lg hover:bg-surface-50 transition-colors"
                      >
                        수정
                      </button>
                    )}
                  </div>

                  {/* 본문 */}
                  <div className="px-5 py-4">
                    {editingMomentId === currentM.id ? (
                      <InlineCarlEdit
                        description={currentM.description}
                        onChange={(newDesc) => updateMoment(currentM.id, 'description', newDesc)}
                      />
                    ) : (
                      <CarlDescription
                        description={currentM.description}
                        onUpdateMissing={(newDesc) => updateMoment(currentM.id, 'description', newDesc)}
                      />
                    )}
                  </div>

                  {/* 키워드 */}
                  {(currentM.keywords || []).length > 0 && (
                    <div className="px-5 pb-5 pt-2 border-t border-surface-100">
                      <p className="text-[11px] text-bluewood-400 font-medium mb-2">역량 키워드</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(currentM.keywords || []).map((kw, ki) => (
                          <span key={ki} className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-100 text-bluewood-600 text-[11.5px] rounded-md border border-surface-200">
                            {kw}
                            {editingMomentId === currentM.id && (
                              <button
                                onClick={() => updateMoment(currentM.id, 'keywords', (currentM.keywords || []).filter((_, j) => j !== ki))}
                                className="text-bluewood-300 hover:text-red-400 transition-colors ml-0.5 text-[10px]"
                              >&times;</button>
                            )}
                          </span>
                        ))}
                      </div>
                      {editingMomentId === currentM.id && (
                        <InlineKeywordInput
                          onAdd={(kw) => updateMoment(currentM.id, 'keywords', [...(currentM.keywords || []), kw])}
                        />
                      )}
                    </div>
                  )}

                  {/* 하단 네비게이션 */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-t border-surface-100 bg-surface-50/50">
                    <button
                      onClick={() => handleDeleteAndMove(currentM.id)}
                      className="text-xs text-red-400 hover:text-red-600 hover:underline transition-colors"
                    >
                      이 경험 제외
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setCurrentMomentIdx(i => Math.max(0, i - 1)); setEditingMomentId(null); }}
                        disabled={safeIdx === 0}
                        className="flex items-center gap-1 px-3.5 py-2 text-xs font-medium border border-surface-200 text-bluewood-500 rounded-lg hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={13} /> 이전
                      </button>
                      {safeIdx < moments.length - 1 ? (
                        <button
                          onClick={() => { setCurrentMomentIdx(i => i + 1); setEditingMomentId(null); }}
                          className="flex items-center gap-1 px-3.5 py-2 text-xs font-medium bg-bluewood-900 text-white rounded-lg hover:bg-bluewood-800 transition-colors"
                        >
                          다음 <ChevronRight size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => document.getElementById('final-submit-btn')?.scrollIntoView({ behavior: 'smooth' })}
                          className="flex items-center gap-1 px-3.5 py-2 text-xs font-medium bg-bluewood-900 text-white rounded-lg hover:bg-bluewood-800 transition-colors"
                        >
                          검토 완료
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                </>
              )}
            </div>

            {/* ── 심화 Q&A 패널 (3번째 컬럼) ── */}
            {currentM && deepQuestions.length > 0 && (
              <div className="w-[268px] flex-shrink-0 sticky top-6">
                <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3.5 border-b border-surface-100">
                    <span className="text-[12.5px] font-semibold text-bluewood-800">내용 심화하기</span>
                    <span className="text-[10.5px] text-bluewood-500 bg-surface-100 border border-surface-200 px-1.5 py-0.5 rounded font-medium">
                      {deepQuestions.filter(dq => !deepQAnswers[`${currentM.id}-${dq.id}`]).length}개 질문
                    </span>
                  </div>
                  <div className="px-4 pb-4 space-y-5">
                    {deepQuestions.map((dq, qi) => {
                      const ansKey = `${currentM.id}-${dq.id}`;
                      const isAnswered = !!deepQAnswers[ansKey];
                      const draft = deepQDraft[ansKey] || '';

                      return (
                        <div key={dq.id} className="pt-4">
                          <div className="mb-2">
                            <p className="text-[11px] font-semibold text-bluewood-400 mb-0.5">{qi + 1}. {dq.label}</p>
                            <p className="text-[12.5px] font-semibold text-bluewood-800 leading-snug">{dq.q}</p>
                            {dq.hint && <p className="text-[10.5px] text-bluewood-400 mt-0.5 leading-relaxed">{dq.hint}</p>}
                          </div>

                          {isAnswered ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-surface-50 border border-surface-200 rounded-lg">
                              <span className="text-[11.5px] text-bluewood-600 flex-1">{deepQAnswers[ansKey]}</span>
                              <button
                                onClick={() => setDeepQAnswers(prev => { const n = { ...prev }; delete n[ansKey]; return n; })}
                                className="text-[10px] text-bluewood-400 hover:text-red-400 transition-colors flex-shrink-0"
                              >수정</button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1.5">
                                {dq.chips.map((chip, ci) => (
                                  <button
                                    key={ci}
                                    type="button"
                                    onClick={() => setDeepQDraft(prev => ({ ...prev, [ansKey]: chip }))}
                                    className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                                      draft === chip
                                        ? 'bg-bluewood-900 border-bluewood-900 text-white font-medium'
                                        : 'bg-white border-surface-200 text-bluewood-500 hover:bg-surface-50'
                                    }`}
                                  >{chip}</button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  value={draft}
                                  onChange={e => setDeepQDraft(prev => ({ ...prev, [ansKey]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) handleApplyDeepQ(currentM.id, dq.id, draft); }}
                                  placeholder="직접 입력 또는 위에서 선택 후 추가"
                                  className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-[11.5px] text-bluewood-700 outline-none focus:ring-2 focus:ring-bluewood-200 focus:border-bluewood-300 placeholder-bluewood-300"
                                />
                                <button
                                  onClick={() => handleApplyDeepQ(currentM.id, dq.id, draft)}
                                  disabled={!draft.trim()}
                                  className="px-3.5 py-2 text-[11.5px] font-semibold bg-bluewood-900 text-white rounded-lg hover:bg-bluewood-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                                >추가</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 요약 바 */}
        <div className="flex items-center gap-5 px-4 py-3 bg-surface-50 border border-surface-200 rounded-lg mb-4 text-xs text-bluewood-500">
          <span><span className="font-semibold text-bluewood-800">{moments.length}</span>개 경험</span>
          <span className="text-surface-300">|</span>
          <span><span className="font-semibold text-bluewood-800">{totalKeywords}</span>개 역량 키워드</span>
          {missingCount > 0 && (
            <>
              <span className="text-surface-300">|</span>
              <span className="text-amber-600">{missingCount}개 성과 보완 가능</span>
            </>
          )}
          <span className="ml-auto text-bluewood-300">최종 분석은 최대 5분 소요됩니다</span>
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3 pb-8">
          <button
            onClick={() => setStep(2)}
            className="flex items-center justify-center gap-1.5 px-5 py-3 border border-surface-200 text-bluewood-600 text-sm font-medium rounded-lg hover:bg-surface-50 transition-colors"
          >
            <ChevronLeft size={14} /> 이전
          </button>
          <button
            id="final-submit-btn"
            onClick={handleFinalSubmit}
            disabled={moments.length === 0}
            className="flex-1 flex items-center justify-center py-3 bg-bluewood-900 text-white text-sm font-semibold rounded-lg hover:bg-bluewood-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {moments.length}개 경험으로 포트폴리오 정리 시작
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="animate-fadeIn mx-auto max-w-5xl px-1 pb-8">
      <Link to="/app/experience" className="mb-8 inline-flex items-center gap-2 text-sm text-bluewood-400 hover:text-bluewood-600">
        <ArrowLeft size={16} /> 경험 정리로 돌아가기
      </Link>

      {/* 스텝 인디케이터 */}
      <div className="mb-12 flex items-center gap-4 px-1">
        <div className={`flex min-w-[112px] items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-all ${
          step === 1 ? 'bg-primary-500 text-white shadow-sm shadow-primary-200/70' : 'bg-white text-bluewood-400 border border-surface-200'
        }`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
            {step > 1 ? <Check size={12} /> : '1'}
          </span>
          기본 정보
        </div>
        <div className="h-px flex-1 bg-surface-300" />
        <div className={`flex min-w-[112px] items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-all ${
          step === 2 ? 'bg-primary-500 text-white shadow-sm shadow-primary-200/70' : 'bg-white text-bluewood-400 border border-surface-200'
        }`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
            {step > 2 ? <Check size={12} /> : '2'}
          </span>
          자료 수집
        </div>
        <div className="h-px flex-1 bg-surface-300" />
        <div className="flex min-w-[112px] items-center justify-center gap-2 rounded-full border border-surface-200 bg-white px-4 py-3 text-sm font-semibold text-bluewood-400">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-100 text-xs font-bold">3</span>
          경험 검토
        </div>
      </div>

      {/* ===== Step 1: 기본 정보 ===== */}
      {step === 1 && (
        <div className="space-y-8">
          <div className="border-b border-surface-200 pb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">Basic Information</p>
            <h1 className="text-[34px] font-bold tracking-[-0.03em] text-bluewood-900">프로젝트 기본 정보를 입력해주세요</h1>
            <p className="mt-3 text-sm leading-6 text-bluewood-400">
              프로젝트명과 기간, 분야를 먼저 정리하면 다음 단계에서 자료 수집과 경험 검토를 더 깔끔하게 이어갈 수 있어요.
            </p>
          </div>

          <div className="rounded-[28px] border border-surface-200 bg-white px-6 py-7 shadow-[0_24px_60px_-50px_rgba(49,65,87,0.28)] md:px-10 md:py-9">
            <div className="space-y-8">
              <div className="grid gap-3 md:grid-cols-[132px_minmax(0,1fr)] md:items-center">
                <label className="text-sm font-semibold text-bluewood-700">
                  프로젝트명 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="프로젝트 이름을 입력하세요"
                  className="w-full rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-bluewood-900 outline-none transition-all placeholder:text-bluewood-300 focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[132px_minmax(0,1fr)] md:items-start">
                <label className="pt-4 text-sm font-semibold text-bluewood-700">
                  <Calendar size={14} className="mr-1 inline" />
                  기간 <span className="text-red-400">*</span>
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-bluewood-900 outline-none transition-all focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-bluewood-900 outline-none transition-all focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[132px_minmax(0,1fr)] md:items-start">
                <label className="pt-3 text-sm font-semibold text-bluewood-700">분야</label>
                <div className="flex flex-wrap gap-3">
                {FIELD_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const selected = field === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setField(selected ? '' : opt.value)}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-medium transition-all ${
                        selected
                          ? 'border-primary-500 bg-primary-500 text-white shadow-sm shadow-primary-200/70'
                          : 'border-surface-200 bg-white text-bluewood-600 hover:border-primary-300 hover:bg-primary-50/50'
                      }`}
                    >
                      <Icon size={14} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 다음 버튼 */}
          <div className="flex justify-center pt-1">
            <button
              onClick={() => setStep(2)}
              disabled={!canNext1}
              className="inline-flex min-w-[240px] items-center justify-center gap-2 rounded-full bg-primary-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary-200/60 transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음 단계
              <ChevronRight size={18} />
            </button>
          </div>
          <p className="text-center text-xs text-bluewood-400">AI 분석 과정은 자료량에 따라 최대 5분 소요될 수 있어요</p>
        </div>
      </div>
      )}

      {/* ===== Step 2: 자료 수집 ===== */}
      {step === 2 && (
        <div className="space-y-5">

          {/* 파일 업로드 */}
          <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-bluewood-900 mb-4">관련 파일</h2>
            <input ref={fileInputRef} type="file" accept={ACCEPT_FILES} multiple onChange={handleFileAdd} className="hidden" />

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer transition-all select-none ${
                isDragging
                  ? 'border-primary-400 bg-primary-50 text-primary-500'
                  : 'border-surface-300 text-bluewood-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1 transition-colors ${isDragging ? 'bg-primary-100' : 'bg-surface-100'}`}>
                <FolderOpen size={22} className={isDragging ? 'text-primary-400' : 'text-bluewood-300'} />
              </div>
              <p className="font-medium text-sm">클릭하여 파일을 선택하세요</p>
              <p className="text-xs text-bluewood-300">PDF, 이미지 (JPG/PNG/WEBP), HWP · 최대 25MB · 최대 10개</p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, i) => {
                  const typeInfo = getFileTypeInfo(f.name);
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 border border-gray-100 rounded-xl bg-white shadow-sm">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeInfo.color}`}>
                        <span className="text-white text-[9px] font-bold tracking-wide">{typeInfo.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-bluewood-900 truncate">{f.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-bluewood-400">{(f.size / 1024).toFixed(1)} KB</span>
                          <span className="text-gray-300">·</span>
                          <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                            <CheckCircle2 size={11} />
                            준비 완료
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full w-full" />
                        </div>
                      </div>
                      <button onClick={() => removeFile(i)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                        <X size={14} className="text-bluewood-300 hover:text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 직접 입력 */}
          <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-bluewood-900 mb-4">직접 입력</h2>
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={`프로젝트나 경험에 대해 자유롭게 작성해주세요.\n\n예시:\n- 어떤 프로젝트/활동이었나요?\n- 왜 시작하게 되었나요?\n- 어떤 문제를 해결했나요?`}
              rows={5}
              className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-primary-200 text-bluewood-900 placeholder-bluewood-300 transition-all"
            />
            {textInput && (
              <p className="text-xs text-bluewood-400 text-right mt-1">{textInput.length}자</p>
            )}
          </div>

          {/* 링크 입력 */}
          <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-bluewood-900 mb-4">링크</h2>
            <div className="space-y-3">
              {/* Notion */}
              <div className="relative">
                <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bluewood-300" />
                <input
                  type="url"
                  value={notionUrl}
                  onChange={e => setNotionUrl(e.target.value)}
                  placeholder="Notion 페이지 URL"
                  className="w-full pl-10 pr-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 text-bluewood-900 placeholder-bluewood-300 transition-all"
                />
              </div>
              {/* GitHub */}
              <div className="relative">
                <Github size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bluewood-300" />
                <input
                  type="url"
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                  placeholder="GitHub 리포지토리 URL"
                  className="w-full pl-10 pr-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 text-bluewood-900 placeholder-bluewood-300 transition-all"
                />
              </div>
              {/* 블로그 */}
              <div className="relative">
                <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bluewood-300" />
                <input
                  type="url"
                  value={blogUrl}
                  onChange={e => setBlogUrl(e.target.value)}
                  placeholder="블로그 또는 기타 URL"
                  className="w-full pl-10 pr-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 text-bluewood-900 placeholder-bluewood-300 transition-all"
                />
              </div>
              {/* 추가 링크들 */}
              {linkInputs.map((link, i) => (
                <div key={i} className="relative">
                  <Link2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bluewood-300" />
                  <input
                    type="url"
                    value={link}
                    onChange={e => updateLink(i, e.target.value)}
                    placeholder="추가 링크 URL"
                    className="w-full pl-10 pr-10 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 text-bluewood-900 placeholder-bluewood-300 transition-all"
                  />
                  <button onClick={() => removeLink(i)} className="absolute right-3 top-1/2 -translate-y-1/2 text-bluewood-300 hover:text-red-500">
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={addLinkInput}
                className="flex items-center gap-1.5 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors mt-1"
              >
                <Plus size={14} /> 링크 추가
              </button>
            </div>
            <p className="text-xs text-bluewood-300 mt-3">공개된 페이지/리포지토리만 가져올 수 있습니다.</p>
          </div>

          {/* 추가된 자료 요약 */}
          {hasInput && (
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
              <p className="text-sm font-medium text-primary-700 mb-2">추가된 자료</p>
              <div className="flex flex-wrap gap-2">
                {files.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> 파일 {files.length}개
                  </span>
                )}
                {textInput.trim() && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> 텍스트 입력
                  </span>
                )}
                {notionUrl.trim() && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> Notion
                  </span>
                )}
                {githubUrl.trim() && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> GitHub
                  </span>
                )}
                {blogUrl.trim() && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> 블로그
                  </span>
                )}
                {linkInputs.filter(l => l.trim()).length > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-primary-600 rounded-lg text-xs font-medium">
                    <CheckCircle2 size={12} /> 추가 링크 {linkInputs.filter(l => l.trim()).length}개
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 처음 작업 안내 */}
          {hasInput && (
            <div className="flex items-start gap-2.5 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[11px] font-bold mt-0.5">!</div>
              <div className="flex-1 text-[12.5px] text-blue-700 leading-relaxed">
                <span className="font-semibold">자료량에 따라 최대 5분 정도 소요될 수 있어요.</span>
                <span className="block text-blue-600 mt-0.5">페이지를 벗어나지 말고 잠시만 기다려 주세요 — 완료 후 자동으로 이동합니다.</span>
              </div>
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-white border border-surface-200 text-bluewood-600 rounded-2xl text-sm font-semibold hover:bg-surface-50 transition-all"
            >
              <ChevronLeft size={16} />
              이전
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasInput}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-primary-500 text-white rounded-2xl text-base font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-200/50"
            >
              AI로 경험 정리 시작
            </button>
          </div>

          <p className="text-center text-xs text-bluewood-300 pb-4">
            AI는 입력된 자료만으로 정리하며, 새로운 내용을 만들어내지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}
