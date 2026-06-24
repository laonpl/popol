import { randomUUID } from 'crypto';
import { adminStorage } from '../config/firebase.js';

// data:image/...;base64,.... 형태(문자열 일부에 포함된 경우 포함)
const DATA_URL_RE = /data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g;

const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
};

async function uploadDataUrl(mime, base64) {
  const buffer = Buffer.from(base64, 'base64');
  const ext = EXT_BY_MIME[mime] || '.img';
  const storagePath = `uploads/inline/${Date.now()}_${randomUUID()}${ext}`;
  const bucket = adminStorage.bucket();
  const fileRef = bucket.file(storagePath);
  await fileRef.save(buffer, { metadata: { contentType: mime } });
  await fileRef.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

async function replaceInString(str) {
  // 빠른 탈출: data:image 가 없으면 그대로 반환
  if (!str.includes('data:image/')) return str;

  let result = '';
  let lastIndex = 0;
  DATA_URL_RE.lastIndex = 0;
  let m;
  while ((m = DATA_URL_RE.exec(str)) !== null) {
    result += str.slice(lastIndex, m.index);
    try {
      result += await uploadDataUrl(m[1], m[2]);
    } catch (err) {
      // 업로드 실패 시 원본 data URL 유지(데이터 유실 방지)
      console.error('[inlineImageExtractor] 업로드 실패, 원본 유지:', err.message);
      result += m[0];
    }
    lastIndex = m.index + m[0].length;
  }
  result += str.slice(lastIndex);
  return result;
}

/**
 * 객체/배열/문자열을 재귀 순회하며 base64 data:image URL을 Firebase Storage에
 * 업로드하고, 그 자리에 공개 URL로 치환한 새 구조를 반환한다.
 * Yoopta 에디터 붙여넣기 등으로 본문에 박힌 이미지가 Firestore 문서 1MB
 * 한도를 넘겨 저장이 실패하는 문제를 해소한다. 원본은 변형하지 않는다.
 */
export async function externalizeInlineImages(value) {
  if (typeof value === 'string') return replaceInString(value);
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await externalizeInlineImages(item));
    return out;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await externalizeInlineImages(v);
    return out;
  }
  return value;
}
