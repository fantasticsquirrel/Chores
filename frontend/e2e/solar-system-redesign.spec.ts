import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
) as { parent_email: string; parent_password: string };
const captureRoot = process.env.SOLAR_CAPTURE_DIR;
const captureLabel = process.env.SOLAR_CAPTURE_LABEL ?? "after";

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

async function expectSolarTextContrast(page: Page) {
  const audit = await page.evaluate(() => {
    type Rgb = { r: number; g: number; b: number; alpha: number };
    const parseRgb = (value: string): Rgb => {
      const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return {
        r: channels[0] ?? 0,
        g: channels[1] ?? 0,
        b: channels[2] ?? 0,
        alpha: channels[3] ?? 1,
      };
    };
    const opaqueStops = (value: string) =>
      (value.match(/rgba?\([^)]+\)/g) ?? [])
        .map(parseRgb)
        .filter((color) => color.alpha >= 0.999);
    const luminance = ({ r, g, b }: Rgb) => {
      const linear = [r, g, b].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const contrast = (foreground: Rgb, background: Rgb) => {
      const first = luminance(foreground);
      const second = luminance(background);
      return (
        (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
      );
    };
    const minimumContrast = (color: string, backgrounds: Rgb[]) =>
      Math.min(
        ...backgrounds.map((background) =>
          contrast(parseRgb(color), background),
        ),
      );

    const stage = document.querySelector<HTMLElement>(".solar-stage")!;
    const deck = document.querySelector<HTMLElement>(".solar-flight-deck")!;
    const stageStops = opaqueStops(getComputedStyle(stage).backgroundImage);
    const deckStops = opaqueStops(getComputedStyle(deck).backgroundImage);
    const stageText = [
      document.querySelector<HTMLElement>(".solar-scene-heading h2")!,
      document.querySelector<HTMLElement>(".solar-scene-heading p")!,
    ];
    const caption = document.querySelector<HTMLElement>(
      ".solar-stage-caption",
    )!;
    const deckText = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".solar-readout dt, .solar-readout dd",
      ),
    );
    return {
      stageStopCount: stageStops.length,
      deckStopCount: deckStops.length,
      stageContrasts: stageText.map((element) =>
        minimumContrast(getComputedStyle(element).color, stageStops),
      ),
      captionContrast: contrast(
        parseRgb(getComputedStyle(caption).color),
        parseRgb(getComputedStyle(caption).backgroundColor),
      ),
      deckContrasts: deckText.map((element) =>
        minimumContrast(getComputedStyle(element).color, deckStops),
      ),
    };
  });

  expect(audit.stageStopCount).toBeGreaterThanOrEqual(3);
  expect(audit.deckStopCount).toBeGreaterThanOrEqual(2);
  for (const [index, ratio] of audit.stageContrasts.entries()) {
    expect(ratio, `stage text ${index}`).toBeGreaterThanOrEqual(4.5);
  }
  expect(audit.captionContrast, "scene caption text").toBeGreaterThanOrEqual(
    4.5,
  );
  for (const [index, ratio] of audit.deckContrasts.entries()) {
    expect(ratio, `deck text ${index}`).toBeGreaterThanOrEqual(4.5);
  }
}

