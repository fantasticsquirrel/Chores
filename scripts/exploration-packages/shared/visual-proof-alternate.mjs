import { build } from "esbuild";
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = process.cwd(),
  out = process.env.PROOF_OUTPUT || "/tmp/tactile-package-proof";
mkdirSync(out, { recursive: true });
const topics = [
  "sound-playground",
  "bridge-builder",
  "river-sculptor",
  "circuit-city",
  "food-web-rescue",
  "fraction-feast",
  "pattern-palace",
  "caravan-crossroads",
  "pollinator-express",
  "chance-carnival",
];
const browser = await chromium.launch({
  executablePath: process.env.DISCOVERY_BROWSER || undefined,
  headless: true,
  chromiumSandbox: true,
  args: ["--disable-dev-shm-usage"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.route("http://proof.local/**", (r) => {
  const p = new URL(r.request().url()).pathname,
    file = p === "/" ? "index.html" : p.slice(1);
  r.fulfill({
    body: readFileSync("/tmp/tactile-browser/" + file),
    contentType: file.endsWith(".js")
      ? "text/javascript"
      : file.endsWith(".css")
        ? "text/css"
        : "text/html",
  });
});
await page.goto("http://proof.local/");
const records = [];
for (const topic of topics) {
  const b = await build({
    entryPoints: [`${root}/scripts/exploration-packages/${topic}/worker.ts`],
    bundle: true,
    write: false,
    minify: true,
    format: "iife",
  });
  let frame;
  const c = {
    console,
    structuredClone,
    performance,
    postMessage: (s) => {
      if (s.scene3d?.reuseResources) {
        s.scene3d = { ...frame.scene3d, ...s.scene3d };
        delete s.scene3d.reuseResources;
      }
      frame = s;
    },
  };
  c.self = c;
  vm.createContext(c);
  vm.runInContext(b.outputFiles[0].text, c);
  const assets = {};
  try {
    for (const f of readdirSync(
      `${root}/scripts/exploration-packages/${topic}/assets`,
    ))
      assets["assets/" + f] =
        "data:image/png;base64," +
        readFileSync(
          `${root}/scripts/exploration-packages/${topic}/assets/${f}`,
        ).toString("base64");
  } catch {}
  for (const [view, width, height] of [
    ["desktop", 1100, 1100],
    ["mobile", 390, 844],
  ]) {
    c.onmessage({ data: { type: "reset", values: {}, width, height } });
    const changes = {
      "sound-playground": [
        ["amplitude", 6],
        ["phase", 90],
      ],
      "bridge-builder": [["position", 85]],
      "river-sculptor": [["vegetation", 100]],
      "circuit-city": [
        ["mode", 1],
        ["switch1", 0],
      ],
      "food-web-rescue": [["nutrients", 100]],
      "fraction-feast": [["split", 1]],
      "pattern-palace": [
        ["sides", 1],
        ["copies", 4],
      ],
      "caravan-crossroads": [["season", 1]],
      "pollinator-express": [["habitat", 1]],
      "chance-carnival": [["mode", 1]],
    }[topic];
    for (const [control, value] of changes)
      c.onmessage({
        data: {
          type: "control",
          control,
          values: { [control]: value },
          width,
          height,
        },
      });
    await page.setViewportSize({ width, height });
    await page.evaluate((config) => window.renderProof(config), {
      topic,
      name: view,
      frame,
      assets,
    });
    await page.waitForTimeout(500);
    const original = page.locator("#original");
    const slider = async (label, value) => {
      await original
        .getByRole("slider", { name: label, exact: true })
        .evaluate((el, value) => {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          ).set.call(el, String(value));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, value);
    };
    if (topic === "sound-playground") {
      await slider("Pluck amplitude", 6);
      await slider("Cycle position", 90);
    }
    if (topic === "bridge-builder") await slider("Load position", 85);
    if (topic === "river-sculptor") await slider("Vegetation cover", 100);
    if (topic === "circuit-city") {
      await original
        .getByLabel("Wiring", { exact: true })
        .selectOption("parallel");
      await original
        .getByRole("checkbox", { name: "House 2 switch", exact: true })
        .uncheck();
    }
    if (topic === "food-web-rescue") await slider("Nutrient supply", 100);
    if (topic === "fraction-feast")
      await original.getByRole("button", { name: /Split/ }).click();
    if (topic === "pattern-palace") {
      await original
        .getByLabel("Regular tile shape", { exact: true })
        .selectOption("4");
      await slider("Tiles around one point", 4);
    }
    if (topic === "caravan-crossroads")
      await original.getByLabel("Season", { exact: true }).selectOption("dry");
    if (topic === "pollinator-express")
      await original
        .getByRole("checkbox", { name: "Add habitat patches" })
        .check();
    if (topic === "chance-carnival")
      await original
        .getByLabel("Chance device", { exact: true })
        .selectOption("die");
    await page.waitForTimeout(500);
    await page.locator("#original").screenshot({
      path: `${out}/${topic}-${view}-alternate-original-full.png`,
    });
    await page.locator("#package").screenshot({
      path: `${out}/${topic}-${view}-alternate-package-full.png`,
    });
    for (const side of ["original", "package"]) {
      const visual = page.locator(`#${side} canvas`).first();
      if (await visual.count())
        await visual.screenshot({
          path: `${out}/${topic}-${view}-alternate-${side}.png`,
        });
      else
        await page
          .locator(`#${side} svg`)
          .first()
          .screenshot({
            path: `${out}/${topic}-${view}-alternate-${side}.png`,
          });
    }
    records.push({
      topic,
      view,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      canvases: await page.locator("canvas").count(),
    });
    console.log(topic, view);
  }
}
writeFileSync(
  out + "/render-review-alternate.json",
  JSON.stringify(
    { browser: await browser.version(), errors, records },
    null,
    2,
  ),
);
await browser.close();
console.log(JSON.stringify({ errors, records: records.length }));
