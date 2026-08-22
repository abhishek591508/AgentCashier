const mongoose = require("mongoose");

const buyerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    capPaise: { type: Number, required: true, min: 0 },
    spendPaise: { type: Number, default: 0, min: 0 },
    allowlistSkus: { type: [String], default: [] },
    allowlistMerchantIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
  },
  { timestamps: true }
);

buyerSchema.virtual("remainingPaise").get(function remainingPaise() {
  return Math.max(0, this.capPaise - this.spendPaise);
});

module.exports = mongoose.model("Buyer", buyerSchema);
