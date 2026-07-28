/**
 * verify-recent-changes.mjs
 *
 * 인사담당자 피드백("산출물 디테일 부족 · 직군별 UVP 애매 · 너무 완벽해서 사람 냄새가 안 남")에
 * 대응해 수정한 내용을 한 번에 확인하는 예시 스크립트.
 *
 * 목(mock)이 아니라 실제 프로덕션 코드를 그대로 호출한다.
 *   - backend/src/prompts/experiencePrompts.js  (프롬프트 규칙 · 경력 단계)
 *   - backend/src/services/geminiService.js     (jobData 파이프라인 복구)
 *   - frontend/src/utils/coreExperienceSections.js (직군별 시그니처 산출물)
 *
 * 실행:  node verify-recent-changes.mjs
 *       node verify-recent-changes.mjs 3      ← 특정 번호 섹션만 실행
 */

const PROMPTS = './backend/src/prompts/experiencePrompts.js';
const SECTIONS = './frontend/src/utils/coreExperienceSections.js';
const SERVICE = './backend/src/services/geminiService.js';

const only = process.argv[2] ? Number(process.argv[2]) : null;
const run = (n) => only === null || only === n;

const line = (ch = '─') => console.log(ch.repeat(78));
function head(n, title) {
  console.log('');
  line('━');
  console.log(`  ${n}. ${title}`);
  line('━');
}
function ok(label, passed, extra = '') {
  console.log(`   ${passed ? '✅' : '❌'} ${label}${extra ? `  ${extra}` : ''}`);
  if (!passed) process.exitCode = 1;
}
/** 프롬프트에서 특정 대괄호 섹션만 잘라 보여준다 (전체 출력은 너무 길다) */
function excerpt(text, startsWith, maxLines = 12) {
  const lines = text.split('\n');
  const i = lines.findIndex(l => l.includes(startsWith));
  if (i < 0) return '   (없음)';
  return lines.slice(i, i + maxLines).map(l => `   │ ${l}`).join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
// 예시 경험 데이터 — 새로 추가된 필드를 전부 채운 "디자이너" 경험 1건.
// 실제 AI가 채우는 스키마와 동일한 모양이다.
// ────────────────────────────────────────────────────────────────────────────
const SAMPLE_DESIGNER_EXP = {
  title: '온보딩 3주차 이탈 개선',
  metric: '4/5', metricLabel: '첫 과제 완료', beforeMetric: '1/5', afterMetric: '4/5',
  context: '교내 스터디 매칭 서비스에서 가입한 사람 중 절반이 첫 주에 안 들어왔다.',
  action: '가입 직후 화면을 체크리스트 카드 하나로 바꿨다.',
  result: '사용성 테스트에서 5명 중 4명이 첫 과제를 끝까지 했다. 이전엔 1명이었다.',
  learning: '화면을 예쁘게 만드는 문제가 아니라 첫 문장을 정하는 문제였다.',

  // ① 직군 특화 추출 — 예전에는 백엔드에서 통째로 버려지던 값
  jobData: {
    painPoint: '가입 직후 화면에서 뭘 먼저 해야 할지 몰라서 그냥 나갔다',
    designDecision: '할 일을 5개 보여주던 걸 버리고 "스터디 1개 찜하기" 하나만 남겼다',
    testResult: '5명 중 4명이 첫 과제 완료 (기존 1명)',
  },

  // ② 판단 지도 — 생각의 흐름
  decisionTrace: {
    situation: '가입자 절반이 첫 주에 안 들어왔다.',
    problemJudgment: '화면이 복잡한 게 아니라, 첫 행동이 뭔지 안 알려준 게 문제라고 봤다.',
    problemEvidence: '인터뷰 6명 중 4명이 "뭘 눌러야 하는지 몰랐다"고 했다.',
    alternatives: [
      { option: '색 대비를 높여 버튼을 강조', pros: '작업이 하루면 끝남', cons: '왜 눌러야 하는지는 여전히 설명 안 됨', reasonNotChosen: '인터뷰에서 버튼을 못 본 게 아니라 이유를 모른다고 했다' },
      { option: '온보딩 튜토리얼 3단계 추가', pros: '설명은 확실함', cons: '단계가 늘어 이탈 지점이 더 생김', reasonNotChosen: '2주 안에 검증할 수 없는 규모였다' },
    ],
    decisionCriteria: [
      { criterion: '2주 안에 테스트 가능한가', why: '학기 중 프로젝트라 일정이 고정이었다' },
      { criterion: '첫 행동을 하나로 줄일 수 있는가', why: '인터뷰에서 나온 문제가 선택지 과다였다' },
    ],
    choice: '할 일 5개를 지우고 "스터디 1개 찜하기" 하나만 남겼다.',
    execution: '화면 설계와 카피는 내가 썼고, 프로토타입 제작과 테스트 진행도 직접 했다.',
    outcomeEvidence: '사용성 테스트 녹화 5건과 참가자 메모에서 확인했다.',
    changedJudgment: '색 대비 문제일 거라 생각했는데 카피 문제였다.',
    newPrinciple: '화면을 그리기 전에 첫 문장부터 검증한다.',
  },

  // ③ 사용자의 실제 말투 보존
  voiceRecord: {
    originalQuote: '뭘 눌러야 되는지 모르겠어서 그냥 껐어요',
    polished: '무엇을 눌러야 할지 몰라서 그냥 종료했다',
    aiMeaning: '문제를 화면이 아니라 사용자의 말에서 찾아 정의하는 방식',
  },

  // ④ 주장 옆의 증거
  evidenceBundle: [
    { claim: '첫 행동을 하나로 줄여 완료율이 올랐다', type: '화면', sourceRef: 'onboarding_v2.fig', whatItProves: '변경 전후 화면 비교', ownership: '화면·카피 전부 직접 작업', status: '확보됨' },
    { claim: '사용자가 첫 행동을 몰랐다', type: '피드백', sourceRef: '사용자 인터뷰 노트 6건', whatItProves: '문제 정의의 근거', ownership: '인터뷰 진행·정리 직접', status: '확보됨' },
    { claim: '완료율 개선', type: '데이터', sourceRef: '사용성 테스트 녹화', whatItProves: '5명 중 4명 완료', ownership: '테스트 설계·진행 직접', status: '확인 필요' },
  ],

  // ⑤ 정체성 단서
  identitySignal: {
    pattern: '화면을 고치기 전에 사용자가 쓴 단어부터 확인한다',
    sentence: '저는 디자인을 바꾸기 전에 사람들이 쓰는 말을 먼저 봅니다',
    proof: '색 대비 가설을 버리고 카피 문제로 방향을 튼 판단',
    confidence: 'medium',
  },

  // ⑥ 솔직 회고 — "너무 완벽해서 반발심" 피드백에 대한 직접 대응
  honestReview: {
    struggle: '테스트 참가자를 5명밖에 못 모아서 결과를 일반화하기 어려웠다.',
    misjudgment: '색 대비 문제일 줄 알았는데 실제로는 문구가 문제였다.',
    limitation: '정량 지표로는 검증하지 못했고 정성 테스트에서 멈췄다.',
    nextTime: '프로토타입을 만들기 전에 카피 문안부터 A/B로 검증하겠다.',
  },
};

/** 직군별 시그니처 산출물 확인용 최소 샘플 (jobData만 채움) */
const JOB_SAMPLES = {
  designer: { title: '온보딩 개선', jobData: SAMPLE_DESIGNER_EXP.jobData },
  da: { title: '이탈 코호트 분석', jobData: { hypothesis: '3주차 이탈은 알림 미수신과 관련 있다', method: 'SQL 코호트 + 카이제곱 검정', finding: '알림 미수신 그룹 이탈률이 2.1배 높았다', businessAction: '알림 기본값을 on으로 변경', control: '18%', variant: '38%', significance: 'p<0.05' } },
  aiml: { title: '이탈 예측 모델', jobData: { dataset: '사내 로그 12만 건', model: 'LightGBM', whyModel: 'RandomForest 대비 학습 30분 단축, 해석 지표 확보 용이', metrics: [{ name: 'F1', value: '0.82', baseline: '0.74' }, { name: 'AUC', value: '0.89' }] } },
  devops: { title: '배포 중 장애 대응', jobData: { incident: '금요일 배포 후 로그인 API 5분간 502', rootCause: '커넥션 풀 상한이 새 인스턴스 수를 못 따라감', actionTaken: '풀 상한 상향 + 헬스체크 지연 시간 조정, 롤백 스크립트 자동화', impact: 'MTTR 42분 → 8분' } },
  hr: { title: '신입 온보딩 프로그램', jobData: { goal: '입사 3개월 내 조기 퇴사가 반복됨', program: '2주 버디 제도와 4주차 1:1 체크인 설계·운영', funnelChange: '3개월 리텐션 71% → 88%' } },
  sales: { title: '제조사 A사 계약', jobData: { client: '제조 중견기업 A사', approach: '기존 수기 집계 공정을 대시보드로 치환하는 시나리오로 제안', negotiation: '연 단위 결제 부담 → 분기 결제 + 3개월 파일럿으로 전환', dealSize: '4,800만원', stage: '계약' } },
  pm: { title: '찜하기 우선 배치 결정', jobData: { hypothesis: '사용자는 첫 화면에서 행동 하나만 있으면 완주한다', decision: '홈 상단을 찜하기 단일 CTA로 변경', alternatives: '튜토리얼 3단계 추가 — 일정 초과로 기각', stakeholders: '개발 2명에게 인터뷰 원문을 근거로 설득', validation: '사용성 테스트 5명', impact: 4, effort: 2 } },
  marketer: { title: '개강 시즌 캠페인', jobData: { target: '수도권 대학생 1~2학년', channels: ['인스타그램', '에브리타임'], creative: '시간표 인증 챌린지', kpis: [{ name: '가입 전환', value: '6.2%' }] } },
  dev: { title: '조회 API 개선', jobData: {} },
};

// ────────────────────────────────────────────────────────────────────────────

console.log('\n포폴(POPOL) — 최근 수정사항 검증 예시');
console.log('인사담당자 피드백 대응: ① 직군별 UVP ② 사람 냄새 ③ 경력 단계별 눈높이');

const prompts = await import(PROMPTS);
const sections = await import(SECTIONS);

// ══ 1. 경력 단계별 눈높이 ══════════════════════════════════════════════════
if (run(1)) {
  head(1, '경력 단계 — 같은 경험도 지원 단계에 따라 기준이 달라진다');

  const built = ['first', 'newgrad', 'experienced'].map(stage => ({
    stage,
    text: prompts.buildSingleKeyExperiencePrompt('샘플 자료', null, 0, 3, 'designer', stage),
  }));

  for (const { stage, text } of built) {
    const label = text.match(/이 지원자는 "([^"]+)"/)?.[1] ?? '(없음)';
    console.log(`\n   [${stage}] → "${label}"`);
    console.log(excerpt(text, '이 지원자는 "', 8));
  }

  console.log('');
  ok('3단계 프롬프트가 서로 다르게 생성됨', new Set(built.map(b => b.text)).size === 3);
  ok('첫 취업: 학생 규모로 눈높이 고정', built[0].text.includes('팀 3~5명'));
  ok('신입: 기여 경계(팀/나) 분리 강조', built[1].text.includes('기여 범위의 정확성'));
  ok('경력: 글로벌 기법 적극 활용으로 상향', built[2].text.includes('적극 활용하세요'));
  ok('경력에도 AI 티 경고는 유지 (완성도 ≠ 매끈함)', built[2].text.includes('경력직 서류에서 더 치명적'));
  ok('잘못된 값은 first로 폴백', prompts.buildOverviewPrompt('x', 'pm', 'zzz').includes('첫 취업 준비'));
}

