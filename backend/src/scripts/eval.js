require("dotenv").config();

const run = async () => {
  const port = process.env.PORT || 4000;
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/evals/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const json = await response.json();
  console.log(JSON.stringify(json, null, 2));
  if (!json.success || json.data?.failed) {
    process.exit(1);
  }
};

run().catch((error) => {
  console.error(error);
  console.error("Start the API first: npm run dev --prefix backend");
  process.exit(1);
});
