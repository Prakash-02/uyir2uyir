#!/usr/bin/env bash
# Post-deployment smoke test script for U2U backend on Cloud Run.
# Usage: ./infra/smoke_backend.sh <SERVICE_URL>
# Example: ./infra/smoke_backend.sh https://u2u-api-demo-xyz.a.run.app

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <SERVICE_URL>"
  echo "Example: $0 https://u2u-api-demo.a.run.app"
  exit 1
fi

SERVICE_URL="${1%/}"
# Mock auth token accepted in demo mode for automated checks
AUTH_HEADER='Authorization: Bearer mock:{"uid":"smoke-admin","role":"admin","env":"demo"}'

echo "================================================================="
echo "==> Running U2U Backend Smoke Test"
echo "    Target: ${SERVICE_URL}"
echo "================================================================="

# 1. Check GET /health (with /healthz fallback)
echo "==> [1/4] Checking GET /health..."
HEALTH_RESP=$(curl -sS -f "${SERVICE_URL}/health" 2>/dev/null || curl -sS -f "${SERVICE_URL}/healthz")
echo "    Response: ${HEALTH_RESP}"
if ! echo "${HEALTH_RESP}" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
  echo "[-] Health check failed: expected status 'ok'"
  exit 1
fi
echo "    ✓ Health check passed."

# 2. Check GET /config
echo "==> [2/4] Checking GET /config..."
CONFIG_RESP=$(curl -sS -f "${SERVICE_URL}/config")
echo "    Response: ${CONFIG_RESP}"
if ! echo "${CONFIG_RESP}" | grep -q '"dataMode"[[:space:]]*:[[:space:]]*"demo"'; then
  echo "❌ Config check failed: expected dataMode 'demo'"
  exit 1
fi
echo "    ✓ Config check passed."

# 3. Trigger demo story via POST /admin/scenario/story/run
echo "==> [3/4] Triggering demo story via POST /admin/scenario/story/run..."
STORY_RESP=$(curl -sS -f -X POST "${SERVICE_URL}/admin/scenario/story/run" \
  -H "Content-Type: application/json" \
  -H "${AUTH_HEADER}")
echo "    Response: ${STORY_RESP}"
if ! echo "${STORY_RESP}" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
  echo "❌ Failed to trigger demo story"
  exit 1
fi
echo "    ✓ Demo story triggered in background."

# 4. Poll until request reaches FULFILLED
echo "==> [4/4] Polling until sample request reaches FULFILLED..."
MAX_ATTEMPTS=45
ATTEMPT=1
IS_FULFILLED=0

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  # Poll public status of demo request req-sample-1
  STATUS_RESP=$(curl -sS "${SERVICE_URL}/requests/req-sample-1/status" || echo "")
  if echo "${STATUS_RESP}" | grep -q '"status"[[:space:]]*:[[:space:]]*"FULFILLED"'; then
    echo "    Attempt ${ATTEMPT}: Request req-sample-1 reached status FULFILLED!"
    IS_FULFILLED=1
    break
  else
    CURRENT_STATUS=$(echo "${STATUS_RESP}" | grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' || echo "waiting...")
    echo "    Attempt ${ATTEMPT}/${MAX_ATTEMPTS}: ${CURRENT_STATUS} (sleeping 2s...)"
  fi
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

if [ $IS_FULFILLED -ne 1 ]; then
  echo "⚠️ Warning: Story did not reach FULFILLED within timeout (${MAX_ATTEMPTS} attempts)."
fi

# Fetch and display final metrics
echo ""
echo "==> Fetching GET /metrics..."
METRICS_RESP=$(curl -sS -f "${SERVICE_URL}/metrics" -H "${AUTH_HEADER}")
echo "    Metrics: ${METRICS_RESP}"

echo ""
echo "================================================================="
echo "✅ Smoke test completed successfully!"
echo "================================================================="
