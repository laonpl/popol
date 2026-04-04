import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini 모델 폴백 + 재시도
const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

async function geminiGenerate(parts, retries = 3, delayMs = 3000) {
  let lastError;
  for (const modelName of MODEL_FALLBACKS) {
    const model = genAI.getGenerativeModel({ model: modelName });
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await model.generateContent(parts);
        return result.response.text();
      } catch (err) {
        lastError = err;
        const status = err?.status ?? err?.response?.status;
        if ([429, 503, 500].includes(status)) {
          if (attempt < retries - 1) {
            const wait = delayMs * Math.pow(2, attempt);
            console.warn(`[Import Gemini] ${modelName} ${status} - 재시도 (${wait}ms 대기)`);
            await new Promise(r => setTimeout(r, wait));
          } else {
            console.warn(`[Import Gemini] ${modelName} 재시도 소진 - 다음 모델로 전환`);
            break;
          }
        } else if ([404, 400].includes(status)) {
          console.warn(`[Import Gemini] ${modelName} ${status} - 다음 모델로 전환`);
          break;
        } else throw err;
      }
    }
  }
  throw lastError;
}

/**
 * Notion 페이지 내용을 가져와서 구조화
 * 다중 방법으로 시도: API v3 → HTML 스크레이핑 → 수동 입력 유도
 */
export async function importFromNotion(notionUrl) {
  const pageId = extractNotionPageId(notionUrl);
  if (!pageId) {
    throw new Error('유효하지 않은 Notion URL입니다');
  }

  const cleanId = pageId.replace(/-/g, '');
  const formattedId = cleanId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  let content = '';
  let title = 'Notion에서 가져온 내용';

  // Method 1: getPublicPageData (공개 페이지용)
  try {
    const response = await fetch('https://www.notion.so/api/v3/getPublicPageData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        blockId: formattedId,
        type: 'block-space',
        name: 'page',
        showMoveTo: false,
        saveParent: false,
        shouldDuplicate: false,
        projectManagementLaunch: false,
        requestedOnPublicDomain: false,
        showShareMenu: false,
        allowDuplicate: false,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.recordMap?.block) {
        const blocks = extractNotionBlocks({ recordMap: { block: data.recordMap.block } });
        if (blocks.text?.trim().length > 10) {
          content = blocks.text;
          title = blocks.title || title;
        }
      }
    }
  } catch (e) {
    console.warn('Notion getPublicPageData failed:', e.message);
  }

  // Method 2: loadPageChunk API
  if (!content) {
    try {
      const response = await fetch('https://www.notion.so/api/v3/loadPageChunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          pageId: cleanId,
          limit: 100,
          cursor: { stack: [] },
          chunkNumber: 0,
          verticalColumns: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const blocks = extractNotionBlocks(data);
        if (blocks.text?.trim().length > 10) {
          content = blocks.text;
          title = blocks.title || title;
        }
      }
    } catch (e) {
      console.warn('Notion API loadPageChunk failed:', e.message);
    }
  }

  // Method 3: loadCachedPageChunk API
  if (!content) {
    try {
      const response = await fetch('https://www.notion.so/api/v3/loadCachedPageChunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          page: { id: cleanId },
          limit: 100,
          cursor: { stack: [] },
          chunkNumber: 0,
          verticalColumns: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const blocks = extractNotionBlocks(data);
        if (blocks.text?.trim().length > 10) {
          content = blocks.text;
          title = blocks.title || title;
        }
      }
    } catch (e) {
      console.warn('Notion API loadCachedPageChunk failed:', e.message);
    }
  }

  // Method 4: HTML 스크레이핑
  if (!content) {
    try {
      const response = await fetch(notionUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      });

      if (response.ok) {
        const html = await response.text();

        // title 추출
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          const extracted = titleMatch[1].replace(/\s*[\|–]\s*Notion\s*$/, '').trim();
          if (extracted) title = extracted;
        }

        // __NEXT_DATA__ 에서 recordMap 추출
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          try {
            const nextData = JSON.parse(nextDataMatch[1]);
            const blockMap = nextData?.props?.pageProps?.recordMap?.block;
            if (blockMap) {
              const blocks = extractNotionBlocks({ recordMap: { block: blockMap } });
              if (blocks.text?.trim().length > 10) {
                content = blocks.text;
                if (blocks.title) title = blocks.title;
              }
            }
          } catch (e) { /* ignore parse errors */ }
        }

        // HTML 본문에서 텍스트 추출 시도 (div, p, span, h1-h6, li)
        if (!content) {
          const textParts = [];
          const tagMatches = html.matchAll(/<(?:span|p|div|h[1-6]|li)[^>]*>([^<]{3,})<\/(?:span|p|div|h[1-6]|li)>/g);
          for (const m of tagMatches) {
            const t = m[1].trim();
            if (t.length > 2 && !t.startsWith('{') && !t.startsWith('<') && !t.match(/^[\s{}[\]()]+$/)) {
              textParts.push(t);
            }
          }
          if (textParts.length > 3) {
            content = [...new Set(textParts)].join('\n');
          }
        }
      }
    } catch (e) {
      console.warn('Notion HTML fetch failed:', e.message);
    }
  }

  return {
    source: 'notion',
    url: notionUrl,
    title,
    content: content || '',
    rawText: content || '',
    needsManualInput: !content || content.trim().length < 20,
    importedAt: new Date().toISOString(),
  };
}

