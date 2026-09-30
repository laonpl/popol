// Adapted from https://github.com/choi0806/gong (main); TypeScript removed for the FitPoly Node server.
const MAJOR = /삼성|엘지|\bLG\b|\bSK\b|SK[가-힣]|현대|기아|롯데|\bCJ\b|CJ[가-힣]|한화|포스코|\bGS\b|GS[가-힣]|두산|신세계|이마트|\bKT\b|네이버|NAVER|카카오|kakao|라인|\bLINE\b|쿠팡|coupang|토스|비바리퍼블리카|우아한형제들|배달의민족|당근|크래프톤|krafton|넥슨|엔씨소프트|\bNC\b|넷마블|하이브|아모레|올리브영|무신사|컬리|야놀자|11번가|몰로코|센드버드|리벨리온|직방|마이리얼트립|와디즈|뤼튼|현대오토에버/i;
const PUBLIC = /공사|공단|진흥원|재단법인|공공기관|시청|구청|도청|교육청|국립|연구원$/;
const HOSPITAL = /대학교병원|대학병원|서울아산|삼성서울|세브란스|서울성모|상급종합/;
function companyTier(job) {
  const name = `${job.company} ${job.source}`;
  if (HOSPITAL.test(name)) return "\uB300\uD559\uBCD1\uC6D0";
  if (PUBLIC.test(job.company)) return "\uACF5\uACF5\uAE30\uAD00";
  if (MAJOR.test(name)) return "\uC8FC\uC694 \uAE30\uC5C5";
  return "\uC77C\uBC18 \uAE30\uC5C5";
}
function roleFamily(role) {
  if (/개발|엔지니어|engineer|developer/i.test(role)) return "\uAC1C\uBC1C";
  if (/디자인|디자이너|영상/.test(role)) return "\uB514\uC790\uC778";
  if (/데이터|분석/.test(role)) return "\uB370\uC774\uD130";
  if (/마케|기획|PM|product manager/i.test(role)) return "\uB9C8\uCF00\uD305\xB7\uAE30\uD68D";
  if (/영업|인사|회계|세무|총무|상담|경영/.test(role)) return "\uC601\uC5C5\xB7\uACBD\uC601\uC9C0\uC6D0";
  if (/간호|의료|약사|치위생|물리치료/.test(role)) return "\uC758\uB8CC";
  if (/설계|건축|기계|전기|토목/.test(role)) return "\uC124\uACC4\xB7\uAE30\uC220";
  return "\uAE30\uD0C0";
}
const CERTIFICATES = [
  ["\uC815\uBCF4\uCC98\uB9AC\uAE30\uC0AC", /정보처리\s*기사/],
  ["\uC815\uBCF4\uCC98\uB9AC\uC0B0\uC5C5\uAE30\uC0AC", /정보처리\s*산업기사/],
  ["SQLD", /\bSQLD\b/i],
  ["ADsP", /\bADsP\b/i],
  ["\uBE45\uB370\uC774\uD130\uBD84\uC11D\uAE30\uC0AC", /빅데이터\s*분석\s*기사/],
  ["\uCEF4\uD4E8\uD130\uD65C\uC6A9\uB2A5\uB825", /컴퓨터\s*활용\s*능력|컴활/],
  ["\uC804\uC0B0\uD68C\uACC4", /전산\s*회계/],
  ["\uC7AC\uACBD\uAD00\uB9AC\uC0AC", /재경\s*관리사/],
  ["\uC138\uBB34\uC0AC", /세무사/],
  ["\uD68C\uACC4\uC0AC", /회계사|\bK?I?CPA\b/i],
  ["\uAC04\uD638\uC0AC \uBA74\uD5C8", /간호사\s*면허|면허\s*번호|registered\s*nurse/i],
  ["\uAC74\uCD95\uAE30\uC0AC", /건축\s*(?:산업)?기사/],
  ["\uC77C\uBC18\uAE30\uACC4\uAE30\uC0AC", /일반\s*기계\s*기사|기계\s*설계\s*(?:산업)?기사/],
  ["GTQ", /\bGTQ\b/i],
  ["\uCEEC\uB7EC\uB9AC\uC2A4\uD2B8", /컬러리스트/],
  ["\uAD6C\uAE00\uC560\uB110\uB9AC\uD2F1\uC2A4", /GAIQ|google analytics\s*(?:certif|자격)/i],
  ["\uC6B4\uC804\uBA74\uD5C8", /운전\s*면허/]
];
const OPIC_RANK = ["NL", "NM", "NH", "IL", "IM1", "IM2", "IM3", "IH", "AL"];
function resumeSignals(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const projectLines = new Set(lines.filter((line) => line.length <= 80 && /프로젝트|project|해커톤|hackathon/i.test(line)).map((line) => line.toLowerCase().replace(/\s+/g, "")));
  const toeic = text.match(/(?:토익|toeic)(?!\s*speaking)\D{0,8}(\d{3})/i);
  const opic = text.match(/(?:opic|오픽)\D{0,8}(AL|IH|IM\s*[1-3]|IM|IL|NH|NM|NL)\b/i)?.[1].replace(/\s/g, "").toUpperCase();
  const degree = /석사|master'?s|대학원\s*(?:졸업|수료)/i.test(text) ? "\uC11D\uC0AC" : /학사|대학교|university|bachelor|4년제/i.test(text) ? "\uD559\uC0AC" : /전문\s*학사|전문대|전문대학/.test(text) ? "\uC804\uBB38\uD559\uC0AC" : void 0;
  return {
    projects: Math.min(projectLines.size, 10),
    internship: /인턴|intern(?:ship)?\b|현장\s*실습/i.test(text),
    ...toeic && Number(toeic[1]) >= 10 && Number(toeic[1]) <= 990 ? { toeic: Number(toeic[1]) } : {},
    ...opic ? { opic: opic === "IM" ? "IM1" : opic } : {},
    certificates: CERTIFICATES.filter(([, pattern]) => pattern.test(text)).map(([name]) => name),
    ...degree ? { degree } : {},
    portfolio: /포트폴리오|portfolio|github\.com|behance|dribbble|notion\.site|velog|tistory/i.test(text),
    activities: /수상|공모전|대외\s*활동|서포터즈|동아리|해커톤|대상|최우수|우수상/.test(text)
  };
}
const count = (n) => (s) => s.projects >= n;
const languageMet = (toeic, opic) => (s) => (s.toeic ?? 0) >= toeic || OPIC_RANK.indexOf(s.opic ?? "") >= OPIC_RANK.indexOf(opic);
const languageMine = (s) => [s.toeic && `TOEIC ${s.toeic}`, s.opic && `OPIc ${s.opic}`].filter(Boolean).join(" \xB7 ") || "\uD655\uC778 \uC548 \uB428";
const certMine = (names) => (s) => s.certificates.filter((c) => names.includes(c)).join(" \xB7 ") || "\uD655\uC778 \uC548 \uB428";
const certMet = (names) => (s) => s.certificates.some((c) => names.includes(c));
const degreeRank = { \uC804\uBB38\uD559\uC0AC: 1, \uD559\uC0AC: 2, \uC11D\uC0AC: 3 };
function benchmarkCriteria(tier, family, level, minYears) {
  const entry = level === "\uC2E0\uC785" || level === "\uC778\uD134" || level === "\uC804\uCCB4" && !minYears;
  const major = tier === "\uC8FC\uC694 \uAE30\uC5C5";
  const rows = [];
  const projects = family === "\uAC1C\uBC1C" || family === "\uB370\uC774\uD130" ? major ? 3 : 2 : family === "\uB514\uC790\uC778" ? 3 : family === "\uB9C8\uCF00\uD305\xB7\uAE30\uD68D" ? major ? 2 : 1 : 0;
  if (projects && entry) rows.push({ label: "\uD504\uB85C\uC81D\uD2B8 \uACBD\uD5D8", expected: `${projects}\uAC1C \uC774\uC0C1`, mine: (s) => s.projects ? `\uC57D ${s.projects}\uAC1C` : "\uD655\uC778 \uC548 \uB428", met: count(projects) });
  if (family === "\uAC1C\uBC1C" || family === "\uB514\uC790\uC778" || family === "\uB370\uC774\uD130" || family === "\uB9C8\uCF00\uD305\xB7\uAE30\uD68D" && major) rows.push({ label: family === "\uAC1C\uBC1C" ? "\uD3EC\uD2B8\uD3F4\uB9AC\uC624\xB7GitHub" : "\uD3EC\uD2B8\uD3F4\uB9AC\uC624", expected: family === "\uB514\uC790\uC778" ? "\uD544\uC218" : "\uC788\uC74C", mine: (s) => s.portfolio ? "\uC788\uC74C" : "\uD655\uC778 \uC548 \uB428", met: (s) => s.portfolio });
  if (entry && (major || tier === "\uB300\uD559\uBCD1\uC6D0")) rows.push({ label: tier === "\uB300\uD559\uBCD1\uC6D0" ? "\uC2E4\uC2B5\xB7\uC778\uD134 \uACBD\uD5D8" : "\uC778\uD134\xB7\uC2E4\uBB34 \uACBD\uD5D8", expected: "1\uD68C \uC774\uC0C1", mine: (s) => s.internship ? "\uC788\uC74C" : "\uD655\uC778 \uC548 \uB428", met: (s) => s.internship });
  if (major && (family === "\uB9C8\uCF00\uD305\xB7\uAE30\uD68D" || family === "\uC601\uC5C5\xB7\uACBD\uC601\uC9C0\uC6D0" || family === "\uB370\uC774\uD130") || tier === "\uACF5\uACF5\uAE30\uAD00") rows.push({ label: "\uC5B4\uD559 \uC810\uC218", expected: tier === "\uACF5\uACF5\uAE30\uAD00" ? "TOEIC 700+ \uB610\uB294 OPIc IM1+" : "TOEIC 800+ \uB610\uB294 OPIc IM2+", mine: languageMine, met: tier === "\uACF5\uACF5\uAE30\uAD00" ? languageMet(700, "IM1") : languageMet(800, "IM2") });
  if (major || tier === "\uACF5\uACF5\uAE30\uAD00" || tier === "\uB300\uD559\uBCD1\uC6D0") rows.push({ label: "\uD559\uB825", expected: tier === "\uB300\uD559\uBCD1\uC6D0" ? "\uAC04\uD638\uD559 \uD559\uC0AC \uC774\uC0C1" : "\uD559\uC0AC \uC774\uC0C1", mine: (s) => s.degree ?? "\uD655\uC778 \uC548 \uB428", met: (s) => !!s.degree && degreeRank[s.degree] >= 2 });
  const certs = { \uC758\uB8CC: ["\uAC04\uD638\uC0AC \uBA74\uD5C8"], "\uC124\uACC4\xB7\uAE30\uC220": ["\uAC74\uCD95\uAE30\uC0AC", "\uC77C\uBC18\uAE30\uACC4\uAE30\uC0AC"], \uB370\uC774\uD130: ["SQLD", "ADsP", "\uBE45\uB370\uC774\uD130\uBD84\uC11D\uAE30\uC0AC"] };
  if (certs[family]) rows.push({ label: family === "\uC758\uB8CC" ? "\uBA74\uD5C8" : "\uAD00\uB828 \uC790\uACA9\uC99D", expected: family === "\uC758\uB8CC" ? "\uAC04\uD638\uC0AC \uBA74\uD5C8 \uD544\uC218" : `${certs[family].join("\xB7")} \uC911 1\uAC1C`, mine: certMine(certs[family]), met: certMet(certs[family]) });
  else if (family === "\uC601\uC5C5\xB7\uACBD\uC601\uC9C0\uC6D0") rows.push({ label: "\uAD00\uB828 \uC790\uACA9\uC99D", expected: "\uC9C1\uBB34 \uC790\uACA9\uC99D 1\uAC1C (\uC804\uC0B0\uD68C\uACC4\xB7\uCEF4\uD65C \uB4F1)", mine: certMine(["\uC804\uC0B0\uD68C\uACC4", "\uC7AC\uACBD\uAD00\uB9AC\uC0AC", "\uCEF4\uD4E8\uD130\uD65C\uC6A9\uB2A5\uB825", "\uC138\uBB34\uC0AC", "\uD68C\uACC4\uC0AC"]), met: certMet(["\uC804\uC0B0\uD68C\uACC4", "\uC7AC\uACBD\uAD00\uB9AC\uC0AC", "\uCEF4\uD4E8\uD130\uD65C\uC6A9\uB2A5\uB825", "\uC138\uBB34\uC0AC", "\uD68C\uACC4\uC0AC"]) });
  else if (family === "\uAC1C\uBC1C" && tier !== "\uC8FC\uC694 \uAE30\uC5C5") rows.push({ label: "\uAD00\uB828 \uC790\uACA9\uC99D", expected: "\uC815\uBCF4\uCC98\uB9AC\uAE30\uC0AC (\uC6B0\uB300)", mine: certMine(["\uC815\uBCF4\uCC98\uB9AC\uAE30\uC0AC", "\uC815\uBCF4\uCC98\uB9AC\uC0B0\uC5C5\uAE30\uC0AC"]), met: certMet(["\uC815\uBCF4\uCC98\uB9AC\uAE30\uC0AC", "\uC815\uBCF4\uCC98\uB9AC\uC0B0\uC5C5\uAE30\uC0AC"]) });
  if (entry && (family === "\uB9C8\uCF00\uD305\xB7\uAE30\uD68D" || family === "\uB514\uC790\uC778") && major) rows.push({ label: "\uACF5\uBAA8\uC804\xB7\uB300\uC678\uD65C\uB3D9", expected: "1\uD68C \uC774\uC0C1", mine: (s) => s.activities ? "\uC788\uC74C" : "\uD655\uC778 \uC548 \uB428", met: (s) => s.activities });
  return rows;
}
function evaluateBenchmark(job, profile, signals) {
  const tier = companyTier(job), family = roleFamily(profile.role);
  const rows = benchmarkCriteria(tier, family, job.level === "\uC804\uCCB4" ? profile.level : job.level, job.minYears).map((c) => ({ label: c.label, expected: c.expected, mine: c.mine(signals), met: c.met(signals) }));
  return { tier, family, rows };
}
export {
  benchmarkCriteria,
  companyTier,
  evaluateBenchmark,
  resumeSignals,
  roleFamily
};
