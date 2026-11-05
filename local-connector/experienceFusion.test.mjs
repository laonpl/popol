import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidateLocalEvidence } from './experienceSelection.mjs';
import { experienceEvidenceLink } from './experienceEvidence.mjs';

function source(id, title, body, extra = {}) {
  const path = `내 파일/${id}.md`;
  const sourceText = `${title}\n${body}`;
  return { id, title, sourceText, sourcePaths: [path], localDocuments: [{ path, text: sourceText }],
    role: '', context: '', task: '', action: '', result: '', learning: '', ...extra };
}
const shape = groups => groups.map(group => [...group.sourcePaths].sort().join(' + ')).sort();

test('paraphrased report, essay and portfolio of one hackathon are a single experience', () => {
  const report = source('해커톤 결과보고서', 'AI 페르소나 네트워킹 플랫폼 구축',
    '2026.05.16 ~ 2026.05.17\n역할: 백엔드/AI 개발자\n해커톤에서 3만 건 학술 데이터를 수집하고 교수별 연구 관심사를 벡터 색인으로 구성했습니다.\n연구자를 연결하는 AI 페르소나 네트워킹 플랫폼의 RAG 파이프라인을 설계하여 검색 결과에 교수별 필터와 출처를 표시했습니다.\n성과: 해커톤에서 학술 검색 시제품을 발표하고 2등을 수상했습니다.',
    { titleOrigin: 'source_description' });
  const essay = source('직무역량 자소서', '연구자 연결을 위한 검색 경험',
    '저는 이틀간 열린 해커톤의 백엔드 개발을 맡았습니다.\n학술 논문 30,000건을 다루면서 교수별 연구 관심사가 뒤섞이는 문제를 확인했습니다.\nAI 페르소나 네트워킹 플랫폼에 RAG 파이프라인을 구축하고 벡터 색인을 교수 단위로 나눴습니다.\n검색 결과에 출처를 붙이는 방식으로 환각을 줄였고 완성한 시제품은 해커톤 2등을 받았습니다.');
  const portfolio = source('포트폴리오 프로젝트', '교수 페르소나 검색 시스템',
    '기간: 2026.05\n역할: 검색 파이프라인 담당\n교수별 학술 자료 3만 건을 대상으로 AI 페르소나를 만드는 네트워킹 플랫폼을 구현했습니다.\nRAG 파이프라인의 벡터 색인과 출처 필터를 담당해 교수별 연구 관심사를 연결하는 검색을 완성했습니다.\n결과: 이틀간의 해커톤 시연을 마치고 2등 수상으로 개발 결과를 확인했습니다.');
  const files = [report, essay, portfolio];
  for (let i = 0; i < files.length; i += 1) {
    for (let j = i + 1; j < files.length; j += 1) {
      const sentences = files[i].sourceText.split('\n').filter(line => line.length > 24);
      assert.ok(sentences.every(line => !files[j].sourceText.includes(line)), 'the fixture must not depend on copied paragraphs');
    }
  }
  const forward = consolidateLocalEvidence(files);
  const reverse = consolidateLocalEvidence([...files].reverse());
  assert.equal(forward.length, 1, 'the same academic-data/persona/RAG event should not produce three cards');
  assert.equal(forward[0].localParts.length, 3);
  assert.equal(forward[0].localDocuments.length, 3);
  assert.equal(forward[0].sourcePaths.length, 3);
  assert.ok(forward[0].mergeReasons.length > 0);
  assert.deepEqual(shape(forward), shape(reverse), 'fusion must not depend on the reading order');
  const laterBatch = consolidateLocalEvidence([...consolidateLocalEvidence([report, essay]), portfolio]);
  assert.deepEqual(shape(laterBatch), shape(forward), 'a related file found in a later scan batch joins the existing project');
  const again = consolidateLocalEvidence(forward);
  assert.equal(again[0].localParts.length, 3, 'regrouping preserves each source exactly once');
});

test('different campaign phase headings fuse when the target, advertising work and measured results agree', () => {
  const planning = source('캠페인 기획', '저당간식 신제품런칭 캠페인',
    '역할: 마케팅 인턴\n한 일: 직장인 고객의 전환 장벽을 인터뷰하고 저당간식 광고 메시지와 크리에이터 시딩 소재를 설계했습니다.\n광고 소재의 퍼포먼스를 A/B 테스트하고 신규 고객의 첫 구매 전환을 검증했습니다.\n성과: 첫달 매출 4,860만원과 ROAS 405%를 달성했습니다.',
    { titleOrigin: 'source_heading' });
  const results = source('크리에이터 운영', '저당간식 크리에이터시딩 캠페인',
    '역할: 캠페인 오너\n크리에이터 시딩 소재와 광고 메시지를 직장인 고객의 전환 장벽에 맞춰 수정하고 저당간식의 신규 고객 첫 구매를 유도했습니다.\n퍼포먼스 광고 소재에 A/B 테스트를 운영해 고객 전환을 확인했습니다.\n결과: ROAS 405%, 첫달 매출 4,860만원을 기록했습니다.',
    { titleOrigin: 'source_heading' });
  const groups = consolidateLocalEvidence([planning, results]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].localDocuments.length, 2);
});

