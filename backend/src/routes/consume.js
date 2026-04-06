const express = require("express");
const { getChannel, QUEUE } = require("../rabbitmq");

const router = express.Router();
const MAX_COUNT = 100;

router.get("/", async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count || "1", 10), MAX_COUNT);
    const channel = getChannel();
    const messages = [];

    for (let i = 0; i < count; i++) {
      const msg = await channel.get(QUEUE, { noAck: false });
      if (!msg) break;

      channel.ack(msg);
      messages.push({
        messageId: msg.properties.messageId,
        content: msg.content.toString(),
        timestamp: msg.properties.timestamp,
      });
    }

    res.json({ consumed: messages.length, messages });
  } catch (err) {
    console.error("Consume error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
