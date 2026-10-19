const rich = rows => (rows || []).map(row => row.plain_text ?? row.text?.content ?? '').join('');
const propertyText = property => (property || []).map(row => Array.isArray(row) ? row[0] || '' : '').join('');
export function notionPageId(input) {
  let url; try { url = new URL(input); } catch { throw new Error('Notion 페이지 링크를 입력하세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !(url.hostname === 'www.notion.so' || url.hostname === 'notion.so' || /^[a-z0-9-]+\.notion\.site$/i.test(url.hostname))) throw new Error('Notion의 페이지 공유 링크가 필요합니다.');
  const candidate = url.searchParams.get('p') || url.pathname;
  const id = candidate.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32})(?:\/|$)/i)?.[1]?.replaceAll('-', '');
  if (!id) throw new Error('페이지 ID가 있는 Notion 공유 링크를 입력하세요.');
  return id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}
async function notionJson(url, options, fetchImpl) {
  const response = await fetchImpl(url, { ...options, redirect: 'error' });
  if (!response.ok) throw new Error('Notion 페이지를 읽지 못했습니다. 페이지 공유 또는 연결 권한을 확인하세요.');
  if (Number(response.headers.get('content-length') || 0) > 3_000_000) throw new Error('페이지가 큽니다. 핵심 기획 내용을 별도 페이지로 연결하세요.');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 3_000_000) throw new Error('페이지가 큽니다. 핵심 기획 내용을 별도 페이지로 연결하세요.'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function fetchNotionPlanning(input, { token = '', fetchImpl = fetch } = {}) {
  const pageId = notionPageId(input), signal = AbortSignal.timeout(20000), sections = [], tables = []; let title = 'Notion 기획 자료', truncated = false;
  if (token) {
    const headers = { Authorization: `Bearer ${token}`, 'Notion-Version': '2026-03-11', 'Content-Type': 'application/json' };
    const page = await notionJson(`https://api.notion.com/v1/pages/${pageId}`, { headers, signal }, fetchImpl);
    title = rich(Object.values(page.properties || {}).find(property => property.type === 'title')?.title) || title;
    let requests = 0;
    const read = async (id, depth = 0, table) => {
      if (depth > 4 || requests >= 16) { truncated = true; return; }
      let cursor;
      do { requests++; const query = cursor ? `?page_size=100&start_cursor=${encodeURIComponent(cursor)}` : '?page_size=100';
        const result = await notionJson(`https://api.notion.com/v1/blocks/${id}/children${query}`, { headers, signal }, fetchImpl);
        for (const block of result.results || []) {
          if (sections.length >= 120) { truncated = true; return; }
          const type = block.type, content = block[type];
          if (type === 'table_row' && table) { table.push((content.cells || []).map(rich)); continue; }
          const text = rich(content?.rich_text);
          if (text) sections.push({ id: block.id, type: /^heading_/.test(type) ? 'heading' : 'text', text: text.slice(0, 2000) });
          if (block.has_children && type !== 'child_page' && type !== 'child_database') { if (type === 'table') { const cells = []; await read(block.id, depth + 1, cells); if (cells.length > 1) tables.push(cells); } else await read(block.id, depth + 1); }
        }
        cursor = result.has_more ? result.next_cursor : null;
        if (requests >= 16 && cursor) { truncated = true; break; }
      } while (cursor);
    };
    await read(pageId);
  } else {
    // Reuse the public-page protocol already used by this app's Notion importer.
    // No cookies, workspace credentials, or private-page bypass are used.
    let recordMap;
    for (const [endpoint, body] of [['getPublicPageData', { blockId: pageId, type: 'block-space', name: 'page', requestedOnPublicDomain: false }], ['loadPageChunk', { pageId, limit: 100, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }]]) {
      try { const result = await notionJson(`https://www.notion.so/api/v3/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: JSON.stringify(body), signal }, fetchImpl); if (result.recordMap?.block?.[pageId]) { recordMap = result.recordMap; break; } } catch (error) { if (signal.aborted) throw error; }
    }
    if (!recordMap) throw new Error('공개 페이지의 본문을 읽지 못했습니다. Notion 연결 토큰으로 권한을 연결하거나 파일로 가져오세요.');
    const blocks = recordMap.block, visited = new Set();
    const read = (id, table, columns) => { if (visited.has(id) || visited.size >= 240) { truncated = true; return; } visited.add(id); const block = blocks[id]?.value?.value || blocks[id]?.value; if (!block) { truncated = true; return; }
      if (id === pageId) title = propertyText(block.properties?.title) || title;
      else if (block.type === 'table_row' && table) table.push((columns || Object.keys(block.properties || {})).map(column => propertyText(block.properties?.[column])));
      else { const text = propertyText(block.properties?.title); if (text) sections.push({ id, type: ['header', 'sub_header', 'sub_sub_header'].includes(block.type) ? 'heading' : 'text', text: text.slice(0, 2000) }); }
      if (block.type === 'table') { const cells = []; for (const child of block.content || []) read(child, cells, block.format?.table_block_column_order); if (cells.length > 1) tables.push(cells); } else if (block.type !== 'page' || id === pageId) for (const child of block.content || []) read(child, table, columns);
    }; read(pageId);
  }
  if (!sections.length && !tables.length) throw new Error('기획서의 본문이나 표를 찾지 못했습니다. 내용이 있는 페이지를 연결하세요.');
  return { version: 1, title, url: input, sections: sections.slice(0, 120), tables: tables.slice(0, 8), truncated, updatedAt: new Date().toISOString(), access: token ? 'api' : 'public' };
}
