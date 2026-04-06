const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { getChannel, EXCHANGE, ROUTING_KEY } = require("../rabbitmq");

const router = express.Router();
const MAX_COUNT = 1000;

router.post("/", (req, res) => {
  try {
    const { message = "load-test-message", count = 1 } = req.body;
    const publishCount = Math.min(parseInt(count, 10) || 1, MAX_COUNT);
    const messageIds = [];

    const channel = getChannel();

    for (let i = 0; i < publishCount; i++) {
      const messageId = uuidv4();
      const payload = JSON.stringify({
        id: messageId,
        message,
        timestamp: Date.now(),
        index: i,
      });

      channel.publish(EXCHANGE, ROUTING_KEY, Buffer.from(payload), {
        persistent: true,
        messageId,
        contentType: "application/json",
        timestamp: Math.floor(Date.now() / 1000),
      });

      messageIds.push(messageId);
    }

    res.json({ published: publishCount, messageIds });
  } catch (err) {
    console.error("Produce error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
