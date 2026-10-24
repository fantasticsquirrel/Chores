import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
);
const output = path.join(process.env.PLAYWRIGHT_SMOKE_DIR!, "castle-parity");
let other: typeof fixture;
const python = process.env.PLAYWRIGHT_BACKEND_PYTHON!;
test.beforeAll(() => {
  execFileSync(python, ["-m", "scripts.seed_discovery_smoke"], {
    cwd: path.resolve("../backend"),
    env: process.env,
  });
  other = JSON.parse(
    execFileSync(python, ["-m", "scripts.seed_playwright_smoke"], {
      cwd: path.resolve("../backend"),
      env: process.env,
      encoding: "utf8",
    }),
  );
  const otherPath = path.join(
    process.env.PLAYWRIGHT_SMOKE_DIR!,
    "other-household.json",
  );
  writeFileSync(otherPath, JSON.stringify(other), { mode: 0o600 });
  execFileSync(python, ["-m", "scripts.seed_discovery_smoke"], {
    cwd: path.resolve("../backend"),
    env: { ...process.env, PLAYWRIGHT_SMOKE_FIXTURE_PATH: otherPath },
  });
  mkdirSync(output, { recursive: true, mode: 0o700 });
});
async function signIn(page: Page, credentials = fixture, child = false) {
  await page.goto("/chore/login");
  await page
    .getByLabel("Email or Username")
    .fill(child ? credentials.child_email : credentials.parent_email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(child ? credentials.child_password : credentials.parent_password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/(parent\/dashboard|child\/today)$/);
}
function bundleHash() {
  return createHash("sha256")
    .update(
      readdirSync("dist/assets")
        .sort()
        .map((n) =>
          createHash("sha256")
            .update(readFileSync(path.join("dist/assets", n)))
            .digest("hex"),
        )
        .join("\n"),
    )
    .digest("hex");
}
function archive(id: string, version: string, attack = "") {
  return execFileSync(python, [
    "-c",
    `
import io,json,pathlib,sys,zipfile,hashlib
root=pathlib.Path(sys.argv[1]); m=json.loads((root/'manifest.json').read_text()); m['package_id']=m['exploration']['id']=sys.argv[2]; m['version']=sys.argv[3]
assets={a['path']:(root/a['path']).read_bytes() for a in m['assets']}
if sys.argv[3]=='1.1.0':
 code=assets[m['entry']].decode()
 assert 'color: 13946036' in code and 'gate: (values.gate ?? 1) === 1' in code
 code=code.replace('color: 13946036','color: 14203296').replace('gate: (values.gate ?? 1) === 1','gate: (values.gate ?? 0) === 1')
 assets[m['entry']]=code.encode()
 for a in m['assets']: a['sha256']=hashlib.sha256(assets[a['path']]).hexdigest()
if sys.argv[4]:
 code=assets[m['entry']].decode()
 if sys.argv[4]=='hang-after-output':
  assert 'self.onmessage = ({ data }) => self.postMessage(run(data));' in code
  code=code.replace('self.onmessage = ({ data }) => self.postMessage(run(data));','self.onmessage = ({ data }) => { self.postMessage(run(data)); while (true) {} };')
 elif sys.argv[4]=='invalid-scene': code='self.onmessage=()=>self.postMessage({description:"Invalid scene test",animate:false,shapes:[],controls:[],scene3d:{url:"https://blocked.invalid/asset"}});'
 elif sys.argv[4]=='capabilities':
  code=code.replace('self.onmessage = ({ data }) => self.postMessage(run(data));',"self.onmessage=async({data})=>{const s=run(data);let r='document='+typeof document+';fetch='+typeof fetch+';Worker='+typeof Worker+';storage='+typeof localStorage;try{await import('https://blocked.invalid/module.js');r+=';import=ESCAPED'}catch{r+=';import=blocked'}try{await Object.getPrototypeOf(self).fetch.call(self,'https://blocked.invalid/fetch');r+=';prototypeFetch=ESCAPED'}catch{r+=';prototypeFetch=blocked'}s.description=r;self.postMessage(s)};")
 assets[m['entry']]=code.encode()
 for a in m['assets']: a['sha256']=hashlib.sha256(assets[a['path']]).hexdigest()
b=io.BytesIO()
with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('manifest.json',json.dumps(m))
 for name,content in assets.items(): z.writestr(name,content)
sys.stdout.buffer.write(b.getvalue())
`,
    path.resolve("../docs/examples/discovery-packages/castle-defenses"),
    id,
    version,
    attack,
  ]);
}
async function upload(page: Page, id: string, version: string, attack = "") {
  await page.getByLabel("Upload package ZIP").setInputFiles({
    name: `${id}-${version}.zip`,
    mimeType: "application/zip",
    buffer: archive(id, version, attack),
  });
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: `Uploaded ${id} version ${version}` }),
  ).toBeVisible();
  return page
    .locator(".discovery-package-author > ul > li")
    .filter({ hasText: id })
    .filter({
      has: page.getByRole("button", {
        name: `Preview ${version}`,
        exact: true,
      }),
    });
}
async function captures(page: Page, prefix: string, packaged: boolean) {
  const visual = page.locator(
    packaged ? ".package-3d-visual" : ".castle-visual",
  );
  const canvas = visual.locator("canvas");
  await expect(canvas).toBeVisible();
  const snap = async (name: string) => {
    await visual.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    await visual.screenshot({
      path: path.join(output, `${prefix}-${name}.png`),
    });
    const raw = await canvas.evaluate(
      (c: HTMLCanvasElement) => c.toDataURL("image/png").split(",")[1],
    );
    writeFileSync(
      path.join(output, `${prefix}-${name}-raw.png`),
      Buffer.from(raw, "base64"),
    );
  };
  await snap("courtyard");
  for (const [label, name] of [
    ["Entrance", "entrance"],
    ["North wall", "north"],
    ["Above", "above"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await snap(name);
  }
  await page.getByRole("button", { name: "Courtyard", exact: true }).click();
  const toggle = async (name: string, checked: boolean) => {
    await page.getByRole("checkbox", { name, exact: true }).setChecked(checked);
    await page.waitForTimeout(120);
  };
  await toggle("Sight-line overlay (not structures)", true);
  await snap("sight");
  await toggle("Projecting towers", false);
  await snap("no-towers");
  await page
    .getByRole("button", {
      name: packaged ? "Reset experiment" : "Reset design",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Sight-line overlay (not structures)",
      exact: true,
    }),
  ).not.toBeChecked();
  await toggle("Close gate", false);
  await snap("open-gate");
  await page
    .getByRole("combobox", { name: "Approach route", exact: true })
    .selectOption(packaged ? "1" : "north");
  await page.waitForTimeout(120);
  await snap("north-route");
  await toggle("Inner wall", true);
  await snap("inner-wall");
  await page
    .locator(".discovery-experiment-stage")
    .screenshot({ path: path.join(output, `${prefix}-full.png`) });
  return canvas.boundingBox();
}
for (const viewport of [
  { name: "desktop", width: 1440, height: 1050 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`Castle package visual and publication proof: ${viewport.name}`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const requests: string[] = [];
    const failedRequests: { url: string; error: string | undefined }[] = [];
    const externalResponses: string[] = [];
    const cspMessages: string[] = [];
    page.on("requestfailed", (r) =>
      failedRequests.push({ url: r.url(), error: r.failure()?.errorText }),
    );
    page.on("response", (r) => {
      if (
        !r.url().startsWith(process.env.PLAYWRIGHT_BASE_URL!) &&
        !r.url().startsWith("blob:")
      )
        externalResponses.push(r.url());
    });
    page.on("console", (m) => {
      if (/content.security.policy|violates.*policy/i.test(m.text()))
        cspMessages.push(m.text());
    });
    page.on("request", (r) => requests.push(r.url()));
    const initialBuild = bundleHash();
    await signIn(page);
    await page.goto("/chore/discovery-lab/castle-defenses");
    const originalSize = await captures(
      page,
      `original-${viewport.name}`,
      false,
    );
    await page.goto("/chore/discovery-lab/manage");
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__castleBoot =
        "same-app-before-upload";
    });
    const id = `castle-proof-${viewport.name}`;
    const row = await upload(page, id, "1.0.0");
    await row
      .getByRole("button", { name: "Preview 1.0.0", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Package preview" })
        .locator(".package-3d-canvas canvas"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
    await expect(
      page.locator('iframe[title="Isolated simulation engine"]'),
    ).toHaveCount(0);
    await row
      .getByRole("button", { name: "Publish 1.0.0", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: `Published ${id} version 1.0.0` }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Back to the lab/ }).click();
    await page.locator(`a[href="/chore/discovery-lab/${id}"]`).click();
    const packagedSize = await captures(
      page,
      `packaged-${viewport.name}`,
      true,
    );
    const pixelStates = [
      "courtyard",
      "entrance",
      "north",
      "above",
      "sight",
      "no-towers",
      "open-gate",
      "north-route",
      "inner-wall",
    ];
    for (const state of pixelStates) {
      const hash = (prefix: string) =>
        createHash("sha256")
          .update(
            readFileSync(
              path.join(output, `${prefix}-${viewport.name}-${state}-raw.png`),
            ),
          )
          .digest("hex");
      expect(
        hash("packaged"),
        `${viewport.name} ${state} raw render parity`,
      ).toBe(hash("original"));
    }
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).__castleBoot,
      ),
    ).toBe("same-app-before-upload");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Reset experiment", exact: true })
      .click();
    const surface = page.locator(".package-3d-canvas");
    const buffer = () =>
      surface
        .locator("canvas")
        .evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.getByRole("button", { name: "Courtyard", exact: true }).click();
    const cameraStart = await buffer();
    await surface.focus();
    await page.keyboard.press("ArrowLeft");
    expect(await buffer()).not.toBe(cameraStart);
    await page.keyboard.press("Home");
    expect(await buffer()).toBe(cameraStart);
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    expect(await buffer()).not.toBe(cameraStart);
    await surface.focus();
    await page.keyboard.press("Home");
    expect(await buffer()).toBe(cameraStart);
    const bounds = await surface.boundingBox();
    await page.mouse.move(
      bounds!.x + bounds!.width / 2,
      bounds!.y + bounds!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds!.x + bounds!.width / 2 + 35,
      bounds!.y + bounds!.height / 2 + 12,
    );
    await page.mouse.up();
    expect(await buffer()).not.toBe(cameraStart);
    await surface.focus();
    await page.keyboard.press("Home");
    expect(await buffer()).toBe(cameraStart);
    await page
      .getByRole("button", { name: "Compare sight lines", exact: true })
      .click();
    await page.getByRole("button", { name: "Predict no", exact: true }).click();
    await page
      .getByRole("button", { name: "Remove corner towers", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "Projecting towers", exact: true }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("checkbox", {
        name: "Sight-line overlay (not structures)",
        exact: true,
      }),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Restore towers", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "Projecting towers", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Reset experiment", exact: true })
      .click();
    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL,
    });
    const child = await context.newPage();
    await signIn(child, fixture, true);
    const packageURL = `/chore-api/discovery/explorations/${id}/package`;
    expect((await child.request.get(packageURL)).status()).toBe(403);
    const children = await (
      await page.request.get("/chore-api/discovery/children")
    ).json();
    const childId = children.find(
      (c: { name: string }) => c.name === fixture.child_name,
    ).id;
    const csrf = (await page.context().cookies()).find(
      (c) => c.name === "chore_tracker_csrf",
    )!.value;
    const approve = async (version: string) =>
      expect(
        (
          await page.request.put(
            `/chore-api/discovery/children/${childId}/access`,
            {
              headers: { "X-CSRF-Token": csrf },
              data: {
                enabled: true,
                exploration_ids: [id],
                package_versions: { [id]: version },
              },
            },
          )
        ).ok(),
      ).toBe(true);
    await approve("1.0.0");
    await child.goto(`/chore/discovery-lab/${id}`);
    await expect(child.locator(".package-3d-canvas canvas")).toBeVisible();
    await context.setOffline(true);
    await expect(
      child.getByRole("alert").filter({ hasText: /Reconnect/ }),
    ).toBeVisible();
    await expect(child.locator("canvas")).toHaveCount(0);
    await expect(child.locator("iframe")).toHaveCount(0);
    await context.setOffline(false);
    await expect(child.locator(".package-3d-canvas canvas")).toBeVisible();
    const otherContext = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL,
    });
    const otherPage = await otherContext.newPage();
    await signIn(otherPage, other);
    expect((await otherPage.request.get(packageURL)).status()).toBe(404);
    await otherContext.close();
    await page.getByRole("link", { name: /All Explorations/ }).click();
    await page
      .getByRole("link", { name: /Choose Explorations for each child/ })
      .click();
    const v2 = await upload(page, id, "1.1.0");
    await v2
      .getByRole("button", { name: "Publish 1.1.0", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: `Published ${id} version 1.1.0` }),
    ).toBeVisible();
    expect((await child.request.get(packageURL)).status()).toBe(403);
    await expect(child.getByRole("alert")).toBeVisible({ timeout: 25000 });
    await expect(child.locator("canvas")).toHaveCount(0);
    await page.getByRole("link", { name: /Back to the lab/ }).click();
    await page.locator(`a[href="/chore/discovery-lab/${id}"]`).click();
    await expect(page.locator(".package-3d-canvas canvas")).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Close gate", exact: true }),
    ).not.toBeChecked();
    await page.locator(".package-3d-visual").screenshot({
      path: path.join(output, `updated-${viewport.name}-v2.png`),
    });
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).__castleBoot,
      ),
    ).toBe("same-app-before-upload");
    expect(bundleHash()).toBe(initialBuild);
    await approve("1.1.0");
    await child.reload();
    await expect(child.locator(".package-3d-canvas canvas")).toBeVisible();
    await expect(
      child.getByRole("checkbox", { name: "Close gate", exact: true }),
    ).not.toBeChecked();
    await context.close();
    const isExternal = (u: string) =>
      !u.startsWith(process.env.PLAYWRIGHT_BASE_URL!) && !u.startsWith("blob:");
    expect(requests.filter(isExternal)).toEqual([]);
    if (viewport.name === "desktop") {
      await page.getByRole("link", { name: /All Explorations/ }).click();
      await page
        .getByRole("link", { name: /Choose Explorations for each child/ })
        .click();
      const capability = await upload(
        page,
        "castle-proof-capabilities",
        "1.0.0",
        "capabilities",
      );
      await capability
        .getByRole("button", { name: "Preview 1.0.0", exact: true })
        .click();
      const safePreview = page.getByRole("region", { name: "Package preview" });
      await expect(safePreview.getByRole("img")).toHaveAttribute(
        "aria-label",
        "document=undefined;fetch=undefined;Worker=undefined;storage=undefined;import=blocked;prototypeFetch=blocked",
      );
      await safePreview
        .getByRole("button", { name: "Close preview", exact: true })
        .click();
      for (const attack of ["hang-after-output", "invalid-scene"]) {
        const hostile = await upload(
          page,
          `castle-proof-${attack}`,
          "1.0.0",
          attack,
        );
        await hostile
          .getByRole("button", { name: "Preview 1.0.0", exact: true })
          .click();
        const preview = page.getByRole("region", { name: "Package preview" });
        await expect(preview.getByRole("alert")).toBeVisible({
          timeout: 10000,
        });
        await expect(preview.locator("iframe")).toHaveCount(0);
        await expect(preview.locator("canvas")).toHaveCount(0);
        await preview
          .getByRole("button", { name: "Close preview", exact: true })
          .click();
      }
    }
    const external = requests.filter(
      (u) =>
        !u.startsWith(process.env.PLAYWRIGHT_BASE_URL!) &&
        !u.startsWith("blob:"),
    );
    writeFileSync(
      path.join(output, `${viewport.name}-network-audit.json`),
      JSON.stringify(
        { external, externalResponses, failedRequests, cspMessages },
        null,
        2,
      ),
    );
    expect(externalResponses).toEqual([]);
    for (const url of external) {
      expect(url).toBe("https://blocked.invalid/module.js");
      expect(
        failedRequests.some(
          (r) =>
            r.url === url &&
            /^(csp|net::ERR_BLOCKED_BY_CSP)$/.test(r.error ?? ""),
        ),
      ).toBe(true);
    }

    expect(errors).toEqual([]);
    writeFileSync(
      path.join(output, `${viewport.name}-report.json`),
      JSON.stringify(
        {
          originalSize,
          packagedSize,
          initialBuild,
          finalBuild: bundleHash(),
          errors,
          externalRequests: external,
          externalResponses,
          failedRequests: failedRequests.filter((r) => isExternal(r.url)),
          cspMessages,
          publishV1V2: true,
          childVersionApproval: true,
          householdIsolation: true,
          offlineFailClosed: true,
          bootMarkerPreserved: true,
          exactRawCanvasStates: pixelStates,
        },
        null,
        2,
      ),
    );
  });
}
