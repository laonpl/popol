import test from 'node:test';
import assert from 'node:assert/strict';
import { organizeLocalFiles, findCoreLocalExperiences, splitLocalCandidate } from './localExperienceFiles.js';
import { localSourceKind, rankCoreExperiences } from '../../../local-connector/experienceSelection.mjs';

const source = (name, body, path = `내 파일/경험/${name}`) => ({ id: path, name, path, size: new TextEncoder().encode(body).length,
  getFile: async () => ({ name, size: new TextEncoder().encode(body).length, arrayBuffer: async () => new TextEncoder().encode(body).buffer }) });
const real = (title = '온보딩 개선 프로젝트') => `${title}\n역할: 서비스 기획자\n배경: 가입 과정에서 고객이 필수 입력 항목을 이해하지 못했습니다.\n한 일: 사용자 12명을 인터뷰하고 필수 항목을 줄인 가입 화면을 설계했습니다.\n성과: 가입 완료율이 42%에서 55%로 개선됐습니다.\n배운 점: 기능을 늘리기보다 사용자가 막힌 지점을 먼저 관찰하는 습관을 배웠습니다.`;

test('screenshotted survey, reel scripts, lecture notes and empty keyword matches are not core experiences', async () => {
  const junk = [
    source('NACE_2025_Student_Survey_Indeed.txt', '2025 NACE Student Survey\n대학생 채용 시장과 취업 준비 활동 분석\n인턴 프로젝트 결과: 응답자의 65%가 취업 지원 경험이 있다고 답했다.\n이 보고서는 전국 학생의 취업 준비 현황을 분석했다.'),
    source('FitPoly 릴스 07.txt', 'FitPoly 릴스 07\n2026.03\n나레이션: 프로젝트 파일이 흩어져 있나요?\n장면: 경험 정리 화면을 보여준다.\n직접 분석한 성과를 쉽고 빠르게 정리해드립니다.\n후킹 문구와 전환 유도 메시지를 작성한다.'),
    source('장애 이론의 종류.md', '장애 이론의 종류\n2026.03\n기획 프로젝트의 과제로 장애와 환경에 관한 이론을 분석했다.\n사회적 모델과 의료적 모델의 학습 내용을 정리한다.'),
    source('캠페인_예시.md', real('광고 캠페인 프로젝트')),
    source('프롬프트.md', '당신은 경험 분석가입니다.\n역할: PM\n한 일: 사용자 인터뷰를 진행하고 UI를 개발했습니다.\n성과: 가입자 300명 확보'),
    source('지원 계획.txt', '신규 서비스 프로젝트\n역할: 기획자\n한 일: 고객을 인터뷰하고 화면을 개발할 예정입니다.\n성과: 목표 가입자 1000명 확보'),
    source('수치.csv', '연구 프로젝트 지표 보고서\n일자, 노출, 클릭, 전환\n2026-01-01,30000,450,30\n분석 결과 전환율이 10% 개선됐다.'),
    source('외부 기업 사례.txt', '검색 개선 프로젝트 사례\n그 회사는 API를 직접 개발하고 검색 화면을 설계했습니다.\n성과: 검색 완료율 18% 개선'),
  ];
  const result = await organizeLocalFiles(junk, { experienceOnly: true });
  assert.equal(result.items.length, 0);
  assert.equal(result.failures.length, 0, 'excluded material is separate from unreadable files');
  assert.equal(result.rejected.length, junk.length);
  assert.ok(result.rejected.some(item => /본인이 맡은 역할/.test(item.reason)));
  assert.ok(result.rejected.some(item => /대본/.test(item.reason)));
});

test('real contributions survive without inflated metrics, including first-person records and shipped artifacts', async () => {
  const cases = [source('온보딩 회고.md', real()),
    source('동아리 회고.md', '동아리 공지 개선 프로젝트\n역할: 동아리 운영 담당\n한 일: 공지 게시판을 제작하고 새 회원들에게 안내하는 방식을 바꿨습니다.\n배운 점: 공지 내용을 늘리기보다 읽는 사람의 상황을 먼저 확인해야 한다는 점을 배웠습니다.'),
    source('배포 기록.md', '학과 일정 서비스 프로젝트\n저는 학과 일정 서비스의 API와 배포를 직접 맡아 구현했습니다.\n성과: 동아리 회원이 사용할 수 있는 시제품을 완성하고 배포했습니다.'),
  ];
  const result = await organizeLocalFiles(cases, { experienceOnly: true });
  assert.equal(result.items.length, 3);
  assert.ok(result.items.every(item => item.coreSelection.eligible && item.role && item.action));
  const club = result.items.find(item => item.title.includes('동아리'));
  assert.equal(club.result, '');
  assert.match(club.learning, /배웠/);
  assert.doesNotMatch(club.sourceText, /\d+%/);
});

