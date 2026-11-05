import test from 'node:test';
import assert from 'node:assert/strict';
import { isExperienceTitle, matchExperienceEvidence, resolveExperienceIdentity } from './experienceEvidence.mjs';
import { consolidateLocalEvidence } from './experienceSelection.mjs';

const record = (id, title, sourceText, extra = {}) => ({
  id, title, sourceText, sourcePaths: [`내 파일/경험/${id}.md`],
  role: '', action: '', result: '', learning: '', context: '', task: '',
  ...extra,
});

test('bare portfolio labels and business categories do not become experience titles', () => {
  for (const title of ['B2B', 'HIGHLIGHTS', 'PORTFOLIO', 'EMAIL', 'Problem', 'Design', 'Marketing', 'Component']) {
    assert.equal(isExperienceTitle(title), false, `${title} identifies a section or category, not a project`);
  }
  assert.equal(isExperienceTitle('B2B 고객 상담 절차 개선'), true);
  assert.equal(isExperienceTitle('QRious'), true);
});

test('a repeated HIGHLIGHTS heading does not join unrelated portfolio pages', () => {
  const files = [
    record('가입', 'HIGHLIGHTS', '역할: 서비스 기획자\n한 일: 가입 양식에서 불필요한 주소 입력을 없애고 인증 안내 문구를 수정했습니다.\n성과: 가입 완료율이 42%에서 55%로 개선됐습니다.'),
    record('축제', 'HIGHLIGHTS', '역할: 행사 운영 담당\n한 일: 축제 부스 사이 관객 동선을 조정하고 입구 안내 표지를 제작했습니다.\n성과: 입장 대기 시간이 20분에서 8분으로 줄었습니다.'),
  ];
  const groups = consolidateLocalEvidence(files);
  assert.equal(groups.length, 2);
  assert.ok(groups.every(group => group.title !== 'HIGHLIGHTS'));
});

test('generic English words and tools cannot serve as a distinctive shared project name', () => {
  for (const word of ['Marketing', 'Design', 'Problem', 'Figma', 'Google', 'ROAS', 'POINT', 'TensorFlow']) {
    const a = record('가입', '가입 경험', `역할: 서비스 기획자\n${word} 자료에서 고객 피드백과 실험 지표를 검토하고 회원 가입 안내 문구를 수정했습니다.\n성과: 가입 완료율이 상승했습니다.`);
    const b = record('광고', '광고 경험', `역할: 서비스 기획자\n${word} 자료에서 고객 피드백과 실험 지표를 검토하고 지역 축제 광고 예산을 다시 배분했습니다.\n성과: 관객 수가 증가했습니다.`);
    assert.equal(matchExperienceEvidence(a, b), null, `${word} alone is not an identity link`);
  }
});

test('an author email shared by unrelated files is not a project name', () => {
  const a = record('가입', '가입 경험', 'hello.yushin@example.com\n역할: 서비스 기획자\n고객 피드백과 실험 지표를 확인하고 회원 가입 화면의 필수 입력을 줄였습니다.\n성과: 가입 완료율이 개선됐습니다.');
  const b = record('축제', '축제 경험', 'hello.yushin@example.com\n역할: 서비스 기획자\n고객 피드백과 실험 지표를 확인하고 축제 행사장의 입장 안내를 변경했습니다.\n성과: 입장 대기 시간이 감소했습니다.');
  assert.equal(matchExperienceEvidence(a, b), null);
  assert.equal(consolidateLocalEvidence([a, b]).length, 2);
});

test('repeated contact and portfolio boilerplate is not shared substantive work', () => {
  const header = 'EMAIL portfolio.author@example.com · github.com/portfolio-author · 010-1234-5678\n문제 정의와 실행 과정, 주요 성과를 한눈에 확인할 수 있는 경험 포트폴리오입니다.\n모든 자료의 저작권은 작성자에게 있으며 별도 표시가 없는 한 무단 복제를 금지합니다.';
  const a = record('회계', '회계 업무', `${header}\n역할: 동아리 총무\n한 일: 영수증을 월별로 분류하고 결산표를 만들어 회원에게 공유했습니다.\n성과: 회계 감사 지적 사항이 없어졌습니다.`);
  const b = record('박람회', '박람회 운영', `${header}\n역할: 부스 운영자\n한 일: 박람회 현장의 대기열을 재배치하고 현장 안전 안내 표지를 제작했습니다.\n성과: 혼잡 시간이 15분에서 5분으로 단축됐습니다.`);
  assert.equal(consolidateLocalEvidence([a, b]).length, 2);
});

