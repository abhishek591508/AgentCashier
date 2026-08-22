const crypto = require("crypto");
const Buyer = require("../models/Buyer");
const Session = require("../models/Session");
const Quote = require("../models/Quote");
const Checkout = require("../models/Checkout");
const PaymentAttempt = require("../models/PaymentAttempt");
const WebhookEvent = require("../models/WebhookEvent");
const merchantAgentService = require("./merchantAgentService");
const mandateService = require("./mandateService");
const razorpayService = require("./razorpayService");
const fsmService = require("./fsmService");
const auditService = require("./auditService");

const QUOTE_TTL_MS = 15 * 60 * 1000;

const fail = (code, message, extra = {}) => ({
  ok: false,
  code,
  message,
  ...extra,
});

const remainingCap = (buyer) => Math.max(0, buyer.capPaise - buyer.spendPaise);

exports.createQuote = async ({ session, sku, qty }) => {
  const buyer = await Buyer.findById(session.buyer);
  if (!buyer) {
    return fail("BUYER_MISSING", "Buyer is not registered.");
  }

  const quantity = Number(qty || 1);
  if (!sku || quantity < 1) {
    return fail("INVALID_QTY", "SKU and a positive quantity are required.");
  }

  const product = await merchantAgentService.getBySku(sku);
  if (!product) {
    await auditService.record({
      session: session._id,
      actor: "cashier",
      type: "quote_blocked",
      payload: { sku, reason: "unknown_sku" },
    });
    return fail("UNKNOWN_SKU", `SKU ${sku} is not in the merchant catalog.`);
  }

  if (String(product.merchant) !== String(session.merchant)) {
    await auditService.record({
      session: session._id,
      actor: "cashier",
      type: "quote_blocked",
      payload: { sku, reason: "wrong_merchant" },
    });
    return fail("WRONG_MERCHANT", "This SKU does not belong to the mandated merchant.");
  }

  if (product.stock < quantity) {
    return fail("OUT_OF_STOCK", `SKU ${sku} does not have enough stock.`);
  }

  if (
    buyer.allowlistSkus.length > 0 &&
    !buyer.allowlistSkus.includes(product.sku)
  ) {
    await auditService.record({
      session: session._id,
      actor: "cashier",
      type: "quote_blocked",
      payload: { sku, reason: "not_allowlisted" },
    });
    return fail(
      "NOT_ALLOWLISTED",
      `SKU ${sku} is not on the buyer allowlist. The intent mandate forbids this item.`
    );
  }

  const amountPaise = product.amountPaise * quantity;
  const remaining = remainingCap(buyer);
  if (amountPaise > remaining) {
    await auditService.record({
      session: session._id,
      actor: "cashier",
      type: "quote_blocked",
      payload: {
        sku,
        amountPaise,
        remainingPaise: remaining,
        reason: "over_cap",
      },
    });
    return fail(
      "OVER_CAP",
      `₹${(amountPaise / 100).toFixed(2)} exceeds remaining cap ₹${(remaining / 100).toFixed(2)}.`,
      { amountPaise, remainingPaise: remaining }
    );
  }

  const hash = mandateService.catalogHash(product);
  const cart = {
    sku: product.sku,
    name: product.name,
    qty: quantity,
    amountPaise,
    unitPaise: product.amountPaise,
    catalogHash: hash,
  };

  const mandate = await mandateService.createCart({ session, buyer, cart });
  const quote = await Quote.create({
    session: session._id,
    mandate: mandate._id,
    sku: product.sku,
    qty: quantity,
    amountPaise,
    catalogHash: hash,
    expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    status: "open",
  });

  await auditService.record({
    session: session._id,
    actor: "cashier",
    type: "quote_created",
    payload: { sku: product.sku, amountPaise, quoteId: quote._id },
  });

  return {
    ok: true,
    quote,
    mandate,
    product: {
      sku: product.sku,
      name: product.name,
      amountPaise: product.amountPaise,
    },
  };
};

