import { File, Paths } from "expo-file-system";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import type { BinaryDownload } from "@family-manager/family-api/client-core";

export async function shareSemesterReport(
  download: BinaryDownload,
  current: () => boolean,
): Promise<void> {
  if (!current())
    throw new Error(
      "Report selection or account changed. Please export again.",
    );
  if (
    download.content_type !== "application/pdf" ||
    !download.bytes.byteLength ||
    download.bytes.byteLength > 20 * 1024 * 1024
  )
    throw new Error("Invalid or oversized PDF report.");
  if (!(await isAvailableAsync()))
    throw new Error("PDF sharing is not available on this device.");
  if (!current())
    throw new Error(
      "Report selection or account changed. Please export again.",
    );
  // Unique private cache path prevents concurrent exports overwriting another report.
  const file = new File(
    Paths.cache,
    `homeschool-semester-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`,
  );
  try {
    file.create();
    file.write(new Uint8Array(download.bytes));
    if (!current())
      throw new Error(
        "Report selection or account changed. Please export again.",
      );
    await shareAsync(file.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Save or share semester report",
    });
  } finally {
    // The native share operation has returned; do not leave optional child notes in cache.
    if (file.exists) file.delete();
  }
}
