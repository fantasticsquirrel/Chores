#!/usr/bin/env bash
set -euo pipefail

# The fixtures contain disposable credentials. Keep every artifact private even
# when an explicitly requested diagnostic retention leaves the directory behind.
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/family-manager-playwright-XXXXXX)"
chmod 700 "$TMP_DIR"
: > "$TMP_DIR/.family-manager-smoke"
FIXTURE_PATH="$TMP_DIR/playwright-smoke-fixture.json"
PASSWORD_RESET_FIXTURE_PATH="$TMP_DIR/password-reset-fixture.json"
DATABASE_PATH="$TMP_DIR/chore_tracking.db"
DATABASE_URL="sqlite:///$DATABASE_PATH"
SERVER_PID=""
KEEP_ARTIFACTS="${PLAYWRIGHT_SMOKE_KEEP_ARTIFACTS:-0}"
SMOKE_RUN_ID=""

if [[ "$KEEP_ARTIFACTS" != "0" && "$KEEP_ARTIFACTS" != "1" ]]; then
  echo "PLAYWRIGHT_SMOKE_KEEP_ARTIFACTS must be 0 or 1." >&2
  exit 1
fi

resolve_python_bin() {
  local candidate=""
  if [[ -n "${FAMILY_MANAGER_PYTHON_BIN:-}" ]]; then
    candidate="$FAMILY_MANAGER_PYTHON_BIN"
  elif [[ -n "${VIRTUAL_ENV:-}" ]] && [[ -x "$VIRTUAL_ENV/bin/python" ]]; then
    candidate="$VIRTUAL_ENV/bin/python"
  elif [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
    candidate="$ROOT_DIR/.venv/bin/python"
  elif command -v python3 >/dev/null 2>&1; then
    candidate="$(command -v python3)"
  elif command -v python >/dev/null 2>&1; then
    candidate="$(command -v python)"
  fi

  if [[ -z "$candidate" || ! -x "$candidate" ]]; then
    echo "A Python interpreter with the Family Manager backend dependencies is required." >&2
    echo "Set FAMILY_MANAGER_PYTHON_BIN or activate its virtualenv before running smoke." >&2
    exit 1
  fi
  printf '%s' "$candidate"
}

# CI uses its configured Python; worktree users can point this at the verified
# project venv without copying one into every worktree.
PYTHON_BIN="$(resolve_python_bin)"

# Prefer an explicitly configured browser, then a locally installed Chrome or
# Chromium. If neither exists, leave it unset for Playwright's managed browser.
# The helper is intentionally fail-closed for a bad explicit path.
# shellcheck source=./playwright-smoke-runtime.sh
source "$ROOT_DIR/frontend/scripts/playwright-smoke-runtime.sh"
PLAYWRIGHT_BROWSER_EXECUTABLE="$(resolve_playwright_chromium_executable)"

allocate_loopback_port() {
  "$PYTHON_BIN" - <<'PY'
import socket

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as socket_:
    socket_.bind(("127.0.0.1", 0))
    print(socket_.getsockname()[1])
PY
}

is_server_alive() {
  if [[ -z "$SERVER_PID" ]] || ! kill -0 "$SERVER_PID" 2>/dev/null; then
    return 1
  fi
  local process_state
  process_state="$(ps -o stat= -p "$SERVER_PID" 2>/dev/null || true)"
  [[ -n "$process_state" && "$process_state" != *Z* ]]
}

verify_ready_payload() {
  "$PYTHON_BIN" -c '
import json
import sys

expected = sys.argv[1]
try:
    payload = json.load(sys.stdin)
except (TypeError, ValueError):
    raise SystemExit(1)
raise SystemExit(0 if isinstance(payload, dict) and payload.get("status") == "ok" and payload.get("playwright_smoke_run_id") == expected else 1)
' "$SMOKE_RUN_ID"
}

cleanup() {
  if is_server_alive; then
    kill "$SERVER_PID"
    for _ in $(seq 1 20); do
      if ! is_server_alive; then
        break
      fi
      sleep 0.1
    done
    if is_server_alive; then
      kill -KILL "$SERVER_PID" 2>/dev/null || true
    fi
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ "$KEEP_ARTIFACTS" == "1" ]]; then
    printf 'Retained isolated Playwright artifacts: %s\n' "$TMP_DIR" >&2
  else
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT INT TERM

PORT="$(allocate_loopback_port)"
SMOKE_RUN_ID="$("$PYTHON_BIN" - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
)"
if [[ ! "$SMOKE_RUN_ID" =~ ^[A-Za-z0-9_-]{32,128}$ ]]; then
  echo "Failed to create a valid isolated Playwright run nonce." >&2
  exit 1
fi

(
  cd "$ROOT_DIR/frontend"
  # The production bundle normally accepts only the deployed HTTPS origin. The
  # disposable loopback build receives its wrapper-owned origin explicitly, so
  # it exercises the same foreign-origin rejection rather than weakening it.
  VITE_PASSWORD_RESET_TRUSTED_ORIGIN="http://127.0.0.1:$PORT" npm run build
)

