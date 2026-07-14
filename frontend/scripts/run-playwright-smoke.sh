#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/family-manager-playwright-XXXXXX)"
: > "$TMP_DIR/.family-manager-smoke"
FIXTURE_PATH="${PLAYWRIGHT_SMOKE_FIXTURE_PATH:-$TMP_DIR/playwright-smoke-fixture.json}"
DATABASE_PATH="$TMP_DIR/chore_tracking.db"
DATABASE_URL="sqlite:///$DATABASE_PATH"
PORT="${PLAYWRIGHT_SMOKE_PORT:-18501}"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID"
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$(dirname "$FIXTURE_PATH")"

(
  cd "$ROOT_DIR/frontend"
  npm run build
)

(
  cd "$ROOT_DIR/backend"
  APP_ENV=development \
  DATABASE_URL="$DATABASE_URL" \
  SECRET_KEY="playwright-isolated-secret-key-000000" \
  SESSION_COOKIE_SECURE=false \
    "$ROOT_DIR/.venv/bin/alembic" upgrade head
)

(
  cd "$ROOT_DIR/backend"
  APP_ENV=development \
  DATABASE_URL="$DATABASE_URL" \
  SECRET_KEY="playwright-isolated-secret-key-000000" \
  SESSION_COOKIE_SECURE=false \
  PLAYWRIGHT_ISOLATED_DB=1 \
    "$ROOT_DIR/.venv/bin/python" -m scripts.seed_playwright_smoke
) >"$FIXTURE_PATH"

APP_ENV=development \
DATABASE_URL="$DATABASE_URL" \
SECRET_KEY="playwright-isolated-secret-key-000000" \
SESSION_COOKIE_SECURE=false \
  "$ROOT_DIR/.venv/bin/uvicorn" app.main:app \
    --app-dir "$ROOT_DIR/backend" \
    --host 127.0.0.1 \
    --port "$PORT" >"$TMP_DIR/server.log" 2>&1 &
SERVER_PID=$!

ready=0
for _ in $(seq 1 40); do
  if curl --fail --silent "http://127.0.0.1:$PORT/chore-api/health/ready" >/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    break
  fi
  sleep 0.25
done
if [[ "$ready" -ne 1 ]]; then
  cat "$TMP_DIR/server.log" >&2
  exit 1
fi

if ! (
  cd "$ROOT_DIR/frontend"
  APP_ENV=development \
  DATABASE_URL="$DATABASE_URL" \
  PLAYWRIGHT_ISOLATED_DB=1 \
  PLAYWRIGHT_BASE_URL="http://127.0.0.1:$PORT" \
  PLAYWRIGHT_SMOKE_FIXTURE_PATH="$FIXTURE_PATH" \
    npx playwright test -c playwright.smoke.config.ts
); then
  cat "$TMP_DIR/server.log" >&2
  exit 1
fi
