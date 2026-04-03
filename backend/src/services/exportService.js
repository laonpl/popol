import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = 'gemini-2.0-flash';

/**
 * Notion 최적화 Markdown 형태로 내보내기
 */
export async function exportForNotion(data) {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const jsonStr = JSON.stringify(data, null, 2);

  const prompt = `당신은 Notion 페이지 전문 포맷터입니다.
아래 JSON 데이터를 Notion에 붙여넣기 했을 때 완벽하게 렌더링되는 Markdown으로 변환하십시오.

[Notion Markdown 변환 규칙]
1. Heading 구조: # → H1 (프로젝트명에만), ## → H2 (주요 섹션), ### → H3 (하위 항목)
2. Notion Callout 블록: > 🎯 **목표**: 내용 / > ✅ **성과**: 내용 / > 💡 **인사이트**: 내용
3. Toggle 블록: <details><summary>제목</summary>상세내용</details>
4. 코드 블록: 기술 스택이나 명령어는 \`\`\`으로 감싸기
5. 체크리스트: - [ ], - [x] 활용
6. 구분선: --- 으로 섹션 분리
7. 볼드/이탤릭: **핵심 성과**는 볼드, *보조 설명*은 이탤릭
8. 인라인 코드: 기술명은 \`React\`, \`Python\` 등으로 표시
9. 표(Table): 기술 스택 비교나 성과 정리에 Markdown 표 활용
10. 이모지: 섹션별 적절한 이모지 배치 (📌 개요, 🛠 기술, 📊 성과 등)

[변환 목표]
- 콘텐츠를 Notion에 바로 복사 가능한 형식으로 최적화
- 시각적으로 정돈되고 가독성이 높도록
- 비즈니스 프로페셔널 문체 유지 (명사형 종결)

[입력 데이터]
${jsonStr}

위 데이터를 Notion 최적화 Markdown으로 변환하여 텍스트만 출력하십시오. 코드블록으로 감싸지 마십시오.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Notion export AI error:', error.message);
    return generateNotionFallback(data);
  }
}

/**
 * GitHub README 최적화 Markdown 형태로 내보내기
 */
export async function exportForGitHub(data) {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const jsonStr = JSON.stringify(data, null, 2);

  const prompt = `당신은 GitHub README.md 전문 작성자입니다.
아래 JSON 데이터를 GitHub에서 렌더링했을 때 가장 보기 좋은 README.md 형식으로 변환하십시오.

[GitHub README 변환 규칙]
1. 최상단에 프로젝트 제목과 한 줄 설명
2. shields.io 배지: 기술 스택을 뱃지로 표현
   예: ![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
3. 목차(Table of Contents)를 링크 형태로 제공
4. 섹션 구조:
   - 📌 프로젝트 소개
   - 🛠 기술 스택 (뱃지 + 표)
   - 📂 프로젝트 구조 (디렉토리 트리)
   - ✨ 주요 기능 (체크박스 리스트)
   - 📊 성과 및 결과
   - 💡 배운 점
5. 코드 블록: 주요 코드 예시는 언어 태그 포함 (\`\`\`javascript)
6. 체크박스: - [x] 완료 기능, - [ ] 예정 기능
7. 디렉토리 트리: \`\`\` 내부에 트리 구조 표현
8. 개발자 관점의 기술적 문체 사용

[변환 목표]
- GitHub에서 렌더링 시 깔끔하고 전문적인 README
- 개발자/채용담당자 모두에게 어필하는 포맷
- 기술적 디테일과 성과를 균형 있게 표현

[입력 데이터]
${jsonStr}

위 데이터를 GitHub README.md 형식으로 변환하여 텍스트만 출력하십시오. 코드블록으로 감싸지 마십시오.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('GitHub export AI error:', error.message);
    return generateGitHubFallback(data);
  }
}

/**
 * PDF 최적화 압축 텍스트로 내보내기
 */
export async function exportForPDF(data) {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const jsonStr = JSON.stringify(data, null, 2);

  const prompt = `당신은 A4 이력서/포트폴리오 PDF 전문 편집자입니다.
아래 JSON 데이터를 PDF 인쇄 시 가장 효율적인 텍스트로 변환하십시오.

[PDF 최적화 변환 규칙]
1. 가독성 최우선: A4 1-2페이지에 모든 핵심 내용이 들어가도록 압축
2. 줄 간격 최소 → 명사형 종결 ("~한다" → "~함", "~했다" → "~함")
3. 문장은 짧고 명확하게. 불필요한 접속사/부사 제거
4. 숫자/성과 데이터는 **볼드** 처리
5. 섹션 구분:
   [인적사항] 이름 | 이메일 | 연락처
   [프로젝트명] 기간 | 역할
   - 핵심 성과 1
   - 핵심 성과 2
   [기술 스택] 기술1, 기술2, 기술3
6. 불릿 포인트(•)로 핵심만 나열
7. Markdown 마크업 최소화 (PDF 변환 시 깨지는 문법 배제)
8. 볼드(**)와 불릿(•)만 허용

[변환 목표]
- 인쇄 및 PDF 변환에 최적화된 가독성
- 채용담당자가 30초 내에 핵심 역량 파악 가능
- 깔끔하고 정돈된 이력서 스타일

[입력 데이터]
${jsonStr}

위 데이터를 PDF 최적화 형식으로 변환하여 텍스트만 출력하십시오. 코드블록으로 감싸지 마십시오.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('PDF export AI error:', error.message);
    return generatePDFFallback(data);
  }
}

// ── Fallback 함수들 ──

function generateNotionFallback(data) {
  const title = data.title || '프로젝트';
  const sections = data.sections || [];
  const content = data.content || {};
  let md = `# 📌 ${title}\n\n---\n\n`;

  if (content.situation) {
    md += `## 🎯 상황 (Situation)\n> ${content.situation}\n\n`;
    md += `## 📋 과제 (Task)\n> ${content.task || '내용 없음'}\n\n`;
    md += `## ⚡ 행동 (Action)\n> ${content.action || '내용 없음'}\n\n`;
    md += `## 📊 결과 (Result)\n> ${content.result || '내용 없음'}\n\n`;
  }

  for (const section of sections) {
    md += `## ${section.title || '섹션'}\n${section.content || ''}\n\n`;
  }

  if (data.metadata?.techStack) {
    md += `## 🛠 기술 스택\n`;
    md += data.metadata.techStack.map(t => `\`${t}\``).join(' ') + '\n';
  }

  return md;
}

function generateGitHubFallback(data) {
  const title = data.title || '프로젝트';
  const content = data.content || {};
  let md = `# ${title}\n\n`;

  if (data.metadata?.techStack) {
    md += data.metadata.techStack.map(t =>
      `![${t}](https://img.shields.io/badge/${encodeURIComponent(t)}-333?style=flat-square)`
    ).join(' ') + '\n\n';
  }

  md += `## 📌 프로젝트 소개\n`;
  if (data.summary) md += `${data.summary}\n\n`;

  if (content.situation) {
    md += `## 🔍 배경\n${content.situation}\n\n`;
    md += `## 🎯 목표\n${content.task || ''}\n\n`;
    md += `## ⚡ 주요 기능\n${content.action || ''}\n\n`;
    md += `## 📊 성과\n${content.result || ''}\n\n`;
  }

  if (data.sections) {
    for (const section of data.sections) {
      md += `## ${section.title || '섹션'}\n${section.content || ''}\n\n`;
    }
  }

  return md;
}

function generatePDFFallback(data) {
  const title = data.title || '프로젝트';
  const content = data.content || {};
  let text = `${title}\n`;

  if (data.metadata?.duration) text += `기간: ${data.metadata.duration}\n`;
  if (data.metadata?.role) text += `역할: ${data.metadata.role}\n`;
  text += '\n';

  if (content.situation) {
    text += `[상황] ${content.situation}\n`;
    text += `[과제] ${content.task || ''}\n`;
    text += `[행동] ${content.action || ''}\n`;
    text += `[성과] ${content.result || ''}\n\n`;
  }

  if (data.sections) {
    for (const section of data.sections) {
      text += `• ${section.title}: ${section.content || ''}\n`;
    }
    text += '\n';
  }

  if (data.metadata?.techStack) {
    text += `[기술 스택] ${data.metadata.techStack.join(', ')}\n`;
  }

  return text;
}

/**
 * Notion 포트폴리오 템플릿 전용 내보내기
 * 구조화된 포트폴리오 데이터를 Notion Markdown으로 변환
 */
export async function exportNotionPortfolio(data) {
  // 무조건 구조적 Markdown 생성 (AI 불필요)
  return generateNotionPortfolioMarkdown(data);
}

function generateNotionPortfolioMarkdown(p) {
  let md = '';
  const contact = p.contact || {};
  const skills = p.skills || {};
  const curr = p.curricular || {};
  const extra = p.extracurricular || {};

  // ── Title
  md += `# ${p.headline || p.title || '포트폴리오'}\n\n`;
  md += `> 본 포트폴리오는 PC 환경에 최적화되어 있습니다.\n\n`;

  // ── Quick Menu
  md += `---\n\n`;
  md += `#### ⚡ Quick Menu\n\n`;
  md += `| [📝 교과 활동](#교과-활동) | [💡 비교과 활동](#비교과-활동) | [🛠 기술](#기술) | [✨ 목표와 계획](#목표와-계획) | [💬 가치관](#가치관) |\n`;
  md += `|---|---|---|---|---|\n\n`;
  md += `---\n\n`;

  // ── Profile
  md += `## PROFILE\n\n`;
  if (p.profileImageUrl) md += `![프로필](${p.profileImageUrl})\n\n`;
  md += `### ${p.userName || '이름'}`;
  if (p.nameEn) md += ` (${p.nameEn})`;
  md += `\n\n`;
  if (p.location) md += `📍 ${p.location}\n\n`;
  if (p.birthDate) md += `📅 ${p.birthDate}\n\n`;

  // ── Values keywords
  if ((p.values || []).length > 0) {
    md += `#### My Own Values\n\n`;
    const emojis = ['➕', '➖', '✖️', '➗', '🎓'];
    p.values.forEach((v, i) => {
      md += `> ${emojis[i % 5]} **${v.keyword}**\n\n`;
    });
  }

  md += `---\n\n`;

  // ── Education
  if ((p.education || []).length > 0) {
    md += `## 🎓 Education\n\n`;
    p.education.forEach(edu => {
      md += `### ${edu.name}`;
      if (edu.nameEn) md += ` (${edu.nameEn})`;
      md += `\n\n`;
      if (edu.period) md += `*${edu.period}*\n\n`;
      if (edu.degree) md += `${edu.degree}\n\n`;
      if (edu.detail) md += `${edu.detail}\n\n`;
    });
    md += `---\n\n`;
  }

  // ── Interests
  if ((p.interests || []).length > 0) {
    md += `#### 💡 Interest\n\n`;
    p.interests.forEach(i => { md += `- ${i}\n`; });
    md += `\n---\n\n`;
  }

  // ── Awards
  if ((p.awards || []).length > 0) {
    md += `## 🏆 Scholarship and Awards\n\n`;
    p.awards.forEach(a => {
      md += `**${a.date}** ${a.title}\n\n`;
    });
    md += `---\n\n`;
  }

  // ── Experience
  if ((p.experiences || []).length > 0) {
    md += `## 🔥 Experience\n\n`;
    p.experiences.forEach(e => {
      md += `**${e.date}** ${e.title}\n\n`;
      if (e.description) md += `${e.description}\n\n`;
    });
    md += `---\n\n`;
  }

  // ── Contact
  if (contact.phone || contact.email || contact.linkedin) {
    md += `#### 📞 Contact Information\n\n`;
    if (contact.phone) md += `📱 Phone : ${contact.phone}\n\n`;
    if (contact.email) md += `📧 Email : ${contact.email}\n\n`;
    if (contact.linkedin) md += `🔗 LinkedIn : ${contact.linkedin}\n\n`;
    if (contact.instagram) md += `📸 Instagram : ${contact.instagram}\n\n`;
    if (contact.github) md += `💻 GitHub : ${contact.github}\n\n`;
    if (contact.website) md += `🌐 Website : ${contact.website}\n\n`;
    md += `---\n\n`;
  }

  // ── 교과 활동
  md += `## 📝 교과 활동 | Curricular Activities\n\n`;
  if (curr.summary?.credits || curr.summary?.gpa) {
    md += `#### 요약 | Summary\n\n`;
    if (curr.summary?.credits) md += `> 📚 이수 학점: ${curr.summary.credits}\n\n`;
    if (curr.summary?.gpa) md += `> 📊 평점 평균: ${curr.summary.gpa}\n\n`;
  }
  if ((curr.courses || []).length > 0) {
    md += `#### 교과목 수강 내역 | Course History\n\n`;
    md += `| 학기 | 과목명 | 성적 |\n|---|---|---|\n`;
    curr.courses.forEach(c => {
      md += `| ${c.semester || ''} | ${c.name || ''} | ${c.grade || ''} |\n`;
    });
    md += `\n`;
  }
  md += `---\n\n`;

  // ── 비교과 활동
  md += `## 💡 비교과 활동 | Extracurricular Activities\n\n`;
  if (extra.summary) {
    md += `#### 요약 | Summary\n\n`;
    md += `> ${extra.summary}\n\n`;
  }
  if ((extra.badges || []).length > 0) {
    md += `#### 🏅 디지털 배지 | Digital Badge\n\n`;
    extra.badges.forEach(b => {
      md += `- **${b.name}** (${b.issuer})\n`;
    });
    md += `\n`;
  }
  if ((extra.languages || []).length > 0) {
    md += `#### 🌍 어학 성적 | Language Certification\n\n`;
    md += `| 시험명 | 점수/등급 | 취득일 |\n|---|---|---|\n`;
    extra.languages.forEach(l => {
      md += `| ${l.name || ''} | ${l.score || ''} | ${l.date || ''} |\n`;
    });
    md += `\n`;
  }
  if ((extra.details || []).length > 0) {
    md += `#### 📋 세부 사항 | Details\n\n`;
    extra.details.forEach(d => {
      md += `<details><summary><b>${d.title}</b> (${d.period || ''})</summary>\n\n`;
      md += `${d.description || ''}\n\n`;
      md += `</details>\n\n`;
    });
  }
  md += `---\n\n`;

  // ── 기술
  md += `## 🛠 기술 | Skills\n\n`;
  const categoryNames = { tools: '도구', languages: '프로그래밍 언어', frameworks: '프레임워크', others: '기타' };
  for (const [cat, items] of Object.entries(skills)) {
    if (items && items.length > 0) {
      md += `**${categoryNames[cat] || cat}**: ${items.map(s => '`' + s + '`').join(' ')}\n\n`;
    }
  }
  md += `---\n\n`;

  // ── 목표
  md += `## ✨ 목표와 계획 | Future Plans\n\n`;
  if ((p.goals || []).length > 0) {
    const typeLabel = { short: '단기', mid: '중기', long: '장기' };
    p.goals.forEach(g => {
      const checked = g.status === 'done' ? 'x' : g.status === 'ing' ? '~' : ' ';
      md += `- [${checked}] **[${typeLabel[g.type] || ''}]** ${g.title}\n`;
      if (g.description) md += `  ${g.description}\n`;
    });
    md += `\n`;
  }
  md += `---\n\n`;

  // ── 가치관
  md += `## 💬 가치관 | Values\n\n`;
  if (p.valuesEssay) {
    md += `${p.valuesEssay}\n\n`;
  } else if ((p.values || []).length > 0) {
    const emojis = ['➕', '➖', '✖️', '➗', '🎓'];
    p.values.forEach((v, i) => {
      md += `### ${emojis[i % 5]} ${v.keyword}\n\n`;
      if (v.description) md += `${v.description}\n\n`;
    });
  }

  md += `---\n\n*[맨 위로 ↑↑](#)*\n`;

  return md;
}
