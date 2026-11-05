import { materialPlainText } from './materialPlainText.mjs';
import { evidenceSentences, hasActionEvidence, isFutureEvidence } from '../local-connector/experienceEvidence.mjs';
import { experienceTextLines, isSourceArtifact } from '../local-connector/experienceText.mjs';

const unique = rows => [...new Set(rows.map(value => String(value || '').trim()).filter(Boolean))].join('\n');
const goal = /목표|맡은\s*과제|해결해야|해야\s*(?:했|하는|할)|요구사항|need(?:ed)? to|responsib/i;
const careerWish = /고\s*싶|지원\s*동기|입사\s*후|귀사|하겠습니다|할\s*(?:예정|계획)|기대\s*효과|향후\s*가능성|\bwill\s/i;
const sourceLines = value => experienceTextLines(materialPlainText(experienceTextLines(value).join('\n')));
const sentences = value => sourceLines(value).flatMap(evidenceSentences).filter(line => !isSourceArtifact(line));
const labels = [
  ['situation', /^(?:S(?:\s*\(Situation\))?|Situation|상황|배경|문제|Context)$/i],
  ['task', /^(?:T(?:\s*\(Task\))?|Task|과제|목표|담당\s*과제|해결해야\s*할\s*문제)$/i],
  ['action', /^(?:A(?:\s*\(Action\))?|Action|행동|한\s*일|직접\s*한\s*일|수행|주요\s*업무|담당\s*업무)$/i],
  ['result', /^(?:R(?:\s*\(Result\))?|Result|결과|성과|실적)$/i],
];

// Extract source sentences, never write a missing task or turn a goal into an outcome.
export function extractLocalStar(item = {}) {
  const buckets = { situation: [], task: [], action: [], result: [] };
  let section = null;
  for (const raw of sourceLines(item.sourceText || '')) {
    const line = raw.replace(/^\s*(?:[-*•]\s+|#{1,6}\s*)/, '').trim();
    if (!line) continue;
    const match = line.match(/^([^:：]{1,40})\s*[:：]\s*(.*)$/);
    const label = match?.[1]?.trim() || line;
    const key = labels.find(([, re]) => re.test(label))?.[0];
    if (key) { section = key; if (match?.[2]) buckets[key].push(match[2]); continue; }
    if (/^(?:역할|담당|기간|기술|배운\s*점|회고|learning|role)(?:\s*[:：]|$)/i.test(line)) { section = null; continue; }
    if (match) { section = null; continue; }
    if (section) buckets[section].push(line);
  }
  const context = sentences(item.situation || item.context || '');
  const situation = unique((buckets.situation.length ? buckets.situation.flatMap(sentences) : context.filter(line => !goal.test(line)))
    .filter(line => !isFutureEvidence(line) && !/잠재력|기대\s*효과|향후\s*가능성/.test(line)));
  const task = unique((buckets.task.length ? buckets.task : [item.task, ...context.filter(line => goal.test(line))]).flatMap(sentences).filter(line => !careerWish.test(line)));
  const action = unique((buckets.action.length ? buckets.action : [item.action]).flatMap(sentences).filter(line => hasActionEvidence(line, true)));
  const result = unique((buckets.result.length ? buckets.result : [item.result]).flatMap(sentences).filter(value => !isFutureEvidence(value) && (
    !/목표|예상|기대|할\s*예정|할\s*계획|will\s/i.test(value || '') || /달성했|확인했|완료했|배포했|achieved|delivered/i.test(value || ''))));
  const roleSentence = sentences(item.sourceText).find(line => hasActionEvidence(line) && /(?:저는|제가|나는|내가|본인은)/.test(line));
  const role = (!isSourceArtifact(item.role) && !careerWish.test(item.role) ? item.role : '') || roleSentence?.match(/(?:저는|제가|나는|내가|본인은)\s+(?:이\s*프로젝트(?:에서|의)\s*)?([^,.!?\n]{1,45}?(?:개발자|기획자|디자이너|마케터|담당자|운영자|팀장|연구원|PM))(?:로서|으로서|로|으로|를|을|\s|,)/)?.[1] || '';
  return { ...item, role, context: situation, situation, task, action, result, framework: 'STAR',
    star: { situation, task, action, result } };
}
