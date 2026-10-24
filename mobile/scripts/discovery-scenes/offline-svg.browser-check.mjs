import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
const { html } = JSON.parse(
  await readFile(
    new URL(
      "../../src/features/discovery-lab/rendering/offline-svg.generated.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const screenshotDir = process.env.DISCOVERY_SCENE_SCREENSHOTS;
test("all 74 bounded SVG states render offline without unsupported gestures", async () => {
  const browser = await chromium.launch({
    headless: true,
    chromiumSandbox: true,
    args: ["--disable-dev-shm-usage"],
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 320 },
    });
    const requests = [],
      errors = [];
    page.on("request", (r) => requests.push(r.url()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.evaluate(() => {
      window.sceneMessages = [];
      window.ReactNativeWebView = {
        postMessage: (data) => window.sceneMessages.push(JSON.parse(data)),
      };
    });
    await page.setContent(html);
    const states = [];
    for (const reverse of [false, true])
      for (let angle = 0; angle <= 80; angle += 5)
        states.push({ kind: "optics", angle, reverse });
    for (let sides = 3; sides <= 6; sides++)
      for (let copies = 1; copies <= 8; copies++)
        states.push({
          kind: "pattern",
          sides,
          copies,
          rotation: 0,
          reflected: false,
          view: "tiles",
        });
    for (const rotation of [0, 90, 180, 270])
      for (const reflected of [false, true])
        states.push({
          kind: "pattern",
          sides: 4,
          copies: 4,
          rotation,
          reflected,
          view: "motif",
        });
    for (const state of states) {
      await page.evaluate((s) => window.discoveryScene.setState(s), state);
      assert.equal(await page.locator("#scene > svg").count(), 1);
      assert.ok((await page.locator("#scene").innerHTML()).length > 1000);
      assert.doesNotMatch(
        await page.locator("body").innerText(),
        /drag the laser/i,
      );
      if (state.kind === "optics")
        assert.match(
          await page.locator("svg").getAttribute("aria-label"),
          new RegExp(`angle ${state.angle} degrees`),
        );
    }
    for (const [name, state] of [
      ["optics", { kind: "optics", angle: 40, reverse: false }],
      [
        "pattern",
        {
          kind: "pattern",
          sides: 4,
          copies: 4,
          rotation: 0,
          reflected: false,
          view: "tiles",
        },
      ],
      [
        "pattern-motif",
        {
          kind: "pattern",
          sides: 4,
          copies: 4,
          rotation: 90,
          reflected: true,
          view: "motif",
        },
      ],
    ]) {
      await page.evaluate((s) => window.discoveryScene.setState(s), state);
      if (screenshotDir) {
        await mkdir(screenshotDir, { recursive: true });
        await page.screenshot({
          path: `${screenshotDir}/offline-${name}-chromium-390.png`,
        });
      }
    }
    const before = await page.locator("#scene").innerHTML();
    await page.evaluate(() =>
      window.discoveryScene.setState({
        kind: "optics",
        angle: 41,
        reverse: false,
      }),
    );
    assert.equal(await page.locator("#scene").innerHTML(), before);
    assert.equal(
      await page.evaluate(async () => {
        try {
          await fetch("https://example.com/blocked-scene-probe");
          return false;
        } catch {
          return true;
        }
      }),
      true,
    );
    assert.deepEqual(
      requests.filter((url) => !url.startsWith("data:")),
      [],
    );
    assert.deepEqual(errors, []);
    assert.equal(
      await page.evaluate(() =>
        window.sceneMessages.some((m) => m.type === "unavailable"),
      ),
      false,
    );
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    assert.equal(await page.locator("svg").count(), 0);
  } finally {
    await browser.close();
  }
});
