import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { fetchGoogleSheet } from '../services/roleDataConnection.js';
import { fetchNotionPlanning } from '../services/rolePlanningConnection.js';
import { fetchFigmaSource } from '../services/figmaSourceConnection.js';
import { readFigmaRenderText, summarizeRoleSources } from '../services/roleSourceExperience.js';
import { requireCredits } from '../services/billingService.js';
const router = Router();
router.post('/figma', authMiddleware, async (req, res) => {
  const { url, token } = req.body;
  if (typeof url !== 'string' || url.length > 2000 || typeof token !== 'string' || token.length > 1000 || /[\r\n]/.test(token)) return res.status(400).json({ error: 'Figma 링크와 파일 읽기 토큰을 확인하세요.' });
  try { res.json(await fetchFigmaSource(url, { token })); }
  catch (error) { res.status(400).json({ error: error.message, code: error.code || 'FIGMA_READ_FAILED' }); }
});
router.post('/experience-summary', authMiddleware, requireCredits, async (req, res, next) => {
  const { documents, role, experience } = req.body;
  if (!['pm', 'marketer'].includes(role) || !Array.isArray(documents) || documents.length > 8 || !documents.length || documents.some(document => !document || !Array.isArray(document.sections) || document.sections.length > 1200 || document.sections.some(section => typeof section.text !== 'string' || section.text.length > 16000))) return res.status(400).json({ error: '내용을 읽은 자료와 직군이 필요합니다.' });
  try { const sources = []; for (const document of documents) sources.push(document.type === 'figma' && document.renders?.length ? await readFigmaRenderText(document) : document); const result = await summarizeRoleSources(sources, { role, experience }); res.json({ ...result, documents: sources }); }
  catch (error) { next(error); }
});
router.post('/notion', authMiddleware, async (req, res) => {
  const { url, token } = req.body;
  if (typeof url !== 'string' || url.length > 2000 || (token !== undefined && (typeof token !== 'string' || token.length > 1000 || /[\r\n]/.test(token)))) return res.status(400).json({ error: 'Notion 페이지 링크와 연결 정보를 확인하세요.' });
  try { res.json(await fetchNotionPlanning(url, { token })); }
  catch (error) { res.status(400).json({ error: ['AbortError', 'TimeoutError'].includes(error.name) ? 'Notion 읽기 시간이 초과됐습니다. 잠시 후 다시 시도하세요.' : error.message }); }
});
router.post('/sheets', authMiddleware, async (req, res) => {
  if (typeof req.body.url !== 'string' || req.body.url.length > 2000) return res.status(400).json({ error: 'Google Sheets 링크가 필요합니다.' });
  try { res.json(await fetchGoogleSheet(req.body.url)); }
  catch (error) { res.status(400).json({ error: ['TimeoutError', 'AbortError'].includes(error.name) ? '시트를 읽는 시간이 초과됐습니다. 잠시 후 갱신하거나 CSV 파일을 사용하세요.' : error.message }); }
});
export default router;
