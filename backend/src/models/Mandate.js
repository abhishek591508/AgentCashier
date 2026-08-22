const mongoose = require("mongoose");

const mandateSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["intent", "cart", "payment"],
      required: true,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buyer",
      required: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    signature: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "consumed", "blocked", "expired"],
      default: "active",
    },
  },
  { timestamps: true }
);

mandateSchema.index({ session: 1, kind: 1, createdAt: -1 });

module.exports = mongoose.model("Mandate", mandateSchema);
