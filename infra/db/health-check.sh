#!/bin/bash

TIMEOUT=${1:-30}
INTERVAL=2
ELAPSED=0

DB_HOST=${DB_HOST_PRIMARY:-127.0.0.1}
DB_PORT=${DB_PORT:-5434}
DB_NAME=${DB_NAME:-church_task}
DB_USER=${DB_USERNAME:-postgres}

echo "Checking PostgreSQL health at $DB_HOST:$DB_PORT/$DB_NAME"

while [ $ELAPSED -lt $TIMEOUT ]; do
  if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q; then
      echo "PostgreSQL is ready"
      exit 0
    fi
  else
    if nc -z "$DB_HOST" "$DB_PORT" >/dev/null 2>&1; then
      echo "PostgreSQL port is accessible"
      exit 0
    fi
  fi

  echo "PostgreSQL not ready, waiting $INTERVAL seconds (${ELAPSED}s/${TIMEOUT}s)"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "PostgreSQL not ready after ${TIMEOUT} seconds"
exit 1
