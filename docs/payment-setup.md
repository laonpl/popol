# Credit Payment Setup

FitPoly credits are stored server-side in Firestore under `creditWallets`.
AI usage is charged from model usage metadata and recorded in each wallet's
`transactions` subcollection.

## PortOne V2

Create PortOne V2 channels for card, Kakao Pay, and Toss Pay, then configure:

```env
PORTONE_STORE_ID=store-...
PORTONE_CARD_CHANNEL_KEY=channel-key-...
PORTONE_KAKAOPAY_CHANNEL_KEY=channel-key-...
PORTONE_TOSSPAY_CHANNEL_KEY=channel-key-...
PORTONE_API_SECRET=...
PAYMENT_REDIRECT_URL=https://www.fitpoly.kr/app/settings/credits
```

`POST /api/billing/checkout` creates a pending order. After the browser payment
finishes, `POST /api/billing/complete` retrieves the payment from PortOne and
checks both `PAID` status and the approved amount before adding credits.

`PAYMENT_CHECKOUT_URL` is an optional override for an external checkout page.
When it is set, it takes precedence over the built-in PortOne browser checkout.

## Optional Webhook Adapter

For an external payment adapter, configure:

```env
PAYMENT_WEBHOOK_SECRET=...
```

The adapter can call `POST /api/billing/webhook` with the
`x-payment-webhook-secret` header after it has independently verified a paid
transaction.

## Credit Policy

Credits use an API-cost scale inspired by credit-based AI products:

```text
1000 credits = USD 0.10 of underlying model API cost
```

The server converts provider-reported input, output, and reasoning token usage
with model-specific official API rates. Multiple model calls made by a single
user action are grouped into one transaction. Wallet balances are clamped at
zero and never become negative.

New wallets receive `1000` starter credits by default. Override this with:

```env
STARTER_CREDITS=1000
```

Override the API-cost scale only when the product policy changes:

```env
CREDITS_PER_USD=10000
```
