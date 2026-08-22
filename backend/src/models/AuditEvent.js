const mongoose = require("mongoose");

const auditEventSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    checkout: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Checkout",
    },
    actor: {
      type: String,
      enum: ["buyer_agent", "cashier", "merchant", "razorpay", "system", "eval"],
      required: true,
    },
    type: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditEventSchema.index({ session: 1, createdAt: -1 });
auditEventSchema.index({ checkout: 1, createdAt: -1 });

module.exports = mongoose.model("AuditEvent", auditEventSchema);
