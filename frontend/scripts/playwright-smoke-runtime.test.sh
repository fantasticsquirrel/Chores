#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./playwright-smoke-runtime.sh
source "$SCRIPT_DIR/playwright-smoke-runtime.sh"

TEST_DIR="$(mktemp -d /tmp/family-manager-playwright-runtime-test-XXXXXX)"
cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_equals() {
  local actual="$1"
  local expected="$2"
  [[ "$actual" == "$expected" ]] || fail "expected '$expected', got '$actual'"
}

mkdir -p "$TEST_DIR/bin"
FAKE_CHROME="$TEST_DIR/bin/google-chrome"
printf '#!/usr/bin/env bash\nexit 0\n' > "$FAKE_CHROME"
chmod 700 "$FAKE_CHROME"

# An explicit executable has priority over PATH discovery.
EXPLICIT_CHROME="$TEST_DIR/explicit-chrome"
printf '#!/usr/bin/env bash\nexit 0\n' > "$EXPLICIT_CHROME"
chmod 700 "$EXPLICIT_CHROME"
assert_equals \
  "$(PLAYWRIGHT_CHROMIUM_EXECUTABLE="$EXPLICIT_CHROME" PATH="$TEST_DIR/bin:$PATH" resolve_playwright_chromium_executable)" \
  "$EXPLICIT_CHROME"

# A system Chrome fallback is available only when no explicit override exists.
assert_equals \
  "$(
    unset PLAYWRIGHT_CHROMIUM_EXECUTABLE
    PATH="$TEST_DIR/bin:$PATH"
    resolve_playwright_chromium_executable
  )" \
  "$FAKE_CHROME"

# An explicit path is fail-closed: a typo must not silently target another binary.
if PLAYWRIGHT_CHROMIUM_EXECUTABLE="$TEST_DIR/not-executable" resolve_playwright_chromium_executable >/dev/null 2>"$TEST_DIR/error"; then
  fail "a non-executable explicit Chromium path was accepted"
fi
grep -q "PLAYWRIGHT_CHROMIUM_EXECUTABLE" "$TEST_DIR/error" || fail "missing explicit Chromium error"

# No discovered browser is a valid empty result so Playwright can use its managed binary.
EMPTY_PATH="$TEST_DIR/empty"
mkdir -p "$EMPTY_PATH"
assert_equals "$(
  unset PLAYWRIGHT_CHROMIUM_EXECUTABLE
  PATH="$EMPTY_PATH"
  resolve_playwright_chromium_executable
)" ""

printf 'playwright smoke runtime helper tests passed\n'
