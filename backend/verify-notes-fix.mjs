// notesSlide 손상 수정 검증 — 기말과제(노트 보유) 템플릿 재렌더 후 무결성 검사.
// dotenv 미로딩: LLM 폴백(결정론 채움)으로 렌더 경로만 검증한다.
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { parsePptxLayout } from './src/services/templateParser.js';
import { mapDeck } from './src/services/geminiMapper.js';
import { renderDeckInPlace } from './src/services/pptxRendererInPlace.js';

const portfolio = {
  userName: '김유신',
  headline: '문제를 정의하고 끝까지 검증하는 프론트엔드 개발자',
  targetCompany: '코코네',
  targetPosition: '프론트엔드 개발자',
  valuesEssay: '사용자가 겪는 불편을 수치로 검증하고, 작은 단위로 빠르게 개선하는 것을 중요하게 생각합니다.',
  skills: { languages: ['JavaScript', 'TypeScript'], frameworks: ['React', 'Node.js'], tools: ['Firebase', 'Git'] },
  education: [{ school: '가천대학교', major: '컴퓨터공학과', period: '2021-2026' }],
  awards: [{ title: '교내 해커톤 대상', organization: '가천대학교', date: '2025.11' }],
  contact: { email: 'test@example.com', github: 'github.com/yushin55' },
  experiences: [
    {
      title: 'POPOL 포트폴리오 서비스', role: '프론트엔드 리드', period: '2025.09 - 2026.02',
      description: '노션형 포트폴리오를 PPT로 변환하는 기능을 개발했습니다.',
      skills: ['React', 'Node.js'],
      structuredResult: {
        projectOverview: { role: '프론트엔드 리드', period: '2025.09 - 2026.02', summary: '노션형 포트폴리오를 PPT로 자동 변환하는 서비스' },
        intro: '취업 준비생이 포트폴리오를 PPT로 다시 만드는 데 평균 8시간이 걸리는 문제를 발견했습니다.',
        task: '변환 파이프라인 설계와 프론트엔드 미리보기 개발을 맡았습니다.',
        process: '한글 전각 폭 기반 측정 모델을 만들어 폰트 자동 축소 로직을 통일했습니다.',
        output: '텍스트 잘림 제보가 주 12건에서 0건으로 줄었습니다.',
        growth: '렌더링 파이프라인 전체를 측정 가능한 단위로 쪼개는 설계 능력을 키웠습니다.',
        keyExperiences: [
          { title: '변환 품질 개선', metric: '12건 → 0건', metricLabel: '주간 잘림 제보', situation: 'PPT 텍스트 잘림 반복', action: '측정 모델 통일', result: '잘림 제보 0건' },
          { title: '변환 시간 단축', metric: '8시간 → 10분', metricLabel: '변환 시간', action: '슬라이드 자동 구성', result: '98% 단축' },
        ],
      },
    },
    { title: '교내 해커톤 우승 프로젝트', role: '팀장', period: '2025.11', description: 'AI 기반 채용공고 분석 기능을 36시간 안에 구현해 대상을 수상했습니다.' },
  ],
};

for (const tpl of ['../기말과제 최종 - 202135940 김유신.pptx', '../기말 양식.pptx']) {
  console.log(`\n######## ${tpl}`);
  const buf = fs.readFileSync(tpl);
  const layout = await parsePptxLayout(buf);
  const deck = await mapDeck({ portfolio, layout });
  const out = await renderDeckInPlace(deck, buf);

  const zip = await JSZip.loadAsync(out);
  const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);

  // 1) notesSlide 잔존/공유 검사
  const noteParts = names.filter(n => /^ppt\/notesSlides\//.test(n));
  console.log(`notesSlides parts: ${noteParts.length === 0 ? 'NONE (OK)' : noteParts.join(', ') + ' (!!)'}`);
  let sharedRefs = 0;
  for (const n of names.filter(x => /^ppt\/slides\/_rels\//.test(x))) {
    const txt = await zip.file(n).async('string');
    if (txt.includes('notesSlide')) { console.log(`  !! ${n} still references notesSlide`); sharedRefs++; }
  }
  if (!sharedRefs) console.log('slide rels notesSlide refs: NONE (OK)');

  // 2) Content_Types 잔존 검사
  const ct = await zip.file('[Content_Types].xml').async('string');
  console.log(`CT notesSlide overrides: ${(ct.match(/notesSlide\+xml/g) || []).length === 0 ? 'NONE (OK)' : 'REMAIN (!!)'}`);

  // 3) 구조 무결성: sldIdLst ↔ rels ↔ files ↔ CT
  const presXml = await zip.file('ppt/presentation.xml').async('string');
  const presRels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  const relMap = {};
  for (const m of presRels.matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2];
  const sldIds = [...presXml.matchAll(/<p:sldId id="(\d+)" r:id="([^"]+)"/g)];
  const slideFiles = names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const ctSlides = (ct.match(/presentationml\.slide\+xml/g) || []).length;
  console.log(`sldIdLst=${sldIds.length} slideFiles=${slideFiles.length} ctOverrides=${ctSlides} → ${sldIds.length === slideFiles.length && slideFiles.length === ctSlides ? 'MATCH (OK)' : 'MISMATCH (!!)'}`);
  let dangling = 0;
  for (const [, , rid] of sldIds) {
    const t = relMap[rid];
    if (!t || !zip.file(path.posix.normalize(path.posix.join('ppt', t)))) dangling++;
  }
  console.log(`dangling slide rels: ${dangling === 0 ? '0 (OK)' : dangling + ' (!!)'}`);
  fs.writeFileSync(tpl.replace(/\.pptx$/, '') + '.verify-out.pptx', out);
}
console.log('\ndone');
