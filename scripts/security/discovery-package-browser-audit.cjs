/** Real browser boundary audit. Run from repo root with CHROMIUM_EXECUTABLE_PATH. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require(process.cwd() + "/node_modules/typescript");
const { chromium } = require(process.cwd() + "/node_modules/playwright");
(async () => {
  const source = fs.readFileSync(
    "frontend/src/features/discovery-lab/packages/bridge.ts",
    "utf8",
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", javascript)(module.exports, module);
  const html = await module.exports.sandboxDocument("audit-cap");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
    chromiumSandbox: true,
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    const failed = [];
    page.on("requestfailed", (r) =>
      failed.push({ url: r.url(), failure: r.failure() }),
    );
    await page.setContent("<html><body></body></html>");
    async function run(code, options = {}) {
      return page.evaluate(
        async ({ html, code, options }) => {
          const logs = [];
          const frame = document.createElement("iframe");
          frame.sandbox = "allow-scripts";
          frame.srcdoc = html;
          const listener = (e) => {
            if (e.source === frame.contentWindow) logs.push(e.data);
          };
          window.addEventListener("message", listener);
          document.body.append(frame);
          const wait = (ms) =>
            new Promise((resolve) => setTimeout(resolve, ms));
          for (let n = 0; n < 100 && !logs.some((e) => e.type === "boot"); n++)
            await wait(10);
          frame.contentWindow.postMessage(
            {
              cap: options.badCap ? "incorrect-cap" : "audit-cap",
              type: "start",
              code,
            },
            "*",
          );
          for (let n = 0; n < 50 && !logs.some((e) => e.type === "ready"); n++)
            await wait(10);
          frame.contentWindow.postMessage(
            { cap: "audit-cap", type: "input", data: {} },
            "*",
          );
          await wait(options.wait || 500);
          frame.remove();
          window.removeEventListener("message", listener);
          return logs;
        },
        { html, code, options },
      );
    }
    const attacks = await run(`onmessage = async () => {
      const out = []; const report = (k,v) => out.push(k+':'+v);
      addEventListener('securitypolicyviolation',e=>report('CSP',e.violatedDirective+' '+e.blockedURI));
      function inherited(name) { let p=Object.getPrototypeOf(self); while(p&&!Object.hasOwn(p,name))p=Object.getPrototypeOf(p); return p?.[name]; }
      for(const key of ['document','Worker','SharedWorker','fetch','WebSocket','BroadcastChannel','cookieStore'])report(key,typeof self[key]);
      report('sendBeacon',typeof navigator.sendBeacon); report('parent',typeof parent);
      try { await import('https://audit.invalid/dynamic.js'); report('dynamic','ESCAPED'); } catch { report('dynamic','blocked'); }
      try { const f=inherited('fetch'); report('protoFetch',typeof f); await f.call(self,'https://audit.invalid/fetch'); report('prototypeFetch','ESCAPED'); } catch (e) { report('prototypeFetch','blocked ('+e.name+': '+e.message+')'); }
      try { const f=inherited('importScripts'); report('protoImportScripts',typeof f); f.call(self,'https://audit.invalid/import.js'); report('prototypeImportScripts','ESCAPED'); } catch (e) { report('prototypeImportScripts','blocked ('+e.name+': '+e.message+')'); }
      try { await import(URL.createObjectURL(new Blob(['export default 1'],{type:'text/javascript'}))); report('blobImport','ESCAPED'); } catch { report('blobImport','blocked'); }
      try { new Function('return 1')(); report('eval','ESCAPED'); } catch { report('eval','blocked'); }
      try { await caches.open('attack'); report('storage','ESCAPED'); } catch { report('storage','blocked'); }
      try { location.href='https://audit.invalid/navigate'; report('navigation',location.href.startsWith('https:')?'ESCAPED':'blocked'); } catch { report('navigation','blocked'); }
      await new Promise(r=>setTimeout(r,40));postMessage({description:out.join(';'),shapes:[]});
    }`);
    const scene = attacks.find((e) => e.type === "scene");
    assert.ok(scene, "Attack worker must actually execute and return evidence");
    assert.ok(
      !scene.data.description.includes("ESCAPED"),
      scene.data.description,
    );
    assert.ok(
      failed.some(
        (r) =>
          r.url === "https://audit.invalid/dynamic.js" &&
          r.failure?.errorText === "csp",
      ),
      "External import must be CSP-blocked, not merely unreachable",
    );
    assert.ok(
      failed.some(
        (r) => r.url.startsWith("blob:") && r.failure?.errorText === "csp",
      ),
      "Blob import must be CSP-blocked",
    );
    const forged = await run(
      'onmessage=()=>postMessage({description:"forged",shapes:[]})',
      { badCap: true },
    );
    assert.deepEqual(
      forged.map((e) => e.type),
      ["boot"],
      "Wrong capability must not start worker",
    );
    const loop = await run("onmessage=()=>{while(true){}}", { wait: 1800 });
    assert.ok(
      loop.some((e) => e.type === "error" && /response limit/.test(e.data)),
      "Infinite worker loop must time out",
    );
    const oversized = await run(
      'onmessage=()=>postMessage({description:"x".repeat(65000),shapes:[]})',
    );
    assert.ok(
      oversized.some((e) => e.type === "error"),
      "Oversized worker output must stop worker",
    );
    const cyclic = await run(
      "onmessage=()=>{const value={};value.self=value;postMessage(value)}",
    );
    assert.ok(
      cyclic.some((e) => e.type === "error"),
      "Cyclic worker output must stop worker",
    );
    console.log(
      JSON.stringify(
        {
          browser: await browser.version(),
          checks: {
            attackChannels: scene.data.description,
            forgedCapability: "blocked",
            infiniteLoop: "terminated",
            oversizedOutput: "terminated",
            cyclicOutput: "terminated",
          },
          failed,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
