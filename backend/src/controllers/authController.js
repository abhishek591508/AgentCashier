const Buyer = require("../models/Buyer");
const Merchant = require("../models/Merchant");
const Session = require("../models/Session");
const merchantAgentService = require("../services/merchantAgentService");
const mandateService = require("../services/mandateService");
const razorpayService = require("../services/razorpayService");
const apiView = require("../views/apiView");
const { asyncHandler } = require("../middleware/errorHandler");

exports.start = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findOne({ slug: "blue-mug" });
  if (!merchant) {
    return apiView.fail(res, "Seed the database first: npm run seed", 500);
  }

  const existing = await Buyer.findOne({ name: "Demo Buyer" });
  const buyer =
    existing ||
    (await Buyer.create({
      name: "Demo Buyer",
      capPaise: 50000,
      spendPaise: 0,
      allowlistSkus: ["BREW-01", "LATTE-01"],
      allowlistMerchantIds: [merchant._id],
    }));

  const session = await Session.create({
    buyer: buyer._id,
    merchant: merchant._id,
    status: "open",
  });

  const intent = await mandateService.createIntent({
    session,
    buyer,
    merchantId: merchant._id,
  });

  const catalog = merchantAgentService.toAgentCatalog(
    await merchantAgentService.list(merchant._id)
  );

  return apiView.ok(
    res,
    apiView.session({ session, buyer, merchant, intent, catalog }),
    "Session opened",
    201
  );
});

exports.razorpayKey = asyncHandler(async (req, res) => {
  return apiView.ok(res, {
    key: razorpayService.publicKey(),
    fake: razorpayService.isFake(),
  });
});
