import { describe, expect, it, jest, afterEach } from "@jest/globals";
import { Platform } from "react-native";
const mockChannel = jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue();
const mockPermission = jest.fn<() => Promise<{ granted: boolean }>>().mockResolvedValue({ granted: true });
const mockRequest = jest.fn<() => Promise<{ granted: boolean }>>().mockResolvedValue({ granted: false });
const mockToken = jest.fn<(...args: unknown[]) => Promise<{ data: string }>>().mockResolvedValue({ data: "ExpoPushToken[test]" });
const mockRemove = jest.fn();
const mockResponse = jest.fn(() => ({ remove: mockRemove }));
const mockRotate = jest.fn(() => ({ remove: mockRemove }));
const mockReceived = jest.fn(() => ({ remove: mockRemove }));
const mockHandler = jest.fn<(...args: unknown[]) => void>();
jest.mock("expo-notifications", () => ({ setNotificationChannelAsync: (...args: unknown[]) => mockChannel(...args), getPermissionsAsync: () => mockPermission(), requestPermissionsAsync: () => mockRequest(), getExpoPushTokenAsync: (...args: unknown[]) => mockToken(...args), addNotificationResponseReceivedListener: () => mockResponse(), addPushTokenListener: () => mockRotate(), addNotificationReceivedListener: () => mockReceived(), getLastNotificationResponseAsync: async () => null, clearLastNotificationResponseAsync: async () => {}, setNotificationHandler: (...args: unknown[]) => mockHandler(...args), AndroidImportance: { DEFAULT: 3 } }));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { executionEnvironment: "standalone", easConfig: { projectId: "project-test" } } }));
import { loadNativePushRuntime } from "./nativePushRuntime";
afterEach(() => { jest.clearAllMocks(); });
describe("native push runtime", () => {
 it("web is inert and never loads notification listeners", async () => {
  jest.replaceProperty(Platform, "OS", "web");
  expect(await loadNativePushRuntime()).toBeNull(); expect(mockHandler).not.toHaveBeenCalled();
 });
 it("uses project-scoped Expo tokens, channel, explicit permission and removes every listener", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  const runtime = await loadNativePushRuntime(); expect(runtime).not.toBeNull();
  expect(mockRequest).not.toHaveBeenCalled(); await runtime!.channel(); await runtime!.requestPermission(); await runtime!.token();
  expect(mockChannel).toHaveBeenCalled(); expect(mockToken).toHaveBeenCalledWith({ projectId: "project-test" });
  const stop = runtime!.listen(jest.fn(), jest.fn(), jest.fn()); stop();
  expect(mockRemove).toHaveBeenCalledTimes(3);
  const config = mockHandler.mock.calls[0][0] as { handleNotification: () => Promise<unknown> };
  expect(await config.handleNotification()).toEqual({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false });
 });
});
