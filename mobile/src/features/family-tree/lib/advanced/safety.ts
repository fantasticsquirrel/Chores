import type { BinaryDownload } from "@family-manager/family-api/client-core";
import type {
  FamilyTreeJob,
  FamilyTreePerson,
} from "@family-manager/family-api/models";
export const IMAGE_LIMIT = 10 * 1024 * 1024;
export const PACKAGE_LIMIT = 100 * 1024 * 1024;
export const EXPORT_LIMIT = 250 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export function validateJob(
  job: FamilyTreeJob,
  kind: string,
  revision?: number,
): boolean {
  return (
    Number.isSafeInteger(job.id) &&
    job.id > 0 &&
    job.kind === kind &&
    job.state === "ready" &&
    Number.isFinite(Date.parse(job.expires_at)) &&
    Date.parse(job.expires_at) > Date.now() &&
    (revision === undefined || job.expected_graph_revision === revision)
  );
}
export function imageDataUri(download: BinaryDownload): string {
  const { bytes, content_type } = download;
  if (
    !IMAGE_TYPES.includes(content_type) ||
    !bytes.byteLength ||
    bytes.byteLength > IMAGE_LIMIT
  )
    throw new Error("Unsupported or oversized photograph.");
  const data = new Uint8Array(bytes),
    alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const chunks: string[] = [];
  for (let start = 0; start < data.length; start += 12288) {
    let chunk = "";
    for (let i = start; i < Math.min(start + 12288, data.length); i += 3) {
      const a = data[i],
        b = data[i + 1],
        c = data[i + 2];
      chunk +=
        alphabet[a >> 2] +
        alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)] +
        (b === undefined ? "=" : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]) +
        (c === undefined ? "=" : alphabet[c & 63]);
    }
    chunks.push(chunk);
  }
  return `data:${content_type};base64,${chunks.join("")}`;
}
function names(p: FamilyTreePerson): string[] {
  return [
    p.display_name,
    [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" "),
    ...p.aliases.map((a) => a.name),
  ]
    .filter((x): x is string => !!x?.trim())
    .map((x) => x.trim().toLocaleLowerCase());
}
export function duplicateSuggestions(
  person: FamilyTreePerson,
  available: FamilyTreePerson[],
): FamilyTreePerson[] {
  const own = names(person);
  return available
    .slice(0, 300)
    .filter(
      (p) =>
        p.id !== person.id &&
        !p.merged_into_person_id &&
        !p.archived_at &&
        names(p).some((n) => own.includes(n)),
    )
    .slice(0, 20);
}
