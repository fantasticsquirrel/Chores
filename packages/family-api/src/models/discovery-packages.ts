import type { DiscoveryExploration } from "./discovery-lab";
export type DiscoveryPackageRuntime = "declarative-v1" | "worker-v1";
export type DiscoveryPackageSummary = {
  package_id: string;
  version: string;
  runtime: DiscoveryPackageRuntime;
  checksum: string;
  published: boolean;
  created_at: string;
};
export type DiscoverySceneControl = {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  unit: string;
};
export type DiscoveryPackageManifest = {
  schema_version: 1;
  package_id: string;
  version: string;
  runtime: DiscoveryPackageRuntime;
  exploration: DiscoveryExploration;
  entry?: string;
  scene?: {
    kind: "proportional" | "inverse" | "linear";
    controls: DiscoverySceneControl[];
    output: { label: string; unit: string };
    coefficient?: number;
    intercept?: number;
  };
  assets: { path: string; mime_type: string; sha256: string }[];
};
export type DiscoveryPackagePayload = {
  manifest: DiscoveryPackageManifest;
  assets: {
    path: string;
    mime_type: string;
    sha256: string;
    content_base64: string;
  }[];
  checksum: string;
};
