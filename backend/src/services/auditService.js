const AuditEvent = require("../models/AuditEvent");

exports.record = async ({ session, checkout, actor, type, payload }) => {
  return AuditEvent.create({
    session: session || undefined,
    checkout: checkout || undefined,
    actor,
    type,
    payload: payload || {},
  });
};

exports.forSession = async (sessionId) => {
  return AuditEvent.find({ session: sessionId }).sort({ createdAt: -1 }).limit(80);
};

exports.forCheckout = async (checkoutId) => {
  return AuditEvent.find({ checkout: checkoutId }).sort({ createdAt: -1 }).limit(80);
};
