import { rupees } from "../lib/money.js";

const STATES = [
  "quoted",
  "checkout_created",
  "authorized",
  "captured",
  "failed",
  "expired",
  "blocked",
];

export default function CashierPane({
  tab,
  setTab,
  boot,
  catalog,
  quote,
  checkout,
  attempts,
  mandates,
  audit,
  evalReport,
  evalBusy,
  fakePayments,
  onCheckout,
  onFake,
  onRetry,
  onEval,
  onPayLive,
}) {
  return (
    <section className="pane">
      <div className="pane-head">
        <span>Cashier</span>
        <span className="mono">bounded · gated · auditable</span>
      </div>
      <div className="tabs">
        {["desk", "audit", "evals"].map((id) => (
          <button
            key={id}
            className={tab === id ? "on" : ""}
            type="button"
            onClick={() => setTab(id)}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="inspector">
        {tab === "desk" ? (
          <>
            <div className="card">
              <h3>Intent mandate · Reserve Pay analog</h3>
              <div className="row">
                <span>Merchant</span>
                <b>{boot?.merchant?.name}</b>
              </div>
              <div className="row">
                <span>Cap</span>
                <b className="mono">{rupees(boot?.buyer?.capPaise)}</b>
              </div>
              <div className="row">
                <span>Allowlist</span>
                <b className="mono">{boot?.buyer?.allowlistSkus?.join(", ")}</b>
              </div>
            </div>

            <div className="card">
              <h3>Agent-readable catalog</h3>
              <div className="catalog">
                {(catalog || []).map((item) => (
                  <div className="sku" key={item.sku}>
                    <b>{item.name}</b>
                    <span className="mono">{item.sku}</span>
                    <div className="price">{rupees(item.amountPaise)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3>Cart / payment</h3>
              {quote ? (
                <>
                  <div className="row">
                    <span>SKU</span>
                    <b className="mono">{quote.sku}</b>
                  </div>
                  <div className="row">
                    <span>Frozen amount</span>
                    <b className="mono">{rupees(quote.amountPaise)}</b>
                  </div>
                </>
              ) : (
                <div className="row">
                  <span>No signed cart yet</span>
                </div>
              )}
              <div className="fsm" style={{ marginTop: 10 }}>
                {STATES.map((state) => {
                  const on = checkout?.status === state;
                  const bad = on && (state === "failed" || state === "blocked");
                  return (
                    <i key={state} className={on ? (bad ? "bad" : "on") : ""}>
                      {state}
                    </i>
                  );
                })}
              </div>
              {checkout ? (
                <div className="row">
                  <span>Idempotency</span>
                  <b className="mono">{checkout.idempotencyKey}</b>
                </div>
              ) : null}
              <div className="actions">
                <button
                  className="btn"
                  type="button"
                  disabled={!quote}
                  onClick={onCheckout}
                >
                  Create Razorpay order
                </button>
                {fakePayments && checkout?.status === "checkout_created" ? (
                  <>
                    <button className="btn" type="button" onClick={() => onFake("success")}>
                      Simulate capture
                    </button>
                    <button className="btn warn" type="button" onClick={() => onFake("fail")}>
                      Simulate decline
                    </button>
                  </>
                ) : null}
                {!fakePayments && checkout?.status === "checkout_created" ? (
                  <button className="btn" type="button" onClick={onPayLive}>
                    Open Razorpay Checkout
                  </button>
                ) : null}
                {checkout?.status === "failed" ? (
                  <button className="btn ghost" type="button" onClick={onRetry}>
                    Retry same key
                  </button>
                ) : null}
              </div>
              {attempts?.length ? (
                <div className="row" style={{ marginTop: 8 }}>
                  <span>Attempts</span>
                  <b className="mono">{attempts.map((row) => row.status).join(" → ")}</b>
                </div>
              ) : null}
            </div>

            <div className="card">
              <h3>Mandates</h3>
              {(mandates || []).slice(0, 6).map((mandate) => (
                <div className="row" key={mandate._id}>
                  <span>
                    {mandate.kind} · {mandate.status}
                  </span>
                  <b className="mono">{String(mandate.signature).slice(0, 12)}</b>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {tab === "audit" ? (
          <ul className="audit">
            {(audit || []).map((event) => (
              <li key={event._id}>
                <div className="type">
                  {event.actor} · {event.type}
                </div>
                <div>{JSON.stringify(event.payload)}</div>
              </li>
            ))}
          </ul>
        ) : null}

        {tab === "evals" ? (
          <div className="card">
            <h3>Money-safety suite</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
              Deterministic cashier tests. These do not depend on the LLM.
            </p>
            <button className="btn" type="button" disabled={evalBusy} onClick={onEval}>
              {evalBusy ? "Running…" : "Run evals"}
            </button>
            {evalReport ? (
              <>
                <div className="row" style={{ marginTop: 12 }}>
                  <span>Score</span>
                  <b className={evalReport.failed ? "fail" : "pass"}>
                    {evalReport.passed}/{evalReport.total}
                  </b>
                </div>
                {evalReport.cases.map((row) => (
                  <div className="eval-row" key={row.id}>
                    <span className={row.pass ? "pass" : "fail"}>{row.pass ? "P" : "F"}</span>
                    <div>
                      <div>{row.title}</div>
                      <div className="id">{row.id}</div>
                      {row.error ? <div className="fail">{row.error}</div> : null}
                    </div>
                    <span className="mono">{row.ms}ms</span>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
