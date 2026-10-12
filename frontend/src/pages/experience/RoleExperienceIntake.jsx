import { getRoleExperienceIntake } from '../../utils/roleExperienceIntake';

export function RoleExperienceGuide({ role }) {
  const guide = getRoleExperienceIntake(role);
  if (!guide) return null;
  return (
    <section className="my-5 rounded-xl border border-primary-100 bg-primary-50/40 p-4" aria-label={`${guide.label} 경험 정리 안내`}>
      <h2 className="text-[14px] font-bold text-bluewood-900">{guide.headline}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-bluewood-600">{guide.summary}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-bluewood-500">연결할 자료: {guide.materials}</p>
    </section>
  );
}

export function RoleExperienceInputs({ role, values, onChange }) {
  const guide = getRoleExperienceIntake(role);
  if (!guide) return null;
  return (
    <details className="rounded-xl border border-surface-200 bg-white p-4">
      <summary className="cursor-pointer text-[13px] font-bold text-bluewood-800">{guide.label} 핵심 장면 직접 기록하기 <span className="font-normal text-bluewood-400">(선택)</span></summary>
      <p className="mt-3 text-[12px] leading-relaxed text-bluewood-500">자료에 없는 내용을 기억나는 항목만 적어주세요. 작성한 내용은 경험 원문에 함께 보관해요.</p>
      <div className="mt-4 space-y-5">
        {guide.fields.map(item => (
          <label key={item.key} className="block">
            <span className="text-[13px] font-bold text-bluewood-700">{item.label}</span>
            <span className="mt-1 block text-[12px] leading-relaxed text-bluewood-500">{item.question}</span>
            <textarea value={values[item.key] || ''} onChange={event => onChange(item.key, event.target.value)} rows={3} maxLength={4000} placeholder={item.placeholder}
              className="mt-2 w-full resize-y rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-bluewood-800 outline-none placeholder:text-bluewood-300 focus:ring-2 focus:ring-primary-200" />
          </label>
        ))}
      </div>
    </details>
  );
}
