const express = require("express");
const { connect } = require("./rabbitmq");
const produceRouter = require("./routes/produce");
const consumeRouter = require("./routes/consume");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.use("/produce", produceRouter);
app.use("/consume", consumeRouter);

async function start() {
  await connect();
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

module.exports = app;
