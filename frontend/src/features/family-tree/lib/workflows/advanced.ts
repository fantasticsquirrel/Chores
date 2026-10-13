import type {
  FamilyTreeJob,
  FamilyTreePreview,
  FamilyTreePerson,
} from "../../../../api";
import type { BinaryDownload } from "@family-manager/family-api/client-core";

export function jobIssue(
  job: FamilyTreeJob,
  kind: string,
  expectedRevision: number,
  now = Date.now(),
): string | null {
  if (job.kind !== kind || !Number.isSafeInteger(job.id) || job.id <= 0)
    return "The server returned a mismatched job. Obtain a new preview.";
  if (job.state !== "ready")
    return `This ${kind} job is ${job.state}; start a new preview.`;
  const expiry = Date.parse(job.expires_at);
  if (!Number.isFinite(expiry) || expiry <= now)
    return "This preview or transfer expired. Start a new preview; no automatic retry was made.";
  if (job.expected_graph_revision !== expectedRevision)
    return "The tree revision changed. Keep the draft, reload current records and request a fresh preview.";
  return null;
}
export function previewIssue(
  job: FamilyTreePreview,
  kind: string,
  expectedRevision: number,
  now = Date.now(),
) {
  return (
    jobIssue(job, kind, expectedRevision, now) ||
    (!job.preview_token
      ? "The preview token is missing. Request a new preview."
      : null)
  );
}
export function fileIssue(file: File, kind: "image" | "import") {
  const max = kind === "image" ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
  if (!file.size || file.size > max)
    return `Choose a nonempty file no larger than ${kind === "image" ? "10" : "100"} MiB.`;
  if (
    kind === "image" &&
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    return "Only JPEG, PNG and WebP photographs are supported. SVG and remote images are not accepted.";
  if (kind === "import" && !/\.(json|zip)$/i.test(file.name))
    return "Choose a versioned logical JSON or ZIP export, not a database or GEDCOM file.";
  return null;
}
export function privateImageBlob(
  data: BinaryDownload,
  expectedMime: string,
): Blob {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(data.content_type) ||
    data.content_type !== expectedMime
  )
    throw new Error("Unexpected image content type. No image was rendered.");
  return new Blob([data.bytes], { type: data.content_type });
}
export function downloadLogicalExport(
  data: BinaryDownload,
  format: "json" | "zip",
) {
  const mime = format === "json" ? "application/json" : "application/zip";
  if (data.content_type !== mime)
    throw new Error("Unexpected export content type. No file was downloaded.");
  const url = URL.createObjectURL(new Blob([data.bytes], { type: mime }));
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = `family-tree.${format}`;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}
/** Advisory only; compatible names are a prompt for human comparison, not lineage. */
export function duplicateCandidates(
  source: FamilyTreePerson,
  people: FamilyTreePerson[],
) {
  const names = (p: FamilyTreePerson) =>
    [
      p.display_name,
      p.first_name && `${p.first_name} ${p.last_name ?? ""}`,
      ...p.aliases.map((a) => a.name),
    ]
      .filter((s): s is string => !!s)
      .map((s) => s.trim().toLocaleLowerCase());
  const entered = names(source);
  return people.filter(
    (p) =>
      p.id !== source.id &&
      !p.archived_at &&
      !p.merged_into_person_id &&
      names(p).some((n) => entered.includes(n)),
  );
}
