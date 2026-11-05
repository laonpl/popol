// Keep the original document for provenance; only these filtered lines populate experience fields.
// Exports of portfolio pages often contain contact headers and the page's JS/JSON alongside prose.
export function isSourceArtifact(value) {
  const line = String(value || '').trim();
  if (!line) return true;
  if (/^[\s{}\[\](),;]+$/.test(line)) return true;
  if (/^(?:import\s+.+\s+from\b|export\s+(?:default|const|let|function|class)\b|(?:const|let|var)\s+[$\w]+\s*=|(?:async\s+)?function\s+[$\w]+\s*\(|class\s+[$\w]+\s*[{:]|(?:return|throw)\s+|(?:if|for|while|switch)\s*\()/i.test(line)) return true;
  if (/(?:=>|\b(?:console|document|window)\.[$\w]+\s*\(|;\s*(?:const|let|var|return)\b)/.test(line)) return true;
  if (/^(?:["'][^"']+["']\s*:|[A-Za-z_$][\w$-]*\s*:\s*(?:["'`{\[]|true\b|false\b|null\b)|(?:id|index|key)\s*:\s*\d)/.test(line)
    && !/^(?:역할|담당|기간|상황|배경|문제|과제|목표|행동|한\s*일|결과|성과|실적|배운\s*점|회고|[STAR]|situation|context|task|action|result|role)\s*[:：]/i.test(line)) return true;
  if (/^(?:[.#][\w-]+(?:\s+[.#]?[\w-]+)*\s*\{|<\/?[A-Za-z][^>]*>|(?:npm|pnpm|yarn)\s+(?:install|run|add)\b)/.test(line)) return true;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?<!\d)(?:\+82[- .]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)/i.test(line)) return true;
  if (/^(?:(?:https?:\/\/|www\.|github\.com\/|[\w.-]+\.(?:com|co\.kr|kr|io|dev|net)\/)[^\s]+\s*[·|,]?\s*)+$/i.test(line)) return true;
  if (/^(?:이메일|메일|전화|연락처|생년월일|주소|email|e-mail|phone|contact|copyright|all rights reserved)\s*(?:[:：©]|$)/i.test(line)) return true;
  return /^(?:HIGHLIGHTS?|PORTFOLIO|CONTENTS?|OVERVIEW|PROFILE|ABOUT(?:\s+ME)?|EMAIL|CONTACT|SKILLS?|TECH\s*STACK|PROBLEM|SOLUTION|NAME|VALUE|POINT|목차|인적\s*사항|연락처)$/i.test(line);
}

export function experienceTextLines(value) {
  const withoutCode = String(value || '').replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '');
  return withoutCode.split(/\r?\n/).map(line => line.trim()).filter(line => !isSourceArtifact(line));
}
