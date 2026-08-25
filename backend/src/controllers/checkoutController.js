const Checkout = require("../models/Checkout");
const Buyer = require("../models/Buyer");
const cashierService = require("../services/cashierService");
const auditService = require("../services/auditService");
const { asyncHandler, loadSession } = require("../middleware/errorHandler");
const apiView = require("../views/apiView");

exports.quote = asyncHandler(async (req, res) => {
  const session = await loadSession(req.body.sessionId);
  const result = await cashierService.createQuote({
    session,
    sku: req.body.sku,
    qty: req.body.qty,
  });
  if (!result.ok) {
    return apiView.fail(res, result.message, 400, { code: result.code, data: result });
  }
  return apiView.ok(res, result, "Cart mandate signed");
});

exports.create = asyncHandler(async (req, res) => {
  const session = await loadSession(req.body.sessionId);
  const result = await cashierService.createCheckout({
    session,
    quoteId: req.body.quoteId,
  });
  if (!result.ok) {
    return apiView.fail(res, result.message, 400, { code: result.code });
  }
  return apiView.ok(res, { checkout: result.checkout, order: result.order });
});

exports.show = asyncHandler(async (req, res) => {
  const bundle = await cashierService.getCheckoutBundle(req.params.id);
  if (!bundle) {
    return apiView.fail(res, "Checkout not found", 404);
  }
  return apiView.ok(res, apiView.checkout(bundle));
});

exports.verify = asyncHandler(async (req, res) => {
  const result = await cashierService.verifyClientPayment({
    checkoutId: req.params.id,
    orderId: req.body.razorpay_order_id,
    paymentId: req.body.razorpay_payment_id,
    signature: req.body.razorpay_signature,
  });
  if (!result.ok) {
    return apiView.fail(res, result.message, 400, { code: result.code });
  }
  return apiView.ok(res, { checkout: result.checkout }, "Payment authorized");
});

exports.retry = asyncHandler(async (req, res) => {
  const checkout = await Checkout.findById(req.params.id);
  if (!checkout) {
    return apiView.fail(res, "Checkout not found", 404);
  }
  const result = await cashierService.retry({ checkout });
  if (!result.ok) {
    return apiView.fail(res, result.message, 400, { code: result.code });
  }
  return apiView.ok(res, { checkout: result.checkout, order: result.order });
});

exports.fake = asyncHandler(async (req, res) => {
  const checkout = await Checkout.findById(req.params.id);
  if (!checkout) {
    return apiView.fail(res, "Checkout not found", 404);
  }
  const result = await cashierService.fakePay(checkout, req.body.outcome || "success");
  if (!result.ok) {
    return apiView.fail(res, result.message, 400, { code: result.code });
  }
  const bundle = await cashierService.getCheckoutBundle(checkout._id);
  const session = await loadSession(String(checkout.session));
  const buyer = await Buyer.findById(session.buyer);
  return apiView.ok(res, {
    ...apiView.checkout(bundle),
    buyer: {
      capPaise: buyer.capPaise,
      spendPaise: buyer.spendPaise,
      remainingPaise: Math.max(0, buyer.capPaise - buyer.spendPaise),
    },
  });
});

exports.audit = asyncHandler(async (req, res) => {
  const events = await auditService.forCheckout(req.params.id);
  return apiView.ok(res, events);
});
