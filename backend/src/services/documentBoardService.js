import { createHash } from 'node:crypto';

const STATUSES = new Set(['draft', 'done', 'public']);
const MAX_CHANGES = 100;
const MAX_ORDER = 1_000_000_000;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidKey(key) {
  return typeof key === 'string' && key.length >= 1 && key.length <= 200
    && !CONTROL_CHARACTERS.test(key);
}

function isValidEntry(entry) {
  return isRecord(entry) && isValidKey(entry.key) && STATUSES.has(entry.status)
    && typeof entry.order === 'number' && Number.isFinite(entry.order)
    && entry.order >= 0 && entry.order <= MAX_ORDER;
}

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

/** Validate the entire request before committing any board changes. */
export function validateBoardChanges(body) {
  if (!isRecord(body) || Object.keys(body).some(key => key !== 'changes')
    || !Array.isArray(body.changes) || body.changes.length > MAX_CHANGES) {
    invalid('changes는 최대 100개의 변경 항목으로 구성된 배열이어야 합니다.');
  }

  const keys = new Set();
  return body.changes.map(change => {
    if (!isValidEntry(change) || Object.keys(change).length !== 3
      || Object.keys(change).some(key => !['key', 'status', 'order'].includes(key))) {
      invalid('문서의 key, status, order 값이 올바르지 않습니다.');
    }
    if (keys.has(change.key)) {
      invalid('같은 문서는 한 번의 요청에서 한 번만 변경할 수 있습니다.');
    }
    keys.add(change.key);
    return { key: change.key, status: change.status, order: change.order };
  });
}

export function boardDocumentId(key) {
  return createHash('sha256').update(key).digest('hex');
}

/** Use a null-prototype object so document keys cannot affect Object.prototype. */
export function boardEntries(documents) {
  const entries = Object.create(null);
  for (const document of documents) {
    if (isValidEntry(document)) {
      entries[document.key] = { status: document.status, order: document.order };
    }
  }
  return entries;
}

/** Board metadata is separate from portfolio publication and document contents. */
export function createDocumentBoardService(db) {
  const documentsFor = uid => db.collection('documentBoards').doc(uid).collection('documents');

  return {
    async getEntries(uid) {
      const snapshot = await documentsFor(uid).get();
      return boardEntries(snapshot.docs.map(document => document.data()));
    },

    async patchEntries(uid, body) {
      const changes = validateBoardChanges(body);
      if (changes.length > 0) {
        const documents = documentsFor(uid);
        const batch = db.batch();
        for (const change of changes) {
          batch.set(documents.doc(boardDocumentId(change.key)), change, { merge: true });
        }
        await batch.commit();
      }
      return boardEntries(changes);
    },
  };
}
