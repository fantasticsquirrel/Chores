#!/usr/bin/env bash
# Audit the mobile application's install-time runtime dependency graph.
# Expo SDK 56 currently carries a reviewed, pinned Metro/image-size advisory
# chain. Do not remove the verifier: it rejects every changed package, graph,
# severity, or advisory source instead of silencing npm audit.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUDIT_OUTPUT="$(mktemp)"
cleanup() {
  rm -f "$AUDIT_OUTPUT"
}
trap cleanup EXIT

set +e
(
  cd "$ROOT_DIR"
  npm audit --workspace mobile --omit=dev --audit-level=high --json
) >"$AUDIT_OUTPUT"
audit_status=$?
set -e

# npm exits 1 when it found a high-severity advisory. The verifier may accept
# only the exact reviewed Expo/Metro chain; invalid JSON/network errors fail.
if [[ "$audit_status" -ne 0 && "$audit_status" -ne 1 ]]; then
  cat "$AUDIT_OUTPUT" >&2
  printf 'npm audit exited unexpectedly with status %s.\n' "$audit_status" >&2
  exit "$audit_status"
fi

node "$ROOT_DIR/scripts/verify-mobile-build-toolchain-audit.mjs" "$AUDIT_OUTPUT"
