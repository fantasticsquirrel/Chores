import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OpsApp } from "./OpsApp";
import { opsApi } from "./api/client";
import type {
  GlobalModule,
  OpsRole,
} from "@family-manager/family-api/ops-models";

const chores: GlobalModule = {
  key: "chores",
  name: "Chores",
  description: "Household chores",
  enabled: true,
  can_enable: true,
  can_disable: true,
  restriction: null,
  platforms: { web: true, mobile: true },
};
const tree: GlobalModule = {
  ...chores,
  key: "family-tree",
  name: "Family Tree",
  enabled: false,
  can_enable: false,
  restriction: "Not released on any platform",
  platforms: { web: false, mobile: false },
};
function session(role: OpsRole = "PLATFORM_OWNER") {
  vi.spyOn(opsApi, "getCurrentOpsSession").mockResolvedValue({
    user: {
      id: 1,
      email: "operator@example.com",
      role,
      mfa_required: true,
      mfa_verified: true,
    },
  });
}
function page(path = "/ops") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <OpsApp />
    </MemoryRouter>,
  );
}
async function confirm() {
  fireEvent.click(
    await screen.findByRole("button", { name: "Disable Chores" }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Confirm module change",
  });
  fireEvent.change(within(dialog).getByLabelText("Change reason"), {
    target: { value: "Planned maintenance" },
  });
  fireEvent.change(within(dialog).getByLabelText("Current operator password"), {
    target: { value: "secret" },
  });
  fireEvent.change(within(dialog).getByLabelText("Six-digit MFA code"), {
    target: { value: "123456" },
  });
  await act(async () => {
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm change" }),
    );
  });
}

