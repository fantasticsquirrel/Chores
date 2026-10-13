import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { FamilyTreePortableAlias } from "../src/models/family-tree";
export interface ProducerRecord {
  name: string;
  method: string;
  path: string;
  args: number[];
  body: unknown;
  schema: string | null;
  response_model: string | null;
  status: number;
  headers: Record<string, string>;
  response?: unknown;
  binary?: string;
  multipart?: {
    fields: Record<string, string>;
    files: Record<string, { filename: string; base64: string; type: string }>;
  };
}
export const familyTreeProducer = JSON.parse(
  execFileSync(
    process.env.FAMILY_TREE_CONTRACT_PYTHON ?? "python3",
    [fileURLToPath(new URL("./family_tree_producer.py", import.meta.url))],
    { encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
  ),
) as {
  records: ProducerRecord[];
  manifest: unknown;
  alias_history: Record<"original" | "imported" | "merged", FamilyTreePortableAlias[]>;
};
