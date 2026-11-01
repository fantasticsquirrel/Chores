import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
) as { parent_email: string; parent_password: string };
const captureRoot = process.env.MOON_CAPTURE_DIR;
const captureLabel = process.env.MOON_CAPTURE_LABEL ?? "after";

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
    | "orbit"
    | "motion-paused"
    | "quarter"
    | "operated"
    | "full",
) {
  if (!captureRoot) return;
  mkdirSync(captureRoot, { recursive: true, mode: 0o700 });
  const prefix = `${captureLabel}-${state}-${viewport}`;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({
    path: path.join(captureRoot, `${prefix}-full.png`),
    fullPage: true,
    animations: "disabled",
  });
  await page.locator(".moon-observatory").screenshot({
    path: path.join(captureRoot, `${prefix}-component.png`),
    animations: "disabled",
  });
  await page.locator(".moon-stage").screenshot({
    path: path.join(captureRoot, `${prefix}-scene.png`),
    animations: "disabled",
  });
  await page.locator(".moon-stage").evaluate((element) => {
    element.scrollIntoView({ block: "center" });
  });
  await page.screenshot({
    path: path.join(captureRoot, `${prefix}-viewport.png`),
    animations: "disabled",
  });
}

async function expectReadableMoonText(page: Page) {
  const result = await page.evaluate(() => {
    const parse = (value: string) => {
      const [r = 0, g = 0, b = 0] = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return { r, g, b };
    };
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) =>
      [r, g, b]
        .map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (total, channel, index) =>
            total + channel * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const contrast = (foreground: string, background: string) => {
      const first = luminance(parse(foreground));
      const second = luminance(parse(background));
      return (
        (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
      );
    };
    const samples = [
      [".moon-stage-caption p", ".moon-stage-caption"],
      [".moon-readout dt", ".moon-readout div"],
      [".moon-readout dd", ".moon-readout div"],
      [".moon-model-note p", ".moon-model-note"],
    ];
    return samples.map(([textSelector, backgroundSelector]) => {
      const text = document.querySelector<HTMLElement>(textSelector)!;
      const background =
        document.querySelector<HTMLElement>(backgroundSelector)!;
      return contrast(
        getComputedStyle(text).color,
        getComputedStyle(background).backgroundColor,
      );
    });
  });
  for (const [index, ratio] of result.entries())
    expect(ratio, `Moon text sample ${index}`).toBeGreaterThanOrEqual(4.5);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1050 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`Moon Phase Observatory redesign evidence ${viewport.name}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page);
    await page.goto("/chore/discovery-lab/moon-phases");
    await expect(
      page.getByRole("heading", {
        name: "Moon Phase Observatory",
        exact: true,
      }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".moon-render")).toHaveAttribute(
      "data-surface-ready",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "Observe first quarter" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Compare opposite quarters" }),
    ).toBeDisabled();
    await expect(page.getByText("01 / PREDICT", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText("Orbit view · not to scale", { exact: true }),
    ).toHaveCount(0);
    await expectReadableMoonText(page);
    const slider = page.getByRole("slider", {
      name: "Orbit position",
      exact: true,
    });
    await expect(slider).toHaveValue("45");
    await expect(slider).toBeDisabled();
    await page.waitForTimeout(180);
    await expect(slider).toHaveValue("45");
    await capture(page, viewport.name, "initial");

    await page
      .getByRole("button", { name: "Orbit geometry", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Orbit geometry", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".moon-stage-caption")).toContainText(
      "sunlight stays fixed from the right",
    );
    await capture(page, viewport.name, "orbit");

    await page.getByRole("button", { name: "25%", exact: true }).click();
    await page
      .getByRole("button", { name: "Observe first quarter", exact: true })
      .click();
    await expect(page.getByTestId("moon-quarter-feedback")).toContainText(
      "differs from your prediction",
    );
    await expect(page.getByTestId("moon-quarter-feedback")).toContainText(
      "50%",
    );
    await capture(page, viewport.name, "quarter");

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
    await expect(page.getByTestId("moon-opposite-feedback")).toContainText(
      "matches your prediction",
    );
    await expect(page.getByTestId("moon-opposite-feedback")).toContainText(
      "First quarter: 50% · Last quarter: 50%",
    );
    await expect(slider).toHaveValue("270");
    await expect(slider).toBeEnabled();
    await capture(page, viewport.name, "operated");

    await slider.focus();
    await page.keyboard.press("End");
    await expect(slider).toHaveValue("360");
    await page.keyboard.press("Home");
    await expect(slider).toHaveValue("0");
    await slider.blur();
    await page.getByRole("button", { name: "Quarter", exact: true }).click();
    await page.getByRole("button", { name: "Play motion" }).click();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "Pause motion" }).click();
    const pausedAt = await slider.inputValue();
    expect(Number(pausedAt)).toBeGreaterThan(90);
    await page.waitForTimeout(160);
    await expect(slider).toHaveValue(pausedAt);
    await capture(page, viewport.name, "motion-paused");
    await page.getByRole("button", { name: "Restart cycle" }).click();
    await expect(slider).toHaveValue("0");

    await page.getByRole("button", { name: "Full", exact: true }).click();
    await expect(page.getByText("100%", { exact: true })).toBeVisible();
    await capture(page, viewport.name, "full");
    expect(
      await page.evaluate(
        () =>
          window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
          document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    if (captureRoot && viewport.name === "mobile") {
      await page.getByRole("button", { name: "Reset lesson" }).click();
      await page.locator(".moon-stage").evaluate((element) => {
        element.scrollIntoView({ block: "start" });
      });
      const initialStage = await page.locator(".moon-stage").boundingBox();
      const nav = await page.locator(".workspace-sidebar").boundingBox();
      expect(initialStage).not.toBeNull();
      if (nav)
        expect(initialStage!.y + initialStage!.height).toBeLessThanOrEqual(
          nav.y,
        );
      await page.screenshot({
        path: path.join(
          captureRoot,
          `${captureLabel}-initial-mobile-ordinary-scroll.png`,
        ),
        animations: "disabled",
      });

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
      await page.getByTestId("moon-opposite-feedback").scrollIntoViewIfNeeded();
      const feedback = await page
        .getByTestId("moon-opposite-feedback")
        .boundingBox();
      const operatedNav = await page
        .locator(".workspace-sidebar")
        .boundingBox();
      expect(feedback).not.toBeNull();
      if (operatedNav)
        expect(feedback!.y + Math.min(feedback!.height, 120)).toBeLessThan(
          operatedNav.y,
        );
      await page.screenshot({
        path: path.join(
          captureRoot,
          `${captureLabel}-operated-mobile-ordinary-scroll.png`,
        ),
        animations: "disabled",
      });
    }

    await page.locator(".moon-render canvas").evaluate((canvas) => {
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    await expect(page.getByText("3D view unavailable")).toBeVisible();
    if (captureRoot)
      await page.locator(".moon-stage").screenshot({
        path: path.join(
          captureRoot,
          `${captureLabel}-fallback-${viewport.name}-scene.png`,
        ),
        animations: "disabled",
      });

    await page.getByRole("button", { name: "Reset lesson" }).click();
    await expect(page.getByTestId("moon-quarter-feedback")).toHaveCount(0);
    await expect(page.getByTestId("moon-opposite-feedback")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Observe first quarter" }),
    ).toBeDisabled();
    await expect(slider).toBeDisabled();
    await expect(slider).toHaveValue("45");
  });
}
