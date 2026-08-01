import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Plus, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useExperienceStore from '../../stores/experienceStore';

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
const uniq = (arr) => [...new Set(arr)];

// 1단계 기업 공고 분석에서 빈 섹션 채우기에 쓸 맞춤 제안을 추출
function deriveJobContext(analysis) {
  if (!analysis) return null;
  const company = toText(analysis.company);
  const position = toText(analysis.position);
  const skills = uniq([
    ...(analysis.skills || []).map(toText),
    ...((analysis.positionAnalysis?.keyCompetencies) || []).map(c => toText(c?.name ?? c)),
  ].filter(Boolean)).slice(0, 8);
  const values = uniq((analysis.coreValues || []).map(toText).filter(Boolean)).slice(0, 8);
  if (!company && !position && !skills.length && !values.length) return null;
  return { company, position, skills, values };
}

// 경험정리에서 정리해 둔 역량/성향/키워드를 추출 (이미 작성된 정보로 채우기 편하게)
function deriveExperienceContext(experiences) {
  if (!Array.isArray(experiences) || !experiences.length) return { skills: [], values: [] };
  const skills = uniq(experiences.flatMap(e => [
    ...(e.competencyTags || e.structuredResult?.competencyTags || []),
    ...(e.keywords || e.structuredResult?.keywords || []),
  ]).map(toText).filter(Boolean)).slice(0, 10);
  const values = uniq(experiences.flatMap(e =>
    (e.workStyleTags || e.structuredResult?.workStyleTags || [])
  ).map(toText).filter(Boolean)).slice(0, 10);
  return { skills, values };
}

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

