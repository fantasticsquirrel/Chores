import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";

import {
  PASSWORD_RESET_BRIDGE_ENVIRONMENT_KEYS,
  buildPasswordResetBridgeEnvironment,
  requestPasswordResetTokenThroughWorkerPipe,
} from "./playwright-password-reset-bridge";

function wrapperEnvironment(): Record<string, string> {
  return {
    APP_ENV: "development",
    DATABASE_URL: "sqlite:////tmp/family-manager-playwright-bridge/chore_tracking.db",
    SECRET_KEY: "playwright-isolated-secret-key-000000",
    SESSION_COOKIE_SECURE: "false",
    PASSWORD_RESET_ENABLED: "true",
    PASSWORD_RESET_PUBLIC_APP_URL: "https://family.multihost.ing/chore",
    PASSWORD_RESET_FROM_ADDRESS: "no-reply@family.multihost.ing",
    PASSWORD_RESET_SENDMAIL_PATH: "/bin/true",
    PLAYWRIGHT_ISOLATED_DB: "1",
    PLAYWRIGHT_SMOKE_FIXTURE_PATH: "/private/fixture-with-password.json",
    PLAYWRIGHT_PASSWORD_RESET_FIXTURE_PATH: "/private/reset-fixture-with-password.json",
    PLAYWRIGHT_SMOKE_RUN_ID: "n".repeat(32),
    UNRELATED_SECRET: "must-not-reach-the-reset-bridge",
  };
}

test("reset bridge forwards only the minimal disposable worker configuration", () => {
  const bridgeEnvironment = buildPasswordResetBridgeEnvironment(wrapperEnvironment());

  expect(Object.keys(bridgeEnvironment).sort()).toEqual(
    [...PASSWORD_RESET_BRIDGE_ENVIRONMENT_KEYS, "PLAYWRIGHT_PASSWORD_RESET_RESULT_FD"].sort(),
  );
  expect(bridgeEnvironment).not.toHaveProperty("PLAYWRIGHT_SMOKE_FIXTURE_PATH");
  expect(bridgeEnvironment).not.toHaveProperty("PLAYWRIGHT_PASSWORD_RESET_FIXTURE_PATH");
  expect(bridgeEnvironment).not.toHaveProperty("PLAYWRIGHT_SMOKE_RUN_ID");
  expect(bridgeEnvironment).not.toHaveProperty("UNRELATED_SECRET");
  expect(bridgeEnvironment.PLAYWRIGHT_PASSWORD_RESET_RESULT_FD).toBe("3");
});

test("reset bridge receives a capability only through Node's dedicated inherited FD 3", () => {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "family-manager-reset-bridge-"));
  const fakeBridge = path.join(temporaryDirectory, "fake-reset-bridge.mjs");
  const expectedKeys = [...PASSWORD_RESET_BRIDGE_ENVIRONMENT_KEYS, "PLAYWRIGHT_PASSWORD_RESET_RESULT_FD"].sort();
  writeFileSync(
    fakeBridge,
    `import fs from "node:fs";
const expected = ${JSON.stringify(expectedKeys)};
if (JSON.stringify(Object.keys(process.env).sort()) !== JSON.stringify(expected)) process.exit(17);
if (process.env.PLAYWRIGHT_PASSWORD_RESET_RESULT_FD !== "3") process.exit(18);
fs.writeSync(3, "v1.fake_reset_id.${"a".repeat(43)}");
`,
    { mode: 0o700 },
  );

  try {
    const token = requestPasswordResetTokenThroughWorkerPipe("parent@example.com", {
      environment: wrapperEnvironment(),
      pythonCommand: process.execPath,
      bridgeScriptPath: fakeBridge,
    });
    expect(token).toBe(`v1.fake_reset_id.${"a".repeat(43)}`);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
