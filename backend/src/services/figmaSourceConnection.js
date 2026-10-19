export function figmaFileReference(input) {
  let url; try { url = new URL(input); } catch { throw new Error('Figma 공유 링크를 입력하세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !['www.figma.com', 'figma.com'].includes(url.hostname)) throw new Error('Figma의 공유 링크가 필요합니다.');
  const match = url.pathname.match(/^\/(design|file|proto|slides|board)\/([a-zA-Z0-9]+)(?:\/|$)/);
  if (!match) throw new Error('Figma 파일 또는 Slides 공유 링크를 입력하세요.');
  return { key: match[2], type: match[1], nodeId: (url.searchParams.get('node-id') || '').replace('-', ':') };
}
async function readResponse(response) {
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Figma 파일 내용을 읽을 권한이 필요합니다. 파일 읽기 토큰을 확인하거나 PDF로 가져오세요.' : 'Figma 파일 내용을 가져오지 못했습니다. 잠시 후 다시 시도하세요.');
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 12_000_000) throw new Error('파일이 큽니다. 해당 경험을 별도 Figma 파일이나 PDF로 가져오세요.'); chunks.push(value); } } finally { await reader.cancel().catch(() => {}); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function figmaDocumentFromTree(file, { url, key }) {
  const sections = [], pages = [], imageFrames = []; let count = 0, textSize = 0, truncated = false;
  const walk = (node, path = [], frame, slide) => {
    if (!node || node.visible === false) return;
    if (++count > 14000) { truncated = true; return; }
    const isFrame = ['SLIDE', 'FRAME', 'SECTION'].includes(node.type), current = isFrame ? node : frame;
    const currentSlide = node.type === 'SLIDE' ? node : slide;
    if (node.type === 'SLIDE') pages.push({ id: node.id, name: node.name });
    if (node.type === 'TEXT' && typeof node.characters === 'string' && node.characters.trim()) {
      const original = node.characters.trim(), remaining = 60000 - textSize;
      const text = original.slice(0, Math.min(4000, remaining));
      if (text && sections.length < 400) {
        sections.push({ id: node.id, type: Number(node.style?.fontSize || 0) >= 44 ? 'heading' : 'text', text, location: path.join(' / '), frameId: currentSlide?.id || current?.id || '' });
        textSize += text.length;
      }
      if (text.length < original.length || sections.length >= 400) truncated = true;
    }
    if (current && (node.fills || []).some(fill => fill.type === 'IMAGE' && fill.visible !== false)) imageFrames.push(currentSlide?.id || current.id);
    for (const child of node.children || []) walk(child, [...path, node.name || node.type].slice(-5), current, currentSlide);
  }; walk(file.document);
  const unique = [...new Set(imageFrames)];
  const scored = unique.map(id => ({ id, score: sections.filter(section => section.frameId === id).reduce((value, section) => value + (/검증|성과|결과|문제|리서치|validation|result/i.test(section.text) ? 3 : 0) - (/시장 규모|경쟁 시장|market size|competitor/i.test(section.text) ? 6 : 0), 0) })).sort((a, b) => b.score - a.score).slice(0, 4);
  return { version: 2, type: 'figma', title: file.name || 'Figma 자료', url, fileKey: key, sections, tables: [], imageNodeIds: scored.map(row => row.id), slideCount: pages.length, truncated, updatedAt: new Date().toISOString() };
}
export async function fetchFigmaSource(url, { token, fetchImpl = fetch } = {}) {
  const reference = figmaFileReference(url);
  if (!token) throw Object.assign(new Error('링크만으로는 Figma 내부 텍스트를 읽을 수 없습니다. 파일 읽기 토큰을 연결하거나 Slides를 PDF로 내려받아 가져오세요.'), { code: 'FIGMA_READ_ACCESS_REQUIRED' });
  const headers = { 'X-Figma-Token': token, Accept: 'application/json' }, signal = AbortSignal.timeout(30000);
  const file = await readResponse(await fetchImpl(`https://api.figma.com/v1/files/${reference.key}`, { headers, signal, redirect: 'error' }));
  const document = figmaDocumentFromTree(file, { url, key: reference.key });
  if (!document.sections.length && !document.imageNodeIds.length) throw new Error('파일에서 읽을 수 있는 텍스트나 화면을 찾지 못했습니다. PDF로 가져오세요.');
  if (document.imageNodeIds.length) {
    try { const images = await readResponse(await fetchImpl(`https://api.figma.com/v1/images/${reference.key}?ids=${encodeURIComponent(document.imageNodeIds.join(','))}&format=png&scale=1`, { headers, signal, redirect: 'error' })); document.renders = document.imageNodeIds.flatMap(id => images.images?.[id] ? [{ id, url: images.images[id] }] : []); }
    catch { document.truncated = true; document.renders = []; }
  }
  return document;
}
