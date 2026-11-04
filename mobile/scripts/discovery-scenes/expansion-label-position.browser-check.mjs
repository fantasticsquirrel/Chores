import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { chromium } from "@playwright/test";

const viewport = { width: 390, height: 320 };
const { html } = JSON.parse(
  await readFile(
    new URL(
      "../../src/features/discovery-lab/rendering/offline-scenes.generated.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

const launchBrowser = () =>
  chromium.launch({
    headless: true,
    chromiumSandbox: true,
    args: ["--disable-dev-shm-usage"],
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });

const labelCenter = async (page, text) =>
  page.locator("#labels span", { hasText: text }).evaluate((label) => ({
    x: Number.parseFloat(label.style.left),
    y: Number.parseFloat(label.style.top),
  }));

test("offline expansion labels honor machine slots and retain projected fallback", async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport });
    await page.evaluate(() => {
      window.sceneMessages = [];
      window.ReactNativeWebView = {
        postMessage: (data) => window.sceneMessages.push(JSON.parse(data)),
      };
    });
    await page.setContent(html);
    await page.evaluate(() =>
      window.discoveryScene.setState({
        kind: "machine-workshop",
        mode: "pulley",
        loadKg: 40,
        advantage: 2,
        liftM: 0.5,
      }),
    );
    await page.waitForFunction(
      () => document.getElementById("scene")?.dataset.surfaceReady === "true",
    );

    assert.deepEqual(await labelCenter(page, "2 support sections"), {
      x: (76 * viewport.width) / 100,
      y: (10 * viewport.height) / 100,
    });
    assert.deepEqual(await labelCenter(page, "Load rise · 0.5 m"), {
      x: (18 * viewport.width) / 100,
      y: (55 * viewport.height) / 100,
    });

    const bounds = await page.locator("#labels span").evaluateAll((labels) =>
      labels.map((label) => {
        const box = label.getBoundingClientRect();
        return {
          text: label.textContent,
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
        };
      }),
    );
    for (let i = 0; i < bounds.length; i++) {
      assert.ok(bounds[i].left >= 0 && bounds[i].right <= viewport.width);
      assert.ok(bounds[i].top >= 0 && bounds[i].bottom <= viewport.height);
      for (let j = i + 1; j < bounds.length; j++) {
        const overlaps =
          bounds[i].left < bounds[j].right &&
          bounds[i].right > bounds[j].left &&
          bounds[i].top < bounds[j].bottom &&
          bounds[i].bottom > bounds[j].top;
        assert.equal(
          overlaps,
          false,
          `${bounds[i].text} must not overlap ${bounds[j].text}`,
        );
      }
    }

    await page.evaluate(() =>
      window.discoveryScene.setState({
        kind: "heat-house",
        insulationCm: 5,
        windowM2: 8,
        material: "brick",
        insideC: 20,
        outsideC: 0,
        elapsedHours: 6,
      }),
    );
    await page
      .locator("#labels span", { hasText: "20°C held inside" })
      .waitFor();
    assert.deepEqual(await labelCenter(page, "20°C held inside"), {
      x: (72 * viewport.width) / 100,
      y: (9 * viewport.height) / 100,
    });
    assert.deepEqual(await labelCenter(page, "6 h ·"), {
      x: (50 * viewport.width) / 100,
      y: (91 * viewport.height) / 100,
    });
  } finally {
    await browser.close();
  }
});

test("offline magnetic field keeps both tabletop axes visible", async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport });
    await page.evaluate(() => {
      window.ReactNativeWebView = { postMessage: () => {} };
    });
    await page.setContent(html);
    await page.evaluate(() =>
      window.discoveryScene.setState({
        kind: "magnetic-fields",
        gap: 2,
        flipped: false,
        probeX: 0,
        probeZ: 2,
      }),
    );
    await page.waitForFunction(
      () => document.getElementById("scene")?.dataset.surfaceReady === "true",
    );

    const axes = await page.locator("#labels span").evaluateAll((labels) =>
      labels
        .filter(
          (label) =>
            label.textContent === "+x axis" || label.textContent === "+z axis",
        )
        .map((label) => {
          const box = label.getBoundingClientRect();
          return {
            text: label.textContent,
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          };
        }),
    );
    assert.deepEqual(
      axes.map(({ text }) => text),
      ["+x axis", "+z axis"],
    );
    for (const axis of axes) {
      assert.ok(
        axis.left >= 0 && axis.right <= viewport.width,
        `${axis.text} must fit horizontally`,
      );
      assert.ok(
        axis.top >= 0 && axis.bottom <= viewport.height,
        `${axis.text} must fit vertically`,
      );
    }
    assert.equal(
      axes[0].left < axes[1].right &&
        axes[0].right > axes[1].left &&
        axes[0].top < axes[1].bottom &&
        axes[0].bottom > axes[1].top,
      false,
      "+x axis must not overlap +z axis",
    );
  } finally {
    await browser.close();
  }
});