exports.createCheckout = async ({ session, quoteId }) => {
  const buyer = await Buyer.findById(session.buyer);
  const quote = await Quote.findById(quoteId);
  if (!quote || String(quote.session) !== String(session._id)) {
    return fail("QUOTE_MISSING", "Quote not found for this session.");
  }
  if (quote.status !== "open") {
    return fail("QUOTE_USED", `Quote is ${quote.status}.`);
  }
  if (quote.expiresAt.getTime() < Date.now()) {
    quote.status = "expired";
    await quote.save();
    return fail("QUOTE_EXPIRED", "Cart mandate expired. Request a new quote.");
  }

  const product = await merchantAgentService.getBySku(quote.sku);
  if (!product) {
    return fail("UNKNOWN_SKU", "Product disappeared after quote.");
  }

  const liveHash = mandateService.catalogHash(product);
  if (liveHash !== quote.catalogHash) {
    quote.status = "blocked";
    await quote.save();
    await auditService.record({
      session: session._id,
      actor: "cashier",
      type: "price_tamper_blocked",
      payload: { sku: quote.sku, quotedHash: quote.catalogHash, liveHash },
    });
    return fail(
      "PRICE_TAMPER",
      "Catalog changed after the cart was frozen. Cashier will not pay the drifted amount."
    );
  }

  if (quote.amountPaise > remainingCap(buyer)) {
    return fail("OVER_CAP", "Remaining cap no longer covers this cart.");
  }

  const existing = await Checkout.findOne({
    quote: quote._id,
    status: { $nin: ["blocked", "expired"] },
  });
  if (existing) {
    return { ok: true, checkout: existing, reused: true };
  }

  const idempotencyKey = `chk_${session._id}_${quote._id}`;
  let checkout = await Checkout.findOne({ idempotencyKey });
  if (checkout) {
    return { ok: true, checkout, reused: true };
  }

  checkout = await Checkout.create({
    session: session._id,
    quote: quote._id,
    sku: quote.sku,
    amountPaise: quote.amountPaise,
    status: "quoted",
    idempotencyKey,
  });

  const order = await razorpayService.createOrder({
    amountPaise: quote.amountPaise,
    receipt: String(checkout._id),
    notes: {
      checkoutId: String(checkout._id),
      sessionId: String(session._id),
      sku: quote.sku,
    },
  });

  const paymentMandate = await mandateService.createPayment({
    session,
    buyer,
    checkoutId: checkout._id,
    amountPaise: quote.amountPaise,
    sku: quote.sku,
    orderId: order.id,
  });

  await fsmService.transition(checkout, "checkout_created", {
    razorpayOrderId: order.id,
    paymentMandate: paymentMandate._id,
  });

  quote.status = "consumed";
  await quote.save();

  await PaymentAttempt.create({
    checkout: checkout._id,
    status: "created",
    note: razorpayService.isFake() ? "fake_order" : "razorpay_order",
  });

  await auditService.record({
    session: session._id,
    checkout: checkout._id,
    actor: "cashier",
    type: "checkout_created",
    payload: {
      orderId: order.id,
      amountPaise: quote.amountPaise,
      fake: razorpayService.isFake(),
    },
  });

  return { ok: true, checkout, order };
};

exports.verifyClientPayment = async ({ checkoutId, orderId, paymentId, signature }) => {
  const checkout = await Checkout.findById(checkoutId);
  if (!checkout) {
    return fail("CHECKOUT_MISSING", "Checkout not found.");
  }
  if (checkout.razorpayOrderId !== orderId) {
    return fail("ORDER_MISMATCH", "Order id does not match this checkout.");
  }
  const valid = razorpayService.verifyCheckoutSignature({
    orderId,
    paymentId,
    signature,
  });
  if (!valid) {
    await auditService.record({
      session: checkout.session,
      checkout: checkout._id,
      actor: "cashier",
      type: "signature_rejected",
      payload: { orderId, paymentId },
    });
    return fail("BAD_SIGNATURE", "Razorpay checkout signature failed.");
  }

  if (checkout.status === "checkout_created") {
    await fsmService.transition(checkout, "authorized", {
      razorpayPaymentId: paymentId,
    });
  }

  await PaymentAttempt.create({
    checkout: checkout._id,
    razorpayPaymentId: paymentId,
    status: "authorized",
    note: "client_handler",
  });

  if (razorpayService.isFake()) {
    await exports.capture({ checkout, paymentId, eventId: `client_${paymentId}` });
  }

  return { ok: true, checkout };
};

exports.capture = async ({ checkout, paymentId, eventId }) => {
  if (checkout.status === "captured") {
    return { ok: true, checkout, duplicate: true };
  }
  if (checkout.status === "failed") {
    await fsmService.transition(checkout, "checkout_created", {
      lastError: "",
      failureCode: "",
    });
  }
  if (checkout.status === "checkout_created") {
    await fsmService.transition(checkout, "authorized", {
      razorpayPaymentId: paymentId,
    });
  }
  if (checkout.status === "authorized") {
    await fsmService.transition(checkout, "captured", {
      razorpayPaymentId: paymentId,
    });
  }

  const sess = await Session.findById(checkout.session);
  const buyer = sess ? await Buyer.findById(sess.buyer) : null;
  if (buyer) {
    buyer.spendPaise += checkout.amountPaise;
    await buyer.save();
  }

  await PaymentAttempt.create({
    checkout: checkout._id,
    razorpayPaymentId: paymentId,
    status: "captured",
    note: eventId || "capture",
  });

  await auditService.record({
    session: checkout.session,
    checkout: checkout._id,
    actor: "razorpay",
    type: "payment_captured",
    payload: { paymentId, amountPaise: checkout.amountPaise, eventId },
  });

  return { ok: true, checkout };
};

