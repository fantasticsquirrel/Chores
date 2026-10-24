import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { requireIsolatedPlaywrightSmokeConfiguration } from "../scripts/playwright-smoke-isolation";

requireIsolatedPlaywrightSmokeConfiguration(process.env);
const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
) as { parent_email: string; parent_password: string };

function seedSettingsAdmin(): { email: string; password: string } {
  const python = process.env.PLAYWRIGHT_BACKEND_PYTHON;
  if (
    !python ||
    !process.env.DATABASE_URL ||
    process.env.PLAYWRIGHT_ISOLATED_DB !== "1"
  ) {
    throw new Error(
      "Settings Admin E2E requires the wrapper-owned isolated database and backend Python.",
    );
  }
  // The standard parent is deliberately not an admin. Seed a separate synthetic
  // household, without changing that parent's role or any existing grants.
  const output = execFileSync(
    python,
    [
      "-c",
      `
import json, os, secrets
from pathlib import Path
from sqlalchemy import func, select
from app.config import get_settings
from app.db import get_session_factory
from app.models import Household, User
from app.models.enums import UserRole
from app.security import hash_parent_password
from app.smoke_safety import require_isolated_smoke_database

database = require_isolated_smoke_database(get_settings().database_url)
if database.parent != Path(os.environ["PLAYWRIGHT_SMOKE_DIR"]).resolve():
    raise RuntimeError("Settings fixture database is not owned by the current smoke wrapper.")
suffix = secrets.token_hex(8)
email = f"playwright.settings.{suffix}@example.com"
password = "playwright settings-only admin password"
with get_session_factory(f"sqlite:///{database}")() as session:
    household_id = (session.scalar(select(func.max(Household.id))) or 0) + 1
    user_id = (session.scalar(select(func.max(User.id))) or 0) + 1
    session.add(Household(id=household_id, name=f"Settings Smoke {suffix}", timezone="UTC", owner_user_id=user_id))
    session.add(User(id=user_id, household_id=household_id, email=email,
                     password_hash=hash_parent_password(password), role=UserRole.PARENT_ADMIN, child_id=None))
    session.commit()
print(json.dumps({"email": email, "password": password}))
`,
    ],
    {
      cwd: fileURLToPath(new URL("../../backend/", import.meta.url)),
      encoding: "utf8",
      env: process.env,
    },
  );
  return JSON.parse(output.trim()) as { email: string; password: string };
}

