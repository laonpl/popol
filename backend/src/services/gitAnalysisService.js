import { callProFirst, parseJSON } from './geminiService.js';

const GITHUB_API = 'https://api.github.com';

function parseGitHubUrl(url) {
  const match = url.trim().match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) throw new Error('유효한 GitHub 레포지토리 URL이 아닙니다. (예: https://github.com/username/repo)');
  return { owner: match[1], repo: match[2] };
}

async function ghFetch(path, token) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${GITHUB_API}${path}`, { headers });
  if (res.status === 404) throw new Error('레포지토리를 찾을 수 없습니다. URL 또는 공개 여부를 확인해주세요.');
  if (res.status === 403) throw new Error('GitHub API 요청 한도 초과입니다. 잠시 후 다시 시도해주세요.');
  if (!res.ok) throw new Error(`GitHub API 오류 (${res.status})`);
  return res.json();
}

async function getCommitsByAuthor(owner, repo, authorParam, token, maxCommits = 80) {
  const perPage = 30;
  const pages = Math.ceil(maxCommits / perPage);
  const allCommits = [];

  for (let page = 1; page <= pages; page++) {
    let data;
    try {
      data = await ghFetch(
        `/repos/${owner}/${repo}/commits?author=${encodeURIComponent(authorParam)}&per_page=${perPage}&page=${page}`,
        token
      );
    } catch (e) {
      if (e.message.includes('찾을 수 없습니다')) return [];
      throw e;
    }
    if (!Array.isArray(data) || data.length === 0) break;
    allCommits.push(...data);
    if (data.length < perPage) break;
  }
  return allCommits.slice(0, maxCommits);
}

/**
 * 커밋의 상세 diff 가져오기
 * 파일별 변경 내용 + patch(코드 변경 라인) 포함
 */
async function getCommitDiff(owner, repo, sha, token) {
  try {
    const data = await ghFetch(`/repos/${owner}/${repo}/commits/${sha}`, token);
    const stats = data.stats || {};
    const files = (data.files || []).slice(0, 10);
    return {
      sha: sha.substring(0, 7),
      message: data.commit?.message || '',
      stats: { additions: stats.additions || 0, deletions: stats.deletions || 0, total: stats.total || 0 },
      files: files.map(f => ({
        filename: f.filename,
        status: f.status, // added / modified / removed / renamed
        additions: f.additions,
        deletions: f.deletions,
        // patch는 실제 코드 변경 라인 (+/- 표시) — 1200자로 제한
        patch: (f.patch || '').substring(0, 1200),
      })),
    };
  } catch {
    return null;
  }
}

/**
 * 그룹 내에서 diff 가져올 대표 커밋 선별
 * fix/refactor 커밋을 우선, 없으면 변경량 많은 순
 */
function pickRepresentativeCommits(commits, count = 4) {
  const priority = ['fix', 'refactor', 'perf', 'feat'];
  const scored = commits.map(c => {
    const msg = c.commit.message.toLowerCase();
    const score = priority.findIndex(p => msg.startsWith(p));
    return { commit: c, score: score === -1 ? 99 : score };
  });
  // 우선순위 높은 것 먼저, 같으면 원래 순서 유지
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map(s => s.commit);
}

/**
 * 커밋 목록을 prefix 기반으로 그룹핑
 * fix/feat/refactor 등 같은 작업 유형끼리 묶어 경험 단위 구성
 */
function groupCommits(commits) {
  if (commits.length === 0) return [];
  const MAX_GROUPS = 5;

  const getPrefix = (msg) => {
    const m = msg.match(/^([a-z]+)(?:\([^)]+\))?:/i);
    return m ? m[1].toLowerCase() : 'misc';
  };

  const sorted = [...commits].sort((a, b) =>
    new Date(b.commit.author.date) - new Date(a.commit.author.date)
  );

  const groupMap = new Map();
  for (const c of sorted) {
    const prefix = getPrefix(c.commit.message);
    if (!groupMap.has(prefix)) groupMap.set(prefix, []);
    groupMap.get(prefix).push(c);
  }

  const groups = [...groupMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_GROUPS)
    .map(([prefix, commits]) => ({ prefix, commits }));

  if (groups.length === 0) return [{ prefix: 'project', commits: sorted }];
  return groups;
}

/**
 * 커밋 그룹 + 실제 diff를 AI로 분석
 * 코드 변경 내용·트러블슈팅까지 추출
 */
async function analyzeCommitGroup(group, repoName, owner, repo, token) {
  // 1) 커밋 메시지 요약 (최대 20개)
  const commitSummaries = group.commits.slice(0, 20).map(c => ({
    sha: c.sha.substring(0, 7),
    message: c.commit.message.split('\n')[0].substring(0, 150),
    date: c.commit.author.date?.substring(0, 10),
  }));

  // 2) 대표 커밋 diff 수집 (최대 4개 — fix/refactor 우선)
  const repCommits = pickRepresentativeCommits(group.commits, 4);
  const diffs = (await Promise.all(repCommits.map(c => getCommitDiff(owner, repo, c.sha, token))))
    .filter(Boolean);

  // diff를 AI에 넘길 텍스트로 직렬화
  const diffText = diffs.map(d => {
    const fileLines = d.files.map(f => {
      const patchPreview = f.patch
        ? `\n\`\`\`diff\n${f.patch}\n\`\`\``
        : '';
      return `  [${f.status}] ${f.filename} (+${f.additions}/-${f.deletions})${patchPreview}`;
    }).join('\n');
    return `커밋 ${d.sha}: "${d.message.split('\n')[0]}"\n변경 통계: +${d.stats.additions}/-${d.stats.deletions} lines\n${fileLines}`;
  }).join('\n\n---\n\n');

  const prompt = `<system_prompt>
<role>
당신은 시니어 개발자이자 기술 면접관입니다. Git 커밋 히스토리와 실제 코드 변경(diff)을 분석하여, 면접에서 바로 활용할 수 있는 깊이 있는 기술 경험 스토리를 만들어 주는 전문가입니다.
</role>

<core_principles>
1. 커밋 메시지 + 실제 diff를 교차 분석하여 "어떤 코드를, 왜, 어떻게 바꿨는지"를 추출하십시오.
2. fix/refactor 커밋에서는 반드시 트러블슈팅 과정(발생 원인 → 분석 → 해결책 선택 → 결과)을 서술하십시오.
3. 코드 변경에서 기술적 의사결정(왜 이 방식을 선택했는지)을 추론하십시오.
4. 수치가 없으면 변경된 파일 수, 라인 수, 영향 범위로 임팩트를 표현하십시오.
5. 반드시 완벽한 JSON 객체 형식으로만 출력하십시오.
</core_principles>

<input>
레포지토리: ${repoName}
작업 유형: ${group.prefix}
커밋 수: ${group.commits.length}개

[커밋 히스토리]
${commitSummaries.map(c => `[${c.date}] (${c.sha}) ${c.message}`).join('\n')}

[대표 커밋 코드 변경 상세]
${diffText || '(diff 정보 없음 — 커밋 메시지 기반으로만 분석)'}
</input>

<output_format>
아래 JSON 스키마를 반드시 따르십시오. 단 하나의 JSON 객체만 출력하십시오.

{
  "project_name": "프로젝트 이름 (레포명 기반, 읽기 좋게 변환)",
  "core_tech_stack": "이 작업에 사용된 핵심 기술/언어/프레임워크 (예: React, TypeScript, Redis)",
  "core_impact": "이 커밋 그룹 전체의 가장 핵심적인 성과 한 줄 요약",
  "period": "작업 기간 (예: 2024.01 ~ 2024.03)",

  "problem_definition": [
    "코드/시스템에서 발견된 구체적인 문제 또는 요구사항 (diff에서 추출)",
    "기존 구현의 한계점이나 버그 상황"
  ],

  "code_changes": [
    "변경된 핵심 파일/모듈과 변경 내용 요약 (예: auth/middleware.ts — JWT 검증 로직을 쿠키 기반으로 전환)",
    "주요 리팩토링 또는 신규 구현 내용"
  ],

  "troubleshooting": [
    "발생한 문제 → 원인 분석 → 선택한 해결책의 흐름으로 서술 (fix 커밋에서 추출)",
    "기술적 의사결정 근거 (왜 이 방식을 선택했는가)"
  ],

  "action_and_solution": [
    "구체적으로 실행한 작업 내용 (개조식)",
    "적용한 기술적 패턴이나 알고리즘"
  ],

  "learning": [
    "이 작업을 통해 얻은 기술적 인사이트",
    "다음에 적용할 개선 방향"
  ]
}
</output_format>
</system_prompt>`;

  const text = await callProFirst(prompt, `GitAnalysis-${group.prefix}`);
  return parseJSON(text, /\{[\s\S]*\}/);
}

