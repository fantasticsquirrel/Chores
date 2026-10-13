import type { FamilyTreeCommand } from "./family-tree-core";

// Managed assets have no public URL or server filesystem path.
export type FamilyTreeMediaRole = "primary" | "gallery" | "story";
export interface FamilyTreeMedia {
  id: number;
  mime_type: string;
  byte_size: number;
  checksum: string;
  width: number;
  height: number;
  caption: string | null;
  state: string;
}
export interface FamilyTreeMediaReference {
  id: number;
  asset_id: number;
  person_id: number;
  story_id: number | null;
  role: string;
  asset: FamilyTreeMedia;
}
export interface FamilyTreeAttachMediaRequest extends FamilyTreeCommand {
  person_id: number;
  story_id?: number | null;
  role?: FamilyTreeMediaRole;
}