async function signInReadOnly(page: Page, email: string, password: string) {
  const login = await page.request.post("/chore-api/auth/login", {
    data: { email, password },
  });
  expect(login.ok()).toBe(true);
  const attemptedWrites: string[] = [];
  // After authentication these journeys only read APIs and edit local drafts.
  // Fail closed if a navigation or draft edit accidentally attempts a write.
  await page.route("**/chore-api/**", async (route) => {
    const request = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      attemptedWrites.push(
        `${request.method()} ${new URL(request.url()).pathname}`,
      );
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  return attemptedWrites;
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

async function reloadInbox(page: Page, control: string, unread: "0" | "1") {
  const response = page.waitForResponse((item) => {
    const url = new URL(item.url());
    return (
      item.request().method() === "GET" &&
      url.pathname === "/chore-api/notifications" &&
      url.searchParams.get("unread") === unread
    );
  });
  await page.getByRole("button", { name: control, exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(
    page.getByRole("button", { name: "Refresh inbox" }),
  ).toBeEnabled();
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`account sections and isolated notification drafts at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const attemptedWrites = await signInReadOnly(
      page,
      fixture.parent_email,
      fixture.parent_password,
    );

    // The security pathname wins even when a conflicting section query exists.
    await page.goto("/chore/account/security?section=appearance");
    const account = page.getByRole("navigation", { name: "Account sections" });
    await expect(
      account.getByRole("button", { name: "Security", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("heading", { name: "Account Security", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Current Password", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Appearance", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Subscription", exact: true }),
    ).toBeHidden();
    await expectNoHorizontalOverflow(page);

    await account
      .getByRole("button", { name: "Appearance", exact: true })
      .click();
    await expect(page).toHaveURL(/\/account\?section=appearance$/);
    await expect(
      account.getByRole("button", { name: "Appearance", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("heading", { name: "Appearance", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Current Password", { exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Subscription", exact: true }),
    ).toBeHidden();
    await expectNoHorizontalOverflow(page);

    await account
      .getByRole("button", { name: "Subscription", exact: true })
      .click();
    await expect(page).toHaveURL(/\/account\?section=subscription$/);
    await expect(
      account.getByRole("button", { name: "Subscription", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("heading", { name: "Subscription", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Appearance", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByLabel("Current Password", { exact: true }),
    ).toBeHidden();
    await account
      .getByRole("button", { name: "Security", exact: true })
      .click();
    await expect(page).toHaveURL(/\/account\/security$/);
    await expect(
      page.getByLabel("Current Password", { exact: true }),
    ).toBeVisible();

    const savedResponse = await page.request.get(
      "/chore-api/notification-settings",
    );
    expect(savedResponse.ok()).toBe(true);
    const savedSettings: unknown = await savedResponse.json();
    let settingsReads = 0;
    page.on("request", (request) => {
      if (
        request.method() === "GET" &&
        new URL(request.url()).pathname === "/chore-api/notification-settings"
      )
        settingsReads++;
    });
    await page.goto("/chore/notifications");
    const views = page.getByRole("navigation", { name: "Notification views" });
    await expect(
      views.getByRole("button", { name: "Inbox", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "All", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Unread", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.getByRole("heading", { name: "Chore reminder settings" }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Refresh inbox" }),
    ).toBeEnabled();

    await views.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      views.getByRole("button", { name: "Settings", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("heading", { name: "Inbox", exact: true }),
    ).toBeHidden();
    const hours = page.getByLabel("Due soon hours", { exact: true });
    const digest = page.getByRole("checkbox", {
      name: "Daily chore digest",
      exact: true,
    });
    await expect(hours).toBeEnabled();
    const draftHours = (await hours.inputValue()) === "37" ? "38" : "37";
    const draftDigest = !(await digest.isChecked());
    await hours.fill(draftHours);
    await digest.setChecked(draftDigest);
    await expect(
      page.getByText("Unsaved reminder changes", { exact: true }),
    ).toBeVisible();
    expect(settingsReads).toBe(1);
    await expectNoHorizontalOverflow(page);

    await views.getByRole("button", { name: "Inbox", exact: true }).click();
    await expect(hours).toBeHidden();
    await reloadInbox(page, "Unread", "1");
    await expect(
      page.getByRole("button", { name: "Unread", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "All", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await reloadInbox(page, "All", "0");
    await expect(
      page.getByRole("button", { name: "All", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Unread", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await reloadInbox(page, "Refresh inbox", "0");
    await views.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(hours).toHaveValue(draftHours);
    await expect(digest).toBeChecked({ checked: draftDigest });
    await expect(
      page.getByText("Unsaved reminder changes", { exact: true }),
    ).toBeVisible();
    expect(settingsReads).toBe(1);
    const unchangedResponse = await page.request.get(
      "/chore-api/notification-settings",
    );
    expect(unchangedResponse.ok()).toBe(true);
    expect(await unchangedResponse.json()).toEqual(savedSettings);
    expect(attemptedWrites).toEqual([]);
    await expectNoHorizontalOverflow(page);
  });

  test(`admin scope labels and focused local Add Parent draft at ${viewport.width}px`, async ({
    page,
  }) => {
    const admin = seedSettingsAdmin();
    await page.setViewportSize(viewport);
    const attemptedWrites = await signInReadOnly(
      page,
      admin.email,
      admin.password,
    );
    await page.goto("/chore/admin/dashboard");
    await expect(
      page.getByRole("heading", { name: "Admin Dashboard", exact: true }),
    ).toBeVisible();
    const householdHeading = page.getByRole("heading", {
      name: "Household Module Toggles",
      exact: true,
    });
    const userHeading = page.getByRole("heading", {
      name: "Module Access Matrix",
      exact: true,
    });
    await expect(householdHeading).toBeVisible();
    await expect(
      page.getByText(
        "These controls affect everyone in the household. Per-user access can still be limited below.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(userHeading).toBeVisible();
    await expect(
      page.getByText(
        "Individual user access: these controls affect only the named person. They cannot enable a module that is off for the household.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Household module toggles", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("list", { name: "User module access list", exact: true })
        .getByText(admin.email, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Admin household module", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "✓ Admin", exact: true }),
    ).toBeDisabled();
    await expect(page.getByLabel("Email", { exact: true })).toBeHidden();
    await expectNoHorizontalOverflow(page);

    const addParent = page.getByRole("button", {
      name: "Add Parent",
      exact: true,
    });
    await addParent.click();
    await expect(addParent).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("heading", { name: "Add Parent Login", exact: true }),
    ).toBeVisible();
    const email = page.getByLabel("Email", { exact: true });
    await expect(email).toBeFocused();
    await expect(householdHeading).toBeHidden();
    await expect(userHeading).toBeHidden();
    await expect(
      page.getByRole("switch", { name: "Admin household module", exact: true }),
    ).toBeHidden();
    await email.fill("local-draft-only@example.com");
    await expectNoHorizontalOverflow(page);

    // This is an inline focused view, not a modal: its explicit Back action
    // cancels the view, retains the local draft, and restores trigger focus.
    const back = page.getByRole("button", {
      name: "Back to module management",
      exact: true,
    });
    await back.focus();
    await page.keyboard.press("Enter");
    await expect(addParent).toBeFocused();
    await expect(addParent).toHaveAttribute("aria-expanded", "false");
    await expect(email).toBeHidden();
    await expect(householdHeading).toBeVisible();
    await expect(userHeading).toBeVisible();
    await addParent.click();
    await expect(email).toBeFocused();
    await expect(email).toHaveValue("local-draft-only@example.com");
    await back.click();
    await expect(addParent).toBeFocused();
    expect(attemptedWrites).toEqual([]);
  });
}