exports.failPayment = async ({ checkout, paymentId, code, note }) => {
  if (checkout.status === "captured") {
    return fail("ALREADY_CAPTURED", "Cannot fail a captured payment.");
  }
  if (checkout.status !== "failed") {
    const from = checkout.status;
    if (from === "checkout_created" || from === "authorized") {
      await fsmService.transition(checkout, "failed", {
        lastError: note || "payment_failed",
        failureCode: code || "PAYMENT_FAILED",
        razorpayPaymentId: paymentId || checkout.razorpayPaymentId,
      });
    }
  }

  await PaymentAttempt.create({
    checkout: checkout._id,
    razorpayPaymentId: paymentId || "",
    status: "failed",
    errorCode: code || "PAYMENT_FAILED",
    note: note || "",
  });

  await auditService.record({
    session: checkout.session,
    checkout: checkout._id,
    actor: "razorpay",
    type: "payment_failed",
    payload: { paymentId, code, note },
  });

  return { ok: true, checkout };
};

exports.retry = async ({ checkout }) => {
  fsmService.assertLive(checkout);
  if (checkout.status !== "failed") {
    return fail("NOT_FAILED", "Retry is only allowed from the failed state.");
  }

  const order = await razorpayService.createOrder({
    amountPaise: checkout.amountPaise,
    receipt: String(checkout._id),
    notes: {
      checkoutId: String(checkout._id),
      retry: "true",
      sku: checkout.sku,
    },
  });

  await fsmService.transition(checkout, "checkout_created", {
    razorpayOrderId: order.id,
    lastError: "",
    failureCode: "",
  });

  await PaymentAttempt.create({
    checkout: checkout._id,
    status: "created",
    note: "retry_same_idempotency_key",
  });

  await auditService.record({
    session: checkout.session,
    checkout: checkout._id,
    actor: "cashier",
    type: "payment_retried",
    payload: {
      orderId: order.id,
      idempotencyKey: checkout.idempotencyKey,
    },
  });

  return { ok: true, checkout, order };
};

exports.handleWebhook = async ({ eventId, event, payload, rawValid }) => {
  if (!rawValid) {
    return fail("BAD_WEBHOOK_SIGNATURE", "Webhook signature mismatch.");
  }

  const existing = await WebhookEvent.findOne({ eventId });
  if (existing) {
    existing.duplicate = true;
    await existing.save();
    await auditService.record({
      actor: "razorpay",
      type: "webhook_duplicate",
      payload: { eventId, event },
      session: undefined,
    });
    return { ok: true, duplicate: true, checkout: null };
  }

  const entity = payload?.payload?.payment?.entity || payload?.payment || {};
  const orderId = entity.order_id || payload?.orderId || "";
  const paymentId = entity.id || payload?.paymentId || "";

  await WebhookEvent.create({
    eventId,
    event,
    paymentId,
    orderId,
    processed: false,
    payload,
  });

  const checkout = orderId
    ? await Checkout.findOne({ razorpayOrderId: orderId })
    : null;

  if (!checkout) {
    return { ok: true, ignored: true };
  }

  if (event === "payment.captured" || event === "payment.authorized") {
    if (event === "payment.captured") {
      await exports.capture({ checkout, paymentId, eventId });
    } else if (checkout.status === "checkout_created") {
      await fsmService.transition(checkout, "authorized", {
        razorpayPaymentId: paymentId,
      });
    }
  }

  if (event === "payment.failed") {
    await exports.failPayment({
      checkout,
      paymentId,
      code: entity.error_code || "PAYMENT_FAILED",
      note: entity.error_description || "webhook payment.failed",
    });
  }

  await WebhookEvent.updateOne({ eventId }, { processed: true });
  return { ok: true, checkout };
};

exports.fakePay = async (checkout, outcome) => {
  if (!razorpayService.isFake()) {
    return fail("FAKE_DISABLED", "Fake payments are disabled.");
  }
  const paymentId = `pay_fake_${crypto.randomBytes(6).toString("hex")}`;
  if (outcome === "fail") {
    return exports.failPayment({
      checkout,
      paymentId,
      code: "BANK_DECLINE",
      note: "Simulated bank decline. Retry uses the same idempotency key.",
    });
  }
  return exports.handleWebhook({
    eventId: `evt_fake_${paymentId}`,
    event: "payment.captured",
    payload: {
      paymentId,
      orderId: checkout.razorpayOrderId,
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: checkout.razorpayOrderId,
            amount: checkout.amountPaise,
          },
        },
      },
    },
    rawValid: true,
  });
};

exports.getCheckoutBundle = async (checkoutId) => {
  const checkout = await Checkout.findById(checkoutId);
  if (!checkout) {
    return null;
  }
  const attempts = await PaymentAttempt.find({ checkout: checkoutId }).sort({
    createdAt: 1,
  });
  return { checkout, attempts };
};
