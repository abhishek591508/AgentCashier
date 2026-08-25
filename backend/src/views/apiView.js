exports.ok = (res, data, message = "OK", status = 200) => {
  return res.status(status).json({ success: true, message, data });
};

exports.fail = (res, message, status = 400, extra = {}) => {
  return res.status(status).json({ success: false, message, ...extra });
};

exports.session = ({ session, buyer, merchant, intent, catalog }) => ({
  sessionId: session._id,
  buyer: {
    id: buyer._id,
    name: buyer.name,
    capPaise: buyer.capPaise,
    spendPaise: buyer.spendPaise,
    remainingPaise: Math.max(0, buyer.capPaise - buyer.spendPaise),
    allowlistSkus: buyer.allowlistSkus,
  },
  merchant: {
    id: merchant._id,
    name: merchant.name,
    city: merchant.city,
  },
  intent,
  catalog,
});

exports.checkout = ({ checkout, attempts }) => ({
  checkout,
  attempts,
});

exports.evalRun = (run) => ({
  id: run._id,
  passed: run.passed,
  failed: run.failed,
  total: run.total,
  cases: run.cases,
  createdAt: run.createdAt,
});
