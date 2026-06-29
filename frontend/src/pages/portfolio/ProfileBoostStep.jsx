import { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, X, Loader2 } from 'lucide-react';

const isEmptyArr = (a) => !Array.isArray(a) || a.length === 0;
const isEmptyStr = (s) => !(s || '').trim();
// 어떤 형태(문자열·숫자·{value|keyword|name|...} 객체)가 와도 항상 문자열을 반환
const toText = (s) => {
  if (typeof s === 'string') return s.trim();
  if (typeof s === 'number') return String(s);
  if (s && typeof s === 'object') {
    const v = s.value ?? s.keyword ?? s.name ?? s.label ?? s.skill ?? s.text ?? s.title;
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
};

// 프로필에 비어있는(포트폴리오에 들어가는) 항목이 하나라도 있는지
export function hasEmptyProfileFields(profile) {
  return (
    isEmptyStr(profile?.valuesEssay) ||
    (isEmptyArr(profile?.tools) && isEmptyArr(profile?.programmingLanguages) && isEmptyArr(profile?.frameworks)) ||
    isEmptyArr(profile?.awards) ||
    isEmptyArr(profile?.goals) ||
    isEmptyArr(profile?.values) ||
    isEmptyStr(profile?.extracurricular?.summary) ||
    !['github', 'linkedin', 'website', 'instagram'].some(k => !isEmptyStr(profile?.contact?.[k]))
  );
}

// ── 키워드 칩 입력 ──
function ChipInput({ items, onChange, placeholder }) {
  const [val, setVal] = useState('');
  const add = () => {
    const t = val.trim();
    if (t && !items.includes(t)) onChange([...items, t]);
    setVal('');
  };
  return (
    <div className="flex flex-wrap gap-1.5 items-center border border-surface-200 rounded-lg px-2 py-2 bg-white focus-within:border-primary-400 transition-colors">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-md text-[13px] font-medium">
          {it}
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="hover:text-primary-900"><X size={12} /></button>
        </span>
      ))}
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={items.length ? '' : placeholder}
        className="flex-1 min-w-[140px] outline-none text-[13px] py-0.5 bg-transparent"
      />
    </div>
  );
}

function BoostSection({ title, desc, children }) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-5 text-left">
      <h3 className="font-bold text-[15px] text-bluewood-800 mb-0.5">{title}</h3>
      {desc && <p className="text-[12px] text-bluewood-400 mb-3">{desc}</p>}
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-surface-200 rounded-lg text-[13px] outline-none focus:border-primary-400 transition-colors bg-white';

/**
 * 새 포트폴리오 마법사 3단계: 빈 섹션 채우기 (페이지).
 * 비어있는 항목을 사용자가 직접 채운다. 입력값은 부모가 기존 profile과 병합 저장한다.
 */
