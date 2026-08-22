const crypto = require("crypto");
const Mandate = require("../models/Mandate");
const env = require("../config/env");

const sign = (kind, payload) => {
  const body = JSON.stringify({ kind, payload });
  return crypto.createHmac("sha256", env.mandateSecret).update(body).digest("hex");
};

const verify = (mandate) => {
  const expected = sign(mandate.kind, mandate.payload);
  return (
    expected === mandate.signature &&
    mandate.status === "active" &&
    new Date(mandate.expiresAt).getTime() > Date.now()
  );
};

const catalogHash = (product) => {
  return crypto
    .createHash("sha256")
    .update(`${product.sku}|${product.amountPaise}|${product.name}`)
    .digest("hex");
};

exports.sign = sign;
exports.verify = verify;
exports.catalogHash = catalogHash;

exports.createIntent = async ({ session, buyer, merchantId }) => {
  const payload = {
    capPaise: buyer.capPaise,
    remainingPaise: Math.max(0, buyer.capPaise - buyer.spendPaise),
    merchantId: String(merchantId),
    allowlistSkus: buyer.allowlistSkus,
    note: "UPI Reserve Pay analog: spend envelope signed before the agent shops.",
  };
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return Mandate.create({
    kind: "intent",
    session: session._id,
    buyer: buyer._id,
    payload,
    signature: sign("intent", payload),
    expiresAt,
    status: "active",
  });
};

exports.createCart = async ({ session, buyer, cart }) => {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const payload = {
    ...cart,
    frozen: true,
    note: "AP2 cart mandate: price and SKU frozen. Cashier rejects any drift.",
  };
  return Mandate.create({
    kind: "cart",
    session: session._id,
    buyer: buyer._id,
    payload,
    signature: sign("cart", payload),
    expiresAt,
    status: "active",
  });
};

exports.createPayment = async ({ session, buyer, checkoutId, amountPaise, sku, orderId }) => {
  const payload = {
    checkoutId: String(checkoutId),
    amountPaise,
    sku,
    orderId,
    note: "Payment mandate: cashier may create one Razorpay order for this cart only.",
  };
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  return Mandate.create({
    kind: "payment",
    session: session._id,
    buyer: buyer._id,
    payload,
    signature: sign("payment", payload),
    expiresAt,
    status: "active",
  });
};

exports.listForSession = async (sessionId) => {
  return Mandate.find({ session: sessionId }).sort({ createdAt: -1 });
};
