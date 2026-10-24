import { describe, expect, it, vi } from "vitest";
import { ApiClient as WebClient } from "../../../../frontend/src/api/client";
import { ApiClient as NativeClient } from "../../../../mobile/src/api/client";

for (const [platform, Client] of [
  ["web", WebClient],
  ["native", NativeClient],
] as const) {
  describe(`${platform} semester PDF export`, () => {
    it("uses authenticated binary transport with notes off by default and cancellation", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("%PDF-fixture", {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": 'attachment; filename="semester.pdf"',
            },
          }),
        );
      const client = new Client({
        baseUrl: "https://example.test/chore-api",
        fetchImpl: fetchMock,
      });
      const controller = new AbortController();
      const result = await client.downloadHomeschoolSemesterReport(
        { household_id: 4, child_id: 7, semester_id: 11 },
        { signal: controller.signal },
      );
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(String(url)).toBe(
        "https://example.test/chore-api/homeschool/semesters/11/report.pdf?household_id=4&child_id=7&include_notes=false",
      );
      expect(init?.credentials).toBe("include");
      expect(init?.signal).toBe(controller.signal);
      expect(result.filename).toBe("semester.pdf");
      expect(result.content_type).toBe("application/pdf");
      expect(new TextDecoder().decode(result.bytes)).toBe("%PDF-fixture");
    });
    it("sends the explicit notes choice", async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("%PDF", {
            headers: { "Content-Type": "application/pdf" },
          }),
        );
      const client = new Client({
        baseUrl: "https://example.test/chore-api",
        fetchImpl: fetchMock,
      });
      await client.downloadHomeschoolSemesterReport({
        household_id: 4,
        child_id: 7,
        semester_id: 11,
        include_notes: true,
      });
      expect(String(fetchMock.mock.calls[0]![0])).toContain(
        "include_notes=true",
      );
    });
  });
}