test('a document containing two experiences cannot bridge their unrelated source files', () => {
  const onboarding = '주소 입력을 여러 번 틀리는 회원의 가입 화면을 녹화하고 필수 입력을 줄이는 흐름을 설계했습니다.\n인증 문자 도착을 기다리는 동안 이탈하는 문제를 막기 위해 재전송 버튼과 대기 안내를 구현했습니다.';
  const festival = '축제장 입구에 관객이 몰리는 원인을 확인하기 위해 관객 동선과 출입구별 체류 시간을 측정했습니다.\n안전 통로를 확보하기 위해 부스를 재배치하고 입구와 출구를 구분하는 안내 표지를 제작했습니다.';
  const a = record('가입', '가입 화면 개선', `역할: 기획자\n${onboarding}`);
  const bridge = record('종합', '주요 업무 기록', `역할: 팀원\n${onboarding}\n${festival}`);
  const c = record('축제', '축제 현장 운영', `역할: 운영 담당\n${festival}`);
  for (const files of [[a, bridge, c], [c, bridge, a]]) {
    const groups = consolidateLocalEvidence(files);
    assert.ok(groups.every(group => !(group.sourcePaths.includes(a.sourcePaths[0]) && group.sourcePaths.includes(c.sourcePaths[0]))), 'a weak chain must not merge the independent onboarding and festival records');
  }
});

test('explicit project identity still joins complementary work and outcome files', () => {
  const a = record('개발기록', '개발 기록', '프로젝트명: QRious\n역할: 백엔드 개발자\n한 일: 교수별 연구 관심사를 찾도록 학술 자료 검색 파이프라인을 구현했습니다.');
  const b = record('최종발표', '최종 발표', 'QRious 서비스의 검색 결과를 교수별로 분리했습니다.\n성과: 교수와 학생의 연구 관심사를 연결하는 시제품을 완성했습니다.');
  const [group] = consolidateLocalEvidence([a, b]);
  assert.equal(group.title, 'QRious');
  assert.equal(group.localParts.length, 2);
  assert.ok(group.mergeReasons.some(reason => reason.includes('QRious')));
});

test('substantive matching paragraphs still join differently named copies of the same experience', () => {
  const shared = '학술 자료에서 교수별 설명 방식을 분리하기 위해 연구 분야와 발화 예시를 함께 색인했습니다.\n검색 결과가 서로 섞이는 문제를 막기 위해 교수별 필터와 출처 표시 방식을 구현했습니다.';
  const a = record('직무역량', '직무역량', `역할: AI 개발자\n${shared}\n성과: 학내 연구 관심사 검색 시제품을 완성했습니다.`);
  const b = record('발표정리', '연구자 연결 회고', `역할: AI 개발자\n${shared}\n배운 점: 출처 표시의 중요성을 배웠습니다.`);
  assert.equal(consolidateLocalEvidence([a, b]).length, 1);
});

test('generic headings fall back to source-backed names instead of hiding a real experience', () => {
  const item = resolveExperienceIdentity(record('회의록', 'HIGHLIGHTS', '프로젝트명: 학교 공지 검색\n역할: 개발자\n한 일: 학과 공지를 검색하는 화면을 구현했습니다.'));
  assert.equal(item.title, '학교 공지 검색');
  assert.equal(item.needsTitleReview, false);
});

test('a shared folder cannot combine unrelated work with generic document names', () => {
  const folder = { key: '바탕화면/자료 모음', name: '자료 모음' };
  const a = record('기획서', '기획서', '역할: 동아리 총무\n한 일: 영수증을 월별로 분류하고 누락 항목을 확인해 결산표를 만들었습니다.\n성과: 회계 감사 지적 사항이 없어졌습니다.', { wholeDocument: true, experienceFolder: folder });
  const b = record('결과', '결과', '역할: 행사 운영 담당\n한 일: 축제장 관객 동선을 조정하고 출입구를 분리하는 안내 표지를 제작했습니다.\n성과: 입장 대기 시간이 20분에서 8분으로 줄었습니다.', { wholeDocument: true, experienceFolder: folder });
  assert.equal(consolidateLocalEvidence([a, b]).length, 2);
});

test('a project folder still joins complementary documents sharing their concrete subject', () => {
  const folder = { key: '바탕화면/쇼핑몰 리뉴얼', name: '쇼핑몰 리뉴얼' };
  const a = record('기획서', '기획서', '역할: 서비스 기획자\n한 일: 장바구니 이탈 고객 8명을 인터뷰하고 결제 단계를 3단계로 줄이는 화면을 설계했습니다.', { wholeDocument: true, experienceFolder: folder });
  const b = record('결과', '결과', '성과: 결제 완료율이 31%에서 44%로 개선됐습니다.\n배운 점: 고객이 멈춘 지점을 먼저 관찰해야 한다는 것을 배웠습니다.', { wholeDocument: true, experienceFolder: folder });
  const groups = consolidateLocalEvidence([a, b]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, '쇼핑몰 리뉴얼');
  assert.equal(groups[0].localParts.length, 2);
});

