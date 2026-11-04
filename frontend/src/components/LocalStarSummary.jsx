import { materialPlainText } from '../../../shared/materialPlainText.mjs';

export default function LocalStarSummary({ result }) {
  if (result?.framework !== 'STAR') return null;
  const fields = [['situation', 'S · 상황'], ['task', 'T · 과제·목표'], ['action', 'A · 내가 한 행동'], ['result', 'R · 결과']];
  return <section className="mb-6 rounded-2xl border border-[#cccac0] bg-white p-5" aria-label="STAR 경험 정리">
    <h2 className="text-lg font-bold">STAR 경험 정리</h2>
    <p className="mt-1 mb-3 text-sm text-[#67675e]">원문에서 확인한 상황·과제·행동·결과예요. 빈 항목은 경험을 보완하며 채울 수 있어요.</p>
    {(result.keyExperiences || []).map((experience, index) => <details key={experience.id || index} open={index === 0} className="border-t border-[#ecebe5] py-3">
      <summary className="cursor-pointer font-semibold">{materialPlainText(experience.title) || `경험 ${index + 1}`}</summary>
      <dl className="mt-3 grid gap-4 md:grid-cols-2">{fields.map(([key, label]) => <div key={key}>
        <dt className="mb-1 text-sm font-bold">{label}</dt>
        <dd className="whitespace-pre-wrap text-sm leading-6">{materialPlainText(experience[key] || (key === 'situation' ? experience.context : '')) || '자료에서 확인되지 않았어요.'}</dd>
      </div>)}</dl>
    </details>)}
  </section>;
}
