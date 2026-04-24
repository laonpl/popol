import { callProFirst, parseJSON } from './geminiService.js';

const GITHUB_API = 'https://api.github.com';

/**
 * GitHub URL에서 owner/repo 추출
 * 지원 형식: https://github.com/owner/repo, https://github.com/owner/repo.git
 */
function parseGitHubUrl(url) {
  const match = url.trim().match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) throw new Error('유효한 GitHub 레포지토리 URL이 아닙니다. (예: https://github.com/username/repo)');
  return { owner: match[1], repo: match[2] };
}

/** GitHub REST API 호출 헬퍼 (선택적 토큰 지원) */
async function ghFetch(path, token) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${GITHUB_API}${path}`, { headers });
  if (res.status === 404) throw new Error('레포지토리를 찾을 수 없습니다. URL 또는 공개 여부를 확인해주세요.');
  if (res.status === 403) throw new Error('GitHub API 요청 한도 초과입니다. 잠시 후 다시 시도해주세요.');
  if (!res.ok) throw new Error(`GitHub API 오류 (${res.status})`);
  return res.json();
}

/**
 * 레포 기여자 이메일 추정 — /commits?author= 는 username 기반이므로
 * 첫 커밋에서 committer email을 추출해 사용자 식별에 활용
 */
async function getCommitsByAuthor(owner, repo, authorParam, token, maxCommits = 80) {
  // authorParam: GitHub username 또는 이메일(이메일이면 username 검색 후 재시도)
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
      // 404는 작성자 못 찾음 → 빈 배열 반환
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
 * 커밋의 diff (파일 변경 내용) 가져오기 — 너무 크면 summary만
 */
async function getCommitDiff(owner, repo, sha, token) {
  try {
    const data = await ghFetch(`/repos/${owner}/${repo}/commits/${sha}`, token);
    const files = (data.files || []).slice(0, 8); // 파일 수 제한
    return files.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: (f.patch || '').substring(0, 600), // diff 텍스트 600자 제한
    }));
  } catch {
    return [];
  }
}

/**
 * 커밋 목록을 프로젝트/기능 단위로 그룹핑
 * 비슷한 파일 경로나 커밋 메시지 prefix를 기준으로 묶음
 */
function groupCommits(commits) {
  if (commits.length === 0) return [];

  // 최대 5개 그룹 생성 (Gemini 분석 비용 절감)
  const MAX_GROUPS = 5;

  // 커밋 메시지에서 scope 또는 prefix 추출 (feat(auth):, fix:, chore: 등)
  const getPrefix = (msg) => {
    const m = msg.match(/^([a-z]+)(?:\([^)]+\))?:/i);
    return m ? m[1].toLowerCase() : 'misc';
  };

  // 날짜 기준으로 정렬 (최신 → 오래된 순)
  const sorted = [...commits].sort((a, b) =>
    new Date(b.commit.author.date) - new Date(a.commit.author.date)
  );

  // prefix별 그룹핑
  const groupMap = new Map();
  for (const c of sorted) {
    const prefix = getPrefix(c.commit.message);
    if (!groupMap.has(prefix)) groupMap.set(prefix, []);
    groupMap.get(prefix).push(c);
  }

  // 그룹 수가 MAX_GROUPS 초과하면 가장 커밋 수 많은 그룹들만 유지
  const groups = [...groupMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_GROUPS)
    .map(([prefix, commits]) => ({ prefix, commits }));

  // 커밋이 너무 적으면 단일 그룹으로 합침
  if (groups.length === 0) return [{ prefix: 'project', commits: sorted }];
  return groups;
}

/** Gemini에게 커밋 그룹을 경험 스토리로 변환 요청 */
async function analyzeCommitGroup(group, repoName) {
  const commitSummaries = group.commits.slice(0, 15).map(c => ({
    message: c.commit.message.split('\n')[0].substring(0, 120),
    date: c.commit.author.date?.substring(0, 10),
    sha: c.sha.substring(0, 7),
  }));

  // diff는 대표 커밋 2개만
  const representativeCommits = group.commits.slice(0, 2);

  const prompt = `<system_prompt>
