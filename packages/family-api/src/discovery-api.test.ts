import { describe, expect, it } from "vitest";
import { FamilyDiscoveryApiEndpoints } from "./endpoints/discovery-lab";
import type { RequestQuery } from "./client-core";

class Harness extends FamilyDiscoveryApiEndpoints {
  calls: unknown[][] = [];
  protected get<T>(path: string, query?: RequestQuery): Promise<T> {
    this.calls.push(["GET", path, query]);
    return Promise.resolve([] as T);
  }
  protected put<T, B>(path: string, body: B): Promise<T> {
    this.calls.push(["PUT", path, body]);
    return Promise.resolve({} as T);
  }
  protected post<T, B>(path: string, body: B): Promise<T> {
    this.calls.push(["POST", path, body]);
    return Promise.resolve({} as T);
  }
  protected patch<T>(): Promise<T> {
    throw new Error("unused");
  }
  protected delete(): Promise<void> {
    throw new Error("unused");
  }
  protected postNoContent(): Promise<void> {
    throw new Error("unused");
  }
  protected postNoContentWithBody<T>(): Promise<void> {
    throw new Error("unused");
  }
}

describe("Discovery Lab shared endpoints", () => {
  it("preserves scoped filter and bulk request contracts on both clients", async () => {
    const api = new Harness();
    await api.listDiscoveryExplorations({
      child_id: 2,
      grade_band: "3-5",
      tag: "space",
    });
    await api.getDiscoveryExploration("moon-phases", 2);
    await api.getDiscoveryExploration("x/y");
    await api.listDiscoveryChildren();
    await api.getDiscoveryChildAccess(2);
    await api.updateDiscoveryChildAccess(2, {
      enabled: false,
      exploration_ids: ["gravity"],
      subject: "Physics",
    });
    expect(api.calls).toEqual([
      [
        "GET",
        "/discovery/explorations",
        { child_id: 2, grade_band: "3-5", tag: "space" },
      ],
      ["GET", "/discovery/explorations/moon-phases", { child_id: 2 }],
      ["GET", "/discovery/explorations/x%2Fy", { child_id: undefined }],
      ["GET", "/discovery/children", undefined],
      ["GET", "/discovery/children/2/access", undefined],
      [
        "PUT",
        "/discovery/children/2/access",
        { enabled: false, exploration_ids: ["gravity"], subject: "Physics" },
      ],
    ]);
  });
});

it("encodes immutable package IDs and versions across upload, preview, publish and runtime", async () => {
  const api = new Harness();
  await api.uploadDiscoveryPackage("zip");
  await api.listDiscoveryPackages();
  await api.previewDiscoveryPackage("x/y", "1/2");
  await api.publishDiscoveryPackage("x/y", "1/2");
  await api.getDiscoveryPackage("x/y");
  expect(api.calls).toEqual([
    ["POST", "/discovery/packages", { archive_base64: "zip" }],
    ["GET", "/discovery/packages", undefined],
    ["GET", "/discovery/packages/x%2Fy/versions/1%2F2", undefined],
    ["POST", "/discovery/packages/x%2Fy/versions/1%2F2/publish", {}],
    ["GET", "/discovery/explorations/x%2Fy/package", undefined],
  ]);
});
