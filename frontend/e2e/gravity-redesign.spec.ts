import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
) as { parent_email: string; parent_password: string };
const captureRoot = process.env.GRAVITY_CAPTURE_DIR;
const captureLabel = process.env.GRAVITY_CAPTURE_LABEL ?? "after";

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
  state: "initial" | "motion-paused" | "mass" | "world" | "boundary",
) {
  if (!captureRoot) return;
  mkdirSync(captureRoot, { recursive: true, mode: 0o700 });
  const prefix = `${captureLabel}-gravity-${state}-${viewport}`;
  await page.screenshot({
    path: path.join(captureRoot, `${prefix}-full.png`),
    fullPage: true,
    animations: "disabled",
  });
  await page.locator(".gravity-stage").evaluate((element) => {
    element.scrollIntoView({ block: "center" });
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.locator(".gravity-lab").screenshot({
    path: path.join(captureRoot, `${prefix}-component.png`),
    animations: "disabled",
  });
  await page.locator(".gravity-apparatus").screenshot({
    path: path.join(captureRoot, `${prefix}-apparatus.png`),
    animations: "disabled",
  });
  await page.locator(".gravity-stage").screenshot({
    path: path.join(captureRoot, `${prefix}-scene.png`),
    animations: "disabled",
  });
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1050 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`Gravity Drop Lab redesign evidence ${viewport.name}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page);
    await page.goto("/chore/discovery-lab/gravity");
    await expect(
      page.getByRole("heading", { name: "Gravity Drop Lab", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".gravity-stage .space-drag")).toHaveCSS(
      "position",
      "absolute",
    );
    await expect(page.locator(".gravity-stage .space-drag")).toHaveCSS(
      "color",
      "rgb(212, 225, 226)",
    );
    await expect(page.locator(".gravity-model-note p").first()).toHaveCSS(
      "color",
      "rgb(201, 216, 215)",
    );
    await expect(page.locator(".gravity-lab")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".space-render-gravity")).toHaveAttribute(
      "data-scene-ready",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "Compare 1 kg and 10 kg" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Compare Earth and Moon" }),
    ).toBeDisabled();
    expect(
      await page
        .locator(".gravity-lane-readouts")
        .evaluate((element) => element.hasAttribute("aria-live")),
    ).toBe(false);
    await expect(
      page.getByText("Mass comparison", { exact: true }),
    ).toBeVisible();
    await capture(page, viewport.name, "initial");

    const scene = page.locator(".space-render-gravity");
    const timeline = page.getByLabel("Drop timeline");
    await scene.focus();
    await page.keyboard.press("End");
    await expect(timeline).toHaveValue("100");
    await page.keyboard.press("Home");
    await expect(timeline).toHaveValue("0");
    await page.getByRole("button", { name: "Play motion" }).click();
    await page.waitForTimeout(850);
    await page.getByRole("button", { name: "Pause motion" }).click();
    const pausedAt = await timeline.inputValue();
    expect(Number(pausedAt)).toBeGreaterThan(0);
    await page.waitForTimeout(150);
    await expect(timeline).toHaveValue(pausedAt);
    await capture(page, viewport.name, "motion-paused");
    await page.getByRole("button", { name: "Restart drop" }).click();
    await expect(timeline).toHaveValue("0");

    await page
      .getByRole("button", { name: "10 kg lands first", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Compare 1 kg and 10 kg", exact: true })
      .click();
    await expect(page.getByTestId("gravity-mass-feedback")).toContainText(
      "differs from your prediction",
    );
    await expect(page.getByTestId("gravity-mass-feedback")).toContainText(
      "9.81 N",
    );
    await expect(page.getByTestId("gravity-mass-feedback")).toContainText(
      "98.1 N",
    );
    await capture(page, viewport.name, "mass");

    await page
      .getByRole("button", { name: "Moon takes longer", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Compare Earth and Moon", exact: true })
      .click();
    await expect(page.getByTestId("gravity-world-feedback")).toContainText(
      "matches your prediction",
    );
    await expect(page.getByTestId("gravity-world-feedback")).toContainText(
      "4.97 s",
    );
    await expect(
      page.getByRole("img", { name: /Moon · 5 kg lands in 4.97 seconds/ }),
    ).toBeVisible();
    await expect(page.getByText("16.7 m above floor")).toBeVisible();
    const lineStyles = await page
      .locator(".gravity-plot-line")
      .evaluateAll((lines) =>
        lines.map((line) => ({
          stroke: getComputedStyle(line).stroke,
          dash: getComputedStyle(line).strokeDasharray,
        })),
      );
    expect(lineStyles[0].stroke).not.toBe(lineStyles[1].stroke);
    expect(lineStyles[0].dash).not.toBe(lineStyles[1].dash);
    await capture(page, viewport.name, "world");

    await page.getByText("Open controls", { exact: true }).click();
    await page.getByLabel("Comparison world").selectOption("mars");
    await page.getByLabel("Drop height").fill("50");
    await page.getByLabel("Comparison object mass").fill("20");
    await expect(
      page
        .locator(".gravity-lane-readouts > div")
        .nth(1)
        .getByText("Mars · 20 kg", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Comparison weight")).toHaveText("74.2 N");
    await expect(page.locator(".gravity-plot")).toContainText("50 m");
    await capture(page, viewport.name, "boundary");

    expect(
      await page.evaluate(
        () =>
          window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
          document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    if (captureRoot && viewport.name === "mobile") {
      await page.getByTestId("gravity-world-feedback").scrollIntoViewIfNeeded();
      const target = await page
        .getByTestId("gravity-world-feedback")
        .boundingBox();
      const nav = await page.locator(".workspace-sidebar").boundingBox();
      expect(target).not.toBeNull();
      if (nav)
        expect(target!.y + Math.min(target!.height, 120)).toBeLessThan(nav.y);
      await page.screenshot({
        path: path.join(
          captureRoot,
          `${captureLabel}-gravity-world-mobile-ordinary-scroll.png`,
        ),
        animations: "disabled",
      });
    }

    await page.locator(".space-render-gravity canvas").evaluate((canvas) => {
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    await expect(page.getByText("3D view unavailable")).toBeVisible();
    await expect(page.locator(".space-render-fallback p")).toHaveCSS(
      "color",
      "rgb(184, 204, 209)",
    );
    if (captureRoot) {
      await page.locator(".gravity-stage").screenshot({
        path: path.join(
          captureRoot,
          `${captureLabel}-gravity-fallback-${viewport.name}-scene.png`,
        ),
        animations: "disabled",
      });
    }

    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByTestId("gravity-mass-feedback")).toHaveCount(0);
    await expect(page.getByTestId("gravity-world-feedback")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Compare 1 kg and 10 kg" }),
    ).toBeDisabled();
  });
}
