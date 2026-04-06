#!/usr/bin/env bash
# Run k6 AMQP direct load tests (uses custom k6-amqp binary).
# Usage: ./scripts/run-k6.sh [scenario] [script]
#   scenario: smoke | load | stress   (default: load)
#   script:   produce | consume | combined  (default: combined)
#
# Environment variables:
#   AMQP_URL      - RabbitMQ AMQP URL (default: amqp://guest:guest@localhost:5672/)
#   PREFILL_COUNT - Messages to pre-fill for consume test (default: 5000)

set -euo pipefail

SCENARIO="${1:-load}"
SCRIPT_NAME="${2:-combined}"
AMQP_URL="${AMQP_URL:-amqp://guest:guest@localhost:5672/}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BINARY="${ROOT_DIR}/k6/k6-amqp"
OPTIONS_DIR="${ROOT_DIR}/k6/options"
SCRIPTS_DIR="${ROOT_DIR}/k6"

CONFIG_FILE="${OPTIONS_DIR}/${SCENARIO}.json"
SCRIPT_FILE="${SCRIPTS_DIR}/${SCRIPT_NAME}-test.js"

if [[ ! -f "$BINARY" ]]; then
  echo "ERROR: Custom k6 binary not found at ${BINARY}"
  echo "Build it with:"
  echo "  \$(go env GOPATH)/bin/xk6 build \\"
  echo "    --with github.com/grafana/xk6-amqp@latest \\"
  echo "    --output ./k6/k6-amqp"
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: Config not found: ${CONFIG_FILE}"
  echo "Valid scenarios: smoke, load, stress"
  exit 1
fi

if [[ ! -f "$SCRIPT_FILE" ]]; then
  echo "ERROR: Script not found: ${SCRIPT_FILE}"
  echo "Valid scripts: produce, consume, combined"
  exit 1
fi

echo "============================================"
echo "  k6 AMQP Direct Load Test"
echo "  Scenario : ${SCENARIO}"
echo "  Script   : ${SCRIPT_NAME}"
echo "  AMQP URL : ${AMQP_URL}"
echo "  Config   : ${CONFIG_FILE}"
echo "  Binary   : ${BINARY}"
echo "============================================"

"${BINARY}" run \
  --config "${CONFIG_FILE}" \
  --env AMQP_URL="${AMQP_URL}" \
  "${SCRIPT_FILE}"
