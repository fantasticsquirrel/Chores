import { expect, test, type Locator, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Fixture seeding
// ---------------------------------------------------------------------------

type ChoreFixture = {
  parent_email: string;
  parent_password: string;
  child_one_name: string;
  child_two_name: string;
};

function seedChoreFixture(): ChoreFixture {
  const rootDir = path.resolve(__dirname, "../../");
  const fixturePath = path.join(rootDir, ".ralph/chore-mgmt-fixture.json");
  const seedScript = path.join(
    rootDir,
    "backend/scripts/seed_chore_mgmt_smoke.py",
  );

  const output = execSync(
    `DATABASE_URL="sqlite:///${rootDir}/data/chore_tracking.db" "${rootDir}/.venv/bin/python" "${seedScript}"`,
    { encoding: "utf-8" },
  );
  const fixture = JSON.parse(output.trim()) as ChoreFixture;
  writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
  return fixture;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/chore/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/chore\/parent\/dashboard$/);
}

async function goToChores(page: Page): Promise<void> {
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Chores", exact: true })
    .click();
  await expect(page).toHaveURL(/\/chore\/parent\/chores$/);
}

async function openNewChoreForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add Chore" }).first().click();
  await expect(page.getByRole("heading", { name: "New Chore" })).toBeVisible();
}

function choreManagementRow(page: Page, choreName: string): Locator {
  return page
    .getByRole("list", { name: "Chores list" })
    .locator("li.balance-item")
    .filter({ hasText: choreName })
    .first();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Chore management UI", () => {
  let fixture: ChoreFixture;

  test.beforeAll(() => {
    fixture = seedChoreFixture();
  });

  test("can create a chore visible to all children", async ({ page }) => {
    await signIn(page, fixture.parent_email, fixture.parent_password);
    await goToChores(page);

    await openNewChoreForm(page);
    await page.getByLabel("Name").fill("Feed the dog");

    // Leave child picker empty = all children
    await page.getByRole("button", { name: "Create Chore" }).click();

    // Should appear in list
    const row = choreManagementRow(page, "Feed the dog");
    await expect(row).toBeVisible();
    // Should show "All children"
    await expect(row.getByText("All children")).toBeVisible();
  });

  test("can create a chore restricted to one child", async ({ page }) => {
    await signIn(page, fixture.parent_email, fixture.parent_password);
    await goToChores(page);

    await openNewChoreForm(page);
    await page.getByLabel("Name").fill("Wash dishes");

    // Select only child one — scope to the fieldset to avoid label-wrap ambiguity
    await page
      .getByRole("group", { name: /Who can complete/i })
      .getByRole("checkbox", { name: fixture.child_one_name })
      .check();

    await page.getByRole("button", { name: "Create Chore" }).click();

    const row = choreManagementRow(page, "Wash dishes");
    await expect(row).toBeVisible();
    // Should show child one's name, not "All children"
    await expect(row.getByText(fixture.child_one_name)).toBeVisible();
  });

  test("can create a rotating chore with ordered children", async ({
    page,
  }) => {
    await signIn(page, fixture.parent_email, fixture.parent_password);
    await goToChores(page);

    await openNewChoreForm(page);
    await page.getByLabel("Name").fill("Take out trash");

    // Switch to rotating FIRST (before schedule, so interval field is stable)
    await page.getByLabel("Assignment").selectOption("ROTATING");

    await page.getByLabel("Schedule").selectOption("EVERY");
    await page.locator(".inline-field-row input[type='number']").fill("1");

    // Both children should appear as checkboxes in rotation list
    await expect(
      page.getByRole("group", { name: "Rotation Order" }),
    ).toBeVisible();
    // Scope to the rotation fieldset to avoid strict mode violations
    const rotationGroup = page.getByRole("group", { name: "Rotation Order" });
    await rotationGroup
      .getByRole("checkbox", { name: fixture.child_one_name })
      .check();
    await rotationGroup
      .getByRole("checkbox", { name: fixture.child_two_name })
      .check();

    // Verify ordered list shows both
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: fixture.child_one_name })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: fixture.child_two_name })
        .first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Create Chore" }).click();

    const row = choreManagementRow(page, "Take out trash");
    await expect(row).toBeVisible();
    // Should show "Rotation:" label
    await expect(row.getByText(/Rotation:/)).toBeVisible();
  });

  test("can edit a chore and change eligibility", async ({ page }) => {
    await signIn(page, fixture.parent_email, fixture.parent_password);
    await goToChores(page);

    // First create a chore for all children
    await openNewChoreForm(page);
    await page.getByLabel("Name").fill("Vacuum living room");
    await page.getByRole("button", { name: "Create Chore" }).click();
    await expect(choreManagementRow(page, "Vacuum living room")).toBeVisible();

    // Now edit it to restrict to child two only
    await choreManagementRow(page, "Vacuum living room")
      .getByRole("button", { name: "Edit" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Edit Chore" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("Vacuum living room");

    // Wait for the child checklist fieldset to appear (proves allChildren loaded)
    const eligibilityGroup = page.getByRole("group", {
      name: /Who can complete/i,
    });
    await eligibilityGroup
      .locator("input[type='checkbox']")
      .first()
      .waitFor({ state: "visible", timeout: 10000 });

    const childTwoCheckbox = eligibilityGroup.getByRole("checkbox", {
      name: fixture.child_two_name,
    });
    const childOneCheckbox = eligibilityGroup.getByRole("checkbox", {
      name: fixture.child_one_name,
    });
    if (!(await childTwoCheckbox.isChecked())) {
      await childTwoCheckbox.check();
    }
    if (await childOneCheckbox.isChecked()) {
      await childOneCheckbox.uncheck();
    }

    await page.getByRole("button", { name: "Save Changes" }).click();

    const row = choreManagementRow(page, "Vacuum living room");
    await expect(row).toBeVisible();
    await expect(row.getByText(fixture.child_two_name)).toBeVisible();
  });

  test("can archive a chore", async ({ page }) => {
    await signIn(page, fixture.parent_email, fixture.parent_password);
    await goToChores(page);

    // Create a chore to archive
    await openNewChoreForm(page);
    await page.getByLabel("Name").fill("Temporary chore to archive");
    await page.getByRole("button", { name: "Create Chore" }).click();
    await expect(
      choreManagementRow(page, "Temporary chore to archive"),
    ).toBeVisible();

    // Archive it — handle the confirm() dialog
    page.once("dialog", (dialog) => void dialog.accept());
    await choreManagementRow(page, "Temporary chore to archive")
      .getByRole("button", { name: "Archive" })
      .click();

    // Should show archived label (span with text "archived")
    await expect(
      choreManagementRow(page, "Temporary chore to archive")
        .locator("span")
        .filter({ hasText: "archived" }),
    ).toBeVisible();
  });
});
