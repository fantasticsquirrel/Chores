import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Linking } from "react-native";

import { apiClient } from "../../api/client";
import type { AuthSessionResponse, FamilyModule, NotificationItem, NotificationSettings } from "../../api/models";
import { NotificationsScreen } from "./NotificationsScreen";

const session: AuthSessionResponse = { user: { id: 1, household_id: 27, email: "parent@example.com", role: "PARENT", is_household_owner: true } };
const chores: FamilyModule = { key: "chores", name: "Chores", description: "Chores", can_manage: true };
const settings: NotificationSettings = { in_app_enabled: true, push_enabled: true, daily_digest_enabled: true, daily_digest_time: "08:00", due_soon_enabled: true, due_soon_hours: 24, approval_notifications_enabled: true, quiet_hours_start: "21:00", quiet_hours_end: "07:00" };
const unread: NotificationItem = { id: 7, module_key: "chores", title: "Approval waiting", body: "Mia completed dishes", category: "submission", severity: "info", link_url: "/chore/board", read_at: null, created_at: "2026-10-04T10:00:00Z", expires_at: null };
const read: NotificationItem = { ...unread, id: 8, title: "Earlier reminder", link_url: "https://evil.example/board", read_at: "2026-10-04T11:00:00Z" };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function mount(modules = [chores], currentSession = session) { const navigate = jest.fn(); const view = render(<NotificationsScreen modules={modules} session={currentSession} onNavigate={navigate} />); return { ...view, navigate }; }