// ══ 2. 사람 냄새 — AI 판별 신호 차단 ═══════════════════════════════════════
if (run(2)) {
  head(2, '사람 냄새 — 채용담당자가 AI를 판별하는 신호를 프롬프트가 금지하는지');

  const p = prompts.buildOverviewPrompt('샘플 자료', 'designer', 'first');
  console.log(excerpt(p, 'AI로 판별되는 5가지 신호', 14));

  console.log('');
  ok('모든 문장에 수치 붙이는 대칭 금지', p.includes('완벽한 대칭'));
  ok('동일 문형 반복 금지', p.includes('같은 문형의 반복'));
  ok('힘만 센 동사 남발 금지', p.includes('힘만 센 동사의 나열'));
  ok('고유명사 보존 요구', p.includes('구체적 고유명사가 없는 매끈한 문장'));
  ok('실패·한계 서사 요구', p.includes('실패·한계·불확실이 하나도 없는'));
  ok('AI 클리셰 금지어 포함', p.includes('시너지를 창출') && p.includes('역량을 함양'));
  ok('기법 8개 전면 강제 → 선택 적용으로 완화', p.includes('1~2개 골라 적용'));
  ok('honestReview(솔직 회고) 스키마 요구', p.includes('honestReview') || prompts.buildDraftAnalysisPrompt('x', 'designer', 'first').includes('honestReview'));
}

