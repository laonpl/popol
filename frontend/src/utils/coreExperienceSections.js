/**
 * coreExperienceSections — 직군별 핵심 경험 페이지(간략 보기, ExperienceResult) 데이터를
 * 내보내기/포트폴리오 섹션(text·image 블록)으로 변환한다.
 *
 * 내보내기 기본 틀이 핵심 경험 페이지 구성을 따르도록,
 *  - 자세히 보기의 포트폴리오 내보내기 패널(StructuredResult)
 *  - 노션 프로젝트 화면 구성(ProjectDetailModal 팔레트·초안·기본 렌더링, projectSections)
 * 이 같은 섹션 목록을 공유한다. 섹션 type은 'core'.
 */

function sanitizeText(text) {
  if (text == null) return '';
  return String(text)
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function isDraftCoreText(value) {
  const t = String(value || '').trim();
  return !t || t.startsWith('[작성 필요]') || t.startsWith('[검증 필요]') || /【[^】]*】/.test(t);
}
const coreText = (value) => (isDraftCoreText(value) ? '' : sanitizeText(value).replace(/\*\*/g, '').replace(/^#+\s/gm, '').replace(/^[-*]\s/gm, '').trim());
const coreLine = (label, value) => (coreText(value) ? `${label}: ${coreText(value)}` : '');
const coreLineList = (value) => (Array.isArray(value) ? value : String(value || '').split('\n')).map(coreText).filter(Boolean);
const joinCoreLines = (lines) => lines.filter(Boolean).join('\n');

const blockId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const makeTextBlock = (content) => ({ id: blockId('text'), type: 'text', content: sanitizeText(content) });
const makeImageBlock = (url, alt = '', width = '100%') => ({ id: blockId('image'), type: 'image', content: url, alt: sanitizeText(alt), width: width || '100%' });
const blocksToText = (blocks) => blocks.map(b => (b?.type === 'text' ? b.content : '')).filter(Boolean).join('\n\n');

// GitHub 중심 개발 임팩트 묶음은 FE/BE 개발자 전용이다.
// AI/ML·DevOps는 JOB_SPECIFIC_FIELDS와 전용 JobShowcase 구성을 사용한다.
const CORE_DEV_GIT_JOBS = ['dev'];

/* 핵심 경험 & 성과 — 핵심 경험 페이지 카드(성과 전/후·문제·행동·결과·배움 + 사진)를 그대로 옮긴다.
   기획/PM은 같은 데이터가 의사결정 기록이므로 jobData(채택/기각 대안·검증·임팩트)를 함께 담는다. */
function buildKeyExperienceExportSection(keyExperiences = [], keyExpImages = {}, jobCategory = 'common') {
  const isPm = jobCategory === 'pm';
  const blocks = [];
  keyExperiences.forEach((item, index) => {
    const jd = item?.jobData || {};
    const before = coreText(item?.beforeMetric);
    const after = coreText(item?.afterMetric) || coreText(item?.metric);
    const impact = Number(jd.impact), effort = Number(jd.effort);
    const text = joinCoreLines([
      `${index + 1}. ${coreText(item?.title) || (isPm ? `의사결정 ${index + 1}` : `핵심 경험 ${index + 1}`)}`,
      after ? `성과: ${before ? `${before} → ${after}` : after}` : '',
      coreLine('상황', item?.context || item?.situation),
      ...(isPm ? [
        coreLine('의사결정', jd.decision),
        coreLine('기각한 대안', jd.alternatives),
        coreLine('이해관계자', jd.stakeholders),
        coreLine('검증 방법', jd.validation),
        impact >= 1 && effort >= 1 ? `임팩트/리소스: Impact ${impact} · Effort ${effort}` : '',
      ] : []),
      coreLine(isPm ? '실행·돌파' : '행동', item?.action),
      coreLine('결과', item?.result),
      coreLine('배운 점', item?.learning),
    ]);
    if (text) blocks.push(makeTextBlock(text));
    (keyExpImages?.[String(index)] || []).forEach(img => {
      if (img?.url) blocks.push(makeImageBlock(img.url, coreText(item?.title) || `핵심 경험 ${index + 1}`, img.width));
    });
  });
  return {
    key: 'key-experiences',
    label: isPm ? '의사결정 & 어려움 해결' : '핵심 경험 & 성과',
    type: 'summary',
    content: blocksToText(blocks),
    blocks,
    enabled: blocks.length > 0,
  };
}

/* 개발 직군 — 개발 임팩트의 서비스 소개(product: 이름·문제 정의·해결 방법·주요 성과·핵심 기능) */
function buildProductIntroSection(sr = {}) {
  const product = sr.product || {};
  const outcomes = (Array.isArray(product.outcomes) ? product.outcomes : []).filter(o => coreText(o?.label) || coreText(o?.value));
  const features = (Array.isArray(product.features) ? product.features : []).filter(f => coreText(f?.name) || coreText(f?.desc));
  const headline = [coreText(product.name), coreText(product.tagline)].filter(Boolean).join(' — ');
  const content = joinCoreLines([
    headline,
    coreLine('문제 정의', product.problem),
    coreLine('해결 방법', product.solution),
    outcomes.length ? `주요 성과:\n${outcomes.map(o => `- ${[coreText(o.label), coreText(o.value)].filter(Boolean).join(': ')}`).join('\n')}` : '',
    features.length ? `핵심 기능:\n${features.map(f => `- ${[coreText(f.name), coreText(f.desc)].filter(Boolean).join(': ')}`).join('\n')}` : '',
  ]);
  return { key: 'core-product', label: '서비스 소개 · 문제 해결', type: 'core', content, enabled: !!content };
}

/* 개발 직군 — 핵심 경험 페이지의 기여도·영향력(GitHub 통계) 블록 */
function buildGitImpactSection(sr = {}) {
  const stats = sr.githubStats || {};
  const pct = Number(stats.contributionPct) || 0;
  const langs = (Array.isArray(stats.languages) ? stats.languages : []).filter(l => l?.name);
  const types = (Array.isArray(stats.commitTypes) ? stats.commitTypes : []).filter(t => t?.type).slice(0, 5);
  const lines = joinCoreLines([
    pct > 0
      ? `커밋 기여 비중: ${pct}% (내 커밋 ${stats.myCommits ?? '—'} / 전체 ${stats.totalCommits ?? '—'})`
      : (stats.myCommits ? `내 커밋: ${stats.myCommits}건` : ''),
    stats.activePeriod?.first ? `활동 기간: ${stats.activePeriod.first} ~ ${stats.activePeriod.last || ''}` : '',
    langs.length ? `언어 구성: ${langs.map(l => `${l.name} ${l.pct}%`).join(', ')}` : '',
    types.length ? `커밋 유형: ${types.map(t => `${t.type} ${t.count}건`).join(', ')}` : '',
  ]);
  const content = lines ? `${lines}\nGitHub 기여자 통계(기본 브랜치) 기준` : '';
  return { key: 'core-git-impact', label: '개발 임팩트 · 기여도', type: 'core', content, enabled: !!content };
}

/* 개발 직군 — 개발 임팩트의 문제 해결 기록(gitAnalysis.experiences) */
function buildGitProblemSection(sr = {}) {
  const exps = Array.isArray(sr.gitAnalysis?.experiences) ? sr.gitAnalysis.experiences : [];
  const blocks = exps.map((exp, index) => {
    const problems = coreLineList(exp?.problem_definition);
    const solutions = coreLineList(exp?.troubleshooting);
    const text = joinCoreLines([
      `${index + 1}. ${coreText(exp?.project_name) || `프로젝트 ${index + 1}`}`,
      coreLine('기간', exp?.period),
      coreLine('기술', exp?.core_tech_stack),
      coreLine('임팩트', exp?.core_impact),
      problems.length ? `문제 정의:\n${problems.map(line => `- ${line}`).join('\n')}` : '',
      solutions.length ? `해결 과정:\n${solutions.map(line => `- ${line}`).join('\n')}` : '',
    ]);
    return text ? makeTextBlock(text) : null;
  }).filter(Boolean);
  return {
    key: 'core-git-problems',
    label: '문제 해결 기록',
    type: 'core',
    content: blocksToText(blocks),
    blocks,
    enabled: blocks.length > 0,
  };
}

/* 기획/PM — 린 캔버스(문제·기존 솔루션·고유 가치·고객·얼리어답터·핵심지표) 한 장 요약 */
function buildLeanCanvasSection(sr = {}) {
  const product = sr.product || {};
  const canvas = sr.leanCanvas || {};
  const pv = sr.portfolioVisuals || {};
  const metricItems = [
    ...(Array.isArray(pv.kpis) ? pv.kpis : []).map(k => ({ label: coreText(k?.label), value: coreText(k?.value) })),
    ...(Array.isArray(pv.goals) ? pv.goals : []).map(g => ({ label: coreText(g?.label), value: coreText(g?.actual) || coreText(g?.target) })),
  ].filter(m => m.label || m.value).slice(0, 3);
  const content = joinCoreLines([
    coreLine('문제', product.problem),
    coreLine('기존 솔루션', canvas.existingAlternatives || product.solution),
    coreLine('고유 가치 제안', canvas.uvp),
    coreLine('고객 세그먼트', canvas.customers),
    coreLine('얼리어답터', canvas.earlyAdopters),
    metricItems.length ? `핵심지표: ${metricItems.map(m => [m.label, m.value].filter(Boolean).join(' ')).join(', ')}` : '',
  ]);
  return { key: 'core-lean-canvas', label: '린 캔버스 요약', type: 'core', content, enabled: !!content };
}

/* 기획/PM — 가설 검증 설계 표 (저장된 pmHypotheses 우선, 없으면 경험별 jobData에서 유도) */
function buildPmValidationSection(sr = {}, keyExperiences = []) {
  const stored = Array.isArray(sr.pmHypotheses) ? sr.pmHypotheses : [];
  const rows = stored.length ? stored : keyExperiences.map(ke => {
    const jd = ke?.jobData || {};
    return {
      hypothesis: jd.hypothesis,
      kpi: ke?.metricLabel,
      kpiRationale: jd.validation,
      achievement: ke?.afterMetric || ke?.metric,
      note: jd.note || jd.failureReason,
    };
  });
  const content = rows.map((row, index) => joinCoreLines([
    coreText(row?.hypothesis) ? `H${index + 1}. ${coreText(row.hypothesis)}` : '',
    coreLine('핵심 KPI', row?.kpi),
    coreLine('설정 근거', row?.kpiRationale),
    coreLine('목표', row?.target),
    coreLine('달성', row?.achievement || row?.actual),
    coreLine('비고', row?.note),
  ])).filter(Boolean).join('\n\n');
  return { key: 'core-pm-validation', label: '가설 및 검증', type: 'core', content, enabled: !!content };
}

/* 마케터 — marketerKit의 캠페인 스토리(퍼널)와 KPI */
function buildMarketerCampaignSection(sr = {}) {
  const kit = sr.marketerKit || {};
  const funnel = kit.funnel || {};
  const kpis = (Array.isArray(kit.kpis) ? kit.kpis : []).filter(k => coreText(k?.name));
  const content = joinCoreLines([
    coreLine('포지셔닝', kit.positioning),
    coreLine('문제', funnel.problem),
    coreLine('목표', funnel.goal),
    coreLine('타깃', funnel.target),
    coreLine('전략', funnel.strategy),
    coreLine('실행', funnel.execution),
    coreLine('성과', funnel.result),
    coreLine('인사이트', funnel.insight),
    kpis.length ? `캠페인 KPI:\n${kpis.map(k => `- ${coreText(k.name)}${coreText(k.value) ? `: ${coreText(k.value)}` : ''}${coreText(k.status) ? ` (${coreText(k.status)})` : ''}`).join('\n')}` : '',
  ]);
  return { key: 'core-marketer-campaign', label: '캠페인 스토리', type: 'core', content, enabled: !!content };
}

/* 마케터 — 이력서 문장 (resumeVariants 우선, 없으면 resumeBullets) */
function buildMarketerResumeSection(sr = {}) {
  const kit = sr.marketerKit || {};
  const variants = (Array.isArray(kit.resumeVariants) ? kit.resumeVariants : [])
    .map(v => coreText(v?.sentence)).filter(Boolean);
  const bullets = variants.length ? variants : (Array.isArray(kit.resumeBullets) ? kit.resumeBullets : []).map(coreText).filter(Boolean);
  const content = bullets.map(line => `- ${line}`).join('\n');
  return { key: 'core-marketer-resume', label: '이력서 문장', type: 'core', content, enabled: !!content };
}

/* 간략 보기 자유 본문(caseStudy.body) — 텍스트·사진 세그먼트를 블록으로 (내용 있을 때만) */
function buildCaseBodySection(caseStudy, jobCategory = 'common') {
  const segs = Array.isArray(caseStudy?.body) ? caseStudy.body : [];
  const blocks = [];
  let buffer = [];
  const flush = () => {
    const text = joinCoreLines(buffer);
    if (text) blocks.push(makeTextBlock(text));
    buffer = [];
  };
  segs.forEach(seg => {
    if (seg?.type === 'image') {
      if (seg.content) { flush(); blocks.push(makeImageBlock(seg.content, '', seg.width)); }
    } else {
      const text = sanitizeText(seg?.content || '').trim();
      if (text) buffer.push(text);
    }
  });
  flush();
  if (blocks.length === 0) return null;
  return {
    key: 'core-case-body',
    label: jobCategory === 'common' ? '케이스 스터디 본문' : '첨부 · 부가 자료',
    type: 'core',
    content: blocksToText(blocks),
    blocks,
    enabled: true,
  };
}

/* 섹션 마무리 — blocks 보정(내용만 있으면 텍스트 블록 생성) */
function finalizeSection(section) {
  if (!section) return null;
  const blocks = Array.isArray(section.blocks) && section.blocks.length > 0
    ? section.blocks
    : (section.content ? [makeTextBlock(section.content)] : []);
  return { ...section, content: sanitizeText(section.content || blocksToText(blocks)), blocks };
}

/**
 * 직군별 핵심 경험 페이지 전체 → 내보내기 기본 틀 섹션 목록 (핵심 경험 페이지의 읽기 순서 유지).
 * key-experiences 섹션을 포함하며, 노션 캔버스처럼 핵심 경험을 따로 다루는 화면은 key로 걸러 쓴다.
 */
export function buildCoreExperienceSections({ jobCategory = 'common', sr = {}, caseStudy = null, keyExperiences = [], keyExpImages = {} } = {}) {
  const keyExpSection = buildKeyExperienceExportSection(keyExperiences, keyExpImages, jobCategory);
  let sections;
  if (CORE_DEV_GIT_JOBS.includes(jobCategory)) {
    sections = [buildProductIntroSection(sr), buildGitImpactSection(sr), buildGitProblemSection(sr), keyExpSection];
  } else if (jobCategory === 'pm') {
    sections = [buildLeanCanvasSection(sr), keyExpSection, buildPmValidationSection(sr, keyExperiences)];
  } else if (jobCategory === 'marketer') {
    sections = [keyExpSection, buildMarketerCampaignSection(sr), buildMarketerResumeSection(sr)];
  } else {
    sections = [keyExpSection];
  }
  sections.push(buildCaseBodySection(caseStudy, jobCategory));
  return sections.map(finalizeSection).filter(Boolean);
}

/** 경험 객체에서 바로 핵심 경험 섹션 목록을 만든다 (노션 구성 팔레트·초안·미리보기용). */
export function buildCoreSectionsForExperience(exp = {}) {
  const sr = exp?.structuredResult || {};
  return buildCoreExperienceSections({
    jobCategory: exp?.jobCategory || sr.jobCategory || 'common',
    sr,
    caseStudy: exp?.caseStudy || null,
    keyExperiences: Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [],
    keyExpImages: exp?.keyExpImages || {},
  });
}

/** 내용이 있는 섹션만 (팔레트 노출·기본 렌더링용) */
export function contentBearingCoreSections(exp = {}) {
  return buildCoreSectionsForExperience(exp)
    .filter(section => section.enabled !== false && (section.content?.trim() || section.blocks?.some(block => block.type === 'image')));
}
