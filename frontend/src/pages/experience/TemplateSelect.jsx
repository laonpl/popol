import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Github,
  X, CheckCircle2, Calendar,
  ChevronRight, ChevronLeft, Link2, Plus, Code2,
  Loader2, Check, FolderOpen, Palette, Monitor,
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useExperienceStore, { JOB_CATEGORIES } from '../../stores/experienceStore';
import { importFileUpload, importFromUrl } from '../../services/importAI';
import { uploadDocumentFile } from '../../services/uploadImage';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useOnboarding } from '../../components/OnboardingOverlay';
import GuidedTutorial from '../../components/GuidedTutorial';
import { buildDraftStructuredResult, cleanRawText } from '../../utils/experienceDraft';

const ACCEPT_FILES = '.pdf,.docx,.doc,.jpg,.jpeg,.png,.webp';
const TUTORIAL_PROJECT = {
  title: '가상 경험: 교내 공지 서비스 개선 프로젝트',
  startDate: '2026-03',
  endDate: '2026-06',
  jobCategory: 'dev',
  textInput: `교내 공지 확인 서비스에서 학생들이 중요한 안내를 놓치는 문제가 있었습니다.
저는 사용자 인터뷰 12건을 진행해 공지 탐색 흐름을 분석했고, 자주 놓치는 카테고리를 다시 정리했습니다.
React로 핵심 화면 3개를 프로토타입으로 만들고 테스트를 진행했습니다.
그 결과 공지 확인 누락률을 32% 낮추고 테스트 만족도 4.6/5를 얻었습니다.`,
};

function createTutorialMoment(prefix = 'tutorial') {
  return {
    id: `${prefix}-${Date.now()}`,
    title: '교내 공지 서비스 개선 프로젝트',
    type: '유형1,유형5',
    description: [
      'Context: 학생들이 중요한 공지를 여러 채널에서 확인해야 해서 누락이 자주 발생했습니다.',
      'Action: 사용자 인터뷰 12건을 진행하고 공지 탐색 흐름을 재설계한 뒤 React 프로토타입 3개 화면을 제작했습니다.',
      'Result: 공지 확인 누락률을 32% 낮추고 테스트 만족도 4.6/5를 달성했습니다.',
      'Learning: 정성 인터뷰를 화면 구조와 정량 성과로 연결하는 방법을 배웠습니다.',
    ].join('\n'),
    keywords: ['문제정의', '사용자 인터뷰', '프로토타입', '성과 개선'],
    context: '학생들이 중요한 공지를 여러 채널에서 확인해야 해서 누락이 자주 발생했습니다.',
    action: '사용자 인터뷰 12건을 진행하고 공지 탐색 흐름을 재설계한 뒤 React 프로토타입 3개 화면을 제작했습니다.',
    result: '공지 확인 누락률을 32% 낮추고 테스트 만족도 4.6/5를 달성했습니다.',
    learning: '정성 인터뷰를 화면 구조와 정량 성과로 연결하는 방법을 배웠습니다.',
    isTutorialDemo: true,
  };
}

