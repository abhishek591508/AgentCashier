const mongoose = require("mongoose");

const CHECKOUT_STATES = [
  "quoted",
  "checkout_created",
  "authorized",
  "captured",
  "failed",
  "expired",
  "blocked",
];

const checkoutSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    quote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quote",
      required: true,
    },
    paymentMandate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mandate",
    },
    sku: { type: String, required: true },
    amountPaise: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: CHECKOUT_STATES,
      default: "quoted",
    },
    idempotencyKey: { type: String, required: true, unique: true },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    lastError: { type: String, default: "" },
    failureCode: { type: String, default: "" },
  },
  { timestamps: true }
);

checkoutSchema.statics.STATES = CHECKOUT_STATES;

module.exports = mongoose.model("Checkout", checkoutSchema);
