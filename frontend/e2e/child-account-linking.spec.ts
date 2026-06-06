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

async function signIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/chore/login");
  await page.getByLabel("Login Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("parent can link a child account without email, reset email, and child can sign in", async ({
  page,
}) => {
  const fixture = readFixture();
  const suffix = randomUUID().slice(0, 8);
  const newChildName = `Linked Kid ${suffix}`;
  const childPassword = "linked-kid-pass-123";
  const resetEmail = `linked.kid.reset.${suffix}@example.com`;

  await signIn(page, fixture.parent_email, fixture.parent_password);
  await expect(page).toHaveURL(/\/chore\/parent\/dashboard$/);

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Children", exact: true })
    .click();
  await expect(page).toHaveURL(/\/chore\/parent\/children$/);

  // Create child profile first
  await page
    .getByRole("heading", { name: "Add Child" })
    .scrollIntoViewIfNeeded();
  await page.getByRole("textbox", { name: "Name" }).fill(newChildName);
  await page.getByRole("button", { name: "Create Child" }).click();
  await expect(
    page
      .getByRole("list", { name: "Children list" })
      .locator("li.balance-item")
      .filter({ hasText: newChildName }),
  ).toBeVisible();

  // Link account without providing email (auto-generated)
  await page
    .getByRole("combobox", { name: "Child" })
    .first()
    .selectOption({ label: newChildName });
  await page.getByLabel("Temporary Password").fill(childPassword);
  await page.getByRole("button", { name: "Create Linked Child Login" }).click();

  const successLink = page.getByText(
    new RegExp(
      `Linked login created for ${newChildName}\\. Child signs in with login email child-`,
    ),
  );
  await expect(successLink).toBeVisible();

  // Reset email to explicit address
  await page
    .getByRole("combobox", { name: "Child" })
    .nth(1)
    .selectOption({ label: newChildName });
  await page
    .getByRole("textbox", { name: /New Login Email/i })
    .fill(resetEmail);
  await page.getByRole("button", { name: "Reset Child Email" }).click();
  await expect(
    page.getByText(
      `Updated login email for ${newChildName}. Child signs in with login email ${resetEmail}, not display name.`,
    ),
  ).toBeVisible();

  // Child can log in with reset email + same password
  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/chore\/login$/);

  await signIn(page, resetEmail, childPassword);
  await expect(page).toHaveURL(/\/chore\/child\/today$/);
});
