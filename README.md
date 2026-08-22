# AgentCashier

Gated agentic commerce for the Razorpay AI Buildathon **Track 01 — AI Growth & Agentic Commerce**.

An AI **buyer agent** can shop a merchant catalog. It cannot move money. A **cashier** (AP2-style intent / cart / payment mandates + a UPI Reserve Pay analog) bounds, gates, and audits every rupee, then creates a **Razorpay test-mode** order.

Payment data never enters the LLM. Every money action has an audit trail. One failure path (bank decline) retries on the same idempotency key.

## Why this exists

If ChatGPT or any buyer agent can purchase from an Indian merchant, four things break: hallucinated prices, prompt injection in catalog text, leaked payment credentials, and double-charge from retried webhooks. Razorpay’s published bar for this track is: *every money action explainable, bounded and gated; show the audit trail; handle one failure gracefully.*

## Stack

MERN, MVC on the API.

```
backend/     Express + MongoDB (models / views / controllers / services)
frontend/    React + Vite (views + components)
```

The buyer agent calls tools over HTTP. Set `LLM_API_KEY` for OpenAI-compatible tool calling, or leave it empty — a deterministic fallback agent still runs the demo and evals.

## Quick start

1. MongoDB on `127.0.0.1:27017` (database `agentcashier_v2`)
2. Install and seed:

```bash
npm install
npm run install:all
copy backend\.env.example backend\.env
npm run seed
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173)

Demo chips:

- **Happy path** — quote Cold Brew under a ₹500 cap
- **Over cap** — espresso machine blocked by the cashier
- **Prompt injection** — catalog/user text tries to force `EVIL-01`; cashier refuses
- **Evals** tab — 11 money-safety cases, including price-tamper, duplicate webhook, and fail-then-retry

## Razorpay test mode

`DEV_FAKE_PAYMENTS=true` (default in `.env.example`) simulates capture/decline so the desk runs without keys.

To use real test keys:

```
DEV_FAKE_PAYMENTS=false
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Webhook URL: `POST /api/v1/webhooks/razorpay` (verify `X-Razorpay-Signature`).

## Architecture

```
User → Buyer agent (LLM or fallback)
         │  search_catalog / get_quote
         ▼
Merchant agent     Cashier (only process that may call Razorpay)
 catalog JSON        intent mandate  (cap, allowlist, merchant)
                     cart mandate    (frozen SKU + price hash)
                     payment mandate (one order for this cart)
                         ▼
                   Razorpay Orders + Checkout + webhooks
                         ▼
                   FSM: quoted → checkout_created → authorized → captured
                                      ↘ failed → retry (same idempotency key)
```

Illegal transitions (for example captured → failed) are rejected in code, not in the prompt.

## Eval suite

```bash
# API must be running
npm run eval
```

Cases: under-cap quote, over-cap, injection SKU, wrong merchant, unknown SKU, price tamper after freeze, expired cart, capture increments spend once, duplicate webhook does not double-spend, fail then retry same key, FSM rejects captured → failed.

## Interview demo (5 minutes)

1. Happy path: chat → signed cart → order → capture → remaining cap drops; open Audit.
2. Over cap: cashier block, no Razorpay order.
3. Injection: `EVIL-01` blocked as not allowlisted.
4. Simulate decline → retry same idempotency key.
5. Run evals, show pass table.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/start` | Open session + intent mandate |
| POST | `/api/v1/chat` | Buyer agent turn |
| POST | `/api/v1/quotes` | Cashier cart (also used by the agent) |
| POST | `/api/v1/checkout` | Create Razorpay order |
| POST | `/api/v1/checkout/:id/fake` | Dev capture / decline |
| POST | `/api/v1/webhooks/razorpay` | Signed webhook |
| POST | `/api/v1/evals/run` | Money-safety suite |
