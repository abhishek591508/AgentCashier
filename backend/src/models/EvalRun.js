const mongoose = require("mongoose");

const evalRunSchema = new mongoose.Schema(
  {
    passed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    cases: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EvalRun", evalRunSchema);
