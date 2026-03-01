import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type SmokeFixture = {
  parent_email: string;
  parent_password: string;
  child_email: string;
  child_password: string;
  child_name: string;
  chore_name: string;
  create_child_name: string;
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

function choreRow(page: Page, choreName: string): Locator {
  return page.locator("li.balance-item").filter({ hasText: choreName }).first();
}

function submissionRow(page: Page, childName: string): Locator {
  return page.locator("li.submission-item").filter({ hasText: childName }).first();
}

test("deployed chore smoke flow enforces login and supports parent/child/board actions", async ({ page }) => {
  const fixture = readFixture();

  await page.goto("/chore/parent/children");
  await expect(page).toHaveURL(/\/chore\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();

  await signIn(page, fixture.parent_email, fixture.parent_password);
  await expect(page).toHaveURL(/\/chore\/parent\/dashboard$/);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Children", exact: true }).click();
  await expect(page).toHaveURL(/\/chore\/parent\/children$/);
  await page.getByLabel("Name").fill(fixture.create_child_name);
  await page.getByRole("button", { name: "Create Child" }).click();
  await expect(
    page.getByRole("list", { name: "Children list" }).locator("li.balance-item").filter({ hasText: fixture.create_child_name })
  ).toBeVisible();
  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/chore\/login$/);

  await signIn(page, fixture.child_email, fixture.child_password);
  await expect(page).toHaveURL(/\/chore\/child\/today$/);
  await expect(choreRow(page, fixture.chore_name)).toBeVisible();
  await choreRow(page, fixture.chore_name).locator("input[type='checkbox']").check();
  await page.getByRole("button", { name: "Submit Selected Chores" }).click();
  await expect(page.getByText("Submitted 1 chore(s) for review.")).toBeVisible();
  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/chore\/login$/);

  await signIn(page, fixture.parent_email, fixture.parent_password);
  await expect(page).toHaveURL(/\/chore\/parent\/dashboard$/);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Board", exact: true }).click();
  await expect(page).toHaveURL(/\/chore\/board$/);
  await expect(submissionRow(page, fixture.child_name)).toBeVisible();
  await submissionRow(page, fixture.child_name).getByRole("button", { name: "Approve All" }).click();
  await expect(page.getByText("No pending submissions right now.")).toBeVisible();
});

test("deployed auth protections block anonymous and wrong-role access", async ({ page }) => {
  const fixture = readFixture();

  await page.goto("/chore/board");
  await expect(page).toHaveURL(/\/chore\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();

  const anonymousChildrenResponse = await page.request.get("/chore-api/children?household_id=1");
  expect(anonymousChildrenResponse.status()).toBe(401);
  const anonymousChildrenBody = await anonymousChildrenResponse.json();
  expect(anonymousChildrenBody).toMatchObject({
    detail: "Not authenticated.",
  });

  await signIn(page, fixture.child_email, fixture.child_password);
  await expect(page).toHaveURL(/\/chore\/child\/today$/);

  await page.goto("/chore/parent/dashboard");
  await expect(page).toHaveURL(/\/chore\/child\/today$/);

  const childParentEndpointResponse = await page.request.get("/chore-api/submissions");
  expect(childParentEndpointResponse.status()).toBe(403);
  const childParentEndpointBody = await childParentEndpointResponse.json();
  expect(childParentEndpointBody).toMatchObject({
    detail: "Forbidden.",
  });
});
