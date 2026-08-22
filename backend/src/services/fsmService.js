const Checkout = require("../models/Checkout");

const TRANSITIONS = {
  quoted: ["checkout_created", "blocked", "expired"],
  checkout_created: ["authorized", "failed", "expired", "blocked"],
  authorized: ["captured", "failed"],
  captured: [],
  failed: ["checkout_created"],
  expired: [],
  blocked: [],
};

exports.canTransition = (from, to) => {
  return (TRANSITIONS[from] || []).includes(to);
};

exports.transition = async (checkout, to, extra = {}) => {
  if (!exports.canTransition(checkout.status, to)) {
    const error = new Error(
      `Illegal checkout transition ${checkout.status} → ${to}`
    );
    error.code = "ILLEGAL_TRANSITION";
    throw error;
  }
  checkout.status = to;
  Object.assign(checkout, extra);
  await checkout.save();
  return checkout;
};

exports.assertLive = (checkout) => {
  if (["captured", "blocked", "expired"].includes(checkout.status)) {
    const error = new Error(`Checkout is ${checkout.status} and cannot move money again`);
    error.code = "CHECKOUT_TERMINAL";
    throw error;
  }
};
