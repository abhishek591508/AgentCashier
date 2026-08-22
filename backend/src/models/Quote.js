const mongoose = require("mongoose");

const quoteSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    mandate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mandate",
      required: true,
    },
    sku: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    amountPaise: { type: Number, required: true },
    catalogHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["open", "consumed", "expired", "blocked"],
      default: "open",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quote", quoteSchema);
