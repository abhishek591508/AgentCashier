const Session = require("../models/Session");
const Buyer = require("../models/Buyer");

exports.asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

exports.errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal server error",
    code: err.code || "SERVER_ERROR",
  });
};

exports.loadSession = async (sessionId) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    const error = new Error("Session not found");
    error.status = 404;
    error.code = "SESSION_MISSING";
    throw error;
  }
  session.buyerDoc = await Buyer.findById(session.buyer);
  return session;
};
