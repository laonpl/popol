import { GoogleGenerativeAI } from '@google/generative-ai';
import { callGitHubModelsFallback, acquireSemaphore, releaseSemaphore } from '../config/geminiClient.js';
import { createWorker } from 'tesseract.js';

// 키 변경 시 자동 재생성
let _genAIClient = null;
let _cachedImportKey = null;
function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  if (!_genAIClient || _cachedImportKey !== key) {
    _genAIClient = new GoogleGenerativeAI(key);
    _cachedImportKey = key;
  }
  return _genAIClient;
}

// Gemini 모델 폴백 + 재시도
const MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

async function geminiGenerate(parts, retries = 2, delayMs = 1500) {
  try {
    await acquireSemaphore();
  } catch (err) {
    if (err.message === 'QUEUE_FULL') throw new Error('서버가 일시적으로 과부하 상태입니다. 잠시 후 시도해주세요.');
    if (err.message === 'QUEUE_TIMEOUT') throw new Error('요청 대기 시간이 초과되었습니다.');
    throw err;
  }

  try {
    let lastError;
    for (const modelName of MODEL_FALLBACKS) {
      const model = getGenAI().getGenerativeModel({ model: modelName });
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const result = await model.generateContent(parts);
          return result.response.text();
        } catch (err) {
          lastError = err;
          const status = err?.status ?? err?.response?.status ?? err?.httpStatusCode;
          const msg = err?.message || '';
          // API Key 에러 → 즉시 중단
          if (status === 400 && (msg.includes('API key') || msg.includes('API Key'))) {
            console.error(`[Import Gemini] API 키 오류 - 유효한 Gemini API 키를 설정하세요`);
            throw err;
          }
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

    // 모든 재시도 소진 후 GitHub Models 폴백 사용
    if (lastError) {
      console.error('[Import Gemini] 모든 Gemini 모델 실패. GitHub Models Fallback을 시도합니다...');
      try {
        const promptString = Array.isArray(parts) 
          ? parts.map(p => typeof p === 'string' ? p : (p.inlineData ? '[첨부된 파일 데이터 - OCR 생략]' : JSON.stringify(p))).join('\n')
          : parts;
        return await callGitHubModelsFallback(promptString);
      } catch (fallbackErr) {
        console.error('[Fallback] GitHub Models Fallback도 실패했습니다:', fallbackErr.message);
        throw lastError;
      }
    }

    throw lastError;
  } finally {
    releaseSemaphore();
  }
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

const GH_HEADERS = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'POPOL-App' };

/**
 * GitHub URL 타입에 따라 자동 분기 (프로필/Gist/리포지토리)
 */
export async function importFromGitHub(githubUrl) {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) throw new Error('유효하지 않은 GitHub URL입니다');

  if (parsed.type === 'profile') return importFromGitHubProfile(parsed.owner, githubUrl);
  if (parsed.type === 'gist') return importFromGist(parsed.owner, parsed.gistId, githubUrl);
  return importFromGitHubRepo(parsed.owner, parsed.repo, parsed.path, githubUrl);
}

async function importFromGitHubProfile(username, originalUrl) {
  // 사용자 정보
  const userRes = await fetch(`https://api.github.com/users/${username}`, { headers: GH_HEADERS });
  if (!userRes.ok) throw new Error(`GitHub 사용자를 찾을 수 없습니다: ${username}`);
  const user = await userRes.json();

  // 최근 업데이트된 레포 최대 10개
  const reposRes = await fetch(
    `https://api.github.com/users/${username}/repos?sort=updated&per_page=10&type=owner`,
    { headers: GH_HEADERS }
  );
  const repos = reposRes.ok ? await reposRes.json() : [];

  const repoLines = repos
    .filter(r => !r.fork && r.description)
    .map(r => `- **${r.name}** (${r.language || '?'} · ⭐${r.stargazers_count}): ${r.description}${r.topics?.length ? ` [${r.topics.slice(0, 5).join(', ')}]` : ''}`)
    .join('\n');

  const content = [
    `# ${user.name || username} (@${username})`,
    user.bio ? `> ${user.bio}` : '',
    user.company ? `회사: ${user.company}` : '',
    user.location ? `위치: ${user.location}` : '',
    user.blog ? `블로그: ${user.blog}` : '',
    `팔로워: ${user.followers} · 공개 레포: ${user.public_repos}`,
    '',
    '## 주요 리포지토리',
    repoLines || '(없음)',
  ].filter(l => l !== null && l !== undefined).join('\n').trim();

  return {
    source: 'github',
    url: originalUrl,
    title: `${user.name || username} GitHub 프로필`,
    content,
    rawText: content,
    metadata: { followers: user.followers, publicRepos: user.public_repos },
    importedAt: new Date().toISOString(),
  };
}

