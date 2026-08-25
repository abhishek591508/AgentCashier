const merchantAgentService = require("../services/merchantAgentService");
const { asyncHandler, loadSession } = require("../middleware/errorHandler");
const apiView = require("../views/apiView");

exports.list = asyncHandler(async (req, res) => {
  const session = await loadSession(req.query.sessionId);
  const products = await merchantAgentService.list(session.merchant);
  return apiView.ok(res, merchantAgentService.toAgentCatalog(products));
});