test('same-project role/actions and outcome files combine before deciding whether evidence is sufficient', async () => {
  const result = await organizeLocalFiles([
    source('과정.md', '프로젝트명: 학교 공지 개선\n역할: 백엔드 개발자\n한 일: 공지 검색 API를 구현하고 회원 권한에 따라 결과를 분리했습니다.'),
    source('결과.md', '프로젝트명: 학교 공지 개선\n성과: 공지 검색 시제품을 완성하고 동아리 회원에게 배포했습니다.\n배운 점: 권한 검증을 요청 처리 앞단에 두는 방법을 배웠습니다.'),
  ], { experienceOnly: true });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].sourcePaths.length, 2);
  assert.equal(result.items[0].localDocuments.length, 2);
  assert.match(result.items[0].action, /권한/);
  assert.match(result.items[0].result, /배포/);
  assert.equal(result.rejected.length, 0);
});

test('versions of one named project are grouped while different projects stay separate', async () => {
  const first = await organizeLocalFiles([source('온보딩.md', real()), source('동아리.md', real('동아리 운영 프로젝트'))], { experienceOnly: true });
  const next = await organizeLocalFiles([source('온보딩_회고.md', real('온보딩 개선 프로젝트 회고'))], { experienceOnly: true });
  const ranked = rankCoreExperiences([...first.items, ...next.items]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked.find(item => item.title.includes('온보딩')).sourcePaths.length, 2);
});

test('automatic selection searches past an irrelevant first batch and never pads the shortlist with weak content', async () => {
  const files = [...Array.from({ length: 32 }, (_, i) => source(`참고자료_${i}.txt`, '프로젝트 회고 작성 방법\n기획과 개발의 성과를 정리하려면 사용자의 역할을 분석하고 결과를 설명해야 한다.')),
    source('내 회고.md', real()), source('내 활동.md', real('학교 축제 운영 프로젝트'))];
  const result = await findCoreLocalExperiences(files);
  assert.equal(result.offset, files.length);
  assert.equal(result.items.length, 2);
  assert.equal(result.rejected.length, 32);
  assert.equal(result.failures.length, 0);
});

test('partial evidence can become a core experience when the outcome arrives in a later file batch', async () => {
  const files = [source('운영 과정.md', '프로젝트명: 학교 축제 운영\n역할: 축제 운영 담당\n한 일: 팀 사이의 갈등을 해결하고 관객 안내 방식을 수정했습니다.'),
    ...Array.from({ length: 30 }, (_, i) => source(`참고자료_${i}.txt`, '외부 프로젝트의 주요 성과와 시장 조사 결과를 분석한 참고자료입니다.')),
    source('운영 결과.md', '프로젝트명: 학교 축제 운영\n성과: 축제를 개최하고 관객 피드백을 다음 행사 운영 방식에 반영했습니다.')];
  const result = await findCoreLocalExperiences(files);
  assert.equal(result.items.length, 1);
  assert.match(result.items[0].action, /갈등/);
  assert.match(result.items[0].result, /축제/);
  assert.equal(result.items[0].sourcePaths.length, 2);
  assert.equal(result.rejected.some(item => /운영 과정/.test(item.path)), false);
});

test('artifact names do not misclassify a genuine template-generator project as a document template', () => {
  assert.equal(localSourceKind('템플릿 생성기 프로젝트.md'), 'experience');
  assert.equal(localSourceKind('경험_템플릿.md'), 'template');
});

