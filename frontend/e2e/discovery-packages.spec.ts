import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
) as {
  parent_email: string;
  parent_password: string;
  child_email: string;
  child_password: string;
  child_name: string;
};
test.beforeAll(() => {
  execFileSync(
    process.env.PLAYWRIGHT_BACKEND_PYTHON!,
    ["-m", "scripts.seed_discovery_smoke"],
    { cwd: path.resolve("../backend"), env: process.env },
  );
});
async function signIn(page: Page, child = false) {
  await page.goto("/chore/login");
  await page
    .getByLabel("Email or Username")
    .fill(child ? fixture.child_email : fixture.parent_email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(child ? fixture.child_password : fixture.parent_password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/chore\/(parent\/dashboard|child\/today)$/);
}
function archive(example: string, id: string, version = "1.0.0") {
  return execFileSync(process.env.PLAYWRIGHT_BACKEND_PYTHON!, [
    "-c",
    `
import io,json,pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1]); manifest=json.loads((root/'manifest.json').read_text())
manifest['package_id']=manifest['exploration']['id']=sys.argv[2]
manifest['version']=sys.argv[3]
b=io.BytesIO()
with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('manifest.json',json.dumps(manifest))
 for asset in manifest['assets']: z.writestr(asset['path'],(root/asset['path']).read_bytes())
sys.stdout.buffer.write(b.getvalue())
`,
    path.resolve(`../docs/examples/discovery-packages/${example}`),
    id,
    version,
  ]);
}
async function upload(
  page: Page,
  example: string,
  id: string,
  version = "1.0.0",
) {
  if (!(await page.getByLabel("Upload package ZIP").isVisible())) {
    await page
      .getByRole("button", { name: "Package authoring", exact: true })
      .click();
  }
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/discovery/packages") &&
      response.request().method() === "GET",
  );
  await page.getByLabel("Upload package ZIP").setInputFiles({
    name: `${id}.zip`,
    mimeType: "application/zip",
    buffer: archive(example, id, version),
  });
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: `Uploaded ${id} version ${version}` }),
  ).toBeVisible();
  await refreshed;
  await page.getByLabel("Search packages").fill(id);
  const group = page
    .locator(".discovery-package-group")
    .filter({ has: page.getByRole("heading", { name: id, exact: true }) });
  await expect(group).toBeVisible();
  if (
    !(await group
      .getByRole("button", { name: `Preview ${version}`, exact: true })
      .isVisible())
  ) {
    await group.getByRole("button", { name: /^Other versions/ }).click();
  }
  await expect(
    group.getByRole("button", { name: `Preview ${version}`, exact: true }),
  ).toBeVisible();
  return group;
}
for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`publish a fresh package without rebuilding: ${viewport.name}`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto("/chore/discovery-lab/manage");
    // This marker proves subsequent upload, publication and client-side navigation
    // happen inside the already running app rather than a rebuilt/reloaded document.
    const marker = `loaded-before-upload-${viewport.name}`;
    await page.evaluate((value) => {
      (window as unknown as Record<string, unknown>).__packageBootProof = value;
    }, marker);
    const id = `live-spring-${viewport.name}`;
    const row = await upload(page, "spring-force", id);
    await row
      .getByRole("button", { name: "Preview 1.0.0", exact: true })
      .click();
    const preview = page.getByRole("region", { name: "Package preview" });
    await expect(preview.getByRole("img")).toBeVisible();
    const slider = preview.getByRole("slider");
    await slider.fill("0.1");
    await expect(
      preview.getByText(/Restoring force magnitude: 2.000 N/),
    ).toBeVisible();
    await preview.getByRole("button", { name: "Reset experiment" }).click();
    await expect(slider).toHaveValue("0.05");
    await preview.getByRole("button", { name: "Close preview" }).click();
    await expect(preview).toHaveCount(0);
    await row
      .getByRole("button", { name: "Publish 1.0.0", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: `Published ${id}` }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Back to the lab/ }).click();
    await page.locator(`a[href="/chore/discovery-lab/${id}"]`).click();
    await expect(
      page.getByRole("heading", {
        name: "Spring Force",
        level: 1,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /Restoring force magnitude/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>).__packageBootProof,
      ),
    ).toBe(marker);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL,
    });
    const childPage = await context.newPage();
    await signIn(childPage, true);
    expect(
      (
        await childPage.request.get(
          `/chore-api/discovery/explorations/${id}/package`,
        )
      ).status(),
    ).toBe(403);
    const children = (await (
      await page.request.get("/chore-api/discovery/children")
    ).json()) as { id: number; name: string }[];
    const childId = children.find(
      (child) => child.name === fixture.child_name,
    )!.id;
    const csrf = (await page.context().cookies()).find(
      (cookie) => cookie.name === "chore_tracker_csrf",
    )!.value;
    expect(
      (
        await page.request.put(
          `/chore-api/discovery/children/${childId}/access`,
          {
            headers: { "X-CSRF-Token": csrf },
            data: {
              enabled: true,
              exploration_ids: [id],
              package_versions: { [id]: "1.0.0" },
            },
          },
        )
      ).ok(),
    ).toBe(true);
    await childPage.goto(`/chore/discovery-lab/${id}`);
    await expect(
      childPage.getByRole("img", { name: /Restoring force magnitude/ }),
    ).toBeVisible();
    await context.setOffline(true);
    await expect(
      childPage.getByRole("alert").filter({ hasText: /Reconnect/ }),
    ).toBeVisible();
    await expect(childPage.getByRole("slider")).toHaveCount(0);
    await context.setOffline(false);
    await expect(
      childPage.getByRole("img", { name: /Restoring force magnitude/ }),
    ).toBeVisible();
    expect(
      (
        await page.request.put(
          `/chore-api/discovery/children/${childId}/access`,
          {
            headers: { "X-CSRF-Token": csrf },
            data: { enabled: false, exploration_ids: [id] },
          },
        )
      ).ok(),
    ).toBe(true);
    await expect(childPage.getByRole("alert")).toBeVisible({ timeout: 25_000 });
    await expect(childPage.getByRole("slider")).toHaveCount(0);
    await context.close();

    await page.goto("/chore/discovery-lab/manage");
    const workerId = `live-pendulum-${viewport.name}`;
    const workerRow = await upload(page, "pendulum-period", workerId);
    await workerRow
      .getByRole("button", { name: "Preview 1.0.0", exact: true })
      .click();
    const workerPreview = page.getByRole("region", { name: "Package preview" });
    await expect(workerPreview.getByRole("img")).toBeVisible();
    await expect(workerPreview.getByRole("slider")).toHaveCount(3);
    const length = workerPreview.getByRole("slider", { name: /^Length/ });
    await length.fill("2");
    await expect(workerPreview.getByRole("img")).toHaveAttribute(
      "aria-label",
      /2.84/,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const evidence = path.join(
      process.env.PLAYWRIGHT_SMOKE_DIR!,
      "package-evidence",
    );
    mkdirSync(evidence, { recursive: true, mode: 0o700 });
    await workerPreview.screenshot({
      path: path.join(evidence, `${viewport.name}-custom-preview.png`),
    });
    await workerPreview.getByRole("button", { name: "Close preview" }).click();
    await expect(
      page.locator('iframe[title="Isolated simulation engine"]'),
    ).toHaveCount(0);
    await workerRow
      .getByRole("button", { name: "Publish 1.0.0", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: `Published ${workerId}` }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Back to the lab/ }).click();
    await page.locator(`a[href="/chore/discovery-lab/${workerId}"]`).click();
    await expect(page.getByRole("img")).toBeVisible();
    await page
      .getByRole("button", { name: "Enlarge diagram", exact: true })
      .click();
    const enlarged = page.getByRole("region", { name: "Simulation diagram" });
    expect(
      await enlarged.evaluate(
        (element) => element.scrollWidth >= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Fit diagram", exact: true })
      .click();
    await page.getByRole("button", { name: "Reset experiment" }).click();
    await expect(page.getByRole("slider", { name: /^Length/ })).toHaveValue(
      "1",
    );
    await page.screenshot({
      path: path.join(evidence, `${viewport.name}-published-custom.png`),
      fullPage: true,
    });
    await page.getByRole("link", { name: /All Explorations/ }).click();
    await expect(
      page.locator('iframe[title="Isolated simulation engine"]'),
    ).toHaveCount(0);
    await page.goBack();
    await expect(page.getByRole("slider", { name: /^Length/ })).toHaveValue(
      "1",
    );
    await page.getByRole("link", { name: /All Explorations/ }).click();
    await page
      .getByRole("link", { name: /Choose Explorations for each child/ })
      .click();
    const upgraded = await upload(page, "pendulum-period", workerId, "1.1.0");
    await upgraded
      .getByRole("button", { name: "Preview 1.1.0", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Package preview" }).getByRole("img"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close preview" }).click();
    await upgraded
      .getByRole("button", { name: "Publish 1.1.0", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: `Published ${workerId} version 1.1.0` }),
    ).toBeVisible();
    const old = page
      .locator(".discovery-package-group")
      .filter({
        has: page.getByRole("heading", { name: workerId, exact: true }),
      });
    await expect(
      old.getByText("Current version: 1.1.0", { exact: true }),
    ).toBeVisible();
    if (
      !(await old
        .getByRole("button", { name: "Preview 1.0.0", exact: true })
        .isVisible())
    )
      await old.getByRole("button", { name: /^Other versions/ }).click();
    await old
      .getByRole("button", { name: "Publish 1.0.0", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: `Published ${workerId} version 1.0.0` }),
    ).toBeVisible();
    const rolledBack = await (
      await page.request.get(
        `/chore-api/discovery/explorations/${workerId}/package`,
      )
    ).json();
    expect(rolledBack.manifest.version).toBe("1.0.0");
  });
}
