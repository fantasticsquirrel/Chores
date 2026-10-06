import { AppState, Platform } from "react-native";
import type { NativePushRuntime } from "./nativePushController";

// Native SDKs are not imported on web; Expo Go cannot register remote push.
export async function loadNativePushRuntime(): Promise<NativePushRuntime | null> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return null;
  const constants = (require("expo-constants") as typeof import("expo-constants")).default;
  if (constants.executionEnvironment === "storeClient") return null;
  const notifications = require("expo-notifications") as typeof import("expo-notifications");
  const device = require("expo-device") as typeof import("expo-device");
  const projectId = constants.easConfig?.projectId ?? constants.expoConfig?.extra?.eas?.projectId ?? null;
  notifications.setNotificationHandler({
    // Foreground inbox content is never shown in OS banners or sounds.
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
  });
  return {
    platform: Platform.OS,
    projectId: typeof projectId === "string" && projectId.length > 0 ? projectId : null,
    isDevice: device.isDevice,
    channel: async () => { await notifications.setNotificationChannelAsync("household", { name: "Household notifications", importance: notifications.AndroidImportance.DEFAULT }); },
    permission: async () => (await notifications.getPermissionsAsync()).granted,
    requestPermission: async () => (await notifications.requestPermissionsAsync()).granted,
    token: async () => (await notifications.getExpoPushTokenAsync({ projectId })).data,
    listen: (response, rotate, received) => {
      const listeners = [
        notifications.addNotificationResponseReceivedListener(event => response(event.notification.request.content.data)),
        notifications.addPushTokenListener(() => rotate()),
        notifications.addNotificationReceivedListener(() => received()),
      ];
      const lifecycle = AppState.addEventListener("change", state => { if (state === "active") rotate(); });
      return () => { listeners.forEach(listener => listener.remove()); lifecycle.remove(); };
    },
    lastResponse: async () => {
      const response = await notifications.getLastNotificationResponseAsync();
      if (response) await notifications.clearLastNotificationResponseAsync();
      return response?.notification.request.content.data ?? null;
    },
  };
}
