// 프리셋별 PPT 추출 스모크 — resolveComposition → composePortfolioPptx 전 경로.
// 템플릿 없이(기본 테마) 돌려 accentBar/closing/headerStyle 정체성 knob 을 검증한다.
import fs from 'fs';
import { resolveComposition } from './src/services/pptComposeDirector.js';
import { composePortfolioPptx } from './src/services/pptComposeService.js';

const portfolio = JSON.parse(fs.readFileSync('./debug-portfolio.json', 'utf8'));
const presets = ['minimal', 'cards', 'timeline', 'data', 'magazine', 'archive'];

for (const preset of presets) {
  const opts = await resolveComposition({ portfolio, choices: { preset }, requests: {} });
  const out = await composePortfolioPptx(portfolio, null, opts);
  console.log(
    `${preset.padEnd(9)} → structure=${opts.structure} design=${opts.design} cover=${opts.cover} tone=${opts.tone}` +
    ` | header=${opts.headerStyle} bar=${opts.accentBar} closing=${opts.closing} | ${out.length} bytes`
  );
}

// 프리셋 + 세부조정 덮어쓰기 + 색 요청이 함께 동작하는지
const mixed = await resolveComposition({
  portfolio,
  choices: { preset: 'minimal', tone: 'vivid' },     // 세부조정으로 tone 덮어쓰기
  requests: { color: '초록색으로 강렬하게' },          // 요청으로 색·톤 보강
});
console.log('mixed     →', JSON.stringify({ structure: mixed.structure, tone: mixed.tone, accentHex: mixed.accentHex, headerStyle: mixed.headerStyle, accentBar: mixed.accentBar, closing: mixed.closing }));

// 프리셋 없음(구버전 호환) — 기존 동작 유지 확인
const legacy = await resolveComposition({ portfolio, choices: { structure: 'story', design: 'editorial' }, requests: {} });
console.log('legacy    →', JSON.stringify({ headerStyle: legacy.headerStyle, accentBar: legacy.accentBar, closing: legacy.closing }));
