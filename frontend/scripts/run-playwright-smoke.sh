#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE_PATH="${PLAYWRIGHT_SMOKE_FIXTURE_PATH:-$ROOT_DIR/.ralph/playwright-smoke-fixture.json}"

mkdir -p "$(dirname "$FIXTURE_PATH")"

DATABASE_URL="${DATABASE_URL:-sqlite:///$ROOT_DIR/data/chore_tracking.db}" \
  "$ROOT_DIR/.venv/bin/python" "$ROOT_DIR/backend/scripts/seed_playwright_smoke.py" >"$FIXTURE_PATH"

(
  cd "$ROOT_DIR/frontend"
  PLAYWRIGHT_SMOKE_FIXTURE_PATH="$FIXTURE_PATH" npx playwright test -c playwright.smoke.config.ts
)