/**
 * GitHub 리포지토리의 README 또는 특정 파일 내용 가져오기
 */
export async function importFromGitHub(githubUrl) {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) {
    throw new Error('유효하지 않은 GitHub URL입니다');
  }

  const { owner, repo, path } = parsed;

  // README.md 또는 특정 파일 가져오기
  const filePath = path || 'README.md';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'POPOL-App',
    },
  });

  if (!response.ok) {
    // README가 없으면 레포 정보라도 가져오기
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'POPOL-App' },
    });

    if (!repoResponse.ok) {
      throw new Error('GitHub 리포지토리를 찾을 수 없습니다');
    }

    const repoData = await repoResponse.json();
    return {
      source: 'github',
      url: githubUrl,
      title: repoData.name || 'GitHub 프로젝트',
      content: formatRepoInfo(repoData),
      rawText: repoData.description || '',
      metadata: {
        stars: repoData.stargazers_count,
        language: repoData.language,
        topics: repoData.topics || [],
      },
      importedAt: new Date().toISOString(),
    };
  }

  const fileData = await response.json();
  const content = Buffer.from(fileData.content, 'base64').toString('utf8');

  // 레포 상세정보도 함께 가져오기
  let repoMeta = {};
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'POPOL-App' },
    });
    if (repoRes.ok) {
      const repoData = await repoRes.json();
      repoMeta = {
        stars: repoData.stargazers_count,
        language: repoData.language,
        topics: repoData.topics || [],
        description: repoData.description,
      };
    }
  } catch { /* ignore */ }

  return {
    source: 'github',
    url: githubUrl,
    title: repo,
    content,
    rawText: content,
    metadata: repoMeta,
    importedAt: new Date().toISOString(),
  };
}

/**
 * PDF 텍스트 내용 처리 (프론트엔드에서 추출한 텍스트를 받아서 구조화)
 */
export async function importFromPDF(pdfText, fileName) {
  return {
    source: 'pdf',
    fileName,
    title: fileName?.replace(/\.pdf$/i, '') || 'PDF 문서',
    content: pdfText,
    rawText: pdfText,
    importedAt: new Date().toISOString(),
  };
}

/**
 * 파일 업로드를 통한 임포트 (서버 사이드 파싱)
 * PDF → pdf-parse 텍스트 추출 → 부족시 Gemini Vision OCR
 * 이미지 → Gemini Vision OCR
 * HWP 등 → Gemini Vision 분석
 */
