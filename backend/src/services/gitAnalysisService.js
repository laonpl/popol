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
        // patch는 실제 코드 변경 라인 (+/- 표시) — 1800자로 제한(스니펫 발췌 여유 확보)
        patch: (f.patch || '').substring(0, 1800),
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

  let groups = [...groupMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_GROUPS)
    .map(([prefix, commits]) => ({ prefix, commits }));

  if (groups.length === 0) return [{ prefix: 'project', commits: sorted }];

  // 컨벤션 커밋을 안 써서 그룹이 1~2개뿐이면(예: 전부 'misc'),
  // 커밋이 충분할 때 시간순 청크로 분할해 3~4개의 작업 단위(경험)로 만든다.
  if (groups.length < 3 && sorted.length >= 6) {
    const targetChunks = Math.min(4, Math.floor(sorted.length / 3));
    if (targetChunks >= 2) {
      const chunkSize = Math.ceil(sorted.length / targetChunks);
      groups = Array.from({ length: targetChunks }, (_, i) => ({
        prefix: `phase-${i + 1}`,
        commits: sorted.slice(i * chunkSize, (i + 1) * chunkSize),
      })).filter(g => g.commits.length > 0);
    }
  }

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

<depth_rules>
- 핵심만 간결하게. 각 배열 항목은 한 문장(60자 내외)으로, 구체적 파일·함수·기술명을 근거로 쓰되 장황한 배경 설명은 금지합니다.
- problem_definition / action_and_solution / troubleshooting / learning 배열은 각각 최대 2개 항목까지만 채우십시오. 덜 중요한 내용은 버리십시오.
- code_snippets는 diff에 코드가 있으면 가장 핵심적인 것 1~2개만 발췌하십시오. why는 "이 코드가 어떤 문제를 어떻게 푸는지" 한 문장으로(단순 '코드를 추가함' 금지).
- diff에 실제 코드 라인(+/-)이 있으면 code_snippets/troubleshooting_snippets의 code에 그 라인을 그대로 발췌하십시오. 상상해서 지어내지 마십시오. 코드도 핵심 3~8줄만.
- core_impact는 이 그룹에서 실제로 좋아진 점을 근거와 함께 한 문장으로 구체적으로 쓰십시오.
- project_name은 프로젝트/레포 이름이나 "기능 개선", "버그 수정" 같은 광범위한 제목 금지. "무슨 문제를 해결/구현했는지"가 드러나는 구체적 제목으로 쓰십시오. (좋은 예: "동시 결제 요청 중복 처리 문제 해결", "이미지 업로드 OCR 파이프라인 구축" / 나쁜 예: "Popol 개선", "코드 리팩토링")
</depth_rules>
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
  "project_name": "이 커밋 그룹이 해결한 구체적 문제/작업이 드러나는 한 줄 제목 (예: '동시 결제 중복 처리 문제 해결' — 레포 이름·'기능 개선' 같은 광범위한 제목 금지)",
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

  "code_snippets": [
    { "file": "변경된 파일 경로 (예: src/auth/middleware.ts)", "code": "제공된 diff에서 발췌한 실제 핵심 변경 코드 3~10줄. diff에 없으면 이 항목 생략", "why": "이 코드로 무엇을 어떻게 바꿨고 왜 그렇게 했는지, 어떤 문제를 해결하는지 자연스러운 1~2문장 설명" }
  ],

  "troubleshooting": [
    "발생한 문제 → 원인 분석 → 선택한 해결책의 흐름으로 서술 (fix 커밋에서 추출)",
    "기술적 의사결정 근거 (왜 이 방식을 선택했는가)"
  ],

  "troubleshooting_snippets": [
    { "issue": "발생한 문제/버그 상황 한 줄 (예: 동시 요청 시 중복 결제 발생)", "file": "관련 파일(선택)", "code": "이 문제를 해결한 실제 diff 코드 3~10줄", "solution": "이 코드로 어떤 부분을 어떻게 해결했는지 자연스러운 1~2문장 설명" }
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
 * AI 응답을 저장 가능한 형태로 정규화.
 * Firestore는 배열 속 배열 같은 중첩 엔티티를 거부(INVALID_ARGUMENT)하므로,
 * 모든 필드를 문자열 / 문자열 배열 / 평탄한 객체 배열로 강제한다.
 */
function asStr(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(asStr).filter(Boolean).join('\n');
  if (typeof v === 'object') return Object.values(v).map(asStr).filter(Boolean).join(' ');
  return String(v);
}
function asStrArr(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(asStr).map(s => s.trim()).filter(Boolean);
  const s = asStr(v).trim();
  return s ? [s] : [];
}
function asSnippetArr(v, keys) {
  if (!Array.isArray(v)) return [];
  return v
    .map(item => {
      if (item == null) return null;
      if (typeof item === 'string') return { code: item };
      if (typeof item !== 'object' || Array.isArray(item)) return null;
      const out = {};
      for (const k of keys) out[k] = asStr(item[k]).trim();
      return out;
    })
    .filter(s => s && Object.values(s).some(Boolean));
}
function normalizeGitExperience(raw) {
  const e = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const codeSnippets = asSnippetArr(e.code_snippets, ['file', 'code', 'why']);
  // 일부 응답은 why 대신 change 키를 씀 — why로 통일
  if (Array.isArray(e.code_snippets)) {
    e.code_snippets.forEach((item, i) => {
      if (codeSnippets[i] && !codeSnippets[i].why && item && typeof item === 'object') {
        codeSnippets[i].why = asStr(item.change).trim();
      }
    });
  }
  return {
    project_name: asStr(e.project_name).trim(),
    core_tech_stack: asStr(e.core_tech_stack).trim(),
    core_impact: asStr(e.core_impact).trim(),
    period: asStr(e.period).trim(),
    problem_definition: asStrArr(e.problem_definition),
    code_changes: asStrArr(e.code_changes),
    code_snippets: codeSnippets,
    troubleshooting: asStrArr(e.troubleshooting),
    troubleshooting_snippets: asSnippetArr(e.troubleshooting_snippets, ['issue', 'file', 'code', 'solution']),
    action_and_solution: asStrArr(e.action_and_solution),
    learning: asStrArr(e.learning),
  };
}

/**
 * 커밋 메시지 → 작업 유형 분류.
 * conventional prefix(feat: 등)가 없으면 한국어/영어 키워드로 추정 — 한국어 커밋 레포에서 전부 'other'로 뭉치는 문제 방지.
 */
const CONVENTIONAL_TYPES = new Set(['feat', 'fix', 'refactor', 'docs', 'style', 'test', 'chore', 'perf', 'build', 'ci', 'revert']);
function classifyCommitType(msg) {
  const m = msg.match(/^([a-z]+)(?:\([^)]+\))?\s*[:!]/i);
  if (m && CONVENTIONAL_TYPES.has(m[1].toLowerCase())) return m[1].toLowerCase();
  const s = msg.toLowerCase();
  if (/(fix|hotfix|patch|버그|오류|에러|수정|해결)/.test(s)) return 'fix';
  if (/(feat|기능|추가|구현|신규|생성|개발|제작)/.test(s)) return 'feat';
  if (/(refactor|리팩터|리팩토링|개선|정리)/.test(s)) return 'refactor';
  if (/(perf|성능|최적화|속도)/.test(s)) return 'perf';
  if (/(docs|문서|readme|주석)/.test(s)) return 'docs';
  if (/(test|테스트)/.test(s)) return 'test';
  if (/(style|스타일|디자인|\bui\b|css|레이아웃|화면)/.test(s)) return 'ui';
  if (/(chore|build|deploy|merge|배포|설정|빌드|config|의존성|버전)/.test(s)) return 'chore';
  return 'etc';
}

