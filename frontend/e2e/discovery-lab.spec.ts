import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.use({ actionTimeout: 15_000 });

type Fixture = {
  parent_email: string;
  parent_password: string;
  child_email: string;
  child_password: string;
  child_name: string;
};
const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
) as Fixture;
const catalog = JSON.parse(
  readFileSync(
    path.resolve("../packages/family-api/discovery-explorations.json"),
    "utf8",
  ),
) as Array<{ id: string; subject: string }>;
const explorationIds = catalog.map((entry) => entry.id);
const physicsCount = catalog.filter(
  (entry) => entry.subject === "Physics",
).length;

test.beforeAll(() => {
  execFileSync(
    process.env.PLAYWRIGHT_BACKEND_PYTHON!,
    ["-m", "scripts.seed_discovery_smoke"],
    {
      cwd: path.resolve("../backend"),
      env: process.env,
    },
  );
});

async function signIn(page: Page, child = false) {
  await page.context().clearCookies();
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

async function checkLayout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1050 },
  { name: "android", width: 390, height: 844 },
]) {
  test(`Discovery Lab learning and parent access ${viewport.name}`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const health = await page.request.get("/chore-api/health/ready");
    expect((await health.json()).playwright_smoke_run_id).toBe(
      process.env.PLAYWRIGHT_SMOKE_RUN_ID,
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signIn(page);
    const children = await (
      await page.request.get("/chore-api/discovery/children")
    ).json();
    const childId = children.find(
      (child: { name: string }) => child.name === fixture.child_name,
    ).id;
    const csrf = (await page.context().cookies()).find(
      (cookie) => cookie.name === "chore_tracker_csrf",
    )!.value;
    // Each viewport starts with the same persisted, explicitly enabled catalog.
    expect(
      (
        await page.request.put(
          `/chore-api/discovery/children/${childId}/access`,
          {
            headers: { "X-CSRF-Token": csrf },
            data: { enabled: true, exploration_ids: explorationIds },
          },
        )
      ).ok(),
    ).toBe(true);
    await page.goto("/chore/discovery-lab");
    await expect(
      page.getByRole("heading", { name: /^Discovery Lab$/ }),
    ).toBeVisible();
    await checkLayout(page);
    const evidence = path.join(
      process.env.PLAYWRIGHT_SMOKE_DIR!,
      "discovery-evidence",
    );
    mkdirSync(evidence, { recursive: true, mode: 0o700 });
    await page.screenshot({
      path: path.join(evidence, `${viewport.name}-catalog.png`),
      fullPage: true,
    });
    for (const id of explorationIds) {
      await page.goto(`/chore/discovery-lab/${id}`);
      await expect(page.getByRole("img").first()).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const controlLabels: Record<string, string> = {
        "solar-system": "Model time",
        gravity: "Timeline",
        "sound-playground": "String length",
        "bridge-builder": "Load position",
        "river-sculptor": "Channel slope",
        "circuit-city": "Battery voltage",
        "fraction-feast": "Selected slices",
        "pattern-palace": "Motif rotation",
        "caravan-crossroads": "Cargo units",
        "pollinator-express": "Flight reach",
        "chance-carnival": "Outcome 1 weight",
        "machine-workshop": "Lift height",
      };
      const scene = page.getByRole("img").first();
      await page.waitForLoadState("networkidle");
      // Capture the composed pixels: WebGL renderers may discard their drawing
      // buffer between frames, so canvas.toDataURL can be blank despite a valid scene.
      const drawing = async () =>
        createHash("sha256")
          .update(await scene.screenshot({ animations: "disabled" }))
          .digest("hex");
      const priorDrawing = await drawing();
      if (id === "cell-explorer") {
        await page
          .getByRole("button", { name: "Transfer one step", exact: true })
          .click();
      } else if (id === "adaptation-island") {
        await page
          .getByRole("button", { name: "Next generation", exact: true })
          .click();
      } else if (id === "shape-slicer") {
        await page
          .getByRole("button", { name: "Diagonal cube cut", exact: true })
          .click();
      } else if (id === "food-web-rescue") {
        await page
          .getByRole("button", { name: "Advance one week", exact: true })
          .click();
      } else {
        const label = controlLabels[id];
        const range = label
          ? page.getByRole("slider", { name: label, exact: true })
          : page.locator('input[type="range"]').first();
        await range.focus();
        for (let step = 0; step < 5; step++)
          await page.keyboard.press("ArrowRight");
      }
      await expect.poll(drawing).not.toBe(priorDrawing);
      if (id === "moon-phases") {
        await page
          .getByRole("button", { name: "Quarter", exact: true })
          .click();
        await expect(page.locator(".dl-readout")).toContainText("50%");
      }
      await checkLayout(page);
      await page.screenshot({
        path: path.join(evidence, `${viewport.name}-${id}.png`),
        fullPage: true,
      });
    }
    await page.goto("/chore/discovery-lab/manage");
    const switches = page.getByRole("checkbox");
    await expect(switches).toHaveCount(explorationIds.length);
    await page
      .getByRole("combobox", { name: "Subject", exact: true })
      .selectOption("Physics");
    await expect(switches).toHaveCount(physicsCount);
    await page
      .getByRole("button", {
        name: `Turn off ${physicsCount} matching explorations`,
        exact: true,
      })
      .click();
    await expect(page.getByRole("status")).toContainText(
      `Updated ${physicsCount} explorations`,
    );
    await expect(switches.first()).not.toBeChecked();
    await page
      .getByRole("button", {
        name: `Turn on ${physicsCount} matching explorations`,
        exact: true,
      })
      .click();
    await expect(switches.first()).toBeChecked();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await expect(switches).toHaveCount(explorationIds.length);
    await switches.first().click();
    await expect(switches.first()).not.toBeChecked();
    await expect(page.getByRole("status")).toContainText(
      "Updated 1 exploration",
    );
    await page.screenshot({
      path: path.join(evidence, `${viewport.name}-parent-controls.png`),
      fullPage: true,
    });
    const access = await (
      await page.request.get(`/chore-api/discovery/children/${childId}/access`)
    ).json();
    const disabled = access.explorations.find(
      (entry: { enabled: boolean }) => !entry.enabled,
    );
    expect(disabled).toBeTruthy();
    await signIn(page, true);
    await page.goto("/chore/discovery-lab");
    await expect(
      page.getByRole("heading", { name: /^Discovery Lab$/ }),
    ).toBeVisible();
    expect(await page.locator(`a[href$="/${disabled.id}"]`).count()).toBe(0);
    await page.goto(`/chore/discovery-lab/${disabled.id}`);
    await expect(page.getByRole("alert")).toContainText("not enabled");
    expect(
      (
        await page.request.get(
          `/chore-api/discovery/explorations/${disabled.id}`,
        )
      ).status(),
    ).toBe(403);
    expect(errors).toEqual([]);
  });
}
