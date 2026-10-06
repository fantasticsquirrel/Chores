import type { ApiClient } from "../../../api/client";
import type { AuthSessionResponse, FamilyModule, NativePushPlatform, NativePushSubscriptionResponse, ExpoPushToken } from "../../../api/models";
import type { AppTab } from "../../../navigation/types";
import { relatedTab } from "./relatedTab";

export interface NativePushRuntime {
  platform: NativePushPlatform;
  projectId: string | null;
  isDevice: boolean;
  channel(): Promise<void>;
  permission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  token(): Promise<string>;
  listen(response: (data: unknown) => void, rotate: () => void, received: () => void): () => void;
  lastResponse(): Promise<unknown>;
}
export type NativePushState = {
  status: "loading" | "off" | "enabled" | "unavailable" | "error" | "signed-out";
  busy: boolean;
  hasRegistration: boolean;
  message: string;
};
type Options = {
  api: ApiClient;
  session: AuthSessionResponse;
  modules: () => FamilyModule[];
  loadRuntime: () => Promise<NativePushRuntime | null>;
  onState: (state: NativePushState) => void;
  onNavigate: (tab: AppTab) => void;
};
const genericMessage = "You have a household notification.";

// Owns one authenticated shell lifetime, not one inbox-screen mount.
export class NativePushController {
  state: NativePushState = { status: "loading", busy: false, hasRegistration: false, message: "Checking device notifications..." };
  private readonly generation: number;
  private alive = true;
  private started = false;
  private locked = false;
  private optedIn = false;
  private runtime: NativePushRuntime | null = null;
  private enabled = false;
  private removeListeners?: () => void;
  private removeAuth?: () => void;
  private responseSequence = 0;

