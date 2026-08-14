#!/usr/bin/env bash
# Shared, testable runtime selection for the isolated Playwright wrapper.
# No application or fixture data is inspected here.

resolve_playwright_chromium_executable() {
  local explicit="${PLAYWRIGHT_CHROMIUM_EXECUTABLE:-}"
  if [[ -n "$explicit" ]]; then
    if [[ ! -x "$explicit" ]]; then
      echo "PLAYWRIGHT_CHROMIUM_EXECUTABLE must name an executable browser binary." >&2
      return 1
    fi
    printf '%s' "$explicit"
    return 0
  fi

  local candidate
  for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done

  # An empty result deliberately lets Playwright use its managed browser when
  # available. It is never a URL and cannot redirect the isolated target.
  return 0
}
