/**
 * k6 AMQP Queue Monitor — direct AMQP via xk6-amqp, no HTTP.
 *
 * ⚠  WHY Amqp.listen() IS NOT USED HERE:
 *   xk6-amqp v0.4.1's Listen() fires the JS callback from a raw Go goroutine.
 *   Since k6 v0.42+, all JS execution must go through the VU's event loop.
 *   Calling a JS function from a goroutine that doesn't hold the event loop
 *   causes a panic — even with a single VU. This is a known bug in the
 *   deprecated xk6-amqp library.
 *
 *   For actual consume load testing use either:
 *     • JMeter + jmeter-amqp-plugin (AMQP Consumer sampler) — fully concurrent
 *     • The HTTP backend: GET http://localhost:3000/consume?count=N via standard k6
 *
 * What this script does instead:
 *   - Publishes messages per iteration (demonstrates working direct AMQP)
 *   - Inspects the queue each iteration to track depth growth
 *   - Provides a reference for the full xk6-amqp API
 *
 * Run (requires custom binary ./k6/k6-amqp):
 *   ./k6/k6-amqp run --config k6/options/smoke.json k6/consume-test.js
 *
 * env:
 *   AMQP_URL  amqp://guest:guest@localhost:5672/
 */
import Amqp from "k6/x/amqp";
import Queue from "k6/x/amqp/queue";
import Exchange from "k6/x/amqp/exchange";
import { check } from "k6";
import { Counter, Rate, Trend, Gauge } from "k6/metrics";
import exec from "k6/execution";

const AMQP_URL    = __ENV.AMQP_URL || "amqp://guest:guest@localhost:5672/";
const EXCHANGE    = "load-test-exchange";
const QUEUE_NAME  = "load-test-queue";
const ROUTING_KEY = "load-test";

const messagesPublished = new Counter("rabbitmq_messages_published");
const publishFailRate   = new Rate("rabbitmq_publish_failures");
const publishDuration   = new Trend("rabbitmq_publish_duration_ms", true);
const queueDepth        = new Gauge("rabbitmq_queue_depth");

const connIds = new Map();

function getConnId() {
  const vuId = exec.vu.idInInstance;
  if (!connIds.has(vuId)) {
    const id = Amqp.start({ connection_url: AMQP_URL });
    connIds.set(vuId, id);
  }
  return connIds.get(vuId);
}

export function setup() {
  const conn = Amqp.start({ connection_url: AMQP_URL });

  Exchange.declare({
    connection_id: conn,
    name: EXCHANGE,
    kind: "direct",
    durable: true,
    auto_delete: false,
    internal: false,
    no_wait: false,
    args: null,
  });

  Queue.declare({
    connection_id: conn,
    name: QUEUE_NAME,
    durable: true,
    delete_when_unused: false,
    exclusive: false,
    no_wait: false,
    args: { "x-message-ttl": 3600000, "x-max-length": 1000000 },
  });

  Queue.bind({
    connection_id: conn,
    queue_name: QUEUE_NAME,
    exchange_name: EXCHANGE,
    routing_key: ROUTING_KEY,
    no_wait: false,
    args: null,
  });

  // Purge any leftover messages from previous runs
  Queue.purge(QUEUE_NAME, false);
  console.log("Queue purged. Starting publish + depth monitoring test...");
}

export default function () {
  const connId = getConnId();

  // Publish a message
  const body = JSON.stringify({
    id: `vu${exec.vu.idInInstance}-iter${exec.scenario.iterationInTest}`,
    ts: Date.now(),
  });

  const start = Date.now();
  let ok = false;

  try {
    Amqp.publish({
      connection_id: connId,
      exchange: EXCHANGE,
      queue_name: ROUTING_KEY,
      content_type: "application/json",
      persistent: true,
      body: body,
    });
    ok = true;
  } catch (e) {
    console.error(`Publish error: ${e}`);
  }

  check(ok, { "published via AMQP": (v) => v === true });
  messagesPublished.add(1);
  publishFailRate.add(!ok);
  publishDuration.add(Date.now() - start);

  // Inspect queue depth — tracks accumulation over time
  const info = Queue.inspect(QUEUE_NAME);
  queueDepth.add(info.messages);
}

export function teardown() {
  const info = Queue.inspect(QUEUE_NAME);
  console.log(`Final queue depth: ${info.messages} messages`);
  console.log(
    "NOTE: Messages were NOT consumed. Run the HTTP backend consume endpoint or\n" +
    "      JMeter AMQP Consumer to drain the queue:\n" +
    "      curl 'http://localhost:3000/consume?count=100'"
  );
}
