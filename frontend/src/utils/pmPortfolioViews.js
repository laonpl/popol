// Reading lenses, not competency scores or automatic job-fit claims.
export const PM_VIEWS = [
  { key: 'impact', label: '임팩트 브리프', question: '이 사람은 무엇을 바꿨는가?', groups: [] },
  { key: 'strategy', label: '기회 · 사업 판단', question: '누구에게 어떤 가치를, 왜 이 방식으로?', groups: ['research', 'problems', 'businessModel', 'alternatives'] },
  { key: 'design', label: '서비스 구조', question: '화면 뒤의 정책과 운영까지 설계했는가?', groups: ['serviceBlueprint', 'journey', 'requirements'] },
  { key: 'growth', label: '지표 · 실험', question: '어떤 행동을 바꾸고 무엇으로 확인했는가?', groups: ['metricLinks', 'experiments'] },
  { key: 'delivery', label: '출시 · 실행 책임', question: '제약과 이견 속에서 어디까지 책임졌는가?', groups: ['releases', 'risks', 'collaboration', 'troubleshooting'] },
];
export const PM_LENSES = [
  { key: 'balanced', label: '전체', order: ['impact', 'strategy', 'design', 'growth', 'delivery'] },
  { key: 'growth', label: '그로스 PM', order: ['impact', 'growth', 'strategy', 'design', 'delivery'] },
  { key: 'service', label: '서비스 · 플랫폼 기획', order: ['impact', 'design', 'delivery', 'strategy', 'growth'] },
  { key: 'business', label: '신사업 · B2B PM', order: ['impact', 'strategy', 'delivery', 'design', 'growth'] },
];
export const PM_COMPANY_REFERENCES = [
  ['당근', '광고 PM', '광고주 성과·사용자 경험·수익성의 충돌', 'https://careers.daangn.com/jobs/role/6640388003/'],
  ['쿠팡', 'SCM PM · 경력', '운영 흐름·범위·의존성·인수 검증', 'https://www.coupang.jobs/en/jobs/8139229/staff-product-manager/'],
  ['채널톡', 'B2B SaaS PM · 경력', '선행지표·고객 관찰·GTM·출시 후 확산', 'https://channel.io/kr/careers/efdb0709-e3d7-458c-b870-a86fb252fd01'],
  ['네이버웹툰', 'Growth 실무 인터뷰 · 2023', '세그먼트·리텐션·가설과 반복 실험', 'https://recruit.navercorp.com/cnts/people_detail?id=8'],
  ['LY Corporation', '신입 Product Planner', '서비스 기획·신규사업·사업 생애주기', 'https://www.lycorp.co.jp/en/recruit/newgrads/product-planner/'],
  ['Atlassian', 'PM 조직 소개', '고객 요구·실질 결과·협업과 전달력', 'https://www.atlassian.com/company/careers/teams'],
];
export const PM_PORTFOLIO_REFERENCES = [
  ['Sharon Gao', 'PM 공개 작업물 · 입사 당시 제출본 여부 미확인', 'AMS·Directive Games·AB InBev·Zynga 경험에서 제품 시연과 실제 책임 범위를 함께 설명', 'https://sharongao.com/'],
  ['Sam Girotra', 'PM 공개 포트폴리오 · 합격 인과 미확인', 'GameChanger·A+E·WSJ 사례의 통합·수익모델·비용과 편의성의 선택', 'https://www.samgirotra.com/portfolio.html'],
  ['Akshar Patel', 'Airtable 사내 PM 전환 후기 · 2025', 'PRD 작성부터 협업·고객 피드백·테스트·출시까지 실제 책임 확장. 외부 공채 합격 사례가 아님', 'https://www.linkedin.com/pulse/life-like-box-product-features-akshar-ap-patel-guaee'],
];
export function pmViewCount(item, view) {
  return view.groups.reduce((count, key) => count + (item.workProducts[key]?.length || 0), 0);
}
export function pmBrief(item) {
  const first = dimension => item.records.find(row => row.dimension === dimension)?.claim || '';
  return [
    ['문제와 기회', item.workProducts.problems[0]?.problem || item.workProducts.research[0]?.opportunity || first('discovery')],
    ['결정한 방향', item.workProducts.alternatives.find(row => row.disposition === '채택')?.option || first('prioritization')],
    ['내가 책임진 범위', item.workProducts.requirements.find(row => row.owner)?.owner || item.records.find(row => row.ownership)?.ownership || ''],
    ['확인한 변화 · 배움', first('outcome') || item.workProducts.troubleshooting[0]?.learning || first('learning')],
  ];
}
