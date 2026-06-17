#!/bin/bash

TIMEOUT=${1:-30}
INTERVAL=2
ELAPSED=0
ZERO_URL=${VITE_ZERO_CACHE_URL:-http://127.0.0.1:4848}
ZERO_ADMIN_PASSWORD=${ZERO_ADMIN_PASSWORD:-church-task-dev-zero-admin-password}

echo "Checking Zero health at $ZERO_URL/statz"

while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -fsS -u "zero:$ZERO_ADMIN_PASSWORD" "$ZERO_URL/statz" >/dev/null 2>&1; then
    echo "Zero is ready"
    exit 0
  fi

  echo "Zero not ready, waiting $INTERVAL seconds (${ELAPSED}s/${TIMEOUT}s)"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "Zero not ready after ${TIMEOUT} seconds"
exit 1
