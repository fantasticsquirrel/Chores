import { cases } from "./browser-scene-fixtures.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const { html } = JSON.parse(
  await readFile(
    new URL(
      "../../src/features/discovery-lab/rendering/offline-scenes.generated.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const screenshotDir = process.env.DISCOVERY_SCENE_SCREENSHOTS;

test("offline Moon renders, changes phase, drags, blocks network and disposes", async () => {
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
      viewport: { width: 390, height: 300 },
    });
    const requests = [];
    const errors = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.evaluate(() => {
      window.moonMessages = [];
      window.ReactNativeWebView = {
        postMessage: (message) => window.moonMessages.push(JSON.parse(message)),
      };
    });
    await page.setContent(html);
    await page.evaluate(() =>
      window.discoveryScene.setState({ kind: "moon", angle: 0 }),
    );
    await page.waitForFunction(
      () => document.getElementById("scene")?.dataset.surfaceReady === "true",
    );
    assert.deepEqual(await page.evaluate(() => window.moonMessages), [
      { type: "ready" },
      { type: "rendered" },
    ]);
    assert.equal(await page.locator("canvas").count(), 1);
    const pixels = async (angle) =>
      page.evaluate((value) => {
        window.discoveryScene.setState({ kind: "moon", angle: value });
        const canvas = document.querySelector("canvas");
        const gl = canvas.getContext("webgl2");
        const data = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(
          0,
          0,
          canvas.width,
          canvas.height,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          data,
        );
        let left = 0,
          right = 0;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            if (data[i] + data[i + 1] + data[i + 2] > 100) {
              if (x < canvas.width / 2) left++;
              else right++;
            }
          }
        return { left, right, total: left + right };
      }, angle);
    const newMoon = await pixels(0);
    const quarter = await pixels(90);
    const full = await pixels(180);
    assert.ok(
      quarter.right > quarter.left * 4,
      "waxing quarter must light the right side",
    );
    assert.ok(
      full.total > quarter.total * 1.7,
      "full disk must show more lit area than quarter",
    );
    assert.ok(
      quarter.total > newMoon.total * 8,
      "new Moon must not look sunlit",
    );
    await page.evaluate(() =>
      window.discoveryScene.setState({ kind: "moon", angle: 135 }),
    );
    if (screenshotDir) {
      await mkdir(screenshotDir, { recursive: true });
      await page.screenshot({
        path: `${screenshotDir}/offline-moon-chromium-390.png`,
      });
    }
    await page.mouse.move(195, 150);
    await page.mouse.down();
    await page.mouse.move(235, 150, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() =>
      window.moonMessages.some((message) => message.type === "angle"),
    );
    const changes = await page.evaluate(() =>
      window.moonMessages.filter((message) => message.type === "angle"),
    );
    assert.ok(changes.at(-1).angle > 135 && changes.at(-1).angle < 180);
    const blocked = await page.evaluate(async () => {
      try {
        await fetch("https://example.com/blocked-scene-probe");
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(blocked, true);
    assert.deepEqual(
      requests.filter((url) => !url.startsWith("data:")),
      [],
    );
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    assert.equal(await page.locator("canvas").count(), 0);
    console.log(
      JSON.stringify({
        newMoon,
        quarter,
        full,
        remoteRequests: 0,
        note: "Chromium document test, not Android/iOS WebView device verification",
      }),
    );
  } finally {
    await browser.close();
  }
});

test("offline Moon reports unavailable when WebGL cannot start", async () => {
  const browser = await chromium.launch({
    headless: true,
    chromiumSandbox: true,
    args: ["--disable-dev-shm-usage"],
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage();
    await page.evaluate(() => {
      window.moonMessages = [];
      window.ReactNativeWebView = {
        postMessage: (message) => window.moonMessages.push(JSON.parse(message)),
      };
      window.WebGLRenderingContext = undefined;
    });
    await page.setContent(html);
    await page.evaluate(() =>
      window.discoveryScene.setState({ kind: "moon", angle: 0 }),
    );
    assert.deepEqual(await page.evaluate(() => window.moonMessages), [
      { type: "ready" },
      { type: "unavailable" },
    ]);
    assert.equal(await page.locator("canvas").count(), 0);
  } finally {
    await browser.close();
  }
});

for (const { kind, initial, changed } of cases) {
  test(`offline ${kind} renders and updates without remote requests`, async () => {
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
        viewport: { width: 390, height: kind === "pizza" ? 420 : 320 },
      });
      const requests = [],
        errors = [];
      page.on("request", (request) => requests.push(request.url()));
      page.on("pageerror", (error) => errors.push(error.message));
      await page.evaluate(() => {
        window.sceneMessages = [];
        window.ReactNativeWebView = {
          postMessage: (data) => window.sceneMessages.push(JSON.parse(data)),
        };
      });
      await page.setContent(html);
      await page.evaluate(
        (state) => window.discoveryScene.setState(state),
        initial,
      );
      await page.waitForFunction(() =>
        window.sceneMessages.some((item) => item.type === "rendered"),
      );
      assert.equal(await page.locator("canvas").count(), 1);
      const bounds = await page
        .locator("#labels span")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const r = element.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            };
          }),
        );
      for (const bound of bounds) {
        assert.ok(
          bound.left >= 0 && bound.right <= 390,
          `${kind} label must fit horizontally`,
        );
        assert.ok(
          bound.top >= 0 && bound.bottom <= 320,
          `${kind} label must fit vertically`,
        );
      }
      if (
        [
          "machine-workshop",
          "heat-house",
          "pressure-tank",
          "moving-plates",
          "cloud-rain-lab",
          "magnetic-fields",
          "cell-explorer",
          "shape-slicer",
          "adaptation-island",
        ].includes(kind)
      ) {
        assert.doesNotMatch(
          await page.locator("#labels").innerText(),
          /\bdrag\b/i,
          "Native scenes must not promise unavailable drag controls",
        );
      }
      const first = await page.screenshot();
      assert.ok(
        first.length > 3000,
        `${kind} must render more than an empty background`,
      );
      if (screenshotDir) {
        await mkdir(screenshotDir, { recursive: true });
        await page.screenshot({
          path: `${screenshotDir}/offline-${kind}-chromium-390.png`,
        });
      }
      await page.evaluate(
        (state) => window.discoveryScene.setState(state),
        changed,
      );
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const second = await page.screenshot();
      assert.notDeepEqual(
        first,
        second,
        `${kind} state change must alter the rendered scene`,
      );
      assert.deepEqual(
        requests.filter((url) => !url.startsWith("data:")),
        [],
      );
      assert.deepEqual(errors, []);
      assert.equal(
        await page.evaluate(() =>
          window.sceneMessages.some((item) => item.type === "unavailable"),
        ),
        false,
      );
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      assert.equal(await page.locator("canvas").count(), 0);
    } finally {
      await browser.close();
    }
  });
}