  constructor(private options: Options) {
    this.generation = options.api.authenticationGeneration;
    this.removeAuth = options.api.subscribeAuthentication(() => {
      if (!this.current()) this.dispose(true);
    });
  }
  private current = () => this.alive && this.generation === this.options.api.authenticationGeneration;
  private publish(status: NativePushState["status"], message: string) {
    if (!this.current()) return;
    this.state = { status, message, busy: this.locked, hasRegistration: this.optedIn };
    this.options.onState(this.state);
  }
  private async authenticated<T>(operation: () => Promise<T>): Promise<T> {
    const result = await this.options.api.withAuthentication(this.generation, operation, this.current);
    if (!this.current()) throw new Error("Cancelled");
    return result;
  }
  private async inventory() {
    const result = await this.authenticated(() => this.options.api.listNativePushSubscriptions());
    if (!Array.isArray(result.items) || result.items.some(row => !Number.isSafeInteger(row.id) || row.id < 1 || !["android", "ios"].includes(row.platform) || typeof row.enabled !== "boolean")) throw new Error("Invalid inventory");
    const rows = result.items.filter(row => row.enabled);
    this.optedIn = rows.length > 0;
    return rows;
  }
  private hasPushPolicy(settings: Awaited<ReturnType<ApiClient["getNotificationSettings"]>>) {
    return this.options.modules().some(module => settings[module.key]?.push_enabled === true);
  }
  async start() {
    if (this.started || !this.current()) return;
    this.started = true;
    await this.refresh();
  }
  // Read-only recovery: never prompt, acquire a token or register implicitly.
  async refresh() {
    if (!this.started || !this.current() || this.locked) return;
    this.locked = true;
    this.responseSequence++;
    this.removeListeners?.();
    this.removeListeners = undefined;
    this.runtime = null;
    this.enabled = false;
    this.publish("loading", "Checking device notifications...");
    try {
      const config = await this.authenticated(() => this.options.api.getNativePushConfig());
      this.enabled = config.enabled === true;
      await this.inventory();
      this.runtime = await this.options.loadRuntime();
      if (!this.current()) return;
      if (this.runtime) {
        const sequence = this.responseSequence;
        this.removeListeners = this.runtime.listen(data => { void this.response(data); }, () => {
          if (this.optedIn && this.current()) void this.register(false);
        }, () => {
          if (this.optedIn && this.current()) this.publish(this.state.status, genericMessage);
        });
        void this.runtime.lastResponse().then(data => {
          if (this.current() && sequence === this.responseSequence && data !== null) void this.response(data);
        }).catch(() => {});
      }
      if (!this.enabled || !this.runtime || !this.runtime.isDevice || !this.runtime.projectId) {
        this.publish("unavailable", "Device notifications require an enabled server, a physical device and a configured app build.");
        return;
      }
      const settings = await this.authenticated(() => this.options.api.getNotificationSettings());
      const permitted = await this.runtime.permission();
      if (!this.current()) return;
      const active = this.optedIn && permitted && this.hasPushPolicy(settings);
      this.publish(active ? "enabled" : "off", active ? "Device notifications enabled. Delivery is not guaranteed." : this.optedIn ? permitted ? "Device registered, but push preferences are off. Enable to activate an accessible notification channel." : "Notification permission is blocked; this device remains registered. Disable to revoke it, or check system settings." : "Device notifications are off. Enable to request permission.");
    } catch {
      this.publish("error", "Could not check device notifications. Try again.");
    } finally {
      this.locked = false;
      this.publish(this.state.status, this.state.message);
    }
  }
  enable() { return this.register(true); }
  private async register(explicit: boolean) {
    if (!this.current() || this.locked || !this.started) return;
    const runtime = this.runtime;
    if (!this.enabled || !runtime?.isDevice || !runtime.projectId) {
      this.publish("unavailable", "Device notifications are unavailable in this app build.");
      return;
    }
    this.locked = true;
    this.publish(this.state.status, "Updating device notifications...");
    try {
      // Android requires the channel before the OS permission prompt/token call.
      if (runtime.platform === "android") await runtime.channel();
      if (!this.current()) return;
      const permission = explicit ? await runtime.requestPermission() : await runtime.permission();
      if (!this.current()) return;
      if (!permission) { this.publish("unavailable", "Notification permission was not granted. Check system settings."); return; }
      const token = await runtime.token();
      if (!this.current()) return;
      if (!/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/.test(token)) throw new Error("Invalid token");
      const old = await this.inventory();
      const receipt = await this.authenticated(() => this.options.api.createNativePushSubscription({ token: token as ExpoPushToken, platform: runtime.platform }));
      this.checkReceipt(receipt, runtime.platform);
      for (const row of old) {
        if (row.id !== receipt.id) await this.authenticated(() => this.options.api.deleteNativePushSubscription(row.id));
      }
      const rows = await this.inventory();
      if (!rows.some(row => row.id === receipt.id && row.platform === runtime.platform) || rows.some(row => row.id !== receipt.id)) throw new Error("Registration not verified");
      if (explicit) {
        const modules = this.options.modules();
        const settings = await this.authenticated(() => this.options.api.getNotificationSettings());
        for (const module of modules) {
          if (settings[module.key] && !settings[module.key].push_enabled) {
            await this.authenticated(() => this.options.api.updateNotificationSettings(module.key, { push_enabled: true }));
          }
        }
      }
      const verified = await this.authenticated(() => this.options.api.getNotificationSettings());
      if (!this.hasPushPolicy(verified)) throw new Error("Preferences not verified");
      this.optedIn = true;
      this.publish("enabled", "Device notifications enabled. Delivery is not guaranteed.");
    } catch {
      this.publish("error", "Could not verify device notifications. Try again.");
    } finally {
      this.locked = false;
      this.publish(this.state.status, this.state.message);
    }
  }
  private checkReceipt(receipt: NativePushSubscriptionResponse, platform: NativePushPlatform) {
    if (!Number.isSafeInteger(receipt?.id) || receipt.id < 1 || receipt.platform !== platform || receipt.enabled !== true) throw new Error("Invalid registration receipt");
  }
  async disable() {
    if (!this.current() || this.locked || !this.started) return;
    this.locked = true;
    this.publish(this.state.status, "Disabling device notifications...");
    try {
      const rows = await this.inventory();
      for (const row of rows) await this.authenticated(() => this.options.api.deleteNativePushSubscription(row.id));
      if ((await this.inventory()).length) throw new Error("Deletion not verified");
      this.optedIn = false;
      this.publish("off", "Device notifications are off. Other devices and browser preferences are unchanged.");
    } catch {
      this.publish("error", "Could not verify device notifications are off. Try again.");
    } finally {
      this.locked = false;
      this.publish(this.state.status, this.state.message);
    }
  }
  private async response(data: unknown) {
    const sequence = ++this.responseSequence;
    if (!this.current() || !data || typeof data !== "object") return;
    const payload = data as Record<string, unknown>;
    if (Object.keys(payload).some(key => key !== "notification_id") || !Number.isSafeInteger(payload.notification_id) || Number(payload.notification_id) < 1) return;
    try {
      const inbox = await this.authenticated(() => this.options.api.listNotifications({ unread: 0, limit: 200 }));
      if (!this.current() || sequence !== this.responseSequence) return;
      const item = inbox.items.find(row => row.id === payload.notification_id);
      const parent = ["PARENT", "PARENT_ADMIN"].includes(this.options.session.user.role);
      const tab = item ? relatedTab(item, this.options.modules(), parent) : null;
      if (tab) this.options.onNavigate(tab);
    } catch { /* Fail closed; no provider URL or foreign notification navigation. */ }
  }
  dispose(signedOut = false) {
    if (!this.alive) return;
    this.alive = false;
    this.responseSequence++;
    this.removeListeners?.();
    this.removeAuth?.();
    if (signedOut) {
      this.state = { status: "signed-out", busy: false, hasRegistration: false, message: "Sign in to manage device notifications." };
      this.options.onState(this.state);
    }
  }
}
