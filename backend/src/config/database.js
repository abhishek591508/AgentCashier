const mongoose = require("mongoose");
const env = require("./env");

exports.connect = async () => {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUrl);
  console.log("MongoDB connected");
};
