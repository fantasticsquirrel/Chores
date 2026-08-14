import { expect, test, vi } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  installPasswordResetCapabilityBootstrap,
  requireIsolatedPlaywrightSmokeConfiguration,
} from "./playwright-smoke-isolation";

const FRONTEND_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function wrapperEnvironment(smokeDirectory: string): Record<string, string> {
  const fixturePath = path.join(smokeDirectory, "fixture.json");
  const resetFixturePath = path.join(smokeDirectory, "reset.json");
  writeFileSync(fixturePath, "{}", { mode: 0o600 });
  writeFileSync(resetFixturePath, "{}", { mode: 0o600 });
  return {
    PLAYWRIGHT_BASE_URL: "http://127.0.0.1:18501",
    PLAYWRIGHT_SMOKE_DIR: smokeDirectory,
    PLAYWRIGHT_SMOKE_FIXTURE_PATH: fixturePath,
    PLAYWRIGHT_PASSWORD_RESET_FIXTURE_PATH: resetFixturePath,
    PLAYWRIGHT_SMOKE_RUN_ID: "n".repeat(32),
  };
}

test("smoke isolation config refuses direct invocation without wrapper-owned inputs", () => {
  expect(() => requireIsolatedPlaywrightSmokeConfiguration({})).toThrow(
    "PLAYWRIGHT_BASE_URL is required",
  );
});

test("smoke isolation config accepts only wrapper-owned loopback paths", () => {
  const smokeDirectory = mkdtempSync(
    path.join(os.tmpdir(), "family-manager-playwright-config-"),
  );
  try {
    const environment = wrapperEnvironment(smokeDirectory);
    expect(
      requireIsolatedPlaywrightSmokeConfiguration(environment),
    ).toMatchObject({
      baseURL: "http://127.0.0.1:18501",
    });

    expect(() =>
      requireIsolatedPlaywrightSmokeConfiguration({
        ...environment,
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1",
      }),
    ).toThrow("HTTP 127.0.0.1 URL");

    expect(() =>
      requireIsolatedPlaywrightSmokeConfiguration({
        ...environment,
        PLAYWRIGHT_SMOKE_FIXTURE_PATH: path.join(
          os.tmpdir(),
          "outside-fixture.json",
        ),
      }),
    ).toThrow("must exist before Playwright starts");
  } finally {
    rmSync(smokeDirectory, { recursive: true, force: true });
  }
});

test("smoke isolation config resolves symlinks before accepting a fixture", () => {
  const smokeDirectory = mkdtempSync(
    path.join(os.tmpdir(), "family-manager-playwright-config-"),
  );
  const outsideDirectory = mkdtempSync(
    path.join(os.tmpdir(), "family-manager-playwright-outside-"),
  );
  try {
    const environment = wrapperEnvironment(smokeDirectory);
    const outsideFixture = path.join(outsideDirectory, "fixture.json");
    writeFileSync(outsideFixture, "{}", { mode: 0o600 });
    const linkedFixture = path.join(smokeDirectory, "linked-fixture.json");
    symlinkSync(outsideFixture, linkedFixture);

    expect(() =>
      requireIsolatedPlaywrightSmokeConfiguration({
        ...environment,
        PLAYWRIGHT_SMOKE_FIXTURE_PATH: linkedFixture,
      }),
    ).toThrow("after symlink resolution");
  } finally {
    rmSync(smokeDirectory, { recursive: true, force: true });
    rmSync(outsideDirectory, { recursive: true, force: true });
  }
});

test("password-reset smoke keeps raw capabilities out of Playwright action arguments", () => {
  const smokeSource = readFileSync(
    path.join(FRONTEND_ROOT, "e2e", "smoke.spec.ts"),
    "utf8",
  );
  const rawCapabilityNavigation = smokeSource.includes("page.goto(resetPath)");
  const rawCapabilityRequest = smokeSource.includes(
    "data: { token, new_password: fixture.new_password }",
  );

  expect(rawCapabilityNavigation).toBe(false);
  expect(rawCapabilityRequest).toBe(false);
  expect(smokeSource).toContain("installPasswordResetCapabilityBootstrap");
});

