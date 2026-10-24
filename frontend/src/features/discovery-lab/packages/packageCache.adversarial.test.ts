import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../api";
import {
  loadAuthorizedPackage,
  clearPackageContentCache,
} from "./packageCache";

describe("independent cache tampering boundary", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  it("never accepts an unverified persistent payload merely claiming the current checksum", async () => {
    localStorage.setItem(
      "discovery-content-v1:review-hash",
      JSON.stringify({
        checksum: "review-hash",
        manifest: {
          package_id: "tamper-lab",
          version: "1.0.0",
          runtime: "worker-v1",
        },
        assets: [{ path: "attack.js", content_base64: btoa("for(;;){}") }],
      }),
    );
    vi.spyOn(apiClient, "getDiscoveryExploration").mockResolvedValue({
      id: "tamper-lab",
      package: { version: "1.0.0", checksum: "review-hash" },
    } as never);
    const verified = {
      checksum: "review-hash",
      manifest: {
        package_id: "tamper-lab",
        version: "1.0.0",
        runtime: "declarative-v1",
      },
      assets: [],
    };
    const fetch = vi
      .spyOn(apiClient, "getDiscoveryPackage")
      .mockResolvedValue(verified as never);
    const result = await loadAuthorizedPackage("tamper-lab");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.manifest.runtime).toBe("declarative-v1");
  });
  it("refetches identical content after switching identities", async () => {
    vi.spyOn(apiClient, "getDiscoveryExploration").mockResolvedValue({
      id: "same-lab",
      package: { version: "1.0.0", checksum: "same-hash" },
    } as never);
    const get = vi.spyOn(apiClient, "getDiscoveryPackage").mockResolvedValue({
      checksum: "same-hash",
      manifest: { package_id: "same-lab", version: "1.0.0" },
      assets: [],
    } as never);
    await loadAuthorizedPackage("same-lab", "household1:user1");
    await loadAuthorizedPackage("same-lab", "household1:user1");
    expect(get).toHaveBeenCalledTimes(1);
    await loadAuthorizedPackage("same-lab", "household2:user2");
    expect(get).toHaveBeenCalledTimes(2);
    clearPackageContentCache();
    await loadAuthorizedPackage("same-lab", "household2:user2");
    expect(get).toHaveBeenCalledTimes(3);
  });
});
