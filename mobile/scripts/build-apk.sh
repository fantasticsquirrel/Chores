#!/usr/bin/env bash
set -euo pipefail

mode="cloud"
skip_env_check="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)
      mode="local"
      shift
      ;;
    --skip-env-check)
      skip_env_check="true"
      shift
      ;;
    -h|--help)
      cat <<'USAGE'
Usage:
  npm run mobile:apk
  npm run mobile:apk:local

Environment:
  EXPO_PUBLIC_API_BASE_URL=https://YOUR_DOMAIN/chore-api

Cloud builds use the EAS preview environment. If EXPO_PUBLIC_API_BASE_URL is
set locally, this script updates that EAS environment before starting the APK
build. Local builds use the local environment directly and require Java plus an
Android SDK.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mobile_dir="$(cd "$script_dir/.." && pwd)"
repo_root="$(cd "$mobile_dir/.." && pwd)"
cd "$mobile_dir"

add_git_safe_directory() {
  local safe_path="$1"

  if git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "$safe_path"; then
    return
  fi

  git config --global --add safe.directory "$safe_path"
}

# EAS CLI clones the local repo through a file:// URL before uploading it.
# Mixed service/root ownership on the server can otherwise trip Git's
# "dubious ownership" check during that internal clone.
if [[ -d "$repo_root/.git" ]]; then
  add_git_safe_directory "$repo_root"
  add_git_safe_directory "$repo_root/.git"
fi

api_base_url="${EXPO_PUBLIC_API_BASE_URL:-}"
if [[ -n "$api_base_url" && ! "$api_base_url" =~ ^https://.+/chore-api/?$ ]]; then
  echo "EXPO_PUBLIC_API_BASE_URL must be an HTTPS URL ending in /chore-api." >&2
  exit 2
fi
if [[ "$api_base_url" =~ YOUR_|example\.com ]]; then
  echo "EXPO_PUBLIC_API_BASE_URL must use the real production domain, not a placeholder." >&2
  exit 2
fi

npm run typecheck

node <<'NODE'
const { expo } = require("./app.json");
const versionCode = expo && expo.android && expo.android.versionCode;

if (!Number.isInteger(versionCode) || versionCode < 1) {
  console.error(
    "mobile/app.json must define expo.android.versionCode as a positive integer before building an APK.",
  );
  process.exit(2);
}
NODE

if [[ "$mode" == "cloud" ]]; then
  if [[ -n "$api_base_url" ]]; then
    "$script_dir/set-eas-api-url.sh" "$api_base_url"
  elif [[ "$skip_env_check" != "true" ]]; then
    if ! npx --yes eas-cli@20.0.0 env:exec preview 'test -n "$EXPO_PUBLIC_API_BASE_URL"' --non-interactive; then
      cat >&2 <<'ERROR'
Missing EAS preview environment variable: EXPO_PUBLIC_API_BASE_URL

Set it once before building:
  npm run mobile:eas:set-api -- https://YOUR_DOMAIN/chore-api

Or build while setting it:
  EXPO_PUBLIC_API_BASE_URL=https://YOUR_DOMAIN/chore-api npm run mobile:apk
ERROR
      exit 2
    fi
  fi

  npx --yes eas-cli@20.0.0 build \
    --platform android \
    --profile apk \
    --non-interactive \
    --wait
else
  if [[ -z "$api_base_url" ]]; then
    cat >&2 <<'ERROR'
Local APK builds require EXPO_PUBLIC_API_BASE_URL in the local environment:
  EXPO_PUBLIC_API_BASE_URL=https://YOUR_DOMAIN/chore-api npm run mobile:apk:local
ERROR
    exit 2
  fi

  mkdir -p "$repo_root/builds"
  npx --yes eas-cli@20.0.0 build \
    --platform android \
    --profile apk \
    --local \
    --non-interactive \
    --output "$repo_root/builds/family-manager.apk"
fi
