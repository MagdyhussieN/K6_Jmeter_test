/**
 * k6 AMQP Produce Load Test — direct AMQP via xk6-amqp, no HTTP.
 *
 * Each VU opens its own AMQP connection (once) and publishes one message
 * per iteration directly to RabbitMQ over AMQP (port 5672).
 *
 * Run (requires custom binary):
 *   ./k6/k6-amqp run --config k6/options/smoke.json k6/produce-test.js
 *   ./k6/k6-amqp run --config k6/options/load.json  k6/produce-test.js
 *
 * env:
 *   AMQP_URL  amqp://guest:guest@localhost:5672/
 */
import Amqp from "k6/x/amqp";
import Queue from "k6/x/amqp/queue";
import Exchange from "k6/x/amqp/exchange";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import exec from "k6/execution";

const AMQP_URL    = __ENV.AMQP_URL || "amqp://guest:guest@localhost:5672/";
const EXCHANGE    = "load-test-exchange";
const QUEUE_NAME  = "load-test-queue";
const ROUTING_KEY = "load-test";

const messagesPublished = new Counter("rabbitmq_messages_published");
const publishFailRate   = new Rate("rabbitmq_publish_failures");
const publishDuration   = new Trend("rabbitmq_publish_duration_ms", true);

// Per-VU connection map (module-level, shared across all VUs in xk6-amqp)
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
  // Declare topology once before VUs start (idempotent)
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

  console.log(`Topology ready: ${EXCHANGE} --[${ROUTING_KEY}]--> ${QUEUE_NAME}`);
}

export default function () {
  const connId = getConnId();

  const body = JSON.stringify({
    id: `vu${exec.vu.idInInstance}-iter${exec.scenario.iterationInTest}`,
    message: "k6-amqp-direct-produce",
    timestamp: Date.now(),
  });

  const start = Date.now();
  let ok = false;

  try {
    Amqp.publish({
      connection_id: connId,
      exchange: EXCHANGE,
      queue_name: ROUTING_KEY,    // NOTE: queue_name here is the routing key in Publish
      content_type: "application/json",
      persistent: true,
      body: body,
    });
    ok = true;
  } catch (e) {
    console.error(`VU${exec.vu.idInInstance} publish error: ${e}`);
  }

  const elapsed = Date.now() - start;

  check(ok, { "message published via AMQP": (v) => v === true });
  messagesPublished.add(1);
  publishFailRate.add(!ok);
  publishDuration.add(elapsed);
}

export function teardown() {
  // Uses most recent connection (connection_id 0 = last opened)
  const info = Queue.inspect(QUEUE_NAME);
  console.log(`Queue depth after test: ${JSON.stringify(info)}`);
}
