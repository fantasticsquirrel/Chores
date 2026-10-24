import { clearPackageContentCache } from "./packageCache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../api";
import {
  loadAuthorizedPackage,
  withAuthorizationDeadline,
} from "./packageCache";
const payload = {
  checksum: "checksum",
  manifest: { package_id: "lab", version: "1" },
  assets: [],
};
describe("immutable content cache never caches permission", () => {
  beforeEach(() => {
    clearPackageContentCache();
    vi.restoreAllMocks();
  });
  it("reuses resources only after a fresh grant and refuses revoked/offline auth", async () => {
    const auth = vi
      .spyOn(apiClient, "getDiscoveryExploration")
      .mockResolvedValue({
        id: "lab",
        package: { version: "1", checksum: "checksum" },
      } as never);
    const get = vi
      .spyOn(apiClient, "getDiscoveryPackage")
      .mockResolvedValue(payload as never);
    await loadAuthorizedPackage("lab");
    await loadAuthorizedPackage("lab");
    expect(auth).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledTimes(1);
    auth.mockRejectedValue(new Error("Forbidden"));
    await expect(loadAuthorizedPackage("lab")).rejects.toThrow("Forbidden");
    expect(get).toHaveBeenCalledTimes(1);
  });
  it("bounds hung authorization requests", async () => {
    vi.useFakeTimers();
    const p = expect(
      withAuthorizationDeadline(new Promise(() => {})),
    ).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(5001);
    await p;
    vi.useRealTimers();
  });
});
