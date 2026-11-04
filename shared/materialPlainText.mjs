// Convert document formatting to editable text. Never insert document HTML into the DOM.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', bull: '•', hellip: '…' };
const TAG = '(?:html|head|body|title|meta|link|div|span|p|h[1-6]|ul|ol|li|strong|em|b|i|u|s|del|a|code|pre|blockquote|br|hr|table|thead|tbody|tfoot|tr|td|th|img|figure|figcaption|section|article|header|footer|main|small|sup|sub)';
const htmlTag = new RegExp(`<\\/?${TAG}\\b[^>]*>`, 'gi');

export function materialPlainText(input) {
  let text = String(input ?? '').replace(/\r\n?/g, '\n');
  // Decode a second time for Markdown exports containing escaped HTML.
  for (let pass = 0; pass < 2; pass += 1) {
    text = text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (!entity.startsWith('#')) return ENTITIES[entity.toLowerCase()] ?? match;
      const value = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : match;
    });
  }
  text = text.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(?:br|hr)\b[^>]*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|ul|ol|tr|blockquote|pre|section|article|figure)\s*>/gi, '\n')
    .replace(/<\/(?:td|th)\s*>/gi, '\t')
    .replace(htmlTag, '')
    .replace(/^\s*```[^\n]*\n?/gm, '')
    .replace(/^\s*~~~[^\n]*\n?/gm, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/!\[([^\]]*)\]\([^\n)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g, '$1 ($2)')
    .replace(/(\*\*|__|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:])/g, '$1$2')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '');
  return text.split('\n').map(line => line.replace(/[ \t\u00a0]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
