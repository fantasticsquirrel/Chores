const MAX_RESET_TOKEN_LENGTH = 1024;
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9._~-]+$/;
const RESET_TOKEN_FRAGMENT_PREFIX = "#token=";
const PRODUCTION_PASSWORD_RESET_ORIGIN = "https://family.multihost.ing";

function resolveTrustedPasswordResetOrigin(configuredOrigin: string | undefined): string | null {
  // Production recovery capabilities may only be accepted by the deployed
  // HTTPS origin. The isolated smoke wrapper injects a one-off loopback origin
  // at build time; any other override fails closed instead of turning a build
  // setting into an arbitrary-origin recovery capability.
  const normalizedConfiguredOrigin = configuredOrigin?.trim();
  if (!normalizedConfiguredOrigin || normalizedConfiguredOrigin === PRODUCTION_PASSWORD_RESET_ORIGIN) {
    return PRODUCTION_PASSWORD_RESET_ORIGIN;
  }

  try {
    const parsed = new URL(normalizedConfiguredOrigin);
    const port = Number(parsed.port);
    const isExactLoopbackSmokeOrigin = (
      normalizedConfiguredOrigin === parsed.origin
      && parsed.protocol === "http:"
      && parsed.hostname === "127.0.0.1"
      && Number.isInteger(port)
      && port >= 1
      && port <= 65535
    );
    return isExactLoopbackSmokeOrigin ? parsed.origin : null;
  } catch {
    return null;
  }
}

function trustedPasswordResetOrigin(): string | null {
  return resolveTrustedPasswordResetOrigin(import.meta.env.VITE_PASSWORD_RESET_TRUSTED_ORIGIN);
}

/** Return whether an origin is trusted for an explicitly supplied build configuration. */
export function isPasswordResetOriginTrustedForConfiguration(origin: string, configuredOrigin: string | undefined): boolean {
  return origin === resolveTrustedPasswordResetOrigin(configuredOrigin);
}

/** Return whether an origin is the one allowed to host a recovery capability. */
export function isTrustedPasswordResetOrigin(origin: string): boolean {
  return origin === trustedPasswordResetOrigin();
}

/** Return the canonical application path that may carry a recovery fragment. */
export function expectedPasswordResetPathname(): string {
  // Vite substitutes BASE_URL at build time: "/" in local/test builds and
  // "/chore/" at the production edge. Do not accept a trailing slash route.
  const basePath = import.meta.env.BASE_URL;
  const normalizedBasePath = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  return `${normalizedBasePath}/reset-password`;
}

/** Return the canonical application path that may carry an email-verification fragment. */
export function expectedEmailVerificationPathname(): string {
  const basePath = import.meta.env.BASE_URL;
  const normalizedBasePath = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  return `${normalizedBasePath}/verify-email`;
}

function readTokenFromLocation(expectedPathname: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (
    !isTrustedPasswordResetOrigin(window.location.origin)
    || window.location.pathname !== expectedPathname
    || window.location.search.length !== 0
  ) {
    return null;
  }

  const rawFragment = window.location.hash;
  if (!rawFragment.startsWith(RESET_TOKEN_FRAGMENT_PREFIX)) {
    return null;
  }

  const token = rawFragment.slice(RESET_TOKEN_FRAGMENT_PREFIX.length);
  if (token.length === 0 || token.length > MAX_RESET_TOKEN_LENGTH || !RESET_TOKEN_PATTERN.test(token)) {
    return null;
  }

  return token;
}

/**
 * Parses one opaque reset capability from the exact reset route's fragment.
 * URL fragments are never sent in HTTP requests, and callers keep a valid
 * capability only in component memory for the lifetime of the reset form.
 */
export function readPasswordResetTokenFromLocation(): string | null {
  return readTokenFromLocation(expectedPasswordResetPathname());
}

/** Parse one opaque registration capability from the exact verification route. */
export function readEmailVerificationTokenFromLocation(): string | null {
  return readTokenFromLocation(expectedEmailVerificationPathname());
}

/**
 * Clears the reset page's fragment and any unsupported query string without a
 * navigation. Recovery capabilities are accepted exclusively from the fragment.
 */
export function clearPasswordResetFragment(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (window.location.hash.length === 0 && window.location.search.length === 0) {
    return;
  }

  window.history.replaceState(null, document.title, window.location.pathname);
}