test('essays and reports with different titles merge by the project named in their body, across years', async () => {
  const result = await organizeLocalFiles([
    source('지원서 최종.md', '자기소개\n프로젝트명: QRious\n2025.11\n저는 QRious 서비스에서 백엔드 개발자로서 학술 데이터 검색 파이프라인을 구현했습니다.\n상황: 캠퍼스 구성원이 서로의 연구 관심사를 찾기 어려웠습니다.'),
    source('개발 기록.md', '검색 파이프라인 회고\n2026.05\nQRious 서비스의 학술 데이터를 벡터 색인으로 정리했습니다.\n성과: 교수와 학생의 연구 관심사를 연결하는 시제품을 완성하고 발표했습니다.'),
  ], { experienceOnly: true });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, 'QRious');
  assert.equal(result.items[0].sourcePaths.length, 2);
  assert.equal(result.items[0].localDocuments.length, 2);
  assert.match(result.items[0].action, /파이프라인/);
  assert.match(result.items[0].result, /시제품/);
  assert.ok(result.items[0].mergeReasons.some(reason => /QRious/.test(reason)));
  const again = rankCoreExperiences(result.items);
  assert.equal(again[0].localParts.length, 2, 'regrouping is idempotent');
  assert.equal(again[0].sourceText, result.items[0].sourceText);
});

test('common substantive paragraphs merge differently named essay and presentation files without a project label', async () => {
  const shared = '학술 자료에서 교수별 설명 방식을 분리하기 위해 연구 분야와 발화 예시를 함께 색인했습니다.\n검색 결과가 서로 섞이는 문제를 막기 위해 교수별 필터와 출처 표시 방식을 구현했습니다.';
  const result = await organizeLocalFiles([
    source('직무역량.md', `직무역량\n역할: AI 개발자\n${shared}\n성과: 학내 연구 관심사 검색 시제품을 완성했습니다.`),
    source('발표 정리.md', `연구자 연결 회고\n역할: AI 개발자\n${shared}\n배운 점: 근거를 확인할 수 있는 출처 표시의 중요성을 배웠습니다.`),
  ], { experienceOnly: true });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].sourcePaths.length, 2);
  assert.ok(result.items[0].mergeReasons.some(reason => /공통 본문/.test(reason)));
});

test('different named projects and shared career aspirations do not merge', async () => {
  const boilerplate = '이 경험을 바탕으로 귀사에서 RAG 검색 파이프라인을 개발하고 서비스를 개선하고 싶습니다.';
  const result = await organizeLocalFiles([
    source('학술 검색.md', `프로젝트명: ScholarLink\n역할: 개발 담당\n한 일: React와 RAG를 활용해 학술 자료 검색 화면을 개발했습니다.\n${boilerplate}`),
    source('상점 검색.md', `프로젝트명: ShopFinder\n역할: 개발 담당\n한 일: React와 RAG를 활용해 상점 상품 검색 화면을 개발했습니다.\n${boilerplate}`),
  ], { experienceOnly: true });
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every(item => !item.action.includes('싶습니다')));
});

test('personal experiences under essay headings and prompt-engineering work are retained', async () => {
  const result = await organizeLocalFiles([
    source('자소서.md', '자기소개\n프로젝트명: 학교 공지 검색\n저는 학교 공지 검색에서 개발자로서 검색 API와 오류 로그 수집을 구현했습니다.\n입사 후 포부\n이 경험을 바탕으로 귀사에서 더 큰 서비스를 만들고 싶습니다.'),
    source('프롬프트 설계 프로젝트.md', '프롬프트 개선 프로젝트\n역할: AI 개발자\n한 일: 프롬프트를 설계하고 오류 응답을 분류해 검색 조건을 수정했습니다.'),
  ], { experienceOnly: true });
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every(item => item.action && !item.action.includes('싶습니다')));
});

test('finding five early candidates does not hide later experiences or their related evidence', async () => {
  const early = Array.from({ length: 5 }, (_, index) => source(`활동${index}.md`, real(`운영 활동 ${index} 프로젝트`)));
  const files = [...early, ...Array.from({ length: 30 }, (_, index) => source(`참고자료${index}.md`, '외부 시장 자료와 학생들의 취업 현황을 정리한 참고자료입니다.')),
    source('늦은 회고.md', '프로젝트명: 드문 후반부 경험\n역할: 운영 담당\n한 일: 상담 일정을 조정하고 신청자 안내를 자동화했습니다.')];
  const result = await findCoreLocalExperiences(files);
  assert.equal(result.offset, files.length);
  assert.equal(result.items.length, 6);
  assert.ok(result.items.some(item => item.title === '드문 후반부 경험'));
});

