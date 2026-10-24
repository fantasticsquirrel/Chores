import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type SmokeFixture = {
  parent_email: string;
  parent_password: string;
};

function readFixture(): SmokeFixture {
  const fixturePath =
    process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH ??
    path.resolve(__dirname, "../../.ralph/playwright-smoke-fixture.json");
  return JSON.parse(readFileSync(fixturePath, "utf-8")) as SmokeFixture;
}

async function signIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/chore/login");
  await page.getByLabel("Email or Username").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("parent can create, find, open, and scale a household recipe", async ({
  page,
}) => {
  const fixture = readFixture();
  const uniqueTitle = `Playwright Pancakes ${Date.now()}`;

  await signIn(page, fixture.parent_email, fixture.parent_password);
  await expect(page).toHaveURL(/\/chore\/parent\/dashboard$/);
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Recipes", exact: true })
    .click();
  await expect(page).toHaveURL(/\/chore\/recipes$/);
  await expect(
    page.getByRole("heading", { name: "Recipe Organizer" }),
  ).toBeVisible();

  await expect(page.getByLabel("Favorites only")).toBeVisible();
  await expect(page.getByLabel("Import Recipe URL")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Import Recipe", exact: true })
    .click();
  const importDialog = page.getByRole("dialog", {
    name: "Import Recipe",
    exact: true,
  });
  await importDialog
    .getByLabel("Import Recipe URL")
    .fill("https://example.test/family-recipe");
  await page.goBack();
  await expect(importDialog).toHaveCount(0);
  await page.goForward();
  await expect(importDialog.getByLabel("Import Recipe URL")).toHaveValue(
    "https://example.test/family-recipe",
  );
  await page.keyboard.press("Escape");
  await expect(importDialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Import Recipe", exact: true }),
  ).toBeFocused();

  await page.getByRole("button", { name: "New Recipe" }).click();
  const editor = page.getByRole("dialog", { name: "Recipe Editor" });
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("Title")).toBeFocused();
  await editor.getByLabel("Title").fill(uniqueTitle);
  await editor.getByLabel("Default Servings").fill("4");
  await editor.getByLabel("Ingredient Item").fill("flour");
  await editor.getByLabel("Ingredient Quantity").fill("2");
  await editor.getByLabel("Ingredient Unit").fill("cup");
  await editor.getByLabel("Step Instruction").fill("Cook until golden.");
  await editor.getByRole("button", { name: "Save Recipe" }).click();

  await expect(page).toHaveURL(/\/chore\/recipes\/\d+$/);
  await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();
  await page.getByRole("link", { name: "Back to Recipes" }).click();
  await expect(page).toHaveURL(/\/chore\/recipes$/);
  await page.getByLabel("Search").fill(uniqueTitle);
  await page.getByRole("button", { name: "Advanced Filters" }).click();
  await page.getByLabel("Ingredient", { exact: true }).fill("flour");
  await page.getByRole("button", { name: "Apply Filters" }).click();
  const recipeCard = page.locator("article").filter({ hasText: uniqueTitle });
  await expect(
    recipeCard.getByRole("heading", { name: uniqueTitle }),
  ).toBeVisible();
  await recipeCard.getByRole("link", { name: "View Recipe" }).click();
  await expect(page).toHaveURL(/\/chore\/recipes\/\d+$/);
  await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to Recipes" }),
  ).toBeVisible();
  await expect(page.getByText("Default servings: 4")).toBeVisible();
  await expect(page.getByLabel("Scaled Servings")).toHaveValue("4");
  await page.getByLabel("Scaled Servings").fill("8");
  await expect(page.getByLabel("Scale Multiplier")).toHaveValue("2");
  await expect(page.locator("label", { hasText: "4 cup flour" })).toBeVisible();
  await expect(
    page.getByText("Cook until golden. Uses: 4 cup flour.").first(),
  ).toBeVisible();
  await page.getByLabel("Scale Multiplier").fill("1.5");
  await expect(page.getByLabel("Scaled Servings")).toHaveValue("6");
  await expect(page.locator(".recipe-pdf-meta")).toContainText(
    "Serves 6 · Scale 1.5×",
  );
  await page
    .getByRole("button", { name: "Start Cooking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Uses: 3 cup flour/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exit Cooking Mode" }).click();
  await expect(page.getByLabel("Scaled Servings")).toHaveValue("6");
});