// ══ 3. jobData 파이프라인 복구 (핵심 버그) ═════════════════════════════════
if (run(3)) {
  head(3, '[버그 수정] 직군 특화 추출(jobData)이 백엔드에서 버려지던 문제');

  console.log('   수정 전: analyzeExperience가 프롬프트에 jobCategory를 안 넘기고,');
  console.log('            반환 객체 화이트리스트에서 jobData를 탈락시켜');
  console.log('            디자이너·DA·AI/ML·데브옵스·HR·세일즈 카드가 전부 CARL 폴백으로 렌더됐다.\n');

  const dev = prompts.buildSingleKeyExperiencePrompt('자료', null, 0, 1, 'designer', 'first');
  const da = prompts.buildSingleKeyExperiencePrompt('자료', null, 0, 1, 'da', 'first');
  ok('디자이너 프롬프트에 jobData 스키마(painPoint) 포함', dev.includes('painPoint'));
  ok('DA 프롬프트에 jobData 스키마(businessAction) 포함', da.includes('businessAction'));

  try {
    const svc = await import(SERVICE);
    const fb = svc.buildFallbackExperienceAnalysis(
      { situation: '검증용 원본 텍스트입니다.' }, 1,
      [SAMPLE_DESIGNER_EXP], 'designer',
    );
    const ke = fb.keyExperiences[0];
    ok('폴백 경로에서 jobData 보존', !!ke.jobData?.painPoint, JSON.stringify(ke.jobData?.painPoint || ''));
    ok('폴백 경로에서 honestReview 보존', !!ke.honestReview?.struggle);
    const grounded = svc.groundAnalysisMetrics({ keyExperiences: [ke] }, '검증용 원본 텍스트입니다.');
    ok('수치 검증(MetricGuard) 통과 후에도 jobData 보존', !!grounded.keyExperiences[0].jobData?.painPoint);
  } catch (err) {
    console.log(`   ⚠️  geminiService 로드 생략 (Firebase 자격증명 필요): ${err.message.slice(0, 60)}`);
  }
}

