const buyerAgentService = require("../services/buyerAgentService");
const { asyncHandler, loadSession } = require("../middleware/errorHandler");
const apiView = require("../views/apiView");

exports.send = asyncHandler(async (req, res) => {
  const { sessionId, message } = req.body || {};
  if (!sessionId || !message) {
    return apiView.fail(res, "sessionId and message are required");
  }
  const session = await loadSession(sessionId);
  const data = await buyerAgentService.turn({ session, userText: message });
  return apiView.ok(res, data);
});

exports.history = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.sessionId);
  const messages = await buyerAgentService.history(session._id);
  return apiView.ok(res, messages);
});