describe("owner operations", () => {
  it("confirms household scope, preserves masked stored opt-in, and paginates safe account roles", async () => {
    session();
    vi.spyOn(opsApi, "getHousehold").mockResolvedValue({
      id: 42,
      name: "Smith household",
      owner_email: "ow…@example.com",
      billing_status: "active",
      ownership: {
        household_id: 42,
        owner_user_id: 9,
        owner_email: "ow…@example.com",
      },
      billing: {
        status: "active",
        provider: "web",
        plan_name: "Family",
        expires_at: null,
        current_period_ends_at: null,
        available_actions: [],
      },
      entitlements: [],
      support_cases: [],
    });
    vi.spyOn(opsApi, "listHouseholdEvents").mockResolvedValue([]);
    vi.spyOn(opsApi, "listAuditEntries").mockResolvedValue([]);
    const module = {
      key: "chores",
      name: "Chores",
      description: "Chores",
      enabled: true,
      globally_enabled: false,
      effective_enabled: false,
      can_enable: false,
      can_disable: true,
      restriction: "Globally disabled",
    };
    const reads = vi
      .spyOn(opsApi, "listOwnerHouseholdModules")
      .mockResolvedValueOnce([module])
      .mockResolvedValue([{ ...module, enabled: false }]);
    const accounts = vi
      .spyOn(opsApi, "listOwnerHouseholdAccounts")
      .mockResolvedValueOnce({
        household_id: 42,
        items: [
          {
            id: 9,
            email: "parent@example.com",
            role: "PARENT_ADMIN",
            active: true,
            is_household_owner: true,
          },
        ],
        total: 26,
        offset: 0,
        limit: 25,
      })
      .mockResolvedValue({
        household_id: 42,
        items: [
          {
            id: 10,
            email: "member@example.com",
            role: "PARENT",
            active: false,
            is_household_owner: false,
          },
        ],
        total: 26,
        offset: 25,
        limit: 25,
      });
    vi.spyOn(opsApi, "reauthenticate").mockResolvedValue();
    const write = vi
      .spyOn(opsApi, "setOwnerHouseholdModule")
      .mockResolvedValue({ ...module, enabled: false });
    page("/ops/households/42");
    expect(
      await screen.findByRole("cell", { name: "PARENT ADMIN" }),
    ).toBeVisible();
    expect(screen.getByRole("cell", { name: "Household owner" })).toBeVisible();
    expect(screen.getByText("Globally disabled")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next accounts" }));
    expect(await screen.findByRole("cell", { name: "Inactive" })).toBeVisible();
    expect(accounts).toHaveBeenLastCalledWith(42, { offset: 25, limit: 25 });
    fireEvent.click(screen.getByRole("button", { name: "Disable Chores" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Smith household (#42)",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await confirm();
    await screen.findByText("Saved and verified from the server.");
    expect(write).toHaveBeenCalledWith(42, "chores", {
      enabled: false,
      expected_enabled: true,
      reason: "Planned maintenance",
    });
    expect(reads).toHaveBeenCalledTimes(2);
  });
  it("freezes pending intent, clears secrets immediately, and does not permit duplicate saves", async () => {
    session();
    vi.spyOn(opsApi, "listGlobalModules").mockResolvedValue([chores]);
    let authorize!: () => void;
    vi.spyOn(opsApi, "reauthenticate").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          authorize = resolve;
        }),
    );
    const write = vi
      .spyOn(opsApi, "setGlobalModule")
      .mockResolvedValue({ ...chores, enabled: false });
    page("/ops/modules");
    await confirm();
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByLabelText("Current operator password"),
    ).toHaveValue("");
    expect(within(dialog).getByLabelText("Six-digit MFA code")).toHaveValue("");
    expect(within(dialog).getByLabelText("Change reason")).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Authorizing and saving…" }),
    );
    expect(write).not.toHaveBeenCalled();
    await act(async () => authorize());
    await screen.findByText("Saved and verified from the server.");
    expect(write).toHaveBeenCalledTimes(1);
  });
  afterEach(() => vi.restoreAllMocks());
  it("lands on live overview, applies theme, and links distinct owner routes", async () => {
    session();
    vi.spyOn(opsApi, "getOwnerOverview").mockResolvedValue({
      household_count: 19,
      account_count: 62,
      active_account_count: 58,
      enabled_module_count: 8,
      module_count: 10,
    });
    page();
    expect(
      await screen.findByRole("heading", { name: "Owner overview" }),
    ).toBeVisible();
    expect(await screen.findByText("19")).toBeVisible();
    expect(screen.getByText("58 of 62")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Global modules" }),
    ).toHaveAttribute("href", "/ops/modules");
    expect(document.documentElement.dataset.theme).toBeTruthy();
  });
  it("keeps owner nav and requests hidden from support, including direct owner route", async () => {
    session("PLATFORM_SUPPORT");
    const overview = vi.spyOn(opsApi, "getOwnerOverview");
    const modules = vi.spyOn(opsApi, "listGlobalModules");
    page("/ops/modules");
    expect(
      await screen.findByRole("heading", { name: "Household lookup" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Overview" }),
    ).not.toBeInTheDocument();
    expect(overview).not.toHaveBeenCalled();
    expect(modules).not.toHaveBeenCalled();
  });
  it("browses, retries true directory failure, searches member email, paginates and clears", async () => {
    session();
    const list = vi
      .spyOn(opsApi, "listOwnerHouseholds")
      .mockRejectedValueOnce(new Error("Directory offline"))
      .mockResolvedValue({
        items: [
          {
            id: 42,
            name: "Smith household",
            owner_email: "ow…@example.com",
            billing_status: "active",
            timezone: "UTC",
            account_count: 4,
            active_account_count: 3,
          },
        ],
        total: 27,
        offset: 0,
        limit: 25,
      });
    page("/ops/households");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Directory offline",
    );
    expect(screen.queryByText("No households found.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry households" }));
    await screen.findByRole("link", { name: /Smith household/ });
    fireEvent.change(
      screen.getByLabelText("Household name, ID, or member email"),
      { target: { value: " parent@example.com " } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        query: "parent@example.com",
        offset: 0,
        limit: 25,
      }),
    );
    await screen.findByRole("link", { name: /Smith household/ });
    fireEvent.click(screen.getByRole("button", { name: "Next households" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        query: "parent@example.com",
        offset: 25,
        limit: 25,
      }),
    );
    await screen.findByRole("link", { name: /Smith household/ });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        query: "",
        offset: 0,
        limit: 25,
      }),
    );
  });
  it("keeps unreleased modules visible but unavailable and refreshes only GET after acknowledged save/readback failure", async () => {
    session();
    const read = vi
      .spyOn(opsApi, "listGlobalModules")
      .mockResolvedValueOnce([chores, tree])
      .mockRejectedValueOnce(new Error("Readback offline"))
      .mockResolvedValue([{ ...chores, enabled: false }, tree]);
    const auth = vi.spyOn(opsApi, "reauthenticate").mockResolvedValue();
    const write = vi
      .spyOn(opsApi, "setGlobalModule")
      .mockResolvedValue({ ...chores, enabled: false });
    page("/ops/modules");
    expect(
      await screen.findByRole("button", { name: "Enable Family Tree" }),
    ).toBeDisabled();
    expect(screen.getByText("Not released on any platform")).toBeVisible();
    await confirm();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Saved. Readback failed",
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Global modules" })).toHaveFocus(),
    );
    expect(
      screen.queryByLabelText("Current operator password"),
    ).not.toBeInTheDocument();
    expect(auth).toHaveBeenCalledWith({
      password: "secret",
      totp_code: "123456",
    });
    expect(write).toHaveBeenCalledWith("chores", {
      enabled: false,
      expected_enabled: true,
      reason: "Planned maintenance",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Retry module readback" }),
    );
    expect(
      await screen.findByRole("button", { name: "Enable Chores" }),
    ).toBeVisible();
    expect(read).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenCalledTimes(1);
    expect(auth).toHaveBeenCalledTimes(1);
  });
  it("restores the exact invoker after cancel when the browser blurs disabled buttons", async () => {
    session();
    vi.spyOn(opsApi, "listGlobalModules").mockResolvedValue([chores]);
    // Chromium blurs the trigger as the pending-intent render disables it.
    // JSDOM needs this DOM-semantics adapter; the live browser regression also
    // exercises the actual behavior without this adapter.
    const setAttribute = Element.prototype.setAttribute;
    const disabled = vi
      .spyOn(Element.prototype, "setAttribute")
      .mockImplementation(function (this: Element, name: string, value: string) {
        if (
          name === "disabled" &&
          this instanceof HTMLButtonElement &&
          document.activeElement === this
        ) this.blur();
        setAttribute.call(this, name, value);
      });
    try {
      page("/ops/modules");
      const trigger = await screen.findByRole("button", {
        name: "Disable Chores",
      });
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("dialog", {
        name: "Confirm module change",
      });
      expect(within(dialog).getByLabelText("Change reason")).toHaveFocus();
      fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(trigger).toBeEnabled();
    } finally {
      disabled.mockRestore();
    }
  });
  it("blocks stale intent until reload and requires fresh credentials on each attempt", async () => {
    session();
    vi.spyOn(opsApi, "listGlobalModules").mockResolvedValue([chores]);
    const auth = vi
      .spyOn(opsApi, "reauthenticate")
      .mockRejectedValueOnce(new Error("Reauthentication required"))
      .mockResolvedValue();
    const write = vi
      .spyOn(opsApi, "setGlobalModule")
      .mockRejectedValue(
        Object.assign(new Error("State changed"), { status: 409 }),
      );
    page("/ops/modules");
    await confirm();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Reauthentication required",
    );
    expect(write).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await confirm();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "State changed. Reload modules before trying again.",
    );
    expect(
      screen.getByRole("button", { name: "Disable Chores" }),
    ).toBeDisabled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reload modules" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Disable Chores" }),
      ).toBeEnabled(),
    );
    expect(auth).toHaveBeenCalledTimes(2);
  });
});