async function importFromGist(owner, gistId, originalUrl) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, { headers: GH_HEADERS });
  if (!res.ok) throw new Error('GitHub Gist를 찾을 수 없습니다');
  const gist = await res.json();

  const files = Object.values(gist.files || {});
  const content = files
    .map(f => `## ${f.filename}\n${f.content || ''}`)
    .join('\n\n')
    .substring(0, 10000);

  return {
    source: 'github',
    url: originalUrl,
    title: gist.description || files[0]?.filename || 'GitHub Gist',
    content,
    rawText: content,
    importedAt: new Date().toISOString(),
  };
}

async function importFromGitHubRepo(owner, repo, path, originalUrl) {
  const filePath = path || 'README.md';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  const response = await fetch(apiUrl, { headers: GH_HEADERS });

  if (!response.ok) {
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: GH_HEADERS });
    if (!repoResponse.ok) throw new Error('GitHub 리포지토리를 찾을 수 없습니다');
    const repoData = await repoResponse.json();
    return {
      source: 'github',
      url: originalUrl,
      title: repoData.name || 'GitHub 프로젝트',
      content: formatRepoInfo(repoData),
      rawText: repoData.description || '',
      metadata: { stars: repoData.stargazers_count, language: repoData.language, topics: repoData.topics || [] },
      importedAt: new Date().toISOString(),
    };
  }

  const fileData = await response.json();
  const content = Buffer.from(fileData.content, 'base64').toString('utf8');

  let repoMeta = {};
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: GH_HEADERS });
    if (repoRes.ok) {
      const d = await repoRes.json();
      repoMeta = { stars: d.stargazers_count, language: d.language, topics: d.topics || [], description: d.description };
    }
  } catch { /* ignore */ }

  return {
    source: 'github',
    url: originalUrl,
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
    // 1단계: pdf-parse v2로 텍스트 추출
    let parser;
    try {
      const { PDFParse } = await import('pdf-parse');
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      extractedText = result?.text || '';
    } catch (e) {
      console.warn('pdf-parse 실패:', e.message);
    } finally {
      try { if (parser) await parser.destroy(); } catch { /* ignore */ }
    }
    // 2단계: 텍스트가 부족하면 스캔본일 가능성 → Gemini Vision OCR
    if (extractedText.trim().length < 50) {
      console.log('[Import] PDF 텍스트 부족, Gemini Vision OCR 시도');
      try {
        extractedText = await extractWithGeminiVision(buffer, mimeType);
      } catch (e) {
        console.error('Gemini Vision OCR 실패:', e.message);
        // pdf-parse에서 추출한 부분 텍스트라도 있으면 사용
        if (!extractedText.trim()) {
          throw new Error('PDF에서 텍스트를 추출할 수 없습니다. 글자가 텍스트 형태로 포함된 원본 PDF를 사용해주세요.');
        }
      }
    }
  } else if (mimeType.startsWith('image/')) {
    // 이미지 → Tesseract OCR (무료/로컬)
    console.log('[Import] 이미지 감지, Tesseract OCR 시도');
    try {
      extractedText = await extractWithTesseractOCR(buffer);
      // 만약 Tesseract가 너무 짧게 추출하거나 실패하면 안전망으로 Gemini Vision 폴백
      if (extractedText.trim().length < 10) {
        console.log('[Import] Tesseract 결과물 부족, Gemini Vision OCR 시도');
        extractedText = await extractWithGeminiVision(buffer, mimeType);
      }
    } catch (e) {
      console.warn('Tesseract OCR 실패, Gemini Vision으로 대체합니다:', e.message);
      extractedText = await extractWithGeminiVision(buffer, mimeType);
    }
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName?.toLowerCase().endsWith('.docx')
  ) {
    // DOCX → mammoth으로 텍스트 추출
    try {
      const { extractRawText } = await import('mammoth');
      const result = await extractRawText({ buffer });
      extractedText = result.value || '';
      if (!extractedText.trim()) throw new Error('빈 문서');
    } catch (e) {
      console.warn('mammoth DOCX 파싱 실패, Gemini Vision 시도:', e.message);
      try {
        extractedText = await extractWithGeminiVision(buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      } catch (e2) {
        throw new Error('Word 문서에서 텍스트를 추출할 수 없습니다.');
      }
    }
  } else {
    // HWP 등 기타 → Gemini Vision 시도
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
 * Tesseract.js (로컬 오픈소스)로 이미지에서 텍스트 추출 (Token 무료)
 */
async function extractWithTesseractOCR(buffer) {
  const worker = await createWorker('kor+eng');
  const { data: { text } } = await worker.recognize(buffer);
  await worker.terminate();
  return text;
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
    experience: `당신은 실리콘밸리 탑티어 기업의 수석 채용 담당자이자, 취준생의 파편화된 경험을 '합격률 1%의 직무 맞춤형 포트폴리오'로 변환해 주는 최고의 커리어 컨설턴트입니다.
사용자가 업로드한 원본 데이터를 분석하여 희망 직무를 유추하고, 아래 원칙에 따라 재구성하세요.

[핵심 원칙]
1. 두괄식 어필: Key Result(핵심 성과)를 가장 먼저 제시 — 수치화된 성과 우선
2. Why-How 연결: '왜(Why)'와 '어떻게(How)'를 논리적으로 연결, What의 단순 나열 금지
3. 명확한 기여도: 팀 프로젝트라면 본인 역할과 기여도(%)를 명확히 분리
4. 문체: 프로페셔널한 비즈니스 톤, 개조식 문장(~함, ~구축, ~달성)

[출력 JSON 스키마 - 반드시 이 형식으로만 응답]
{
  "title": "경험/프로젝트 제목",
  "framework": "STRUCTURED",
  "content": {
    "intro": "서비스 이름 또는 프로젝트 특징과 한 줄 소개 — 가장 핵심적인 수치나 성과 포함",
    "overview": "프로젝트 배경과 목적 — 왜 이 프로젝트를 시작했는지, 해결하려 한 문제는 무엇인지",
    "task": "배경-문제-해결 흐름 — 어떤 문제를 인식하고 어떤 방식으로 해결했는지 구체적으로",
    "process": "나의 직접적인 액션과 인사이트 — 본인이 수행한 행동, 역할, 기여도(%), 사용 기술·툴",
    "output": "최종 결과물과 핵심 포인트 — 정량적 성과(수치) 또는 정성적 임팩트",
    "growth": "이 경험을 통해 성장한 점이나 배운 점 — 인사이트, 다음에 적용할 점",
    "competency": "이 경험에서 얻은 역량과 입사 후 기여할 수 있는 부분"
  },
  "suggestedKeywords": ["핵심역량1", "핵심역량2", "핵심역량3"]
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
    {"type": "experience", "title": "핵심 경험", "content": "CARL 기반 정리된 내용", "role": "역할", "contribution": 50},
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
1. 핵심 경험을 CARL 프레임워크(배경-행동-결과-배운점)로 요약하여 추출하십시오.
2. 각 경험에서 드러나는 역량 키워드를 도출하십시오.
3. 어떤 자소서 문항에 활용 가능한지 추천하십시오.

[출력 JSON 스키마 - 반드시 이 형식으로만 응답]
{
  "title": "자기소개서 제목",
  "summary": "핵심 내용 2-3문장 요약. 프로페셔널한 비즈니스 문체로",
  "extractedExperiences": [
    {
      "title": "경험 제목",
      "description": "CARL 기반 경험 요약 (배경-행동-결과-배운점 순서로 3-4문장)",
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
    const seventh = Math.max(1, Math.ceil(sentences.length / 7));
    return {
      title,
      framework: 'STRUCTURED',
      content: {
        intro: sentences.slice(0, seventh).join('. ').trim() || '(프로젝트 이름과 한 줄 소개를 작성해주세요)',
        overview: sentences.slice(seventh, seventh * 2).join('. ').trim() || '(프로젝트 배경과 목적을 작성해주세요)',
        task: sentences.slice(seventh * 2, seventh * 3).join('. ').trim() || '(진행한 일을 작성해주세요)',
        process: sentences.slice(seventh * 3, seventh * 4).join('. ').trim() || '(과정을 작성해주세요)',
        output: sentences.slice(seventh * 4, seventh * 5).join('. ').trim() || '(결과물을 작성해주세요)',
        growth: sentences.slice(seventh * 5, seventh * 6).join('. ').trim() || '(성장한 점을 작성해주세요)',
        competency: sentences.slice(seventh * 6).join('. ').trim() || '(나의 역량을 작성해주세요)',
      },
      suggestedKeywords: ['경험', '역량', '성과'],
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
  // Gist: gist.github.com/user/id
  const gistMatch = url.match(/gist\.github\.com\/([^/?\s]+)\/([^/?\s#]+)/);
  if (gistMatch) return { type: 'gist', owner: gistMatch[1], gistId: gistMatch[2] };

  // Profile: github.com/username (단일 경로 세그먼트)
  const profileMatch = url.match(/github\.com\/([^/?\s#]+)\/?(?:[?#]|$)/);
  const SPECIAL = ['login', 'organizations', 'features', 'pricing', 'marketplace', 'explore', 'topics', 'collections'];
  if (profileMatch && !SPECIAL.includes(profileMatch[1])) {
    return { type: 'profile', owner: profileMatch[1] };
  }

  // Repo (blob/tree/issues/pull 등 포함)
  const repoMatch = url.match(/github\.com\/([^/]+)\/([^/?#\s]+)(?:\/(?:blob|tree)\/[^/]+\/(.+))?/);
  if (!repoMatch) return null;
  return { type: 'repo', owner: repoMatch[1], repo: repoMatch[2], path: repoMatch[3] || '' };
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

// ─────────────────────────────────────────────────────────
// 블로그 임포트
// ─────────────────────────────────────────────────────────

/**
 * 블로그 URL에서 게시글 내용 추출
 * 지원: Velog, Tistory, 네이버블로그, Medium, Brunch, dev.to, 일반 블로그
 */
export async function importFromBlog(blogUrl) {
  const platform = detectBlogPlatform(blogUrl);
  let title = '블로그 포스트';
  let content = '';

  // 네이버 블로그는 iframe 구조라 바로 Puppeteer
  if (platform !== 'naver') {
    try {
      const r = await fetchBlogHttp(blogUrl, platform);
      if (r.title) title = r.title;
      if (r.content && r.content.length > 100) content = r.content;
    } catch (e) {
      console.warn(`[Blog] HTTP 스크래핑 실패 (${platform}): ${e.message}`);
    }
  }

  // HTTP 실패 or 내용 부족 → Puppeteer
  if (!content || content.length < 100) {
    try {
      const r = await scrapeBlogPuppeteer(blogUrl, platform);
      if (r.title) title = r.title;
      if (r.content && r.content.length > content.length) content = r.content;
    } catch (e) {
      console.warn(`[Blog] Puppeteer 실패: ${e.message}`);
    }
  }

  return {
    source: 'blog',
    platform,
    url: blogUrl,
    title,
    content: content.trim(),
    rawText: content.trim(),
    needsManualInput: content.trim().length < 50,
    importedAt: new Date().toISOString(),
  };
}

function detectBlogPlatform(url) {
  if (/velog\.io/i.test(url)) return 'velog';
  if (/tistory\.com/i.test(url)) return 'tistory';
  if (/blog\.naver\.com/i.test(url)) return 'naver';
  if (/medium\.com/i.test(url)) return 'medium';
  if (/brunch\.co\.kr/i.test(url)) return 'brunch';
  if (/dev\.to/i.test(url)) return 'devto';
  if (/github\.io/i.test(url)) return 'github-pages';
  if (/wordpress\.com/i.test(url)) return 'wordpress';
  if (/hashnode\.(dev|com)/i.test(url)) return 'hashnode';
  return 'general';
}

const BLOG_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
};

async function fetchBlogHttp(blogUrl, platform) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(blogUrl, { headers: BLOG_FETCH_HEADERS, signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // 타이틀
    let title = '';
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1]
        .replace(/\s*[|–\-]\s*(Velog|Tistory|Medium|Brunch|NAVER|Dev\.to|Hashnode|브런치).*/i, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").trim();
    }

    let content = '';

    if (platform === 'velog') {
      // Next.js SSR: __NEXT_DATA__에 포스트 본문 포함
      const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nd) {
        try {
          const data = JSON.parse(nd[1]);
          const post = data?.props?.pageProps?.post;
          if (post?.body) { content = post.body; if (post.title) title = post.title; }
        } catch { /* ignore */ }
      }
      if (!content) content = extractBlockText(html);
    } else if (platform === 'tistory') {
      content = extractSectionText(html, ['#article-content', '#body', '.article-content', '.entry-content', '.post-content', 'article']);
    } else if (platform === 'medium') {
      content = extractSectionText(html, ['article', 'section[data-testid="story-title"]', '.postArticle-content', 'main']);
    } else if (platform === 'brunch') {
      content = extractSectionText(html, ['.wrap_body_frame', '.article_view', 'article', 'main']);
    } else if (platform === 'devto') {
      content = extractSectionText(html, ['#article-body', 'article', 'main']);
    } else if (platform === 'hashnode') {
      const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nd) {
        try {
          const data = JSON.parse(nd[1]);
          const postContent = data?.props?.pageProps?.post?.content?.markdown || data?.props?.pageProps?.post?.content;
          if (postContent) { content = typeof postContent === 'string' ? postContent : JSON.stringify(postContent); }
        } catch { /* ignore */ }
      }
      if (!content) content = extractSectionText(html, ['article', 'main', '.prose']);
    } else {
      // wordpress, github-pages, general
      content = extractSectionText(html, [
        'article', 'main', '.post-content', '.entry-content',
        '.content', '#content', '.blog-post', '.post-body',
        '#main', '.main-content',
      ]);
    }

    if (!content) content = extractBlockText(html);

    return { title, content: content.trim() };
  } finally {
    clearTimeout(timer);
  }
}

// id/class/태그 선택자로 HTML 영역 추출 (regex 기반)
function extractSectionText(html, selectors) {
  // 노이즈 제거
  const clean = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
    .replace(/<header\b[\s\S]*?<\/header>/gi, '')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, '');

  for (const sel of selectors) {
    let match;
    if (sel.startsWith('#')) {
      const id = sel.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match = clean.match(new RegExp(`<[^>]+\\bid="${id}"[^>]*>([\\s\\S]{80,}?)(?=<\\/(?:div|section|article|main)>|$)`, 'i'));
    } else if (sel.startsWith('.')) {
      const cls = sel.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match = clean.match(new RegExp(`<[^>]+\\bclass="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]{80,}?)(?=<\\/(?:div|section|article|main)>|$)`, 'i'));
    } else if (sel.includes('[')) {
      // 속성 선택자는 건너뜀 (복잡)
      continue;
    } else {
      match = clean.match(new RegExp(`<${sel}\\b[^>]*>([\\s\S]{80,}?)<\\/${sel}>`, 'i'));
    }
    if (match?.[1]) {
      const text = cleanHtmlText(match[1]);
      if (text.length > 80) return text;
    }
  }
  return '';
}

