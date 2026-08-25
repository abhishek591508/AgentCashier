const env = require("../config/env");

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_catalog",
      description: "Search the merchant catalog. Read-only. Does not move money.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search text, SKU, or category" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_quote",
      description:
        "Ask the cashier for a signed cart quote. Never invent prices. The cashier may refuse.",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string" },
          qty: { type: "number" },
        },
        required: ["sku"],
      },
    },
  },
];

exports.TOOLS = TOOLS;

exports.isConfigured = () => Boolean(env.llm.apiKey);

exports.complete = async ({ messages }) => {
  if (!env.llm.apiKey) {
    return null;
  }

  const response = await fetch(`${env.llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.llm.apiKey}`,
    },
    body: JSON.stringify({
      model: env.llm.model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM error ${response.status}: ${text.slice(0, 400)}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message || null;
};
