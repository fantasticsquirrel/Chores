import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
);
test.beforeAll(() => {
  execFileSync(
    process.env.PLAYWRIGHT_BACKEND_PYTHON!,
    ["-m", "scripts.seed_discovery_smoke"],
    { cwd: path.resolve("../backend"), env: process.env },
  );
});
for (const mobile of [false, true]) {
  test(`Tactile geometry and sampled evidence ${mobile ? "touch" : "desktop"}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1050 },
      hasTouch: mobile,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const base = process.env.PLAYWRIGHT_BASE_URL!;
    await page.goto(`${base}/chore/login`);
    await page.getByLabel("Email or Username").fill(fixture.parent_email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(fixture.parent_password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/parent\/dashboard$/);
    await page.goto(`${base}/chore/discovery-lab/fraction-feast`);
    const canvas = page.locator(".fraction-render canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const position = {
      x: box!.width * (mobile ? 0.65 : 0.34),
      y: box!.height * (mobile ? 0.3 : 0.43),
    };
    if (mobile) await canvas.tap({ position });
    else await canvas.click({ position });
    await expect(page.getByRole("status")).toContainText("0/2 < 2/4");
    await page
      .getByRole("button", { name: "Plate A slice 2", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Split every slice", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("2/4 = 2/4");
    await page
      .getByLabel("Equal parts in this whole", { exact: true })
      .selectOption("3");
    await page.getByRole("button", { name: "Plate B", exact: true }).click();
    await page.getByLabel("Selected slices", { exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page
      .getByRole("button", { name: "Combine slices", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("17/12 wholes");
    const folder = path.join(
      process.env.PLAYWRIGHT_SMOKE_DIR!,
      "tactile-interactions",
    );
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    await page
      .locator(".fraction-combined")
      .screenshot({
        path: path.join(
          folder,
          `${mobile ? "android" : "desktop"}-combined-fractions.png`,
        ),
      });
    await page.goto(`${base}/chore/discovery-lab/pattern-palace`);
    await page
      .getByRole("button", { name: "Test 4 pentagons", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("72° overlap");
    await page
      .locator(".pattern-workbench")
      .screenshot({
        path: path.join(
          folder,
          `${mobile ? "android" : "desktop"}-pentagon-overlap.png`,
        ),
      });
    await page
      .getByLabel("Regular tile shape", { exact: true })
      .selectOption("4");
    await expect(page.getByRole("status")).toContainText("360°: an exact fit");
    await page.getByRole("button", { name: "Turn 90°", exact: true }).click();
    await page.getByLabel("Reflect left to right", { exact: true }).check();
    await expect(page.getByRole("status")).toContainText(
      "Red dot: lower right",
    );
    await page.goto(`${base}/chore/discovery-lab/chance-carnival`);
    await expect(page.locator(".chance-render canvas")).toBeVisible();
    for (const outcome of [1, 2, 3]) {
      await page
        .getByLabel("Adjust outcome", { exact: true })
        .selectOption(String(outcome));
      await page
        .getByLabel(`Outcome ${outcome + 1} weight`, { exact: true })
        .focus();
      await page.keyboard.press("Home");
    }
    await page.getByRole("button", { name: "Run trials", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(
      "Outcome 1: theory 100.0% · observed 10 (100.0%)",
    );
    await expect(page.getByTestId("chance-last-outcome")).toHaveText("1");
    await page.getByLabel("Chance device", { exact: true }).selectOption("die");
    await page
      .getByLabel("Trials in next batch", { exact: true })
      .selectOption("10000");
    await page.getByRole("button", { name: "Run trials", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(
      "Trials recorded: 10,000",
    );
    await expect(page.getByTestId("chance-last-outcome")).toHaveText(/^[1-6]$/);
    await page
      .locator(".chance-table")
      .screenshot({
        path: path.join(
          folder,
          `${mobile ? "android" : "desktop"}-die-sample.png`,
        ),
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await context.close();
  });
}
