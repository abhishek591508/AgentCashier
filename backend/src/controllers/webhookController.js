const razorpayService = require("../services/razorpayService");
const cashierService = require("../services/cashierService");
const { asyncHandler } = require("../middleware/errorHandler");
const apiView = require("../views/apiView");

exports.razorpay = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const rawValid = razorpayService.verifyWebhookSignature(rawBody, signature);
  const event = req.body?.event || "unknown";
  const eventId =
    req.body?.payload?.payment?.entity?.id ||
    req.body?.id ||
    `evt_${Date.now()}`;

  const result = await cashierService.handleWebhook({
    eventId: `${event}:${eventId}`,
    event,
    payload: req.body,
    rawValid,
  });

  if (!result.ok) {
    return apiView.fail(res, result.message, 400, { code: result.code });
  }
  return apiView.ok(res, { duplicate: Boolean(result.duplicate) });
});