test('resume-style noun bullets are retained without inventing a missing role', async () => {
  const result = await organizeLocalFiles([source('내 이력서.md', '프로젝트명: QRious\n2026.05\nRAG 파이프라인 설계\n교수별 벡터 색인 구축\n성과: 해커톤 2등 수상')], { experienceOnly: true });
  assert.equal(result.items.length, 1);
  assert.match(result.items[0].action, /파이프라인 설계/);
  assert.equal(result.items[0].role, '');
  assert.ok(result.items[0].coreSelection.missing.includes('내 역할'));
});

test('a separated group stays separate when sources are ranked again', async () => {
  const result = await organizeLocalFiles([
    source('첫 기록.md', real('예약 개선 프로젝트')),
    source('두 번째 기록.md', real('예약 개선 프로젝트 회고').replace('18%', '19%')),
  ], { experienceOnly: true });
  assert.equal(result.items.length, 1);
  const parts = splitLocalCandidate(result.items[0]);
  assert.equal(parts.length, 2);
  assert.equal(rankCoreExperiences(parts).length, 2);
});

test('documents in one project folder are read together and analyzed as one experience', async () => {
  const folder = '바탕화면/포트폴리오/쇼핑몰 리뉴얼';
  const files = [
    source('기획서.md', '역할: 서비스 기획자\n한 일: 장바구니 이탈 고객 8명을 인터뷰하고 결제 단계를 3단계로 줄이는 화면을 설계했습니다.', `${folder}/기획서.md`),
    ...Array.from({ length: 30 }, (_, index) => source(`참고자료${index}.md`, '외부 시장 자료와 학생들의 취업 현황을 정리한 참고자료입니다.', `바탕화면/참고/참고자료${index}.md`)),
    source('결과.md', '성과: 결제 완료율이 31%에서 44%로 개선됐습니다.\n배운 점: 고객이 멈춘 지점을 먼저 관찰해야 한다는 것을 배웠습니다.', `${folder}/발표/결과.md`),
  ];
  const result = await findCoreLocalExperiences(files, { maxDocuments: 2 });
  assert.equal(result.items.length, 1, 'the sibling is read in the same pass despite unrelated files in between');
  const [item] = result.items;
  assert.equal(item.title, '쇼핑몰 리뉴얼');
  assert.deepEqual(item.sourcePaths, [`${folder}/기획서.md`, `${folder}/발표/결과.md`]);
  assert.equal(item.localDocuments.length, 2);
  assert.match(item.action, /인터뷰/);
  assert.match(item.result, /44%/);
  assert.ok(item.mergeReasons.some(reason => reason.includes('같은 폴더')));
});

test('location, collection and mixed-project folders do not force a merge', async () => {
  const distinct = (title, work, outcome) => `${title}
역할: 운영 담당
한 일: ${work}
성과: ${outcome}`;
  const result = await findCoreLocalExperiences([
    source('a.md', distinct('예약 알림 개선', '병원 예약 알림 문구를 다시 쓰고 발송 시각을 하루 전으로 옮겼습니다.', '노쇼가 14건에서 6건으로 줄었습니다.'), '바탕화면/자소서/a.md'),
    source('b.md', distinct('동아리 회계 정리', '영수증 대장을 스프레드시트로 옮기고 월별 결산표를 만들었습니다.', '감사 지적 사항이 0건이 됐습니다.'), '바탕화면/자소서/b.md'),
    source('c.md', distinct('온보딩 개선 프로젝트', '가입 화면의 필수 입력을 줄이고 안내 문구를 바꿨습니다.', '가입 완료율이 42%에서 55%로 개선됐습니다.'), '바탕화면/캡스톤/c.md'),
    source('d.md', distinct('검색 추천 서비스 프로젝트', '검색 로그를 분류하고 추천 키워드 목록을 설계했습니다.', '검색 성공률이 20%에서 27%로 개선됐습니다.'), '바탕화면/캡스톤/d.md'),
    source('e.md', distinct('학과 일정 정리', '흩어진 학과 일정을 캘린더 한 곳에 모아 공유했습니다.', '문의 메일이 주 9건에서 2건으로 줄었습니다.'), '바탕화면/e.md'),
    source('f.md', distinct('공지 자동화 작업', '공지 메일 발송을 예약 스크립트로 자동화했습니다.', '발송 시간이 30분에서 5분으로 단축됐습니다.'), '바탕화면/f.md'),
  ]);
  assert.equal(result.items.length, 6);
});

