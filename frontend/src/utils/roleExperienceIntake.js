const field = (key, label, question, placeholder, material) => ({ key, label, question, placeholder, material });

const ROLE_INTAKE = {
  pm: {
    label: '기획자 / PM',
    headline: '고객의 문제를 제품의 결정으로 바꾼 경험',
    summary: '고객 발견 → 우선순위 결정 → 요구사항·출시 → 검증과 다음 판단을 연결해요.',
    materials: '고객 인터뷰 · VOC · PRD · 우선순위표 · 유저 플로우 · 출시 전후 지표',
    titlePlaceholder: '예: 신규 사용자의 첫 주문 이탈 개선',
    example: '예시: 인터뷰에서 첫 주문의 배송비를 미리 알 수 없다는 불편을 찾았어요. 쿠폰 기능보다 비용 안내를 먼저 개선하기로 결정하고, 유저 플로우와 요구사항을 작성했어요. 출시 후 같은 기간의 주문 전환과 문의 유형을 확인해 다음 개선을 정했어요.',
    fields: [
      field('customerEvidence', '고객 문제와 발견 근거', '어떤 사용자의 어떤 문제를 발견했고, 인터뷰·VOC·행동 데이터에서 무엇을 확인했나요?', '대상 사용자, 관찰한 말이나 행동, 기존 가설과 달랐던 점을 적어주세요.', '인터뷰 원문 · VOC · 행동 분석'),
      field('strategy', '우선순위와 포기한 대안', '어떤 대안을 비교했고, 영향·공수·제약을 고려해 무엇을 먼저 하거나 제외했나요?', '선택한 해결책, 보류한 대안, 직접 결정한 범위와 판단 기준을 적어주세요.', '우선순위표 · 백로그 · 의사결정 기록'),
      field('prdDelivery', '요구사항과 제품 설계', '결정을 PRD·유저 플로우·수용 기준에 어떻게 반영하고 디자인·개발과 조율했나요?', '직접 작성한 요구사항이나 화면 흐름, 합의가 어려웠던 쟁점과 바뀐 범위를 적어주세요.', 'PRD · 유저 플로우 · 정책서 · 릴리스 기록'),
      field('msc', '성공 기준과 검증', '성공 기준을 어떻게 정했고, 출시 또는 프로토타입 검증에서 실제로 무엇을 확인했나요?', '목표와 실제 관찰을 구분해 적어주세요. 지표가 있다면 정의·측정 기간·비교 기준도 함께 적어주세요.', '지표 정의 · 사용자 테스트 · 출시 전후 데이터'),
      field('businessImpact', '결과에 따른 다음 결정', '예상과 달랐던 결과는 무엇이고, 그 결과로 제품의 방향이나 다음 우선순위가 어떻게 바뀌었나요?', '관찰된 변화, 아직 모르는 점, 다음에 유지·변경·중단하기로 한 일을 적어주세요.', '회고 · 로드맵 변경 · 후속 실험'),
    ],
    quickFields: {
      title: { placeholder: '예: 첫 주문 이탈 개선을 위한 결제 흐름 기획' },
      context: { label: '어떤 고객 문제를 발견했나요?', hints: ['사용자·상황', '인터뷰·VOC·행동 근거', '해결할 가치'], placeholder: '누가 어디에서 막혔고, 어떤 자료로 문제라고 판단했는지 적어주세요.' },
      role: { label: '내가 책임진 제품 결정은?', hints: ['문제 정의·우선순위', 'PRD·정책·유저 플로우', '협업과 결정 권한'], placeholder: '직접 판단·작성·조율한 범위와 팀이 함께 한 일을 구분해주세요.' },
      action: { label: '무엇을 우선하고 제품을 어떻게 바꿨나요?', hints: ['비교한 대안', '선택·제외한 이유', '요구사항과 출시 범위'], placeholder: '선택한 안과 포기한 안, 판단 기준, 실제 제품에 반영한 내용을 적어주세요.' },
      outcome: { label: '검증 결과로 다음 결정이 어떻게 바뀌었나요?', hints: ['목표와 실제 결과', '측정 기간·지표 정의', '다음 우선순위'], placeholder: '출시 전이면 사용자 테스트·내부 검증도 좋아요. 확인한 사실과 다음 판단을 적어주세요.' },
    },
  },
  marketer: {
    label: '마케터',
    headline: '고객의 반응을 바꾼 메시지와 실험의 기록',
    summary: '타깃 인사이트 → 메시지·채널 전략 → 소재·실험 → 퍼널 성과와 다음 액션을 연결해요.',
    materials: '캠페인 브리프 · 고객 리서치 · 소재 원본 · 광고/GA4 내보내기 · CRM 리포트',
    titlePlaceholder: '예: 신규 고객을 위한 첫 구매 캠페인',
    example: '예시: 제품 사용법을 모르는 잠재 고객을 타깃으로 잡았어요. 할인 중심 소재와 사용 장면 중심 소재를 같은 기간·타깃에서 비교하고, 직접 카피와 랜딩 메시지를 수정했어요. 클릭뿐 아니라 구매까지 이어졌는지 확인한 뒤 다음 소재와 예산을 조정했어요.',
    fields: [
      field('targetChannel', '타깃 인사이트와 채널 선택', '어떤 고객의 어떤 니즈를 찾았고, 그 고객에게 도달할 채널을 왜 선택했나요?', '타깃 구분, 니즈를 확인한 자료, 채널의 역할과 선택 이유를 적어주세요.', '고객 리서치 · 세그먼트 · 채널 계획'),
      field('funnel', '목표와 퍼널의 병목', '인지·유입·전환·유지 중 어디를 개선하려 했고, 어떤 목표와 조건으로 실행했나요?', '개선할 단계, KPI 정의, 기간·예산·운영 범위와 내 역할을 적어주세요.', '캠페인 브리프 · 퍼널 리포트 · 예산표'),
      field('creativeExperiments', '메시지·소재와 실험', '어떤 메시지와 소재를 직접 만들었고, 어떤 가설로 수정하거나 비교했나요?', '실제 카피·소재, 변경 전후 차이, 타깃·기간·예산 등 비교 조건을 적어주세요.', '소재 원본 · 카피 버전 · A/B 테스트 기록'),
      field('kpiEvidence', '채널 성과와 측정 근거', '채널별 노출·클릭·전환·비용 또는 고객 반응을 어디에서 어떻게 측정했나요?', '확인된 수치, 집계 기간·출처·분모를 적어주세요. 목표 수치와 실제 결과를 구분해주세요.', '광고 관리자 · GA4 · CRM · 채널별 CSV'),
      field('campaignLearning', '효율 개선과 다음 액션', '예상과 달랐던 반응을 보고 어떤 소재·타깃·채널·예산을 바꾸거나 중단했나요?', '효과가 있었던 점과 한계, 직접 실행한 조정, 다음 캠페인에서 검증할 것을 적어주세요.', '운영 변경 이력 · 실험 회고 · 다음 캠페인 계획'),
    ],
    quickFields: {
      title: { placeholder: '예: 신규 고객 첫 구매를 위한 콘텐츠·광고 캠페인' },
      context: { label: '어떤 타깃과 퍼널 문제에서 시작했나요?', hints: ['고객 니즈', '인지·유입·전환·유지', '목표 KPI'], placeholder: '어떤 고객의 행동을 바꾸려 했고, 어떤 근거로 문제를 찾았는지 적어주세요.' },
      role: { label: '내가 직접 운영·제작·분석한 범위는?', hints: ['타깃·채널 선택', '카피·소재·랜딩', '예산·리포팅'], placeholder: '직접 만든 소재와 맡은 채널, 운영·분석 범위를 구체적으로 적어주세요.' },
      action: { label: '어떤 메시지와 실험으로 반응을 바꿨나요?', hints: ['가설', '소재·타깃 변경', '비교 조건과 운영 판단'], placeholder: '실제 카피나 소재의 변화, 채널 선택과 실험 조건, 조정 이유를 적어주세요.' },
      outcome: { label: '채널·퍼널 성과와 다음 액션은?', hints: ['기간·출처·분모', '목표와 실제 성과', '유지·중단·확대 결정'], placeholder: '확인한 지표나 고객 반응과 다음 캠페인에 반영한 점을 적어주세요.' },
    },
  },
};

