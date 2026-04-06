#!/usr/bin/env bash
# Run JMeter load test in non-GUI (CLI) mode.
# Usage: ./scripts/run-jmeter.sh [rabbitmq_host] [backend_host]
#
# Environment variables:
#   JMETER_HOME - JMeter installation directory (default: /opt/jmeter)
#   RABBITMQ_HOST - RabbitMQ hostname (default: localhost)
#   BACKEND_HOST  - Backend service hostname (default: localhost)

set -euo pipefail

JMETER_HOME="${JMETER_HOME:-/opt/jmeter}"
RABBITMQ_HOST="${RABBITMQ_HOST:-localhost}"
BACKEND_HOST="${BACKEND_HOST:-localhost}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEST_PLAN="${ROOT_DIR}/jmeter/test-plan.jmx"
RESULTS_DIR="${ROOT_DIR}/jmeter/results"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RESULT_FILE="${RESULTS_DIR}/results-${TIMESTAMP}.jtl"
REPORT_DIR="${RESULTS_DIR}/html-report-${TIMESTAMP}"

if [[ ! -f "${JMETER_HOME}/bin/jmeter" ]]; then
  echo "ERROR: JMeter not found at ${JMETER_HOME}/bin/jmeter"
  echo "Set JMETER_HOME environment variable or install JMeter."
  echo "Download: https://jmeter.apache.org/download_jmeter.cgi"
  exit 1
fi

mkdir -p "${RESULTS_DIR}"

echo "============================================"
echo "  JMeter Load Test"
echo "  Test Plan    : ${TEST_PLAN}"
echo "  RabbitMQ     : ${RABBITMQ_HOST}:5672"
echo "  Backend      : ${BACKEND_HOST}:3000"
echo "  Results      : ${RESULT_FILE}"
echo "  HTML Report  : ${REPORT_DIR}"
echo "============================================"

"${JMETER_HOME}/bin/jmeter" \
  -n \
  -t "${TEST_PLAN}" \
  -l "${RESULT_FILE}" \
  -e \
  -o "${REPORT_DIR}" \
  -JRABBITMQ_HOST="${RABBITMQ_HOST}" \
  -JBACKEND_HOST="${BACKEND_HOST}"

echo ""
echo "Test complete."
echo "Results : ${RESULT_FILE}"
echo "Report  : ${REPORT_DIR}/index.html"
