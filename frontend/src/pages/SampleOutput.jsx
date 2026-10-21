/**
 * SampleOutput — /sample
 *
 * 인사담당자 피드백("직군별 UVP 애매 · 산출물 디테일 부족 · 너무 완벽해서 사람 냄새 없음")에
 * 대응해 수정한 산출물을 크레딧 소모 없이 확인하는 예시 페이지.
 *
 * ★ 목업이 아니다. 실제 화면과 똑같은 컴포넌트·유틸을 그대로 호출한다.
 *    - JobExperienceCard        직군별 핵심 경험 카드 + 판단 지도 + 솔직 회고
 *    - buildCoreExperienceSections  내보내기·노션·공유에 실리는 텍스트 산출물
 *   따라서 이 화면에서 보이는 것이 곧 실제 결과물이다.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileDown, LayoutGrid, Layers, Presentation } from 'lucide-react';
import JobExperienceCard from '../components/portfolio/JobExperienceCards';
import RecipeArtifactCover from '../components/portfolio/RecipeArtifactCover';
import { getJobPortfolioMeta } from '../utils/devPortfolio';
import { buildCoreExperienceSections } from '../utils/coreExperienceSections';
import { CAREER_STAGES } from '../constants/careerStages';
import { SAMPLE_EXPERIENCES, SAMPLE_JOBS, SAMPLE_PLANS, SAMPLE_VISUALS } from './sampleOutputData';
import SummaryDeckViewer from '../components/summaryDeck/SummaryDeckViewer';
import { collectDeckMaterial, planSummaryDeck } from '../../../shared/summaryDeck.mjs';

const STAGE_LABEL = Object.fromEntries(CAREER_STAGES.map(s => [s.value, s.label]));

/* 이 페이지에서 확인할 수 있는 변경점 — 화면 상단 요약 */
const CHANGES = [
  { tag: '버그', text: '직군 특화 추출(jobData)이 백엔드에서 버려지던 문제 수정 — 6개 직군이 전부 같은 카드로 보이던 원인' },
  { tag: '신규', text: '솔직 회고 — 막혔던 지점 · 예상과 달랐던 점 · 남은 한계 · 다시 한다면' },
  { tag: '신규', text: '판단 지도 · 사용자 말투 보존 · 증거 번들 · 나를 보여주는 한 문장' },
  { tag: '신규', text: '직군별 시그니처 산출물 — 분석 기록 / 실험 기록 / 인시던트 기록 / 프로그램 기록 / 딜 기록' },
  { tag: '신규', text: '경력 단계(첫 취업 · 신입 · 경력 이직)별로 문체와 성과 서술 밀도를 다르게 생성' },
  { tag: '신규', text: '맞춤 구성 파이프라인 — 경험·직군·경력단계·기업분석에 따라 섹션 선택·순서·제목이 매번 달라짐' },
  { tag: '버그', text: '히어로 아티팩트(15종)를 아무도 안 골라 전원 기본 비주얼만 보이던 문제 — 구성 계획이 경험별로 선택' },
  { tag: '신규', text: '데이터 주도 히어로 — 전용 변형이 없는 직군은 시각화 프리미티브 7종을 조합해 경험마다 다른 커버 생성 (톤 5종)' },
  { tag: '신규', text: '경험 요약 슬라이드 — 정리한 원문·수치로만 만드는 16:9 장표(표지·문제 정의·리서치·과정·AS-IS→TO-BE·성과). 데이터가 있는 장만 생성, 포인트 색 선택, PNG·ZIP 저장' },
  { tag: '신규', text: '요약 슬라이드 그래프 — 본문 속 숫자(300명→1,150명 · 9건 중 6건 · 4.6/5 · 설문 84명)를 상승 곡선·도넛·게이지·숫자 타일로 자동 배치. 숫자는 원문 그대로만 사용' },
  { tag: '신규', text: '마케터 캠페인 브리프 — 결과 화면과 요약 슬라이드(Strategy 장)에 누구에게(타깃·고른 근거) · 어디서·왜(채널·선택 이유) · 무엇을(실제 문구) · 목표 대비 성과. 비어 있으면 인터뷰에서 그 칸만 묻는다' },
  { tag: '신규', text: '마케터 세부 분야를 실제 취업 포트폴리오 유형으로 — 퍼포먼스 · 콘텐츠·SNS · 브랜드 · CRM·리텐션 · 그로스·성과 분석 · 공모전·캠페인 기획' },
  { tag: '개선', text: '요약 슬라이드 — 문제 장은 근거 목록형(빈 카드 대신), 성과 장은 결과 자리 숫자만(문제 통계·만든 개수 제외, 목표 점선), 마무리는 판단 변화·다음 검증이 있을 때만' },
  { tag: '버그', text: '"12명 → 31명"처럼 평범하게 쓴 성과 수치가 검증 단계에서 지워지던 문제(PM·마케터 공통)' },
];

