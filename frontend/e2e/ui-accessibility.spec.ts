import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { requireIsolatedPlaywrightSmokeConfiguration } from "../scripts/playwright-smoke-isolation";

requireIsolatedPlaywrightSmokeConfiguration(process.env);
const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
);

function luminance(rgb: number[]) {
  const c = rgb
    .map((value) => value / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(foreground: number[], background: number[]) {
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`form themes and menu keyboard navigation at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const login = await page.request.post("/chore-api/auth/login", {
      data: { email: fixture.parent_email, password: fixture.parent_password },
    });
    expect(login.ok()).toBe(true);
    await page.goto("/chore/parent/chores");
    for (const theme of ["Paper & Pine", "Clearline", "Orbit Club"]) {
      await page.getByRole("button", { name: theme, exact: true }).click();
      const child = page.locator("select.text-input").first();
      await expect(child).toBeVisible();
      await expect(child).toBeEnabled();
      await child.focus();
      // Enter keyboard modality; mouse-triggered programmatic focus need not
      // match :focus-visible. Tab away and back tests actual keyboard focus.
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(child).toBeFocused();
      const style = await child.evaluate((element) => {
        const value = getComputedStyle(element);
        const rgb = (text: string) =>
          text
            .match(/[\d.]+/g)!
            .map(Number)
            .slice(0, 3);
        return {
          foreground: rgb(value.color),
          background: rgb(value.backgroundColor),
          outline: value.outlineStyle,
          width: parseFloat(value.outlineWidth),
        };
      });
      expect(
        contrast(style.foreground, style.background),
        theme,
      ).toBeGreaterThanOrEqual(4.5);
      expect(style.outline).not.toBe("none");
      expect(style.width).toBeGreaterThanOrEqual(2);
      await page
        .getByRole("button", { name: "Add Chore", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "New Chore" });
      await expect(dialog).toBeVisible();
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add Chore", exact: true }),
      ).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (viewport.width < 900) {
      await page.locator(".mobile-more summary").click();
      await page.keyboard.press("Escape");
      await expect(page.locator(".mobile-more")).not.toHaveAttribute("open");
      await expect(page.locator(".mobile-more summary")).toBeFocused();
      await page.locator(".mobile-more summary").click();
      await page.getByRole("link", { name: "Recipes in More menu" }).click();
      await expect(page).toHaveURL(/\/recipes$/);
      await expect(page.locator(".mobile-more")).not.toHaveAttribute("open");
      await expect(page.getByRole("main")).toBeFocused();
      await page.goBack();
      await expect(page).toHaveURL(/\/parent\/chores$/);
      await expect(page.locator(".mobile-more")).not.toHaveAttribute("open");
    }
    // CSS zoom exercises reflow; this is not a native large-text/device claim.
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