export const getRoleExperienceIntake = role => ROLE_INTAKE[role] || null;

// Only actual user answers go into source text. Empty prompts and examples must never become evidence.
export function roleIntakeText(role, answers = {}) {
  return (getRoleExperienceIntake(role)?.fields || [])
    .filter(item => typeof answers[item.key] === 'string' && answers[item.key].trim())
    .map(item => `${item.label}\n${answers[item.key].trim()}`)
    .join('\n\n');
}

export function roleInterviewFallback(role) {
  const guide = getRoleExperienceIntake(role);
  return guide?.fields.map((item, index) => ({
    id: `${role}-${item.key}`, key: index === 3 ? 'output' : 'process',
    target: index === 3 ? 'evidence' : 'decision', label: item.label,
    kind: index === 3 ? 'evidence' : 'essential', valueScore: [100, 99, 97, 98, 96][index],
    question: item.question, placeholder: item.placeholder,
    why: `${item.material}와 본인이 내린 판단을 연결할 수 있어요.`,
  })) || [];
}

export function roleQuickFields(role, fields) {
  const overrides = getRoleExperienceIntake(role)?.quickFields || {};
  return fields.map(item => ({ ...item, ...overrides[item.key] }));
}

export function roleEditorFields(role, existingFields = [], content = {}) {
  const guide = getRoleExperienceIntake(role);
  if (!guide) return existingFields;
  const roleFields = guide.fields.map(item => ({
    ...item, subtitle: item.question, color: role === 'pm' ? 'bg-indigo-50 border-indigo-200' : 'bg-rose-50 border-rose-200',
  }));
  // Preserve access to earlier entries such as resume bullets when editing old experiences.
  return [...roleFields, ...existingFields.filter(item => !roleFields.some(field => field.key === item.key) && content[item.key])];
}