export async function importFromFile(buffer, mimeType, fileName) {
  let extractedText = '';

  if (mimeType === 'application/pdf') {
    // 1단계: pdf-parse로 텍스트 추출 시도
    try {
      const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
      const data = await pdfParse(buffer);
      extractedText = data.text || '';
    } catch (e) {
      console.warn('pdf-parse 실패, Gemini Vision으로 전환:', e.message);
    }
    // 2단계: 텍스트가 부족하면 스캔본일 가능성 → Gemini Vision OCR
    if (extractedText.trim().length < 50) {
      console.log('[Import] PDF 텍스트 부족, Gemini Vision OCR 시도');
      try {
        extractedText = await extractWithGeminiVision(buffer, mimeType);
      } catch (e) {
        console.error('Gemini Vision OCR 실패:', e.message);
        if (!extractedText.trim()) {
          throw new Error('PDF에서 텍스트를 추출할 수 없습니다.');
        }
      }
    }
  } else if (mimeType.startsWith('image/')) {
    // 이미지 → Gemini Vision OCR
    try {
      extractedText = await extractWithGeminiVision(buffer, mimeType);
    } catch (e) {
      throw new Error('이미지에서 텍스트를 추출할 수 없습니다: ' + e.message);
    }
  } else {
    // HWP 등 기타 → Gemini Vision 시도 (PDF로 MIME 변환 시도)
    try {
      extractedText = await extractWithGeminiVision(buffer, 'application/octet-stream');
    } catch (e) {
      throw new Error('파일에서 텍스트를 추출할 수 없습니다. PDF나 이미지로 변환 후 업로드해주세요.');
    }
  }

  if (!extractedText.trim()) {
    throw new Error('문서에서 텍스트를 추출할 수 없습니다.');
  }

  return {
    source: 'file',
    fileName,
    title: fileName?.replace(/\.[^.]+$/, '') || '업로드된 문서',
    content: extractedText.trim(),
    rawText: extractedText.trim(),
    importedAt: new Date().toISOString(),
  };
}

/**
 * Gemini Vision API로 문서/이미지에서 텍스트 추출 (OCR)
 */
async function extractWithGeminiVision(buffer, mimeType) {
  const base64 = buffer.toString('base64');
  return await geminiGenerate([
    {
      inlineData: {
        mimeType,
        data: base64,
      },
    },
    `이 문서/이미지의 모든 텍스트 내용을 정확하게 추출해주세요.
- 표가 있으면 표 구조를 텍스트로 보존해주세요
- 제목, 소제목, 본문을 구분해주세요
- 추출된 텍스트만 반환하세요 (부가 설명 없이)`,
  ]);
}

/**
 * AI를 사용하여 임포트된 내용을 경험/포트폴리오/자소서 형식으로 구조화
 */