/**
 * GitHub 레포지토리의 커밋 + diff를 분석하여 포트폴리오 경험 스토리 배열 반환
 */
export async function analyzeGitCommits(repoUrl, authorParam, token) {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  console.log(`[GitAnalysis] ${owner}/${repo} - author: ${authorParam} 커밋 수집 중...`);
  const commits = await getCommitsByAuthor(owner, repo, authorParam, token);

  if (commits.length === 0) {
    throw new Error(`해당 레포지토리에서 '${authorParam}'의 커밋을 찾을 수 없습니다. GitHub 사용자명을 확인해주세요.`);
  }

  console.log(`[GitAnalysis] ${commits.length}개 커밋 수집 완료. 그룹핑 중...`);
  const groups = groupCommits(commits);
  console.log(`[GitAnalysis] ${groups.length}개 그룹 생성. diff 수집 + AI 분석 시작...`);

  // 각 그룹 병렬 분석 (diff 수집 포함)
  const results = await Promise.allSettled(
    groups.map(group => analyzeCommitGroup(group, repo, owner, repo, token))
  );

  const experiences = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  if (experiences.length === 0) {
    throw new Error('커밋 분석에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }

  console.log(`[GitAnalysis] ✓ ${experiences.length}개 경험 스토리 생성 완료`);
  return {
    repoName: `${owner}/${repo}`,
    totalCommits: commits.length,
    experiences,
  };
}
