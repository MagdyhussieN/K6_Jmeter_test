# JMeter vs k6 for RabbitMQ Load Testing — Review

## Project Setup

This project tests a RabbitMQ broker using two load testing tools:

- **JMeter** — tests RabbitMQ directly over AMQP (port 5672) using the `jmeter-amqp` plugin
- **k6** — tests via the Node.js HTTP backend (port 3000) which bridges HTTP → AMQP

```
JMeter ──── AMQP (port 5672) ──────────────────► RabbitMQ
k6     ──── HTTP (port 3000) ──► Node.js backend ──► RabbitMQ
```

---

## Tool Comparison

| Dimension | JMeter | k6 |
|---|---|---|
| **Language** | Java (GUI + XML plans) | JavaScript (ES6+) |
| **AMQP support** | Yes — via `jmeter-amqp` plugin | No native; requires custom binary (`xk6-amqp`) |
| **Protocol tested** | AMQP 0-9-1 directly | HTTP (wraps AMQP via backend) |
| **Scripting** | XML test plans (GUI-driven) | Code-first, version control friendly |
| **Resource usage** | High (JVM, ~200–500MB) | Low (Go runtime, ~20–50MB) |
| **Distributed testing** | Yes (controller + remote agents) | Yes (k6 cloud or OSS k6-operator) |
| **Real-time metrics** | JMeter Plugins (PerfMon, jp@gc) | Built-in, push to Grafana/InfluxDB |
| **CI/CD integration** | Moderate (CLI mode available) | Excellent (single binary, JSON output) |
| **Learning curve** | Medium (GUI helps but XML is verbose) | Low (JS developers) / Medium (AMQP concepts) |
| **Assertions** | GUI-based (Response Assertion, JSONPath) | Code-based (`check()` functions) |
| **Custom metrics** | Limited in standard edition | First-class (`Counter`, `Rate`, `Trend`) |
| **Reporting** | HTML report + `.jtl` files | Terminal summary + JSON export |
| **Open source** | Yes (Apache 2.0) | Yes (AGPL-3.0) |

---

## What Each Tool Actually Tests

### JMeter (with AMQP plugin)
- Connects directly on port 5672 — **pure AMQP protocol test**
- Measures: message publish rate, broker acknowledgment latency, channel throughput
- No backend overhead — results reflect RabbitMQ's raw capacity
- **Best for**: answering "how many msg/s can RabbitMQ handle at X concurrency?"

### k6 (via HTTP backend)
- Tests the **full stack**: HTTP parsing → Node.js → amqplib → RabbitMQ
- Measures: end-to-end request latency including backend processing time
- HTTP overhead adds ~5–20ms per operation vs pure AMQP
- **Best for**: answering "how does our service perform under real user-like load?"

---

## Running the Tests

### Start infrastructure
```bash
docker compose up -d
# RabbitMQ management UI: http://localhost:15672 (guest/guest)
# Backend health: http://localhost:3000/health
```

### Quick smoke test (manual)
```bash
# Produce a message
curl -X POST http://localhost:3000/produce \
  -H "Content-Type: application/json" \
  -d '{"message": "hello rabbitmq", "count": 1}'

# Consume it back
curl http://localhost:3000/consume?count=1
```

### k6 tests
```bash
# Install k6: https://k6.io/docs/getting-started/installation/

# Smoke test (1 VU, 30s)
./scripts/run-k6.sh smoke combined

# Load test (50 VUs, ramp up 30s → sustain 2m → ramp down)
./scripts/run-k6.sh load combined

# Produce-only stress test
./scripts/run-k6.sh stress produce

# Custom scenario
k6 run --config k6/options/load.json \
  --env BASE_URL=http://localhost:3000 \
  k6/combined-test.js
```

### JMeter tests
```bash
# Install JMeter + AMQP plugin (see jmeter/plugins/README.md)

# CLI run
./scripts/run-jmeter.sh

# With custom hosts
RABBITMQ_HOST=localhost BACKEND_HOST=localhost ./scripts/run-jmeter.sh

# Open in GUI for inspection
$JMETER_HOME/bin/jmeter -t jmeter/test-plan.jmx
```

---

## Key Metrics to Watch

