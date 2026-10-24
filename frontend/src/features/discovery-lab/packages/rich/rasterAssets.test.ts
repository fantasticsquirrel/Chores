import { it, expect } from "vitest";
import { rasterDimensions } from "./rasterAssets";
it("validates dimensions from PNG/JPEG headers, never trusts MIME or filename alone", () => {
  const png = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 8, 0, 0,
    0, 4, 0,
  ]);
  expect(rasterDimensions(png, "image/png")).toEqual([2048, 1024]);
  expect(rasterDimensions(png, "image/jpeg")).toBeNull();
  expect(
    rasterDimensions(
      new TextEncoder().encode('<svg onload="evil"/>'),
      "image/png",
    ),
  ).toBeNull();
  const jpg = Uint8Array.from([255, 216, 255, 192, 0, 8, 8, 4, 0, 8, 0, 1]);
  expect(rasterDimensions(jpg, "image/jpeg")).toEqual([2048, 1024]);
  expect(rasterDimensions(jpg.slice(0, 8), "image/jpeg")).toBeNull();
});
it("checks content integrity and individual decoded pixel budget before creating any image", async () => {
  const { loadRasterAssets } = await import("./rasterAssets");
  const bytes = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 8, 0, 0,
    0, 4, 0,
  ]);
  const asset = {
    path: "moon.png",
    mime_type: "image/png",
    sha256: "0".repeat(64),
    content_base64: btoa(String.fromCharCode(...bytes)),
  };
  await expect(loadRasterAssets({ assets: [asset] } as never)).rejects.toThrow(
    "checksum",
  );
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 4096);
  view.setUint32(20, 4096);
  await expect(
    loadRasterAssets({
      assets: [
        { ...asset, content_base64: btoa(String.fromCharCode(...bytes)) },
      ],
    } as never),
  ).rejects.toThrow("dimensions");
});
