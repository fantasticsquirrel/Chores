import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
);
const topics = (
  process.env.DISCOVERY_VISUAL_TOPICS ??
  "photosynthesis,reflection-refraction,castle-defenses"
).split(",");
test.beforeAll(() => {
  execFileSync(
    process.env.PLAYWRIGHT_BACKEND_PYTHON!,
    ["-m", "scripts.seed_discovery_smoke"],
    { cwd: path.resolve("../backend"), env: process.env },
  );
});
for (const viewport of [
  { name: "desktop", width: 1440, height: 1050 },
  { name: "android", width: 390, height: 844 },
]) {
  test(`Rendered learning visuals ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/chore/login");
    await page.getByLabel("Email or Username").fill(fixture.parent_email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(fixture.parent_password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/parent\/dashboard$/);
    const destination = path.join(
      process.env.PLAYWRIGHT_SMOKE_DIR!,
      "visual-review",
    );
    mkdirSync(destination, { recursive: true, mode: 0o700 });
    for (const topic of topics) {
      await page.goto(`/chore/discovery-lab/${topic}`);
      await expect(page.getByRole("img").first()).toBeVisible();
      if (!["reflection-refraction", "pattern-palace"].includes(topic))
        await expect(
          page.locator(".discovery-experiment-stage canvas").first(),
        ).toBeVisible();
      await page.waitForTimeout(350);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .locator(".discovery-experiment-stage")
        .screenshot({
          path: path.join(destination, `${viewport.name}-${topic}.png`),
        });
    }
  });
}
