import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { ApiClient as WebClient } from "../../../../frontend/src/api/client";
import { ApiClient as NativeClient } from "../../../../mobile/src/api/client";
import { FamilyTreeApiEndpoints } from "./family-tree";
import { familyTreeCases } from "../../test-support/family-tree-cases";

type Case = {
  name: string;
  method: string;
  path: string;
  schema?: string;
  response?: string;
  query?: Record<string, unknown>;
  binary?: boolean;
  responseArray?: boolean;
  multipart?: readonly string[];
  body?: unknown;
};
const cases: Case[] = familyTreeCases;
const negativeCases = [
  {
    schema: "AttachMedia",
    body: { expected_graph_revision: 4, person_id: 7, role: "story" },
  },
  {
    schema: "PreviewCommit",
    body: { expected_graph_revision: 4, preview_token: "a".repeat(64) },
  },
  {
    schema: "PurgeCommit",
    body: {
      expected_graph_revision: 4,
      password: "fresh",
      preview_token: "a".repeat(64),
    },
  },
  {
    schema: "ImportCommit",
    body: {
      expected_graph_revision: 4,
      idempotency_key: "import",
      confirmed: false,
    },
  },
  {
    schema: "ImportCommit",
    body: { expected_graph_revision: 4, confirmed: true },
  },
  { schema: "ExportRequest", body: { format: "sqlite" } },
  {
    schema: "PurgePreview",
    body: { expected_graph_revision: 4, password: "" },
  },
  {
    schema: "Manifest",
    body: {
      schema_version: 2,
      producer: "test",
      exported_at: "today",
      collection_title: "Tree",
      snapshot_revision: 0,
    },
  },
  {
    schema: "PortablePerson",
    body: { key: "p:1", person: { display_name: "Ada" }, user_id: 1 },
  },
  {
    schema: "PortableMedia",
    body: {
      key: "m:1",
      path: "../../secret",
      mime_type: "image/png",
      checksum: "a".repeat(64),
      byte_size: 1,
    },
  },
  {
    schema: "CreatePerson",
    body: { expected_graph_revision: 0, person: { display_name: "Ada" } },
  },
  {
    schema: "CreateRelative",
    body: {
      expected_graph_revision: 0,
      anchor_person_id: 2,
      person: { display_name: "Ada" },
      relationship: { direction: "child", kind: "biological" },
    },
  },
  {
    schema: "CreateStory",
    body: {
      expected_graph_revision: 0,
      story: { title: "Life", body_md: "Text" },
    },
  },
  { schema: "Command", body: {} },
  {
    schema: "Command",
    body: { expected_graph_revision: 0, reviewed_warnings: ["guessed"] },
  },
  {
    schema: "LinkIdentity",
    body: { expected_graph_revision: 0, user_id: 2, confirmed: false },
  },
  {
    schema: "PatchPerson",
    body: { expected_graph_revision: 0, changes: { aliases: null } },
  },
];
const probePath = fileURLToPath(
  new URL("../../test-support/family_tree_contract.py", import.meta.url),
);
export const backendContract = JSON.parse(
  execFileSync(
    process.env.FAMILY_TREE_CONTRACT_PYTHON ?? "python3",
    [probePath],
    {
      input: JSON.stringify([
        ...cases
          .filter((c) => c.schema)
          .map((c) => ({ schema: c.schema, body: c.body })),
        ...negativeCases,
      ]),
      encoding: "utf8",
      timeout: 30000,
    },
  ),
) as {
  openapi: {
    paths: Record<
      string,
      Record<
        string,
        {
          requestBody?: {
            content: Record<string, { schema: { $ref: string } }>;
          };
          responses: {
            "200": {
              content?: Record<
                string,
                {
                  schema: {
                    $ref?: string;
                    type?: string;
                    items?: { $ref: string };
                  };
                }
              >;
            };
          };
          parameters?: { name: string; in: string }[];
        }
      >
    >;
  };
  validations: { valid: boolean; body?: unknown }[];
  schemas: Record<string, unknown>;
};

