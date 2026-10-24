import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { OrthographicCamera, Vector3 } from "three";
import { createSoundScene } from "../src/features/discovery-lab/simulations/physical-exhibits/soundScene";
import { createCircuitScene } from "../src/features/discovery-lab/simulations/physical-exhibits/circuitScene";
import type { PhysicalSceneModel } from "../src/features/discovery-lab/simulations/physical-exhibits/sceneTypes";
const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
);
test.beforeAll(() =>
  execFileSync(
    process.env.PLAYWRIGHT_BACKEND_PYTHON!,
    ["-m", "scripts.seed_discovery_smoke"],
    { cwd: path.resolve("../backend"), env: process.env },
  ),
);
async function screenPoint(
  canvas: Locator,
  view: PhysicalSceneModel["view"],
  point: [number, number, number],
) {
  const bounds = (await canvas.boundingBox())!;
  const aspect = bounds.width / bounds.height,
    width = Math.max(view.width, view.height * aspect),
    height = width / aspect;
  const camera = new OrthographicCamera(
    -width / 2,
    width / 2,
    height / 2,
    -height / 2,
    0.1,
    100,
  );
  camera.position.set(...view.position);
  camera.lookAt(...view.target);
  camera.updateMatrixWorld();
  const projected = new Vector3(...point).project(camera);
  return {
    x: bounds.x + ((projected.x + 1) * bounds.width) / 2,
    y: bounds.y + ((1 - projected.y) * bounds.height) / 2,
  };
}
async function dragModel(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
  touch: boolean,
) {
  if (touch) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, radiusX: 3, radiusY: 3 }],
    });
    for (let step = 1; step <= 8; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: start.x + ((end.x - start.x) * step) / 8,
            y: start.y + ((end.y - start.y) * step) / 8,
            radiusX: 3,
            radiusY: 3,
          },
        ],
      });
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
  }
}
for (const viewport of [
  { name: "desktop", width: 1440, height: 1050 },
  { name: "android", width: 390, height: 844 },
]) {
  test.describe(`${viewport.name} input`, () => {
    test.use({ hasTouch: viewport.name === "android" });
    test(`physical scene manipulation ${viewport.name}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/chore/login");
      await page
        .getByLabel("Email or Username", { exact: true })
        .fill(fixture.parent_email);
      await page
        .getByLabel("Password", { exact: true })
        .fill(fixture.parent_password);
      await page.getByRole("button", { name: "Sign In", exact: true }).click();
      await expect(page).toHaveURL(/parent\/dashboard$/);
      const directory = path.join(
        process.env.PLAYWRIGHT_SMOKE_DIR!,
        "physical-interactions",
      );
      mkdirSync(directory, { recursive: true });
      await page.goto("/chore/discovery-lab/bridge-builder");
      await expect(page.locator('[data-renderer-ready="true"]')).toBeVisible();
      const bridgeCanvas = page.locator(".dl-physical-canvas canvas");
      await bridgeCanvas.scrollIntoViewIfNeeded();
      const bounds = (await bridgeCanvas.boundingBox())!;
      await dragModel(
        page,
        { x: bounds.x + bounds.width * 0.5, y: bounds.y + bounds.height * 0.5 },
        {
          x: bounds.x + bounds.width * 0.64,
          y: bounds.y + bounds.height * 0.5,
        },
        viewport.name === "android",
      );
      await expect(
        page.getByLabel("Load position", { exact: true }),
      ).not.toHaveValue("50");
      await page
        .getByRole("button", { name: "Move load toward left bank" })
        .click();
      await expect(
        page.getByLabel("Left support force", { exact: true }),
      ).toHaveText("8.5 kN");
      await page.getByRole("button", { name: "Brace section 2" }).click();
      await expect(
        page.getByRole("button", { name: "Brace section 2" }),
      ).toHaveAttribute("aria-pressed", "true");
      await page
        .getByLabel("Beam material", { exact: true })
        .selectOption("steel");
      await page.getByLabel("Load position", { exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(
        page.getByLabel("Load position", { exact: true }),
      ).toHaveValue("16");
      await page.locator(".discovery-experiment-stage").screenshot({
        path: path.join(directory, `${viewport.name}-bridge-reinforced.png`),
      });
      await page.goto("/chore/discovery-lab/sound-playground");
      await expect(page.locator('[data-renderer-ready="true"]')).toBeVisible();
      await expect(
        page.getByLabel("Cycle position", { exact: true }),
      ).toHaveValue("0");
      const soundCanvas = page.locator(".dl-physical-canvas canvas");
      await soundCanvas.scrollIntoViewIfNeeded();
      const sound = createSoundScene({
        kind: "sound",
        length: 60,
        tension: 80,
        amplitude: 3,
        progress: 0,
      });
      const start = await screenPoint(
        soundCanvas,
        sound.view,
        [0.2, 0.99, 0.4],
      );
      const end = await screenPoint(soundCanvas, sound.view, [3.5, 1.02, 0.4]);
      sound.dispose();
      await dragModel(page, start, end, viewport.name === "android");
      await expect(
        page.getByLabel("String length", { exact: true }),
      ).not.toHaveValue("60");
      await page.getByRole("button", { name: "Reset", exact: true }).click();
      const before = await page
        .getByLabel("Frequency", { exact: true })
        .textContent();
      await page.getByRole("button", { name: "Double amplitude" }).click();
      await expect(page.getByLabel("Frequency", { exact: true })).toHaveText(
        before!,
      );
      await expect(
        page.getByLabel("Relative vibration energy", { exact: true }),
      ).toHaveText("36");
      await page
        .getByRole("button", { name: "Pluck string", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Pause motion" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Pause motion" }).click();
      await page.getByLabel("Cycle position", { exact: true }).focus();
      await page.keyboard.press("Home");
      await page.locator(".discovery-experiment-stage").screenshot({
        path: path.join(
          directory,
          `${viewport.name}-sound-large-amplitude.png`,
        ),
      });
      await page.goto("/chore/discovery-lab/circuit-city");
      await expect(page.locator('[data-renderer-ready="true"]')).toBeVisible();
      const circuitCanvas = page.locator(".dl-physical-canvas canvas");
      await circuitCanvas.scrollIntoViewIfNeeded();
      const circuit = createCircuitScene({
        kind: "circuit",
        mode: "series",
        switches: [true, true, true],
        voltage: 12,
        current: [1 / 3, 1 / 3, 1 / 3],
        power: [4 / 3, 4 / 3, 4 / 3],
      });
      const switchPoint = await screenPoint(
        circuitCanvas,
        circuit.view,
        [0, 0.44, 1.73],
      );
      circuit.dispose();
      if (viewport.name === "android")
        await page.touchscreen.tap(switchPoint.x, switchPoint.y);
      else await page.mouse.click(switchPoint.x, switchPoint.y);
      await expect(
        page.getByLabel("House 2 switch", { exact: true }),
      ).not.toBeChecked();
      await expect(
        page.getByLabel("House 1 current", { exact: true }),
      ).toHaveText("0.00 A");
      await page.getByLabel("Wiring", { exact: true }).selectOption("parallel");
      await expect(
        page.getByLabel("House 1 current", { exact: true }),
      ).toHaveText("1.00 A");
      await expect(
        page.getByLabel("House 2 current", { exact: true }),
      ).toHaveText("0.00 A");
      await expect(
        page.getByLabel("House 3 current", { exact: true }),
      ).toHaveText("1.00 A");
      await page.locator(".discovery-experiment-stage").screenshot({
        path: path.join(
          directory,
          `${viewport.name}-circuit-parallel-open.png`,
        ),
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}
