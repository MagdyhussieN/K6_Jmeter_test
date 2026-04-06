const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const POOL_SIZE = parseInt(process.env.CHANNEL_POOL_SIZE || "10", 10);
const MAX_RETRIES = 5;

const EXCHANGE = "load-test-exchange";
const QUEUE = "load-test-queue";
const ROUTING_KEY = "load-test";

let connection = null;
let channels = [];
let channelIndex = 0;
let retryCount = 0;

async function connect() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    console.log("Connected to RabbitMQ");
    retryCount = 0;

    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err.message);
      reconnect();
    });

    connection.on("close", () => {
      console.warn("RabbitMQ connection closed, reconnecting...");
      reconnect();
    });

    await initChannelPool();
    await declareTopology();
  } catch (err) {
    console.error("Failed to connect to RabbitMQ:", err.message);
    await reconnect();
  }
}

async function initChannelPool() {
  channels = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const ch = await connection.createChannel();
    ch.on("error", (err) => {
      console.error(`Channel ${i} error:`, err.message);
      replaceChannel(i);
    });
    channels.push(ch);
  }
  console.log(`Channel pool initialized with ${POOL_SIZE} channels`);
}

async function replaceChannel(index) {
  try {
    const ch = await connection.createChannel();
    ch.on("error", (err) => {
      console.error(`Channel ${index} error:`, err.message);
      replaceChannel(index);
    });
    channels[index] = ch;
  } catch (err) {
    console.error(`Failed to replace channel ${index}:`, err.message);
  }
}

async function declareTopology() {
  const ch = channels[0];
  await ch.assertExchange(EXCHANGE, "direct", { durable: true });
  await ch.assertQueue(QUEUE, {
    durable: true,
    arguments: {
      "x-message-ttl": 3600000,
      "x-max-length": 1000000,
    },
  });
  await ch.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
  console.log(`Topology declared: exchange=${EXCHANGE}, queue=${QUEUE}, key=${ROUTING_KEY}`);
}

async function reconnect() {
  if (retryCount >= MAX_RETRIES) {
    console.error("Max reconnect retries reached. Exiting.");
    process.exit(1);
  }
  const delay = Math.pow(2, retryCount) * 1000;
  retryCount++;
  console.log(`Reconnecting in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})...`);
  await new Promise((r) => setTimeout(r, delay));
  await connect();
}

function getChannel() {
  if (channels.length === 0) throw new Error("Channel pool not initialized");
  const ch = channels[channelIndex % channels.length];
  channelIndex++;
  return ch;
}

module.exports = { connect, getChannel, EXCHANGE, QUEUE, ROUTING_KEY };