test('weekly reports of one project are organized as one experience', async () => {
  const week = (n, work, outcome) => `역할: 서비스 기획자\n한 일: ${work}\n성과: ${outcome}`;
  const result = await findCoreLocalExperiences([
    source('동네 장터 보고서 1주차.md', week(1, '판매자 6명을 인터뷰하고 상품 등록 단계의 불편을 정리했습니다.', '등록 실패 원인 3가지를 확인했습니다.')),
    source('동네장터 보고서 2주차.md', week(2, '상품 등록 화면을 사진 한 장부터 시작하도록 다시 설계했습니다.', '등록 완료 시간이 7분에서 3분으로 단축됐습니다.')),
    source('제3회 창업 공모전.md', '제3회 창업 공모전\n역할: 발표 담당\n한 일: 반찬 구독 사업계획서를 작성하고 본선 발표를 진행했습니다.\n성과: 장려상을 수상했습니다.'),
    source('제4회 창업 공모전.md', '제4회 창업 공모전\n역할: 팀장\n한 일: 중고 교재 거래 서비스를 기획하고 시제품 화면을 제작했습니다.\n성과: 최우수상에 선정됐습니다.'),
  ]);
  const market = result.items.find(item => item.sourcePaths.length === 2);
  assert.ok(market, 'the two weekly reports are one candidate');
  assert.equal(market.title, '동네 장터');
  assert.match(market.action, /인터뷰/);
  assert.match(market.action, /다시 설계/);
  assert.ok(market.mergeReasons.some(reason => reason.includes('주차·회차')));
  assert.equal(result.items.length, 3, 'different editions of a competition stay separate');
});

test('meaningless titles and non-experience material are not candidates', async () => {
  const result = await findCoreLocalExperiences([
    // A portfolio-form guide: menu path title, present-tense explanations, no action of mine.
    source('자기계발 포트폴리오.md', '•생산관리>품질관리>프로젝트 매니저 직무 소개\n전남대에서 학생들을 위해 제공하는 포트폴리오 기본 양식으로, 줄여서 자계부라고 부른다.\n멘토는 10년 이상 쌓은 경력을 바탕으로 신입사원 교육과 역량 강화 워크숍 등을 기획하여 인력 양성에 힘쓴다.\n교내 장학금은 성적과 자계부 점수를 기준으로 선발하기에 대학생활에서 중요하다.'),
    // An AI prompt with template slots.
    source('면접 답변 만들기.md', '{프로젝트 정리 내용}\n[지원 직무] {지원 직무}\n출력 형식: 30초 요약 답변, 1분 답변, 3분 상세 답변을 작성해.\n내 역할을 명확히 설명하는 답변을 작성하고 꼬리질문 10개를 정리해.\n배운 점: 성과를 과장하지 말고 판단 과정과 배운 점을 말하는 법을 배웠다.'),
    // Book reports joined only by a URL.
    ...['언어의 온도', '젊은 느티나무', '일상의 교훈'].map((book, index) => source(`독서${index}.md`, `언어의\n${index ? 2017 : 2018}.12\n개인적으로 짧은 에세이를 읽는 것을 즐겨서 좋아하는 책이다.\n동명의 영화와 드라마로도 제작되었다.\n출처: https://blog.naver.com/example/${index}\n저자 소개: 『${book}』의 작가는 일상에서 보고 느낀 것을 쓴다.\n일상에서 교훈을 느낄 수 있는 작품이다.`)),
  ]);
  assert.equal(result.items.length, 0);
  assert.ok(result.supporting.every(item => !/https/.test((item.mergeReasons || []).join(' '))));
});

test('a real project whose heading is only a date range gets a usable title instead of the date fragment', async () => {
  const body = '2026.05.16 ~ 2026-05.17\n역할: 백엔드/AI 개발자\n한 일: 3만 건 학술 데이터를 처리하는 AI 페르소나 네트워킹 플랫폼의 RAG 파이프라인을 설계하고 구축했습니다.\n성과: LLM 환각을 줄이는 RAG 아키텍처를 채택해 시제품을 완성했습니다.';
  const result = await findCoreLocalExperiences([source('해커톤 회고.md', body)]);
  assert.equal(result.items.length, 1);
  assert.doesNotMatch(result.items[0].title, /^[.\d]|2026/);
  assert.match(result.items[0].title, /플랫폼|해커톤/);
});

