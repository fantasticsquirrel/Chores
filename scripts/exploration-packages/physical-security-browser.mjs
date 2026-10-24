/** Independent rich worker boundary probe. Safe Chromium sandbox; no production service. */
import { build } from "esbuild";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const compiled = await build({
  entryPoints: ["frontend/src/features/discovery-lab/packages/bridge.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
const module = { exports: {} };
new Function("module", "exports", compiled.outputFiles[0].text)(
  module,
  module.exports,
);
const html = await module.exports.sandboxDocument("security-review", "rich");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || "/tmp/chromium",
  headless: true,
  chromiumSandbox: true,
  args: ["--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  const failures = [],
    responses = [];
  page.on("requestfailed", (r) =>
    failures.push({ url: r.url(), error: r.failure()?.errorText }),
  );
  page.on("response", (r) => responses.push(r.url()));
  await page.route("http://localhost/security-review", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><body></body>",
    }),
  );
  await page.goto("http://localhost/security-review");
  assert.ok(
    await page.evaluate(() => isSecureContext),
    "Watchdog UUID API requires the application secure context",
  );
  async function run(code, wait = 500, wrongCap = false) {
    return page.evaluate(
      async ({ html, code, wait, wrongCap }) => {
        const messages = [];
        const frame = document.createElement("iframe");
        frame.sandbox = "allow-scripts";
        frame.srcdoc = html;
        const listener = (e) => {
          if (e.source === frame.contentWindow) messages.push(e.data);
        };
        window.addEventListener("message", listener);
        document.body.append(frame);
        const pause = (ms) => new Promise((r) => setTimeout(r, ms));
        for (
          let i = 0;
          i < 100 && !messages.some((m) => m.type === "boot");
          i++
        )
          await pause(10);
        frame.contentWindow.postMessage(
          { cap: wrongCap ? "wrong" : "security-review", type: "start", code },
          "*",
        );
        if (!wrongCap) {
          for (
            let i = 0;
            i < 100 && !messages.some((m) => m.type === "ready");
            i++
          )
            await pause(10);
          frame.contentWindow.postMessage(
            {
              cap: "security-review",
              type: "input",
              data: { type: "reset", values: {} },
            },
            "*",
          );
        }
        await pause(wait);
        frame.remove();
        window.removeEventListener("message", listener);
        return messages;
      },
      { html, code, wait, wrongCap },
    );
  }
  const probe = await run(
    `onmessage=async()=>{const report=[];for(const k of ['document','fetch','Worker','XMLHttpRequest','WebSocket','BroadcastChannel'])report.push(k+':'+typeof self[k]);try{await import('https://security-review.invalid/external.js');report.push('external:ESCAPED')}catch{report.push('external:blocked')}try{await import(URL.createObjectURL(new Blob(['export default 1'],{type:'text/javascript'})));report.push('blob:ESCAPED')}catch{report.push('blob:blocked')}try{new Function('return 1')();report.push('eval:ESCAPED')}catch{report.push('eval:blocked')}try{await caches.open('probe');report.push('cache:ESCAPED')}catch{report.push('cache:blocked')}postMessage({description:report.join(';'),shapes:[],controls:[],animate:false})}`,
  );
  const description = probe.find((m) => m.type === "scene")?.data.description;
  assert.ok(description && !description.includes("ESCAPED"), description);
  assert.ok(
    failures.some(
      (f) =>
        f.url === "https://security-review.invalid/external.js" &&
        f.error === "csp",
    ),
  );
  assert.ok(
    failures.some((f) => f.url.startsWith("blob:") && f.error === "csp"),
  );
  assert.equal(
    responses.filter((u) => u.startsWith("https://security-review.invalid"))
      .length,
    0,
  );
  const forged = await run("onmessage=()=>postMessage({})", 100, true);
  assert.deepEqual(
    forged.map((m) => m.type),
    ["boot"],
  );
  const loop = await run("onmessage=()=>{while(true){}}", 1800);
  assert.ok(loop.some((m) => m.type === "error"));
  const idleLoop = await run(
    'onmessage=()=>{postMessage({description:"Valid initial frame",shapes:[],controls:[],animate:false});setTimeout(()=>{while(true){}},10)}',
    4500,
  );
  assert.ok(idleLoop.some((m) => m.type === "scene"));
  assert.ok(idleLoop.some((m) => m.type === "error"));
  const oversized = await run(
    'onmessage=()=>postMessage({description:"x".repeat(4194305),shapes:[]})',
  );
  assert.ok(oversized.some((m) => m.type === "error"));
  const cyclic = await run(
    "onmessage=()=>{const x={};x.self=x;postMessage(x)}",
  );
  assert.ok(cyclic.some((m) => m.type === "error"));
  const report = {
    browser: await browser.version(),
    description,
    forgedCapability: "blocked",
    infiniteLoop: "terminated",
    validThenIdleLoop: "terminated",
    oversizedOutput: "terminated",
    cyclicOutput: "terminated",
    failures,
    externalResponses: responses.filter((u) =>
      u.startsWith("https://security-review.invalid"),
    ),
  };
  writeFileSync(
    process.env.PHYSICAL_SECURITY_OUTPUT || "/tmp/physical-rich-security.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
