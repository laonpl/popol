import { useState } from 'react';
import { Plus, ArrowUpRight } from 'lucide-react';
import { RoleWorkCapture } from './WorkProductReview';
import { PM_WORK_PRODUCTS } from '../../utils/pmWorkProducts';
import { MARKETER_WORK_PRODUCTS } from '../../utils/marketerWorkProducts';
import { metricComparison } from '../../utils/roleImpactReport';

export function ReportChapter({ id, number, title, subtitle, children, role, sr, item, onChange, groups = [] }) {
  const [writing, setWriting] = useState(false);
  const catalog = role === 'pm' ? PM_WORK_PRODUCTS : MARKETER_WORK_PRODUCTS;
  const captureGroups = groups.map(key => catalog.find(group => group.key === key)).filter(Boolean);
  return <section id={id} className="ir-chapter">
    <header className="ir-chapter-heading"><span>{number}</span><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{onChange && captureGroups.length > 0 && <button className="print:hidden" type="button" aria-expanded={writing} onClick={() => setWriting(value => !value)}><Plus size={13} />기록 추가</button>}</header>
    {children}
    {writing && <div className="ir-write print:hidden"><RoleWorkCapture sr={sr} item={item} role={role} groups={captureGroups} onChange={onChange} defaultGroup={captureGroups[0]?.key} open /></div>}
  </section>;
}

export function ReportEmpty({ children }) { return <p className="ir-empty">{children}</p>; }
export function ReportField({ label, value }) { return value ? <div className="ir-field"><dt>{label}</dt><dd>{value}</dd></div> : null; }

export function ComparisonBars({ metric }) {
  const comparison = metricComparison(metric);
  return <div className="ir-metric-comparison">
    {comparison ? <div className="ir-bars" role="img" aria-label={`${metric.name}: ${comparison.points.map(point => `${point.label} ${point.raw}`).join(', ')}`}>
      {comparison.points.map(point => <div key={point.key} data-kind={point.key}><small>{point.label}</small><div><span style={{ width: `${point.width}%` }} /></div><b>{point.raw}</b></div>)}
    </div> : <dl className="ir-metric-values">{[['baseline', '기준'], ['actual', '관찰'], ['target', '목표']].map(([key, label]) => <ReportField key={key} label={label} value={metric[key]} />)}</dl>}
    <p className="ir-measurement">{[metric.period, metric.population, metric.method].filter(Boolean).join(' · ') || '측정 조건 미기록'}</p>
  </div>;
}

export function ReportStats({ rows }) { return <dl className="ir-stats">{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}<small>건</small></dd></div>)}</dl>; }

export function ReportJump({ entries }) { return <nav className="ir-jump print:hidden" aria-label="핵심 경험 리포트 목차">{entries.map(([id, label]) => <a key={id} href={`#${id}`}>{label}<ArrowUpRight size={12} /></a>)}</nav>; }
