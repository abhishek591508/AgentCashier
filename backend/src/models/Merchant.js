const mongoose = require("mongoose");

const merchantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    city: { type: String, default: "Bengaluru" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Merchant", merchantSchema);
