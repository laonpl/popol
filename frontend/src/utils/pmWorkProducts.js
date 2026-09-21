export const PM_WORK_PRODUCTS = [
  { key: 'research', label: '고객 인사이트 맵', fields: [['segment', '조사 대상'], ['observation', '관찰'], ['insight', '해석'], ['opportunity', '제품 기회'], ['limitation', '반례 · 한계']], limit: 3 },
  { key: 'businessModel', label: '가치 교환 구조', fields: [['customer', '사용자'], ['payer', '비용 부담 주체'], ['value', '전달 가치'], ['revenue', '사업 기여 경로'], ['cost', '비용 · 운영 부담'], ['tradeoff', '가치 충돌 · 선택']], limit: 2 },
  { key: 'metricLinks', label: '성과를 만드는 지표 연결', fields: [['driver', '선행지표 · 행동'], ['outcome', '결과지표'], ['relationship', '연결 근거 · 가설'], ['measurement', '측정 방식'], ['guardrail', '보호 지표']], limit: 4 },
  { key: 'serviceBlueprint', label: '서비스 블루프린트', fields: [['step', '단계'], ['customerAction', '사용자 행동'], ['frontstage', '화면 · 접점'], ['backstage', '운영 · 파트너'], ['system', '시스템'], ['exception', '예외 처리']], limit: 5 },
  { key: 'releases', label: '출시와 범위 결정', fields: [['milestone', '이정표'], ['scope', '포함 · 제외 범위'], ['dependency', '선행 의존성'], ['gate', '출시 · 인수 기준'], ['status', '기록된 상태']], limit: 4 },
  { key: 'risks', label: '리스크와 운영 안전장치', fields: [['risk', '위험'], ['trigger', '발생 조건'], ['mitigation', '대응'], ['owner', '책임 범위'], ['result', '확인 결과']], limit: 3 },
  { key: 'problems', label: '고객 문제와 사업 기회', eyebrow: 'DISCOVERY', description: '누구의 어떤 문제를, 왜 지금 해결했는가', fields: [['user', '대상 고객'], ['context', '사용 맥락'], ['signal', '발견한 신호'], ['problem', '정의한 문제'], ['businessReason', '사업적 이유']], limit: 2 },
  { key: 'alternatives', label: '대안 비교와 MVP 범위', eyebrow: 'DECISION LOG', description: '선택한 것만큼, 하지 않기로 한 것의 이유', fields: [['option', '검토 대안'], ['disposition', '결정'], ['criterion', '판단 기준'], ['tradeoff', '얻는 것 · 감수한 제약'], ['reason', '선택·제외 이유']], limit: 4 },
  { key: 'journey', label: '사용자 흐름과 서비스 설계', eyebrow: 'SERVICE FLOW', description: '사용자 행동의 어디를 어떻게 바꿨는가', fields: [['step', '단계'], ['actor', '행동 주체'], ['before', '기존 흐름 · 막힌 지점'], ['after', '설계·변경한 흐름'], ['exception', '예외 · 실패 상태']], limit: 6 },
  { key: 'requirements', label: '요구사항과 정책 명세', eyebrow: 'PRODUCT SPEC', description: '구현 가능한 규칙과 검증 가능한 완료 조건', fields: [['requirement', '요구사항'], ['rule', '조건 · 분기 · 처리 정책'], ['acceptance', '인수 기준'], ['owner', '직접 책임진 범위']], limit: 4 },
  { key: 'experiments', label: '가설과 검증 설계', eyebrow: 'EXPERIMENT', description: '무엇을 확인하려 했고, 관찰 뒤 무엇을 결정했는가', fields: [['hypothesis', '검증 가설'], ['method', '방법 · 대상 · 기간'], ['successCriteria', '사전 성공 기준'], ['observation', '실제 관찰'], ['decision', '관찰 후 결정']], limit: 3 },
  { key: 'collaboration', label: '협업과 이해관계 조율', eyebrow: 'ALIGNMENT', description: '이견을 어떤 행동과 합의로 풀었는가', fields: [['stakeholder', '협업 상대'], ['disagreement', '이견 · 의존성'], ['myAction', '내가 조율한 행동'], ['agreement', '합의한 내용']], limit: 3 },
  { key: 'troubleshooting', label: '운영 문제 해결과 회고', eyebrow: 'ITERATION', description: '예상과 달랐던 결과를 다음 판단으로 연결', fields: [['issue', '발생한 문제'], ['cause', '확인한 원인'], ['change', '수정한 내용'], ['result', '관찰한 결과'], ['learning', '다음 판단에 적용할 점']], limit: 3 },
];

export function normalizePmWorkProducts(data, basisFor) {
  return Object.fromEntries(PM_WORK_PRODUCTS.map(group => [group.key,
    (Array.isArray(data?.[group.key]) ? data[group.key] : []).map((row, sourceRowIndex) => row && ({ ...row, sourceRowIndex })).filter(row => row && typeof row === 'object').slice(0, group.limit).map(row => {
      const basis = basisFor(row);
      const values = Object.fromEntries(group.fields.map(([key]) => [key, typeof row[key] === 'string' ? row[key].trim().slice(0, 600) : '']));
      const stage = basis !== 'unlocated' && ['planned', 'executed', 'observed', 'changed'].includes(row.stage) ? row.stage : 'unknown';
      if (group.key === 'experiments' && (basis === 'unlocated' || stage === 'planned')) { values.observation = ''; values.decision = ''; }
      if (['troubleshooting', 'risks'].includes(group.key) && stage === 'planned') values.result = '';
      if (basis === 'unlocated') {
        if (group.key === 'requirements') values.owner = '';
        if (group.key === 'collaboration') values.myAction = '';
        if (group.key === 'troubleshooting') values.result = '';
        if (group.key === 'risks') { values.owner = ''; values.result = ''; }
        if (group.key === 'releases') values.status = '';
      }
      return { ...row, ...values, basis, stage };
    }).filter(row => group.fields.some(([key]) => row[key])),
  ]));
}

export function pmWorkProductExport(workProducts, stageLabels, basisLabels) {
  return PM_WORK_PRODUCTS.flatMap(group => (workProducts[group.key] || []).map((row, index) => [
    `${group.label} ${index + 1} · ${stageLabels[row.stage]} · ${basisLabels[row.basis]}`,
    row.userEdited ? '직접 수정한 정리 · 원문과 의미 대조 필요' : '',
    ...group.fields.map(([key, label]) => row[key] ? `${label}: ${row[key]}` : ''),
    row.basis !== 'unlocated' ? `원문 발췌: “${row.quote}”\n출처: ${row.sourceName || ''}${row.location ? ` · ${row.location}` : ''}` : '출처 대조 필요',
  ].filter(Boolean).join('\n')));
}
