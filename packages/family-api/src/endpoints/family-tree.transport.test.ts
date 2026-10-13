import { describe, expect, it, vi } from "vitest";
import { ApiClient as WebClient } from "../../../../frontend/src/api/client";
import { ApiClient as NativeClient } from "../../../../mobile/src/api/client";
import { familyTreeCases } from "../../test-support/family-tree-cases";
import type { FamilyTreeApiEndpoints } from "./family-tree";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
for (const [platform, Client] of [
  ["web", WebClient],
  ["native", NativeClient],
] as const) {
  describe(`${platform} Family Tree per-call cancellation`, () => {
    it.each(familyTreeCases)(
      "forwards the exact AbortSignal for $name without moving options into body/query",
      async (c) => {
        let args: unknown[] = [];
        const recorder = new Proxy(
          {},
          {
            get:
              () =>
              (...values: unknown[]) => {
                args = values;
                return Promise.resolve();
              },
          },
        );
        await c.invoke(recorder as FamilyTreeApiEndpoints);
        const controller = new AbortController();
        const fetchMock = vi
          .fn<typeof fetch>()
          .mockResolvedValue(json({ accepted: true }));
        const client = new Client({
          baseUrl: "https://example.test/chore-api",
          fetchImpl: fetchMock,
        });
        const method = client[c.name as keyof typeof client] as (
          ...values: unknown[]
        ) => Promise<unknown>;
        await method.call(client, ...args, { signal: controller.signal });
        const [url, init] = fetchMock.mock.calls[0]!;
        expect(init?.signal).toBe(controller.signal);
        expect(String(url)).not.toContain("signal");
        expect(init?.credentials).toBe("include");
        if (c.multipart) expect(init?.body).toBe(c.body);
        else
          expect(
            init?.body ? JSON.parse(init.body as string) : undefined,
          ).toEqual(c.body);
      },
    );
    it.each(["read", "multipart", "binary", "cancel"] as const)(
      "aborts %s independently, with CSRF intact and no automatic retry",
      async (kind) => {
        const controller = new AbortController();
        const fetchMock = vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(json({ csrf_token: "session-csrf" }))
          .mockImplementationOnce(
            (_url, init) =>
              new Promise((_resolve, reject) => {
                const abort = () =>
                  reject(new DOMException("Aborted", "AbortError"));
                if (init?.signal?.aborted) abort();
                else
                  init?.signal?.addEventListener("abort", abort, {
                    once: true,
                  });
              }),
          )
          .mockResolvedValueOnce(json({ independent: true }));
        const client = new Client({
          baseUrl: "https://example.test/chore-api",
          fetchImpl: fetchMock,
        });
        await client.login({
          email: "parent@example.test",
          password: "test-password",
        });
        const generation =
          client instanceof NativeClient
            ? client.authenticationGeneration
            : undefined;
        const options = { signal: controller.signal };
        const pending =
          kind === "read"
            ? client.getFamilyTreePerson(7, options)
            : kind === "multipart"
              ? client.stageFamilyTreeImport(new FormData(), options)
              : kind === "binary"
                ? client.downloadFamilyTreeExport(7, options)
                : client.cancelFamilyTreeImport(7, options);
        const rejected = expect(pending).rejects.toMatchObject({
          name: "AbortError",
        });
        controller.abort();
        await rejected;
        const init = fetchMock.mock.calls[1]![1];
        expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe(
          kind === "multipart" || kind === "cancel" ? "session-csrf" : null,
        );
        await expect(client.getFamilyTreeCollection()).resolves.toEqual({
          independent: true,
        });
        expect(fetchMock.mock.calls[2]![1]?.signal).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        if (client instanceof NativeClient)
          expect(client.authenticationGeneration).toBe(generation);
      },
    );
    it("keeps simultaneous signals independent and honors a pre-aborted signal without retry", async () => {
      const first = new AbortController(),
        second = new AbortController();
      let finishSecond!: (response: Response) => void;
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(
        (_url, init) =>
          new Promise((resolve, reject) => {
            const signal = init?.signal;
            if (signal?.aborted) {
              reject(signal.reason);
              return;
            }
            signal?.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
            if (signal === second.signal) finishSecond = resolve;
          }),
      );
      const client = new Client({
        baseUrl: "https://example.test/chore-api",
        fetchImpl: fetchMock,
      });
      const pendingFirst = client.getFamilyTreeGraph(
        {},
        { signal: first.signal },
      );
      const pendingSecond = client.getFamilyTreePerson(7, {
        signal: second.signal,
      });
      const rejected = expect(pendingFirst).rejects.toMatchObject({
        name: "AbortError",
      });
      first.abort();
      await rejected;
      expect(second.signal.aborted).toBe(false);
      finishSecond(json({ second: true }));
      await expect(pendingSecond).resolves.toEqual({ second: true });
      const before = new AbortController();
      before.abort();
      await expect(
        client.getFamilyTreeCollection({ signal: before.signal }),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls.map((call) => call[1]?.signal)).toEqual([
        first.signal,
        second.signal,
        before.signal,
      ]);
    });
    it.each(["multipart", "cancel", "binary-error"] as const)(
      "preserves AbortError during %s JSON decoding rather than reporting bad JSON/server rejection",
      async (kind) => {
        const controller = new AbortController();
        const response = json(
          { detail: { code: "transfer_expired", message: "Expired" } },
          kind === "binary-error" ? 409 : 200,
        );
        const decoding = vi.fn(
          () =>
            new Promise<unknown>((_resolve, reject) => {
              controller.signal.addEventListener(
                "abort",
                () => reject(controller.signal.reason),
                { once: true },
              );
            }),
        );
        response.json = decoding;
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
        const client = new Client({
          baseUrl: "https://example.test/chore-api",
          fetchImpl: fetchMock,
        });
        const options = { signal: controller.signal };
        const pending =
          kind === "multipart"
            ? client.stageFamilyTreeImport(new FormData(), options)
            : kind === "cancel"
              ? client.cancelFamilyTreeImport(7, options)
              : client.downloadFamilyTreeExport(7, options);
        const rejected = expect(pending).rejects.toMatchObject({
          name: "AbortError",
        });
        await vi.waitFor(() => expect(decoding).toHaveBeenCalledTimes(1));
        controller.abort();
        await rejected;
        expect(fetchMock).toHaveBeenCalledTimes(1);
      },
    );
    it("keeps a server rejection structured when a signal was supplied, without replay", async () => {
      const controller = new AbortController();
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        json(
          {
            detail: {
              code: "transfer_expired",
              message: "Start a new preview.",
            },
          },
          409,
        ),
      );
      const client = new Client({
        baseUrl: "https://example.test/chore-api",
        fetchImpl: fetchMock,
      });
      await expect(
        client.cancelFamilyTreeImport(7, { signal: controller.signal }),
      ).rejects.toMatchObject({ status: 409, code: "transfer_expired" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]![1]).toMatchObject({
        signal: controller.signal,
        method: "DELETE",
        cache: "no-store",
      });
      expect(fetchMock.mock.calls[0]![1]?.body).toBeUndefined();
    });
  });
}
