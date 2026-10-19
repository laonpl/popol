import { parsePerformanceCsv } from '../../../shared/rolePerformance.mjs';
export function googleSheetCsvUrl(input) {
  let url; try { url = new URL(input); } catch { throw new Error('Google Sheets 링크를 입력하세요.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || url.username || url.password || url.port) throw new Error('docs.google.com의 Google Sheets 링크만 연결할 수 있습니다.');
  const published = url.pathname.match(/^\/spreadsheets\/d\/e\/([\w-]+)\/(?:pubhtml|pub)\/?$/);
  const shared = url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)(?:\/(?:edit|view|export))?\/?$/);
  if (!published && !shared) throw new Error('Google Sheets의 공유 링크 또는 웹 게시 링크를 입력하세요.');
  const hash = new URLSearchParams(url.hash.slice(1));
  const gid = url.searchParams.get('gid') || hash.get('gid') || '0';
  if (!/^\d+$/.test(gid)) throw new Error('시트 번호가 올바르지 않습니다.');
  return published ? `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv&gid=${gid}` : `https://docs.google.com/spreadsheets/d/${shared[1]}/export?format=csv&gid=${gid}`;
}
function allowedRedirect(url) {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && (url.hostname === 'docs.google.com' || /^[a-z0-9-]+\.googleusercontent\.com$/.test(url.hostname));
}
export async function fetchGoogleSheet(input, { fetchImpl = fetch } = {}) {
  let target = googleSheetCsvUrl(input);
  const signal = AbortSignal.timeout(15000);
  for (let i = 0; i < 4; i++) {
    const response = await fetchImpl(target, { redirect: 'manual', signal, headers: { Accept: 'text/csv,text/plain' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('시트의 다운로드 주소를 찾지 못했습니다.');
      const next = new URL(location, target);
      if (!allowedRedirect(next)) throw new Error('공개로 읽을 수 있는 시트가 아닙니다. CSV로 내려받아 가져오세요.');
      await response.body?.cancel(); target = next.href; continue;
    }
    if (!response.ok) throw new Error('시트를 읽지 못했습니다. 공유 권한을 확인하거나 CSV 파일로 가져오세요.');
    if (Number(response.headers.get('content-length') || 0) > 2_000_000) throw new Error('2MB 이하의 시트를 연결하세요.');
    const reader = response.body?.getReader(); let size = 0; const chunks = [];
    if (!reader) throw new Error('시트 데이터가 비어 있습니다.');
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 2_000_000) throw new Error('2MB 이하의 시트를 연결하세요.'); chunks.push(value); } }
    finally { await reader.cancel().catch(() => {}); }
    const csv = Buffer.concat(chunks).toString('utf8');
    if (/^\s*(?:<!doctype|<html)/i.test(csv)) throw new Error('시트의 읽기 권한이 필요합니다. CSV 파일로 가져오세요.');
    const table = parsePerformanceCsv(csv);
    return { ...table, url: input, fetchedAt: new Date().toISOString() };
  }
  throw new Error('시트 주소가 여러 번 이동했습니다. 웹 게시 CSV 링크로 다시 연결하세요.');
}
