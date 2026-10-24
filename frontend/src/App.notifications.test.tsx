import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { apiClient } from "./api";

const notificationList = {
  unread_count: 1,
  items: [
    {
      id: 7,
      module_key: "chores",
      category: "approval",
      severity: "info",
      title: "Chore ready for review",
      body: "Riley submitted 1 chore for approval.",
      link_url: "/board",
      read_at: null,
      created_at: "2026-06-18T12:00:00Z",
      expires_at: null,
    },
  ],
};

const notificationSettings = {
  chores: {
    in_app_enabled: true,
    push_enabled: false,
    daily_digest_enabled: true,
    daily_digest_time: "08:00",
    due_soon_enabled: true,
    due_soon_hours: 24,
    approval_notifications_enabled: true,
    quiet_hours_start: "21:00",
    quiet_hours_end: "07:00",
  },
};

describe("Notifications page", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "listNotifications").mockResolvedValue(
      notificationList,
    );
    vi.spyOn(apiClient, "getNotificationSettings").mockResolvedValue(
      notificationSettings,
    );
    vi.spyOn(apiClient, "getPushConfig").mockResolvedValue({
      vapid_public_key: "test-public-key",
    });
    vi.spyOn(apiClient, "updateNotificationSettings").mockResolvedValue({
      module_key: "chores",
      settings: { ...notificationSettings.chores, push_enabled: true },
    });
    vi.spyOn(apiClient, "markNotificationRead").mockResolvedValue(undefined);
    vi.spyOn(apiClient, "disablePushSubscriptions").mockResolvedValue(
      undefined,
    );
    vi.spyOn(apiClient, "createPushSubscription").mockResolvedValue({
      id: 1,
      endpoint: "https://push.example.test/sub/1",
      device_label: "This browser",
      enabled: true,
      created_at: "2026-06-18T12:00:00Z",
      last_seen_at: "2026-06-18T12:00:00Z",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows notifications in the app shell and lets the user mark one read", async () => {
    render(
      <MemoryRouter initialEntries={["/notifications"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Notifications" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("link", { name: "Notifications (1)" }),
    ).toBeVisible();
    expect(screen.getByText("Chore ready for review")).toBeVisible();
    expect(
      screen.getByText("Riley submitted 1 chore for approval."),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    await waitFor(() =>
      expect(apiClient.markNotificationRead).toHaveBeenCalledWith(7),
    );
  });

  it("saves chore reminder settings and registers browser push when supported", async () => {
    const subscribe = vi.fn().mockResolvedValue({
      endpoint: "https://fcm.googleapis.com/fcm/send/sub-1",
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/sub-1",
        keys: { p256dh: "p256", auth: "auth" },
      }),
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("granted"),
      },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { subscribe } }) },
    });

    render(
      <MemoryRouter initialEntries={["/notifications"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    expect(await screen.findByLabelText("Daily digest time")).toHaveValue(
      "08:00",
    );
    fireEvent.change(screen.getByLabelText("Daily digest time"), {
      target: { value: "07:30" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save reminder settings" }),
    );

    await waitFor(() =>
      expect(apiClient.updateNotificationSettings).toHaveBeenCalledWith(
        "chores",
        expect.objectContaining({ daily_digest_time: "07:30" }),
      ),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Enable app push notifications" }),
    );
    await waitFor(() =>
      expect(apiClient.createPushSubscription).toHaveBeenCalled(),
    );
    expect(subscribe).toHaveBeenCalledWith({
      applicationServerKey: expect.any(Uint8Array),
      userVisibleOnly: true,
    });
  });

  it("detects and disables an existing browser push subscription", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const getSubscription = vi.fn().mockResolvedValue({ unsubscribe });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription } }) },
    });
    vi.mocked(apiClient.updateNotificationSettings).mockResolvedValueOnce({
      module_key: "chores",
      settings: { ...notificationSettings.chores, push_enabled: false },
    });

    render(
      <MemoryRouter initialEntries={["/notifications"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    const disable = await screen.findByRole("button", {
      name: "Disable app push notifications",
    });
    fireEvent.click(disable);
    await waitFor(() =>
      expect(apiClient.disablePushSubscriptions).toHaveBeenCalled(),
    );
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(apiClient.updateNotificationSettings).toHaveBeenCalledWith(
      "chores",
      { push_enabled: false },
    );
    expect(
      await screen.findByText(
        "App push notifications are disabled for this account.",
      ),
    ).toBeVisible();
  });
  it("keeps a settings draft across Inbox filters and a failed save", async () => {
    vi.mocked(apiClient.updateNotificationSettings).mockRejectedValueOnce(new Error("Try again"));
    render(<MemoryRouter initialEntries={["/notifications"]}><App /></MemoryRouter>);
    await screen.findByText("Chore ready for review");
    expect(screen.queryByRole("button", { name: "Save reminder settings" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(await screen.findByLabelText("Daily digest time"), { target: { value: "09:15" } });
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    fireEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(screen.getByRole("button", { name: "Unread" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByLabelText("Daily digest time")).toHaveValue("09:15");
    expect(apiClient.getNotificationSettings).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Save reminder settings" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
    expect(screen.getByLabelText("Daily digest time")).toHaveValue("09:15");
  });

  it("locks repeated mark-read actions and refreshes the filter selected during a delayed write", async () => {
    let complete!: () => void;
    vi.mocked(apiClient.markNotificationRead).mockReturnValueOnce(new Promise<void>((resolve) => { complete = resolve; }));
    render(<MemoryRouter initialEntries={["/notifications"]}><App /></MemoryRouter>);
    const mark = await screen.findByRole("button", { name: "Mark read" });
    fireEvent.click(mark); fireEvent.click(mark);
    expect(apiClient.markNotificationRead).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Unread" }));
    await waitFor(() => expect(apiClient.listNotifications).toHaveBeenLastCalledWith({ unread: 1, limit: 100 }));
    vi.mocked(apiClient.listNotifications).mockResolvedValue({ items: [], unread_count: 0 });
    await act(async () => complete());
    expect(await screen.findByText("No unread notifications.")).toBeVisible();
    expect(apiClient.listNotifications).toHaveBeenLastCalledWith({ unread: 1, limit: 100 });
  });

});
