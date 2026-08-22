const Product = require("../models/Product");

exports.list = async (merchantId) => {
  return Product.find({ merchant: merchantId }).sort({ amountPaise: 1 });
};

exports.search = async (merchantId, query) => {
  const q = String(query || "").trim();
  if (!q) {
    return exports.list(merchantId);
  }
  return Product.find({
    merchant: merchantId,
    $or: [
      { name: new RegExp(q, "i") },
      { sku: new RegExp(q, "i") },
      { description: new RegExp(q, "i") },
      { category: new RegExp(q, "i") },
    ],
  }).limit(12);
};

exports.getBySku = async (sku) => {
  return Product.findOne({ sku });
};

exports.toAgentCatalog = (products) => {
  return products.map((product) => ({
    sku: product.sku,
    name: product.name,
    description: product.description,
    amountPaise: product.amountPaise,
    amountInr: (product.amountPaise / 100).toFixed(2),
    stock: product.stock,
    category: product.category,
  }));
};