test('empty text and identical role labels are insufficient to establish document copies', () => {
  for (const sourceText of ['', '역할: 서비스 기획자']) {
    const a = record('a', '메모', sourceText);
    const b = record('b', '메모', sourceText);
    assert.equal(consolidateLocalEvidence([a, b]).length, 2, `${JSON.stringify(sourceText)} is not substantive duplicate evidence`);
  }
});

test('a generic note cannot bridge differently named projects inside one folder', () => {
  const folder = { key: '바탕화면/캡스톤 자료', name: '캡스톤 자료' };
  const extra = { wholeDocument: true, experienceFolder: folder };
  const a = record('가입개선', '기획서', '프로젝트명: 회원 가입 개선\n역할: 기획자\n한 일: 가입 화면의 필수 입력을 줄이고 인증 문구를 수정했습니다.', extra);
  const note = record('회의메모', '메모', '역할: 팀원\n한 일: 팀 회의 일정을 조율하고 회의 내용을 정리했습니다.', extra);
  const b = record('축제운영', '결과', '프로젝트명: 축제 현장 운영\n역할: 운영 담당\n한 일: 관객 동선을 조정하고 안전 통로를 확보하는 안내 표지를 제작했습니다.', extra);
  for (const files of [[a, note, b], [b, note, a]]) {
    const groups = consolidateLocalEvidence(files);
    assert.ok(groups.every(group => !(group.sourcePaths.includes(a.sourcePaths[0]) && group.sourcePaths.includes(b.sourcePaths[0]))));
  }
});

test('project names found only inside embedded source code do not identify the prose experience', () => {
  const embedded = "```javascript\nconst example = 'DemoTown 서비스의 API 사용 방법';\n```";
  const a = record('예약회고', '예약 알림 개선', `역할: 개발자\n한 일: 병원 예약 알림 문구를 수정하고 발송 시간을 하루 전으로 옮겼습니다.\n${embedded}`);
  const b = record('행사회고', '축제 현장 운영', `역할: 운영 담당\n한 일: 관객 동선을 재배치하고 출입구 안내 표지를 제작했습니다.\n${embedded}`);
  const identity = resolveExperienceIdentity(a);
  assert.equal(identity.title, '예약 알림 개선');
  assert.deepEqual(identity.projectNames, []);
  assert.equal(consolidateLocalEvidence([a, b]).length, 2);
});

test('a shared action verb is not a shared concrete subject within one folder', () => {
  const folder = { key: '바탕화면/활동 자료', name: '활동 자료' };
  const extra = { wholeDocument: true, experienceFolder: folder };
  const a = record('회계정리', '기획서', '역할: 총무\n한 일: 월별 영수증 누락을 찾아 결산표를 작성했습니다.', extra);
  const b = record('예약화면', '결과', '역할: 디자이너\n한 일: 사용자의 예약 실수를 줄이기 위한 안내 문구를 작성했습니다.', extra);
  assert.equal(consolidateLocalEvidence([a, b]).length, 2);
});

test('folder links cannot bypass group-wide evidence through a mixed-topic note', () => {
  const folder = { key: '바탕화면/활동 자료', name: '활동 자료' };
  const extra = { wholeDocument: true, experienceFolder: folder };
  const a = record('회계자료', '기획서', '역할: 총무\n한 일: 영수증 누락을 찾아 월별 결산표를 작성했습니다.', extra);
  const bridge = record('운영메모', '메모', '역할: 담당자\n한 일: 영수증 보관 기준을 정리하고 관객 응대 매뉴얼을 배포했습니다.', extra);
  const c = record('현장자료', '결과', '역할: 안내 담당\n한 일: 관객 이동을 측정해 축제장 안전 통로를 재배치했습니다.', extra);
  for (const files of [[a, bridge, c], [c, bridge, a]]) {
    const groups = consolidateLocalEvidence(files);
    assert.ok(groups.every(group => !(group.sourcePaths.includes(a.sourcePaths[0]) && group.sourcePaths.includes(c.sourcePaths[0]))), 'folder chains need direct support across the full group');
  }
});

