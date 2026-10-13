import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../../../../api/client";
import type { TreeRequestOptions } from "./requests";
const cases = [
  {
    method: "getFamilyTreeCollection",
    args: [],
    verb: "GET",
    path: "/family-tree/",
  },
  {
    method: "getFamilyTreeGraph",
    args: [{ focus_person_id: 3 }],
    verb: "GET",
    path: "/family-tree/graph",
  },
  {
    method: "patchFamilyTreePerson",
    args: [
      3,
      {
        expected_graph_revision: 7,
        idempotency_key: "retained",
        changes: { notes_md: "Touched only" },
      },
    ],
    verb: "PATCH",
    path: "/family-tree/people/3",
  },
  {
    method: "deleteFamilyTreeStory",
    args: [5, { expected_graph_revision: 7, idempotency_key: "retained" }],
    verb: "DELETE",
    path: "/family-tree/stories/5",
  },
] as const;
describe("actual committed native/shared transport request signal (only fetch is mocked)", () => {
  it.each(cases)(
    "$method sends its operation-owned signal to native fetch, not the JSON body",
    async (entry) => {
      let init: RequestInit | undefined,
        url = "";
      const fetchImpl = vi
        .fn<(input: unknown, options?: RequestInit) => Promise<Response>>()
        .mockImplementation(async (input, options) => {
          url = String(input);
          init = options;
          return new Promise((_resolve, reject) =>
            options?.signal?.addEventListener("abort", () =>
              reject(
                Object.assign(new Error("Aborted"), { name: "AbortError" }),
              ),
            ),
          );
        });
      const api = createApiClient({
        baseUrl: "https://family.example.test/chore-api",
        fetchImpl,
      });
      const controller = new AbortController();
      const options: TreeRequestOptions = { signal: controller.signal };
      const operation = Reflect.apply(api[entry.method], api, [
        ...entry.args,
        options,
      ]) as Promise<unknown>;
      expect(init?.signal).toBe(controller.signal);
      expect(init?.credentials).toBe("include");
      expect(init?.method).toBe(entry.verb);
      expect(url).toContain("/chore-api" + entry.path);
      if (entry.verb !== "GET") {
        expect(JSON.parse(String(init?.body))).toEqual(entry.args[1]);
        expect(JSON.parse(String(init?.body))).not.toHaveProperty("signal");
      }
      const rejection = expect(operation).rejects.toHaveProperty(
        "name",
        "AbortError",
      );
      controller.abort();
      await rejection;
    },
  );
});