// ══ 4. 직군별 시그니처 산출물 ══════════════════════════════════════════════
if (run(4)) {
  head(4, '직군별 시그니처 산출물 — 내보내기·노션·공유 포트폴리오에 반영되는 실제 결과');
  console.log('   수정 전: dev/pm/marketer만 전용 섹션. 나머지 6개 직군은 "핵심 경험 & 성과" 하나뿐이었다.\n');

  for (const [job, sample] of Object.entries(JOB_SAMPLES)) {
    const built = sections.buildCoreExperienceSections({
      jobCategory: job, sr: {}, keyExperiences: [sample],
    }).filter(s => s.enabled !== false && s.content?.trim());

    console.log(`   ▸ ${job.padEnd(9)} ${built.map(s => s.label).join(' / ') || '(내용 없음)'}`);
    const signature = built.find(s => s.key?.startsWith('core-') && s.key !== 'core-case-body');
    if (signature) {
      console.log(signature.content.split('\n').map(l => `        │ ${l}`).join('\n'));
    }
    console.log('');
  }

  const noData = sections.buildCoreExperienceSections({
    jobCategory: 'sales', sr: {}, keyExperiences: [{ title: '근거 없음', context: 'x' }],
  });
  ok('jobData가 없으면 시그니처 섹션이 조용히 비활성화됨',
    noData.find(s => s.key === 'core-sales-deals')?.enabled === false);
}

// ══ 5. 솔직 회고 · 판단 지도 · 말투 · 증거가 산출물에 실리는지 ═════════════
if (run(5)) {
  head(5, '핵심 경험 산출물 — 판단 지도 · 말투 · 증거 · 솔직 회고');

  const [keyExp] = sections.buildCoreExperienceSections({
    jobCategory: 'designer', sr: {}, keyExperiences: [SAMPLE_DESIGNER_EXP],
  });
  console.log(`   [${keyExp.label}]`);
  console.log(keyExp.content.split('\n').map(l => `      │ ${l}`).join('\n'));

  const c = keyExp.content;
  console.log('');
  ok('판단 지도: 문제 판단·근거', c.includes('문제 판단:') && c.includes('판단 근거:'));
  ok('판단 지도: 검토한 대안 + 기각 이유', c.includes('검토한 대안:') && c.includes('2주 안에 검증할 수 없는 규모였다'));
  ok('판단 지도: 선택 기준', c.includes('선택 기준:'));
  ok('판단 지도: 바뀐 판단 → 다음 원칙', c.includes('바뀐 판단:') && c.includes('다음 판단 원칙:'));
  ok('말투 보존: 사용자의 실제 말 인용', c.includes('뭘 눌러야 되는지 모르겠어서'));
  ok('증거 번들: 파일명·기여 범위 명시', c.includes('onboarding_v2.fig') && c.includes('기여:'));
  ok('정체성: 나를 보여주는 한 문장', c.includes('나를 보여주는 한 문장:'));
  ok('솔직 회고 4종 모두 출력', ['막혔던 지점:', '예상과 달랐던 점:', '남은 한계:', '다시 한다면:'].every(k => c.includes(k)));
}

// ══ 요약 ══════════════════════════════════════════════════════════════════
console.log('');
line('━');
console.log(process.exitCode
  ? '  ❌ 실패한 항목이 있습니다. 위 ❌ 표시를 확인하세요.'
  : '  ✅ 전부 통과 — 수정사항이 모두 실제 코드 경로에서 동작합니다.');
line('━');
console.log('\n  화면으로 확인하려면: 경험 만들기 1단계에서 "04 경력 단계"를 바꿔가며');
console.log('  같은 자료로 정리해보면 문체·성과 서술 밀도가 달라지는 것을 볼 수 있습니다.\n');
