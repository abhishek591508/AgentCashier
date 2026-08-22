const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "tool", "system"],
      required: true,
    },
    content: { type: String, default: "" },
    toolName: { type: String, default: "" },
    toolPayload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ session: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
