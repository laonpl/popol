import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Github,
  X, CheckCircle2, Calendar,
  ChevronRight, ChevronLeft, Link2, Plus, Code2,
  Loader2, Check, FolderOpen, Palette, Monitor
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import { importFileUpload, importFromUrl } from '../../services/importAI';
import toast from 'react-hot-toast';

const ACCEPT_FILES = '.pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,.hwp,.hwpx';

/* description 텍스트에서 STAR 섹션 파싱 */
function parseStarDescription(desc) {
  if (!desc) return null;
  const regex = /Situation\s*[:：]\s*([\s\S]*?)(?=Action\s*[:：]|Result\s*[:：]|\(미확인|$)|Action\s*[:：]\s*([\s\S]*?)(?=Result\s*[:：]|\(미확인|$)|Result\s*[:：]\s*([\s\S]*?)(?=\(미확인|$)|\(미확인\s*[:：]?\s*([\s\S]*?)\)\s*$/g;
  const sections = [];
  let match;
  while ((match = regex.exec(desc)) !== null) {
    if      (match[1] !== undefined) sections.push({ key: 'situation', text: match[1].trim() });
    else if (match[2] !== undefined) sections.push({ key: 'action',    text: match[2].trim() });
    else if (match[3] !== undefined) sections.push({ key: 'result',    text: match[3].trim() });
    else if (match[4] !== undefined) sections.push({ key: 'missing',   text: match[4].trim() });
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

/* STAR 구조화 렌더러 — STAR 라벨 없이 자연스러운 흐름으로 표시 */
function StarDescription({ description, onUpdateMissing }) {
  const sections = parseStarDescription(description);
  if (!sections) {
    return <p className="text-[12.5px] text-bluewood-600 leading-relaxed">{description}</p>;
  }

  const mainSections = sections.filter(s => s.key !== 'missing');
  const missingSections = sections.filter(s => s.key === 'missing');

  return (
    <div className="mt-1 space-y-1.5">
      {mainSections.map((s, i) => (
        <p key={i} className={`text-[12.5px] leading-relaxed ${
          s.key === 'situation' ? 'text-bluewood-500' :
          s.key === 'action'    ? 'text-bluewood-700' :
          s.key === 'result'    ? 'text-bluewood-700 font-medium' :
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
        const parsed = parseStarDescription(m.description);
        const bySection = { situation: m.situation || '', action: m.action || '', result: m.result || '' };
        if (parsed) {
          for (const s of parsed) {
            if (s.key === 'situation') bySection.situation = s.text;
            else if (s.key === 'action') bySection.action = s.text;
            else if (s.key === 'result') bySection.result = s.text;
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
    return (
      <div className="animate-fadeIn max-w-2xl mx-auto">
        <button
          onClick={() => setStep(2)}
          className="inline-flex items-center gap-2 text-sm text-bluewood-400 hover:text-bluewood-600 mb-6"
        >
          <ArrowLeft size={16} /> 자료 수집으로 돌아가기
        </button>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-surface-100 text-bluewood-400">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              <Check size={12} />
            </span>
            기본 정보
          </div>
          <div className="w-8 h-px bg-surface-300" />
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-surface-100 text-bluewood-400">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              <Check size={12} />
            </span>
            자료 수집
          </div>
          <div className="w-8 h-px bg-surface-300" />
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-primary-500 text-white shadow-sm">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">3</span>
            경험 검토
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm mb-5">
          <div className="mb-5">
            <h2 className="text-base font-bold text-bluewood-900 mb-1">AI가 추출한 핵심 경험</h2>
            <p className="text-sm text-bluewood-400">
              아래 {moments.length}개의 경험을 검토하세요. 필요 없는 항목은 삭제하고, 내용을 수정할 수 있습니다.
            </p>
          </div>

          {moments.length === 0 ? (
            <div className="text-center py-10 text-bluewood-300 text-sm">
              추출된 경험이 없습니다. 자료 수집 단계로 돌아가 내용을 추가해주세요.
            </div>
          ) : (
            <div className="space-y-3">
              {moments.map((m, idx) => (
                <div key={m.id} className="border border-surface-200 rounded-xl overflow-visible">
                  {editingMomentId === m.id ? (
                    /* 편집 모드 */
                    <div className="p-4 bg-primary-50/30 space-y-3">
                      <input
                        value={m.title}
                        onChange={e => updateMoment(m.id, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm font-semibold text-bluewood-900 outline-none focus:ring-2 focus:ring-primary-200"
                        placeholder="경험 제목"
                      />
                      <textarea
                        value={m.description}
                        onChange={e => updateMoment(m.id, 'description', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm text-bluewood-700 outline-none focus:ring-2 focus:ring-primary-200 resize-none"
                        placeholder="경험 내용"
                      />
                      <input
                        value={(m.keywords || []).join(', ')}
                        onChange={e => updateMoment(m.id, 'keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
                        className="w-full px-3 py-2 border border-surface-200 rounded-lg text-xs text-bluewood-500 outline-none focus:ring-2 focus:ring-primary-200"
                        placeholder="키워드 (쉼표로 구분)"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingMomentId(null)}
                          className="px-4 py-1.5 text-xs bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                        >
                          완료
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 보기 모드 */
                    <div className="p-4 flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-surface-100 text-bluewood-400 text-xs font-bold flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {m.type && m.type.split(',').map(t => t.trim()).filter(Boolean).map((typeKey, ti) => (
                            <span key={ti} className="relative group flex-shrink-0">
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-primary-50 text-primary-600 border border-primary-100 cursor-default">
                                {typeKey}
                              </span>
                              {MOMENT_TYPE_DESC[typeKey] && (
                                <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-56 rounded-lg bg-bluewood-900 text-white text-[11px] leading-relaxed px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-normal">
                                  {MOMENT_TYPE_DESC[typeKey]}
                                  <span className="absolute top-full left-3 border-4 border-transparent border-t-bluewood-900" />
                                </span>
                              )}
                            </span>
                          ))}
                          <p className="text-sm font-semibold text-bluewood-900 truncate">{m.title}</p>
                        </div>
                        <StarDescription
                          description={m.description}
                          onUpdateMissing={(newDesc) => updateMoment(m.id, 'description', newDesc)}
                        />
                        {m.keywords?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {m.keywords.map((kw, ki) => (
                              <span key={ki} className="px-2 py-0.5 bg-surface-100 text-bluewood-500 text-xs rounded-md">
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex flex-col gap-1.5 ml-2">
                        <button
                          onClick={() => setEditingMomentId(m.id)}
                          className="px-3 py-1.5 text-xs border border-surface-200 text-bluewood-500 rounded-lg hover:bg-surface-50 transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => deleteMoment(m.id)}
                          className="px-3 py-1.5 text-xs border border-red-100 text-red-400 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl mb-2">
          <div className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold mt-0.5">!</div>
          <p className="text-xs text-blue-600 leading-relaxed">최종 AI 분석은 자료량에 따라 최대 5분 소요될 수 있어요 — 시작 후 페이지를 벗어나지 마세요.</p>
        </div>
        <div className="flex gap-3 pb-8">
          <button
            onClick={() => setStep(2)}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white border border-surface-200 text-bluewood-600 rounded-2xl text-sm font-semibold hover:bg-surface-50 transition-all"
          >
            <ChevronLeft size={16} />
            이전
          </button>
          <button
            onClick={handleFinalSubmit}
            disabled={moments.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-primary-500 text-white rounded-2xl text-base font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-200/50"
          >
            선택한 {moments.length}개 경험으로 정리 시작
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="animate-fadeIn max-w-2xl mx-auto">
      <Link to="/app/experience" className="inline-flex items-center gap-2 text-sm text-bluewood-400 hover:text-bluewood-600 mb-6">
        <ArrowLeft size={16} /> 경험 정리로 돌아가기
      </Link>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-3 mb-8">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
          step === 1 ? 'bg-primary-500 text-white shadow-sm' : 'bg-surface-100 text-bluewood-400'
        }`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
            {step > 1 ? <Check size={12} /> : '1'}
          </span>
          기본 정보
        </div>
        <div className="w-8 h-px bg-surface-300" />
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
          step === 2 ? 'bg-primary-500 text-white shadow-sm' : 'bg-surface-100 text-bluewood-400'
        }`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
            {step > 2 ? <Check size={12} /> : '2'}
          </span>
          자료 수집
        </div>
        <div className="w-8 h-px bg-surface-300" />
        <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-surface-100 text-bluewood-400">
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">3</span>
          경험 검토
        </div>
      </div>

      {/* ===== Step 1: 기본 정보 ===== */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm">
            {/* 프로젝트명 */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-bluewood-600 mb-2">
                프로젝트명 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="프로젝트 이름을 입력하세요"
                className="w-full px-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 text-bluewood-900 placeholder-bluewood-300 transition-all"
              />
            </div>

            {/* 날짜 */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-bluewood-600 mb-2">
                <Calendar size={12} className="inline mr-1" />
                기간 <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 text-bluewood-900 transition-all"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-3.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 text-bluewood-900 transition-all"
                />
              </div>
            </div>

            {/* 분야 선택 */}
            <div>
              <label className="block text-xs font-semibold text-bluewood-600 mb-2">분야</label>
              <div className="flex flex-wrap gap-2">
                {FIELD_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const selected = field === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setField(selected ? '' : opt.value)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        selected
                          ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                          : 'bg-white text-bluewood-600 border-surface-200 hover:border-primary-300 hover:bg-primary-50/50'
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
          <button
            onClick={() => setStep(2)}
            disabled={!canNext1}
            className="w-full flex items-center justify-center gap-2 py-4 bg-primary-500 text-white rounded-2xl text-base font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-200/50"
          >
            다음 단계
            <ChevronRight size={18} />
          </button>
          <p className="text-center text-xs text-blue-400 mt-1">AI 분석 과정은 자료량에 따라 최대 5분 소요될 수 있어요</p>
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
