import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
) as { parent_email: string; parent_password: string };
const captureRoot = process.env.ORBIT_CAPTURE_DIR;
const captureLabel = process.env.ORBIT_CAPTURE_LABEL ?? "review";

test.beforeAll(() => {
  execFileSync(
    process.env.PLAYWRIGHT_BACKEND_PYTHON!,
    ["-m", "scripts.seed_discovery_smoke"],
    { cwd: path.resolve("../backend"), env: process.env },
  );
});

async function signIn(page: Page) {
  await page.goto("/chore/login");
  await page.getByLabel("Email or Username").fill(fixture.parent_email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(fixture.parent_password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/chore\/parent\/dashboard$/);
}

async function capture(
  page: Page,
  viewport: string,
  state:
    | "initial"
    | "overview"
    | "motion-paused"
    | "operated"
    | "escape-follow",
) {
  if (!captureRoot) return;
  mkdirSync(captureRoot, { recursive: true, mode: 0o700 });
  const prefix = `${captureLabel}-${state}-${viewport}`;
  await page.screenshot({
    path: path.join(captureRoot, `${prefix}-full.png`),
    fullPage: true,
    animations: "disabled",
  });
  await page.locator(".orbit-lab").screenshot({
    path: path.join(captureRoot, `${prefix}-component.png`),
    animations: "disabled",
  });
  const scene = page.locator(".orbit-scene-stage, .orbit-instrument").first();
  await scene.screenshot({
    path: path.join(captureRoot, `${prefix}-scene.png`),
    animations: "disabled",
  });
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1050 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`Orbit Workshop correction evidence ${viewport.name}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page);
    await page.goto("/chore/discovery-lab/orbital-mechanics");
    await expect(
      page.getByRole("heading", { name: "Orbit Workshop", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".orbit-lab")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".space-render-orbit")).toHaveAttribute(
      "data-scene-ready",
      "true",
    );
    await capture(page, viewport.name, "initial");

    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Overview", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await capture(page, viewport.name, "overview");

    const scene = page.locator(".space-render-orbit");
    const timeline = page.getByLabel("Flight position");
    await scene.focus();
    await page.keyboard.press("End");
    await expect(timeline).toHaveValue("100");
    await page.keyboard.press("Home");
    await expect(timeline).toHaveValue("0");
    await page.getByRole("button", { name: "Play motion" }).click();
    await page.waitForTimeout(1800);
    await page.getByRole("button", { name: "Pause motion" }).click();
    const pausedAt = await timeline.inputValue();
    expect(Number(pausedAt)).toBeGreaterThan(0);
    await page.waitForTimeout(200);
    await expect(timeline).toHaveValue(pausedAt);
    await capture(page, viewport.name, "motion-paused");
    await page.getByRole("button", { name: "Restart flight" }).click();
    await expect(timeline).toHaveValue("0");
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await page
      .getByRole("button", { name: "Hit → orbit → escape", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Compare 0.60×, 1.00× and 1.42×",
        exact: true,
      })
      .click();
    await expect(page.getByTestId("orbit-speed-evidence")).toBeVisible();
    await page
      .getByRole("button", {
        name: "Curves into a tighter ellipse",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Compare 1× and 2× mass", exact: true })
      .click();
    await expect(page.getByTestId("orbit-mass-evidence")).toBeVisible();
    await capture(page, viewport.name, "operated");

    await page.getByText("Try other launches", { exact: true }).click();
    await page
      .getByRole("button", { name: "Escape · 1.42×", exact: true })
      .click();
    await page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Follow", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await scene.focus();
    await page.keyboard.press("End");
    await expect(timeline).toHaveValue("100");
    await expect(page.getByText("Escape path", { exact: true })).toBeVisible();
    await scene.evaluate((element: HTMLElement) => element.blur());
    await capture(page, viewport.name, "escape-follow");

    if (captureRoot && viewport.name === "mobile") {
      await page.evaluate(() => window.scrollTo(0, 620));
      await page.screenshot({
        path: path.join(
          captureRoot,
          `${captureLabel}-operated-mobile-ordinary-scroll.png`,
        ),
        animations: "disabled",
      });
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await page.locator(".space-render-orbit canvas").evaluate((canvas) => {
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    await expect(page.getByText("3D view unavailable")).toBeVisible();
    if (captureRoot) {
      await page.locator(".orbit-scene-stage").screenshot({
        path: path.join(
          captureRoot,
          `${captureLabel}-fallback-${viewport.name}-scene.png`,
        ),
        animations: "disabled",
      });
    }
  });
}
