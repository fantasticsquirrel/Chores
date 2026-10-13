import { describe, expect, it, vi } from "vitest";
import { ApiClient as WebClient } from "../../../../frontend/src/api/client";
import { ApiClient as NativeClient } from "../../../../mobile/src/api/client";
import { familyTreeCases } from "../../test-support/family-tree-cases";
import { familyTreeProducer } from "../../test-support/family-tree-producer";
import {
  readFamilyTreeExportSummary,
  readFamilyTreeImportSummary,
  readFamilyTreeMergeSummary,
  readFamilyTreePurgeSummary,
} from "../models/family-tree-summary";
import type { FamilyTreeJob } from "../models/family-tree";

it("executes every FT3 producer operation, actor boundary, append/replay, duplicate confirmation and purge rejection", () => {
  const expected = familyTreeCases
    .slice(33)
    .map((c) => c.name)
    .sort();
  expect(
    [
      ...new Set(
        familyTreeProducer.records
          .filter((r) => r.status === 200)
          .map((r) => r.name),
      ),
    ].sort(),
  ).toEqual(expected);
  const rejected = familyTreeProducer.records.filter((r) => r.status !== 200);
  expect(rejected.map((r) => r.status).sort()).toEqual([
    403, 404, 409, 409, 409, 422,
  ]);
  const commits = familyTreeProducer.records
    .filter((r) => r.name === "commitFamilyTreeImport" && r.status === 200)
    .map((r) => r.response);
  expect(commits[0]).toMatchObject({ replayed: false });
  expect(commits[1]).toMatchObject({ replayed: true });
  expect(
    familyTreeProducer.records.find((r) => r.name === "cancelFamilyTreeImport")
      ?.response,
  ).toMatchObject({ state: "canceled" });
});

for (const [platform, Client] of [
  ["web", WebClient],
  ["native", NativeClient],
] as const) {
  describe(`${platform} actual ASGI producer → DTO → inherited client`, () => {
    it.each(
      familyTreeProducer.records.map((record, index) => ({ ...record, index })),
    )("$index $name status $status", async (r) => {
      const data =
        r.binary !== undefined
          ? new Uint8Array(Buffer.from(r.binary, "base64"))
          : JSON.stringify(r.response);
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response('{"csrf_token":"session-csrf"}', {
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(data, { status: r.status, headers: r.headers }),
        );
      const client = new Client({
        baseUrl: "https://example.test/chore-api",
        fetchImpl: fetchMock,
      });
      await client.login({
        email: "parent@example.test",
        password: "test-password",
      });
      const args: unknown[] = [...r.args];
      let form: FormData | undefined;
      if (r.multipart) {
        form = new FormData();
        for (const [key, value] of Object.entries(r.multipart.fields))
          form.append(key, value);
        for (const [key, file] of Object.entries(r.multipart.files))
          form.append(
            key,
            new Blob([new Uint8Array(Buffer.from(file.base64, "base64"))], {
              type: file.type,
            }),
            file.filename,
          );
        args.push(form);
      } else if (r.body !== null) args.push(r.body);
      const controller = new AbortController();
      args.push({ signal: controller.signal });
      const invoke = client[r.name as keyof typeof client] as (
        ...values: unknown[]
      ) => Promise<unknown>;
      const pending = invoke.call(client, ...args);
      if (r.status !== 200) {
        const response = r.response as { detail: string | { code?: string } };
        await expect(pending).rejects.toMatchObject({
          status: r.status,
          code:
            typeof response.detail === "object" &&
            !Array.isArray(response.detail)
              ? (response.detail.code ?? null)
              : null,
          data: r.response,
        });
      } else if (r.binary !== undefined) {
        const result = (await pending) as {
          bytes: ArrayBuffer;
          content_type: string;
          filename: string | null;
        };
        expect(new Uint8Array(result.bytes)).toEqual(
          new Uint8Array(Buffer.from(r.binary, "base64")),
        );
        expect(result.content_type).toBe(r.headers["content-type"]);
        expect(result.filename).toBe(
          r.name === "getFamilyTreeMediaContent"
            ? "image"
            : r.headers["content-type"].includes("zip")
              ? "family-tree.zip"
              : "family-tree.json",
        );
      } else {
        const result = await pending;
        expect(result).toEqual(r.response);
        if (
          r.response_model === "JobDTO" ||
          r.response_model === "PreviewDTO"
        ) {
          const job = result as FamilyTreeJob;
          const reader =
            job.kind === "export"
              ? readFamilyTreeExportSummary
              : job.kind === "import"
                ? readFamilyTreeImportSummary
                : job.kind === "merge"
                  ? readFamilyTreeMergeSummary
                  : readFamilyTreePurgeSummary;
          expect(reader(job)).not.toBeNull();
        }
      }
      expect(fetchMock).toHaveBeenCalledTimes(2); // never automatically retry mutations/rejections
      const [url, init] = fetchMock.mock.calls[1]!;
      expect(url).toBe(`https://example.test/chore-api${r.path}`);
      expect(init).toMatchObject({
        method: r.method,
        credentials: "include",
        signal: controller.signal,
      });
      const headers = new Headers(init?.headers);
      expect(headers.get("X-CSRF-Token")).toBe(
        r.method === "GET" ? null : "session-csrf",
      );
      if (form) {
        expect(init?.body).toBe(form);
        expect(headers.has("Content-Type")).toBe(false);
      } else
        expect(init?.body ? JSON.parse(init.body as string) : null).toEqual(
          r.body,
        );
      if (r.binary !== undefined || form || r.name === "cancelFamilyTreeImport")
        expect(init?.cache).toBe("no-store");
    });
  });
}
