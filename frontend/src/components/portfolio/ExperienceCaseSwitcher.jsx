import { useId } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import './ExperienceCaseSwitcher.css';

/** Long experience titles stay readable without turning navigation into a wall of cards. */
export default function ExperienceCaseSwitcher({ cases, selected, onSelect, panelId }) {
  const id = useId();
  return <nav className="experience-case-switcher print:hidden" aria-label="핵심 경험 선택">
    <label htmlFor={id}>핵심 경험 <span aria-live="polite">{String(selected + 1).padStart(2, '0')} / {String(cases.length).padStart(2, '0')}</span></label>
    <div className="experience-case-select">
      <select id={id} value={selected} onChange={event => onSelect(Number(event.target.value))} aria-controls={panelId}>
        {cases.map((item, index) => <option key={item.id} value={index}>{String(index + 1).padStart(2, '0')}　{item.title}</option>)}
      </select>
      <ChevronDown size={16} aria-hidden="true" />
    </div>
    <div className="experience-case-arrows">
      <button type="button" aria-label="이전 핵심 경험" disabled={selected === 0} onClick={() => onSelect(selected - 1)}><ChevronLeft size={17} /></button>
      <button type="button" aria-label="다음 핵심 경험" disabled={selected === cases.length - 1} onClick={() => onSelect(selected + 1)}><ChevronRight size={17} /></button>
    </div>
  </nav>;
}