test("password-reset smoke keeps raw capabilities out of URL assertion diagnostics", () => {
  const smokeSource = readFileSync(
    path.join(FRONTEND_ROOT, "e2e", "smoke.spec.ts"),
    "utf8",
  );
  const resetFlowStart = smokeSource.indexOf(
    'test("isolated password-reset flow',
  );
  const resetFlowEnd = smokeSource.indexOf(
    'test("deployed auth protections',
    resetFlowStart,
  );
  const resetFlowSource = smokeSource.slice(resetFlowStart, resetFlowEnd);

  expect(resetFlowStart).toBeGreaterThanOrEqual(0);
  expect(resetFlowEnd).toBeGreaterThan(resetFlowStart);
  expect(resetFlowSource).not.toContain("expect(page).toHaveURL");
  expect(resetFlowSource).toContain(
    "expect.poll(() => new URL(page.url()).pathname)",
  );
});

test("capability bootstrap exposes only a one-shot closure to the browser", async () => {
  const capability = `v1.isolated_reset.${"s".repeat(43)}`;
  let consumeCapability: (() => string) | undefined;
  const playwrightVisibleArguments: string[] = [];
  const page = {
    async exposeFunction(name: string, callback: () => string): Promise<void> {
      playwrightVisibleArguments.push(name, callback.toString());
      consumeCapability = callback;
    },
    async addInitScript(script: () => Promise<void>): Promise<void> {
      playwrightVisibleArguments.push(script.toString());
    },
  };

  await installPasswordResetCapabilityBootstrap(page, capability);

  const capabilityAppearsInPlaywrightArguments = playwrightVisibleArguments
    .join("\n")
    .includes(capability);
  expect(capabilityAppearsInPlaywrightArguments).toBe(false);
  if (consumeCapability === undefined) {
    throw new Error(
      "Expected the reset capability bootstrap to register its one-shot browser binding.",
    );
  }
  const bindingReturnedCapability = consumeCapability() === capability;
  expect(bindingReturnedCapability).toBe(true);
  expect(() => consumeCapability!()).toThrow("already consumed");
});

test("capability bootstrap reloads after its asynchronous bridge fills the fragment", async () => {
  const capability = `v1.isolated_reset.${"r".repeat(43)}`;
  let consumeCapability: (() => string) | undefined;
  let initScript: (() => Promise<void>) | undefined;
  const page = {
    async exposeFunction(_name: string, callback: () => string): Promise<void> {
      consumeCapability = callback;
    },
    async addInitScript(script: () => Promise<void>): Promise<void> {
      initScript = script;
    },
  };

  await installPasswordResetCapabilityBootstrap(page, capability);
  if (consumeCapability === undefined || initScript === undefined) {
    throw new Error("Expected a capability binding and init script.");
  }

  let reloads = 0;
  type BootstrapWindow = {
    location: { hash: string; pathname: string; reload: () => void };
    history: { replaceState: (_state: unknown, _title: string, url: string) => void };
    __familyManagerSmokeConsumeResetCapability?: () => Promise<string>;
  };
  let browserWindow: BootstrapWindow;
  browserWindow = {
    location: {
      hash: "",
      pathname: "/chore/reset-password",
      reload: () => {
        reloads += 1;
      },
    },
    history: {
      replaceState: (_state, _title, url) => {
        browserWindow.location.hash = new URL(url, "http://127.0.0.1").hash;
      },
    },
  };
  const oneShotCapability = consumeCapability;
  browserWindow.__familyManagerSmokeConsumeResetCapability = async () => {
    await Promise.resolve();
    return oneShotCapability();
  };
  vi.stubGlobal("window", browserWindow);
  vi.stubGlobal("document", { title: "isolated smoke" });
  try {
    await initScript();
  } finally {
    vi.unstubAllGlobals();
  }

  expect(browserWindow.location.hash).toBe(`#token=${capability}`);
  expect(reloads).toBe(1);
});

test("isolated Playwright explicitly disables trace, screenshot, and video artifacts", () => {
  const configSource = readFileSync(
    path.join(FRONTEND_ROOT, "playwright.smoke.config.ts"),
    "utf8",
  );

  expect(configSource).toContain('trace: "off"');
  expect(configSource).toContain('screenshot: "off"');
  expect(configSource).toContain('video: "off"');
});