test('an explicit project name joins an expanded implementation heading with the same name', () => {
  const report = source('기획', '프로젝트 기획', '프로젝트명: QRious\n역할: 백엔드 개발자\n한 일: 학술 데이터에서 교수별 연구 관심사를 추출하는 검색 구조를 설계했습니다.');
  const implementation = source('구현', 'QRious RAG 파이프라인 구축', '역할: AI 개발자\n한 일: 교수별 벡터 색인을 나누고 검색 결과에 근거 문서를 표시하는 RAG 파이프라인을 구현했습니다.');
  const groups = consolidateLocalEvidence([report, implementation]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'QRious');
  assert.equal(groups[0].sourcePaths.length, 2);
});

test('a standalone English heading joins its source-confirmed descriptive alias', () => {
  const named = source('데모', 'QRious', '역할: 개발 담당\n한 일: 교수별 연구 관심사를 찾는 학술 검색 시제품을 구현했습니다.');
  const described = source('회고', '교수 페르소나 네트워킹 플랫폼', '서비스명: QRious\n역할: 검색 담당\n한 일: 교수별 자료를 벡터 색인으로 분리하고 답변 출처를 표시했습니다.');
  const groups = consolidateLocalEvidence([named, described]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, 'QRious');
});

test('a written bilingual alias connects English and Korean project names', () => {
  const english = source('영문 프로젝트 소개', 'QRious', '프로젝트명: QRious (큐리어스)\n역할: 개발 담당\n한 일: 3만 건 학술 데이터를 색인해 교수별 연구 관심사를 연결하는 검색 파이프라인을 구축했습니다.');
  const korean = source('한글 발표 회고', '큐리어스 검색 시제품', '프로젝트명: 큐리어스\n역할: AI 개발자\n한 일: 교수별 학술 자료를 나눠 RAG 검색 결과에 출처를 표시했습니다.\n성과: 연구자 네트워킹 시제품으로 해커톤 2등을 수상했습니다.');
  const groups = consolidateLocalEvidence([english, korean]);
  assert.equal(groups.length, 1, 'the alias is written in the source rather than guessed from translation');
  assert.equal(groups[0].localParts.length, 2);
});

test('same dates and tools do not fuse unrelated products', () => {
  const academic = source('학술 검색', '연구자 검색 개선', '2026.05.16 ~ 2026.05.17\n역할: 백엔드 개발자\nReact와 RAG를 활용하여 학술 논문을 교수별로 분리하고 연구 관심사 검색 필터를 구현했습니다.\n성과: 교수와 학생이 연구 주제를 찾는 시제품을 완성했습니다.');
  const shopping = source('상품 검색', '쇼핑몰 추천 개선', '2026.05.16 ~ 2026.05.17\n역할: 백엔드 개발자\nReact와 RAG를 활용하여 상점 상품을 가격별로 분리하고 장바구니 추천 화면을 구현했습니다.\n성과: 판매자와 고객이 상품을 주문하는 시제품을 완성했습니다.');
  assert.equal(consolidateLocalEvidence([academic, shopping]).length, 2);
});

test('different explicit project identities stay separate despite overlapping domain terms', () => {
  const a = source('학술 플랫폼', '학술 검색 플랫폼', '프로젝트명: ScholarLink\n역할: AI 개발자\n한 일: 3만 건 학술 데이터를 교수별 벡터 색인으로 만들고 출처 필터가 있는 RAG 파이프라인을 구현했습니다.');
  const b = source('논문 플랫폼', '논문 검색 플랫폼', '프로젝트명: PaperTown\n역할: AI 개발자\n한 일: 3만 건 학술 데이터를 교수별 벡터 색인으로 구성하고 출처 필터가 있는 RAG 파이프라인을 설계했습니다.');
  assert.equal(consolidateLocalEvidence([a, b]).length, 2);
});

