import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
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

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/chore/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("parent can link a child login account and child can sign in", async ({ page }) => {
  const fixture = readFixture();
  const suffix = randomUUID().slice(0, 8);
  const newChildName = `Linked Kid ${suffix}`;
  const childEmail = `linked.kid.${suffix}@example.com`;
  const childPassword = "linked-kid-pass-123";

  await signIn(page, fixture.parent_email, fixture.parent_password);
  await expect(page).toHaveURL(/\/chore\/parent\/dashboard$/);

  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Children", exact: true }).click();
  await expect(page).toHaveURL(/\/chore\/parent\/children$/);

  // Create child profile first
  await page.getByRole("heading", { name: "Add Child" }).scrollIntoViewIfNeeded();
  await page.getByRole("textbox", { name: "Name" }).fill(newChildName);
  await page.getByRole("button", { name: "Create Child" }).click();
  await expect(
    page.getByRole("list", { name: "Children list" }).locator("li.balance-item").filter({ hasText: newChildName })
  ).toBeVisible();

  // Link account to that child
  await page.getByRole("combobox", { name: "Child" }).selectOption({ label: newChildName });
  await page.getByRole("textbox", { name: "Child Email" }).fill(childEmail);
  await page.getByRole("textbox", { name: "Temporary Password" }).fill(childPassword);
  await page.getByRole("button", { name: "Create Linked Child Login" }).click();

  await expect(page.getByText(`Linked login created for ${newChildName}: ${childEmail}`)).toBeVisible();

  // Child can log in with linked credentials
  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/chore\/login$/);

  await signIn(page, childEmail, childPassword);
  await expect(page).toHaveURL(/\/chore\/child\/today$/);
});
