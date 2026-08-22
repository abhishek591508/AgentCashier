require("dotenv").config();

const required = ["MONGODB_URL"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env: ${key}`);
  }
}

const fakePayments =
  String(process.env.DEV_FAKE_PAYMENTS).toLowerCase() === "true" ||
  !process.env.RAZORPAY_KEY_ID ||
  process.env.RAZORPAY_KEY_ID.includes("xxxxxxxx");

const provider = String(process.env.LLM_PROVIDER || "openai").toLowerCase();

const groqLlm = {
  provider: "groq",
  apiKey: process.env.GROQ_API_KEY || process.env.LLM_API_KEY || "",
  baseUrl: "https://api.groq.com/openai/v1",
  model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
};

const openaiLlm = {
  provider: "openai",
  apiKey: process.env.LLM_API_KEY || "",
  baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
  model: process.env.LLM_MODEL || "gpt-4o-mini",
};

module.exports = {
  port: Number(process.env.PORT) || 4000,
  mongoUrl: process.env.MONGODB_URL,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  },
  mandateSecret: process.env.MANDATE_SECRET || "dev-mandate-secret",
  llm: provider === "groq" ? groqLlm : openaiLlm,
  fakePayments,
};