### In RabbitMQ Management UI (http://localhost:15672)
| Metric | Where | Healthy Range |
|---|---|---|
| Message rate (publish) | Overview → Message rates | Stable, no sudden drops |
| Message rate (deliver) | Overview → Message rates | Should match publish rate |
| Queue depth | Queues → load-test-queue | Should not grow unboundedly |
| Memory usage | Overview → Node → Memory | Below 40% to avoid paging |
| File descriptors | Overview → Node | Below 80% of limit |
| Unacked messages | Queues → load-test-queue | Low — high means consumers are slow |

### In k6 output
| Metric | Description |
|---|---|
| `http_req_duration` | Full request latency (network + backend + AMQP) |
| `rabbitmq_messages_published` | Total messages published counter |
| `rabbitmq_messages_consumed` | Total messages consumed counter |
| `rabbitmq_publish_failures` | Failure rate for produce requests |
| `rabbitmq_publish_duration_ms` | p50/p95/p99 publish latency |

### In JMeter report
| Metric | Description |
|---|---|
| Throughput (req/s) | Samples per second — proxy for msg/s |
| Average / p90 / p95 | Latency percentiles in ms |
| Error % | Assertion failures or connection errors |
| Connect Time | TCP + TLS handshake time |

---

## Test Results Template

Fill in after running tests:

### Environment
- RabbitMQ version: `3.12.x`
- Machine: (cores, RAM)
- Docker resources: (CPU limit, memory limit)

### k6 Results

| Scenario | VUs | Duration | Publish req/s | p95 latency | Error rate | Queue depth peak |
|---|---|---|---|---|---|---|
| Smoke (combined) | 1 | 30s | | | | |
| Load (combined) | 50 | 3m | | | | |
| Stress (produce) | 400 | 4.5m | | | | |

### JMeter Results

| Thread Group | Threads | Loops | Throughput | p95 (ms) | Error % |
|---|---|---|---|---|---|
| AMQP Publisher | 50 | 100 | | | |
| AMQP Consumer | 10 | 50 | | | |
| HTTP Backend Produce | 50 | 100 | | | |

---

## When to Choose Each Tool

### Choose JMeter if:
- You need **pure AMQP protocol-level** load testing without HTTP overhead
- Your team already uses JMeter for other services and wants a unified dashboard
- You need complex conditional test flows (if/while logic, CSV parameterization)
- You want a visual GUI for building and debugging test plans
- You need to test against RabbitMQ directly without deploying a backend service

### Choose k6 if:
- You prefer **code-first** tests that live in version control alongside application code
- You want tight **CI/CD integration** (single binary, exit codes, JSON output)
- Your service happens to expose HTTP endpoints that interact with RabbitMQ internally
- You want **custom metrics** with fine-grained naming and rich threshold expressions
- Your team is comfortable with JavaScript

### The Honest Trade-off for RabbitMQ
k6 does **not** support AMQP natively without building a custom binary with `xk6-amqp`.
If your goal is specifically to stress-test the **broker** (not the full stack), JMeter
with the AMQP plugin gives you direct protocol access with less indirection.

If your goal is to understand how your **application** behaves under load while using
RabbitMQ, k6 via HTTP is the more representative and easier-to-maintain choice.

---

## Common Issues & Solutions

### Queue grows without bound during publish-only tests
- Add consumers or enable `x-max-length` on the queue (already set to 1M in this project)
- Monitor queue depth in management UI during test

### RabbitMQ memory alarm triggers mid-test
- Increase Docker memory limit (4GB+ recommended for heavy tests)
- Use `x-message-ttl` to expire unconsumed messages (set to 1h in this project)
- Reduce message size or publish rate

### k6 shows high latency but RabbitMQ management shows low rates
- The backend is the bottleneck — scale channel pool (`CHANNEL_POOL_SIZE`)
- Check backend container CPU/memory limits in docker-compose

### JMeter AMQP plugin: `ClassNotFoundException`
- Both `jmeter-amqp-plugin.jar` AND `amqp-client.jar` must be in `$JMETER_HOME/lib/ext/`
- Restart JMeter completely after adding jars

### amqplib channel errors under high load
- The channel pool auto-replaces failed channels (see `rabbitmq.js:replaceChannel`)
- If errors persist, reduce concurrent VUs or increase pool size
