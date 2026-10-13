import { describe, expect, it } from "vitest";
import { appendQueryParams, buildUrl } from "./client-core";

describe("repeated query values", () => {
  it.each(["/chore-api", "https://example.test/chore-api"])(
    "serializes arrays as repeated keys with scalar semantics at %s",
    (base) => {
      const url = buildUrl(base, "/family-tree/graph", {
        collapsed_up_ids: [3, 9],
        collapsed_down_ids: [4, 7],
        up_depth: 0,
        include_care: false,
        expansion_token: "a & b",
        empty: [],
        absent: undefined,
        nullable: null,
      });
      const params = new URL(url, "https://example.test").searchParams;
      expect(params.getAll("collapsed_up_ids")).toEqual(["3", "9"]);
      expect(params.getAll("collapsed_down_ids")).toEqual(["4", "7"]);
      expect(params.get("up_depth")).toBe("0");
      expect(params.get("include_care")).toBe("false");
      expect(params.get("expansion_token")).toBe("a & b");
      expect(params.has("empty")).toBe(false);
      expect(params.has("absent")).toBe(false);
      expect(params.has("nullable")).toBe(false);
    },
  );
  it("replaces prior scalar/array entries without duplicates", () => {
    const params = new URLSearchParams("id=old&id=older&enabled=old&keep=yes");
    appendQueryParams(params, { id: [1, 2], enabled: false });
    expect(params.toString()).toBe("enabled=false&keep=yes&id=1&id=2");
  });
});
