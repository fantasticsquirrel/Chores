import type {
  NativePushConfigResponse,
  NativePushSubscriptionCreate,
  NativePushSubscriptionListResponse,
  NativePushSubscriptionResponse,
  NotificationListResponse,
  NotificationSettingResponse,
  NotificationSettingsByModule,
  NotificationSettingUpdate,
  PushConfigResponse,
  PushSubscriptionCreate,
  PushSubscriptionResponse,
} from "../models/notifications";
import { FamilySupportApiEndpoints } from "./support";

export abstract class FamilyNotificationApiEndpoints extends FamilySupportApiEndpoints {
  async getNativePushConfig(): Promise<NativePushConfigResponse> {
    return this.get<NativePushConfigResponse>("/push/native/config");
  }

  async listNativePushSubscriptions(): Promise<NativePushSubscriptionListResponse> {
    return this.get<NativePushSubscriptionListResponse>("/push/native/subscriptions");
  }

  async createNativePushSubscription(payload: NativePushSubscriptionCreate): Promise<NativePushSubscriptionResponse> {
    return this.post<NativePushSubscriptionResponse, NativePushSubscriptionCreate>("/push/native/subscriptions", payload);
  }

  async deleteNativePushSubscription(id: number): Promise<void> {
    await this.delete(`/push/native/subscriptions/${id}`);
  }

  async listNotifications(
    params: { unread?: number; limit?: number } = {},
  ): Promise<NotificationListResponse> {
    return this.get<NotificationListResponse>("/notifications", params);
  }

  async markNotificationRead(notificationId: number): Promise<void> {
    await this.postNoContent(`/notifications/${notificationId}/read`);
  }

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    return this.post<{ updated: number }, Record<string, never>>(
      "/notifications/read-all",
      {},
    );
  }

  async getNotificationSettings(): Promise<NotificationSettingsByModule> {
    return this.get<NotificationSettingsByModule>("/notification-settings");
  }

  async updateNotificationSettings(
    moduleKey: string,
    payload: NotificationSettingUpdate,
  ): Promise<NotificationSettingResponse> {
    return this.put<NotificationSettingResponse, NotificationSettingUpdate>(
      `/notification-settings/${moduleKey}`,
      payload,
    );
  }

  async getPushConfig(): Promise<PushConfigResponse> {
    return this.get<PushConfigResponse>("/push/config");
  }

  async createPushSubscription(
    payload: PushSubscriptionCreate,
  ): Promise<PushSubscriptionResponse> {
    return this.post<PushSubscriptionResponse, PushSubscriptionCreate>(
      "/push/subscriptions",
      payload,
    );
  }

  async disablePushSubscriptions(): Promise<void> {
    await this.delete("/push/subscriptions");
  }
}
