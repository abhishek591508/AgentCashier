const auditService = require("../services/auditService");
const mandateService = require("../services/mandateService");
const Buyer = require("../models/Buyer");
const { asyncHandler, loadSession } = require("../middleware/errorHandler");
const apiView = require("../views/apiView");

exports.session = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.sessionId);
  const events = await auditService.forSession(session._id);
  return apiView.ok(res, events);
});

exports.mandates = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.sessionId);
  const mandates = await mandateService.listForSession(session._id);
  const buyer = await Buyer.findById(session.buyer);
  return apiView.ok(res, {
    mandates,
    buyer: {
      capPaise: buyer.capPaise,
      spendPaise: buyer.spendPaise,
      remainingPaise: Math.max(0, buyer.capPaise - buyer.spendPaise),
      allowlistSkus: buyer.allowlistSkus,
    },
  });
});