test('a shared project name does not override contradictory organizations', () => {
  const a = source('동아리 Atlas', 'Atlas', '프로젝트명: Atlas\n역할: 개발자\n한 일: 여행 일정을 지도에 표시하는 화면을 구현했습니다.', { organization: '교내 여행 동아리' });
  const b = source('직장 Atlas', 'Atlas', '프로젝트명: Atlas\n역할: 개발자\n한 일: 사내 정산 자료를 확인하는 대시보드를 구현했습니다.', { organization: '인턴 회사' });
  assert.equal(consolidateLocalEvidence([a, b]).length, 2);
});

test('a multi-project summary cannot bridge two distinct project sources', () => {
  const a = source('연구자 검색', '학술 자료 검색', '프로젝트명: ScholarLink\n역할: AI 개발자\n한 일: 교수별 벡터 색인을 나누고 학술 데이터 검색에 출처 필터를 구현했습니다.');
  const summary = source('활동 모음', '주요 경험', '역할: 개발 담당\nScholarLink 서비스에서 교수별 벡터 색인을 나누고 학술 데이터 검색에 출처 필터를 설계했습니다.\nShopFinder 서비스에서는 상품 가격과 판매자 정보를 색인해 구매자가 주문할 수 있는 검색 화면을 구현했습니다.');
  const b = source('상품 주문', '상품 가격 검색', '프로젝트명: ShopFinder\n역할: 웹 개발자\n한 일: 상품 가격과 판매자 정보를 색인해 구매자가 주문할 수 있는 검색 화면을 개발했습니다.');
  for (const files of [[a, summary, b], [b, summary, a]]) {
    const groups = consolidateLocalEvidence(files);
    assert.ok(groups.every(group => !(group.sourcePaths.includes(a.sourcePaths[0]) && group.sourcePaths.includes(b.sourcePaths[0]))));
  }
});

test('contextual project matches cannot chain through an unnamed mixed-experience summary', () => {
  const academic = '교수별 연구 관심사와 학술 논문을 연결하도록 벡터 색인과 출처 필터를 설계했습니다. 학술 데이터 3만 건을 검색할 수 있도록 색인 품질을 검증했습니다.';
  const lecture = '강의별 음성 녹음에서 자막 오류를 찾아 받아쓰기 시간축과 화자 구간을 정렬하는 검수 도구를 개발했습니다. 녹음 데이터 3만 건의 자막 오탈자를 분류했습니다.';
  const a = source('연구자 색인 기록', '관심사 색인', `역할: 검색 담당\n${academic}`);
  const summary = source('학기 종합 기록', '학기 중 기록', `역할: 개발 담당\n${academic}\n${lecture}`);
  const c = source('강의 자막 기록', '강의 자막 검수', `역할: 자막 담당\n${lecture}`);
  assert.equal(experienceEvidenceLink(a, summary)?.contextual, true, 'shared subject and factual evidence must exercise a contextual project link');
  assert.equal(experienceEvidenceLink(summary, c)?.contextual, true, 'the summary has a separate contextual link to the other event');
  assert.equal(experienceEvidenceLink(a, c), null, 'the independent events have no direct work match');
  const permutations = [[a, summary, c], [c, summary, a], [summary, a, c]];
  let previous;
  for (const files of permutations) {
    const groups = consolidateLocalEvidence(files);
    assert.ok(groups.every(group => !(group.sourcePaths.includes(a.sourcePaths[0]) && group.sourcePaths.includes(c.sourcePaths[0]))), 'contextual links require support across all members, not only the summary');
    if (previous) assert.deepEqual(shape(groups), previous, 'ambiguous summary assignment must not depend on scan order');
    previous = shape(groups);
  }
});

test('the same descriptive category does not combine unrelated contributions', () => {
  const a = source('검색 파이프라인', 'AI 학술 검색 플랫폼', '역할: 백엔드 개발자\n한 일: AI 학술 검색 플랫폼에서 연구자별 벡터 색인과 출처 필터를 구현했습니다.', { titleOrigin: 'source_description' });
  const b = source('가입 알림', 'AI 학술 검색 플랫폼', '역할: 기획자\n한 일: AI 학술 검색 플랫폼의 가입 알림 문구를 수정하고 이메일 발송 시간을 변경했습니다.', { titleOrigin: 'source_description' });
  assert.equal(consolidateLocalEvidence([a, b]).length, 2);
});

test('explicitly split experience parts are not fused again', () => {
  const body = '역할: 개발자\n한 일: 교수별 벡터 색인을 분리하고 학술 자료 검색 파이프라인을 구현했습니다.';
  const a = source('첫 기록', 'QRious', body, { separateExperience: true });
  const b = source('다른 기록', 'QRious', body, { separateExperience: true });
  assert.equal(consolidateLocalEvidence([a, b]).length, 2);
});
