import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminDb } from '../config/firebase.js';
import { createDocumentBoardService } from '../services/documentBoardService.js';

const router = Router();
const documentBoard = createDocumentBoardService(adminDb);

// These stages organize the user's board; they never publish a document.
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    res.json({ entries: await documentBoard.getEntries(req.user.uid) });
  } catch (error) {
    next(error);
  }
});

router.patch('/', authMiddleware, async (req, res, next) => {
  try {
    res.json({ entries: await documentBoard.patchEntries(req.user.uid, req.body) });
  } catch (error) {
    next(error);
  }
});

export default router;
