import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  fileIssue,
  jobIssue,
  previewIssue,
  privateImageBlob,
  downloadLogicalExport,
  duplicateCandidates,
} from "./advanced";
import { person } from "../../forms/testFixtures";
const job = {
  id: 1,
  kind: "import",
  state: "ready",
  expected_graph_revision: 3,
  expires_at: "2030-01-01T00:00:00Z",
  summary: {},
};
beforeEach(() =>
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:private");
      static revokeObjectURL = vi.fn();
    },
  ),
);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("checked advanced workflow presentation is never commit authority", () => {
  it.each([
    { kind: "merge" },
    { state: "committed" },
    { expected_graph_revision: 4 },
    { expires_at: "invalid" },
    { expires_at: "2000-01-01T00:00:00Z" },
    { id: 0 },
  ])("rejects mismatched/stale/expired job envelope %j", (change) => {
    expect(jobIssue({ ...job, ...change }, "import", 3)).not.toBeNull();
  });
  it("accepts a ready revision-bound envelope, not a missing preview token", () => {
    expect(jobIssue(job, "import", 3)).toBeNull();
    expect(previewIssue({ ...job, preview_token: "" }, "import", 3)).toMatch(
      /missing/,
    );
  });
  it("rejects empty, oversized, nonimage and database/GEDCOM inputs before staging", () => {
    expect(
      fileIssue(new File([], "empty.png", { type: "image/png" }), "image"),
    ).toMatch(/nonempty/);
    expect(
      fileIssue(
        new File(["<svg>"], "image.svg", { type: "image/svg+xml" }),
        "image",
      ),
    ).toMatch(/JPEG/);
    expect(
      fileIssue(
        new File([new ArrayBuffer(10 * 1024 * 1024 + 1)], "image.png", {
          type: "image/png",
        }),
        "image",
      ),
    ).toMatch(/10 MiB/);
    expect(fileIssue(new File(["sqlite"], "data.db"), "import")).toMatch(
      /logical JSON/,
    );
    expect(
      fileIssue(new File(["GEDCOM"], "data.ged"), "import"),
    ).not.toBeNull();
  });
  it("allows actual PNG/JSON inputs but leaves byte validation to the server", () => {
    expect(
      fileIssue(
        new File(["bytes"], "photo.png", { type: "image/png" }),
        "image",
      ),
    ).toBeNull();
    expect(fileIssue(new File(["{}"], "backup.json"), "import")).toBeNull();
  });
  it("does not display remote/SVG or incorrectly typed authorized bytes", () => {
    expect(() =>
      privateImageBlob(
        {
          bytes: new ArrayBuffer(0),
          content_type: "image/svg+xml",
          filename: "image",
        },
        "image/svg+xml",
      ),
    ).toThrow(/Unexpected image/);
    expect(() =>
      privateImageBlob(
        {
          bytes: new ArrayBuffer(0),
          content_type: "image/png",
          filename: "image",
        },
        "image/webp",
      ),
    ).toThrow(/Unexpected image/);
  });
  it("uses fixed safe export filename, checks MIME, revokes URL even if click fails", () => {
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:private");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe("family-tree.json");
      throw new Error("Interrupted download");
    });
    expect(() =>
      downloadLogicalExport(
        {
          bytes: new ArrayBuffer(1),
          content_type: "application/json",
          filename: "../../evil.html",
        },
        "json",
      ),
    ).toThrow(/Interrupted/);
    expect(revoke).toHaveBeenCalledWith("blob:private");
    expect(() =>
      downloadLogicalExport(
        {
          bytes: new ArrayBuffer(1),
          content_type: "text/html",
          filename: "file",
        },
        "zip",
      ),
    ).toThrow(/Unexpected export/);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("duplicate suggestions never include self, archived people or merged aliases", () => {
    const source = person(1, "Alex"),
      other = person(2, "Alex"),
      archived = { ...person(3, "Alex"), archived_at: "today" },
      alias = { ...person(4, "Alex"), merged_into_person_id: 2 };
    expect(
      duplicateCandidates(source, [source, other, archived, alias]),
    ).toEqual([other]);
  });
});