/**
 * 커밋 기여 비중 통계 — 기여자 API(내 커밋/전체·순위) + 언어 비율.
 * 실패해도 분석 전체를 막지 않도록 항상 객체를 반환(부분 실패는 무시).
 */
async function getContributionStats(owner, repo, authorParam, token, myCommits = []) {
  const myCommitCount = Array.isArray(myCommits) ? myCommits.length : (myCommits || 0);
  const stats = {
    myCommits: myCommitCount,
    totalCommits: 0,
    contributionPct: 0,
    rank: null,
    contributorCount: 0,
    languages: [],
    commitTypes: [],   // [{ type: 'feat', count: n }] — 내 커밋 유형 분포 (근거)
    activePeriod: null, // { first, last } — 내 활동 기간 (근거)
    dailyActivity: [], // [{ d: 'YYYY-MM-DD', count }] — 내 커밋 일별 분포 (잔디 그래프용)
  };

  // 내 커밋에서 유형 분포·활동 기간·일별 분포 산출 (실제 커밋 메시지·날짜 기반 근거)
  if (Array.isArray(myCommits) && myCommits.length) {
    const typeCount = {};
    const dayCount = {};
    let first = null, last = null;
    for (const c of myCommits) {
      const msg = c?.commit?.message || '';
      const type = classifyCommitType(msg);
      typeCount[type] = (typeCount[type] || 0) + 1;
      const d = c?.commit?.author?.date || c?.commit?.committer?.date;
      if (d) {
        if (!first || d < first) first = d;
        if (!last || d > last) last = d;
        const day = d.slice(0, 10);
        dayCount[day] = (dayCount[day] || 0) + 1;
      }
    }
    stats.commitTypes = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, count]) => ({ type, count }));
    if (first && last) stats.activePeriod = { first: first.slice(0, 10), last: last.slice(0, 10) };
    stats.dailyActivity = Object.entries(dayCount)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([d, count]) => ({ d, count }));
  }

  // 기여자별 커밋수 → 내 비중·순위
  try {
    const contributors = await ghFetch(`/repos/${owner}/${repo}/contributors?per_page=100`, token);
    if (Array.isArray(contributors) && contributors.length) {
      const total = contributors.reduce((s, c) => s + (c.contributions || 0), 0);
      const lower = String(authorParam).toLowerCase();
      const meIdx = contributors.findIndex(c => String(c.login || '').toLowerCase() === lower);
      stats.contributorCount = contributors.length;
      stats.totalCommits = total;
      if (meIdx >= 0) {
        stats.myCommits = contributors[meIdx].contributions || myCommitCount || 0;
        stats.rank = meIdx + 1;
      }
      if (total > 0 && stats.myCommits > 0) {
        stats.contributionPct = Math.round((stats.myCommits / total) * 1000) / 10;
      }
    }
  } catch { /* 부분 실패 무시 */ }

  // 언어 비율 (bytes 기준)
  try {
    const langs = await ghFetch(`/repos/${owner}/${repo}/languages`, token);
    if (langs && typeof langs === 'object') {
      const entries = Object.entries(langs).filter(([, v]) => typeof v === 'number' && v > 0);
      const totalBytes = entries.reduce((s, [, v]) => s + v, 0);
      if (totalBytes > 0) {
        stats.languages = entries
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, bytes]) => ({ name, pct: Math.round((bytes / totalBytes) * 1000) / 10 }));
      }
    }
  } catch { /* 부분 실패 무시 */ }

  return stats;
}

