import { defineConfig } from "@playwright/test";

import { requireIsolatedPlaywrightSmokeConfiguration } from "./scripts/playwright-smoke-isolation";

const { baseURL, executablePath } = requireIsolatedPlaywrightSmokeConfiguration(
  process.env,
);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL,
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions:
      executablePath === undefined ? undefined : { executablePath },
  },
});
