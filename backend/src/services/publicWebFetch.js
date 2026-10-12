import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';

function invalidUrl(message = '공개 HTTPS 공고 링크를 입력해주세요.') {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function isPublicAddress(address) {
  const host = String(address).toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(host) === 4) {
    const [a, b] = host.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || b === 0))
      || (a === 198 && (b === 18 || b === 19)));
  }
  // Only global unicast IPv6. This also excludes IPv4-mapped and local addresses.
  return isIP(host) === 6 && /^[23][0-9a-f]{3}:/.test(host) && !/^2001:db8:/i.test(host);
}

export function validatePublicUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 2000) throw invalidUrl();
  let url;
  try { url = new URL(rawUrl); } catch { throw invalidUrl(); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw invalidUrl();
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host.includes('.') && !isIP(host)) throw invalidUrl();
  if (host === 'localhost' || /\.(?:localhost|local|internal|lan|home|test|invalid)$/.test(host)) throw invalidUrl();
  if (isIP(host) && !isPublicAddress(host)) throw invalidUrl('내부 네트워크 링크는 사용할 수 없습니다.');
  return url.href;
}

async function publicAddresses(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) {
    throw invalidUrl('내부 네트워크 링크는 사용할 수 없습니다.');
  }
  return addresses;
}

const COOKIE_LIMITS = { count: 24, bytes: 8192, singleBytes: 2048 };

function defaultCookiePath(pathname) {
  const end = pathname.lastIndexOf('/');
  return end > 0 ? pathname.slice(0, end) : '/';
}

function cookiePathMatches(pathname, cookiePath) {
  return pathname === cookiePath || (pathname.startsWith(cookiePath)
    && (cookiePath.endsWith('/') || pathname[cookiePath.length] === '/'));
}

function cookieDomainMatchesIssuer(declaredDomain, hostname) {
  const domain = declaredDomain.replace(/^\./, '').toLowerCase();
  const issuer = hostname.toLowerCase();
  if (isIP(domain) || isIP(issuer) || domain.length > 253) return false;
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some(label => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/.test(label))) return false;
  // Reject common registry-shaped suffixes without treating them as employer domains.
  // Accepted cookies still stay on the exact issuer; this is not a cross-host cookie jar.
  if (labels.length === 2 && labels[1].length === 2
    && /^(?:ac|co|com|edu|gov|go|net|ne|org|or|mil|nom|pe|re|hs|ms|es|sc|kg)$/.test(labels[0])) return false;
  return issuer === domain || issuer.endsWith(`.${domain}`);
}

/** Parent Domain attributes may establish an anonymous session, but delivery is always issuer-only. */
export function createPublicCookieStore({ now = Date.now } = {}) {
  const cookies = new Map();
  const purge = () => {
    const current = now();
    for (const [key, cookie] of cookies) if (cookie.expires <= current) cookies.delete(key);
  };
  const totalBytes = () => [...cookies.values()].reduce((size, cookie) => size + cookie.bytes, 0);
  return {
    store(rawUrl, setCookieHeaders) {
      const url = new URL(rawUrl);
      purge();
      for (const header of (Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]).slice(0, 64)) {
        if (typeof header !== 'string' || Buffer.byteLength(header) > 4096 || /[\r\n\0]/.test(header)) continue;
        const parts = header.split(';');
        const separator = parts[0].indexOf('=');
        if (separator <= 0) continue;
        const name = parts[0].slice(0, separator).trim();
        let value = parts[0].slice(separator + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (!/^[!#$%&'*+\-.^_`|~\dA-Za-z]+$/.test(name)
          || !/^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]*$/.test(value)) continue;
        const attributes = new Map(parts.slice(1).map(part => {
          const split = part.indexOf('=');
          return [part.slice(0, split < 0 ? undefined : split).trim().toLowerCase(), split < 0 ? '' : part.slice(split + 1).trim()];
        }));
        const domain = attributes.get('domain');
        if (domain !== undefined && !cookieDomainMatchesIssuer(domain, url.hostname)) continue;
        const secure = attributes.has('secure');
        if (secure && url.protocol !== 'https:') continue;
        const declaredPath = attributes.get('path');
        const path = declaredPath?.startsWith('/') ? declaredPath : defaultCookiePath(url.pathname);
        if (/[\x00-\x20\x7f;]/.test(path)) continue;
        if (name.startsWith('__Secure-') && !secure) continue;
        if (name.startsWith('__Host-') && (!secure || domain !== undefined || declaredPath !== '/')) continue;
        const maxAge = attributes.get('max-age');
        let expires = Infinity;
        if (/^-?\d+$/.test(maxAge || '')) {
          const seconds = Number(maxAge);
          expires = seconds <= 0 ? 0 : now() + Math.min(seconds, 31_536_000) * 1000;
        } else if (attributes.has('expires')) {
          const parsed = Date.parse(attributes.get('expires'));
          if (Number.isFinite(parsed)) expires = parsed;
        }
        const key = `${url.hostname}\n${path}\n${name}`;
        if (expires <= now()) { cookies.delete(key); continue; }
        const bytes = Buffer.byteLength(`${url.hostname}${path}${name}=${value}`);
        if (bytes > COOKIE_LIMITS.singleBytes) continue;
        // Replacing a cookie refreshes its eviction order, but never expands its host scope.
        cookies.delete(key);
        cookies.set(key, { hostname: url.hostname, path, name, value, secure, expires, bytes });
        while (cookies.size > COOKIE_LIMITS.count || totalBytes() > COOKIE_LIMITS.bytes) cookies.delete(cookies.keys().next().value);
      }
    },
    header(rawUrl) {
      const url = new URL(rawUrl);
      purge();
      return [...cookies.values()].filter(cookie => cookie.hostname === url.hostname
        && (!cookie.secure || url.protocol === 'https:') && cookiePathMatches(url.pathname, cookie.path))
        .sort((first, second) => second.path.length - first.path.length)
        .map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    },
  };
}

function anonymousHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers || {}).filter(([name]) => !/^(?:cookie2?|authorization|proxy-authorization)$/i.test(name)));
}

/** HTTPS only; resolve before each hop and pin that public address to the request. */
async function fetchText(rawUrl, options, redirects, cookieStore) {
  const url = new URL(validatePublicUrl(rawUrl));
  const method = options.method || 'GET';
  // The only POST supported here is the provider's public, read-only question lookup.
  // This preserves the DNS-pinned transport instead of using an unrestricted fallback fetch.
  if (method !== 'GET' && !(method === 'POST' && url.hostname === 'jasoseol.com' && url.pathname === '/employment/employment_question.json')) throw invalidUrl();
  const body = method === 'POST' && typeof options.body === 'string' ? options.body : '';
  if (Buffer.byteLength(body) > 2000) throw invalidUrl();
  const addresses = await publicAddresses(url.hostname);
  const selected = addresses[0];
  const maxBytes = options.maxBytes || 2_000_000;
  const cookieHeader = cookieStore?.header(url.href);
  const response = await new Promise((resolve, reject) => {
    const request = https.request(url, {
      method,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,application/json,text/plain,*/*', 'Accept-Language': 'ko-KR,ko;q=0.9', 'Accept-Encoding': 'identity', ...anonymousHeaders(options.headers),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}) },
      lookup: (_host, lookupOptions, callback) => {
        if (lookupOptions?.all) callback(null, [selected]);
        else callback(null, selected.address, selected.family);
      },
    }, res => {
      cookieStore?.store(url.href, res.headers['set-cookie']);
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve({ redirect: new URL(res.headers.location, url).href });
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`공고 페이지 응답 오류 (${res.statusCode})`));
        return;
      }
      const chunks = [];
      let length = 0;
      res.on('data', chunk => {
        length += chunk.length;
        if (length > maxBytes) {
          res.destroy(new Error('공고 페이지가 너무 큽니다. 내용을 직접 붙여넣어주세요.'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        try {
          let body = Buffer.concat(chunks);
          const compressionOptions = { maxOutputLength: maxBytes };
          if (res.headers['content-encoding'] === 'gzip') body = gunzipSync(body, compressionOptions);
          else if (res.headers['content-encoding'] === 'deflate') body = inflateSync(body, compressionOptions);
          else if (res.headers['content-encoding'] === 'br') body = brotliDecompressSync(body, compressionOptions);
          if (body.length > maxBytes) throw new Error('공고 페이지가 너무 큽니다.');
          resolve({ text: body.toString('utf8') });
        } catch (error) { reject(error); }
      });
    });
    const timer = setTimeout(() => request.destroy(new Error('공고 페이지를 읽는 시간이 초과되었습니다.')), options.timeoutMs || 15000);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
    request.end(body || undefined);
  });
  if (response.redirect) {
    if (redirects >= 4) throw new Error('공고 페이지 이동이 너무 많습니다.');
    return fetchText(response.redirect, options, redirects + 1, cookieStore);
  }
  return response.text;
}

export async function fetchPublicText(rawUrl, options = {}, redirects = 0) {
  return fetchText(rawUrl, options, redirects, null);
}

/** One scrape owns one fresh anonymous jar; no global session or caller credentials are retained. */
export function createPublicFetchSession() {
  const cookieStore = createPublicCookieStore();
  return (rawUrl, options = {}, redirects = 0) => fetchText(rawUrl, options, redirects, cookieStore);
}
