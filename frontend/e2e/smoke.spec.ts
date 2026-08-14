import { existsSync, readFileSync } from "node:fs";
import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";

import { requestPasswordResetTokenThroughWorkerPipe } from "../scripts/playwright-password-reset-bridge";
import {
  installPasswordResetCapabilityBootstrap,
  requireIsolatedPlaywrightSmokeConfiguration,
} from "../scripts/playwright-smoke-isolation";

type SmokeFixture = {
  parent_email: string;
  parent_password: string;
  child_email: string;
  child_password: string;
  child_name: string;
  chore_name: string;
  create_child_name: string;
};

type PasswordResetFixture = {
  parent_email: string;
  old_password: string;
  new_password: string;
};

const GENERIC_ACK =
  "If an eligible account exists for that address, reset instructions will arrive shortly.";
const CONFIRM_ACK =
  "Try signing in. If you cannot sign in, request a new reset link.";

function requiredSmokeRunId(): string {
  const runId = process.env.PLAYWRIGHT_SMOKE_RUN_ID;
  if (runId === undefined || !/^[A-Za-z0-9_-]{32,128}$/.test(runId)) {
    throw new Error(
      "PLAYWRIGHT_SMOKE_RUN_ID must be a wrapper-issued opaque nonce.",
    );
  }
  return runId;
}

async function assertWrapperOwnedBackend(
  request: APIRequestContext,
): Promise<void> {
  const readiness = await request.get("/chore-api/health/ready");
  expect(readiness.status()).toBe(200);
  await expect(readiness.json()).resolves.toMatchObject({
    status: "ok",
    playwright_smoke_run_id: requiredSmokeRunId(),
  });
}

function readFixture(): SmokeFixture {
  const fixturePath = process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH;
  if (fixturePath === undefined || !existsSync(fixturePath)) {
    throw new Error(
      "PLAYWRIGHT_SMOKE_FIXTURE_PATH must point to an isolated wrapper-owned fixture.",
    );
  }
  return JSON.parse(readFileSync(fixturePath, "utf-8")) as SmokeFixture;
}