/**
 * GitHub 레포지토리의 커밋 + diff를 분석하여 포트폴리오 경험 스토리 배열 반환
 */
export async function analyzeGitCommits(repoUrl, authorParam, token) {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  console.log(`[GitAnalysis] ${owner}/${repo} - author: ${authorParam} 커밋 수집 중...`);
  // 150개까지 수집 — 잔디(일별 활동)·기여 통계의 커버리지 확보 (목록 API 5페이지)
  const commits = await getCommitsByAuthor(owner, repo, authorParam, token, 150);

  if (commits.length === 0) {
    throw new Error(`해당 레포지토리에서 '${authorParam}'의 커밋을 찾을 수 없습니다. GitHub 사용자명을 확인해주세요.`);
  }

  console.log(`[GitAnalysis] ${commits.length}개 커밋 수집 완료. 그룹핑 중...`);
  const groups = groupCommits(commits);
  console.log(`[GitAnalysis] ${groups.length}개 그룹 생성. diff 수집 + AI 분석 시작...`);

  // 각 그룹 병렬 분석 (diff 수집 포함) — 핵심 경로. 이전과 동일하게 절대 throw 없음.
  const results = await Promise.allSettled(
    groups.map(group => analyzeCommitGroup(group, repo, owner, repo, token))
  );

  const experiences = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => normalizeGitExperience(r.value));

  if (experiences.length === 0) {
    // 개별 그룹 분석(주로 Gemini 호출)의 첫 실패 사유를 함께 노출 → 원인 특정
    const firstReason = results.find(r => r.status === 'rejected')?.reason?.message || '';
    console.error('[GitAnalysis] 모든 그룹 분석 실패:', firstReason);
    throw new Error(`커밋 분석에 실패했습니다. ${firstReason}`.trim());
  }

  // 기여 비중 통계는 best-effort — 실패/레이트리밋이 있어도 커밋 분석 결과에 영향 없음
  let contributionStats = null;
  try {
    contributionStats = await getContributionStats(owner, repo, authorParam, token, commits);
  } catch (err) {
    console.warn('[GitAnalysis] 기여 통계 수집 실패(무시):', err.message);
  }

  console.log(`[GitAnalysis] ✓ ${experiences.length}개 경험 스토리 생성 완료`);
  return {
    repoName: `${owner}/${repo}`,
    totalCommits: commits.length,
    contributionStats,
    experiences,
  };
}
