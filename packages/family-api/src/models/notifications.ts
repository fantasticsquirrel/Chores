export interface NotificationItem {
  id: number;
  module_key: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  link_url: string;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unread_count: number;
}

export interface NotificationSettings {
  in_app_enabled: boolean;
  push_enabled: boolean;
  daily_digest_enabled: boolean;
  daily_digest_time: string;
  due_soon_enabled: boolean;
  due_soon_hours: number;
  approval_notifications_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export type NotificationSettingsByModule = Record<string, NotificationSettings>;

export type NotificationSettingUpdate = Partial<NotificationSettings>;

export interface NotificationSettingResponse {
  module_key: string;
  settings: NotificationSettings;
}

export interface PushConfigResponse {
  vapid_public_key: string;
}

export interface PushSubscriptionCreate {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  device_label?: string;
}

export interface PushSubscriptionResponse {
  id: number;
  endpoint: string;
  device_label: string;
  enabled: boolean;
  created_at: string;
  last_seen_at: string;
}
