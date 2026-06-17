// 합성 템플릿(좌상단 로고 + 상단 밴드 + 좌측 레일)을 만들어, 추출된 로고가
// 인셋으로 본문을 비켜 배치되는지(겹침 0) + 디자인이 반영되는지 검증한다.
import fs from 'fs';
import PptxGenJS from 'pptxgenjs';
import { composePortfolioPptx } from './src/services/pptComposeService.js';
import { resolveComposition } from './src/services/pptComposeDirector.js';

// 작은 로고 PNG (24x24 주황 원, 데이터URL)
const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAVUlEQVR42u3OMQ0AIAxE0ZNQA0jBBQ7YEMQAEnDQ4WBo0qHJ3/u2k9TMzCQpyZUkSZIkSZIkSZIkSZIkSZIkSf6Tq2pV1d09M3dmZpZl2X3v3vsAv0sH0o4kK0kAAAAASUVORK5CYII=';

// 합성 템플릿 생성
const t = new PptxGenJS();
t.layout = 'LAYOUT_WIDE';
for (let i = 0; i < 2; i++) {
  const s = t.addSlide();
  s.background = { color: 'FFF8F0' };
  s.addShape(t.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: 'C2410C' }, line: { type: 'none' } });       // 상단 밴드
  s.addShape(t.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: 'EA580C' }, line: { type: 'none' } });        // 좌측 레일
  s.addImage({ data: LOGO, x: 0.45, y: 0.75, w: 0.7, h: 0.7 });                                                            // 좌상단 로고
}
const tBuf = Buffer.from(await t.write({ outputType: 'nodebuffer' }));
fs.writeFileSync('./smoke-template-src.pptx', tBuf);

const base = JSON.parse(fs.readFileSync('./debug-portfolio.json', 'utf8'));
const portfolio = {
  ...base,
  targetCompany: '엔아이티서비스 (NIT Service)',
  targetPosition: 'Cloud Engineer (신입/경력) - ※공고 기반 분석',
  experiences: (base.experiences || []).map((e, i) => i === 1 ? {
    ...e,
    title: 'KKSC 동아리 창설 - 가천대학교 학생들의 3가지 불편함을 해소해주는 플랫폼',
    structuredResult: {
      ...e.structuredResult,
      output: 'QR 결제, 실시간 강의실 예약, 셔틀버스 위치 추적이라는 3가지 핵심 기능을 담은 가천길잡이 서비스 기획안을 최종 산출물로 완성했습니다.',
      keyExperiences: [
        { title: '3가지 핵심 문제 정의', metricLabel: '핵심 문제', metric: '3' },
        { title: '학식당 대기열 병목을 제거하는 QR 결제 시스템 도입', metric: '제안한 QR 시스템은 현장의 모든 결제 및 확인 절차를 비대면으로 전환해 평균 대기 시간을 크게 줄이도록 설계했습니다.' },
        { title: '유휴 강의실 자원 활용 극대화', metric: '수동으로 파악조차 힘들던 유휴 강의실 정보를 실시간으로 집계해 누구나 즉시 예약할 수 있게 했습니다.' },
        { title: '셔틀버스 도착 예측', metric: '사용자의 표면적 요구(어디쯤이야?)가 아닌 근본 니즈(언제 나가야 하나)를 충족하는 도착 예측 모델을 설계했습니다.' },
      ],
    },
  } : e),
};

const opts = await resolveComposition({ portfolio, choices: { preset: 'data' }, requests: {} });
const out = await composePortfolioPptx(portfolio, tBuf, opts);
fs.writeFileSync('./smoke-template-out.pptx', out);
console.log(`template→compose: ${out.length} bytes (preset=data, design 반영 + 로고 인셋)`);
