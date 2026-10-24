import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";

import { apiClient, type NotificationItem, type NotificationSettings } from "../api";
import { useAuth } from "../auth/useAuth";
import { formatApiError } from "../lib/errors";
import { Button, Card, FormField, InlineNotice } from "../ui";
import "../features/notifications/notification-views.css";

const DEFAULT_SETTINGS: NotificationSettings = {
  in_app_enabled: true,
  push_enabled: false,
  daily_digest_enabled: true,
  daily_digest_time: "08:00",
  due_soon_enabled: true,
  due_soon_hours: 24,
  approval_notifications_enabled: true,
  quiet_hours_start: "21:00",
  quiet_hours_end: "07:00",
};

export function NotificationsPage(): ReactElement {
  const { user } = useAuth();
  return <NotificationWorkspace key={`${user?.household_id}:${user?.id}:${user?.role}`} />;
}

function NotificationWorkspace(): ReactElement {
  const [view, setView] = useState<"inbox" | "settings">("inbox");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS);
  const savingRef = useRef(false);
  const inboxGeneration = useRef(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [pushRegistered, setPushRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    const generation = ++inboxGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.listNotifications({ unread: unreadOnly ? 1 : 0, limit: 100 });
      if (generation !== inboxGeneration.current) return;
      setItems(response.items);
      setUnreadCount(response.unread_count);
    } catch (loadError) {
      if (generation === inboxGeneration.current) setError(`Could not load notifications: ${formatApiError(loadError)}`);
    } finally {
      if (generation === inboxGeneration.current) setLoading(false);
    }
  }, [unreadOnly]);
  const latestInboxLoad = useRef(loadInbox);
  latestInboxLoad.current = loadInbox;
  const markingRead = useRef(new Set<number>());
  useEffect(() => {
    const requests = inboxGeneration;
    void loadInbox();
    return () => { requests.current++; };
  }, [loadInbox]);

  const [settingsAttempt, setSettingsAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setSettingsLoading(true);
    setSettingsError(null);
    apiClient.getNotificationSettings().then((response) => {
      if (!active) return;
      const next = { ...DEFAULT_SETTINGS, ...(response.chores ?? {}) };
      setSettings(next);
      setSavedSettings(next);
      setSettingsReady(true);
    }).catch((loadError: unknown) => {
      if (active) setSettingsError(`Could not load reminder settings: ${formatApiError(loadError)}`);
    }).finally(() => { if (active) setSettingsLoading(false); });
    return () => { active = false; };
  }, [settingsAttempt]);

  useEffect(() => {
    let active = true;
    if (!("serviceWorker" in navigator)) return () => { active = false; };
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active) setPushRegistered(subscription !== null);
      })
      .catch(() => {
        if (active) setPushRegistered(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function markRead(item: NotificationItem): Promise<void> {
    if (markingRead.current.has(item.id)) return;
    markingRead.current.add(item.id);
    try {
      await apiClient.markNotificationRead(item.id);
      // Read back the current filter, not the filter captured before the write.
      await latestInboxLoad.current();
    } catch (readError) {
      setError(`Could not mark notification read: ${formatApiError(readError)}`);
    } finally {
      markingRead.current.delete(item.id);
    }
  }

  async function saveSettings(): Promise<void> {
    if (savingRef.current || !settingsReady) return;
    savingRef.current = true;
    setSaving(true);
    setSettingsError(null);
    setPushStatus(null);
    try {
      const response = await apiClient.updateNotificationSettings("chores", settings);
      setSettings(response.settings);
      setSavedSettings(response.settings);
      setPushStatus("Reminder settings saved.");
    } catch (saveError: unknown) {
      setSettingsError(`Could not save reminder settings: ${formatApiError(saveError)}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function enablePush(): Promise<void> {
    setSettingsError(null);
    setPushStatus(null);
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setSettingsError("This browser does not support app push notifications.");
      return;
    }
    const permission = window.Notification.permission === "granted" ? "granted" : await window.Notification.requestPermission();
    if (permission !== "granted") {
      setSettingsError("Push notification permission was not granted.");
      return;
    }
    const config = await apiClient.getPushConfig();
    if (config.vapid_public_key.length === 0) {
      setSettingsError("Push notifications are not configured on the server yet.");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key) as BufferSource,
      });
      const serialized = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const endpoint = serialized.endpoint || subscription.endpoint;
      const p256dh = serialized.keys?.p256dh || keyToBase64(subscription.getKey?.("p256dh") ?? null);
      const auth = serialized.keys?.auth || keyToBase64(subscription.getKey?.("auth") ?? null);
      if (!endpoint || !p256dh || !auth) {
        throw new Error("Browser returned an incomplete push subscription.");
      }
      await apiClient.createPushSubscription({
        endpoint,
        keys: { p256dh, auth },
        device_label: "This browser",
      });
      const response = await apiClient.updateNotificationSettings("chores", { push_enabled: true });
      setSettings((current) => ({ ...current, push_enabled: response.settings.push_enabled }));
      setSavedSettings((current) => ({ ...current, push_enabled: response.settings.push_enabled }));
      setPushRegistered(true);
      setPushStatus("App push notifications are enabled for this browser.");
    } catch (pushError: unknown) {
      setSettingsError(`Could not enable app push notifications: ${formatApiError(pushError)}`);
    }
  }

  async function disablePush(): Promise<void> {
    setSettingsError(null);
    setPushStatus(null);
    try {
      const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.ready : null;
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription) await subscription.unsubscribe();
      await apiClient.disablePushSubscriptions();
      const response = await apiClient.updateNotificationSettings("chores", { push_enabled: false });
      setSettings((current) => ({ ...current, push_enabled: response.settings.push_enabled }));
      setSavedSettings((current) => ({ ...current, push_enabled: response.settings.push_enabled }));
      setPushRegistered(false);
      setPushStatus("App push notifications are disabled for this account.");
    } catch (pushError: unknown) {
      setSettingsError(`Could not disable app push notifications: ${formatApiError(pushError)}`);
    }
  }

  return (
    <Card as="section" className="notification-page">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Family Manager</p>
          <h1>Notifications</h1>
          <p>Chore reminders, approval alerts, and configurable app push notifications.</p>
        </div>
        <span className="badge">{unreadCount} unread</span>
      </div>

      <nav className="quick-actions" aria-label="Notification views">
        <Button aria-pressed={view === "inbox"} onClick={() => setView("inbox")}>Inbox</Button>
        <Button aria-pressed={view === "settings"} onClick={() => setView("settings")}>Settings</Button>
      </nav>
      <div>
        {view === "inbox" ? <section>
          {error !== null ? <InlineNotice variant="error">{error} <Button onClick={() => void loadInbox()}>Retry inbox</Button></InlineNotice> : null}
          <div className="quick-actions" aria-label="Inbox filter">
            <Button aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All</Button>
            <Button aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Unread</Button>
            <Button disabled={loading} onClick={() => void loadInbox()}>Refresh inbox</Button>
          </div>
          {loading ? <p role="status">Loading notifications...</p> : null}
          <h2>Inbox</h2>
          {!loading && !error && items.length === 0 ? <p>{unreadOnly ? "No unread notifications." : "No notifications yet."}</p> : null}
          <div className="notification-list">
            {items.map((item) => (
              <article key={item.id} className={`notification-card${item.read_at === null ? " unread" : ""}`}>
                <div>
                  <p className="eyebrow">{item.category}</p>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  {item.link_url ? <Link to={item.link_url}>Open related page</Link> : null}
                </div>
                {item.read_at === null ? (
                  <Button type="button" onClick={() => void markRead(item)}>Mark read</Button>
                ) : (
                  <span className="badge muted">Read</span>
                )}
              </article>
            ))}
          </div>
        </section> : null}

        {view === "settings" ? <section className="settings-panel">
          {settingsError !== null ? <InlineNotice variant="error">{settingsError}</InlineNotice> : null}
          {pushStatus !== null ? <InlineNotice variant="success">{pushStatus}</InlineNotice> : null}
          {settingsLoading ? <p role="status">Loading reminder settings...</p> : null}
          {!settingsReady && !settingsLoading ? <Button onClick={() => setSettingsAttempt((value) => value + 1)}>Retry reminder settings</Button> : null}
          {JSON.stringify(settings) !== JSON.stringify(savedSettings) ? <p role="status">Unsaved reminder changes</p> : null}
          <fieldset disabled={!settingsReady || settingsLoading || saving} style={{ border: 0, padding: 0, margin: 0 }}>

          <h2>Chore reminder settings</h2>
          <label className="checkbox-row">
            <input type="checkbox" checked={settings.in_app_enabled} onChange={(event) => setSettings({ ...settings, in_app_enabled: event.target.checked })} />
            In-app notifications
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={settings.daily_digest_enabled} onChange={(event) => setSettings({ ...settings, daily_digest_enabled: event.target.checked })} />
            Daily chore digest
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={settings.due_soon_enabled} onChange={(event) => setSettings({ ...settings, due_soon_enabled: event.target.checked })} />
            Upcoming chore reminders
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={settings.approval_notifications_enabled} onChange={(event) => setSettings({ ...settings, approval_notifications_enabled: event.target.checked })} />
            Submission and approval alerts
          </label>
          <FormField label="Daily digest time">
            <input id="daily-digest-time" type="time" value={settings.daily_digest_time} onChange={(event) => setSettings({ ...settings, daily_digest_time: event.target.value })} />
          </FormField>
          <FormField label="Due soon hours">
            <input id="due-soon-hours" type="number" min={1} max={168} value={settings.due_soon_hours} onChange={(event) => setSettings({ ...settings, due_soon_hours: Number(event.target.value) })} />
          </FormField>
          <FormField label="Quiet hours start">
            <input id="quiet-hours-start" type="time" value={settings.quiet_hours_start} onChange={(event) => setSettings({ ...settings, quiet_hours_start: event.target.value })} />
          </FormField>
          <FormField label="Quiet hours end">
            <input id="quiet-hours-end" type="time" value={settings.quiet_hours_end} onChange={(event) => setSettings({ ...settings, quiet_hours_end: event.target.value })} />
          </FormField>
          <div className="button-row">
            <Button type="button" onClick={() => void saveSettings()} disabled={saving}>{saving ? "Saving..." : "Save reminder settings"}</Button>
            {pushRegistered ? (
              <Button type="button" onClick={() => void disablePush()}>Disable app push notifications</Button>
            ) : (
              <Button type="button" onClick={() => void enablePush()}>Enable app push notifications</Button>
            )}
          </div>
          </fieldset>
        </section> : null}
      </div>
    </Card>
  );
}

function keyToBase64(key: ArrayBuffer | null): string {
  if (key === null) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
