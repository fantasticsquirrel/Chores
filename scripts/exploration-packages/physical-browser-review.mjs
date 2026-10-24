/** Run physical-browser-build.mjs first; uses network interception, not a live service. */
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = process.cwd(),
  out = process.env.PHYSICAL_PROOF_OUTPUT || "/tmp/physical-package-proof";
mkdirSync(out, { recursive: true });
const specs = [
  [
    "machine-workshop",
    { mode: "gears", advantage: 4 },
    { mode: 2, advantage: 4 },
  ],
  [
    "heat-house",
    { insulationCm: 20, windowM2: 18 },
    { insulationCm: 20, windowM2: 18 },
  ],
  [
    "pressure-tank",
    { shape: "wide", outletM: 2.5 },
    { shape: 1, outletM: 2.5 },
  ],
  [
    "moving-plates",
    { boundary: "convergent", movement: 80 },
    { boundary: 1, movement: 80 },
  ],
  ["cloud-rain-lab", { dropletGrowth: 90 }, { dropletGrowth: 90 }],
  ["magnetic-fields", { flipped: true, probeZ: 0 }, { flipped: 1, probeZ: 0 }],
  [
    "cell-explorer",
    { cellType: "animal", molecule: "glucose", carrier: true },
    { cellType: 1, molecule: 1, carrier: 1 },
  ],
  [
    "shape-slicer",
    { solid: "cube", tilt: 45, turn: 35.26438968, offset: 0 },
    { tilt: 45, turn: 35.26438968 },
  ],
  [
    "adaptation-island",
    { habitat: "light", predators: false },
    { habitat: 1, predators: 0 },
  ],
];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || "/tmp/chromium",
  headless: true,
  chromiumSandbox: true,
  args: ["--disable-dev-shm-usage"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.route("http://proof.local/**", (r) => {
  const p = new URL(r.request().url()).pathname;
  const file = p === "/" ? "index.html" : p.slice(1);
  r.fulfill({
    body: readFileSync("/tmp/physical-browser/" + file),
    contentType: file.endsWith(".js")
      ? "text/javascript"
      : file.endsWith(".css")
        ? "text/css"
        : "text/html",
  });
});
await page.goto("http://proof.local/");
const records = [];
for (const [topic, alternate, controls] of specs.filter(
  (s) => !process.argv[2] || process.argv.slice(2).includes(s[0]),
)) {
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
  vm.createContext(c);
  vm.runInContext(b.outputFiles[0].text, c);
  const send = (control, value) =>
    c.onmessage({
      data: { type: "control", control, values: { [control]: value } },
    });
  send("", 0);
  for (const name of ["default", "alternate"]) {
    if (name === "alternate")
      for (const [k, v] of Object.entries(controls)) send(k, v);
    for (const [view, width, height] of [
      ["desktop", 1100, 1100],
      ["mobile", 390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate((config) => window.renderProof(config), {
        topic,
        name,
        state: name === "default" ? {} : alternate,
        frame,
      });
      await page
        .locator("#package canvas")
        .waitFor({ state: "visible", timeout: 5000 })
        .catch(async (e) => {
          console.log(
            "ERRORS",
            errors,
            "BODY",
            await page.locator("body").innerText(),
          );
          await page.screenshot({ path: out + "/error.png" });
          throw e;
        });
      await page.waitForTimeout(300);
      await page
        .locator("#original .expansion-scene")
        .screenshot({ path: `${out}/${topic}-${view}-${name}-original.png` });
      await page
        .locator("#package .package-3d-visual")
        .screenshot({ path: `${out}/${topic}-${view}-${name}-package.png` });
      if (name === "default")
        await page
          .locator("#package")
          .screenshot({ path: `${out}/${topic}-${view}-full.png` });
      records.push({
        topic,
        name,
        view,
        original: await page.locator("#original canvas").boundingBox(),
        package: await page.locator("#package canvas").boundingBox(),
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      });
      console.log(topic, name, view);
    }
  }
}
writeFileSync(
  out + "/render-review.json",
  JSON.stringify(
    { browser: await browser.version(), errors, records },
    null,
    2,
  ),
);
await browser.close();
console.log(JSON.stringify({ errors, records: records.length }));