describe("real Family Tree backend contract", () => {
  it("covers every implemented OpenAPI operation exactly once, with no absent FT3 methods", () => {
    const actual = Object.entries(backendContract.openapi.paths)
      .flatMap(([path, operations]) =>
        Object.keys(operations).map((method) => `${method} ${path}`),
      )
      .sort();
    expect(cases.map((c) => `${c.method} ${c.path}`).sort()).toEqual(actual);
    expect(new Set(cases.map((c) => c.name)).size).toBe(actual.length);
    expect(
      Object.getOwnPropertyNames(FamilyTreeApiEndpoints.prototype)
        .filter((name) => name !== "constructor")
        .sort(),
    ).toEqual(cases.map((c) => c.name).sort());
    for (const c of cases) {
      const operation = backendContract.openapi.paths[c.path][c.method];
      const schema =
        operation.responses["200"].content?.["application/json"].schema;
      if (c.binary) {
        // FastAPI's unmodelled Response default is NOT a JSON DTO contract.
        expect(schema?.$ref).toBeUndefined();
        expect(schema ? Object.keys(schema) : []).toEqual([]);
      } else {
        if (c.responseArray) expect(schema?.type).toBe("array");
        expect(c.responseArray ? schema?.items?.$ref : schema?.$ref).toBe(
          `#/components/schemas/${c.response ?? "MutationResult"}`,
        );
      }
      if (c.schema)
        expect(
          operation.requestBody?.content["application/json"].schema.$ref,
        ).toBe(`#/components/schemas/${c.schema}`);
      else if (c.multipart) {
        const ref =
          operation.requestBody?.content["multipart/form-data"].schema.$ref;
        expect(ref).toBeDefined();
        const bodySchema = (
          backendContract.openapi as unknown as {
            components: {
              schemas: Record<
                string,
                { properties: object; required: string[] }
              >;
            };
          }
        ).components.schemas[ref!.split("/").at(-1)!];
        expect(Object.keys(bodySchema.properties).sort()).toEqual(
          [...c.multipart].sort(),
        );
        expect(bodySchema.required).toContain("file");
        if (c.name === "stageFamilyTreeImport")
          expect(bodySchema.required).toContain("expected_graph_revision");
      } else expect(operation.requestBody).toBeUndefined();
      if (c.query)
        expect(Object.keys(c.query).sort()).toEqual(
          operation.parameters
            ?.filter((p) => p.in === "query")
            .map((p) => p.name)
            .sort(),
        );
    }
  });
  it("accepts all transport command examples in actual Pydantic validators and rejects missing idempotency/revision, false confirmation and null list fields", () => {
    const mutations = cases.filter((c) => c.schema);
    expect(backendContract.validations).toHaveLength(
      mutations.length + negativeCases.length,
    );
    expect(
      backendContract.validations
        .slice(0, mutations.length)
        .map((v) => v.valid),
    ).toEqual(mutations.map(() => true));
    expect(
      backendContract.validations.slice(mutations.length).map((v) => v.valid),
    ).toEqual(negativeCases.map(() => false));
    const patchIndex = mutations.findIndex(
      (c) => c.name === "patchFamilyTreePerson",
    );
    expect(backendContract.validations[patchIndex].body).toEqual(
      mutations[patchIndex].body,
    );
  });
});

for (const [platform, Client] of [
  ["web", WebClient],
  ["native", NativeClient],
] as const) {
  describe(`${platform} callable Family Tree operation map`, () => {
    it.each(familyTreeCases)("$name", async (c) => {
      const response = { marker: c.name };
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        }),
      );
      const api = new Client({
        baseUrl: "https://example.test/chore-api",
        fetchImpl: fetchMock,
      });
      expect(api).toBeInstanceOf(FamilyTreeApiEndpoints);
      const received = await c.invoke(api);
      if (c.binary) {
        expect(received).toMatchObject({
          content_type: "application/json",
          filename: null,
        });
        expect(
          new TextDecoder().decode((received as { bytes: ArrayBuffer }).bytes),
        ).toBe(JSON.stringify(response));
      } else expect(received).toEqual(response);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [urlValue, init] = fetchMock.mock.calls[0]!;
      const url = new URL(String(urlValue));
      expect(url.pathname).toBe(
        `/chore-api${c.path.replace(/\{[^}]+\}/g, "7")}`,
      );
      expect(init?.method).toBe(c.method.toUpperCase());
      expect(init?.credentials).toBe("include");
      const contractCase: Case = c;
      if (c.multipart) {
        expect(init?.body).toBe(c.body);
        expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
        expect(init?.cache).toBe("no-store");
      } else
        expect(
          init?.body ? JSON.parse(init.body as string) : undefined,
        ).toEqual(contractCase.body);
      if (c.binary || c.name === "cancelFamilyTreeImport")
        expect(init?.cache).toBe("no-store");
      if (contractCase.query) {
        for (const [key, value] of Object.entries(contractCase.query)) {
          expect(url.searchParams.getAll(key)).toEqual(
            (Array.isArray(value) ? value : [value]).map(String),
          );
        }
      } else expect(url.search).toBe("");
    });
  });
}