// ── 추천 키워드(원클릭 추가) ──
function SuggestRow({ label, suggestions, items, onAdd }) {
  const remaining = (suggestions || []).filter(s => s && !items.includes(s));
  if (!remaining.length) return null;
  return (
    <div className="mt-2.5">
      <p className="text-[11px] font-bold text-bluewood-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {remaining.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onAdd(s)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-primary-300 text-primary-600 text-[12px] font-medium hover:bg-primary-50 hover:border-primary-400 transition-colors"
          >
            <Plus size={11} /> {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function BoostSection({ title, desc, tailored, children }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-5 text-left transition-colors hover:border-surface-300">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1 h-4 bg-primary-500 rounded-full shrink-0" />
        <h3 className="font-bold text-[15px] text-bluewood-800">{title}</h3>
        {tailored && (
          <span className="px-1.5 py-0.5 rounded-md bg-primary-50 text-primary-600 text-[10.5px] font-bold border border-primary-100">맞춤 추천</span>
        )}
      </div>
      {desc && <p className="text-[12px] text-bluewood-400 mb-3 ml-3 leading-relaxed">{desc}</p>}
      <div className={desc ? '' : 'mt-3'}>{children}</div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-surface-200 rounded-lg text-[13px] outline-none focus:border-primary-400 transition-colors bg-white';

/**
 * 새 포트폴리오 마법사 3단계: 빈 섹션 채우기 (페이지).
 * 비어있는 항목을 사용자가 직접 채운다. 1단계에서 연결한 기업 공고와
 * 이미 작성한 경험정리에서 역량/가치/키워드를 추천으로 제안해 채우기를 돕는다.
 * 입력값은 부모가 기존 profile과 병합 저장한다.
 */
export default function ProfileBoostStep({
  profile, jobAnalysis, submitting, onBack, onSkip, onSubmit,
  recommendations, selectedExperienceIds, onSelectedExperienceIdsChange,
}) {
  const experiences = useExperienceStore(s => s.experiences);
  const fetchExperiences = useExperienceStore(s => s.fetchExperiences);
  const generateBoostDraft = useExperienceStore(s => s.generateBoostDraft);
  const [drafting, setDrafting] = useState(false);
  useEffect(() => {
    if (!experiences.length) fetchExperiences();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 추천은 이전 단계에서 미리 받아둔 것을 쓴다. 추천 여부는 표시·기본 체크에만 쓰고, 목록은 전체 경험을 보여준다.
  const recList = recommendations || [];
  const recIdSet = new Set(recList.map(r => r.experience?.id).filter(Boolean));
  const reasonById = new Map(recList.map(r => [r.experience?.id, r.reason]).filter(([id]) => id));
  // 추천된 경험을 위로 올리되, 추천 순서를 그대로 유지한다.
  const recOrder = new Map(recList.map((r, i) => [r.experience?.id, i]));
  const pickableExperiences = [...experiences].sort((a, b) => {
    const ra = recOrder.has(a.id) ? recOrder.get(a.id) : Number.MAX_SAFE_INTEGER;
    const rb = recOrder.has(b.id) ? recOrder.get(b.id) : Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });

  const selectedIds = selectedExperienceIds || [];
  const toggleExp = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    onSelectedExperienceIdsChange?.(next);
  };

  const job = deriveJobContext(jobAnalysis);
  const exp = deriveExperienceContext(experiences);
  const company = job?.company || '';
  const position = job?.position || '';

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

  const addUnique = (list, setList, v) => { if (!list.includes(v)) setList([...list, v]); };

  const essayKeywords = uniq([...(job?.skills || []), ...exp.skills]).slice(0, 5);
  const essayPlaceholder = position
    ? `예: ${position} 직무에서 ○○ 문제를 어떻게 풀어왔는지 2~3문장으로 ...`
    : '예: 데이터로 전환율을 높이는 그로스 마케터입니다. ...';
  const goalPlaceholder = company
    ? `예: ${company}에서 ○○ 역량으로 기여하기`
    : '예: 1년 내 PM으로 성장';

  const canDraft = experiences.length > 0 || !!job;

  // AI가 경험정리+프로필+공고로 비어있는 섹션 초안을 생성한다.
  // 비어있는(화면에 보이는) 섹션만 채우고, 사용자가 이미 입력한 값은 덮어쓰지 않는다.
  const applyDraft = async () => {
    if (drafting) return;
    setDrafting(true);
    try {
      const d = await generateBoostDraft({ profile, jobAnalysis });
      let filled = 0;
      const draftSkills = (d.skills || []).map(toText).filter(Boolean);
      const draftValues = (d.values || []).map(toText).filter(Boolean);
      const draftGoals = (d.goals || []).map(toText).filter(Boolean);
      if (showSkills && draftSkills.length) { setSkills(prev => uniq([...prev, ...draftSkills])); filled++; }
      if (showValues && draftValues.length) { setValues(prev => uniq([...prev, ...draftValues])); filled++; }
      if (showEssay && d.valuesEssay && isEmptyStr(valuesEssay)) { setValuesEssay(d.valuesEssay); filled++; }
      if (showGoals && draftGoals.length && goals.every(g => !g.title?.trim())) { setGoals(draftGoals.map(t => ({ title: t }))); filled++; }
      if (showExtra && d.extracurricular && isEmptyStr(extraSummary)) { setExtraSummary(d.extracurricular); filled++; }
      if (filled) toast.success('내 정보로 초안을 채웠어요. 자유롭게 수정하세요');
      else toast('채울 수 있는 정보가 부족해요. 경험정리를 먼저 작성해보세요');
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) toast.error('AI 사용량 한도를 초과했어요. 잠시 후 다시 시도해주세요');
      else if (status === 402) toast.error('크레딧이 부족합니다');
      else toast.error('초안 생성에 실패했어요. 잠시 후 다시 시도해주세요');
    } finally {
      setDrafting(false);
    }
  };

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
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bluewood-400 hover:text-primary-600 mb-4 transition-colors">
        <ArrowLeft size={14} /> 템플릿 다시 선택
      </button>
      <h1 className="text-[28px] font-bold text-primary-600 tracking-[-0.02em] mb-1">빈 섹션 채우기</h1>
      <p className="text-[15px] text-bluewood-400 mb-5">
        포트폴리오에 들어가지만 아직 비어있는 항목이에요. 전부 선택이며, 적은 내용은 <b>이 포트폴리오에만 적용</b>됩니다. 기업마다 강조할 내용이 다르므로 내 정보에는 저장되지 않아요.
      </p>

      {/* 포트폴리오에 넣을 경험 고르기 — 전체 목록을 보여주고 추천된 것만 기본 체크 */}
      {pickableExperiences.length > 0 && (
        <div className="rounded-2xl border border-surface-200 bg-white p-4 mb-5">
          <p className="text-[14px] font-bold text-bluewood-900">포트폴리오에 넣을 경험</p>
          <p className="text-[12px] text-bluewood-500 mt-0.5">
            {jobAnalysis
              ? '공고와 맞는 경험을 미리 체크해뒀어요. 추천이 아닌 경험도 자유롭게 고를 수 있습니다.'
              : '포트폴리오에 넣을 경험을 골라주세요.'}
          </p>

          <div className="mt-3 space-y-2">
            {pickableExperiences.map(exp => {
              const checked = selectedIds.includes(exp.id);
              const isRec = recIdSet.has(exp.id);
              const reason = reasonById.get(exp.id);
              return (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => toggleExp(exp.id)}
                  aria-pressed={checked}
                  className={`flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                    checked ? 'border-primary-300 bg-primary-50' : 'border-surface-200 bg-white hover:bg-surface-50'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex flex-shrink-0 items-center justify-center rounded border text-white ${
                      checked ? 'border-primary-600 bg-primary-600' : 'border-surface-300 bg-white'
                    }`}
                    style={{ width: 18, height: 18 }}
                  >
                    {checked && <span className="text-[11px] font-bold leading-none">✓</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13.5px] font-bold text-bluewood-900">
                        {toText(exp.title) || '제목 없음'}
                      </span>
                      {isRec && (
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10.5px] font-bold text-primary-700">
                          공고 추천
                        </span>
                      )}
                    </span>
                    {isRec && reason && (
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
                        {toText(reason)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-right text-[12px] font-semibold text-primary-700">
            {selectedIds.length}개 선택됨
          </p>
        </div>
      )}

      {/* 맞춤 안내 배너 — 공고 + 내 경험 기반 추천 */}
      {(job || canDraft) && (
        <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-4 mb-5">
          <p className="text-[13.5px] font-bold text-primary-700">
            {job
              ? `${company || '연결한 기업'}${position ? ` · ${position}` : ''} 맞춤으로 채우기`
              : '이미 정리한 경험으로 채우기'}
          </p>
          <p className="text-[12px] text-bluewood-500 mt-1 leading-relaxed">
            {job ? '1단계 공고 분석과 ' : ''}경험정리·내 정보에서 채울 수 있는 항목을 아래 추천으로 제안해드려요. 아래 버튼으로 비어있는 섹션을 한 번에 채울 수도 있어요.
          </p>
          {canDraft && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={applyDraft}
                disabled={drafting || submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-[13px] font-bold hover:bg-primary-700 disabled:opacity-60 transition-colors shadow-sm shadow-primary-200"
              >
                {drafting ? <><Loader2 size={14} className="animate-spin" /> 초안 작성 중...</> : '내 정보로 초안 자동 작성'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {showEssay && (
          <BoostSection title="자기소개" desc="포트폴리오 상단 소개 영역을 채웁니다. 어떤 문제를 어떻게 풀어왔는지 2~3문장이면 충분해요." tailored={!!job}>
            <textarea value={valuesEssay} onChange={e => setValuesEssay(e.target.value)} rows={3}
              placeholder={essayPlaceholder} className={inputCls} />
            {(position || job?.values.length > 0 || essayKeywords.length > 0) && (
              <div className="mt-2.5 text-[12px] text-bluewood-500 bg-surface-50 rounded-lg px-3 py-2.5 leading-relaxed space-y-1">
                {position && <p>지원 직무는 <b className="text-bluewood-700">{position}</b>예요.</p>}
                {essayKeywords.length > 0 && <p>내 강점 키워드: <b className="text-bluewood-700">{essayKeywords.join(' · ')}</b></p>}
                {job?.values.length > 0 && <p>기업이 중시하는 가치: <b className="text-bluewood-700">{job.values.slice(0, 3).join(' · ')}</b></p>}
              </div>
            )}
          </BoostSection>
        )}

        {showSkills && (
          <BoostSection title="스킬 / 핵심 역량" desc="Enter 또는 쉼표로 추가. 템플릿 상단 역량 칩과 Skills 섹션에 쓰입니다." tailored={!!(job?.skills.length || exp.skills.length)}>
            <ChipInput items={skills} onChange={setSkills} placeholder="Figma, Python, React ..." />
            <SuggestRow label="공고에서 요구하는 역량" suggestions={job?.skills} items={skills} onAdd={v => addUnique(skills, setSkills, v)} />
            <SuggestRow label="내 경험에서 정리한 역량" suggestions={exp.skills} items={skills} onAdd={v => addUnique(skills, setSkills, v)} />
          </BoostSection>
        )}

        {showValues && (
          <BoostSection title="가치관 키워드" desc="나를 표현하는 핵심 가치를 키워드로." tailored={!!(job?.values.length || exp.values.length)}>
            <ChipInput items={values} onChange={setValues} placeholder="성장, 협업, 데이터 기반 ..." />
            <SuggestRow label="기업 핵심 가치" suggestions={job?.values} items={values} onAdd={v => addUnique(values, setValues, v)} />
            <SuggestRow label="내 경험에서 드러난 성향" suggestions={exp.values} items={values} onAdd={v => addUnique(values, setValues, v)} />
          </BoostSection>
        )}

        {showAwards && (
          <BoostSection title="수상 / 자격" desc="공모전, 자격증 등.">
            <div className="space-y-2">
              {awards.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={a.date || ''} onChange={e => setAwards(awards.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} placeholder="2023.11" className={`${inputCls.replace('w-full', '')} w-20 shrink-0`} />
                  <input value={a.title || ''} onChange={e => setAwards(awards.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="○○ 공모전 대상" className={`${inputCls} flex-1`} />
                  {awards.length > 1 && <button type="button" onClick={() => setAwards(awards.filter((_, j) => j !== i))} className="p-1.5 text-bluewood-300 hover:text-red-500 shrink-0"><X size={15} /></button>}
                </div>
              ))}
              <button type="button" onClick={() => setAwards([...awards, { date: '', title: '' }])} className="flex items-center gap-1.5 text-[12px] text-bluewood-400 hover:text-primary-600 transition-colors"><Plus size={12} /> 수상 추가</button>
            </div>
          </BoostSection>
        )}

        {showGoals && (
          <BoostSection title="목표와 계획" desc={company ? `${company} 지원과 연결한 방향성을 적어보세요.` : '앞으로의 방향성.'}>
            <div className="space-y-2">
              {goals.map((g, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={g.title || ''} onChange={e => setGoals(goals.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder={goalPlaceholder} className={inputCls} />
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