async function capture(
  page: Page,
  viewport: string,
  state:
    | "initial"
    | "overview"
    | "follow"
    | "motion-paused"
    | "operated"
    | "diameter"
    | "boundary",
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
  await page.locator(".solar-lab").screenshot({
    path: path.join(captureRoot, `${prefix}-component.png`),
    animations: "disabled",
  });
  await page.locator(".solar-stage").screenshot({
    path: path.join(captureRoot, `${prefix}-scene.png`),
    animations: "disabled",
  });
  await page.locator(".solar-stage").evaluate((element) => {
    element.scrollIntoView({ block: "center" });
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({
    path: path.join(captureRoot, `${prefix}-viewport.png`),
    animations: "disabled",
  });
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1050 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`Solar System Explorer redesign evidence ${viewport.name}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page);
    await page.goto("/chore/discovery-lab/solar-system");
    await expect(
      page.getByRole("heading", { name: "Solar System Explorer", exact: true }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".space-render-solar")).toHaveAttribute(
      "data-scene-ready",
      "true",
    );
    await expect(page.locator(".solar-lab")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Compare one Earth year" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Compare Earth and Jupiter" }),
    ).toBeDisabled();
    const stage = page.locator(".solar-stage");
    const cameraControls = page.getByRole("group", { name: "Camera view" });
    const [stageBox, cameraBox] = await Promise.all([
      stage.boundingBox(),
      cameraControls.boundingBox(),
    ]);
    expect(stageBox).not.toBeNull();
    expect(cameraBox).not.toBeNull();
    expect(cameraBox!.y + cameraBox!.height).toBeLessThanOrEqual(stageBox!.y);
    await expect(
      page.getByText("Planet enlarged; orbit distances compressed.", {
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(
      page.getByText("Sun-centered inset: selected path", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Globe: enlarged planet close-up", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".solar-scene-key")).toHaveCount(0);
    await expect(page.getByText("Planet mission", { exact: true })).toHaveCount(
      0,
    );
    await expectSolarTextContrast(page);
    await capture(page, viewport.name, "initial");

    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Overview", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".solar-scene-key")).toContainText(
      "selected planet’s orbit",
    );
    await capture(page, viewport.name, "overview");

    await page.getByRole("button", { name: "Mars 4", exact: true }).click();
    await page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Follow", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Mars", { exact: true }).first()).toBeVisible();
    await expect(page.locator(".solar-scene-key")).toHaveCount(0);
    await capture(page, viewport.name, "follow");

    const scene = page.locator(".space-render-solar");
    const timeline = page.getByLabel("Model time");
    await scene.focus();
    await page.keyboard.press("End");
    await expect(timeline).toHaveValue("100");
    await page.keyboard.press("Home");
    await expect(timeline).toHaveValue("0");
    await page.getByRole("button", { name: "Play motion" }).click();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "Pause motion" }).click();
    const pausedAt = await timeline.inputValue();
    expect(Number(pausedAt)).toBeGreaterThan(0);
    await page.waitForTimeout(180);
    await expect(timeline).toHaveValue(pausedAt);
    await capture(page, viewport.name, "motion-paused");
    await page.getByRole("button", { name: "Restart timeline" }).click();
    await expect(timeline).toHaveValue("0");

    await page.getByRole("button", { name: "Neptune", exact: true }).click();
    await page
      .getByRole("button", { name: "Compare one Earth year", exact: true })
      .click();
    await expect(page.getByTestId("solar-orbit-feedback")).toContainText(
      "differs from your prediction",
    );
    await expect(page.getByTestId("solar-orbit-feedback")).toContainText(
      "0.006 orbit",
    );
    await expect(page.getByText("Earth", { exact: true }).last()).toBeVisible();

    await page.getByRole("button", { name: "About 11×", exact: true }).click();
    await page
      .getByRole("button", { name: "Compare Earth and Jupiter", exact: true })
      .click();
    await expect(page.getByTestId("solar-diameter-feedback")).toContainText(
      "matches your prediction",
    );
    await expect(page.getByTestId("solar-diameter-feedback")).toContainText(
      "11.21 Earth diameters",
    );
    await expect(page.locator(".solar-stage-caption")).toContainText(
      "Earth and Jupiter share one diameter scale and baseline",
    );
    await capture(page, viewport.name, "diameter");
    await capture(page, viewport.name, "operated");

    await page.getByText("Compare other planets", { exact: true }).click();
    await page.getByLabel("Choose a planet").selectOption("0");
    await expect(page.getByText("0.387 AU", { exact: true })).toBeVisible();
    await page.getByLabel("Choose a planet").selectOption("5");
    await expect(page.getByText("120,536 km", { exact: true })).toBeVisible();
    await page
      .getByLabel("Comparison view", { exact: true })
      .selectOption("orbits");
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(page.locator(".solar-scene-key")).toContainText(
      "selected planet’s orbit",
    );
    await capture(page, viewport.name, "boundary");

    expect(
      await page.evaluate(
        () =>
          window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
          document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    if (captureRoot && viewport.name === "mobile") {
      await page.locator(".solar-stage").evaluate((element) => {
        element.scrollIntoView({ block: "start" });
      });
      const stageBox = await page.locator(".solar-stage").boundingBox();
      const navBox = await page.locator(".workspace-sidebar").boundingBox();
      expect(stageBox).not.toBeNull();
      if (navBox) {
        expect(stageBox!.y).toBeGreaterThanOrEqual(0);
        expect(stageBox!.y + stageBox!.height).toBeLessThanOrEqual(navBox.y);
      }
      await page.screenshot({
        path: path.join(
          captureRoot,
          `${captureLabel}-operated-mobile-ordinary-scroll.png`,
        ),
        animations: "disabled",
      });
    }

    await page.locator(".space-render-solar canvas").evaluate((canvas) => {
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    await expect(page.getByText("3D view unavailable")).toBeVisible();
    await expect(page.locator(".space-render-fallback p")).toHaveCSS(
      "color",
      "rgb(191, 209, 215)",
    );
    if (captureRoot) {
      await page.locator(".solar-stage").screenshot({
        path: path.join(
          captureRoot,
          `${captureLabel}-fallback-${viewport.name}-scene.png`,
        ),
        animations: "disabled",
      });
    }

    await page
      .getByRole("button", { name: "Reset lesson", exact: true })
      .click();
    await expect(page.getByTestId("solar-orbit-feedback")).toHaveCount(0);
    await expect(page.getByTestId("solar-diameter-feedback")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Compare one Earth year" }),
    ).toBeDisabled();
  });
}
