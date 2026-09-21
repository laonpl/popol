// Shared reading order for the portfolio and its text export.
export const MARKETING_CHAPTERS = [
  { key: 'strategy', label: '고객과 메시지', title: '고객의 어떤 마음을 움직이려 했는가', groups: ['audiences', 'positioning'], dimensions: ['targeting'], missing: '고객의 관찰 신호, 행동 장벽, 전달할 약속과 선택 이유' },
  { key: 'creative', label: '크리에이티브', title: '그 메시지를 어떤 표현으로 만들었는가', groups: ['creatives'], dimensions: ['creative'], missing: '직접 만든 광고·콘텐츠·랜딩·카피와 표현을 선택한 이유' },
  { key: 'activation', label: '채널과 운영', title: '고객에게 닿는 접점과 운영 방식', groups: ['channels', 'contentSystem', 'crm', 'operations'], dimensions: [], missing: '접점을 선택한 이유, 집행 범위·예산·기간 또는 콘텐츠·CRM 운영 조건' },
  { key: 'measurement', label: '성과와 해석', title: '어떤 반응을 얻었고, 어디까지 설명할 수 있는가', groups: ['measurement'], dimensions: ['attribution'], missing: '고객 반응이나 성과 기록. 수치에는 기간·대상·집계 기준을 함께 기록' },
  { key: 'learning', label: '테스트와 개선', title: '반응을 읽고 다음 실행을 바꾸다', groups: ['experiments', 'optimization'], dimensions: ['experiment', 'learning'], missing: '검토·실험한 내용, 유지하거나 바꾼 선택, 실패에서 배운 점' },
];

export function marketingCaseSections(item, { hasFiles = false, editable = false } = {}) {
  return MARKETING_CHAPTERS.map(chapter => ({ ...chapter,
    records: item.records.filter(row => chapter.dimensions.includes(row.dimension)),
  })).filter(chapter => chapter.records.length || chapter.groups.some(group => item.workProducts[group]?.length)
    || (chapter.key === 'creative' && (hasFiles || editable))
    || (chapter.key === 'measurement' && (item.metrics.length || item.attributionLimit))
    || (chapter.key === 'learning' && item.nextExperiment));
}
