import { randomUUID } from 'crypto';
import { adminDb } from '../config/firebase.js';

// 업로드 파일 저장소 — Firebase Storage(유료 Blaze 요금제 필요) 대신 무료로 쓰는 Firestore에
// 파일을 900KB 조각으로 나눠 저장한다. (Firestore 문서 1개 한도 1MiB)
//   uploadedFiles/{id}            : 이름·형식·크기·조각 수·소유자
//   uploadedFiles/{id}/chunks/{i} : 조각 데이터(Bytes)
// 파일은 공개 주소 /api/files/{id} 로 내려준다(routes/files.js). id는 추측할 수 없는 UUID.

const COLLECTION = 'uploadedFiles';
const CHUNK_SIZE = 900 * 1024;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // Firestore 무료 한도(전체 1GiB)를 고려해 파일당 10MB

const filesCol = () => adminDb.collection(COLLECTION);

// 저장된 파일의 공개 주소 기준 — 운영에선 PUBLIC_API_BASE_URL(예: https://popol-vcdm.onrender.com),
// 없으면 요청이 들어온 서버 주소. 서버(PPT·PDF 내보내기)에서도 읽을 수 있게 전체 주소로 만든다.
export function publicBaseUrl(req) {
  const configured = process.env.PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

export function fileUrl(baseUrl, id) {
  return `${baseUrl}/api/files/${id}`;
}

// 주소(또는 id)에서 파일 id를 꺼낸다. 이 저장소 주소가 아니면 null.
export function fileIdFromUrl(value = '') {
  const m = String(value).match(/\/api\/files\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

export async function saveFile({ buffer, contentType, name, ownerId }) {
  if (!buffer?.length) throw new Error('빈 파일입니다');
  if (buffer.length > MAX_FILE_BYTES) {
    const err = new Error(`파일 크기가 ${MAX_FILE_BYTES / 1024 / 1024}MB를 넘습니다`);
    err.status = 413;
    throw err;
  }
  const id = randomUUID();
  const ref = filesCol().doc(id);
  const chunkCount = Math.ceil(buffer.length / CHUNK_SIZE);
  // 조각을 먼저 쓰고 마지막에 메타를 쓴다 → 메타가 보이면 조각은 모두 준비된 상태
  await Promise.all(Array.from({ length: chunkCount }, (_, i) =>
    ref.collection('chunks').doc(String(i)).set({ i, data: buffer.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) }),
  ));
  await ref.set({
    ownerId: ownerId || null,
    name: String(name || 'file').slice(0, 200),
    contentType: contentType || 'application/octet-stream',
    size: buffer.length,
    chunkCount,
    createdAt: new Date(),
  });
  return { id };
}

// 같은 파일을 반복해서 부르면 Firestore 읽기 한도(무료 하루 5만 회)를 빨리 쓰므로 최근 파일은 메모리에 둔다.
const CACHE_LIMIT_BYTES = 64 * 1024 * 1024;
const cache = new Map(); // id → { meta, buffer }
let cacheBytes = 0;

function remember(id, entry) {
  if (entry.buffer.length > CACHE_LIMIT_BYTES / 4) return;
  cache.set(id, entry);
  cacheBytes += entry.buffer.length;
  for (const [key, value] of cache) {
    if (cacheBytes <= CACHE_LIMIT_BYTES) break;
    cache.delete(key);
    cacheBytes -= value.buffer.length;
  }
}

export async function readFile(id) {
  const hit = cache.get(id);
  if (hit) {
    cache.delete(id); cache.set(id, hit); // 최근 사용으로 갱신
    return hit;
  }
  const ref = filesCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const meta = snap.data();
  const chunkRefs = Array.from({ length: meta.chunkCount }, (_, i) => ref.collection('chunks').doc(String(i)));
  const chunkSnaps = chunkRefs.length ? await adminDb.getAll(...chunkRefs) : [];
  if (chunkSnaps.some(s => !s.exists)) return null;
  const buffer = Buffer.concat(chunkSnaps.map(s => Buffer.from(s.data().data)));
  const entry = { meta, buffer };
  remember(id, entry);
  return entry;
}

// 소유자만 지울 수 있다. 지웠으면 true.
export async function deleteFile(id, ownerId) {
  const ref = filesCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  if (snap.data().ownerId && snap.data().ownerId !== ownerId) return false;
  const chunks = await ref.collection('chunks').listDocuments();
  await Promise.all(chunks.map(c => c.delete()));
  await ref.delete();
  const hit = cache.get(id);
  if (hit) { cache.delete(id); cacheBytes -= hit.buffer.length; }
  return true;
}