describe("NotificationsScreen", () => {
  beforeEach(() => {
    jest.spyOn(apiClient, "listNotifications").mockResolvedValue({ items: [unread, read], unread_count: 1 });
    jest.spyOn(apiClient, "getNotificationSettings").mockResolvedValue({ chores: settings });
    jest.spyOn(apiClient, "markNotificationRead").mockResolvedValue();
    jest.spyOn(apiClient, "markAllNotificationsRead").mockResolvedValue({ updated: 1 });
    jest.spyOn(apiClient, "updateNotificationSettings").mockResolvedValue({ module_key: "chores", settings });
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });
  afterEach(() => { jest.restoreAllMocks(); });
  it("loads all inbox items, authoritative unread count and settings without writes", async () => {
    mount(); expect(screen.getByText("Loading notifications...")).toBeTruthy();
    expect(await screen.findByText("Approval waiting")).toBeTruthy();
    expect(screen.getAllByText("Mia completed dishes")).toHaveLength(2);
    expect(screen.getByText("Earlier reminder")).toBeTruthy(); expect(screen.getByText("1 unread")).toBeTruthy();
    expect(apiClient.listNotifications).toHaveBeenCalledWith({ unread: 0, limit: 200 });
    expect(screen.getByLabelText("Daily digest time").props.value).toBe("08:00");
    expect(screen.getByLabelText("Due soon hours").props.value).toBe("24");
    expect(apiClient.markNotificationRead).not.toHaveBeenCalled(); expect(apiClient.markAllNotificationsRead).not.toHaveBeenCalled(); expect(apiClient.updateNotificationSettings).not.toHaveBeenCalled();
  });
  it("loads Unread through the API and returns to All", async () => {
    mount(); await screen.findByText("Approval waiting");
    jest.mocked(apiClient.listNotifications).mockResolvedValueOnce({ items: [unread], unread_count: 1 });
    await act(async()=>{fireEvent.press(screen.getByRole("button", { name: "Unread" }));});
    expect(apiClient.listNotifications).toHaveBeenLastCalledWith({ unread: 1, limit: 200 });
    await waitFor(() => expect(screen.queryByText("Earlier reminder")).toBeNull());
    expect(apiClient.listNotifications).toHaveBeenLastCalledWith({ unread: 1, limit: 200 });
    fireEvent.press(screen.getByRole("button", { name: "All" }));
    await screen.findByText("Earlier reminder"); expect(apiClient.listNotifications).toHaveBeenLastCalledWith({ unread: 0, limit: 200 });
  });
  it("marks an item read then reads back the inbox", async () => {
    mount(); await screen.findByText("Approval waiting");
    jest.mocked(apiClient.listNotifications).mockResolvedValue({ items: [{ ...unread, read_at: "2026-10-04T12:00:00Z" }, read], unread_count: 0 });
    fireEvent.press(screen.getByRole("button", { name: "Mark read: Approval waiting" }));
    await screen.findByText("0 unread"); expect(apiClient.markNotificationRead).toHaveBeenCalledWith(7); expect(apiClient.listNotifications).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Mark read: Approval waiting" })).toBeNull();
  });
  it("marks all read and uses authoritative readback rather than optimistic counters", async () => {
    mount(); await screen.findByText("Approval waiting");
    jest.mocked(apiClient.listNotifications).mockResolvedValue({ items: [], unread_count: 0 });
    fireEvent.press(screen.getByRole("button", { name: "Mark all read" }));
    await screen.findByText("0 unread"); expect(apiClient.markAllNotificationsRead).toHaveBeenCalledTimes(1); expect(apiClient.listNotifications).toHaveBeenCalledTimes(2);
  });
  it("surfaces read failure without clearing unread state and allows another attempt", async () => {
    jest.mocked(apiClient.markNotificationRead).mockRejectedValueOnce(new Error("read unavailable"));
    mount(); await screen.findByText("Approval waiting");
    fireEvent.press(screen.getByRole("button", { name: "Mark read: Approval waiting" }));
    await screen.findByText(/read unavailable/); expect(screen.getByText("1 unread")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Mark read: Approval waiting" }));
    await waitFor(() => expect(apiClient.markNotificationRead).toHaveBeenCalledTimes(2));
  });
  it("surfaces load errors, retries, refreshes and shows an empty inbox", async () => {
    jest.mocked(apiClient.listNotifications).mockRejectedValueOnce(new Error("inbox unavailable")); mount();
    await screen.findByText(/inbox unavailable/); expect(screen.queryByRole("button", { name: "Save reminder settings" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Retry" })); await screen.findByText("Approval waiting");
    jest.mocked(apiClient.listNotifications).mockResolvedValue({ items: [], unread_count: 0 });
    fireEvent.press(screen.getByRole("button", { name: "Refresh" })); await screen.findByText("No notifications yet.");
  });
  it("saves every reminder field while preserving the server's browser push value and reads settings back", async () => {
    mount(); await screen.findByText("Approval waiting");
    const changed = { ...settings, in_app_enabled: false, daily_digest_enabled: false, daily_digest_time: "09:45", due_soon_enabled: false, due_soon_hours: 48, approval_notifications_enabled: false, quiet_hours_start: "22:15", quiet_hours_end: "06:30" };
    for (const label of ["In-app notifications", "Daily chore digest", "Upcoming chore reminders", "Submission and approval alerts"]) fireEvent(screen.getByLabelText(label), "valueChange", false);
    for (const [label, value] of [["Daily digest time", "09:45"], ["Due soon hours", "48"], ["Quiet hours start", "22:15"], ["Quiet hours end", "06:30"]]) fireEvent.changeText(screen.getByLabelText(label), value);
    jest.mocked(apiClient.getNotificationSettings).mockResolvedValue({ chores: changed });
    fireEvent.press(screen.getByRole("button", { name: "Save reminder settings" }));
    await screen.findByText("Reminder settings saved.");
    expect(apiClient.updateNotificationSettings).toHaveBeenCalledWith("chores", changed); expect(apiClient.getNotificationSettings).toHaveBeenCalledTimes(2);
  });
  it.each([["Due soon hours", "0"], ["Due soon hours", "169"], ["Due soon hours", "1.5"], ["Due soon hours", ""], ["Daily digest time", "24:00"], ["Quiet hours start", "9:00"], ["Quiet hours end", "07:60"]])("rejects invalid %s = %s before writing", async (label, value) => {
    mount(); await screen.findByText("Approval waiting"); fireEvent.changeText(screen.getByLabelText(label), value);
    fireEvent.press(screen.getByRole("button", { name: "Save reminder settings" }));
    expect(screen.getByText(/Use HH:MM times and whole due soon hours from 1 to 168/)).toBeTruthy(); expect(apiClient.updateNotificationSettings).not.toHaveBeenCalled();
  });
  it("keeps edits after a save failure", async () => {
    jest.mocked(apiClient.updateNotificationSettings).mockRejectedValueOnce(new Error("save unavailable"));
    mount(); await screen.findByText("Approval waiting"); fireEvent.changeText(screen.getByLabelText("Daily digest time"), "09:45");
    fireEvent.press(screen.getByRole("button", { name: "Save reminder settings" })); await screen.findByText(/save unavailable/);
    expect(screen.getByLabelText("Daily digest time").props.value).toBe("09:45");
  });
  it("routes only safe related pages without opening external item links", async () => {
    const { navigate } = mount(); await screen.findByText("Approval waiting");
    expect(screen.getAllByRole("button", { name: "Open related page" })).toHaveLength(1);
    fireEvent.press(screen.getByRole("button", { name: "Open related page" })); expect(navigate).toHaveBeenCalledWith("review"); expect(Linking.openURL).not.toHaveBeenCalled();
  });
  it("labels push as browser settings, opens the exact URL and never registers native push", async () => {
    const register = jest.spyOn(apiClient, "createPushSubscription"); const config = jest.spyOn(apiClient, "getPushConfig");
    mount(); await screen.findByText("Approval waiting"); expect(screen.getByText(/Native push notifications are not available/)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Manage browser push" })); await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith("https://family.multihost.ing/chore/notifications"));
    expect(register).not.toHaveBeenCalled(); expect(config).not.toHaveBeenCalled(); expect(apiClient.updateNotificationSettings).not.toHaveBeenCalled();
  });
  it("reports browser opening failure", async () => {
    jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error("browser unavailable")); mount(); await screen.findByText("Approval waiting");
    fireEvent.press(screen.getByRole("button", { name: "Manage browser push" })); await screen.findByText(/browser unavailable/);
  });
  it("keeps personal preferences available without granting related module destinations", async () => {
    mount([]); await screen.findByText("Approval waiting"); expect(apiClient.getNotificationSettings).toHaveBeenCalled();
    expect(screen.queryByRole("button", {name:"Open related page"})).toBeNull();
    for(const label of ["Save reminder settings","Mark all read","Mark read: Approval waiting"]) expect(screen.getByRole("button",{name:label})).toBeTruthy();
  });
  it("lets a view-only child manage their own inbox and personal reminder preferences",async()=>{
    mount([{...chores,can_manage:false}],{...session,user:{...session.user,role:"CHILD",child_id:3}});await screen.findByText("Approval waiting");
    expect(screen.getByLabelText("Daily digest time").props.editable).toBe(true);
    fireEvent.press(screen.getByRole("button",{name:"Mark read: Approval waiting"}));
    await waitFor(()=>expect(apiClient.markNotificationRead).toHaveBeenCalledWith(7));
    expect(screen.queryByRole("button",{name:"Open related page"})).toBeNull();
    expect(apiClient.updateNotificationSettings).not.toHaveBeenCalled();
  });
  it("drops stale load results after a session change", async () => {
    const old = deferred<Awaited<ReturnType<typeof apiClient.listNotifications>>>(); jest.mocked(apiClient.listNotifications).mockReturnValueOnce(old.promise);
    const navigate = jest.fn(); const view = render(<NotificationsScreen modules={[chores]} session={session} onNavigate={navigate} />);
    view.rerender(<NotificationsScreen modules={[chores]} session={{ ...session, user: { ...session.user, id: 9 } }} onNavigate={navigate} />);
    await screen.findByText("Approval waiting"); await act(async () => old.resolve({ items: [{ ...unread, title: "Old private inbox" }], unread_count: 7 }));
    expect(screen.queryByText("Old private inbox")).toBeNull(); expect(screen.queryByText("7 unread")).toBeNull();
  });
  it("does not read back or navigate when an action resolves after unmount", async () => {
    const pending = deferred<void>(); jest.mocked(apiClient.markNotificationRead).mockReturnValueOnce(pending.promise);
    const view = mount(); await screen.findByText("Approval waiting"); fireEvent.press(screen.getByRole("button", { name: "Mark read: Approval waiting" }));
    view.unmount(); await act(async () => pending.resolve()); expect(apiClient.listNotifications).toHaveBeenCalledTimes(1); expect(view.navigate).not.toHaveBeenCalled();
  });
});
