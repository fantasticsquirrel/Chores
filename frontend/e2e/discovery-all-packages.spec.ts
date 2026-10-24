import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
);
let childId: number;
const python = process.env.PLAYWRIGHT_BACKEND_PYTHON!;
const registry = JSON.parse(
  readFileSync("../packages/family-api/discovery-explorations.json", "utf8"),
) as { id: string }[];
const selection = process.env.DISCOVERY_PACKAGE_IDS?.split(",");
const topics = registry.filter(
  (item) => !selection || selection.includes(item.id),
);
const output = path.join(
  process.env.PLAYWRIGHT_SMOKE_DIR!,
  "all-package-browser",
);
test.beforeAll(() => {
  execFileSync(python, ["-m", "scripts.seed_discovery_smoke"], {
    cwd: path.resolve("../backend"),
    env: process.env,
  });
});
function bundleHash() {
  return createHash("sha256")
    .update(
      readdirSync("dist/assets")
        .sort()
        .map((name) =>
          createHash("sha256")
            .update(readFileSync(path.join("dist/assets", name)))
            .digest("hex"),
        )
        .join("\n"),
    )
    .digest("hex");
}
function archive(topic: string, version: string) {
  return execFileSync(
    python,
    [
      "-c",
      `
import io,json,pathlib,sys,zipfile,hashlib
root=pathlib.Path(sys.argv[1]); m=json.loads((root/'manifest.json').read_text()); m['version']=sys.argv[2]
assets={a['path']:(root/a['path']).read_bytes() for a in m['assets']}
if m['version']=='1.1.0':
 code=assets[m['entry']].decode()+"\\n;const originalPost=self.postMessage.bind(self);self.postMessage=(s)=>{s.description='Revision two. '+s.description;if(s.scene3d?.materials?.[0])s.scene3d.materials[0].color=16711935;originalPost(s)};"
 assets[m['entry']]=code.encode()
 for a in m['assets']: a['sha256']=hashlib.sha256(assets[a['path']]).hexdigest()
b=io.BytesIO()
with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('manifest.json',json.dumps(m))
 for name,data in assets.items():z.writestr(name,data)
sys.stdout.buffer.write(b.getvalue())
`,
      path.resolve("../docs/examples/discovery-packages", topic),
      version,
    ],
    { maxBuffer: 12 * 1024 * 1024 },
  );
}
async function signIn(page: Page, child = false) {
  await page.goto("/chore/login");
  await page
    .getByLabel("Email or Username")
    .fill(child ? fixture.child_email : fixture.parent_email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(child ? fixture.child_password : fixture.parent_password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/(parent\/dashboard|child\/today)$/);
}
async function csrf(page: Page) {
  return (await page.context().cookies()).find(
    (cookie) => cookie.name === "chore_tracker_csrf",
  )!.value;
}
async function post(page: Page, url: string, data?: unknown) {
  const response = await page.request.post(`/chore-api${url}`, {
    headers: { "X-CSRF-Token": await csrf(page) },
    data,
  });
  expect(response.ok(), `${url}: ${await response.text()}`).toBe(true);
}
async function grant(page: Page, id: string, version: string, enabled = true) {
  const response = await page.request.put(
    `/chore-api/discovery/children/${childId}/access`,
    {
      headers: { "X-CSRF-Token": await csrf(page) },
      data: {
        exploration_ids: [id],
        enabled,
        package_versions: { [id]: version },
      },
    },
  );
  expect(response.ok(), await response.text()).toBe(true);
}

test("all rich packages render desktop/mobile, update and roll back without rebuilding", async ({
  page,
  browser,
}) => {
  test.setTimeout(900_000);
  mkdirSync(output, { recursive: true, mode: 0o700 });
  await signIn(page);
  const children = await (
    await page.request.get("/chore-api/discovery/children")
  ).json();
  childId = children.find(
    (entry: { name: string }) => entry.name === fixture.child_name,
  ).id;
  const childContext = await browser.newContext();
  const child = await childContext.newPage();
  await signIn(child, true);
  const initialBuild = bundleHash();
  for (const { id: topic } of topics) {
    const id = `${topic}-package`;
    const originalAccess = (
      await child.request.get(`/chore-api/discovery/explorations/${topic}`)
    ).status();
    await post(page, "/discovery/packages", {
      archive_base64: archive(topic, "1.0.0").toString("base64"),
    });
    await post(page, `/discovery/packages/${id}/versions/1.0.0/publish`);
    expect(
      (
        await child.request.get(
          `/chore-api/discovery/explorations/${id}/package`,
        )
      ).status(),
    ).toBe(403);
    await grant(page, id, "1.0.0");
    expect(
      (
        await child.request.get(
          `/chore-api/discovery/explorations/${id}/package`,
        )
      ).ok(),
    ).toBe(true);
    for (const viewport of [
      { name: "desktop", width: 1280, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/chore/discovery-lab/${topic}`);
      await expect(page.locator(".discovery-experiment-stage")).toBeVisible();
      await page.waitForTimeout(250);
      await page.locator(".discovery-experiment-stage").screenshot({
        path: path.join(output, `${topic}-${viewport.name}-original.png`),
      });
      await page.goto(`/chore/discovery-lab/${id}`);
      const runtime = page.locator(".discovery-package-runtime");
      await expect(
        runtime.locator(".discovery-package-evidence"),
      ).toBeVisible();
      await expect(runtime.getByRole("alert")).toHaveCount(0);
      await expect(
        runtime.getByRole("button", { name: "Reset experiment", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.waitForTimeout(200);
      await page.locator(".discovery-experiment-stage").screenshot({
        path: path.join(output, `${topic}-${viewport.name}-package.png`),
      });
      await runtime
        .getByRole("button", { name: "Reset experiment", exact: true })
        .click();
      await expect(runtime.getByRole("alert")).toHaveCount(0);
      if (topic === "solar-system" && viewport.name === "desktop") {
        // This package exceeds the memory-cache threshold. An authorization
        // refresh returns a new payload object but must not strand its worker.
        await page.waitForTimeout(16_000);
        await runtime
          .getByRole("combobox", { name: "Choose a planet" })
          .selectOption("7");
        await expect(
          runtime.locator(".discovery-package-evidence"),
        ).toContainText("Neptune");
      }
    }
    await post(page, "/discovery/packages", {
      archive_base64: archive(topic, "1.1.0").toString("base64"),
    });
    await post(page, `/discovery/packages/${id}/versions/1.1.0/publish`);
    expect(
      (
        await child.request.get(
          `/chore-api/discovery/explorations/${id}/package`,
        )
      ).status(),
    ).toBe(403);
    await grant(page, id, "1.1.0");
    await page.reload();
    await expect(page.locator(".discovery-package-evidence")).toContainText(
      "Revision two.",
    );
    await post(page, `/discovery/packages/${id}/versions/1.0.0/publish`);
    expect(
      (
        await child.request.get(
          `/chore-api/discovery/explorations/${id}/package`,
        )
      ).status(),
    ).toBe(403);
    await grant(page, id, "1.0.0");
    await page.reload();
    await expect(page.locator(".discovery-package-evidence")).not.toContainText(
      "Revision two.",
    );
    expect(
      (
        await child.request.get(`/chore-api/discovery/explorations/${topic}`)
      ).status(),
    ).toBe(originalAccess);
    expect(bundleHash()).toBe(initialBuild);
    console.log(
      `VERIFIED ${topic}: desktop/mobile, default deny, version approval, update, rollback, unchanged build`,
    );
  }
  await childContext.close();
});

test("Castle retains its package-owned plan when WebGL is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      kind: string,
      ...args: unknown[]
    ) {
      if (
        kind === "webgl" ||
        kind === "webgl2" ||
        kind === "experimental-webgl"
      )
        return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  await signIn(page);
  const id = "castle-defenses-package";
  if (
    (
      await page.request.get(
        `/chore-api/discovery/packages/${id}/versions/1.0.0`,
      )
    ).status() === 404
  ) {
    await post(page, "/discovery/packages", {
      archive_base64: archive("castle-defenses", "1.0.0").toString("base64"),
    });
  }
  await post(page, `/discovery/packages/${id}/versions/1.0.0/publish`);
  await page.goto(`/chore/discovery-lab/${id}`);
  await expect(page.getByRole("img", { name: /Castle plan:/ })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Close gate", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Close gate", exact: true })
    .uncheck();
  await expect(
    page.getByRole("img", { name: /Castle plan:.*reaches outer entrance/ }),
  ).toBeVisible();
});

test("rich child execution stops offline and after parent revocation", async ({
  page,
  browser,
}) => {
  await signIn(page);
  const children = await (
    await page.request.get("/chore-api/discovery/children")
  ).json();
  childId = children.find(
    (entry: { name: string }) => entry.name === fixture.child_name,
  ).id;
  const id = "gravity-package";
  if (
    (
      await page.request.get(
        `/chore-api/discovery/packages/${id}/versions/1.0.0`,
      )
    ).status() === 404
  ) {
    await post(page, "/discovery/packages", {
      archive_base64: archive("gravity", "1.0.0").toString("base64"),
    });
  }
  await post(page, `/discovery/packages/${id}/versions/1.0.0/publish`);
  await grant(page, id, "1.0.0");
  const context = await browser.newContext();
  const child = await context.newPage();
  await signIn(child, true);
  await child.goto(`/chore/discovery-lab/${id}`);
  await expect(child.locator(".discovery-package-evidence")).toBeVisible();
  await context.setOffline(true);
  await expect(child.getByRole("alert")).toContainText("Reconnect");
  await expect(
    child.locator('iframe[title="Isolated simulation engine"]'),
  ).toHaveCount(0);
  await context.setOffline(false);
  await child.reload();
  await expect(child.locator(".discovery-package-evidence")).toBeVisible();
  await grant(page, id, "1.0.0", false);
  await child.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(child.getByRole("alert")).toContainText(
    /no longer available|not enabled/,
  );
  await expect(
    child.locator('iframe[title="Isolated simulation engine"]'),
  ).toHaveCount(0);
  await context.close();
});
