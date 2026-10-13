import { describe, it, expect } from "vitest";
import { imageDataUri, validateJob, duplicateSuggestions } from "./safety";
import type {
  FamilyTreeJob,
  FamilyTreePerson,
} from "@family-manager/family-api/models";
const job: FamilyTreeJob = {
  id: 1,
  kind: "import",
  state: "ready",
  expected_graph_revision: 2,
  expires_at: "2099-01-01T00:00:00Z",
  summary: {},
};
describe("native advanced boundaries", () => {
  it("checks kind, state, expiry and exact revision independently of summary", () => {
    expect(validateJob(job, "import", 2)).toBe(true);
    for (const changed of [
      { kind: "export" },
      { state: "committed" },
      { expires_at: "invalid" },
      { expires_at: "2000-01-01" },
      { expected_graph_revision: 1 },
    ]) {
      expect(validateJob({ ...job, ...changed }, "import", 2)).toBe(false);
    }
  });
  it("renders actual bounded authorized image bytes only in memory", () => {
    expect(
      imageDataUri({
        bytes: new Uint8Array([0, 255, 16]).buffer,
        content_type: "image/png",
        filename: "private.png",
      }),
    ).toBe("data:image/png;base64,AP8Q");
    expect(() =>
      imageDataUri({
        bytes: new ArrayBuffer(10 * 1024 * 1024 + 1),
        content_type: "image/png",
        filename: null,
      }),
    ).toThrow();
    expect(() =>
      imageDataUri({
        bytes: new ArrayBuffer(1),
        content_type: "image/svg+xml",
        filename: null,
      }),
    ).toThrow();
  });
  it("suggests only available same-name canonical people without inferring ancestry", () => {
    const p = {
      id: 1,
      display_name: "Ada",
      aliases: [],
      is_locked: false,
      archived_at: null,
      merged_into_person_id: null,
    } as unknown as FamilyTreePerson;
    const candidates = [
      { ...p, id: 2, display_name: " ADA " },
      { ...p, id: 3, display_name: "Other" },
      { ...p, id: 4, merged_into_person_id: 2 },
    ];
    expect(duplicateSuggestions(p, candidates).map((x) => x.id)).toEqual([2]);
  });
});
