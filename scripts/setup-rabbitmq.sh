#!/usr/bin/env bash
# Declares RabbitMQ exchange, queue, and binding via Management API.
# Run this after RabbitMQ starts if you want to test without the backend.
# Usage: ./scripts/setup-rabbitmq.sh [host] [port] [user] [pass]

set -euo pipefail

HOST="${1:-localhost}"
PORT="${2:-15672}"
USER="${3:-guest}"
PASS="${4:-guest}"
VHOST="%2F"  # URL-encoded "/"

BASE="http://${HOST}:${PORT}/api"

echo "Setting up RabbitMQ topology on ${HOST}:${PORT}..."

# Declare exchange
echo "  -> Declaring exchange: load-test-exchange"
curl -sf -u "${USER}:${PASS}" \
  -X PUT "${BASE}/exchanges/${VHOST}/load-test-exchange" \
  -H "Content-Type: application/json" \
  -d '{"type":"direct","durable":true,"auto_delete":false}' \
  > /dev/null

# Declare queue
echo "  -> Declaring queue: load-test-queue"
curl -sf -u "${USER}:${PASS}" \
  -X PUT "${BASE}/queues/${VHOST}/load-test-queue" \
  -H "Content-Type: application/json" \
  -d '{
    "durable": true,
    "auto_delete": false,
    "arguments": {
      "x-message-ttl": 3600000,
      "x-max-length": 1000000
    }
  }' \
  > /dev/null

# Bind queue to exchange
echo "  -> Binding queue to exchange with key: load-test"
curl -sf -u "${USER}:${PASS}" \
  -X POST "${BASE}/bindings/${VHOST}/e/load-test-exchange/q/load-test-queue" \
  -H "Content-Type: application/json" \
  -d '{"routing_key":"load-test","arguments":{}}' \
  > /dev/null

echo "Done. Topology:"
echo "  Exchange : load-test-exchange (direct, durable)"
echo "  Queue    : load-test-queue (durable, ttl=1h, max=1M)"
echo "  Binding  : load-test-exchange --[load-test]--> load-test-queue"
echo ""
echo "Management UI: http://${HOST}:${PORT}  (${USER}/${PASS})"