(
  cd "$ROOT_DIR/backend"
  APP_ENV=development \
  DATABASE_URL="$DATABASE_URL" \
  SECRET_KEY="playwright-isolated-secret-key-000000" \
  SESSION_COOKIE_SECURE=false \
    "$PYTHON_BIN" -m alembic upgrade head
)

(
  cd "$ROOT_DIR/backend"
  APP_ENV=development \
  DATABASE_URL="$DATABASE_URL" \
  SECRET_KEY="playwright-isolated-secret-key-000000" \
  SESSION_COOKIE_SECURE=false \
  PLAYWRIGHT_ISOLATED_DB=1 \
    "$PYTHON_BIN" -m scripts.seed_playwright_smoke
) >"$FIXTURE_PATH"

(
  cd "$ROOT_DIR/backend"
  APP_ENV=development \
  DATABASE_URL="$DATABASE_URL" \
  SECRET_KEY="playwright-isolated-secret-key-000000" \
  SESSION_COOKIE_SECURE=false \
  PASSWORD_RESET_ENABLED=true \
  PASSWORD_RESET_PUBLIC_APP_URL="https://family.multihost.ing/chore" \
  PASSWORD_RESET_FROM_ADDRESS="no-reply@family.multihost.ing" \
  PASSWORD_RESET_SENDMAIL_PATH="/bin/true" \
  PLAYWRIGHT_ISOLATED_DB=1 \
    "$PYTHON_BIN" -m scripts.seed_playwright_password_reset
) >"$PASSWORD_RESET_FIXTURE_PATH"

APP_ENV=development \
DATABASE_URL="$DATABASE_URL" \
SECRET_KEY="playwright-isolated-secret-key-000000" \
SESSION_COOKIE_SECURE=false \
PASSWORD_RESET_ENABLED=true \
PASSWORD_RESET_PUBLIC_APP_URL="https://family.multihost.ing/chore" \
PASSWORD_RESET_FROM_ADDRESS="no-reply@family.multihost.ing" \
PASSWORD_RESET_SENDMAIL_PATH="/bin/true" \
PLAYWRIGHT_ISOLATED_DB=1 \
PLAYWRIGHT_SMOKE_RUN_ID="$SMOKE_RUN_ID" \
  "$PYTHON_BIN" -m uvicorn app.main:app \
    --app-dir "$ROOT_DIR/backend" \
    --host 127.0.0.1 \
    --port "$PORT" >"$TMP_DIR/server.log" 2>&1 &
SERVER_PID=$!

ready=0
for _ in $(seq 1 80); do
  if ! is_server_alive; then
    break
  fi
  if ready_payload="$(curl --fail --silent --show-error --max-time 2 "http://127.0.0.1:$PORT/chore-api/health/ready" 2>/dev/null)" \
    && printf '%s' "$ready_payload" | verify_ready_payload \
    && is_server_alive; then
    ready=1
    break
  fi
  sleep 0.25
done
if [[ "$ready" -ne 1 ]]; then
  echo "Refusing to run browser smoke: the wrapper-owned backend did not prove readiness ownership." >&2
  cat "$TMP_DIR/server.log" >&2
  exit 1
fi

if ! (
  cd "$ROOT_DIR/frontend"
  APP_ENV=development \
  DATABASE_URL="$DATABASE_URL" \
  SECRET_KEY="playwright-isolated-secret-key-000000" \
  SESSION_COOKIE_SECURE=false \
  PASSWORD_RESET_ENABLED=true \
  PASSWORD_RESET_PUBLIC_APP_URL="https://family.multihost.ing/chore" \
  PASSWORD_RESET_FROM_ADDRESS="no-reply@family.multihost.ing" \
  PASSWORD_RESET_SENDMAIL_PATH="/bin/true" \
  PLAYWRIGHT_ISOLATED_DB=1 \
  PLAYWRIGHT_SMOKE_RUN_ID="$SMOKE_RUN_ID" \
  PLAYWRIGHT_SMOKE_DIR="$TMP_DIR" \
  PLAYWRIGHT_BACKEND_PYTHON="$PYTHON_BIN" \
  PLAYWRIGHT_BASE_URL="http://127.0.0.1:$PORT" \
  PLAYWRIGHT_SMOKE_FIXTURE_PATH="$FIXTURE_PATH" \
  PLAYWRIGHT_PASSWORD_RESET_FIXTURE_PATH="$PASSWORD_RESET_FIXTURE_PATH" \
  PLAYWRIGHT_CHROMIUM_EXECUTABLE="$PLAYWRIGHT_BROWSER_EXECUTABLE" \
    npx playwright test -c playwright.smoke.config.ts e2e/smoke.spec.ts
); then
  cat "$TMP_DIR/server.log" >&2
  exit 1
fi
