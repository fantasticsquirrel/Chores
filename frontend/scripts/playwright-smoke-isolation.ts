import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

export type SmokeConfiguration = {
  baseURL: string;
  executablePath?: string;
};

type PasswordResetCapabilityBootstrapPage = {
  exposeFunction(name: string, callback: () => string): Promise<void>;
  addInitScript(script: () => Promise<void>): Promise<void>;
};

type SmokeEnvironment = Record<string, string | undefined>;

function requiredEnvironment(
  environment: SmokeEnvironment,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(
      `${name} is required; use npm run test:smoke so the isolated wrapper supplies it.`,
    );
  }
  return value;
}

function isStrictLoopbackHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port !== "" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function isPathInside(directory: string, candidate: string): boolean {
  const relative = path.relative(directory, candidate);
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
}

export function requireIsolatedPlaywrightSmokeConfiguration(
  environment: SmokeEnvironment,
): SmokeConfiguration {
  const baseURL = requiredEnvironment(environment, "PLAYWRIGHT_BASE_URL");
  const smokeDirectory = requiredEnvironment(
    environment,
    "PLAYWRIGHT_SMOKE_DIR",
  );
  const fixturePath = requiredEnvironment(
    environment,
    "PLAYWRIGHT_SMOKE_FIXTURE_PATH",
  );
  const resetFixturePath = requiredEnvironment(
    environment,
    "PLAYWRIGHT_PASSWORD_RESET_FIXTURE_PATH",
  );
  const smokeRunId = requiredEnvironment(
    environment,
    "PLAYWRIGHT_SMOKE_RUN_ID",
  );

  if (!isStrictLoopbackHttpUrl(baseURL)) {
    throw new Error(
      "PLAYWRIGHT_BASE_URL must be an HTTP 127.0.0.1 URL owned by the isolated smoke wrapper.",
    );
  }
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(smokeRunId)) {
    throw new Error(
      "PLAYWRIGHT_SMOKE_RUN_ID must be a wrapper-issued opaque nonce.",
    );
  }
  if (
    !path.isAbsolute(smokeDirectory) ||
    !path.isAbsolute(fixturePath) ||
    !path.isAbsolute(resetFixturePath)
  ) {
    throw new Error(
      "The smoke directory and fixture paths must be absolute wrapper-owned paths.",
    );
  }

  if (!existsSync(fixturePath) || !existsSync(resetFixturePath)) {
    throw new Error(
      "The wrapper-owned smoke directory and fixture files must exist before Playwright starts.",
    );
  }

  let resolvedSmokeDirectory: string;
  let resolvedFixturePath: string;
  let resolvedResetFixturePath: string;
  try {
    resolvedSmokeDirectory = realpathSync(smokeDirectory);
    resolvedFixturePath = realpathSync(fixturePath);
    resolvedResetFixturePath = realpathSync(resetFixturePath);
  } catch {
    throw new Error(
      "The wrapper-owned smoke directory and fixture files must exist before Playwright starts.",
    );
  }
  if (
    !isPathInside(resolvedSmokeDirectory, resolvedFixturePath) ||
    !isPathInside(resolvedSmokeDirectory, resolvedResetFixturePath)
  ) {
    throw new Error(
      "Smoke fixture paths must remain inside PLAYWRIGHT_SMOKE_DIR after symlink resolution.",
    );
  }

  const executablePath =
    environment.PLAYWRIGHT_CHROMIUM_EXECUTABLE?.trim() || undefined;
  return { baseURL, executablePath };
}

/**
 * Gives the reset page its isolated capability without placing it in a
 * Playwright URL, request argument, trace option, or diagnostic call string.
 */
export async function installPasswordResetCapabilityBootstrap(
  page: PasswordResetCapabilityBootstrapPage,
  capability: string,
): Promise<void> {
  let consumed = false;

  await page.exposeFunction(
    "__familyManagerSmokeConsumeResetCapability",
    () => {
      if (consumed) {
        throw new Error("The isolated reset capability was already consumed.");
      }
      consumed = true;
      return capability;
    },
  );

  await page.addInitScript(async () => {
    if (
      window.location.pathname !== "/chore/reset-password" ||
      window.location.hash !== ""
    ) {
      return;
    }
    const browserWindow = window as Window &
      typeof globalThis & {
        __familyManagerSmokeConsumeResetCapability?: () => Promise<string>;
      };
    const consumeCapability =
      browserWindow.__familyManagerSmokeConsumeResetCapability;
    if (typeof consumeCapability !== "function") {
      throw new Error(
        "The isolated reset capability bootstrap is unavailable.",
      );
    }
    const capability = await consumeCapability();
    window.history.replaceState(
      null,
      document.title,
      `${window.location.pathname}#token=${capability}`,
    );
    // Playwright bindings cross the browser protocol asynchronously. Reload so
    // the reset page's synchronous first-render parser sees the completed
    // fragment; the nonempty-hash guard above prevents a reload loop.
    window.location.reload();
  });
}
