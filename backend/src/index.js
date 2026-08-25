const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const { connect } = require("./config/database");
const routes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

connect().catch((error) => {
  console.error(error);
  process.exit(1);
});

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AgentCashier API is running",
    track: "01 AI Growth & Agentic Commerce",
  });
});

app.use("/api/v1", routes);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`AgentCashier API listening on ${env.port}`);
  console.log(`Mongo ${env.mongoUrl}`);
});

