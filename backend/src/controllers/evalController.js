const evalService = require("../services/evalService");
const { asyncHandler } = require("../middleware/errorHandler");
const apiView = require("../views/apiView");

exports.run = asyncHandler(async (req, res) => {
  const run = await evalService.run();
  return apiView.ok(res, apiView.evalRun(run), "Eval suite finished");
});

exports.latest = asyncHandler(async (req, res) => {
  const run = await evalService.latest();
  if (!run) {
    return apiView.ok(res, null, "No eval runs yet");
  }
  return apiView.ok(res, apiView.evalRun(run));
});
