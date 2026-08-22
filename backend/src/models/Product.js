const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },
    sku: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    amountPaise: { type: Number, required: true, min: 1 },
    stock: { type: Number, required: true, min: 0 },
    category: { type: String, default: "general" },
    attackTag: { type: String, default: "" },
  },
  { timestamps: true }
);

productSchema.index({ merchant: 1, sku: 1 });

module.exports = mongoose.model("Product", productSchema);