test('a project report with sub-headings and dated meeting notes stays one experience', async () => {
  const report = ['쇼핑몰 리뉴얼 프로젝트', '역할: 서비스 기획자',
    '01. 프로젝트 개요', '장바구니에서 결제로 넘어가는 고객이 절반에 그쳤습니다.',
    '서비스 구조 설계', '결제 단계를 세 단계로 줄이는 화면 흐름을 설계했습니다.',
    '1차 회의 2026.03.05', '판매자 측 요구사항을 정리하고 우선순위를 합의했습니다.',
    '2차 회의 2026.03.19', '시제품으로 고객 8명에게 사용성 테스트를 진행했습니다.',
    '프로젝트 회고', '성과: 결제 완료율이 31%에서 44%로 개선됐습니다.'].join('\n');
  const result = await findCoreLocalExperiences([source('쇼핑몰 리뉴얼 결과보고서.md', report)]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, '쇼핑몰 리뉴얼 프로젝트');
  assert.match(result.items[0].action, /사용성 테스트/);
  assert.match(result.items[0].result, /44%/);
});

test('a portfolio is split by project and each entry joins that project’s own documents in any order', async () => {
  const portfolio = source('포트폴리오.md', ['01. 동네 장터 서비스', '2025.03 ~ 2025.06', '역할: 기획자', '한 일: 판매자 인터뷰로 상품 등록 화면을 다시 설계했습니다.',
    '02. 학교 축제 운영 프로젝트', '2025.09 ~ 2025.10', '역할: 운영 담당', '한 일: 관객 동선을 조정하고 안내 표지를 제작했습니다.'].join('\n'));
  const market = source('회의록.md', '프로젝트명: 동네 장터 서비스\n한 일: 등록 실패 로그를 분류하고 사진 업로드 단계를 줄였습니다.\n성과: 등록 시간이 7분에서 3분으로 단축됐습니다.', '바탕화면/동네 장터/회의록.md');
  const marketNotes = source('메모.md', '역할: 기획자\n한 일: 판매자 6명의 피드백을 표로 정리하고 개선 순서를 정했습니다.', '바탕화면/동네 장터/메모.md');
  const festival = source('축제 결과.md', '학교 축제 운영 프로젝트\n성과: 관객 1,200명이 방문했고 입장 대기 시간이 절반으로 줄었습니다.');
  const shape = items => items.map(item => [...item.sourcePaths].sort().join(' + ')).sort();
  const forward = await findCoreLocalExperiences([portfolio, market, marketNotes, festival]);
  const backward = await findCoreLocalExperiences([festival, marketNotes, market, portfolio]);
  assert.equal(forward.items.length, 2);
  assert.deepEqual(shape(forward.items), shape(backward.items), 'grouping does not depend on reading order');
  const marketGroup = forward.items.find(item => item.sourcePaths.length === 3);
  assert.equal(marketGroup.title, '동네 장터 서비스');
  assert.equal(marketGroup.period, '2025-03 ~ 2025-06');
});

test('an untitled note cannot bridge two differently named projects in one folder', async () => {
  const folder = '바탕화면/캡스톤 자료';
  const result = await findCoreLocalExperiences([
    source('a.md', '온보딩 개선 프로젝트\n역할: 기획자\n한 일: 가입 화면의 필수 입력을 줄이고 안내 문구를 바꿨습니다.\n성과: 가입 완료율이 42%에서 55%로 개선됐습니다.', `${folder}/a.md`),
    source('메모.md', '역할: 팀원\n한 일: 팀 회의 일정을 조율하고 회의 내용을 정리했습니다.', `${folder}/메모.md`),
    source('b.md', '검색 추천 서비스 프로젝트\n역할: 개발자\n한 일: 검색 로그를 분류하고 추천 키워드 목록을 설계했습니다.\n성과: 검색 성공률이 20%에서 27%로 개선됐습니다.', `${folder}/b.md`),
  ]);
  const titles = result.items.map(item => item.title);
  assert.ok(titles.some(title => title.includes('온보딩')));
  assert.ok(titles.some(title => title.includes('검색 추천')));
  assert.ok(result.items.every(item => !(item.title.includes('온보딩') && item.sourcePaths.some(path => path.endsWith('b.md')))));
});
