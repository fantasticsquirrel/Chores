import type { DiscoveryPackagePayload } from "@family-manager/family-api/models";
export type RasterAssets = ReadonlyMap<string, HTMLImageElement>;
/** Inspect encoded dimensions before the browser can allocate decoded pixels. */
export function rasterDimensions(
  bytes: Uint8Array,
  mime: string,
): [number, number] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/png") {
    if (
      bytes.length < 24 ||
      [137, 80, 78, 71, 13, 10, 26, 10].some((v, i) => bytes[i] !== v) ||
      view.getUint32(8) !== 13 ||
      view.getUint32(12) !== 0x49484452
    )
      return null;
    for (let at = 8; at + 8 <= bytes.length; ) {
      const length = view.getUint32(at),
        type = view.getUint32(at + 4);
      if (type === 0x6163544c) return null;
      if (length > bytes.length - at - 12) break;
      at += length + 12;
    }
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (
    mime !== "image/jpeg" ||
    bytes.length < 4 ||
    bytes[0] !== 255 ||
    bytes[1] !== 216
  )
    return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) return null;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 217 || marker === 218) return null;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([192, 193, 194].includes(marker)) {
      if (length < 8) return null;
      return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
    }
    offset += length;
  }
  return null;
}
export async function loadRasterAssets(
  payload: DiscoveryPackagePayload,
): Promise<Map<string, HTMLImageElement>> {
  const images = new Map<string, HTMLImageElement>();
  let pixels = 0;
  const candidates = payload.assets.filter((a) =>
    ["image/png", "image/jpeg"].includes(a.mime_type),
  );
  if (candidates.length > 32) throw Error("Too many raster assets");
  // Validate every header first, so a later over-budget asset cannot start allocations.
  const checked = candidates.map((a) => {
    if (a.content_base64.length > 1398104)
      throw Error("Raster asset is too large");
    const bytes = Uint8Array.from(atob(a.content_base64), (c) =>
      c.charCodeAt(0),
    );
    const size = rasterDimensions(bytes, a.mime_type);
    if (
      !size ||
      size.some((n) => n < 1 || n > 4096) ||
      size[0] * size[1] > 4000000 ||
      (pixels += size[0] * size[1]) > 16777216
    )
      throw Error("Unsupported raster dimensions");
    return { a, bytes, size };
  });
  for (const { a, bytes, size } of checked) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== a.sha256) throw Error("Raster asset checksum mismatch");
    const url = URL.createObjectURL(new Blob([bytes], { type: a.mime_type }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth !== size[0] || image.naturalHeight !== size[1])
        throw Error("Raster dimensions changed");
      images.set(a.path, image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return images;
}
