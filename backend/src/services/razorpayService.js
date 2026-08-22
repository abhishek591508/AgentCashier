const crypto = require("crypto");
const Razorpay = require("razorpay");
const env = require("../config/env");

let client = null;

const getClient = () => {
  if (env.fakePayments) {
    return null;
  }
  if (!client) {
    client = new Razorpay({
      key_id: env.razorpay.keyId,
      key_secret: env.razorpay.keySecret,
    });
  }
  return client;
};

exports.isFake = () => env.fakePayments;

exports.publicKey = () => (env.fakePayments ? "" : env.razorpay.keyId);

exports.createOrder = async ({ amountPaise, receipt, notes }) => {
  if (env.fakePayments) {
    return {
      id: `order_fake_${crypto.randomBytes(6).toString("hex")}`,
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes,
      fake: true,
    };
  }
  const razorpay = getClient();
  return razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: String(receipt).slice(0, 40),
    notes,
  });
};

exports.verifyCheckoutSignature = ({ orderId, paymentId, signature }) => {
  if (env.fakePayments) {
    return true;
  }
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", env.razorpay.keySecret)
    .update(body)
    .digest("hex");
  return expected === signature;
};

exports.verifyWebhookSignature = (rawBody, signature) => {
  if (env.fakePayments) {
    return true;
  }
  if (!env.razorpay.webhookSecret) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", env.razorpay.webhookSecret)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
};
