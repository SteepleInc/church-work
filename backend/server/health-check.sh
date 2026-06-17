#!/bin/bash

TIMEOUT=${1:-30}
INTERVAL=2
ELAPSED=0
API_URL=${CHURCH_TASK_DEV_API_URL:-http://127.0.0.1:2003}

echo "Checking Church Task API health at $API_URL/healthz"

while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -fsS "$API_URL/healthz" >/dev/null 2>&1; then
    echo "Church Task API is ready"
    exit 0
  fi

  echo "Church Task API not ready, waiting $INTERVAL seconds (${ELAPSED}s/${TIMEOUT}s)"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "Church Task API not ready after ${TIMEOUT} seconds"
exit 1
