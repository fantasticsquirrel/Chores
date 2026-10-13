import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

type Fixture = {
  parent_email: string;
  parent_password: string;
  child_email: string;
  child_password: string;
  photo_path: string;
  viewer: { email: string; password: string };
  manager: { email: string; password: string };
  denied: { email: string; password: string };
};
test.use({ actionTimeout: 15000 });
const fixture = JSON.parse(
  readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"),
) as Fixture;
const evidence = process.env.FAMILY_TREE_SMOKE_EVIDENCE!;
function assertEvidenceDirectory() {
  if (
    !evidence ||
    !path.isAbsolute(evidence) ||
    path.dirname(evidence) !== process.env.PLAYWRIGHT_SMOKE_DIR
  )
    throw new Error("Evidence must stay inside the wrapper-owned directory.");
  mkdirSync(evidence, { recursive: true, mode: 0o700 });
}
async function ownedBackend(page: Page) {
  const response = await page.request.get("/chore-api/health/ready");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).playwright_smoke_run_id).toBe(
    process.env.PLAYWRIGHT_SMOKE_RUN_ID,
  );
}
async function signIn(page: Page, email: string, password: string) {
  await page.goto("/chore/login");
  await page.getByLabel("Email or Username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/chore\/(parent\/dashboard|child\/today)$/);
}
async function open(page: Page, name: string) {
  if (
    [
      "Import or export family tree",
      "Review duplicate and merge",
      "Permanently purge person",
    ].includes(name)
  ) {
    const details = page.locator("details").filter({
      has: page.locator("summary", {
        hasText: "Advanced record and transfer tools",
      }),
    });
    if ((await details.getAttribute("open")) === null)
      await details.locator("summary").click();
  }
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  return page.getByRole("dialog");
}
async function save(page: Page, dialog: Locator, confirmation = false) {
  if (confirmation)
    await dialog.getByLabel("I confirm this specific change.").check();
  const button = dialog.getByRole("button", {
    name: confirmation ? "Confirm change" : "Save changes",
    exact: true,
  });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function create(page: Page, name: string) {
  const first = page.getByRole("button", {
    name: "Add first person",
    exact: true,
  });
  const add = page.getByRole("button", {
    name: "Add disconnected person",
    exact: true,
  });
  await expect(first.or(add).first()).toBeVisible();
  const dialog = await open(
    page,
    (await first.count()) ? "Add first person" : "Add disconnected person",
  );
  await dialog.getByLabel("Display name", { exact: true }).fill(name);
  await dialog.getByLabel("First name", { exact: true }).fill(name);
  await save(page, dialog);
  await expect(
    page.getByRole("region", { name: `Person details: ${name}`, exact: true }),
  ).toBeVisible();
  return Number(new URL(page.url()).pathname.split("/").at(-1));
}
async function logOut(page: Page) {
  const desktop = page.getByRole("button", { name: "Log Out", exact: true });
  if (await desktop.count()) await desktop.click();
  else {
    await page.locator("details.mobile-more > summary").click();
    await page
      .getByRole("button", { name: "Log out from More menu", exact: true })
      .click();
  }
  await expect(page).toHaveURL(/\/chore\/login$/);
}
async function apiGet(page: Page, url: string) {
  const response = await page.request.get(`/chore-api/family-tree${url}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function snapshot(page: Page, name: string) {
  const smallControls = await page
    .locator(
      ".family-tree-dialog input:not([type=checkbox]), .family-tree-dialog select, .family-tree-dialog textarea",
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.height < 44;
        })
        .map((element) => ({
          tag: element.tagName,
          height: element.getBoundingClientRect().height,
        })),
    );
  expect(smallControls).toEqual([]);
  await page.screenshot({ path: path.join(evidence, name), fullPage: false });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
}
async function discard(page: Page, title: string) {
  await page
    .getByRole("button", { name: `Close ${title}`, exact: true })
    .click();
  const discard = page.getByRole("button", {
    name: "Discard advanced draft",
    exact: true,
  });
  if (await discard.count()) await discard.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

for (const viewport of [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "mobile-web", width: 390, height: 844 },
]) {
  test(`actual API FT2+FT3 complete journey ${viewport.name}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(150000);
    assertEvidenceDirectory();
    await page.setViewportSize(viewport);
    await ownedBackend(page);
    const failedRequests: {
      method: string;
      path: string;
      error: string | null;
    }[] = [];
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/chore-api/family-tree"))
        failedRequests.push({
          method: request.method(),
          path: url.pathname,
          error: request.failure()?.errorText ?? null,
        });
    });
    const errors: string[] = [],
      requests: { method: string; path: string; status: number }[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().includes("status of 401")
      )
        errors.push(message.text());
    });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/chore-api/family-tree"))
        requests.push({
          method: response.request().method(),
          path: url.pathname,
          status: response.status(),
        });
    });
    await signIn(page, fixture.parent_email, fixture.parent_password);
    await page.goto("/chore/family-tree");
    await expect(
      page.getByRole("region", { name: "Family Tree workspace" }),
    ).toBeVisible();
    const label = `FT ${viewport.name} Morgan`;
    const rootId = await create(page, label);
    let dialog = await open(page, "Add relative or relationship");
    await dialog
      .getByRole("button", { name: "Continue with new person", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("First name", { exact: true })
      .fill(`FT ${viewport.name} Parent`);
    await dialog
      .getByLabel("Recorded relationship kind", { exact: true })
      .selectOption("adoptive");
    await save(page, dialog);
    const relativeId = Number(new URL(page.url()).pathname.split("/").at(-1));
    await page.goto(`/chore/family-tree/people/${rootId}?focus=${rootId}`);
    await expect(
      page.getByRole("region", {
        name: `Person details: ${label}`,
        exact: true,
      }),
    ).toBeVisible();
    const sourceName = `${label} duplicate`;
    const sourceId = await create(page, sourceName);
    dialog = await open(page, "Add story");
    await dialog
      .getByLabel("Story title (required)")
      .fill(`Memory ${viewport.name}`);
    await dialog
      .getByLabel("Full story (limited Markdown) (required)")
      .fill("Complete **recorded story** with household attribution.");
    await save(page, dialog);
    await expect(
      page.getByRole("heading", {
        name: `Memory ${viewport.name}`,
        exact: true,
      }),
    ).toBeVisible();
    dialog = await open(page, "Add residence");
    await dialog
      .getByLabel("Residence place (required)")
      .fill(`Old Town ${viewport.name}`);
    await dialog
      .getByLabel("Source label", { exact: true })
      .fill("Entered paper record");
    await save(page, dialog);
    await expect(
      page.getByRole("heading", {
        name: `Old Town ${viewport.name}`,
        exact: true,
      }),
    ).toBeVisible();
    dialog = await open(page, "Upload photograph");
    await dialog
      .getByLabel("Photograph file")
      .setInputFiles(fixture.photo_path);
    await dialog
      .getByLabel("Photo caption")
      .fill(`Sanitized photograph ${viewport.name}`);
    await dialog
      .getByRole("button", { name: "Upload sanitized copy", exact: true })
      .click();
    await expect(
      dialog.getByText(/Sanitized asset \d+ is ready/),
    ).toBeVisible();
    await dialog.getByLabel("Photo use").selectOption("primary");
    await dialog
      .getByRole("button", { name: "Attach photograph", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    let refs = await apiGet(page, `/people/${sourceId}/media`);
    expect(refs).toHaveLength(1);
    expect(refs[0].role).toBe("primary");
    const assetId = refs[0].asset_id;
    await page
      .getByRole("button", { name: `View photograph ${assetId}`, exact: true })
      .click();
    await expect(
      page.getByAltText(`Sanitized photograph ${viewport.name}`),
    ).toBeVisible();
    await snapshot(page, `${viewport.name}-private-photo.png`);
    await page
      .getByRole("button", { name: "Close Private photograph", exact: true })
      .click();
    // A staged merge can be cancelled without touching either person.
    dialog = await open(page, "Review duplicate and merge");
    await dialog
      .getByLabel("Canonical target person")
      .selectOption(String(rootId));
    await dialog
      .getByRole("button", { name: "Preview merge", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", {
        name: "Complete merge preview",
        exact: true,
      }),
    ).toBeVisible();
    await snapshot(page, `${viewport.name}-merge-preview.png`);
    await discard(page, "Review duplicate and merge");
    expect(
      (await apiGet(page, `/people/${sourceId}`)).person.merged_into_person_id,
    ).toBeNull();
    dialog = await open(page, "Review duplicate and merge");
    await dialog
      .getByLabel("Canonical target person")
      .selectOption(String(rootId));
    await dialog
      .getByRole("button", { name: "Preview merge", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", {
        name: "Complete merge preview",
        exact: true,
      }),
    ).toBeVisible();
    for (const selector of await dialog
      .getByRole("combobox", { name: /^Retain / })
      .all())
      await selector.selectOption("target");
    await dialog
      .getByRole("button", { name: "Preview merge", exact: true })
      .click();
    await expect(
      dialog.getByLabel("I reviewed the complete merge consequences."),
    ).toBeEnabled();
    await dialog
      .getByLabel("I reviewed the complete merge consequences.")
      .check();
    await dialog
      .getByRole("button", { name: "Commit reviewed merge", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(/This is an alias record/)).toBeVisible();
    const alias = await apiGet(page, `/people/${sourceId}`);
    expect(alias.person.merged_into_person_id).toBe(rootId);
    expect(alias.canonical_person.id).toBe(rootId);
    await page
      .getByRole("button", { name: "Open canonical person", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: `Memory ${viewport.name}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: `Old Town ${viewport.name}`,
        exact: true,
      }),
    ).toBeVisible();
    refs = await apiGet(page, `/people/${rootId}/media`);
    expect(
      refs.some((r: { asset_id: number }) => r.asset_id === assetId),
    ).toBeTruthy();
    const graph = page.getByRole("region", {
      name: "Family tree",
      exact: true,
    });
    await graph.scrollIntoViewIfNeeded();
    await snapshot(page, `${viewport.name}-core-tree.png`);
    await page
      .getByRole("button", { name: "Relationship list only", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Recorded relationships", exact: true })
        .first(),
    ).toBeVisible();
    dialog = await open(page, "Import or export family tree");
    await dialog.getByLabel("Export format").selectOption("json");
    await dialog
      .getByRole("button", { name: "Create logical export", exact: true })
      .click();
    await expect(dialog.getByText(/^Metadata-only JSON: /)).toBeVisible();
    const downloadEvent = page.waitForEvent("download");
    await dialog
      .getByRole("button", { name: "Download authorized export", exact: true })
      .click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("family-tree.json");
    const jsonPath = path.join(evidence, `${viewport.name}-logical.json`);
    await download.saveAs(jsonPath);
    const manifest = JSON.parse(readFileSync(jsonPath, "utf8"));
    expect(manifest.schema_version).toBe(1);
    expect(manifest.people.length).toBeGreaterThanOrEqual(3);
    expect(manifest.media_omitted).toBe(true);
    expect(JSON.stringify(manifest)).not.toMatch(
      /password_hash|session_token|household_id/,
    );
    await dialog.getByLabel("Export format").selectOption("zip");
    await dialog
      .getByRole("button", { name: "Create logical export", exact: true })
      .click();
    await expect(dialog.getByText(/ZIP: logical records/)).toBeVisible();
    const zipEvent = page.waitForEvent("download");
    await dialog
      .getByRole("button", { name: "Download authorized export", exact: true })
      .click();
    const zip = await zipEvent;
    const zipPath = path.join(evidence, `${viewport.name}-logical.zip`);
    await zip.saveAs(zipPath);
    expect(readFileSync(zipPath).subarray(0, 2).toString()).toBe("PK");
    await dialog.getByLabel("Append import file").setInputFiles(jsonPath);
    await dialog
      .getByRole("button", { name: "Stage append import", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", {
        name: "Complete append preview",
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog.getByText(/Missing media:/)).toBeVisible();
    await snapshot(page, `${viewport.name}-append-preview.png`);
    await dialog
      .getByRole("button", { name: "Cancel staged import", exact: true })
      .click();
    await expect(dialog.getByText(/Staged import cancelled/)).toBeVisible();
    await dialog.getByLabel("Append import file").setInputFiles(jsonPath);
    await dialog
      .getByRole("button", { name: "Stage append import", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", {
        name: "Complete append preview",
        exact: true,
      }),
    ).toBeVisible();
    await dialog
      .getByLabel(
        "I reviewed counts, missing media, warnings and append-only consequences.",
      )
      .check();
    await dialog
      .getByRole("button", { name: "Commit append import", exact: true })
      .click();
    await expect(
      dialog.getByText(/Import committed and read back/),
    ).toBeVisible();
    await discard(page, "Import or export family tree");
    // Canonical purge must report aliases; no destructive implicit alias cascade.
    dialog = await open(page, "Permanently purge person");
    await dialog.getByLabel("Owner password").fill(fixture.parent_password);
    await dialog
      .getByRole("button", { name: "Preview permanent purge", exact: true })
      .click();
    await expect(dialog.getByText(/Blocking alias person IDs:/)).toBeVisible();
    await discard(page, "Owner-confirmed permanent purge");
    await page.goto(`/chore/family-tree/people/${sourceId}`);
    await expect(page.getByText(/This is an alias record/)).toBeVisible();
    dialog = await open(page, "Permanently purge person");
    await dialog.getByLabel("Owner password").fill(fixture.parent_password);
    await dialog
      .getByRole("button", { name: "Preview permanent purge", exact: true })
      .click();
    await expect(dialog.getByText(/This is alias-only removal/)).toBeVisible();
    await expect(dialog.getByLabel("Owner password")).toHaveValue("");
    await snapshot(page, `${viewport.name}-alias-purge-preview.png`);
    await dialog.getByLabel("Owner password").fill(fixture.parent_password);
    await dialog
      .getByLabel("I understand this removes only this person irreversibly.")
      .check();
    await dialog
      .getByRole("button", { name: "Commit permanent purge", exact: true })
      .click();
    await expect(
      page.getByText(/Purge confirmed by an authorized not-found readback/),
    ).toBeVisible();
    expect(
      (
        await page.request.get(`/chore-api/family-tree/people/${sourceId}`)
      ).status(),
    ).toBe(404);
    expect((await apiGet(page, `/people/${rootId}`)).person.id).toBe(rootId);
    expect(
      (await apiGet(page, `/people/${rootId}/stories`)).items.some(
        (s: { title: string }) => s.title === `Memory ${viewport.name}`,
      ),
    ).toBeTruthy();
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Family Tree workspace" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((k) =>
          /genealogy|family.?tree/i.test(k),
        ),
      ),
    ).toEqual([]);
    await context.setOffline(true);
    await expect(
      page.getByText(/Offline: showing only this session/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Add disconnected person",
        exact: true,
      }),
    ).toBeDisabled();
    await context.setOffline(false);
    await expect(
      page.getByRole("button", {
        name: "Add disconnected person",
        exact: true,
      }),
    ).toBeEnabled();
    const persistentGenealogy = await page.evaluate(async () => {
      const matches: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys())
          if (
            new URL(request.url).pathname.startsWith("/chore-api/family-tree")
          )
            matches.push(request.url);
      }
      return matches;
    });
    expect(persistentGenealogy).toEqual([]);
    // Known expected conflict/404 diagnostics are recorded separately, never a fabricated clean network.
    expect(errors.filter((e) => !/status of (404|409)/.test(e))).toEqual([]);
    await logOut(page);
    await signIn(page, fixture.viewer.email, fixture.viewer.password);
    await page.goto(`/chore/family-tree/people/${rootId}`);
    await expect(
      page.getByText("View-only access. Management controls are unavailable."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit person", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Upload photograph", exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await page.request.get(`/chore-api/family-tree/exports/1/download`)
      ).status(),
    ).toBe(403);
    await snapshot(page, `${viewport.name}-view-only.png`);
    await logOut(page);
    await signIn(page, fixture.denied.email, fixture.denied.password);
    const contentCalls: string[] = [];
    const deniedObserver = (request: import("@playwright/test").Request) => {
      if (new URL(request.url()).pathname.startsWith("/chore-api/family-tree"))
        contentCalls.push(request.url());
    };
    page.on("request", deniedObserver);
    await page.goto("/chore/family-tree");
    await expect(
      page.getByRole("heading", {
        name: "Family Tree not available",
        exact: true,
      }),
    ).toBeVisible();
    expect(contentCalls).toEqual([]);
    page.off("request", deniedObserver);
    await snapshot(page, `${viewport.name}-denied.png`);
    await logOut(page);
    await signIn(page, fixture.manager.email, fixture.manager.password);
    await page.goto(`/chore/family-tree/people/${rootId}`);
    await expect(
      page.getByRole("button", { name: "Edit person", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Permanently purge person",
        exact: true,
      }),
    ).toHaveCount(0);
    const managerCaps = (await apiGet(page, "/")).capabilities;
    expect(managerCaps.can_manage).toBe(true);
    expect(managerCaps.can_purge).toBe(false);
    await logOut(page);
    await signIn(page, fixture.child_email, fixture.child_password);
    expect((await page.request.get("/chore-api/family-tree/")).status()).toBe(
      403,
    );
    const protectedReadback = {
      viewport,
      rootId,
      relativeId,
      sourceId,
      assetId,
      aliasPurgeReadback: "404",
      canonicalRetained: true,
      offlineEditingDisabled: true,
      persistentGenealogy,
      permissionReadbacks: {
        viewerExport: 403,
        deniedContentCalls: contentCalls.length,
        nonownerManage: managerCaps.can_manage,
        nonownerPurge: managerCaps.can_purge,
        childCollection: 403,
      },
      requests,
      errors,
      failedRequests,
    };
    writeFileSync(
      path.join(evidence, `${viewport.name}-readbacks.json`),
      JSON.stringify(protectedReadback, null, 2),
      { mode: 0o600 },
    );
    await context.clearCookies();
  });
}
