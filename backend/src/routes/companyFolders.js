import { Router } from 'express';
import { createHash, randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth.js';
import { adminDb } from '../config/firebase.js';
import { companyDocumentsOf, moveCompanyDocuments } from '../services/companyFolderDocuments.js';

// 기업 폴더 — 한 기업에 제출할 이력서·자소서 파일과 자소서 문항별 답변을 모아 둔다.
// 포트폴리오는 targetCompany로 묶어 프론트에서 합쳐 보여주므로 여기엔 저장하지 않는다.
const router = Router();
const COLLECTION = 'companyFolders';
const FILE_CATEGORIES = ['resume', 'coverLetter', 'etc'];
const MAX_FILES = 50;
const MAX_ESSAYS = 30;
const MAX_ESSAY_CHARS = 10000;

const folderId = (uid, company) =>
  `${uid}_${createHash('sha1').update(company).digest('hex').slice(0, 24)}`;

const str = (v, max) => String(v ?? '').slice(0, max);

function cleanFiles(files) {
  if (!Array.isArray(files)) return [];
  return files.slice(0, MAX_FILES)
    .filter(f => f && typeof f.url === 'string' && /^https?:\/\//.test(f.url))
    .map(f => ({
      id: str(f.id, 64),
      category: FILE_CATEGORIES.includes(f.category) ? f.category : 'etc',
      name: str(f.name, 200),
      url: str(f.url, 2000),
      size: Number(f.size) || 0,
      uploadedAt: str(f.uploadedAt, 40),
    }));
}

function cleanEssays(essays) {
  if (!Array.isArray(essays)) return [];
  return essays.slice(0, MAX_ESSAYS).map(e => ({
    id: str(e?.id, 64),
    question: str(e?.question, 1000),
    answer: str(e?.answer, MAX_ESSAY_CHARS),
    limit: Math.max(0, Math.min(Number(e?.limit) || 0, MAX_ESSAY_CHARS)),
  }));
}

// GET /api/company-folders — 내 기업 폴더 전체
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const snap = await adminDb.collection(COLLECTION).where('userId', '==', req.user.uid).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    next(error);
  }
});

// PUT /api/company-folders — 기업명 기준으로 폴더를 만들거나 파일·자소서를 통째로 저장
router.put('/', authMiddleware, async (req, res, next) => {
  try {
    const company = str(req.body?.company, 100).trim();
    if (!company) return res.status(400).json({ error: '기업명이 필요합니다' });
    const ref = adminDb.collection(COLLECTION).doc(folderId(req.user.uid, company));
    const snap = await ref.get();
    const prev = snap.exists ? snap.data() : {};
    const folder = {
      userId: req.user.uid,
      boardId: prev.boardId || (snap.exists ? ref.id : randomUUID()),
      company,
      files: req.body.files !== undefined ? cleanFiles(req.body.files) : (prev.files || []),
      essays: req.body.essays !== undefined ? cleanEssays(req.body.essays) : (prev.essays || []),
      createdAt: prev.createdAt || new Date(),
      updatedAt: new Date(),
    };
    await ref.set(folder);
    res.json({ id: ref.id, ...folder });
  } catch (error) {
    next(error);
  }
});

// 기업명 변경: 저장된 포트폴리오·자기소개서와 폴더 자료를 함께 옮긴다.
// 바꿀 이름의 폴더가 이미 있으면 파일·자소서를 합친다.
router.post('/rename', authMiddleware, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const from = str(req.body?.from, 100).trim();
    const to = str(req.body?.to, 100).trim();
    if (!from || !to) return res.status(400).json({ error: '기업명이 필요합니다' });

    const col = adminDb.collection(COLLECTION);
    const fromRef = col.doc(folderId(uid, from));
    const toRef = col.doc(folderId(uid, to));
    if (from === to) return res.json({ fromId: fromRef.id, folder: null, movedPortfolios: 0, movedCoverLetters: 0 });

    const [docs, fromSnap, toSnap] = await Promise.all([companyDocumentsOf(adminDb, uid, from), fromRef.get(), toRef.get()]);
    const batch = adminDb.batch();
    const moved = moveCompanyDocuments(batch, docs, to);

    let folder = toSnap.exists ? toSnap.data() : null;
    if (fromSnap.exists) {
      const a = fromSnap.data();
      const b = folder || {};
      folder = {
        userId: uid,
        boardId: b.boardId || (toSnap.exists ? toRef.id : (a.boardId || fromRef.id)),
        company: to,
        files: [...(b.files || []), ...(a.files || [])].slice(0, MAX_FILES),
        essays: [...(b.essays || []), ...(a.essays || [])].slice(0, MAX_ESSAYS),
        createdAt: b.createdAt || a.createdAt || new Date(),
        updatedAt: new Date(),
      };
      batch.set(toRef, folder);
      batch.delete(fromRef);
    }
    await batch.commit();
    res.json({ fromId: fromRef.id, folder: folder ? { id: toRef.id, ...folder } : null, ...moved });
  } catch (error) {
    next(error);
  }
});

// POST /api/company-folders/delete — 기업 폴더 삭제: 이력서·자소서 기록을 지우고
// 저장된 포트폴리오·자기소개서는 지우지 않고 '기업 미지정'으로 옮긴다.
router.post('/delete', authMiddleware, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const company = str(req.body?.company, 100).trim();
    if (!company) return res.status(400).json({ error: '기업명이 필요합니다' });
    const ref = adminDb.collection(COLLECTION).doc(folderId(uid, company));
    const docs = await companyDocumentsOf(adminDb, uid, company);
    const batch = adminDb.batch();
    const moved = moveCompanyDocuments(batch, docs, '');
    batch.delete(ref);
    await batch.commit();
    res.json({ fromId: ref.id, ...moved });
  } catch (error) {
    next(error);
  }
});

export default router;
