#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  cat >&2 <<'USAGE'
Usage:
  npm run mobile:eas:set-api -- https://YOUR_DOMAIN/chore-api

Sets EXPO_PUBLIC_API_BASE_URL in the EAS preview environment used by
the Android APK profile.
USAGE
  exit 2
fi

api_base_url="$1"

if [[ ! "$api_base_url" =~ ^https://.+/chore-api/?$ ]]; then
  cat >&2 <<'ERROR'
EXPO_PUBLIC_API_BASE_URL must be an HTTPS URL ending in /chore-api.
Example: https://family.example.com/chore-api
ERROR
  exit 2
fi

if [[ "$api_base_url" =~ YOUR_|example\.com ]]; then
  cat >&2 <<'ERROR'
EXPO_PUBLIC_API_BASE_URL must use the real production domain, not a placeholder.
Example: https://family.multihost.ing/chore-api
ERROR
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mobile_dir="$(cd "$script_dir/.." && pwd)"
cd "$mobile_dir"

npx --yes eas-cli@20.0.0 env:create preview \
  --name EXPO_PUBLIC_API_BASE_URL \
  --value "${api_base_url%/}" \
  --visibility plaintext \
  --force \
  --non-interactive