export default function SampleOutput() {
  const [job, setJob] = useState('designer');
  const [tab, setTab] = useState('card');
  const [deckEdits, setDeckEdits] = useState({});

  const exp = SAMPLE_EXPERIENCES[job];
  const accent = getJobPortfolioMeta(job).accent;
  const plans = SAMPLE_PLANS[job] || [];
  const sections = buildCoreExperienceSections({ jobCategory: job, sr: {}, keyExperiences: [exp] })
    .filter(s => s.enabled !== false && s.content?.trim());
  // 실제 '경험 요약보기'와 같은 덱 생성기 — AI 다듬기 전 단계(정리한 원문 발췌)를 그대로 보여준다.
  const sampleDeck = useMemo(() => planSummaryDeck(collectDeckMaterial({
    title: exp.title,
    structuredResult: { projectOverview: { role: exp.label }, keyExperiences: [exp], portfolioVisuals: SAMPLE_VISUALS[job] || {} },
  })), [exp, job]);
  const deck = deckEdits[job] || sampleDeck;

  return (
    <div className="min-h-screen bg-surface-50 pb-20">
      <div className="mx-auto max-w-5xl px-5 pt-8">

        <Link to="/" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-bluewood-400 hover:text-bluewood-600">
          <ArrowLeft size={14} /> 홈으로
        </Link>

        <header className="mt-4">
          <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.2em] text-bluewood-300">Sample Output</p>
          <h1 className="mt-1.5 text-[26px] font-black leading-tight text-bluewood-900">개선된 산출물 예시</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-bluewood-500">
            인사담당자 피드백을 반영해 수정한 결과물입니다. 아래 카드와 텍스트는 실제 서비스와
            <strong className="text-bluewood-700"> 동일한 컴포넌트로 렌더</strong>되므로, 보이는 그대로가 사용자가 받는 산출물입니다.
          </p>
        </header>

        <section className="mt-5 rounded-2xl border border-surface-200 bg-white p-5">
          <p className="text-[12px] font-extrabold text-bluewood-800">이 화면에서 확인할 수 있는 변경점</p>
          <ul className="mt-3 space-y-2">
            {CHANGES.map((c, i) => (
              <li key={i} className="flex gap-2.5 text-[12.5px] leading-[1.65] text-bluewood-600">
                <span className={`mt-0.5 h-fit flex-shrink-0 rounded px-1.5 py-0.5 text-[11.5px] font-black ${
                  c.tag === '버그' ? 'bg-rose-50 text-rose-600' : 'bg-caribbean-50 text-caribbean-700'
                }`}>{c.tag}</span>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 직군 전환 — 같은 화면이 직군마다 어떻게 달라지는지가 핵심 */}
        <div className="mt-7">
          <p className="mb-2 text-[12px] font-bold text-bluewood-400">직군을 바꿔 보세요 — 경험의 단위와 카드 구조가 달라집니다</p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_JOBS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setJob(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
                  job === opt.value ? 'bg-primary-600 text-white' : 'bg-white text-bluewood-500 hover:bg-surface-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-surface-200 bg-white px-4 py-3">
          <span className="rounded-md bg-primary-50 px-2 py-1 text-[12px] font-black text-primary-600">
            {STAGE_LABEL[exp.stage] || exp.stage}
          </span>
          <p className="text-[11.5px] leading-snug text-bluewood-400">
            이 예시는 <strong className="text-bluewood-600">{STAGE_LABEL[exp.stage]}</strong> 기준으로 정리된 톤입니다.
            같은 경험도 단계가 바뀌면 성과 서술 밀도와 문체가 달라집니다.
          </p>
        </div>

        {/* 탭 — 화면 카드 / 내보내기 텍스트 */}
        <div className="mt-6 flex gap-1 border-b border-surface-200">
          {[
            { key: 'card', label: '화면에 보이는 카드', icon: LayoutGrid },
            { key: 'export', label: '내보내기 · 노션 산출물', icon: FileDown },
            { key: 'plan', label: '맞춤 구성 계획', icon: Layers },
            { key: 'deck', label: '요약 슬라이드', icon: Presentation },
          ].map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[12.5px] font-bold transition-all ${
                tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-bluewood-400 hover:text-bluewood-600'
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'plan' && (
          <div className="mt-5">
            {plans.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-surface-200 bg-white px-5 py-10 text-center text-[12px] text-bluewood-400">
                이 직군은 아직 구성 계획 예시를 준비하지 않았습니다. 프로덕트 디자이너 탭에서 확인해 주세요.
              </p>
            ) : (
              <>
                <p className="mb-3 text-[12px] leading-relaxed text-bluewood-500">
                  같은 경험이라도 <strong className="text-bluewood-700">지원처가 무엇을 보느냐에 따라 골격·섹션·순서가 달라집니다.</strong>
                  아래 두 계획을 비교해 보세요. 예전에는 모든 경험이 동일한 7섹션 순서로만 조립됐습니다.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  {plans.map(({ target, plan }) => (
                    <section key={target} className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
                      <div className="border-b border-surface-100 bg-surface-50/70 px-4 py-2.5">
                        <p className="text-[12px] font-extrabold text-bluewood-800">{target}</p>
                        <p className="mt-0.5 font-mono text-[11.5px] font-bold" style={{ color: accent }}>
                          {plan.narrative}
                          {plan.artifactVariant && <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 text-bluewood-600">{plan.artifactVariant}</span>}
                        </p>
                      </div>
                      <div className="space-y-3 px-4 py-3.5">
                        <p className="text-[11.5px] leading-relaxed text-bluewood-500">{plan.narrativeReason}</p>
                        {plan.artifactReason && (
                          <p className="text-[12px] leading-relaxed text-bluewood-400">히어로 비주얼 · {plan.artifactReason}</p>
                        )}
                        {plan.artifactRecipe && (
                          <div className="overflow-hidden rounded-xl border border-surface-200">
                            <RecipeArtifactCover recipe={plan.artifactRecipe} visuals={SAMPLE_VISUALS[job]} />
                          </div>
                        )}
                        {plan.headline && (
                          <p className="rounded-lg bg-surface-50 px-3 py-2 text-[12px] font-bold text-bluewood-800">“{plan.headline}”</p>
                        )}
                        <div>
                          <p className="mb-1.5 text-[11.5px] font-bold text-bluewood-400">섹션 구성 · 순서</p>
                          <ol className="space-y-1.5">
                            {plan.sections.map((s, i) => (
                              <li key={s.source} className="text-[11.5px] leading-snug text-bluewood-600">
                                <span className="mr-1.5 font-mono font-black" style={{ color: accent }}>{String(i + 1).padStart(2, '0')}</span>
                                <strong className="text-bluewood-800">{s.title}</strong>
                                {s.emphasis === 'high' && <span className="ml-1 rounded bg-caribbean-50 px-1 text-[9.5px] font-black text-caribbean-700">강조</span>}
                                <span className="ml-1 font-mono text-[11.5px] text-bluewood-300">{s.source}</span>
                                {s.why && <span className="block pl-6 text-[11.5px] text-bluewood-400">{s.why}</span>}
                              </li>
                            ))}
                          </ol>
                        </div>
                        {plan.omitted?.length > 0 && (
                          <div>
                            <p className="mb-1 text-[11.5px] font-bold text-bluewood-400">뺀 항목</p>
                            {plan.omitted.map(o => (
                              <p key={o.source} className="text-[11.5px] leading-snug text-bluewood-400">
                                <span className="font-mono">{o.source}</span> — {o.reason}
                              </p>
                            ))}
                          </div>
                        )}
                        {plan.jdAlignment?.length > 0 && (
                          <div className="border-t border-surface-100 pt-2.5">
                            <p className="mb-1.5 text-[11.5px] font-bold text-bluewood-400">공고 요건 대응 (약점도 정직하게 표시)</p>
                            {plan.jdAlignment.map((a, i) => (
                              <p key={i} className="text-[12px] leading-snug text-bluewood-600">
                                <span className={`mr-1.5 font-black ${
                                  a.strength === 'strong' ? 'text-caribbean-700' : a.strength === 'missing' ? 'text-rose-500' : 'text-amber-600'
                                }`}>
                                  {a.strength === 'strong' ? '충족' : a.strength === 'missing' ? '없음' : '약함'}
                                </span>
                                {a.requirement}
                                {a.note && <span className="text-bluewood-400"> — {a.note}</span>}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
                <p className="mt-4 text-center text-[12px] leading-relaxed text-bluewood-300">
                  실제로는 프로젝트 모달의 <strong className="text-bluewood-500">맞춤 구성</strong> 버튼이
                  <span className="font-mono"> POST /job/compose-experience </span>로 이 계획을 받아 캔버스를 조립합니다.
                </p>
              </>
            )}
          </div>
        )}

        {tab === 'deck' && (
          <div className="mt-5">
            <div className="rounded-2xl bg-[#0b0c0e] p-4">
              <SummaryDeckViewer deck={deck} jobCategory={job} onChange={next => setDeckEdits(prev => ({ ...prev, [job]: next }))} />
            </div>
            <p className="mt-4 text-center text-[12px] leading-relaxed text-bluewood-300">
              결과 화면의 <strong className="text-bluewood-500">경험 요약보기</strong>와 같은 생성기로 만든 장표입니다.
              여기서는 AI 다듬기 전 단계(정리한 원문 발췌)를 보여주며, 실제로는 각 칸의 문장을 슬라이드 길이로 줄인 뒤
              원문에 없는 숫자·과장 표현이 섞인 문구는 버립니다. 결과물 이미지를 올린 경험에는 AS-IS → TO-BE 장이 추가됩니다.
            </p>
          </div>
        )}

        {tab === 'card' && (
          <div className="mt-5 rounded-2xl bg-white p-5">
            <JobExperienceCard job={job} exp={exp} index={0} accent={accent} />
            <p className="mt-4 text-center text-[12px] leading-relaxed text-bluewood-300">
              카드 하단의 <strong className="text-bluewood-500">판단 지도 · 말투와 증거 보기</strong>를 펼치면
              대안 비교·선택 기준·사용자 원문·증거 자료가 나옵니다.
              그 아래 <strong className="text-bluewood-500">Honest Review</strong>가 새로 추가된 솔직 회고입니다.
            </p>
          </div>
        )}

        {tab === 'export' && (
          <div className="mt-5 space-y-4">
            {sections.map(s => (
              <section key={s.key} className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
                <div className="flex items-center justify-between border-b border-surface-100 bg-surface-50/70 px-4 py-2.5">
                  <p className="text-[12px] font-extrabold text-bluewood-800">{s.label}</p>
                  <span className="font-mono text-[11.5px] text-bluewood-300">{s.key}</span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3.5 text-[12px] leading-[1.75] text-bluewood-600">{s.content}</pre>
              </section>
            ))}
            <p className="text-center text-[12px] leading-relaxed text-bluewood-300">
              위 섹션이 PDF · 노션 · 링크 공유 포트폴리오에 그대로 실립니다.
              직군을 바꾸면 <strong className="text-bluewood-500">두 번째 섹션(시그니처 산출물)</strong>의 제목과 항목이 달라집니다.
            </p>
          </div>
        )}

        <p className="mt-10 text-center text-[12px] text-bluewood-300">
          예시 데이터는 손으로 작성한 샘플입니다. 실제 사용 시에는 사용자가 올린 자료에서 AI가 같은 구조로 추출합니다.
        </p>
      </div>
    </div>
  );
}