test('a repeated file-derived title is not a project identity without content support', () => {
  const a = record('총무', '주요 활동', '역할: 총무\n한 일: 영수증 누락을 찾아 월별 결산표를 작성했습니다.', { titleOrigin: 'source_file', sourcePaths: ['내 파일/회계/주요 활동.md'] });
  const b = record('축제', '주요 활동', '역할: 안내 담당\n한 일: 관객 이동을 측정해 축제장 안전 통로를 재배치했습니다.', { titleOrigin: 'source_file', sourcePaths: ['내 파일/축제/주요 활동.md'] });
  assert.equal(consolidateLocalEvidence([a, b]).length, 2);
});

test('a file-derived project name confirmed in both bodies remains useful identity evidence', () => {
  const a = record('과정', '동네 장터', '역할: 기획자\n한 일: 동네 장터 판매자 6명을 인터뷰하고 상품 등록 단계를 줄이는 화면을 설계했습니다.', { titleOrigin: 'source_file', sourcePaths: ['내 파일/기획/동네 장터.md'] });
  const b = record('결과', '동네 장터', '성과: 동네 장터의 상품 등록 완료 시간이 7분에서 3분으로 단축됐습니다.', { titleOrigin: 'source_file', sourcePaths: ['내 파일/성과/동네 장터.md'] });
  const groups = consolidateLocalEvidence([a, b]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, '동네 장터');
});

test('an explicit two-character project name still joins complementary source documents', () => {
  const a = record('설계', '설계 기록', '프로젝트명: 나무\n역할: 기획자\n한 일: 운동 습관을 기록하는 달력 화면을 설계했습니다.');
  const b = record('배포', '배포 회고', '프로젝트명: 나무\n성과: 학생 20명에게 운동 기록 시제품을 배포했습니다.');
  const groups = consolidateLocalEvidence([a, b]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, '나무');
});

test('a confirmed project name takes precedence over a different descriptive service heading', () => {
  const a = record('과정', '개발 기록', '프로젝트명: QRious\n역할: 백엔드 개발자\n한 일: 교수별 학술 자료를 분리하는 검색 파이프라인을 구현했습니다.');
  const b = record('성과', '연구 관심사 연결 서비스', 'QRious의 검색 결과를 교수별로 분리했습니다.\n성과: 학내 연구 관심사를 연결하는 시제품을 완성했습니다.');
  const groups = consolidateLocalEvidence([a, b]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'QRious');
});

test('a bare trailing project number is an identity, not a weekly report marker', () => {
  const body = '역할: 기획자\n한 일: 사용자 인터뷰를 진행하고 검색 화면을 개선했습니다.\n성과: 검색 완료율 18% 개선';
  const a = record('프로젝트0', '자동 탐색 프로젝트 0', body);
  const b = record('프로젝트1', '자동 탐색 프로젝트 1', body);
  assert.equal(consolidateLocalEvidence([a, b]).length, 2);
});

test('metadata and participation clauses cannot be used as project titles', () => {
  for (const title of ['기간', '수행 기간', '기간 2025.09 ~ 2025.12', '팀 구성', '핵심 지표',
    '해커톤 팀의 백엔드/AI 개발자로 참여하여', '개발자로 참여한', '캠페인을 담당하며', '백엔드/AI 개발자', 'Marketing Intern · 캠페인 오너']) {
    assert.equal(isExperienceTitle(title), false, title);
  }
  assert.equal(isExperienceTitle('기간 단축을 위한 예약 API 개선'), true);
  assert.equal(isExperienceTitle('해커톤 AI 페르소나 네트워킹 플랫폼 구축'), true);
});

test('a source description fixes a participation fragment without making a shared category an identity', () => {
  const a = record('검색', '해커톤 팀의 백엔드/AI 개발자로 참여하여', '역할: 백엔드 개발자\n한 일: AI 학술 검색 플랫폼에서 연구자별 벡터 색인과 출처 필터를 구현했습니다.');
  const b = record('알림', '기간', '역할: 기획자\n한 일: AI 학술 검색 플랫폼의 가입 알림 문구를 수정하고 이메일 발송 시간을 변경했습니다.');
  const identity = resolveExperienceIdentity(a);
  assert.equal(identity.title, 'AI 학술 검색 플랫폼');
  assert.equal(identity.titleOrigin, 'source_description');
  assert.equal(consolidateLocalEvidence([a, b]).length, 2, 'a source-backed description is useful for display but not a unique project name');
});

test('a future career aspiration is not used as the name of past work', () => {
  const item = resolveExperienceIdentity(record('자소서', '기간', '저는 인증 API를 설계하고 오류 로그 수집을 구현했습니다.\n입사 후에는 AI 페르소나 네트워킹 플랫폼을 개발하고 싶습니다.'));
  assert.doesNotMatch(item.title, /AI 페르소나/);
  assert.equal(item.needsTitleReview, true);
});
