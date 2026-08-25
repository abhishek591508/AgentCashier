import { useEffect, useState } from "react";
import ChatPane from "../components/ChatPane.jsx";
import CashierPane from "../components/CashierPane.jsx";
import api, { unwrap } from "../api/client.js";
import { rupees } from "../lib/money.js";

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function DeskView() {
  const [boot, setBoot] = useState(null);
  const [fakePayments, setFakePayments] = useState(true);
  const [razorpayKey, setRazorpayKey] = useState("");
  const [messages, setMessages] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [quote, setQuote] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [mandates, setMandates] = useState([]);
  const [audit, setAudit] = useState([]);
  const [tab, setTab] = useState("desk");
  const [busy, setBusy] = useState(false);
  const [evalBusy, setEvalBusy] = useState(false);
  const [evalReport, setEvalReport] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshSide = async (sessionId, checkoutId) => {
    const mandateBody = unwrap(await api.get(`/mandates/session/${sessionId}`));
    setMandates(mandateBody.data.mandates || []);
    if (mandateBody.data.buyer) {
      setBoot((prev) =>
        prev
          ? {
              ...prev,
              buyer: { ...prev.buyer, ...mandateBody.data.buyer },
            }
          : prev
      );
    }
    const auditBody = unwrap(
      await api.get(
        checkoutId ? `/checkout/${checkoutId}` : `/audit/session/${sessionId}`
      )
    );
    if (checkoutId) {
      setCheckout(auditBody.data.checkout);
      setAttempts(auditBody.data.attempts || []);
      const events = unwrap(await api.get(`/audit/session/${sessionId}`));
      setAudit(events.data || []);
    } else {
      setAudit(auditBody.data || []);
    }
  };

  useEffect(() => {
    const start = async () => {
      try {
        const body = unwrap(await api.post("/auth/start"));
        setBoot(body.data);
        setCatalog(body.data.catalog || []);
        const keyBody = unwrap(await api.get("/razorpay/key"));
        setFakePayments(Boolean(keyBody.data.fake));
        setRazorpayKey(keyBody.data.key || "");
        const history = unwrap(await api.get(`/chat/${body.data.sessionId}`));
        setMessages(history.data || []);
        await refreshSide(body.data.sessionId);
      } catch (err) {
        setError(err.message);
      }
    };
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSend = async (text) => {
    if (!boot) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const body = unwrap(
        await api.post("/chat", { sessionId: boot.sessionId, message: text })
      );
      setMessages((prev) => [...prev, { role: "assistant", content: body.data.text }]);
      if (body.data.catalog) {
        setCatalog(body.data.catalog);
      }
      if (body.data.quote) {
        setQuote(body.data.quote);
        setCheckout(null);
      }
      await refreshSide(boot.sessionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onCheckout = async () => {
    if (!boot || !quote) {
      return;
    }
    setError("");
    try {
      const body = unwrap(
        await api.post("/checkout", {
          sessionId: boot.sessionId,
          quoteId: quote._id,
        })
      );
      setCheckout(body.data.checkout);
      setNotice("Cashier created a Razorpay order. The buyer agent still cannot capture.");
      await refreshSide(boot.sessionId, body.data.checkout._id);
    } catch (err) {
      setError(err.message);
    }
  };

  const onFake = async (outcome) => {
    if (!checkout) {
      return;
    }
    try {
      const body = unwrap(
        await api.post(`/checkout/${checkout._id}/fake`, { outcome })
      );
      setCheckout(body.data.checkout);
      setAttempts(body.data.attempts || []);
      if (body.data.buyer && boot) {
        setBoot({ ...boot, buyer: { ...boot.buyer, ...body.data.buyer } });
      }
      setNotice(
        outcome === "fail"
          ? "Bank decline recorded. Retry keeps the same idempotency key."
          : "Captured. Spend envelope decremented."
      );
      await refreshSide(boot.sessionId, checkout._id);
    } catch (err) {
      setError(err.message);
    }
  };

  const onRetry = async () => {
    if (!checkout) {
      return;
    }
    try {
      const body = unwrap(await api.post(`/checkout/${checkout._id}/retry`));
      setCheckout(body.data.checkout);
      setNotice("Retry opened a new order against the same checkout idempotency key.");
      await refreshSide(boot.sessionId, checkout._id);
    } catch (err) {
      setError(err.message);
    }
  };

  const onPayLive = async () => {
    if (!checkout || !razorpayKey) {
      return;
    }
    const ok = await loadRazorpay();
    if (!ok) {
      setError("Could not load Razorpay Checkout.js");
      return;
    }
    const rzp = new window.Razorpay({
      key: razorpayKey,
      amount: checkout.amountPaise,
      currency: "INR",
      name: boot?.merchant?.name || "AgentCashier",
      order_id: checkout.razorpayOrderId,
      handler: async (response) => {
        try {
          unwrap(await api.post(`/checkout/${checkout._id}/verify`, response));
          setNotice("Checkout signature verified. Waiting on webhook for capture.");
          await refreshSide(boot.sessionId, checkout._id);
        } catch (err) {
          setError(err.message);
        }
      },
    });
    rzp.open();
  };

  const onEval = async () => {
    setEvalBusy(true);
    setError("");
    try {
      const body = unwrap(await api.post("/evals/run", {}));
      setEvalReport(body.data);
      setTab("evals");
    } catch (err) {
      setError(err.message);
    } finally {
      setEvalBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>AgentCashier</strong>
          <span>Track 01 · AI Growth & Agentic Commerce</span>
        </div>
        <div className="top-meta">
          <span className={`badge ${fakePayments ? "fake" : "live"}`}>
            {fakePayments ? "fake payments" : "razorpay test"}
          </span>
          <div className="cap">
            <label>Remaining cap</label>
            <b>{rupees(boot?.buyer?.remainingPaise)}</b>
          </div>
        </div>
      </header>
      <div className="desk">
        <ChatPane
          messages={messages}
          busy={busy}
          onSend={onSend}
          error={error}
          notice={notice}
        />
        <CashierPane
          tab={tab}
          setTab={setTab}
          boot={boot}
          catalog={catalog}
          quote={quote}
          checkout={checkout}
          attempts={attempts}
          mandates={mandates}
          audit={audit}
          evalReport={evalReport}
          evalBusy={evalBusy}
          fakePayments={fakePayments}
          onCheckout={onCheckout}
          onFake={onFake}
          onRetry={onRetry}
          onEval={onEval}
          onPayLive={onPayLive}
        />
      </div>
    </div>
  );
}
