/**
 * RichTextRenderer — Yoopta 블록 JSON(또는 plain text)을 읽기 전용으로 렌더링.
 * 에디터(YooptaMiniEditor) 없이 본문을 표시할 때 사용 (미리보기 / 공개 링크 / 비주얼 템플릿 뷰).
 *
 * dark=true 이면 어두운 배경에서 읽히도록 텍스트 색상을 밝게 전환.
 */

export function collectRichText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collectRichText).join('');
  if (typeof node === 'object') {
    return [node.text, collectRichText(node.children), collectRichText(node.value)]
      .filter(Boolean)
      .join('');
  }
  return '';
}

export function richValueToPlainText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(item => item?.content || '').filter(Boolean).join('\n');
  if (typeof value === 'object') {
    return Object.values(value)
      .sort((a, b) => (a?.meta?.order ?? 0) - (b?.meta?.order ?? 0))
      .map(block => collectRichText(block?.value || block))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

export function richValueHasContent(value) {
  if (!value) return false;
  if (Array.isArray(value)) {
    return value.some(item => item?.type === 'image' || String(item?.content || '').trim());
  }
  if (typeof value === 'object') {
    return Object.values(value).some(block => {
      if (block?.type === 'Image') {
        const firstValue = Array.isArray(block.value) ? block.value[0] : null;
        return !!(firstValue?.props?.src || block?.props?.src);
      }
      if (block?.type === 'Table') return true;
      return collectRichText(block?.value || block).trim().length > 0;
    });
  }
  return richValueToPlainText(value).trim().length > 0;
}

export default function RichTextRenderer({ value, className = '', dark = false }) {
  if (!richValueHasContent(value)) return null;

  const c = dark
    ? { h1: 'text-gray-50', h2: 'text-gray-50', h3: 'text-gray-100', body: 'text-gray-200', bodySoft: 'text-gray-300', bullet: 'text-gray-500', quote: 'text-gray-300 border-gray-600', divider: 'border-gray-700' }
    : { h1: 'text-gray-900', h2: 'text-gray-900', h3: 'text-gray-800', body: 'text-gray-700', bodySoft: 'text-gray-600', bullet: 'text-gray-400', quote: 'text-gray-600 border-gray-300', divider: 'border-surface-200' };

  if (typeof value === 'string' || Array.isArray(value)) {
    return (
      <div className={`space-y-2 ${className}`}>
        {String(richValueToPlainText(value)).split('\n').filter(Boolean).map((line, i) => (
          <p key={i} className={`text-sm leading-relaxed ${c.body} whitespace-pre-line`}>{line}</p>
        ))}
      </div>
    );
  }

  const blocks = Object.values(value).sort((a, b) => (a?.meta?.order ?? 0) - (b?.meta?.order ?? 0));

  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, index) => {
        const text = collectRichText(block?.value || block);
        const firstValue = Array.isArray(block?.value) ? block.value[0] : null;
        const checked = !!(firstValue?.props?.checked ?? firstValue?.checked ?? block?.props?.checked);

        if (block.type === 'Divider') return <hr key={block.id || index} className={`my-4 ${c.divider}`} />;
        if (block.type === 'Image') {
          const props = firstValue?.props || block.props || {};
          const src = props.src || props.url || props.href;
          return src ? (
            <img
              key={block.id || index}
              src={src}
              alt={props.alt || ''}
              className="my-4 block max-w-full rounded-xl object-contain"
              style={{ width: props.sizes?.width || 'auto', height: 'auto' }}
            />
          ) : null;
        }
        if (block.type === 'Table') {
          const rows = firstValue?.children || [];
          return (
            <div key={block.id || index} className="my-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={row.id || rowIndex}>
                      {(row.children || []).map((cell, cellIndex) => {
                        const Cell = cell.props?.asHeader ? 'th' : 'td';
                        return (
                          <Cell key={cell.id || cellIndex} className={`border ${dark ? 'border-gray-600' : 'border-surface-200'} px-3 py-2 text-left ${Cell === 'th' ? (dark ? 'bg-white/10 font-semibold text-gray-100' : 'bg-surface-50 font-semibold text-gray-700') : c.bodySoft}`}>
                            {collectRichText(cell.children)}
                          </Cell>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (!text.trim()) return null;
        if (block.type === 'HeadingOne') return <h1 key={block.id || index} className={`text-2xl font-extrabold leading-snug ${c.h1}`}>{text}</h1>;
        if (block.type === 'HeadingTwo') return <h2 key={block.id || index} className={`text-xl font-bold leading-snug ${c.h2}`}>{text}</h2>;
        if (block.type === 'HeadingThree') return <h3 key={block.id || index} className={`text-base font-bold leading-snug ${c.h3}`}>{text}</h3>;
        if (block.type === 'BulletedList') return <div key={block.id || index} className={`flex gap-2 text-sm leading-relaxed ${c.body}`}><span className={c.bullet}>•</span><span>{text}</span></div>;
        if (block.type === 'NumberedList') return <div key={block.id || index} className={`flex gap-2 text-sm leading-relaxed ${c.body}`}><span className={`min-w-[1.5rem] text-right font-semibold ${c.bullet}`}>{index + 1}.</span><span>{text}</span></div>;
        if (block.type === 'TodoList') {
          return (
            <div key={block.id || index} className={`flex items-start gap-2 text-sm leading-relaxed ${c.body}`}>
              <span className={`mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : (dark ? 'border-gray-500 bg-transparent' : 'border-gray-300 bg-white')}`}>
                {checked ? '✓' : ''}
              </span>
              <span className={checked ? `${c.bullet} line-through` : ''}>{text}</span>
            </div>
          );
        }
        if (block.type === 'Blockquote') return <blockquote key={block.id || index} className={`border-l-4 pl-4 text-sm italic leading-relaxed ${c.quote}`}>{text}</blockquote>;
        if (block.type === 'Callout') return <div key={block.id || index} className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">{text}</div>;
        if (block.type === 'Code') return <pre key={block.id || index} className="overflow-x-auto scrollbar-on-dark rounded-lg bg-gray-950 px-4 py-3 text-[13px] leading-relaxed text-gray-100"><code>{text}</code></pre>;
        return <p key={block.id || index} className={`text-sm leading-relaxed ${c.body} whitespace-pre-line`}>{text}</p>;
      })}
    </div>
  );
}
