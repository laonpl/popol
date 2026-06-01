import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  CREDIT_PACKAGES,
  PAYMENT_METHODS,
  completeCheckout,
  createCheckout,
  getOrCreateWallet,
  listTransactions,
  verifyAndCompleteCheckout,
} from '../services/billingService.js';

const router = Router();

router.get('/wallet', authMiddleware, async (req, res, next) => {
  try {
    const wallet = await getOrCreateWallet(req.user.uid);
    res.json({
      balance: Number(wallet.balance || 0),
      totalCharged: Number(wallet.totalCharged || 0),
      totalUsed: Number(wallet.totalUsed || 0),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/options', authMiddleware, (req, res) => {
  res.json({ packages: CREDIT_PACKAGES, paymentMethods: PAYMENT_METHODS });
});

router.get('/transactions', authMiddleware, async (req, res, next) => {
  try {
    res.json({ transactions: await listTransactions(req.user.uid, req.query.limit) });
  } catch (error) {
    next(error);
  }
});

router.post('/checkout', authMiddleware, async (req, res, next) => {
  try {
    const checkout = await createCheckout(req.user.uid, req.body.packageId, req.body.paymentMethod);
    res.status(201).json({
      ...checkout,
      message: checkout.checkoutUrl || checkout.paymentConfig
        ? '결제 페이지로 이동합니다.'
        : '결제 요청이 생성됐습니다. PortOne Store ID와 결제수단별 채널 키를 설정하면 실제 결제로 연결됩니다.',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/complete', authMiddleware, async (req, res, next) => {
  try {
    const { orderId, paymentId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId가 필요합니다.' });
    const result = await verifyAndCompleteCheckout(req.user.uid, orderId, paymentId || orderId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/webhook', async (req, res, next) => {
  try {
    const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!expectedSecret || req.headers['x-payment-webhook-secret'] !== expectedSecret) {
      return res.status(401).json({ error: '유효하지 않은 결제 웹훅입니다.' });
    }
    if (req.body.status !== 'paid' || !req.body.orderId) {
      return res.status(400).json({ error: '승인 완료된 결제 정보가 필요합니다.' });
    }
    const result = await completeCheckout(req.body.orderId, req.body.providerPaymentId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
