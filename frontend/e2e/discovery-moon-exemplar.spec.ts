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
for (const viewport of [
  { name: "desktop", width: 1440, height: 1150 },
  { name: "android", width: 390, height: 844 },
]) {
  test(`Moon observatory exemplar ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/chore/login");
    await page.getByLabel("Email or Username").fill(fixture.parent_email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(fixture.parent_password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/parent\/dashboard$/);
    await page.goto("/chore/discovery-lab/moon-phases");
    await expect(page.locator(".moon-render canvas")).toBeVisible();
    await expect(page.locator(".moon-render")).toHaveAttribute(
      "data-surface-ready",
      "true",
    );
    await expect(
      page.getByText("3D rendering is unavailable on this device."),
    ).toHaveCount(0);
    const orbitControl = page.getByRole("slider", {
      name: "Orbit position",
      exact: true,
    });
    await expect(orbitControl).toBeDisabled();
    await page.getByRole("button", { name: "50%", exact: true }).click();
    await page
      .getByRole("button", { name: "Observe first quarter", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Same fraction, opposite sides",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: "Compare opposite quarters",
        exact: true,
      })
      .click();
    await expect(orbitControl).toBeEnabled();
    await orbitControl.focus();
    await page.keyboard.press("Home");
    await orbitControl.fill("135");
    await expect(page.locator(".moon-readout dd").first()).toHaveText(
      "Waxing gibbous",
    );
    await orbitControl.blur();
    await page.waitForTimeout(250);
    const directory = path.join(
      process.env.PLAYWRIGHT_SMOKE_DIR!,
      "moon-exemplar",
    );
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    await page.locator(".moon-observatory").screenshot({
      path: path.join(directory, `${viewport.name}-moon-observatory.png`),
    });
    await page.screenshot({
      path: path.join(directory, `${viewport.name}-moon-page.png`),
      fullPage: true,
    });
    await expect(page.getByTestId("moon-quarter-feedback")).toContainText(
      "result matches your prediction",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator(".moon-observatory").screenshot({
      path: path.join(directory, `${viewport.name}-quarter-observation.png`),
    });
  });
}