// 전체 HTML에서 p/h1-6/li 등 블록 요소 텍스트 추출
function extractBlockText(html) {
  const clean = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
    .replace(/<header\b[\s\S]*?<\/header>/gi, '')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, '');

  const parts = [];
  const re = /<(h[1-6]|p|li|blockquote|pre|td|dt|dd)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (t.length > 10 && !t.startsWith('{') && !/^[\d\s.,!?:;()\[\]{}*#@]+$/.test(t)) {
      parts.push(t);
    }
  }
  const seen = new Set();
  return parts.filter(t => { if (seen.has(t)) return false; seen.add(t); return true; })
    .join('\n').substring(0, 8000);
}

function cleanHtmlText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    .substring(0, 8000);
}

async function scrapeBlogPuppeteer(blogUrl, platform) {
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(BLOG_FETCH_HEADERS['User-Agent']);
    await page.goto(blogUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // 네이버 블로그: iframe 내부 URL로 재이동
    if (platform === 'naver') {
      const iframeSrc = await page.evaluate(() => {
        const f = document.querySelector('iframe#mainFrame');
        return f ? f.src : null;
      });
      if (iframeSrc) {
        await page.goto(iframeSrc, { waitUntil: 'networkidle2', timeout: 20000 });
      }
    }

    const result = await page.evaluate((plat) => {
      const selMap = {
        naver: ['.se-main-container', '.se_doc_viewer', '.post-content', '#content'],
        tistory: ['#article-content', '.article-content', '.entry-content', 'article'],
        medium: ['article', 'main'],
        brunch: ['.wrap_body_frame', '.article_view', 'article'],
        general: ['article', 'main', '.post-content', '.entry-content', '#content'],
      };
      const sels = selMap[plat] || selMap.general;
      const title = document.title.replace(/\s*[|–\-].*$/, '').trim();
      for (const s of sels) {
        const el = document.querySelector(s);
        if (el && (el.innerText || '').length > 100) return { title, content: el.innerText.substring(0, 8000) };
      }
      return { title, content: document.body.innerText.substring(0, 5000) };
    }, platform);

    return result;
  } finally {
    await browser.close();
  }
}