<role>
당신은 전 세계 최고의 시니어 개발자이자 채용 담당자입니다. 당신은 파편화된 'Git 커밋 메시지'와 '코드 변경 내용(Git Diff)'을 분석하여, 면접관이 매료될 만한 논리적인 '기술 성과 및 트러블슈팅 경험'으로 변환해 주는 최고의 컨설턴트입니다.
</role>

<core_principles>
1. '무엇을 했는가(What)'보다 '왜 했으며(Why)', '어떤 기술적 고민을 했는가(How)', '그 결과 어떤 변화가 있었는가(Result)'에 집중하십시오.
2. 불필요한 줄글을 배제하고, 즉시 포트폴리오나 이력서에 복사-붙여넣기 할 수 있는 개조식 문장(~함, ~구축, ~달성)으로 압축하십시오.
3. [결과] 부분에는 대략적으로라도 TPS 향상, 로딩 속도 단축 등 수치적 성과를 유추하여 포함시키십시오.
4. 반드시 완벽한 JSON 객체 형식으로만 출력하십시오.
</core_principles>

<input>
레포지토리: ${repoName}
커밋 그룹 (${group.prefix} 관련 작업):
${commitSummaries.map(c => `- [${c.date}] ${c.message}`).join('\n')}
</input>

<output_format>
아래 JSON 스키마를 엄격히 따르십시오. 단 하나의 JSON 객체만 출력하십시오.

{
  "project_name": "프로젝트 이름 (레포명 기반)",
  "core_tech_stack": "가장 중요한 기술 스택 (예: React, TypeScript, Kafka)",
  "core_impact": "가장 눈에 띄는 최종 성과 요약 (예: 결제 전환율 20% 상승)",
  "period": "작업 기간 (예: 2024.01 ~ 2024.03)",
  "problem_definition": [
    "발견한 구체적인 문제점 1",
    "발견한 구체적인 문제점 2"
  ],
  "action_and_solution": [
    "기술적 해결 전략 및 고민 과정",
    "구체적인 코드 구현 내용"
  ],
  "learning": [
    "프로젝트를 통해 얻은 기술적 인사이트 및 아쉬운 점"
  ]
}
</output_format>
</system_prompt>`;

  const text = await callProFirst(prompt, `GitAnalysis-${group.prefix}`);
  return parseJSON(text, /\{[\s\S]*\}/);
}

/**
 * GitHub 레포지토리의 커밋을 분석하여 포트폴리오 경험 스토리 배열 반환
 *
 * @param {string} repoUrl - GitHub 레포지토리 URL
 * @param {string} authorParam - GitHub username 또는 이메일
 * @param {string} [token] - 선택적 GitHub Personal Access Token (비공개 레포용)
 * @returns {Promise<Array>} - 분석된 경험 스토리 배열
 */
export async function analyzeGitCommits(repoUrl, authorParam, token) {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  // 1단계: 커밋 수집
  console.log(`[GitAnalysis] ${owner}/${repo} - author: ${authorParam} 커밋 수집 중...`);
  const commits = await getCommitsByAuthor(owner, repo, authorParam, token);

  if (commits.length === 0) {
    throw new Error(`해당 레포지토리에서 '${authorParam}'의 커밋을 찾을 수 없습니다. GitHub 사용자명을 확인해주세요.`);
  }

  console.log(`[GitAnalysis] ${commits.length}개 커밋 수집 완료. 그룹핑 중...`);

  // 2단계: 커밋 그룹핑
  const groups = groupCommits(commits);
  console.log(`[GitAnalysis] ${groups.length}개 그룹 생성. AI 분석 시작...`);

  // 3단계: 각 그룹 병렬 분석 (최대 5개)
  const results = await Promise.allSettled(
    groups.map(group => analyzeCommitGroup(group, repo))
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
