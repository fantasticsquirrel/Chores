import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Switch, Text, TextInput, View } from "react-native";

import { apiClient } from "../../api/client";
import type { AuthSessionResponse, FamilyModule, NotificationItem, NotificationListResponse, NotificationSettings } from "../../api/models";
import { ActionButton } from "../../components/ActionButton";
import { InlineNotice } from "../../components/InlineNotice";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SectionCard } from "../../components/SectionCard";
import type { AppTab } from "../../navigation/types";
import { cardStyles } from "../../styles/cards";
import { formStyles } from "../../styles/forms";
import { shellStyles } from "../../styles/shell";
import { formatError, isParentRole } from "../../utils/format";

type ReminderDraft = Omit<NotificationSettings, "due_soon_hours"> & { due_soon_hours: string };
type ReminderState = { key: string; server: NotificationSettings; draft: ReminderDraft };

function reminderState(key: string, server: NotificationSettings): ReminderState {
  return { key, server, draft: { ...server, due_soon_hours: String(server.due_soon_hours) } };
}

// Notification URLs are untrusted. Only known, granted native destinations are used.
function relatedTab(item: NotificationItem, modules: FamilyModule[], parent: boolean): AppTab | null {
  if (!modules.some((module) => module.key === item.module_key)) return null;
  const path = item.link_url.split(/[?#]/)[0];
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (item.module_key === "chores") {
    if (!parent) return path === "/chore/child/today" ? "today" : null;
    const destinations: Record<string, AppTab> = {
      "/chore/board": "review",
      "/chore/parent/dashboard": "home",
      "/chore/parent/chores": "chores",
      "/chore/parent/children": "children",
      "/chore/parent/reports": "money",
    };
    return destinations[path] ?? null;
  }
  if (parent && item.module_key === "homeschool" && path === "/homeschool") return "homeschool";
  if (parent && item.module_key === "recipes" && path === "/recipes") return "recipes";
  return null;
}

export function NotificationsScreen({ modules, session, onNavigate }: {
  modules: FamilyModule[];
  session: AuthSessionResponse;
  onNavigate: (tab: AppTab) => void;
}) {
  const grantKey = JSON.stringify(modules.map((module) => [module.key, module.can_manage !== false]).sort());
  const key = `${session.user.id}:${session.user.household_id}:${session.user.role}:${grantKey}`;
  const liveKey = useRef(key);
  liveKey.current = key;
  const mounted = useRef(false);
  const generation = useRef(0);
  const actionGeneration = useRef(0);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const unreadOnly = useRef(false);
  const [loading, setLoading] = useState(true);
  const [inbox, setInbox] = useState<{ key: string; data: NotificationListResponse } | null>(null);
  const [reminders, setReminders] = useState<ReminderState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const parent = isParentRole(session.user.role);
  const allowedRole = parent || session.user.role === "CHILD";
  // These are user-owned inbox/preferences, not module administration.
  // The backend scopes writes to the authenticated user, including children.
  const settingsEnabled = allowedRole;
  const canManage = allowedRole;
  const data = inbox?.key === key ? inbox.data : null;
  const reminder = reminders?.key === key && settingsEnabled ? reminders : null;

  const load = useCallback(async (withSettings = true) => {
    const request = ++generation.current;
    const current = () => mounted.current && liveKey.current === key && generation.current === request;
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    setNotice(null);
    try {
      const [response, settings] = await Promise.all([
        apiClient.listNotifications({ unread: unreadOnly.current ? 1 : 0, limit: 200 }),
        withSettings && settingsEnabled ? apiClient.getNotificationSettings() : Promise.resolve(null),
      ]);
      if (!current()) return;
      setInbox({ key, data: response });
      if (withSettings) setReminders(settings?.chores ? reminderState(key, settings.chores) : null);
    } catch (error) {
      if (current()) setLoadError(formatError(error));
    } finally {
      if (current()) setLoading(false);
    }
  }, [key, settingsEnabled]);

  useEffect(() => {
    mounted.current = true;
    busyRef.current = false;
    setBusy(false);
    void load();
    return () => {
      mounted.current = false;
      generation.current += 1;
      actionGeneration.current += 1;
      busyRef.current = false;
    };
  }, [load]);

  async function runAction(operation: (current: () => boolean) => Promise<void>) {
    if (!mounted.current || liveKey.current !== key || !canManage || !data || loading || busyRef.current) return;
    const request = ++actionGeneration.current;
    const current = () => mounted.current && liveKey.current === key && actionGeneration.current === request;
    busyRef.current = true;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await operation(current);
    } catch (error) {
      if (current()) setActionError(formatError(error));
    } finally {
      if (current()) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  function markRead(item?: NotificationItem) {
    void runAction(async (current) => {
      if (item) await apiClient.markNotificationRead(item.id);
      else await apiClient.markAllNotificationsRead();
      if (current()) await load(false);
    });
  }

  function saveReminders() {
    if (!reminder) return;
    const draft = reminder.draft;
    const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    const hours = Number(draft.due_soon_hours);
    if (!validTime(draft.daily_digest_time) ||
        (draft.quiet_hours_start !== "" && !validTime(draft.quiet_hours_start)) ||
        (draft.quiet_hours_end !== "" && !validTime(draft.quiet_hours_end)) ||
        !/^\d+$/.test(draft.due_soon_hours) || hours < 1 || hours > 168) {
      setNotice(null);
      setActionError("Use HH:MM times and whole due soon hours from 1 to 168.");
      return;
    }
    void runAction(async (current) => {
      await apiClient.updateNotificationSettings("chores", {
        ...draft,
        // Browser push is not an editable native preference.
        push_enabled: reminder.server.push_enabled,
        due_soon_hours: hours,
      });
      if (!current()) return;
      const settings = await apiClient.getNotificationSettings();
      if (!current()) return;
      if (!settings.chores) throw new Error("Reminder settings are unavailable.");
      setReminders(reminderState(key, settings.chores));
      setNotice("Reminder settings saved.");
    });
  }

  function edit<K extends keyof ReminderDraft>(field: K, value: ReminderDraft[K]) {
    if (!canManage || busyRef.current || loading) return;
    setNotice(null);
    setReminders((previous) => previous?.key === key ? { ...previous, draft: { ...previous.draft, [field]: value } } : previous);
  }

  const editable = canManage && !busy && !loading;
  function toggle(label: string, field: "in_app_enabled" | "daily_digest_enabled" | "due_soon_enabled" | "approval_notifications_enabled") {
    return <View style={formStyles.selectableRow}>
      <Text style={formStyles.rowTitle}>{label}</Text>
      <Switch accessibilityLabel={label} disabled={!editable} value={reminder?.draft[field] ?? false} onValueChange={(value) => edit(field, value)} />
    </View>;
  }
  function input(label: string, field: "daily_digest_time" | "due_soon_hours" | "quiet_hours_start" | "quiet_hours_end") {
    return <View>
      <Text style={formStyles.fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} editable={editable} value={reminder?.draft[field] ?? ""} onChangeText={(value) => edit(field, value)} style={formStyles.input} keyboardType={field === "due_soon_hours" ? "number-pad" : "default"} autoCapitalize="none" />
    </View>;
  }

  return <View>
    <ScreenHeader title="Notifications" subtitle="Your household inbox" trailing={<ActionButton label="Refresh" variant="secondary" disabled={loading || busy} onPress={() => { void load(); }} />} />
    <View style={formStyles.inlineButtons}>
      <ActionButton label="All" variant="secondary" disabled={busy} onPress={() => { unreadOnly.current = false; void load(); }} />
      <ActionButton label="Unread" variant="secondary" disabled={busy} onPress={() => { unreadOnly.current = true; void load(); }} />
    </View>
    {loading ? <Text style={shellStyles.mutedText}>Loading notifications...</Text> : null}
    {loadError ? <View><InlineNotice tone="error" message={loadError} /><ActionButton label="Retry" disabled={loading || busy} onPress={() => { void load(); }} /></View> : null}
    {actionError ? <InlineNotice tone="error" message={actionError} /> : null}
    {notice ? <Text style={shellStyles.mutedText}>{notice}</Text> : null}
    {data ? <SectionCard title="Inbox" subtitle={`${data.unread_count} unread`}>
      {canManage ? <ActionButton label="Mark all read" disabled={loading || busy || data.unread_count === 0} variant="secondary" onPress={() => markRead()} /> : null}
      {data.items.length === 0 ? <Text style={shellStyles.mutedText}>No notifications yet.</Text> : data.items.map((item) => {
        const tab = relatedTab(item, modules, parent);
        const itemWritable = canManage;
        return <View key={item.id} style={cardStyles.reviewItem}>
          <Text style={formStyles.rowTitle}>{item.title}</Text>
          <Text style={shellStyles.mutedText}>{item.body}</Text>
          <Text style={formStyles.rowMeta}>{item.read_at ? "Read" : "Unread"}</Text>
          <View style={formStyles.inlineButtons}>
            {itemWritable && !item.read_at ? <ActionButton label={`Mark read: ${item.title}`} variant="secondary" disabled={loading || busy} onPress={() => markRead(item)} /> : null}
            {allowedRole && tab ? <ActionButton label="Open related page" variant="secondary" onPress={() => { if (liveKey.current === key && relatedTab(item, modules, parent) === tab) onNavigate(tab); }} /> : null}
          </View>
        </View>;
      })}
    </SectionCard> : null}
    {data && reminder && !loadError ? <SectionCard title="Chore reminders" subtitle={canManage ? "Reminder preferences" : "View-only reminder preferences"}>
      {toggle("In-app notifications", "in_app_enabled")}
      {toggle("Daily chore digest", "daily_digest_enabled")}
      {input("Daily digest time", "daily_digest_time")}
      {toggle("Upcoming chore reminders", "due_soon_enabled")}
      {input("Due soon hours", "due_soon_hours")}
      {toggle("Submission and approval alerts", "approval_notifications_enabled")}
      {input("Quiet hours start", "quiet_hours_start")}
      {input("Quiet hours end", "quiet_hours_end")}
      {canManage ? <View style={formStyles.inlineButtons}><ActionButton label="Save reminder settings" disabled={!editable} onPress={saveReminders} /></View> : null}
    </SectionCard> : null}
    <SectionCard title="Browser push">
      <Text style={shellStyles.mutedText}>Native push notifications are not available. Browser push is managed on the website; you may need to sign in there separately.</Text>
      {canManage && data && !loadError ? <ActionButton label="Manage browser push" variant="secondary" disabled={loading || busy} onPress={() => {
        void runAction(async () => { await Linking.openURL("https://family.multihost.ing/chore/notifications"); });
      }} /> : null}
    </SectionCard>
  </View>;
}
