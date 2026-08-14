import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{1,1024}$/;

export const PASSWORD_RESET_BRIDGE_ENVIRONMENT_KEYS = [
  "APP_ENV",
  "DATABASE_URL",
  "SECRET_KEY",
  "SESSION_COOKIE_SECURE",
  "PASSWORD_RESET_ENABLED",
  "PASSWORD_RESET_PUBLIC_APP_URL",
  "PASSWORD_RESET_FROM_ADDRESS",
  "PASSWORD_RESET_SENDMAIL_PATH",
  "PLAYWRIGHT_ISOLATED_DB",
] as const;

type BridgeEnvironmentKey = (typeof PASSWORD_RESET_BRIDGE_ENVIRONMENT_KEYS)[number];
type Environment = Record<string, string | undefined>;

type BridgeOptions = {
  environment?: Environment;
  pythonCommand?: string;
  bridgeScriptPath?: string;
};

function requireBridgeEnvironmentValue(environment: Environment, key: BridgeEnvironmentKey): string {
  const value = environment[key];
  if (value === undefined || value.length === 0) {
    throw new Error("The isolated reset bridge is missing its required disposable configuration.");
  }
  return value;
}

/**
 * Construct the bridge environment from a strict allowlist. In particular, no
 * fixture paths, browser credentials, run nonce, parent environment, or raw
 * capability is inherited by the child process.
 */
export function buildPasswordResetBridgeEnvironment(environment: Environment): Record<string, string> {
  const bridgeEnvironment = Object.fromEntries(
    PASSWORD_RESET_BRIDGE_ENVIRONMENT_KEYS.map((key) => [key, requireBridgeEnvironmentValue(environment, key)]),
  ) as Record<string, string>;
  // `stdio[3]` below deterministically maps this child descriptor to the only
  // pipe that may carry an opaque capability back to the Playwright process.
  bridgeEnvironment.PLAYWRIGHT_PASSWORD_RESET_RESULT_FD = "3";
  return bridgeEnvironment;
}

/**
 * Materialize the reset capability only in process memory via child FD 3.
 * stdout is ignored and never used as a fallback; stderr remains private and
 * is deliberately omitted from all error messages.
 */
export function requestPasswordResetTokenThroughWorkerPipe(
  email: string,
  options: BridgeOptions = {},
): string {
  const environment = options.environment ?? process.env;
  const pythonCommand = options.pythonCommand ?? environment.PLAYWRIGHT_BACKEND_PYTHON ?? "python";
  const bridgeScriptPath = options.bridgeScriptPath ?? path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../backend/scripts/issue_playwright_password_reset.py",
  );
  const result = spawnSync(pythonCommand, [bridgeScriptPath, "--email", email], {
    env: buildPasswordResetBridgeEnvironment(environment),
    encoding: "utf8",
    // `stdio[3]` is a dedicated Node-created pipe inherited as child FD 3.
    // Its contents never enter stdout, stderr, files, URLs, or environment.
    stdio: ["ignore", "ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 || result.stdout !== null || result.stderr === null) {
    throw new Error("Isolated reset bridge failed before returning a dedicated reset capability.");
  }
  const token = result.output?.[3]?.trim();
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    throw new Error("Isolated reset bridge did not return one opaque capability through its dedicated pipe.");
  }
  return token;
}
