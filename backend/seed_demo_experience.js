/**
 * seed_demo_experience.js — 특정 계정에 "꽉 채운" 예시 경험 1건을 실제로 저장 (일회용)
 *
 * 실행:  backend 디렉터리에서  node seed_demo_experience.js [email]
 *        (email 생략 시 기본값: gudrbs25781445@gmail.com)
 *
 * 같은 계정에 이미 이 스크립트로 넣은 시드(seedTag)가 있으면 지우고 새로 넣습니다(중복 방지).
 */
import admin from 'firebase-admin';
import { adminDb, adminAuth } from './src/config/firebase.js';
import dotenv from 'dotenv';
dotenv.config();

const SEED_TAG = 'demo-case-study-v1';
const year = new Date().getFullYear();

function buildExperience(uid) {
  return {
    userId: uid,
    seedTag: SEED_TAG,
    title: '흩어진 학내 공지를 하나로, 공지 누락률 32% 감소',
    framework: 'STRUCTURED',
    jobCategory: 'pm',
    period: `${year}.03 ~ ${year}.06`,
    status: 'finished',
    classify: ['프로젝트', '팀 리딩'],
    keywords: ['문제정의', '사용자 인터뷰', '프로토타입', 'A/B 테스트', '데이터 기반 의사결정', '지표 설계'],
    skills: ['Figma', 'React', 'Firebase', 'GA4', '데이터 분석'],
    content: { rawInput: '' },
    images: [],
    analysisMode: 'enhanced',
    structuredResult: {
      jobCategory: 'pm',
      projectOverview: {
        role: 'PM 겸 프론트엔드 (1인 2역)',
        team: '기획 1 · 개발 2 · 디자인 1 (총 4명)',
        goal: '5개 채널에 흩어진 학내 공지를 한곳에 모아, 공지 누락과 반복 확인 시간을 줄인다',
        summary: '학과 홈페이지·카톡·에브리타임 등 5개 채널에 분산된 학내 공지를 한 화면에서 받아보도록 재설계해, 공지 누락률과 반복 확인 시간을 동시에 낮춘 프로젝트입니다.',
        background: '재학생 대상 공지가 학과 홈페이지, 학교 포털, 카카오톡 단체방, 에브리타임, 인스타그램 5개 채널에 흩어져 있어 학생들은 매일 여러 곳을 돌며 확인해야 했고, 장학·수강신청 같은 중요한 공지를 놓치는 일이 반복됐습니다.',
        scopeOfImpact: '재학생 약 1,200명 · 학과 행정팀 공지 운영 프로세스',
        duration: `${year}.03 ~ ${year}.06`,
        techStack: ['Figma', 'React', 'Firebase', 'GA4', 'Notion'],
      },
      intro: '“분명 공지를 봤는데 또 놓쳤다.” 같은 과 동기 12명 중 9명이 최근 한 달 안에 중요한 공지를 놓친 경험이 있었습니다. 공지 자체가 부족한 게 아니라, 5개 채널에 흩어져 있어 한눈에 볼 수 없는 게 문제였습니다. 이 흐름을 한곳으로 모으는 개선 프로젝트를 PM 겸 프론트엔드로 직접 리드했습니다.',
      overview: '프로젝트 시작 전, 정말 “채널 분산”이 핵심 문제인지부터 검증했습니다. 재학생 84명 설문과 12명 심층 인터뷰를 진행한 결과, 응답자의 78%가 “공지를 확인하는 채널이 너무 많다”를 1순위 불편으로 꼽았습니다. 경쟁 서비스(에브리타임 공지함, 카카오 채널)를 벤치마킹해 “한 화면 통합 + 읽음 표시 + 키워드 알림” 세 가지를 핵심 가치로 정의했습니다.',
      task: '제가 맡은 일은 (1) 문제 정의와 가설 설계, (2) 인터뷰·설문 설계와 분석, (3) 핵심 화면 3종 프로토타입 제작, (4) A/B 테스트 지표 설계였습니다. 배경(채널 분산) → 문제(누락·반복 확인) → 핵심(통합 피드와 읽음 상태) → 해결(프로토타입 검증)의 순서로, 기획과 프론트엔드 구현을 오가며 진행했습니다.',
      process: '12명 인터뷰에서 나온 불편을 “찾기 어려움 / 놓침 / 반복 확인” 3가지 흐름으로 묶고, 빈도×영향도 기준으로 우선순위를 매겼습니다. 가장 임팩트가 큰 “통합 공지 피드”부터 Figma로 설계하고 React+Firebase로 동작하는 프로토타입을 만들어 1주 단위로 사용성 테스트를 돌렸습니다. 알림을 “전체 발송 vs 키워드 구독” 두 안으로 나눠 A/B 테스트하고, 구독자 50명 대상 GA4 이벤트로 열람률을 비교했습니다.',
      output: '키워드 구독 안이 전체 발송 대비 공지 열람률이 41% 높았고, 2주 사용성 테스트에서 만족도 4.6/5를 기록했습니다. 최종적으로 공지 확인 누락률을 32% 낮추고, 하루 평균 공지 확인 시간을 6.2분에서 3.4분으로 줄이는 개선안을 도출해 학과 행정팀 리뷰에서 즉시 적용 가능한 안으로 채택됐습니다.',
      growth: '“체감상 불편하다”를 수치로 옮기는 법을 배웠습니다. 처음엔 막연히 “공지가 불편하다”고만 생각했지만, 설문·인터뷰·GA4 지표로 문제를 정량화하니 팀과 행정팀을 설득하는 힘이 완전히 달라졌습니다. 또한 알림을 A/B로 검증하면서, 내 직관이 틀릴 수 있음을 데이터로 확인하는 습관이 생겼습니다.',
      competency: '문제를 데이터로 정의하고, 가설을 실험으로 검증하며, 기획과 구현을 끝까지 연결하는 역량을 갖췄습니다. 사용자 리서치(설문·인터뷰)로 문제를 발굴하고, 우선순위 프레임으로 자원을 배분하며, A/B 테스트와 GA4 지표로 의사결정을 정량화합니다. PM과 프론트엔드를 겸하며 “기획 의도가 화면까지 손실 없이 전달되도록” 만드는 것이 강점입니다.',
      keyExperiences: [
        {
          title: '설문 84명·인터뷰 12명으로 진짜 문제를 정의',
          metricLabel: '1순위 불편 응답 비율',
          metric: '78%가 채널 분산 지목',
          beforeMetric: '추측',
          afterMetric: '78% 검증',
          context: '“공지가 불편하다”는 막연한 체감만 있고, 무엇이 진짜 문제인지 합의가 없었습니다.',
          action: '설문 84명과 심층 인터뷰 12명을 직접 설계·진행하고, 불편을 “찾기 어려움/놓침/반복 확인” 3가지 흐름으로 구조화했습니다.',
          result: '응답자의 78%가 “채널이 너무 많다”를 1순위 불편으로 꼽아, 채널 분산이 핵심 문제임을 데이터로 확정했습니다.',
          learning: '문제를 수치로 고정하니 이후 모든 의사결정의 기준이 명확해졌습니다.',
          keywords: ['사용자 인터뷰', '문제정의', '정량화'],
        },
        {
          title: '알림 방식을 A/B 테스트해 열람률 41% 개선',
          metricLabel: '공지 열람률 (구독 vs 전체)',
          metric: '+41%',
          beforeMetric: '전체 발송',
          afterMetric: '키워드 구독 +41%',
          context: '모든 공지를 전체 발송하면 알림 피로로 오히려 열람률이 떨어질 거라는 우려가 있었습니다.',
          action: '“전체 발송 vs 키워드 구독” 두 안을 GA4 이벤트로 설계하고 구독자 50명을 무작위 배정해 2주간 열람률을 비교했습니다.',
          result: '키워드 구독 안의 열람률이 전체 발송 대비 41% 높게 나와, 구독형 알림을 최종 채택했습니다.',
          learning: '직관(전체 발송이 안전)이 데이터로 뒤집히는 경험을 통해 가설 검증의 가치를 체득했습니다.',
          keywords: ['A/B 테스트', 'GA4', '데이터 기반 의사결정'],
        },
        {
          title: '통합 공지 피드 프로토타입으로 누락률 32% 감소',
          metricLabel: '공지 확인 누락률',
          metric: '-32%',
          beforeMetric: '하루 6.2분',
          afterMetric: '하루 3.4분',
          context: '핵심 가치인 “한 화면 통합”이 실제로 누락을 줄이는지 검증이 필요했습니다.',
          action: 'Figma 설계를 React+Firebase 동작 프로토타입으로 만들어 1주 단위 사용성 테스트를 3회 반복하고 읽음 표시·키워드 필터를 추가했습니다.',
          result: '공지 확인 누락률 32% 감소, 하루 평균 확인 시간 6.2분→3.4분, 만족도 4.6/5를 기록하며 행정팀 채택안이 됐습니다.',
          learning: '기획 의도를 동작하는 화면으로 빠르게 옮길수록 검증 사이클이 짧아진다는 걸 배웠습니다.',
          keywords: ['프로토타입', 'React', '사용성 테스트'],
        },
      ],
      highlights: [
        { type: 'core', field: 'overview', text: '재학생 84명 설문과 12명 심층 인터뷰', keywords: ['사용자 리서치', '문제정의'] },
        { type: 'core', field: 'process', text: '빈도×영향도 기준으로 우선순위', keywords: ['우선순위 설계'] },
        { type: 'derived', field: 'process', text: '두 안으로 나눠 A/B 테스트', keywords: ['A/B 테스트', '실험 설계'] },
        { type: 'derived', field: 'output', text: '키워드 구독 안이 전체 발송 대비 공지 열람률이 41% 높았고', keywords: ['데이터 분석'] },
        { type: 'growth', field: 'growth', text: '내 직관이 틀릴 수 있음을 데이터로 확인하는 습관', keywords: ['데이터 기반 의사결정'] },
      ],
      jobSpecific: {
        strategy: '핵심 기능을 “통합 공지 피드”로 한정하고, 읽음 표시·키워드 구독을 보조 기능으로 배치했습니다. 유저 플로우는 “앱 진입 → 통합 피드 → 키워드 구독 설정 → 알림 수신”으로 단순화해, 학생이 채널을 옮겨다니지 않고 한 화면에서 모든 공지를 소화하도록 설계했습니다.',
        msc: '초기 최소 성공 기준(MSC)을 “사용성 테스트 만족도 4.0/5 이상 & 공지 누락률 20% 이상 감소”로 설정했습니다. 실제로는 만족도 4.6/5, 누락률 32% 감소로 두 기준을 모두 초과 달성했습니다.',
        businessImpact: '학과 행정팀의 공지 운영 프로세스에 채택되어, 공지 1건당 평균 도달률이 상승하고 “공지를 못 봤다”는 문의 응대 시간이 줄었습니다. 재학생 약 1,200명 규모로 확장 시 행정 커뮤니케이션 비용 절감이 기대된다는 평가를 받았습니다.',
      },
      marketResearch: {
        marketOverview: '대학 공지 전달은 “채널 분산 + 푸시 피로” 문제를 공통으로 안고 있습니다. 에브리타임 공지함, 카카오 채널 등 기존 서비스는 통합 수집은 하지만 개인화된 키워드 구독과 읽음 상태 관리가 약해, 통합 피드 + 구독형 알림 조합이 차별점이 됩니다.',
        decisionMetrics: [
          { metric: '공지 열람률 (Open Rate)', whyItMatters: '공지가 실제로 읽혔는지를 보여주는 핵심 지표로, 전달 방식의 효과를 직접 측정합니다.', recommendedProxy: 'GA4 공지 상세 진입 이벤트 / 발송 수', researchBasis: '구독자 50명 A/B 테스트에서 구독형이 전체 발송 대비 41%↑', confidence: 'high' },
          { metric: '공지 확인 누락률', whyItMatters: '서비스가 해결하려는 문제(놓침)를 직접 가리키는 지표입니다.', recommendedProxy: '사후 설문 “최근 1개월 내 중요한 공지를 놓친 적 있다” 비율', researchBasis: '사용성 테스트 전후 비교에서 32% 감소', confidence: 'medium' },
          { metric: '하루 평균 공지 확인 시간', whyItMatters: '반복 확인의 비효율을 시간으로 환산해, 통합의 효용을 보여줍니다.', recommendedProxy: '인터뷰·다이어리 스터디 자기보고 평균', researchBasis: '6.2분 → 3.4분으로 단축', confidence: 'medium' },
        ],
        sourceNotes: [
          { title: '재학생 공지 이용 행태 설문(84명)', publisher: '자체 조사', url: '', checkedAt: `${year}.03`, usage: '문제 정의 및 1순위 불편 도출' },
          { title: '에브리타임·카카오 채널 공지 기능 벤치마킹', publisher: '데스크 리서치', url: '', checkedAt: `${year}.03`, usage: '차별점(키워드 구독·읽음 상태) 정의' },
        ],
        portfolioAngles: [
          '“막연한 불편”을 설문·인터뷰·GA4로 정량화한 문제 정의 과정',
          '직관을 A/B 테스트로 검증해 의사결정을 뒤집은 데이터 기반 사고',
        ],
        limitations: '열람률·누락률은 구독자 50명·재학생 84명 규모의 표본이라 전교 단위로 일반화하려면 추가 검증이 필요합니다. 외부 수치는 비교 기준으로만 사용했습니다.',
      },
      keywords: ['문제정의', '사용자 인터뷰', '프로토타입', 'A/B 테스트', '데이터 기반 의사결정', '지표 설계', 'GA4', '우선순위 설계'],
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function main() {
  const email = process.argv[2] || 'gudrbs25781445@gmail.com';
  const user = await adminAuth.getUserByEmail(email);
  console.log(`대상 계정: ${email}  (uid: ${user.uid})`);

  // 이전에 같은 스크립트로 넣은 시드 제거 (중복 방지)
  // 복합 인덱스를 피하려 userId로만 조회 후 seedTag는 JS에서 필터링
  const mine = await adminDb.collection('experiences').where('userId', '==', user.uid).get();
  const stale = mine.docs.filter(d => d.data().seedTag === SEED_TAG);
  if (stale.length) {
    const batch = adminDb.batch();
    stale.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`기존 시드 ${stale.length}건 삭제`);
  }

  const ref = await adminDb.collection('experiences').add(buildExperience(user.uid));
  console.log(`✅ 예시 경험 저장 완료. 문서 ID: ${ref.id}`);
  console.log(`   케이스 스터디:  /app/experience/result/${ref.id}`);
  console.log(`   자세히보기:     /app/experience/structured/${ref.id}`);
  process.exit(0);
}

main().catch(e => { console.error('❌ 시드 실패:', e.message); process.exit(1); });