function readPasswordResetFixture(): PasswordResetFixture {
  const fixturePath = process.env.PLAYWRIGHT_PASSWORD_RESET_FIXTURE_PATH;
  if (fixturePath === undefined || !existsSync(fixturePath)) {
    throw new Error(
      "PLAYWRIGHT_PASSWORD_RESET_FIXTURE_PATH must point to an isolated reset fixture.",
    );
  }
  return JSON.parse(readFileSync(fixturePath, "utf-8")) as PasswordResetFixture;
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

function choreRow(page: Page, choreName: string): Locator {
  return page.locator("li.balance-item").filter({ hasText: choreName }).first();
}

function submissionRow(page: Page, childName: string): Locator {
  return page
    .locator("li.submission-item")
    .filter({ hasText: childName })
    .first();
}

test("deployed chore smoke flow enforces login and supports parent/child/board actions", async ({
  page,
  request,
}) => {
  await assertWrapperOwnedBackend(request);
  const fixture = readFixture();

  await page.goto("/chore/parent/children");
  await expect(page).toHaveURL(/\/chore\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome Back" }),
  ).toBeVisible();

  await signIn(page, fixture.parent_email, fixture.parent_password);
  await expect(page).toHaveURL(/\/chore\/parent\/dashboard$/);
  await page.getByRole("link", { name: "Manage Children" }).click();
  await expect(page).toHaveURL(/\/chore\/parent\/children$/);
  await page.getByLabel("Name").fill(fixture.create_child_name);
  await page.getByRole("button", { name: "Create Child" }).click();
  await expect(
    page
      .getByRole("list", { name: "Children list" })
      .locator("li.balance-item")
      .filter({ hasText: fixture.create_child_name }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/chore\/login$/);

  await signIn(page, fixture.child_email, fixture.child_password);
  await expect(page).toHaveURL(/\/chore\/child\/today$/);
  await expect(choreRow(page, fixture.chore_name)).toBeVisible();
  await choreRow(page, fixture.chore_name)
    .locator("input[type='checkbox']")
    .check();
  await page.getByRole("button", { name: "Submit Selected Chores" }).click();
  await expect(
    page.getByText("Submitted 1 chore(s) for review."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/chore\/login$/);

  await signIn(page, fixture.parent_email, fixture.parent_password);
  await expect(page).toHaveURL(/\/chore\/parent\/dashboard$/);
  await page.getByRole("link", { name: "Open Board" }).click();
  await expect(page).toHaveURL(/\/chore\/board$/);
  await expect(submissionRow(page, fixture.child_name)).toBeVisible();
  await submissionRow(page, fixture.child_name)
    .getByRole("button", { name: "Approve All" })
    .click();
  await expect(
    page.getByText("No pending submissions right now."),
  ).toBeVisible();
});

test("isolated password-reset flow consumes a controlled mailbox capability without token URL leakage", async ({
  page,
  request,
}) => {
  await assertWrapperOwnedBackend(request);
  const fixture = readPasswordResetFixture();

  await page.goto("/chore/forgot-password");
  await page.getByLabel("Email").fill(fixture.parent_email);
  await page.getByRole("button", { name: "Request Reset Link" }).click();
  await expect(page.getByRole("status")).toHaveText(GENERIC_ACK);

  // The real reset worker is captured only by a short-lived child-process pipe.
  // No RFC822 message or raw capability is persisted to a test artifact.
  const token = requestPasswordResetTokenThroughWorkerPipe(
    fixture.parent_email,
  );
  const { baseURL } = requireIsolatedPlaywrightSmokeConfiguration(process.env);
  const resetResponse = await page.request.get("/chore/reset-password");
  expect(resetResponse.status()).toBe(200);
  expect(resetResponse.headers()["cache-control"]).toBe("no-store");
  expect(resetResponse.headers()["referrer-policy"]).toBe("no-referrer");
  expect(resetResponse.headers()["content-security-policy"]).toContain(
    "default-src 'self'",
  );
  expect(resetResponse.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );

  await installPasswordResetCapabilityBootstrap(page, token);
  await page.goto("/chore/reset-password");
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/chore/reset-password");
  await expect(
    page.getByRole("heading", { name: "Set a New Password" }),
  ).toBeVisible();
  // Never pass the raw capability to Playwright's assertion formatter: a failed
  // text assertion can serialize its expected string into CI diagnostics.
  const pageBody = await page.locator("body").textContent();
  const resetCapabilityAppearsInBody = pageBody?.includes(token) ?? false;
  expect(resetCapabilityAppearsInBody).toBe(false);
  await page
    .getByLabel("New Password", { exact: true })
    .fill(fixture.new_password);
  await page
    .getByLabel("Confirm New Password", { exact: true })
    .fill(fixture.new_password);
  await page.getByRole("button", { name: "Set New Password" }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/chore/login");
  await expect.poll(() => new URL(page.url()).search).toBe("?passwordReset=1");
  await expect(page.getByText(CONFIRM_ACK)).toBeVisible();

  await signIn(page, fixture.parent_email, fixture.old_password);
  await expect(page.getByText(/Could not sign in:/)).toBeVisible();
  await signIn(page, fixture.parent_email, fixture.new_password);
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/chore/parent/dashboard");
  await page.getByRole("button", { name: "Log Out" }).click();
  // Logout is asynchronous. Wait until it has cleared the live session before
  // proving a replay receives the uniform anonymous-capability response.
  await expect.poll(() => new URL(page.url()).pathname).toBe("/chore/login");

  const replay = await fetch(
    new URL("/chore-api/auth/password-reset/confirm", baseURL),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, new_password: fixture.new_password }),
    },
  );
  expect(replay.status).toBe(202);
  await expect(replay.json()).resolves.toEqual({ detail: CONFIRM_ACK });
});

test("deployed auth protections block anonymous and wrong-role access", async ({
  page,
  request,
}) => {
  await assertWrapperOwnedBackend(request);
  const fixture = readFixture();

  await page.goto("/chore/board");
  await expect(page).toHaveURL(/\/chore\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome Back" }),
  ).toBeVisible();

  const anonymousChildrenResponse = await page.request.get(
    "/chore-api/children?household_id=1",
  );
  expect(anonymousChildrenResponse.status()).toBe(401);
  const anonymousChildrenBody = await anonymousChildrenResponse.json();
  expect(anonymousChildrenBody).toMatchObject({
    detail: "Not authenticated.",
  });

  await signIn(page, fixture.child_email, fixture.child_password);
  await expect(page).toHaveURL(/\/chore\/child\/today$/);

  await page.goto("/chore/parent/dashboard");
  await expect(page).toHaveURL(/\/chore\/child\/today$/);

  const childParentEndpoint = await page.evaluate(async () => {
    const response = await fetch("/chore-api/submissions", {
      credentials: "include",
    });
    return { status: response.status, body: await response.json() };
  });
  expect(childParentEndpoint.status).toBe(403);
  const childParentEndpointBody = childParentEndpoint.body;
  expect(childParentEndpointBody).toMatchObject({
    detail: "Forbidden.",
  });
});