export default function ProfileBoostStep({ profile, submitting, onBack, onSkip, onSubmit }) {
  const showEssay = isEmptyStr(profile?.valuesEssay);
  const showSkills = isEmptyArr(profile?.tools) && isEmptyArr(profile?.programmingLanguages) && isEmptyArr(profile?.frameworks);
  const showAwards = isEmptyArr(profile?.awards);
  const showGoals = isEmptyArr(profile?.goals);
  const showValues = isEmptyArr(profile?.values);
  const showExtra = isEmptyStr(profile?.extracurricular?.summary);
  const showContact = !['github', 'linkedin', 'website', 'instagram'].some(k => !isEmptyStr(profile?.contact?.[k]));

  const [valuesEssay, setValuesEssay] = useState(profile?.valuesEssay || '');
  const [skills, setSkills] = useState([]);
  const [values, setValues] = useState((profile?.values || []).map(toText).filter(Boolean));
  const [awards, setAwards] = useState(profile?.awards?.length ? profile.awards : [{ date: '', title: '' }]);
  const [goals, setGoals] = useState(profile?.goals?.length ? profile.goals : [{ title: '' }]);
  const [extraSummary, setExtraSummary] = useState(profile?.extracurricular?.summary || '');
  const [contact, setContact] = useState({
    github: profile?.contact?.github || '',
    website: profile?.contact?.website || '',
    linkedin: profile?.contact?.linkedin || '',
    instagram: profile?.contact?.instagram || '',
  });

  const handleSubmit = () => {
    onSubmit({
      valuesEssay,
      tools: skills,
      values: values.filter(Boolean).map(k => ({ keyword: k })),
      awards: awards.filter(a => a.title?.trim() || a.date?.trim()),
      goals: goals.filter(g => g.title?.trim()),
      extracurricular: { ...(profile?.extracurricular || {}), summary: extraSummary },
      contact: { ...(profile?.contact || {}), ...contact },
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 text-center">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bluewood-400 hover:text-primary-600 mb-4 transition-colors">
          <ArrowLeft size={14} /> 템플릿 다시 선택
        </button>
        <h1 className="text-[28px] font-bold text-primary-600 tracking-[-0.02em] mb-1">빈 섹션 채우기</h1>
        <p className="text-[15px] text-bluewood-400">
          포트폴리오에 들어가지만 아직 비어있는 항목이에요. 전부 선택이고, 적은 내용은 <b>포트폴리오와 내 정보 관리에 함께 저장</b>됩니다.
        </p>
      </div>

      <div className="space-y-4">
        {showEssay && (
          <BoostSection title="자기소개" desc="포트폴리오 상단 소개 영역을 채웁니다. 어떤 문제를 어떻게 풀어왔는지 2~3문장이면 충분해요.">
            <textarea value={valuesEssay} onChange={e => setValuesEssay(e.target.value)} rows={3}
              placeholder="예: 데이터로 전환율을 높이는 그로스 마케터입니다. ..." className={inputCls} />
          </BoostSection>
        )}

        {showSkills && (
          <BoostSection title="스킬 / 핵심 역량" desc="Enter 또는 쉼표로 추가. 템플릿 상단 역량 칩과 Skills 섹션에 쓰입니다.">
            <ChipInput items={skills} onChange={setSkills} placeholder="Figma, Python, React ..." />
          </BoostSection>
        )}

        {showValues && (
          <BoostSection title="가치관 키워드" desc="나를 표현하는 핵심 가치를 키워드로.">
            <ChipInput items={values} onChange={setValues} placeholder="성장, 협업, 데이터 기반 ..." />
          </BoostSection>
        )}

        {showAwards && (
          <BoostSection title="수상 / 자격" desc="공모전, 자격증 등.">
            <div className="space-y-2">
              {awards.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={a.date || ''} onChange={e => setAwards(awards.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} placeholder="2023.11" className={`${inputCls} w-28 shrink-0`} />
                  <input value={a.title || ''} onChange={e => setAwards(awards.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="○○ 공모전 대상" className={inputCls} />
                  {awards.length > 1 && <button type="button" onClick={() => setAwards(awards.filter((_, j) => j !== i))} className="p-1.5 text-bluewood-300 hover:text-red-500 shrink-0"><X size={15} /></button>}
                </div>
              ))}
              <button type="button" onClick={() => setAwards([...awards, { date: '', title: '' }])} className="flex items-center gap-1.5 text-[12px] text-bluewood-400 hover:text-primary-600 transition-colors"><Plus size={12} /> 수상 추가</button>
            </div>
          </BoostSection>
        )}

        {showGoals && (
          <BoostSection title="목표와 계획" desc="앞으로의 방향성.">
            <div className="space-y-2">
              {goals.map((g, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={g.title || ''} onChange={e => setGoals(goals.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="예: 1년 내 PM으로 성장" className={inputCls} />
                  {goals.length > 1 && <button type="button" onClick={() => setGoals(goals.filter((_, j) => j !== i))} className="p-1.5 text-bluewood-300 hover:text-red-500 shrink-0"><X size={15} /></button>}
                </div>
              ))}
              <button type="button" onClick={() => setGoals([...goals, { title: '' }])} className="flex items-center gap-1.5 text-[12px] text-bluewood-400 hover:text-primary-600 transition-colors"><Plus size={12} /> 목표 추가</button>
            </div>
          </BoostSection>
        )}

        {showExtra && (
          <BoostSection title="비교과 활동 요약" desc="대외활동·동아리 등.">
            <textarea value={extraSummary} onChange={e => setExtraSummary(e.target.value)} rows={2} placeholder="예: 교내 창업 동아리 회장, 봉사활동 ..." className={inputCls} />
          </BoostSection>
        )}

        {showContact && (
          <BoostSection title="연락처 / 링크" desc="GitHub·블로그·LinkedIn 등.">
            <div className="grid sm:grid-cols-2 gap-2">
              <input value={contact.github} onChange={e => setContact({ ...contact, github: e.target.value })} placeholder="GitHub URL" className={inputCls} />
              <input value={contact.website} onChange={e => setContact({ ...contact, website: e.target.value })} placeholder="블로그/웹사이트" className={inputCls} />
              <input value={contact.linkedin} onChange={e => setContact({ ...contact, linkedin: e.target.value })} placeholder="LinkedIn" className={inputCls} />
              <input value={contact.instagram} onChange={e => setContact({ ...contact, instagram: e.target.value })} placeholder="Instagram" className={inputCls} />
            </div>
          </BoostSection>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="sticky bottom-6 mt-6 flex gap-3">
        <button onClick={onSkip} disabled={submitting}
          className="px-6 py-4 bg-white text-bluewood-500 border border-surface-200 rounded-xl text-[15px] font-bold hover:border-bluewood-300 disabled:opacity-50 transition-colors">
          건너뛰고 만들기
        </button>
        <button onClick={handleSubmit} disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-xl text-[15px] font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-lg shadow-primary-200">
          {submitting ? <><Loader2 size={17} className="animate-spin" /> 생성 중...</> : <><ArrowRight size={17} /> 저장하고 포트폴리오 만들기</>}
        </button>
      </div>
    </div>
  );
}
