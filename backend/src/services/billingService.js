import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { adminDb } from '../config/firebase.js';

const billingStorage = new AsyncLocalStorage();
const STARTER_CREDITS = Number(process.env.STARTER_CREDITS || 2000);
const LEGACY_STARTER_CREDITS = Number(process.env.LEGACY_STARTER_CREDITS || 1500);
const CREDITS_PER_USD = Number(process.env.CREDITS_PER_USD || 10000);

export const CREDIT_PACKAGES = [
  { id: 'starter', credits: 1000, price: 3000, label: '가볍게 시작' },
  { id: 'standard', credits: 5000, price: 12000, label: '가장 많이 선택' },
  { id: 'pro', credits: 12000, price: 25000, label: '집중 준비' },
];

export const PAYMENT_METHODS = [
  { id: 'card', label: '신용카드' },
  { id: 'kakaopay', label: '카카오페이' },
  { id: 'tosspay', label: '토스' },
];

const MODEL_PRICING_USD_PER_MILLION = {
  'gemini-2.5-pro': { input: 1.25, output: 10, longInput: 2.5, longOutput: 15 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

const OPERATION_LABELS = [
  [/\/experience\/analyze-git$/, 'GitHub 경험 분석'],
  [/\/experience\/analyze$/, '경험 분석'],
  [/\/experience\/extract-moments$/, '핵심 경험 추출'],
  [/\/experience\/refine-key-experience$/, '핵심 경험 보강'],
  [/\/job\/analyze$/, '채용 공고 분석'],
  [/\/job\/match$/, '직무 적합도 분석'],
  [/\/job\/generate-coverletter$/, '자기소개서 초안 생성'],
  [/\/job\/generate-portfolio$/, '맞춤 포트폴리오 제안'],
  [/\/job\/tailor-experience$/, '경험 맞춤 첨삭'],
  [/\/job\/tailor-portfolio$/, '포트폴리오 맞춤 첨삭'],
  [/\/job\/recommend-section$/, '포트폴리오 섹션 추천'],
  [/\/job\/recommend-experiences$/, '경험 추천'],
  [/\/portfolio\/validate$/, '포트폴리오 검토'],
  [/\/portfolio\/match-sections$/, '포트폴리오 섹션 분석'],
  [/\/portfolio\/ai-ppt-analyze$/, 'AI PPT 생성'],
  [/\/portfolio\/ai-ppt-revise$/, 'AI PPT 슬라이드 수정'],
  [/\/portfolio\/generate-themed$/, '테마 포트폴리오 생성'],
  [/\/import\/structure$/, '가져온 자료 AI 정리'],
  [/\/export\/ppt/, 'PPT 내보내기 분석'],
];

function getOperationLabel(path = '') {
  return OPERATION_LABELS.find(([pattern]) => pattern.test(path))?.[1] || 'AI 기능 사용';
}

function walletRef(uid) {
  return adminDb.collection('creditWallets').doc(uid);
}

function defaultWallet(uid) {
  return {
    userId: uid,
    creditUnit: 'api-cost-v1',
    schemaVersion: 3,
    balance: STARTER_CREDITS,
    totalCharged: STARTER_CREDITS,
    totalUsed: 0,
    starterCreditsGranted: STARTER_CREDITS,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function billingContextMiddleware(req, res, next) {
  const operationPath = `${req.method} ${req.originalUrl?.split('?')[0] || req.path || ''}`;
  const store = {
    userId: null,
    operationId: crypto.randomUUID(),
    operation: operationPath,
    operationLabel: getOperationLabel(operationPath),
    pending: null, // AI 사용량 누적 — 요청 성공 시에만 확정 차감
  };

  // 요청이 성공(2xx)으로 끝나야만 과금 확정. 에러/중단 시 누적분 폐기 → 차감 안 함.
  let settled = false;
  const finalize = (success) => {
    if (settled) return;
    settled = true;
    if (success) {
      commitPendingCharges(store).catch(err => console.error('[Billing] 과금 확정 실패:', err.message));
    }
  };
  res.on('finish', () => finalize(res.statusCode < 400));
  res.on('close', () => { if (!res.writableFinished) finalize(false); });

  billingStorage.run(store, next);
}

// 누적된 AI 사용량을 한 번에 지갑에서 차감한다. (요청 성공 시점에만 호출)
async function commitPendingCharges(store) {
  const pending = store?.pending;
  if (!store?.userId || !pending || pending.requestedCredits <= 0) return;

  const ref = walletRef(store.userId);
  const transactionRef = ref.collection('transactions').doc(store.operationId);

  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const wallet = snap.exists ? snap.data() : defaultWallet(store.userId);
    const balance = Math.max(0, Number(wallet.balance || 0));
    const credits = Math.min(balance, pending.requestedCredits);
    const balanceAfter = Math.max(0, balance - credits);
    tx.set(ref, {
      ...wallet,
      creditUnit: 'api-cost-v1',
      schemaVersion: 3,
      balance: balanceAfter,
      totalUsed: Number(wallet.totalUsed || 0) + credits,
      updatedAt: new Date(),
    });
    tx.set(transactionRef, {
      type: 'usage',
      schemaVersion: 3,
      amount: -credits,
      balanceAfter,
      provider: pending.provider,
      models: Array.from(pending.models),
      operation: store.operation,
      inputTokens: pending.inputTokens,
      outputTokens: pending.outputTokens,
      thinkingTokens: pending.thinkingTokens,
      totalTokens: pending.totalTokens,
      usdCost: pending.usdCost,
      requestedCredits: pending.requestedCredits,
      exhausted: credits < pending.requestedCredits,
      description: store.operationLabel,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
}

export function setBillingUser(uid) {
  const store = billingStorage.getStore();
  if (store) store.userId = uid;
}

export async function getOrCreateWallet(uid) {
  const ref = walletRef(uid);
  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, defaultWallet(uid));
      tx.set(ref.collection('transactions').doc(), {
        type: 'starter',
        schemaVersion: 3,
        amount: STARTER_CREDITS,
        balanceAfter: STARTER_CREDITS,
        description: '가입 축하 크레딧',
        createdAt: new Date(),
      });
    } else {
      const wallet = snap.data();
      const updates = {
        updatedAt: new Date(),
      };
      let balance = Math.max(0, Number(wallet.balance || 0));
      let totalCharged = Math.max(0, Number(wallet.totalCharged || 0));
      let totalUsed = Math.max(0, Number(wallet.totalUsed || 0));

      if (wallet.creditUnit !== 'api-cost-v1') {
        const wasTokenUnit = wallet.creditUnit === 'token';
        const scale = wasTokenUnit ? 0.01 : 1;
        balance = Math.max(0, Math.ceil(balance * scale));
        totalCharged = Math.max(0, Math.ceil(totalCharged * scale));
        totalUsed = Math.max(0, Math.ceil(totalUsed * scale));
        Object.assign(updates, {
          creditUnit: 'api-cost-v1',
          schemaVersion: 3,
          balance,
          totalCharged,
          totalUsed,
        });
        tx.set(ref.collection('transactions').doc(), {
          type: 'migration',
          amount: 0,
          description: '크레딧 정책 변경',
          createdAt: new Date(),
        });
      }

      const granted = Number(wallet.starterCreditsGranted || 0);
      const inferredGranted = granted > 0 ? granted : LEGACY_STARTER_CREDITS;
      const starterBonus = Math.max(0, STARTER_CREDITS - inferredGranted);
      if (starterBonus > 0) {
        balance += starterBonus;
        totalCharged += starterBonus;
        Object.assign(updates, {
          creditUnit: 'api-cost-v1',
          schemaVersion: 3,
          balance,
          totalCharged,
          totalUsed,
          starterCreditsGranted: STARTER_CREDITS,
        });
        tx.set(ref.collection('transactions').doc(), {
          type: 'starter_adjustment',
          schemaVersion: 3,
          amount: starterBonus,
          balanceAfter: balance,
          description: '가입 축하 크레딧 추가 지급',
          createdAt: new Date(),
        });
      } else if (!wallet.starterCreditsGranted || wallet.starterCreditsGranted !== STARTER_CREDITS) {
        updates.starterCreditsGranted = Math.max(granted, STARTER_CREDITS);
      }

      if (Object.keys(updates).length > 1) {
        tx.update(ref, updates);
      }
    }
  });
  const snap = await ref.get();
  return { id: snap.id, ...snap.data() };
}

export async function assertHasCredits() {
  const { userId } = billingStorage.getStore() || {};
  if (!userId) return;
  const wallet = await getOrCreateWallet(userId);
  if (Number(wallet.balance || 0) <= 0) {
    const error = new Error('크레딧이 부족합니다. 설정의 크레딧 관리 메뉴에서 충전해주세요.');
    error.status = 402;
    error.code = 'INSUFFICIENT_CREDITS';
    throw error;
  }
}

function normalizeUsage(usage = {}) {
  const inputTokens = Number(
    usage.promptTokenCount ?? usage.prompt_tokens ?? usage.input_tokens ?? 0
  ) || 0;
  const outputTokens = Number(
    usage.candidatesTokenCount ?? usage.completion_tokens ?? usage.output_tokens ?? 0
  ) || 0;
  const thinkingTokens = Number(usage.thoughtsTokenCount || 0);
  const totalTokens = Number(
    usage.totalTokenCount ?? usage.total_tokens ?? inputTokens + outputTokens + thinkingTokens
  ) || 0;
  return { inputTokens, outputTokens, thinkingTokens, totalTokens };
}

export async function recordAiUsage({ provider, model, usage }) {
  const store = billingStorage.getStore();
  if (!store?.userId) return null;

  const tokens = normalizeUsage(usage);
  const pricing = MODEL_PRICING_USD_PER_MILLION[model] || MODEL_PRICING_USD_PER_MILLION['gemini-2.5-flash'];
  const useLongContextPricing = model === 'gemini-2.5-pro' && tokens.inputTokens > 200000;
  const inputRate = useLongContextPricing ? pricing.longInput : pricing.input;
  const outputRate = useLongContextPricing ? pricing.longOutput : pricing.output;
  const billableOutputTokens = tokens.outputTokens + tokens.thinkingTokens;
  const usdCost = (tokens.inputTokens * inputRate + billableOutputTokens * outputRate) / 1000000;
  const requestedCredits = Math.ceil(usdCost * CREDITS_PER_USD);
  if (requestedCredits <= 0) {
    console.warn(`[Billing] ${provider}/${model} did not return token usage metadata. Skipping charge.`);
    return null;
  }

  // 즉시 차감하지 않고 요청 컨텍스트에 누적한다.
  // 요청이 성공적으로 끝나면 commitPendingCharges 에서 한 번에 확정 차감하고,
  // 실패/중단되면 누적분은 폐기되어 차감되지 않는다.
  const pending = store.pending || (store.pending = {
    requestedCredits: 0,
    inputTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    totalTokens: 0,
    usdCost: 0,
    provider,
    models: new Set(),
  });
  pending.requestedCredits += requestedCredits;
  pending.inputTokens += tokens.inputTokens;
  pending.outputTokens += tokens.outputTokens;
  pending.thinkingTokens += tokens.thinkingTokens;
  pending.totalTokens += tokens.totalTokens;
  pending.usdCost += usdCost;
  pending.provider = provider;
  pending.models.add(model);

  return { requestedCredits, ...tokens };
}

export async function listTransactions(uid, limit = 30) {
  const snap = await walletRef(uid).collection('transactions')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(item => item.schemaVersion === 3)
    .slice(0, Math.min(Number(limit) || 30, 100));
}

export async function createCreditRequest(uid, email, packageId) {
  const creditPackage = CREDIT_PACKAGES.find(item => item.id === packageId);
  if (!creditPackage) {
    const error = new Error('올바른 충전 상품을 선택해주세요.');
    error.status = 400;
    throw error;
  }
  const ref = await adminDb.collection('creditRequests').add({
    userId: uid,
    email: email || '',
    packageId: creditPackage.id,
    credits: creditPackage.credits,
    price: creditPackage.price,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { id: ref.id, credits: creditPackage.credits, price: creditPackage.price };
}

export async function createCheckout(uid, packageId, paymentMethod) {
  const creditPackage = CREDIT_PACKAGES.find(item => item.id === packageId);
  const method = PAYMENT_METHODS.find(item => item.id === paymentMethod);
  if (!creditPackage || !method) {
    const error = new Error('올바른 충전 상품과 결제 수단을 선택해주세요.');
    error.status = 400;
    throw error;
  }

  const orderId = crypto.randomUUID();
  await adminDb.collection('creditOrders').doc(orderId).set({
    orderId,
    userId: uid,
    packageId,
    paymentMethod,
    credits: creditPackage.credits,
    price: creditPackage.price,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const baseUrl = process.env.PAYMENT_CHECKOUT_URL?.trim();
  const channelKeys = {
    card: process.env.PORTONE_CARD_CHANNEL_KEY,
    kakaopay: process.env.PORTONE_KAKAOPAY_CHANNEL_KEY,
    tosspay: process.env.PORTONE_TOSSPAY_CHANNEL_KEY,
  };
  const storeId = process.env.PORTONE_STORE_ID;
  const channelKey = channelKeys[paymentMethod];
  return {
    orderId,
    status: 'pending',
    checkoutUrl: baseUrl
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}orderId=${encodeURIComponent(orderId)}&method=${encodeURIComponent(paymentMethod)}`
      : null,
    paymentConfig: !baseUrl && storeId && channelKey ? {
      storeId,
      channelKey,
      paymentId: orderId,
      orderName: `FitPoly ${creditPackage.credits} 크레딧`,
      totalAmount: creditPackage.price,
      currency: 'CURRENCY_KRW',
      payMethod: paymentMethod === 'card' ? 'CARD' : 'EASY_PAY',
      redirectUrl: process.env.PAYMENT_REDIRECT_URL || undefined,
    } : null,
  };
}

export async function completeCheckout(orderId, providerPaymentId = '', expectedUserId = null) {
  const orderRef = adminDb.collection('creditOrders').doc(orderId);
  let result;

  await adminDb.runTransaction(async tx => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) {
      const error = new Error('결제 주문을 찾을 수 없습니다.');
      error.status = 404;
      throw error;
    }
    const order = orderSnap.data();
    if (expectedUserId && order.userId !== expectedUserId) {
      const error = new Error('본인의 결제 주문만 완료할 수 있습니다.');
      error.status = 403;
      throw error;
    }
    const ref = walletRef(order.userId);
    const walletSnap = await tx.get(ref);
    const wallet = walletSnap.exists ? walletSnap.data() : defaultWallet(order.userId);
    if (order.status === 'paid') {
      result = { alreadyCompleted: true, balance: wallet.balance };
      return;
    }

    const balance = Number(wallet.balance || 0) + Number(order.credits || 0);
    tx.set(ref, {
      ...wallet,
      balance,
      totalCharged: Number(wallet.totalCharged || 0) + Number(order.credits || 0),
      updatedAt: new Date(),
    });
    tx.set(ref.collection('transactions').doc(orderId), {
      type: 'charge',
      schemaVersion: 3,
      amount: Number(order.credits || 0),
      balanceAfter: balance,
      orderId,
      paymentMethod: order.paymentMethod,
      description: `${order.credits} 크레딧 충전`,
      createdAt: new Date(),
    });
    tx.update(orderRef, {
      status: 'paid',
      providerPaymentId,
      paidAt: new Date(),
      updatedAt: new Date(),
    });
    result = { alreadyCompleted: false, balance };
  });

  return result;
}

export async function verifyAndCompleteCheckout(uid, orderId, paymentId = orderId) {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) {
    const error = new Error('PORTONE_API_SECRET이 설정되지 않았습니다.');
    error.status = 503;
    throw error;
  }

  const orderSnap = await adminDb.collection('creditOrders').doc(orderId).get();
  if (!orderSnap.exists || orderSnap.data().userId !== uid) {
    const error = new Error('결제 주문을 찾을 수 없습니다.');
    error.status = 404;
    throw error;
  }
  const order = orderSnap.data();
  const response = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${secret}` },
  });
  if (!response.ok) {
    const error = new Error('결제 승인 정보를 확인하지 못했습니다.');
    error.status = 400;
    throw error;
  }
  const payment = await response.json();
  if (payment.status !== 'PAID' || Number(payment.amount?.total) !== Number(order.price)) {
    const error = new Error('결제 상태 또는 승인 금액이 주문과 일치하지 않습니다.');
    error.status = 400;
    throw error;
  }
  return completeCheckout(orderId, paymentId, uid);
}
