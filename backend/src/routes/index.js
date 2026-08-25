const express = require("express");
const authController = require("../controllers/authController");
const catalogController = require("../controllers/catalogController");
const chatController = require("../controllers/chatController");
const checkoutController = require("../controllers/checkoutController");
const webhookController = require("../controllers/webhookController");
const auditController = require("../controllers/auditController");
const evalController = require("../controllers/evalController");

const router = express.Router();

router.post("/auth/start", authController.start);
router.get("/razorpay/key", authController.razorpayKey);

router.get("/catalog", catalogController.list);

router.post("/chat", chatController.send);
router.get("/chat/:sessionId", chatController.history);

router.post("/quotes", checkoutController.quote);
router.post("/checkout", checkoutController.create);
router.get("/checkout/:id", checkoutController.show);
router.post("/checkout/:id/verify", checkoutController.verify);
router.post("/checkout/:id/retry", checkoutController.retry);
router.post("/checkout/:id/fake", checkoutController.fake);

router.post("/webhooks/razorpay", webhookController.razorpay);

router.get("/audit/session/:sessionId", auditController.session);
router.get("/mandates/session/:sessionId", auditController.mandates);

router.post("/evals/run", evalController.run);
router.get("/evals/latest", evalController.latest);

module.exports = router;
