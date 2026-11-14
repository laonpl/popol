// 내 컴퓨터에서 경험 찾기: AI가 사용자의 문서 묶음에서 본인 경험을 찾고(discover),
// 같은 프로젝트를 묶은 뒤(consolidate), 경험 하나의 원문과 문서 속 이미지를 한 번에 읽어 STAR로 정리한다(organize).

const block = value => String(value ?? '').replace(/```/g, "'''");

export const LOCAL_CATEGORIES = ['프로젝트', '인턴십', '대외활동', '동아리', '공모전', '학업·연구', '직무경험', '기타'];
export const LOCAL_IMAGE_KINDS = ['result', 'screen', 'diagram', 'photo', 'document', 'design', 'decoration', 'other'];

export function buildLocalDiscoverPrompt(documents) {
  const sources = documents.map(doc => [
    `[${doc.key}] 파일: ${block(doc.path)}${doc.modified ? ` · 수정 ${doc.modified}` : ''}${doc.imageCount ? ` · 문서 속 이미지 ${doc.imageCount}장` : ''}`,
    block(doc.text),
  ].join('\n')).join('\n\n');
  return `당신은 취업 준비생의 컴퓨터에 흩어진 문서에서 "본인이 직접 한 경험"을 찾아내는 커리어 분석가입니다.
아래는 사용자의 컴퓨터에서 찾은 파일의 본문입니다. 긴 문서는 앞뒤만 실렸습니다.

## 할 일
1. 사용자가 직접 수행한 프로젝트·활동·인턴·공모전·연구·동아리·업무 경험을 빠짐없이 찾으세요.
2. 같은 프로젝트를 다룬 문서는 하나의 경험으로 묶으세요. 기획서·발표자료·보고서·회고·이력서 항목이 같은 프로젝트면 한 경험입니다.
3. 이력서·포트폴리오·자기소개서처럼 한 문서에 여러 경험이 있으면 경험마다 나누세요. 이때 같은 문서가 여러 경험의 자료가 될 수 있습니다.
4. 이력서·자소서의 한두 줄 요약보다, 같은 프로젝트를 자세히 다룬 기획서·보고서·발표자료를 primary(핵심 자료)로 고르세요.
5. 경험마다 핵심을 판단하세요. 본인이 내린 판단, 직접 한 행동, 확인된 결과가 가장 잘 드러나는 지점입니다.

## 제외
- 양식·템플릿·작성 예시, 강의 자료·교재·논문·기사 같은 참고자료, 다른 사람·기업의 사례, 영상 대본만 있는 문서
- 코드·설정 설명, 소프트웨어 사용 설명서, 연락처·인적사항만 있는 문서
- 본인 경험으로 확인되지 않는 문서는 excluded에 이유와 함께 적으세요.

## 규칙
- 원문에 있는 사실만 씁니다. 원문에 없는 수치·역할·결과를 만들지 마세요.
- title은 실제 프로젝트·활동 이름과 한 일입니다. 예: "FitPoly — 경험 정리 서비스 기획·개발". 파일명·섹션명("포트폴리오", "프로젝트 회고", "주요 기능")은 제목이 아닙니다.
- 서로 다른 프로젝트를 하나로 합치지 마세요. 같은 이력서에 있다는 이유만으로 묶지 마세요.
- 프로젝트·서비스 이름이 다르면 같은 대회·같은 수업·같은 양식·같은 팀이어도 다른 경험입니다. documents에는 그 프로젝트 이름이 본문이나 파일 이름에 실제로 나오는 문서만 넣으세요.
- anchors에는 원문에서 이 경험을 가리키는 짧은 표현(프로젝트명·소제목)을 원문 그대로 적으세요.
- search에는 이 경험의 다른 자료(기획서·보고서·발표자료) 파일 이름에 쓰였을 만한 고유 단어를 3~6개 적으세요. 프로젝트·서비스·팀·대회 이름과 핵심 주제어입니다. "프로젝트"·"보고서"·"개발" 같은 일반 단어는 빼세요.
- strength는 1~5입니다. 본인 기여와 결과가 원문에서 구체적으로 확인될수록 높습니다.

## 문서
${sources}

## 출력 (JSON만)
{
  "experiences": [
    {
      "title": "실제 프로젝트·활동 이름 — 한 일",
      "period": "YYYY-MM ~ YYYY-MM (원문에 없으면 빈 문자열)",
      "summary": "무슨 경험인지 한 문장",
      "core": "이 경험의 핵심 판단·행동·결과 한두 문장",
      "documents": ["D1", "D3"],
      "primary": "D3",
      "anchors": ["원문 표현"],
      "search": ["프로젝트 이름", "핵심 주제어", "팀 이름"],
      "strength": 4
    }
  ],
  "excluded": [{ "document": "D2", "reason": "강의 자료(참고자료)" }]
}`;
}

export function buildLocalConsolidatePrompt(known, found) {
  const row = item => `${item.key}: ${block(item.title)}${item.period ? ` (${block(item.period)})` : ''} — ${block(item.summary)}${item.files?.length ? ` [자료: ${item.files.map(block).join(', ')}]` : ''}`;
  return `아래는 사용자의 문서에서 찾은 경험 목록입니다. K로 시작하는 항목은 이미 찾아 둔 경험, N으로 시작하는 항목은 새로 찾은 경험입니다.
같은 프로젝트·활동을 가리키는 항목끼리 묶으세요.

## 규칙
- 이름이 조금 달라도(약칭·영문명·띄어쓰기) 같은 프로젝트면 묶습니다.
- 서로 다른 프로젝트는 묶지 않습니다. 같은 학교·회사·기술을 썼다는 이유만으로 묶지 마세요.
- 확신이 없으면 묶지 마세요.
- 한 묶음에 K 항목은 최대 하나입니다. 각 항목은 한 묶음에만 들어갑니다.
- 2개 이상인 묶음만 출력합니다.

## 이미 찾은 경험
${known.length ? known.map(row).join('\n') : '(없음)'}

## 새로 찾은 경험
${found.map(row).join('\n')}

## 출력 (JSON만)
{ "groups": [["K1", "N2"], ["N1", "N4"]] }`;
}

export function buildLocalOrganizePrompt({ title, summary, core, anchors = [], documents, images = [] }) {
  const sources = documents.map((doc, index) => `--- F${index + 1} · 파일: ${block(doc.path)} ---\n${block(doc.text)}`).join('\n\n');
  const visuals = images.length ? `
## 첨부 이미지 (${images.map(image => image.key).join(', ')})
위에 첨부한 이미지는 이 경험의 자료 파일에 들어 있던 그림입니다. 각 이미지 앞에 ID와 출처가 적혀 있습니다.
이미지에서 실제로 보이는 내용은 STAR의 근거로 쓰고, 이미지마다 images에 판단을 적으세요.
- kind: result(성과 그래프·지표 표), screen(서비스·앱 화면), diagram(구조도·흐름도), photo(활동·현장 사진), document(문서·표 캡처), design(포스터·디자인 시안), decoration(로고·아이콘·배경·장식), other
- description: 무엇을 보여주는지 1~2문장
- text: 이미지 안의 핵심 글자·수치. 읽을 수 없는 글자는 추측하지 말고 비워 두세요.
- relevance: core(성과 지표·그래프, 직접 만든 서비스 화면·디자인·구조도처럼 이 경험의 결과·작업물을 직접 보여줌), supporting(활동 사진처럼 맥락을 보여줌), none(장식·무관)
- 이력서·자기소개서·지원서 페이지, 글만 있는 문서·표지·목차 캡처는 내용이 이 경험과 관련 있어도 relevance를 none으로 둡니다. 그 안의 글은 STAR 근거로만 쓰세요.
- caption: 경험 정리에 넣을 25자 이내 캡션
` : '';
  return `당신은 지원자의 원문 자료에서 경험을 STAR로 정리하는 커리어 코치입니다.

## 정리할 경험
${block(title)}${summary ? `\n요약: ${block(summary)}` : ''}${core ? `\n찾을 때 판단한 핵심: ${block(core)}` : ''}${anchors.length ? `\n원문에서 이 경험을 가리키는 표현: ${anchors.map(block).join(', ')}` : ''}

## 원문 자료 (파일별)
${sources}
${visuals}
## 작성 원칙
- 이 경험에 관한 내용만 씁니다. 같은 문서에 있는 다른 프로젝트·활동의 내용은 섞지 마세요.
- 이력서 한 줄 요약보다 기획서·보고서·발표자료·회고와 이미지에 담긴 구체적인 내용을 우선 활용하세요.
- 원문과 이미지에서 확인되는 사실만 씁니다. 수치는 원문 표기 그대로 쓰고, 목표·계획·예상치를 결과로 쓰지 마세요.
- 확인되지 않는 항목은 빈 값으로 두고 missing에 적으세요. 빈칸을 추측으로 채우지 마세요.
- 표·글머리 기호·마크다운을 옮기지 말고 읽기 쉬운 한국어 문장으로 씁니다.

## 필드
- title: 실제 프로젝트·활동 이름 — 핵심 내용 (40자 이내)
- period: "YYYY-MM ~ YYYY-MM" 또는 "YYYY-MM ~ 현재", 원문에 없으면 ""
- role: 팀 구성과 본인 역할 한 줄 (예: "3인 팀 · 기획과 프론트엔드 개발")
- situation: 배경과 문제 상황 2~4문장
- task: 본인이 맡은 과제·목표 1~3문장
- action: 본인이 직접 한 행동 3~6개. 무엇을, 왜, 어떻게 했는지
- result: 확인된 결과 1~4개. 정량 결과(이전→이후)를 먼저, 정성 결과도 가능
- learning: 원문에 배운 점·회고가 있을 때만 1~2문장
- keywords: 방법·도구·역량 키워드 최대 6개
- category: ${LOCAL_CATEGORIES.join('|')}
- core: 이 경험에서 가장 내세울 핵심 한 문장
- missing: 원문에서 확인되지 않은 항목 이름 (role, situation, task, action, result 중)
- unrelated: 이 경험이 아닌 다른 프로젝트·활동만 다루는 파일의 번호 (예: ["F2"]). 이 경험을 일부라도 다루는 파일(이력서·포트폴리오 포함)은 넣지 않습니다. 그런 파일의 내용과 이미지는 STAR에 쓰지 마세요.

## 출력 (JSON만)
{
  "title": "", "period": "", "role": "", "situation": "", "task": "",
  "action": ["", ""], "result": [""], "learning": "",
  "keywords": [""], "category": "프로젝트", "core": "", "missing": [], "unrelated": []${images.length ? `,
  "images": [{ "id": "I1", "kind": "result", "description": "", "text": "", "relevance": "core", "caption": "" }]` : ''}
}`;
}
