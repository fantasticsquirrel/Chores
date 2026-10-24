import type { BinaryDownload } from "@family-manager/family-api/client-core";

// Match the authenticated binary-download workflow used by Family Tree, without
// handing private API URLs to a new tab or persisting a report cache.
export function downloadSemesterPdf(data: BinaryDownload, semesterId: number, childId: number): void {
  if (data.content_type !== "application/pdf") throw new Error("Unexpected report content type. No file was downloaded.");
  const url = URL.createObjectURL(new Blob([data.bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = `homeschool-semester-${semesterId}-child-${childId}.pdf`;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}
