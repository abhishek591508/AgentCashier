const mongoose = require("mongoose");

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    event: { type: String, required: true },
    paymentId: { type: String, default: "" },
    orderId: { type: String, default: "" },
    duplicate: { type: Boolean, default: false },
    processed: { type: Boolean, default: false },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WebhookEvent", webhookEventSchema);
