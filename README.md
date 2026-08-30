AgentCashier

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

The buyer agent calls tools over HTTP. Set `GROQ_API_KEY` (or `LLM_API_KEY`) for tool calling, or leave them empty — a deterministic fallback agent still runs the demo and evals.

## High-level design

Three actors plus Razorpay. The LLM is allowed to shop. It is not allowed to pay.


| Piece                                     | What it is                                 | What it is allowed to do                                                 |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| **Buyer agent** (left UI)                 | Groq LLM with tools, or a keyword fallback | `search_catalog`, `get_quote` only                                       |
| **Merchant catalog**                      | SKUs, prices in paise, stock               | Read-only menu for the agent                                             |
| **Cashier** (right UI / `cashierService`) | Node + Mongo, not an LLM                   | Cap, allowlist, freeze price, create Razorpay order, capture/fail, audit |
| **Razorpay**                              | Test-mode Orders + Checkout + webhooks     | Move money only after the cashier creates an order                       |
| **Desk (React)**                          | Interview x-ray of the lock                | Chat, mandates, FSM, audit, evals                                        |


Mandates (AP2-shaped, HMAC-signed):

- **Intent** — merchant, ₹500 envelope, SKU allowlist (Reserve Pay analog)
- **Cart** — frozen SKU + amount + catalog hash
- **Payment** — one Razorpay order for that cart only

Payment credentials never enter the model. Illegal checkout states (for example `captured → failed`) are rejected in `fsmService`, not in the prompt.

## Flow

```
1. Browser opens the desk → POST /auth/start
      Demo Buyer (cap ₹500, allowlist BREW-01, LATTE-01)
      + session
      + intent mandate (signed)

2. You type / click Happy path → POST /chat
      Buyer agent (Groq or fallback)
         → tool search_catalog   (optional)
         → tool get_quote(sku, qty)
              │
              ▼
         Cashier createQuote
              unknown SKU? wrong merchant? not allowlisted? over remaining cap?
                 → NO  → audit quote_blocked → chat shows cashier reason
                 → YES → HMAC cart mandate + frozen catalogHash → quote

3. You click Create Razorpay order → POST /checkout
      Cashier createCheckout
              quote expired? catalog hash drifted (price tamper)?
                 → NO order
                 → YES → Razorpay orders.create
                        → payment mandate
                        → FSM quoted → checkout_created
                        → quote marked consumed

4. Pay
      Fake mode:  Simulate capture / Simulate decline
      Test keys:  Razorpay Checkout.js → POST /checkout/:id/verify
                  webhook POST /webhooks/razorpay (payment.captured | payment.failed)

5. Outcome
      captured → spendPaise += amount; remaining cap drops
      failed   → Retry same idempotency key → new order, same checkout
      duplicate webhook → spend does not increase twice

6. Evals tab (optional) → POST /evals/run
      11 cashier tests (no LLM): cap, injection SKU, tamper, webhook, FSM
```

```
User ──chat──► Buyer agent (AI) ──get_quote──► Cashier ──orders.create──► Razorpay
                      │                           │
                      │ no create_order tool      ├── cap / allowlist / hash
                      ▼                           ├── HMAC mandates
                 Merchant catalog                 └── audit + FSM
```
## Images
<img width="1005" height="482" alt="Screenshot 2026-08-30 213215" src="https://github.com/user-attachments/assets/b21d2e1b-375f-418d-b4b1-749d0df0c3d4" />
<img width="1017" height="411" alt="Screenshot 2026-08-30 213249" src="https://github.com/user-attachments/assets/bad66396-f259-43fe-97a7-df46d3451fe2" />

<img width="1002" height="416" alt="image" src="https://github.com/user-attachments/assets/f1968683-cbb3-4449-952a-ef3789ca016e" />
<img width="1017" height="420" alt="Screenshot 2026-08-30 213353" src="https://github.com/user-attachments/assets/b82e0f27-3b5f-40d3-b047-29dcb748f26a" />
<img width="1007" height="427" alt="Screenshot 2026-08-30 213403" src="https://github.com/user-attachments/assets/d0e96e83-5f95-4e12-907c-85681d3d0e60" />
<img width="1007" height="497" alt="Screenshot 2026-08-30 213417" src="https://github.com/user-attachments/assets/7997b151-acc7-46c8-ae38-4db934346e1a" />



## How to use

**Prerequisites:** Node.js, MongoDB on `127.0.0.1:27017`.

**Install, seed, run**

```bash
npm install
npm run install:all
copy backend\.env.example backend\.env
npm run seed
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). API listens on port `4000`.

Optional in `backend/.env`: `LLM_PROVIDER=groq`, `GROQ_API_KEY`, `GROQ_MODEL`. Without a key, the left chat still works via the fallback agent.

**Using the desk**

1. Left = buyer agent. Right = cashier. Top-right = remaining cap (starts at ₹500).
2. **Happy path** — agent asks for Cold Brew. Right side shows a signed cart (~₹249). Click **Create Razorpay order**, then **Simulate capture**. Remaining cap should fall (about ₹251 left). Open the **audit** tab.
3. **Over cap** — agent tries the espresso machine. Cashier blocks. No order. Cap unchanged.
4. **Prompt injection** — text tries to force `EVIL-01`. Cashier blocks (not allowlisted).
5. After an order: **Simulate decline** then **Retry same key** to see the failure path.
6. **evals** tab → **Run evals**. Expect 11/11 on the cashier suite.

Refresh the page for a new chat session. Remaining cap lives on the Demo Buyer in Mongo; run `npm run seed` to reset the ₹500 envelope.

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



## Reset remaining cap to ₹500 
There is no cap field in the UI. The ₹500 envelope is stored on the Demo Buyer in Mongo.
(also resets spend to 0 and re-seeds the catalog):
```
npm run seed
```

## API


| Method | Path                        | Purpose                               |
| ------ | --------------------------- | ------------------------------------- |
| POST   | `/api/v1/auth/start`        | Open session + intent mandate         |
| POST   | `/api/v1/chat`              | Buyer agent turn                      |
| POST   | `/api/v1/quotes`            | Cashier cart (also used by the agent) |
| POST   | `/api/v1/checkout`          | Create Razorpay order                 |
| POST   | `/api/v1/checkout/:id/fake` | Dev capture / decline                 |
| POST   | `/api/v1/webhooks/razorpay` | Signed webhook                        |
| POST   | `/api/v1/evals/run`         | Money-safety suite                    |