export async function structureImportedContent(importedData, targetType) {
  const rawText = importedData.content?.substring(0, 5000) || '';

  const prompts = {
    experience: `당신은 취업 포트폴리오 전문 데이터 분석가이자 경험 정리 컨설턴트입니다.
사용자가 업로드한 파편화된 원본 데이터(Notion 웹페이지, Github README, 또는 PDF 추출 텍스트)를 분석하여, 취업에 최적화된 구조화된 JSON 형태로 요약 및 재구성하는 것이 당신의 목표입니다.

[작업 지시사항]
1. 아래 제공되는 원본 데이터를 꼼꼼히 분석하십시오.
2. 분석된 내용을 바탕으로 불필요한 서술어는 제거하고, 명확하고 프로페셔널한 비즈니스 용어(명사형 종결 등)로 정제하십시오.
3. 데이터를 'STAR(Situation, Task, Action, Result) 기법' 기반의 아래 JSON 스키마에 완벽히 맞추어 추출하십시오. 정보가 누락된 항목은 "내용 없음"으로 표기하되, 문맥상 유추 가능한 경우 최대한 채워 넣으십시오.

[출력 JSON 스키마 - 반드시 이 형식으로만 응답]
{
  "title": "프로젝트 공식 명칭",
  "framework": "STAR",
  "content": {
    "situation": "어떤 배경에서 시작되었으며, 어떤 문제(Problem)가 있었는지. 기간, 역할 포함",
    "task": "해결하고자 했던 목표와 맡은 과제(Task)",
    "action": "문제를 해결하기 위해 본인이 구체적으로 취한 행동(Action). 핵심 3가지 이내로 요약",
    "result": "구체적인 성과 및 데이터(수치) 기반의 결과(Result)와 배운 점"
  },
  "suggestedKeywords": ["트러블슈팅", "데이터분석", "리더십" 등 경험을 대표하는 핵심 역량 키워드 최대 3개],
  "metadata": {
    "duration": "진행 기간 (예: 2023.01 - 2023.06)",
    "role": "본인의 역할 (예: 백엔드 개발)",
    "techStack": ["사용한", "기술", "스택"]
  }
}

[원본 데이터]
${rawText}`,

    portfolio: `당신은 취업 포트폴리오 전문 데이터 분석가이자 포트폴리오 제작 컨설턴트입니다.
사용자가 업로드한 원본 데이터를 분석하여, 포트폴리오에 바로 사용할 수 있는 구조화된 섹션으로 재구성하십시오.

[작업 지시사항]
1. 원본 내용에서 프로젝트명, 역할, 기술스택, 성과 등을 추출하십시오.
2. 불필요한 서술은 제거하고 명사형 종결의 프로페셔널한 문체로 정제하십시오.
3. 포트폴리오 섹션(소개, 프로젝트 경험, 기술 스택, 성과)으로 분리하십시오.

[출력 JSON 스키마 - 반드시 이 형식으로만 응답]
{
  "title": "포트폴리오/프로젝트 제목",
  "sections": [
    {"type": "intro", "title": "프로젝트 소개", "content": "1-2줄 핵심 요약"},
    {"type": "experience", "title": "핵심 경험", "content": "STAR 기반 정리된 내용", "role": "역할", "contribution": 50},
    {"type": "tech", "title": "기술 스택", "content": "사용 기술 나열"},
    {"type": "result", "title": "성과", "content": "수치 포함 성과 요약"}
  ],
  "metadata": {
    "duration": "진행 기간",
    "techStack": ["기술1", "기술2"]
  }
}

[원본 데이터]
${rawText}`,

    coverletter: `당신은 자기소개서 전문 컨설턴트이자 大기업 인사담당자입니다.
사용자가 업로드한 원본 데이터에서 자기소개서에 활용할 수 있는 핵심 경험, 역량, 성과를 추출하고, 자소서 문항별로 활용 가능한 형태로 재구성하십시오.

[작업 지시사항]
1. 핵심 경험을 STAR 기법으로 요약하여 추출하십시오.
2. 각 경험에서 드러나는 역량 키워드를 도출하십시오.
3. 어떤 자소서 문항에 활용 가능한지 추천하십시오.

[출력 JSON 스키마 - 반드시 이 형식으로만 응답]
{
  "title": "자기소개서 제목",
  "summary": "핵심 내용 2-3문장 요약. 프로페셔널한 비즈니스 문체로",
  "extractedExperiences": [
    {
      "title": "경험 제목",
      "description": "STAR 기반 경험 요약 (상황-과제-행동-결과 순서로 3-4문장)",
      "keywords": ["역량키워드1", "역량키워드2"]
    }
  ],
  "suggestedQuestions": ["이 경험으로 답변 가능한 자소서 문항1", "문항2", "문항3"]
}

[원본 데이터]
${rawText}`,
  };

  const prompt = prompts[targetType];
  if (!prompt) {
    throw new Error('지원하지 않는 변환 타입입니다');
  }

  try {
    const text = await geminiGenerate(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 구조화 응답 파싱 실패');
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('Gemini 구조화 실패:', err.message?.substring(0, 100));
    console.warn('Gemini 실패, 템플릿 폴백 사용');
    return structureFallback(importedData, targetType);
  }
}

/**
 * AI 없이 기본 템플릿으로 구조화하는 폴백
 */
function structureFallback(importedData, targetType) {
  const content = (importedData.content || '').substring(0, 1000);
  const title = importedData.title || '가져온 내용';

  if (targetType === 'experience') {
    const sentences = content.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
    const quarter = Math.max(1, Math.ceil(sentences.length / 4));
    return {
      title,
      framework: 'STAR',
      content: {
        situation: sentences.slice(0, quarter).join('. ').trim() || '(원본 내용을 바탕으로 상황을 작성해주세요)',
        task: sentences.slice(quarter, quarter * 2).join('. ').trim() || '(해결해야 했던 과제를 작성해주세요)',
        action: sentences.slice(quarter * 2, quarter * 3).join('. ').trim() || '(구체적인 행동을 작성해주세요)',
        result: sentences.slice(quarter * 3).join('. ').trim() || '(결과와 성과를 작성해주세요)',
      },
      suggestedKeywords: ['경험', '역량', '성과'],
      metadata: {
        duration: '',
        role: '',
        techStack: [],
      },
    };
  }

  if (targetType === 'portfolio') {
    return {
      title,
      sections: [
        { type: 'intro', title: '프로젝트 소개', content: content.substring(0, 300) || '(프로젝트 소개를 작성해주세요)' },
        { type: 'experience', title: '주요 내용', content: content.substring(300, 600) || '(주요 내용을 작성해주세요)', role: '담당자', contribution: 50 },
        { type: 'tech', title: '기술 스택', content: '(사용 기술을 작성해주세요)' },
        { type: 'result', title: '성과', content: '(수치 포함 성과를 작성해주세요)' },
      ],
      metadata: {
        duration: '',
        techStack: [],
      },
    };
  }

  if (targetType === 'coverletter') {
    return {
      title,
      summary: content.substring(0, 200) || '(내용 요약)',
      extractedExperiences: [
        { title, description: content.substring(0, 300), keywords: ['경험', '역량'] },
      ],
      suggestedQuestions: ['지원 동기를 작성해주세요', '본인의 강점을 설명해주세요', '팀 프로젝트 경험을 설명해주세요'],
    };
  }

  return { title, content };
}

// === Helper Functions ===

function extractNotionPageId(url) {
  // Notion URL에서 페이지 ID 추출 (다양한 형식 지원)
  // ?p= 파라미터에서 추출 (서브페이지)
  const pMatch = url.match(/[?&]p=([a-f0-9]{32})/);
  if (pMatch) return pMatch[1];
  // 기본 형식: 마지막 32자리 hex
  const match = url.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
  return match ? match[1] : null;
}

function extractNotionBlocks(data) {
  const blocks = data?.recordMap?.block || {};
  let title = '';
  let textParts = [];

  // 블록 타입별 프리픽스 정의
  const prefixMap = {
    'header': '# ',
    'sub_header': '## ',
    'sub_sub_header': '### ',
    'bulleted_list': '• ',
    'numbered_list': '- ',
    'quote': '> ',
    'callout': '💡 ',
    'to_do': '☐ ',
    'code': '',
  };

  Object.values(blocks).forEach(block => {
    const value = block?.value;
    if (!value) return;

    // 페이지 타이틀
    if (value.type === 'page') {
      title = extractTextFromProperties(value.properties);
      return; // 타이틀은 별도 저장, content에 안 넣음
    }

    // 텍스트가 있는 블록 타입들
    const text = extractTextFromProperties(value.properties);
    if (text) {
      const prefix = prefixMap[value.type] || '';
      // to_do 블록의 체크 상태
      if (value.type === 'to_do') {
        const checked = value.properties?.checked?.[0]?.[0] === 'Yes';
        textParts.push((checked ? '☑ ' : '☐ ') + text);
      } else {
        textParts.push(prefix + text);
      }
    }

    // 코드 블록
    if (value.type === 'code' && text) {
      const lang = value.properties?.language?.[0]?.[0] || '';
      textParts.push(`\`\`\`${lang}\n${text}\n\`\`\``);
    }

    // 이미지/파일 블록은 URL만 기록
    if (value.type === 'image' && value.properties?.source) {
      textParts.push(`[이미지: ${value.properties.source[0]?.[0] || ''}]`);
    }
  });

  return {
    title,
    text: textParts.filter(t => t.trim()).join('\n'),
  };
}

function extractTextFromProperties(properties) {
  if (!properties?.title) return '';
  return properties.title.map(segment => {
    if (Array.isArray(segment)) {
      return segment[0] || '';
    }
    return String(segment);
  }).join('');
}

function parseGitHubUrl(url) {
  // https://github.com/owner/repo 또는 https://github.com/owner/repo/blob/main/file.md
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/(?:blob|tree)\/[^/]+\/(.+))?/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], path: match[3] || '' };
}

function formatRepoInfo(repo) {
  return `# ${repo.name}

${repo.description || '(설명 없음)'}

- **언어**: ${repo.language || '미정'}
- **Stars**: ${repo.stargazers_count || 0}
- **Topics**: ${(repo.topics || []).join(', ') || '없음'}
- **URL**: ${repo.html_url}
`;
}
