import { ArrowRight } from 'lucide-react';
import { experienceText } from '../../../../shared/sourceExperience.mjs';

export default function SourceExperienceFlow({ summary, item, role }) {
  const w = item.workProducts;
  const process = summary.process?.length ? summary.process : role === 'pm'
    ? (w.serviceBlueprint?.length ? w.serviceBlueprint.map(row => ({ title: row.step, description: row.customerAction || row.frontstage })) : w.alternatives.filter(row => /채택|선택/.test(row.disposition)).map(row => ({ title: row.option, description: row.reason })))
    : w.creatives.map(row => ({ title: row.variant || row.hook, description: row.rationale || row.cta }));
  const steps = process.filter(row => experienceText(row.title)).slice(0, 4);
  return <div className="one-source-execution"><header><span>{role === 'pm' ? 'PRODUCT DECISION' : 'CUSTOMER & EXECUTION'}</span><b>자료에서 정리한 판단과 실행</b></header>
    {summary.audience && <div className="one-audience"><small>대상 고객</small><b>{summary.audience}</b></div>}
    {steps.length > 0 ? <ol className="one-source-steps">{steps.map((step, i) => <li key={i}><div><span>{String(i + 1).padStart(2, '0')}</span></div><h4>{step.title}</h4><p>{experienceText(step.description)}</p>{i < steps.length - 1 && <ArrowRight size={17} />}</li>)}</ol> : summary.action ? <p className="one-execution-copy">{summary.action}</p> : null}
    {summary.decisions?.length > 0 && <div className="one-source-decisions">{summary.decisions.map((decision, i) => <article key={i}><div><b>{decision.title}</b>{decision.reason && <p>{decision.reason}</p>}</div></article>)}</div>}
  </div>;
}