function createTutorialDraft() {
  return {
    title: '추가 가상 경험: 알림 우선순위 개선',
    type: '유형1',
    context: '모든 공지가 같은 중요도로 노출되어 사용자가 긴급한 안내를 구분하기 어려웠습니다.',
    action: '공지 유형별 우선순위 기준을 만들고 긴급 안내를 상단에 고정하는 화면을 설계했습니다.',
    result: '긴급 공지 클릭률이 21% 증가했고 반복 문의가 줄었습니다.',
    learning: '정보 구조를 정리할 때 사용자 행동 데이터와 인터뷰를 함께 봐야 한다는 점을 배웠습니다.',
    keywords: ['정보구조', '우선순위', '사용자 행동'],
  };
}

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
    <div className="mt-3 border-l-2 border-surface-100 pl-3 py-1 space-y-2">
      <p className="text-[15px] text-bluewood-700 leading-relaxed font-medium">{question}</p>
      {reason && <p className="text-[11px] text-bluewood-400 leading-relaxed">{reason}</p>}

      {mode === 'intro' && (
        <div className="space-y-2">
          <p className="text-[11px] text-bluewood-400">정확한 수치가 기억 안 나도 괜찮아요, 대략적으로만 채워도 충분해요</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('guided')}
              className="flex-1 py-1.5 rounded-lg bg-primary-600 text-white text-[15px] font-medium hover:bg-primary-700 transition-colors">
              수치로 간단히 채우기
            </button>
            <button type="button" onClick={() => setMode('free')}
              className="px-2 py-1.5 rounded-lg border border-surface-200 text-bluewood-600 text-[15px] hover:bg-surface-50 transition-colors">
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
                className="px-2 py-0.5 rounded-md border border-surface-200 text-[10px] text-bluewood-600 hover:bg-surface-50 transition-colors">
                {sg}
              </button>
            ))}
          </div>
          <div className="border border-surface-100 rounded-lg px-2 py-1.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-bluewood-300 w-16 shrink-0">이전 (선택)</span>
              <input value={beforeVal} onChange={e => setBeforeVal(e.target.value)}
                placeholder="ex. 800"
                className="flex-1 text-[15px] text-bluewood-600 border-b border-surface-200 px-1 py-0.5 focus:outline-none focus:border-bluewood-300 bg-transparent" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-bluewood-700 w-16 shrink-0 font-medium">이후 *</span>
              <input value={afterVal} onChange={e => setAfterVal(e.target.value)}
                placeholder="ex. 480"
                className="flex-1 text-[15px] text-bluewood-800 border-b border-surface-200 px-1 py-0.5 focus:outline-none focus:border-bluewood-400 bg-transparent" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-bluewood-300 w-16 shrink-0">단위</span>
              <div className="flex gap-1 flex-wrap">
                {unitOptions.map(u => (
                  <button key={u} type="button" onClick={() => setUnit(u)}
                    className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                      unit === u
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-surface-200 text-bluewood-400 hover:border-bluewood-300'
                    }`}>{u}</button>
                ))}
              </div>
            </div>
          </div>
          {afterVal && (
            <p className="text-[11px] text-bluewood-700 bg-surface-50 rounded-lg px-2.5 py-1.5 border border-surface-100">
              ✦ {buildPreview()}
            </p>
          )}
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setMode('free')}
              className="text-[10px] text-bluewood-400 hover:underline">
              직접 입력으로 전환
            </button>
            <button type="button"
              onClick={() => handleApply(buildPreview())}
              disabled={!afterVal.trim()}
              className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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
                className="px-2 py-0.5 rounded-md border border-surface-200 text-[10px] text-bluewood-600 hover:bg-surface-50 transition-colors">
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
              className="flex-1 text-[15px] text-bluewood-700 bg-transparent border border-surface-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-bluewood-300 leading-relaxed"
            />
            <button type="button"
              onClick={() => handleApply(draft)}
              disabled={!draft.trim()}
              className="self-end px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              추가
            </button>
          </div>
          <button type="button" onClick={() => setMode('guided')}
            className="text-[10px] text-bluewood-400 hover:underline">
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
        className="w-full bg-transparent text-[15px] text-bluewood-600 leading-relaxed outline-none resize-none border-b border-transparent focus:border-surface-200 transition-colors"
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
          {i > 0 && <span className="flex-shrink-0 text-bluewood-200 mr-1.5 text-[15px] leading-relaxed pt-[1px] select-none">&bull;</span>}
          <AutoSizeTextarea
            value={s.text}
            onChange={v => updateSection(s.key, v)}
            className={`flex-1 bg-transparent outline-none resize-none leading-relaxed text-[15px] border-b border-transparent focus:border-surface-200 transition-colors ${styleMap[s.key] || 'text-bluewood-600'}`}
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
      className="mt-1.5 text-[11px] text-bluewood-500 bg-transparent border-b border-surface-200 outline-none w-full placeholder:text-surface-300 transition-colors focus:border-bluewood-200"
      placeholder="키워드 추가 (Enter로 확인)"
    />
  );
}

/* CARL 구조화 렌더러 — 라벨 없이 자연스러운 흐름으로 표시 */
function CarlDescription({ description, onUpdateMissing }) {
  const sections = parseCarlDescription(description);
  if (!sections) {
    return <p className="text-[15px] text-bluewood-600 leading-relaxed">{description}</p>;
  }

  const mainSections = sections.filter(s => s.key !== 'missing');
  const missingSections = sections.filter(s => s.key === 'missing');

  return (
    <div className="mt-1 space-y-1.5">
      {mainSections.map((s, i) => (
        <p key={i} className={`text-[15px] leading-relaxed ${
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

// JOB_CATEGORIES는 experienceStore에서 가져옴 (import 됨)

export default function TemplateSelect() {
  const { user } = useAuthStore();
  const { createExperience, extractMoments, draftAnalyze } = useExperienceStore();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const createTutorialKey = user?.uid ? `experience-create-tutorial-${user.uid}` : null;
  const forceCreateTutorial = new URLSearchParams(location.search).get('tutorial') === '1';
  const { visible: createTutorialVisible, dismiss: dismissCreateTutorial } = useOnboarding(createTutorialKey, { force: forceCreateTutorial });

  const [step, setStep] = useState(1); // 1: 기본정보, 2: 자료수집, 3: 로딩(추출), 4: 추출 결과 검토, 5: 리서치/섹션 생성
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isOngoing, setIsOngoing] = useState(false);
  const [field, setField] = useState('');
  const [jobCategory, setJobCategory] = useState('');
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [notionUrl, setNotionUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [gitStats, setGitStats] = useState(null); // GitHub 커밋 기여 비중 통계
  const [gitAnalysis, setGitAnalysis] = useState(null); // GitHub 분석 원본(코드변경·트러블슈팅 등) 보존
  const [sourceDeliverables, setSourceDeliverables] = useState([]); // 업로드 파일·입력 링크 보존
  const [blogUrl, setBlogUrl] = useState('');
  const [linkInputs, setLinkInputs] = useState([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadingSteps, setLoadingSteps] = useState([]);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);
  const tutorialTimersRef = useRef([]);
  const tutorialRef = useRef(null);
  const [tutorialExtracting, setTutorialExtracting] = useState(false);
  const [tutorialCurrentStep, setTutorialCurrentStep] = useState(0);
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

  const clearTutorialTimers = useCallback(() => {
    tutorialTimersRef.current.forEach(timer => window.clearTimeout(timer));
    tutorialTimersRef.current = [];
  }, []);

  useEffect(() => () => clearTutorialTimers(), [clearTutorialTimers]);

  const fillTutorialBasics = useCallback(() => {
    setTitle(TUTORIAL_PROJECT.title);
    setStartDate(TUTORIAL_PROJECT.startDate);
    setEndDate(TUTORIAL_PROJECT.endDate);
    setIsOngoing(false);
    setJobCategory(TUTORIAL_PROJECT.jobCategory);
    toast.success('예시 기본 정보를 채웠습니다');
  }, []);

  const moveTutorialToDataStep = useCallback(() => {
    if (!title.trim() || !startDate || !jobCategory) fillTutorialBasics();
    setStep(2);
  }, [fillTutorialBasics, jobCategory, startDate, title]);

  const fillTutorialInput = useCallback(() => {
    setTextInput(TUTORIAL_PROJECT.textInput);
    toast.success('예시 자료를 입력했습니다');
  }, []);

  const runTutorialExtraction = useCallback(() => {
    if (tutorialExtracting) return;
    clearTutorialTimers();
    if (!title.trim() || !startDate || !jobCategory) fillTutorialBasics();
    if (!textInput.trim()) setTextInput(TUTORIAL_PROJECT.textInput);

    setTutorialExtracting(true);
    setStep(3);
    setLoadingSteps([
      { label: '예시 텍스트 데이터 처리', status: 'loading' },
      { label: '핵심 경험 후보 추출', status: 'pending' },
      { label: 'CARL 구조로 정리', status: 'pending' },
    ]);
    setCurrentLoadingStep(0);

    const firstTimer = window.setTimeout(() => {
      setLoadingSteps([
        { label: '예시 텍스트 데이터 처리', status: 'done' },
        { label: '핵심 경험 후보 추출', status: 'loading' },
        { label: 'CARL 구조로 정리', status: 'pending' },
      ]);
      setCurrentLoadingStep(1);
    }, 600);

    const secondTimer = window.setTimeout(() => {
      setLoadingSteps([
        { label: '예시 텍스트 데이터 처리', status: 'done' },
        { label: '핵심 경험 후보 추출', status: 'done' },
        { label: 'CARL 구조로 정리', status: 'loading' },
      ]);
      setCurrentLoadingStep(2);
    }, 1200);

    const doneTimer = window.setTimeout(() => {
      const moment = createTutorialMoment('tutorial-extracted');
      setCollectedText(TUTORIAL_PROJECT.textInput);
      setMoments([moment]);
      setCurrentMomentIdx(0);
      setEditingMomentId(null);
      setIsCreatingNew(false);
      setTutorialExtracting(false);
      setStep(4);
      tutorialRef.current?.next();
      toast.success('가상 경험이 추출되었습니다');
    }, 1900);

    tutorialTimersRef.current = [firstTimer, secondTimer, doneTimer];
  }, [clearTutorialTimers, fillTutorialBasics, jobCategory, startDate, textInput, title, tutorialExtracting]);

  const openTutorialManualForm = useCallback(() => {
    setStep(4);
    setIsCreatingNew(true);
    setEditingMomentId(null);
    setNewExp(createTutorialDraft());
    setNewExpKwInput('');
  }, []);

  const addTutorialManualExperience = useCallback(() => {
    const draft = createTutorialDraft();
    const moment = {
      id: `tutorial-manual-${Date.now()}`,
      title: draft.title,
      type: draft.type,
      description: [
        `Context: ${draft.context}`,
        `Action: ${draft.action}`,
        `Result: ${draft.result}`,
        `Learning: ${draft.learning}`,
      ].join('\n'),
      keywords: draft.keywords,
      context: draft.context,
      action: draft.action,
      result: draft.result,
      learning: draft.learning,
      isTutorialDemo: true,
    };
    setMoments(prev => {
      const next = [...prev, moment];
      setCurrentMomentIdx(next.length - 1);
      return next;
    });
    setIsCreatingNew(false);
    setNewExp({ title: '', type: '', context: '', action: '', result: '', learning: '', keywords: [] });
    toast.success('가상 경험이 목록에 추가되었습니다');
  }, []);

  const runTutorialFinalSubmit = useCallback(() => {
    clearTutorialTimers();
    dismissCreateTutorial(true);
    setStep(5);
    setLoadingSteps([
      { label: '경험 데이터 생성', status: 'loading' },
      { label: '프로젝트 개요·시장/지표 리서치', status: 'pending' },
      { label: '7개 포트폴리오 섹션 생성', status: 'pending' },
    ]);
    const t1 = window.setTimeout(() => {
      setLoadingSteps([
        { label: '경험 데이터 생성', status: 'done' },
        { label: '프로젝트 개요·시장/지표 리서치', status: 'loading' },
        { label: '7개 포트폴리오 섹션 생성', status: 'pending' },
      ]);
    }, 700);
    const t2 = window.setTimeout(() => {
      setLoadingSteps([
        { label: '경험 데이터 생성', status: 'done' },
        { label: '프로젝트 개요·시장/지표 리서치', status: 'done' },
        { label: '7개 포트폴리오 섹션 생성', status: 'loading' },
      ]);
    }, 1400);
    const t3 = window.setTimeout(() => {
      toast.success('튜토리얼 완료! 이제 직접 경험을 작성해보세요');
      navigate('/app/experience?tutorial=1&step=1');
    }, 2200);
    tutorialTimersRef.current = [t1, t2, t3];
  }, [clearTutorialTimers, dismissCreateTutorial, navigate]);

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
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ext === 'hwp' || ext === 'hwpx') {
        toast.error(`한글 파일(.hwp)은 지원되지 않습니다. PDF로 변환해서 업로드해주세요.`);
        return;
      }
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
  const canNext1 = title.trim() && startDate && jobCategory;
  // 개발자 트랙: GitHub 연동을 1순위 입력으로 배치하고 전용 안내를 노출
  const isDevTrack = jobCategory === 'dev';

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
      const collectedDeliverables = [
        ...(notionUrl.trim() ? [{ id: `source-notion-${Date.now()}`, kind: 'link', name: 'Notion 페이지', url: notionUrl.trim(), source: 'notion' }] : []),
        ...(githubUrl.trim() ? [{ id: `source-github-${Date.now()}`, kind: 'link', name: 'GitHub 리포지토리', url: githubUrl.trim(), source: 'github' }] : []),
        ...(blogUrl.trim() ? [{ id: `source-blog-${Date.now()}`, kind: 'link', name: '블로그·외부 링크', url: blogUrl.trim(), source: 'blog' }] : []),
        ...linkInputs.map((url, index) => ({ id: `source-link-${Date.now()}-${index}`, kind: 'link', name: `산출물 링크 ${index + 1}`, url: url.trim(), source: 'link' })).filter(item => item.url),
      ];

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
          try {
            const uploaded = await uploadDocumentFile(file);
            collectedDeliverables.push({
              id: `source-file-${Date.now()}-${collectedDeliverables.length}`,
              kind: 'file',
              name: uploaded.name || file.name,
              url: uploaded.url,
              filename: uploaded.filename,
              size: uploaded.size || file.size,
              ext: String(file.name || '').split('.').pop().toLowerCase(),
            });
          } catch (uploadError) {
            toast.error(`'${file.name}' 파일은 분석했지만 산출물 저장에 실패했어요`);
          }
        }
        updateLoadingStep(stepIdx, 'done');
        stepIdx++;
      }
      setSourceDeliverables(collectedDeliverables);

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
          // ⚠ 레포 README(개발 중심)는 서비스 문제정의를 흐리므로 allText에 넣지 않는다.
          //   git은 아래 커밋 분석으로만 반영(문제 해결 과정·기여도).
          // 내 커밋 분석 (username 입력된 경우)
          if (githubUsername.trim()) {
            let gitData = null;
            try {
              const res = await api.post('/experience/analyze-git', {
                repoUrl: githubUrl.trim(),
                authorParam: githubUsername.trim(),
              });
              gitData = res.data;
            } catch (gitErr) {
              const msg = gitErr.response?.data?.error || '';
              if (msg.includes('커밋을 찾을 수 없습니다') || msg.includes('찾을 수 없습니다')) {
                toast.error(`'${githubUsername.trim()}' 사용자의 커밋을 찾을 수 없습니다. GitHub 아이디를 확인해주세요.`, { duration: 5000 });
                setStep(2);
                return;
              } else if (msg) {
                toast.error(msg, { duration: 4000 });
              } else {
                toast.error('커밋 분석에 실패했습니다.', { duration: 3000 });
              }
            }
            // 커밋 기여 비중 통계 보존 (개발자 포트폴리오에서 표시)
            if (gitData?.contributionStats) {
              setGitStats({ ...gitData.contributionStats, repoName: gitData.repoName });
            }
            // GitHub 분석 원본(코드변경·코드스니펫·트러블슈팅) 보존 → 포트폴리오에서 코드 상세 렌더
            if (gitData?.experiences?.length > 0) {
              setGitAnalysis({ repoName: gitData.repoName, experiences: gitData.experiences });
            }
            // 커밋 분석 성공 → moments에 직접 추가 (allText 우회)
            if (gitData?.experiences?.length > 0) {
              const toStrArr = (arr) => (arr || []).map(item =>
                typeof item === 'string' ? item : Object.values(item).filter(v => typeof v === 'string').join(' ')
              );
              const gitMoments = gitData.experiences.map((exp, i) => ({
                id: `git-${Date.now()}-${i}`,
                title: exp.project_name || `GitHub 경험 ${i + 1}`,
                type: 'project',
                description: exp.core_impact || '',
                keywords: exp.core_tech_stack ? exp.core_tech_stack.split(/,\s*/).map(s => s.trim()).filter(Boolean) : [],
                // STAR 필드 매핑
                context: [
                  exp.period ? `기간: ${exp.period}` : '',
                  ...toStrArr(exp.problem_definition),
                ].filter(Boolean).join('\n'),
                action: [
                  ...toStrArr(exp.code_changes),
                  ...toStrArr(exp.action_and_solution),
                ].join('\n'),
                result: exp.core_impact || '',
                learning: [
                  ...toStrArr(exp.troubleshooting),
                  ...toStrArr(exp.learning),
                ].join('\n'),
                // 원본 깃 분석 데이터 보존 (검토 단계에서 표시용)
                _git: {
                  problem_definition: toStrArr(exp.problem_definition),
                  code_changes: toStrArr(exp.code_changes),
                  troubleshooting: toStrArr(exp.troubleshooting),
                  action_and_solution: toStrArr(exp.action_and_solution),
                  learning_items: toStrArr(exp.learning),
                  core_tech_stack: exp.core_tech_stack || '',
                  period: exp.period || '',
                  totalCommits: gitData.totalCommits,
                },
              }));
              // 기존 moments에 병합 (step4 진입 시 합쳐짐)
              setMoments(prev => [...prev, ...gitMoments]);
              toast.success(`커밋 ${gitData.totalCommits}개 분석 완료 → ${gitMoments.length}개 경험 추출`, { duration: 3000 });
            }
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

      // 깃 분석으로 moments가 이미 채워진 경우 allText 없어도 통과
      const hasGitMoments = moments.some(m => m.id?.startsWith('git-'));
      if (!allText.trim() && !hasGitMoments) {
        toast.error('분석할 내용이 없습니다');
        setStep(2);
        return;
      }

      // 6) 핵심 경험 추출 — allText가 있을 때만 AI 추출, 없으면 git moments만으로 진행
      updateLoadingStep(stepIdx, 'loading');
      let aiMoments = [];
      if (allText.trim()) {
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
        aiMoments = extractResult.moments || [];
      }
      updateLoadingStep(stepIdx, 'done');

      setCollectedText(allText.trim());
      // 깃 분석 moments(git-*)와 AI 추출 moments 병합
      setMoments(prev => {
        const gitMoments = prev.filter(m => m.id?.startsWith('git-'));
        return [...gitMoments, ...aiMoments];
      });
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
      { label: '프로젝트 개요·시장/지표 리서치', status: 'pending' },
      { label: '7개 포트폴리오 섹션 생성', status: 'pending' },
    ];
    finalSteps[0].label = '경험 데이터 저장';
    finalSteps[1].label = '빠른 초안 생성';
    finalSteps[2].label = '결과 화면 준비';
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
      // 초안은 인터뷰 흐름과 동일하게 빠른 AI 초안(draftAnalyze)으로 통일. 실패 시 로컬 폴백.
      let draftAnalysis;
      try {
        const draftContent = {
          자료: cleanRawText(collectedText) || collectedText,
          핵심경험: momentsText,
        };
        // git 커밋 상세(트러블슈팅·코드변경)는 개요를 지배하지 않도록 초안에 주입하지 않고
        // '문제 해결 과정'에서 별도 표시(draftWithStats.gitAnalysis). 기술스택 힌트만 가볍게 전달(아키텍처 폴백용).
        if (gitAnalysis?.experiences?.length) {
          const techStacks = gitAnalysis.experiences.map(e => e.core_tech_stack).filter(Boolean);
          if (techStacks.length) draftContent.기술스택 = [...new Set(techStacks.join(', ').split(/,\s*/))].filter(Boolean).join(', ');
        }
        draftAnalysis = await draftAnalyze({ content: draftContent, jobCategory: jobCategory || 'common' });
      } catch (draftErr) {
        console.warn('[TemplateSelect] AI 초안 실패 → 로컬 초안 폴백:', draftErr?.message);
        draftAnalysis = buildDraftStructuredResult({
          title: title.trim(),
          period,
          jobCategory: jobCategory || 'common',
          moments: syncedMoments,
          collectedText,
          content: { rawInput: finalText },
        });
      }
      // GitHub 기여 통계 + 분석 원본(코드·트러블슈팅)을 structuredResult에 보존 → 개발자 포트폴리오에서 코드 상세 렌더
      const draftWithStats = {
        ...draftAnalysis,
        ...(gitStats ? { githubStats: gitStats } : {}),
        ...(gitAnalysis?.experiences?.length ? { gitAnalysis } : {}),
        deliverables: sourceDeliverables,
      };
      const experienceId = await createExperience(user.uid, {
        title: title.trim(),
        framework: 'STRUCTURED',
        period,
        field: field || undefined,
        jobCategory: jobCategory || 'common',
        content: { rawInput: finalText },
        momentsCount: moments.length,
        reviewedMoments: syncedMoments,
        structuredResult: draftWithStats,
        keywords: draftAnalysis.keywords || [],
        analysisMode: 'draft',
      });
      updateLoadingStep(0, 'done');

      updateLoadingStep(1, 'loading');
      updateLoadingStep(1, 'done');
      updateLoadingStep(2, 'done');

      toast.success('빠른 초안이 완성되었습니다. AI로 완성하기를 누르면 더 풍부해져요.');
      // 모든 직군이 케이스 스터디로 진입 — 개발 직군은 케이스 스터디 안에서 GitHub 기반 개발 임팩트를 보여준다
      navigate(`/app/experience/result/${experienceId}`, {
        state: {
          analysis: draftWithStats,
          title: title.trim(),
          jobCategory,
          framework: 'STRUCTURED',
          content: { rawInput: finalText },
          showFeedback: true,
          feedbackContext: 'experience_material_draft_complete',
        },
      });
    } catch (error) {
      console.error('경험 생성 실패:', error);
      if (error?.isCreditError) {
        toast.error(error.message || '크레딧이 부족합니다.');
        setStep(4);
        return;
      }
      const isAiError = error?.response?.status >= 500 || error?.response?.status === 429;
      toast.error(isAiError
        ? 'AI 서버가 일시적으로 바쁩니다. 잠시 후 다시 시도해주세요.'
        : '경험 생성에 실패했습니다. 다시 시도해주세요.');
      setStep(4);
    }
  };

  const createTutorialSteps = [
    {
      selector: '[data-tour="create-title"]',
      title: '프로젝트명을 눌러서 기본 정보를 채워보세요',
      body: '새 경험 작성 화면으로 들어왔습니다. 먼저 예시 프로젝트명, 기간, 직군을 채워서 경험 만들기 흐름을 시작합니다.',
      actionLabel: '예시 정보 채우기',
      onAction: fillTutorialBasics,
      preview: <p>실제 저장 없이 화면에만 샘플 값이 입력됩니다.</p>,
      onEnter: () => setStep(1),
    },
    {
      selector: '[data-tour="create-to-data"]',
      title: '자료 수집으로 눌러서 다음 단계로 이동해보세요',
      body: '기본 정보가 채워졌다면 자료 수집 단계로 넘어갑니다. 여기서 파일, 링크, 직접 입력 자료를 넣을 수 있습니다.',
      onEnter: () => { if (!title.trim() || !startDate || !jobCategory) fillTutorialBasics(); setStep(1); },
    },
    {
      selector: '[data-tour="create-text-input"]',
      title: '직접 입력 칸을 눌러서 예시 자료를 넣어보세요',
      body: '튜토리얼에서는 파일 업로드 대신 짧은 샘플 텍스트를 넣고, 이 내용에서 핵심 경험이 추출되는 과정을 보여드립니다.',
      actionLabel: '예시 자료 입력하기',
      onAction: fillTutorialInput,
      onEnter: moveTutorialToDataStep,
      onPrev: () => setStep(1),
    },
    {
      selector: '[data-tour="create-extract"]',
      title: 'AI 경험 추출을 눌러서 만들어지는 과정을 확인해보세요',
      body: '이 버튼을 누르면 예시 자료가 처리되고, 핵심 경험 후보가 CARL 구조로 정리되는 과정을 화면에서 보여드립니다.',
      preview: <p>튜토리얼 실행 중에는 실제 AI 호출이나 DB 저장을 하지 않습니다.</p>,
      onEnter: moveTutorialToDataStep,
      onPrev: () => { clearTutorialTimers(); setTutorialExtracting(false); },
    },
    {
      selector: '[data-tour="create-moment-list"]',
      title: '추출된 가상 경험을 눌러서 확인해보세요',
      body: '예시 자료에서 경험 카드가 생성되었습니다. 왼쪽 목록에서 선택하면 제목, 행동, 성과, 배운 점을 확인하고 수정할 수 있습니다.',
      onEnter: () => { if (moments.length === 0 && !tutorialExtracting) runTutorialExtraction(); },
      onPrev: () => { clearTutorialTimers(); setTutorialExtracting(false); setMoments([]); setStep(2); },
    },
    {
      selector: '[data-tour="create-manual-add"]',
      title: '새 경험 추가를 눌러서 직접 만드는 예시도 확인해보세요',
      body: 'AI가 추출한 경험 외에도 직접 경험을 추가할 수 있습니다. 버튼을 눌러서 미리 채워진 작성 폼을 열어보세요.',
      onEnter: () => {
        setIsCreatingNew(false);
        if (moments.length === 0) {
          const m = createTutorialMoment('tutorial-fast');
          setMoments([m]);
          setCurrentMomentIdx(0);
          setStep(4);
        }
      },
    },
    {
      selector: '[data-tour="create-manual-form"]',
      title: '가상 경험을 눌러서 목록에 추가해보세요',
      body: '폼에는 제목, 배경, 행동, 결과, 배운 점이 샘플로 채워져 있습니다. 아래 버튼을 누르면 경험 목록에 하나 더 추가됩니다.',
      onEnter: openTutorialManualForm,
      onPrev: () => setIsCreatingNew(false),
    },
    {
      selector: '[data-tour="create-final-submit"]',
      title: '검토가 끝나면 구조화를 시작합니다',
      body: '실제 사용에서는 이 버튼을 눌러 경험을 저장하고 포트폴리오 섹션을 생성합니다. 이 버튼을 직접 눌러 튜토리얼 완료 흐름을 확인해보세요.',
      onEnter: () => setIsCreatingNew(false),
      onPrev: openTutorialManualForm,
    },
  ];

  const createTutorialOverlay = (
    <GuidedTutorial
      ref={tutorialRef}
      visible={createTutorialVisible}
      steps={createTutorialSteps}
      onSkip={() => dismissCreateTutorial(false)}
      onNeverShow={() => dismissCreateTutorial(true)}
      onStepChange={setTutorialCurrentStep}
    />
  );

  // ===== Step 3: 로딩 화면 =====
  if (step === 3) {
    const doneCount = loadingSteps.filter(s => s.status === 'done').length;
    const progress = loadingSteps.length > 0 ? Math.round((doneCount / loadingSteps.length) * 100) : 0;
    const activeStep = loadingSteps.find(s => s.status === 'loading');

    return (
      <>
      {createTutorialOverlay}
      <div className="animate-fadeIn mx-auto max-w-3xl pt-24 px-8">
        {/* 상단 메타 */}
        <p className="text-[15px] font-bold uppercase tracking-[0.22em] text-bluewood-200 mb-6">AI Analysis · Processing</p>

        {/* 제목 + 진행률 */}
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-[30px] font-bold tracking-[-0.02em] text-primary-600 leading-tight">핵심 경험 추출 중</h2>
          <span className="text-[24px] font-bold tabular-nums text-primary-600">{progress}<span className="text-[15px] font-normal text-bluewood-300 ml-1">%</span></span>
        </div>

        {/* 진행 바 */}
        <div className="w-full h-[3px] bg-surface-100 mb-9 overflow-hidden">
          <div
            className="h-full bg-primary-600 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 현재 작업 */}
        {activeStep && (
          <div className="flex items-center gap-2 mb-6">
            <Loader2 size={9} className="text-bluewood-400 animate-spin flex-shrink-0" />
            <span className="text-[11px] font-semibold text-bluewood-700">{activeStep.label}</span>
          </div>
        )}

        {/* 단계 목록 */}
        <div className="divide-y divide-surface-100">
          {loadingSteps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 transition-all duration-300">
              <div className="w-5 flex-shrink-0 flex items-center justify-center">
                {s.status === 'done' && <Check size={11} className="text-emerald-500" strokeWidth={2.5} />}
                {s.status === 'loading' && <Loader2 size={11} className="text-bluewood-400 animate-spin" />}
                {s.status === 'pending' && <div className="w-2 h-2 rounded-full bg-surface-300 mx-auto" />}
              </div>
              <span className={`text-[11px] transition-all ${
                s.status === 'loading' ? 'font-semibold text-primary-600' :
                s.status === 'done'    ? 'text-bluewood-400 line-through decoration-surface-300' :
                'text-bluewood-200'
              }`}>{s.label}</span>
              {s.status === 'done' && <span className="ml-auto text-[11px] font-bold text-emerald-500">완료</span>}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-bluewood-200 mt-9 leading-relaxed">
          자료량에 따라 최대 5분 소요 · 페이지 이탈 시 분석이 중단됩니다
        </p>
      </div>
      </>
    );
  }

  // ===== Step 5: 최종 로딩 화면 =====
  if (step === 5) {
    const doneCount = loadingSteps.filter(s => s.status === 'done').length;
    const progress = loadingSteps.length > 0 ? Math.round((doneCount / loadingSteps.length) * 100) : 0;
    const activeStep = loadingSteps.find(s => s.status === 'loading');

    return (
      <>
      {createTutorialOverlay}
      <div className="animate-fadeIn mx-auto max-w-3xl pt-24 px-8">
        {/* 상단 메타 */}
        <p className="text-[15px] font-bold uppercase tracking-[0.22em] text-bluewood-200 mb-6">AI Analysis · Structuring</p>

        {/* 제목 + 진행률 */}
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-[30px] font-bold tracking-[-0.02em] text-primary-600 leading-tight">경험 구조화 중</h2>
          <span className="text-[24px] font-bold tabular-nums text-primary-600">{progress}<span className="text-[15px] font-normal text-bluewood-300 ml-1">%</span></span>
        </div>

        {/* 진행 바 */}
        <div className="w-full h-[3px] bg-surface-100 mb-9 overflow-hidden">
          <div
            className="h-full bg-primary-600 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 현재 작업 */}
        {activeStep && (
          <div className="flex items-center gap-2 mb-6">
            <Loader2 size={9} className="text-bluewood-400 animate-spin flex-shrink-0" />
            <span className="text-[11px] font-semibold text-bluewood-700">{activeStep.label}</span>
          </div>
        )}

        {/* 단계 목록 */}
        <div className="divide-y divide-surface-100">
          {loadingSteps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 transition-all duration-300">
              <div className="w-5 flex-shrink-0 flex items-center justify-center">
                {s.status === 'done' && <Check size={11} className="text-emerald-500" strokeWidth={2.5} />}
                {s.status === 'loading' && <Loader2 size={11} className="text-bluewood-400 animate-spin" />}
                {s.status === 'pending' && <div className="w-2 h-2 rounded-full bg-surface-300 mx-auto" />}
              </div>
              <span className={`text-[11px] transition-all ${
                s.status === 'loading' ? 'font-semibold text-primary-600' :
                s.status === 'done'    ? 'text-bluewood-400 line-through decoration-surface-300' :
                'text-bluewood-200'
              }`}>{s.label}</span>
              {s.status === 'done' && <span className="ml-auto text-[11px] font-bold text-emerald-500">완료</span>}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-bluewood-200 mt-9 leading-relaxed">
          실제 자료와 검증 가능한 시장/지표 맥락을 함께 정리합니다 · 최대 5분 소요 · 페이지 이탈 시 작업이 중단됩니다
        </p>
      </div>
      </>
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
    };

    return (
      <>
      {createTutorialOverlay}
      <div className="animate-fadeIn max-w-[1120px] mx-auto px-4 sm:px-6">
        {/* 뒤로가기 */}
        <button
          onClick={() => setStep(2)}
          className="inline-flex items-center gap-1.5 text-[11px] text-bluewood-400 hover:text-bluewood-700 mb-6 transition-colors"
        >
          <ArrowLeft size={10} /> 자료 수집으로
        </button>

        {/* 헤더 */}
        <div className="mb-6 pb-6 border-b border-surface-100">
          <p className="text-[15px] font-bold uppercase tracking-[0.22em] text-bluewood-300 mb-2">Experience Review · Step 3 of 3</p>
          <div className="flex items-end justify-between gap-2">
            <div>
              <h1 className="text-[21px] font-bold tracking-[-0.02em] text-primary-600 leading-tight">경험 검토</h1>
              <p className="mt-1.5 text-[11px] text-bluewood-400">AI가 추출한 경험을 먼저 확인하고, 필요한 내용을 수정한 뒤 포트폴리오 섹션 생성을 시작하세요.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] text-bluewood-300 tabular-nums">
                {moments.length === 0 ? '0' : isCreatingNew ? '새 경험' : safeIdx + 1} / {moments.length}{isCreatingNew ? '+1' : ''}
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { label: '기본 정보', done: true },
                  { label: '자료 수집', done: true },
                  { label: '추출 결과 검토', active: true },
                ].map((s, idx, arr) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-semibold ${s.active ? 'text-primary-600' : 'text-bluewood-300'}`}>
                      {s.done && <Check size={10} className="inline mr-0.5" strokeWidth={3} />}{s.label}
                    </span>
                    {idx < arr.length - 1 && <span className="text-bluewood-200 text-[15px]">/</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 빈 상태 */}
        {moments.length === 0 && !isCreatingNew ? (
          <div className="border border-surface-100 p-9 text-center text-bluewood-300 text-[11px] mb-5">
            추출된 경험이 없습니다. 자료 수집 단계로 돌아가거나 아래에서 직접 경험을 추가해주세요.
          </div>
        ) : (
          /* 3컬럼 레이아웃 */
          <div className="flex gap-6 lg:gap-6 mb-6 items-start">

            {/* 사이드바 */}
            <div className="w-[180px] flex-shrink-0" data-tour="create-moment-list">
              <p className="text-[11px] font-medium text-bluewood-400 mb-2 px-0.5 uppercase tracking-wide">경험 목록</p>
              <div className="flex flex-col gap-px mb-2">
                {moments.map((m, idx) => {
                  const isMissing = m.description?.includes('(미확인');
                  const isActive = !isCreatingNew && idx === safeIdx;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setCurrentMomentIdx(idx); setEditingMomentId(null); setIsCreatingNew(false); }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-[15px] leading-snug transition-colors ${
                        isActive
                          ? 'bg-primary-600 text-white font-medium'
                          : 'text-bluewood-600 hover:bg-surface-100'
                      }`}
                    >
                      <span className={`text-[15px] font-semibold mr-1.5 ${isActive ? 'text-white/50' : 'text-bluewood-300'}`}>{idx + 1}.</span>
                      <span className="line-clamp-2">{m.title}</span>
                      {m._git && (
                        <span className={`block mt-1 text-[15px] font-medium ${isActive ? 'text-blue-300' : 'text-blue-500'}`}>
                          GitHub 커밋 분석
                        </span>
                      )}
                      {isMissing && (
                        <span className={`block mt-1 text-[15px] font-medium ${isActive ? 'text-amber-300' : 'text-amber-500'}`}>
                          성과 보완 가능
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* 새 경험 추가 버튼 */}
              <button
                data-tour="create-manual-add"
                onClick={() => {
                  if (createTutorialVisible && tutorialCurrentStep === 5) {
                    openTutorialManualForm();
                    tutorialRef.current?.next();
                  } else {
                    setIsCreatingNew(true); setEditingMomentId(null); setNewExp({ title: '', type: '', context: '', action: '', result: '', learning: '', keywords: [] });
                  }
                }}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-[15px] border border-dashed transition-colors ${
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
                <div data-tour="create-manual-form" className="border border-surface-100 overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-surface-100">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-primary-600">새 경험 직접 작성</h3>
                      <span className="text-[10px] text-bluewood-400 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200">CARL 구조</span>
                    </div>
                    <button onClick={() => setIsCreatingNew(false)} className="text-[9px] text-bluewood-400 hover:text-bluewood-700 border border-surface-200 px-2.5 py-1 rounded-lg hover:bg-surface-50 transition-colors">
                      닫기
                    </button>
                  </div>

                  <div className="px-2 py-1.5 space-y-4">
                    {/* 제목 */}
                    <div>
                      <label className="block text-[11px] font-semibold text-bluewood-600 mb-1.5">경험 제목 <span className="text-red-400">*</span></label>
                      <input
                        value={newExp.title}
                        onChange={e => setNewExp(p => ({ ...p, title: e.target.value }))}
                        placeholder="예: 실시간 이상 감지 파이프라인 개발"
                        className="w-full border-0 border-b border-surface-200 bg-transparent pb-2 pt-1 text-[11px] text-primary-600 outline-none focus:border-bluewood-400 placeholder-bluewood-300"
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
                                ? 'bg-primary-600 text-white border-primary-600'
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
                          className="w-full border-0 border-b border-surface-200 bg-transparent pb-2 text-[15px] text-bluewood-700 outline-none focus:border-bluewood-400 resize-none placeholder-bluewood-300 leading-relaxed"
                        />
                      </div>
                    ))}

                    {/* 키워드 */}
                    <div>
                      <label className="block text-[11px] font-semibold text-bluewood-600 mb-1.5">역량 키워드</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(newExp.keywords || []).map((kw, ki) => (
                          <span key={ki} className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-100 text-bluewood-600 text-[11px] rounded-md border border-surface-200">
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
                          className="flex-1 border-b border-surface-200 bg-transparent py-1.5 text-[11px] text-bluewood-700 outline-none focus:border-bluewood-400"
                        />
                      </div>
                    </div>

                    {/* 제출 */}
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setIsCreatingNew(false)}
                        className="px-2 py-1.5 text-[9px] text-bluewood-500 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors"
                      >취소</button>
                      <button
                        onClick={createTutorialVisible && tutorialCurrentStep === 6 ? () => { addTutorialManualExperience(); tutorialRef.current?.next(); } : handleAddNewExp}
                        disabled={!newExp.title.trim() || !newExp.action.trim()}
                        className="px-2 py-1.5 text-[9px] font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                  <div className={`px-4 py-3 border-l-2 text-[13.5px] leading-relaxed ${
                    hint.level === 'warn'
                      ? 'border-bluewood-400 text-bluewood-600'
                      : 'border-surface-200 text-bluewood-400'
                  }`}>
                    {hint.text}
                  </div>
                )}

                {/* 경험 카드 */}
                <div className="border border-surface-200 rounded-xl overflow-hidden bg-white">

                  {/* 헤더 */}
                  <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-surface-100">
                    <div className="flex-1 min-w-0">
                      {currentM.type && (
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {currentM.type.split(',').map(t => t.trim()).filter(Boolean).map((typeKey, ti) => (
                            <span key={ti} className="relative group">
                              <span className="px-2 py-0.5 text-[15px] font-semibold rounded bg-surface-100 text-bluewood-500 border border-surface-200 cursor-default">
                                {typeKey}
                              </span>
                              {MOMENT_TYPE_DESC[typeKey] && (
                                <span className="pointer-events-none absolute bottom-full left-0 mb-2 w-56 rounded-lg bg-primary-600 text-white text-[11px] leading-relaxed px-2 py-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-normal">
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
                        className={`w-full text-[18px] font-bold text-primary-600 leading-snug bg-transparent outline-none border-b border-transparent transition-colors ${editingMomentId === currentM.id ? 'focus:border-surface-300 cursor-text' : 'cursor-default pointer-events-none'}`}
                      />
                    </div>
                    {editingMomentId === currentM.id ? (
                      <button
                        onClick={() => setEditingMomentId(null)}
                        className="flex-shrink-0 px-3.5 py-2 text-[12.5px] font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        완료
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingMomentId(currentM.id)}
                        className="flex-shrink-0 px-3.5 py-2 text-[12.5px] font-semibold border border-surface-200 text-bluewood-500 rounded-lg hover:bg-surface-50 transition-colors"
                      >
                        수정
                      </button>
                    )}
                  </div>

                  {/* 본문 */}
                  <div className="px-6 py-5">
                    {!currentM._git && (
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-bluewood-300">프로젝트 소개 · 핵심 경험</p>
                    )}
                    {/* GitHub 커밋 분석 결과 전용 뷰 */}
                    {currentM._git ? (
                      <div className="space-y-3 text-[15px]">
                        {currentM._git.problem_definition?.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-red-500 mb-1.5 flex items-center gap-1">🔴 문제 상황 (AS-IS)</p>
                            <ul className="space-y-1">
                              {currentM._git.problem_definition.map((p, i) => (
                                <li key={i} className="text-bluewood-600 flex gap-2"><span className="text-red-400 flex-shrink-0">•</span>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {currentM._git.code_changes?.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-purple-600 mb-1.5 flex items-center gap-1">🟣 코드 변경 내용</p>
                            <ul className="space-y-1">
                              {currentM._git.code_changes.map((c, i) => (
                                <li key={i} className="text-bluewood-600 flex gap-2"><span className="text-purple-400 flex-shrink-0 font-mono">±</span>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {currentM._git.troubleshooting?.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-orange-600 mb-1.5 flex items-center gap-1">🟠 트러블슈팅</p>
                            <ul className="space-y-1">
                              {currentM._git.troubleshooting.map((t, i) => (
                                <li key={i} className="text-bluewood-600 flex gap-2"><span className="text-orange-400 flex-shrink-0">→</span>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {currentM._git.action_and_solution?.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-blue-600 mb-1.5 flex items-center gap-1">🔵 실행 전략</p>
                            <ul className="space-y-1">
                              {currentM._git.action_and_solution.map((a, i) => (
                                <li key={i} className="text-bluewood-600 flex gap-2"><span className="text-blue-400 flex-shrink-0">→</span>{a}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {currentM._git.learning_items?.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-emerald-600 mb-1.5 flex items-center gap-1">🟢 인사이트 & 성장</p>
                            <ul className="space-y-1">
                              {currentM._git.learning_items.map((l, i) => (
                                <li key={i} className="text-bluewood-600 flex gap-2"><span className="text-emerald-400 flex-shrink-0">✓</span>{l}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="pt-2 border-t border-surface-100 flex items-center gap-2 text-[11px] text-bluewood-400">
                          <span>기술스택: <span className="font-medium text-bluewood-600">{currentM._git.core_tech_stack}</span></span>
                          {currentM._git.period && <span>기간: {currentM._git.period}</span>}
                          <span>커밋 {currentM._git.totalCommits}개 분석</span>
                        </div>
                      </div>
                    ) : editingMomentId === currentM.id ? (
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
                    <div className="px-6 pb-6 pt-4 border-t border-surface-100">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-bluewood-300">역량 키워드</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(currentM.keywords || []).map((kw, ki) => (
                          <span key={ki} className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-100 text-bluewood-600 text-[11px] rounded-md border border-surface-200">
                            {kw}
                            {editingMomentId === currentM.id && (
                              <button
                                onClick={() => updateMoment(currentM.id, 'keywords', (currentM.keywords || []).filter((_, j) => j !== ki))}
                                className="text-bluewood-300 hover:text-red-400 transition-colors ml-0.5 text-[15px]"
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
                  <div className="flex items-center justify-between px-6 py-4 border-t border-surface-100 bg-surface-50/40">
                    <button
                      onClick={() => handleDeleteAndMove(currentM.id)}
                      className="text-[12px] text-red-400 hover:text-red-600 hover:underline transition-colors"
                    >
                      이 경험 제외
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setCurrentMomentIdx(i => Math.max(0, i - 1)); setEditingMomentId(null); }}
                        disabled={safeIdx === 0}
                        className="flex items-center gap-1 px-3.5 py-2 text-[12.5px] font-semibold border border-surface-200 text-bluewood-500 rounded-lg hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={13} /> 이전
                      </button>
                      {safeIdx < moments.length - 1 ? (
                        <button
                          onClick={() => { setCurrentMomentIdx(i => i + 1); setEditingMomentId(null); }}
                          className="flex items-center gap-1 px-3.5 py-2 text-[12.5px] font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          다음 <ChevronRight size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => document.getElementById('final-submit-btn')?.scrollIntoView({ behavior: 'smooth' })}
                          className="flex items-center gap-1 px-3.5 py-2 text-[12.5px] font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
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
              <div className="w-[240px] flex-shrink-0 sticky top-6">
                <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-2 py-1.5 border-b border-surface-100">
                    <span className="text-[15px] font-semibold text-bluewood-800">내용 심화하기</span>
                    <span className="text-[10px] text-bluewood-500 bg-surface-100 border border-surface-200 px-1.5 py-0.5 rounded font-medium">
                      {deepQuestions.filter(dq => !deepQAnswers[`${currentM.id}-${dq.id}`]).length}개 질문
                    </span>
                  </div>
                  <div className="px-2 pb-4 space-y-5">
                    {deepQuestions.map((dq, qi) => {
                      const ansKey = `${currentM.id}-${dq.id}`;
                      const isAnswered = !!deepQAnswers[ansKey];
                      const draft = deepQDraft[ansKey] || '';

                      return (
                        <div key={dq.id} className="pt-4">
                          <div className="mb-2">
                            <p className="text-[11px] font-semibold text-bluewood-400 mb-0.5">{qi + 1}. {dq.label}</p>
                            <p className="text-[15px] font-semibold text-bluewood-800 leading-snug">{dq.q}</p>
                            {dq.hint && <p className="text-[10px] text-bluewood-400 mt-0.5 leading-relaxed">{dq.hint}</p>}
                          </div>

                          {isAnswered ? (
                            <div className="flex items-center gap-2 px-2 py-1.5 bg-surface-50 border border-surface-200 rounded-lg">
                              <span className="text-[11px] text-bluewood-600 flex-1">{deepQAnswers[ansKey]}</span>
                              <button
                                onClick={() => setDeepQAnswers(prev => { const n = { ...prev }; delete n[ansKey]; return n; })}
                                className="text-[15px] text-bluewood-400 hover:text-red-400 transition-colors flex-shrink-0"
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
                                        ? 'bg-primary-600 border-primary-600 text-white font-medium'
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
                                  className="flex-1 border-b border-surface-200 bg-transparent py-1.5 text-[11px] text-bluewood-700 outline-none focus:border-bluewood-400 placeholder-bluewood-300"
                                />
                                <button
                                  onClick={() => handleApplyDeepQ(currentM.id, dq.id, draft)}
                                  disabled={!draft.trim()}
                                  className="px-2.5 py-1.5 text-[11px] font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
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

        {/* 요약 + 하단 액션 */}
        <div className="mt-6 pt-6 border-t border-surface-100 flex items-center justify-between gap-2 pb-6">
          <div className="flex items-center gap-2 text-[11px] text-bluewood-400">
            <span><span className="font-bold text-bluewood-700">{moments.length}</span>개 경험</span>
            <span className="text-surface-200">·</span>
            <span><span className="font-bold text-bluewood-700">{totalKeywords}</span>개 역량 키워드</span>
            {missingCount > 0 && (
              <>
                <span className="text-surface-200">·</span>
                <span className="text-amber-500 font-medium">{missingCount}개 성과 보완 가능</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1.5 text-[11px] text-bluewood-400 hover:text-bluewood-700 transition-colors"
            >
              <ChevronLeft size={10} /> 자료 수집으로
            </button>
            <button
              id="final-submit-btn"
              data-tour="create-final-submit"
              onClick={createTutorialVisible && tutorialCurrentStep === 7 ? runTutorialFinalSubmit : handleFinalSubmit}
              disabled={moments.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-2 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {moments.length}개 경험으로 시장/지표 보강 시작
              <ChevronRight size={11} />
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }
  return (
    <>
    {createTutorialOverlay}
    <div className="animate-fadeIn mx-auto max-w-4xl px-1 pb-6" >
      <Link to="/app/experience" className="mb-6 inline-flex items-center gap-2 text-[11px] text-bluewood-400 hover:text-bluewood-600">
        <ArrowLeft size={9} /> 경험 정리로 돌아가기
      </Link>

      {/* 스텝 인디케이터 */}
      <div className="mb-9 flex items-center gap-2 px-1">
        <div className={`flex min-w-[84px] items-center justify-center gap-2 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-all ${
          step === 1 ? 'bg-primary-500 text-white shadow-sm shadow-primary-200/70' : 'bg-white text-bluewood-400 border border-surface-200'
        }`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold">
            {step > 1 ? <Check size={9} /> : '1'}
          </span>
          기본 정보
        </div>
        <div className="h-px flex-1 bg-surface-300" />
        <div className={`flex min-w-[84px] items-center justify-center gap-2 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-all ${
          step === 2 ? 'bg-primary-500 text-white shadow-sm shadow-primary-200/70' : 'bg-white text-bluewood-400 border border-surface-200'
        }`}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold">
            {step > 2 ? <Check size={9} /> : '2'}
          </span>
          자료 수집
        </div>
        <div className="h-px flex-1 bg-surface-300" />
        <div className="flex min-w-[84px] items-center justify-center gap-2 rounded-full border border-surface-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-bluewood-400">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-100 text-[9px] font-bold">3</span>
          추출 결과 검토
        </div>
      </div>

      {/* ===== Step 1: 기본 정보 ===== */}
      {step === 1 && (
        <div>
          {/* 헤더 */}
          <div className="mb-6">
            <p className="text-[15px] font-bold uppercase tracking-[0.22em] text-bluewood-300 mb-3">Project Registration · Step 1 of 3</p>
            <h1 className="text-[21px] font-bold tracking-[-0.02em] text-primary-600 leading-tight">프로젝트 기본 정보</h1>
            <p className="mt-2 text-[11px] text-bluewood-400 leading-relaxed">
              직군을 선택하면 해당 직군에 최적화된 분석 섹션이 자동으로 구성됩니다.
            </p>
          </div>

          {/* 폼 테이블 */}
          <div className="divide-y divide-surface-100">

            {/* 01 프로젝트명 */}
            <div className="grid md:grid-cols-[200px_1fr] gap-2 py-6">
              <div className="flex items-start gap-2 pt-0.5">
                <span className="text-[15px] font-bold text-bluewood-200 tabular-nums mt-0.5">01</span>
                <div>
                  <p className="text-[11px] font-semibold text-bluewood-700">프로젝트명 <span className="text-red-400">*</span></p>
                  <p className="text-[11px] text-bluewood-300 mt-0.5">서비스 또는 프로젝트 이름</p>
                </div>
              </div>
              <input
                data-tour="create-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예) 커머스 앱 리뉴얼, 데이터 파이프라인 구축"
                className="w-full border-0 border-b-2 border-surface-200 bg-transparent pb-2 pt-1 text-[11px] font-medium text-primary-600 outline-none transition-all placeholder:text-bluewood-200 focus:border-primary-400"
              />
            </div>

            {/* 02 기간 */}
            <div className="grid md:grid-cols-[200px_1fr] gap-2 py-6">
              <div className="flex items-start gap-2 pt-0.5">
                <span className="text-[15px] font-bold text-bluewood-200 tabular-nums mt-0.5">02</span>
                <div>
                  <p className="text-[11px] font-semibold text-bluewood-700">프로젝트 기간 <span className="text-red-400">*</span></p>
                  <p className="text-[11px] text-bluewood-300 mt-0.5">시작 ~ 종료 연월</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {/* 시작 */}
                  <select
                    value={startDate ? startDate.split('-')[0] : ''}
                    onChange={e => {
                      const y = e.target.value;
                      const m = startDate ? (startDate.split('-')[1] || '') : '';
                      setStartDate(y && m ? `${y}-${m}` : y);
                    }}
                    className="flex-1 border-0 border-b-2 border-surface-200 bg-transparent py-1.5 text-[15px] text-primary-600 outline-none transition-all focus:border-primary-400 appearance-none cursor-pointer"
                  >
                    <option value="">연도</option>
                    {Array.from({ length: new Date().getFullYear() - 1979 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={String(y)}>{y}년</option>
                    ))}
                  </select>
                  <select
                    value={startDate && startDate.split('-')[1] ? startDate.split('-')[1] : ''}
                    onChange={e => {
                      const m = e.target.value;
                      const y = startDate ? (startDate.split('-')[0] || '') : '';
                      setStartDate(y && m ? `${y}-${m}` : y);
                    }}
                    className="flex-1 border-0 border-b-2 border-surface-200 bg-transparent py-1.5 text-[15px] text-primary-600 outline-none transition-all focus:border-primary-400 appearance-none cursor-pointer"
                  >
                    <option value="">월</option>
                    {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                      <option key={m} value={m}>{i + 1}월</option>
                    ))}
                  </select>

                  <span className="text-bluewood-200 text-[9px] px-2 font-light">—</span>

                  {/* 종료 */}
                  {isOngoing ? (
                    <div className="flex-[2] py-1.5 text-[11px] font-semibold text-primary-500 border-b-2 border-primary-200">진행 중</div>
                  ) : (
                    <>
                      <select
                        value={endDate ? endDate.split('-')[0] : ''}
                        onChange={e => {
                          const y = e.target.value;
                          const m = endDate ? (endDate.split('-')[1] || '') : '';
                          setEndDate(y && m ? `${y}-${m}` : y);
                        }}
                        className="flex-1 border-0 border-b-2 border-surface-200 bg-transparent py-1.5 text-[15px] text-primary-600 outline-none transition-all focus:border-primary-400 appearance-none cursor-pointer"
                      >
                        <option value="">연도</option>
                        {Array.from({ length: new Date().getFullYear() - 1979 }, (_, i) => new Date().getFullYear() - i).map(y => (
                          <option key={y} value={String(y)}>{y}년</option>
                        ))}
                      </select>
                      <select
                        value={endDate && endDate.split('-')[1] ? endDate.split('-')[1] : ''}
                        onChange={e => {
                          const m = e.target.value;
                          const y = endDate ? (endDate.split('-')[0] || '') : '';
                          setEndDate(y && m ? `${y}-${m}` : y);
                        }}
                        className="flex-1 border-0 border-b-2 border-surface-200 bg-transparent py-1.5 text-[15px] text-primary-600 outline-none transition-all focus:border-primary-400 appearance-none cursor-pointer"
                      >
                        <option value="">월</option>
                        {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                          <option key={m} value={m}>{i + 1}월</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isOngoing}
                    onChange={e => { setIsOngoing(e.target.checked); if (e.target.checked) setEndDate(''); }}
                    className="w-3.5 h-3.5 rounded accent-primary-500"
                  />
                  <span className="text-[11px] text-bluewood-400">현재 진행 중인 프로젝트</span>
                </label>
              </div>
            </div>

            {/* 03 직군 선택 */}
            <div className="grid md:grid-cols-[200px_1fr] gap-2 py-6">
              <div className="flex items-start gap-2 pt-0.5">
                <span className="text-[15px] font-bold text-bluewood-200 tabular-nums mt-0.5">03</span>
                <div>
                  <p className="text-[11px] font-semibold text-bluewood-700">직군 선택 <span className="text-red-400">*</span></p>
                  <p className="text-[11px] text-bluewood-300 mt-0.5">1개 선택</p>
                </div>
              </div>
              <div>
                {JOB_CATEGORIES.map((group, gi) => (
                  <div key={group.group} className={gi > 0 ? 'mt-7' : ''}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.20em] text-bluewood-200 pb-2 border-b border-surface-100 mb-1">{group.group}</p>
                    <div className="divide-y divide-surface-50">
                      {group.items.map(opt => {
                        const selected = jobCategory === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setJobCategory(selected ? '' : opt.value)}
                            className={`w-full flex items-center gap-2 py-1.5 text-left transition-all group ${
                              selected ? '' : ''
                            }`}
                          >
                            <div className={`w-[14px] h-[14px] rounded-full border-2 flex-shrink-0 transition-all flex items-center justify-center ${
                              selected ? 'border-primary-600 bg-primary-600' : 'border-surface-300 group-hover:border-bluewood-400'
                            }`}>
                              {selected && <div className="w-[7px] h-[7px] rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`block text-[13px] font-semibold leading-tight ${selected ? 'text-primary-600' : 'text-bluewood-600 group-hover:text-bluewood-800'}`}>{opt.label}</span>
                              <span className={`block text-[11px] mt-0.5 leading-snug ${selected ? 'text-bluewood-400' : 'text-bluewood-300'}`}>{opt.description}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 개발자 전용 분기 안내 */}
            {isDevTrack && (
              <div className="py-5">
                <div className="rounded-2xl border border-sky-200 bg-sky-50/60 px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Github size={15} className="text-sky-600" />
                    <span className="text-[13px] font-extrabold text-sky-800">개발자 포트폴리오 모드</span>
                  </div>
                  <p className="text-[12px] text-bluewood-600 leading-relaxed">
                    다음 단계에서 <strong className="text-sky-700">GitHub 리포지토리</strong>를 연결하면 AI가 커밋을 분석해
                    <strong className="text-sky-700"> 기술 스택·시스템 아키텍처·트러블슈팅</strong> 초안을 자동으로 만들어 줍니다.
                    완성 후엔 채용 담당자 관점의 <strong className="text-sky-700">완성도 진단 점수</strong>까지 받아볼 수 있어요.
                  </p>
                </div>
              </div>
            )}

          </div>{/* end divide-y */}

          {/* 하단 액션 */}
          <div className="mt-6 flex items-center justify-between border-t border-surface-100 pt-6">
            <p className="text-[11px] text-bluewood-300">
              {[title.trim() && '프로젝트명', startDate && '기간', jobCategory && '직군'].filter(Boolean).join(' · ') || '필수 항목을 입력해주세요'}
              {canNext1 && <span className="ml-2 text-primary-400 font-medium">✓ 모두 입력됨</span>}
            </p>
            <button
              data-tour="create-to-data"
              onClick={createTutorialVisible && tutorialCurrentStep === 1 ? () => { moveTutorialToDataStep(); tutorialRef.current?.next(); } : () => setStep(2)}
              disabled={createTutorialVisible && tutorialCurrentStep === 1 ? false : !canNext1}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-2 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              자료 수집으로
              <ChevronRight size={11} />
            </button>
          </div>
        </div>
      )}

      {/* ===== Step 2: 자료 수집 ===== */}
      {step === 2 && (
        <div>
          {/* 헤더 */}
          <div className="mb-7 rounded-2xl border border-primary-100 bg-white px-5 py-5 shadow-sm">
            <p className="text-[13px] font-black uppercase tracking-[0.22em] text-primary-500 mb-2">Data Collection · Step 2 of 3</p>
            <h1 className="text-[24px] font-black tracking-[-0.02em] text-bluewood-950 leading-tight">자료 수집</h1>
            <p className="mt-2 text-[13px] text-bluewood-500 leading-relaxed">
              파일, 링크, 텍스트 중 하나 이상을 추가하면 AI가 핵심 경험을 추출하고 다음 단계에서 직접 검토·수정할 수 있습니다.
            </p>
          </div>

          <input ref={fileInputRef} type="file" accept={ACCEPT_FILES} multiple onChange={handleFileAdd} className="hidden" />

          {/* 폼 테이블 */}
          <div className="space-y-5">

            {/* ★ 개발자 우선: GitHub 연동 */}
            {isDevTrack && (
              <div className="grid gap-5 rounded-2xl border border-sky-300 border-l-4 border-l-sky-600 bg-sky-50/40 p-5 shadow-sm md:grid-cols-[200px_1fr]">
                <div className="flex items-start gap-3 pt-0.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm">
                    <Github size={15} />
                  </span>
                  <div>
                    <p className="text-[14px] font-extrabold text-bluewood-950">GitHub 연동 <span className="text-[10px] font-bold text-sky-600 align-middle">추천</span></p>
                    <p className="text-[12px] text-bluewood-500 mt-1">커밋 자동 분석 → 초안 생성</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2.5 transition-all focus-within:border-sky-400 focus-within:ring-4 focus-within:ring-sky-100">
                    <Github size={13} className="text-sky-500 flex-shrink-0" />
                    <input
                      type="url"
                      value={githubUrl}
                      onChange={e => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/user/repo"
                      className="flex-1 bg-transparent text-[14px] text-bluewood-900 outline-none placeholder:text-bluewood-400"
                    />
                  </div>
                  {githubUrl.trim() && (
                    <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 transition-all focus-within:border-sky-300 focus-within:ring-4 focus-within:ring-sky-100">
                      <span className="text-[12px] font-bold text-sky-500">@</span>
                      <input
                        type="text"
                        value={githubUsername}
                        onChange={e => setGithubUsername(e.target.value)}
                        placeholder="내 GitHub 아이디 (내 커밋만 분석)"
                        className="flex-1 bg-transparent text-[12px] text-bluewood-800 outline-none placeholder:text-bluewood-400"
                      />
                    </div>
                  )}
                  <p className="text-[12px] text-bluewood-500 leading-relaxed">
                    아이디를 입력하면 <strong className="text-sky-700">내 커밋만</strong> 골라 문제정의·코드변경·트러블슈팅·기술스택을 추출합니다. 공개 리포지토리만 가져올 수 있어요.
                  </p>
                </div>
              </div>
            )}

            {/* 01 파일 업로드 */}
            <div className="grid gap-5 rounded-2xl border border-primary-100 border-l-4 border-l-primary-600 bg-white p-5 shadow-sm md:grid-cols-[200px_1fr]">
              <div className="flex items-start gap-3 pt-0.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-[12px] font-black text-white tabular-nums shadow-sm">01</span>
                <div>
                  <p className="text-[14px] font-extrabold text-bluewood-950">파일 첨부</p>
                  <p className="text-[12px] text-bluewood-500 mt-1">PDF · 이미지 · 최대 10개</p>
                </div>
              </div>
              <div>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full rounded-xl border-2 border-dashed px-5 py-7 flex flex-col items-center gap-1.5 cursor-pointer transition-all select-none ${
                    isDragging
                      ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-inner'
                      : 'border-primary-200 bg-primary-50/30 text-bluewood-600 hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50/70'
                  }`}
                >
                  <p className="text-[13px] font-bold">클릭하거나 파일을 여기에 끌어오세요</p>
                  <p className="text-[12px] text-bluewood-400">PDF, JPG, PNG, WEBP · 최대 25MB · HWP는 PDF 변환 후 업로드</p>
                </div>
                {files.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-primary-100 bg-primary-50/30 px-3 py-2">
                        <CheckCircle2 size={10} className="text-emerald-400 flex-shrink-0" />
                        <p className="flex-1 text-[12px] font-semibold text-bluewood-800 truncate">{f.name}</p>
                        <span className="text-[11px] text-bluewood-500">{(f.size / 1024).toFixed(0)} KB</span>
                        <button onClick={() => removeFile(i)} className="p-1 text-bluewood-200 hover:text-red-400 transition-colors flex-shrink-0">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 02 직접 입력 */}
            <div className="grid gap-5 rounded-2xl border border-primary-100 border-l-4 border-l-primary-600 bg-white p-5 shadow-sm md:grid-cols-[200px_1fr]">
              <div className="flex items-start gap-3 pt-0.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-[12px] font-black text-white tabular-nums shadow-sm">02</span>
                <div>
                  <p className="text-[14px] font-extrabold text-bluewood-950">직접 입력</p>
                  <p className="text-[12px] text-bluewood-500 mt-1">자유 형식 텍스트</p>
                </div>
              </div>
              <div>
                <textarea
                  data-tour="create-text-input"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder={`프로젝트나 경험에 대해 자유롭게 작성해주세요.\n\n예) 어떤 문제를 해결했나요? 내가 맡은 역할은? 어떤 성과가 있었나요?`}
                  rows={5}
                  className="w-full resize-none rounded-xl border border-primary-100 bg-primary-50/30 px-4 py-3 text-[15px] leading-relaxed text-bluewood-900 outline-none transition-all placeholder:text-bluewood-400 focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100"
                />
                {textInput && (
                  <p className="text-[11px] text-bluewood-500 text-right mt-1">{textInput.length}자</p>
                )}
              </div>
            </div>

            {/* 03 링크 */}
            <div className="grid gap-5 rounded-2xl border border-primary-100 border-l-4 border-l-primary-600 bg-white p-5 shadow-sm md:grid-cols-[200px_1fr]">
              <div className="flex items-start gap-3 pt-0.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-[12px] font-black text-white tabular-nums shadow-sm">03</span>
                <div>
                  <p className="text-[14px] font-extrabold text-bluewood-950">링크 연결</p>
                  <p className="text-[12px] text-bluewood-500 mt-1">Notion · GitHub · 블로그</p>
                </div>
              </div>
              <div className="space-y-4">
                {/* Notion */}
                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.14em] text-primary-600 mb-1.5">Notion</p>
                  <div className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50/30 px-3 py-2.5 transition-all focus-within:border-primary-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-100">
                    <Globe size={13} className="text-primary-500 flex-shrink-0" />
                    <input
                      type="url"
                      value={notionUrl}
                      onChange={e => setNotionUrl(e.target.value)}
                      placeholder="https://notion.so/..."
                      className="flex-1 bg-transparent text-[14px] text-bluewood-900 outline-none placeholder:text-bluewood-400"
                    />
                  </div>
                </div>
                {/* GitHub — 개발자 트랙은 상단 우선 카드로 분리되어 여기선 숨김 */}
                {!isDevTrack && (
                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.14em] text-primary-600 mb-1.5">GitHub</p>
                  <div className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50/30 px-3 py-2.5 transition-all focus-within:border-primary-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-100">
                    <Github size={13} className="text-primary-500 flex-shrink-0" />
                    <input
                      type="url"
                      value={githubUrl}
                      onChange={e => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/user/repo"
                      className="flex-1 bg-transparent text-[14px] text-bluewood-900 outline-none placeholder:text-bluewood-400"
                    />
                  </div>
                  {githubUrl.trim() && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary-100 bg-white px-3 py-2 transition-all focus-within:border-primary-300 focus-within:ring-4 focus-within:ring-primary-100">
                      <span className="text-[12px] font-bold text-primary-500">@</span>
                      <input
                        type="text"
                        value={githubUsername}
                        onChange={e => setGithubUsername(e.target.value)}
                        placeholder="내 GitHub 아이디 (커밋 필터용)"
                        className="flex-1 bg-transparent text-[12px] text-bluewood-800 outline-none placeholder:text-bluewood-400"
                      />
                    </div>
                  )}
                </div>
                )}
                {/* 블로그 */}
                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.14em] text-primary-600 mb-1.5">블로그 / 기타</p>
                  <div className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50/30 px-3 py-2.5 transition-all focus-within:border-primary-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-100">
                    <Globe size={13} className="text-primary-500 flex-shrink-0" />
                    <input
                      type="url"
                      value={blogUrl}
                      onChange={e => setBlogUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 bg-transparent text-[14px] text-bluewood-900 outline-none placeholder:text-bluewood-400"
                    />
                  </div>
                </div>
                {/* 추가 링크 */}
                {linkInputs.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50/30 px-3 py-2.5 transition-all focus-within:border-primary-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-100">
                    <Link2 size={13} className="text-primary-500 flex-shrink-0" />
                    <input
                      type="url"
                      value={link}
                      onChange={e => updateLink(i, e.target.value)}
                      placeholder="추가 링크 URL"
                      className="flex-1 bg-transparent text-[14px] text-bluewood-900 outline-none placeholder:text-bluewood-400"
                    />
                    <button onClick={() => removeLink(i)} className="text-bluewood-300 transition-colors hover:text-red-400">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addLinkInput}
                  className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-primary-100 bg-white px-3 py-1.5 text-[12px] font-bold text-primary-600 transition-colors hover:border-primary-300 hover:bg-primary-50"
                >
                  <Plus size={12} /> 링크 추가
                </button>
                <p className="text-[12px] text-bluewood-500">공개된 페이지·리포지토리만 가져올 수 있습니다.</p>
              </div>
            </div>

          </div>{/* end divide-y */}

          {/* 수집 현황 + 안내 */}
          {hasInput && (
            <div className="mt-6 flex items-start gap-2 rounded-2xl border border-primary-100 bg-primary-50/40 px-4 py-3">
              <div className="flex flex-wrap gap-2 flex-1">
                {files.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-bluewood-700 shadow-sm"><CheckCircle2 size={11} className="text-emerald-500" /> 파일 {files.length}개</span>}
                {textInput.trim() && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-bluewood-700 shadow-sm"><CheckCircle2 size={11} className="text-emerald-500" /> 텍스트</span>}
                {notionUrl.trim() && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-bluewood-700 shadow-sm"><CheckCircle2 size={11} className="text-emerald-500" /> Notion</span>}
                {githubUrl.trim() && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-bluewood-700 shadow-sm"><CheckCircle2 size={11} className="text-emerald-500" /> GitHub</span>}
                {blogUrl.trim() && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-bluewood-700 shadow-sm"><CheckCircle2 size={11} className="text-emerald-500" /> 블로그</span>}
                {linkInputs.filter(l => l.trim()).length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-bluewood-700 shadow-sm"><CheckCircle2 size={11} className="text-emerald-500" /> 추가 링크 {linkInputs.filter(l => l.trim()).length}개</span>}
              </div>
              <p className="text-[11px] text-bluewood-500 leading-relaxed text-right flex-shrink-0">자료량에 따라 최대 5분 소요<br/>분석 중 페이지 이탈 금지</p>
            </div>
          )}

          {/* 하단 액션 */}
          <div className="mt-6 flex items-center justify-between border-t border-surface-100 pt-6">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 text-[11px] text-bluewood-400 hover:text-bluewood-700 transition-colors"
            >
              <ChevronLeft size={10} /> 기본 정보로
            </button>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-bluewood-300">AI는 입력 자료만으로 정리합니다</p>
              <button
                data-tour="create-extract"
                onClick={createTutorialVisible && tutorialCurrentStep === 3 ? runTutorialExtraction : handleSubmit}
                disabled={!hasInput}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-2 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-30"
              >
                AI 경험 추출
                <ChevronRight size={11} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
