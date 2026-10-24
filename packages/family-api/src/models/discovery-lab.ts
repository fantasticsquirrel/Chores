/** Public educational content, never user-generated child data. */
export type DiscoveryExploration = {
  package?: {
    version: string;
    runtime: "declarative-v1" | "worker-v1" | "worker-3d-v1" | "worker-rich-v1";
    checksum: string;
  };
  id: string;
  title: string;
  summary: string;
  subject: string;
  grade_bands: string[];
  tags: string[];
  duration_minutes: number;
  question: string;
  explanation: string;
  experiments: { title: string; instruction: string; observe: string }[];
  misconception: string;
  sources: { title: string; url: string }[];
};
export type DiscoveryFilters = {
  child_id?: number;
  q?: string;
  subject?: string;
  grade_band?: string;
  tag?: string;
};
export type DiscoveryChild = { id: number; name: string; active: boolean };
export type DiscoveryChildAccess = {
  child_id: number;
  default_enabled: boolean;
  explorations: (DiscoveryExploration & {
    enabled: boolean;
    override: boolean | null;
  })[];
};
export type DiscoveryAccessUpdate = {
  enabled: boolean;
  package_versions?: Record<string, string>;
  exploration_ids?: string[];
  subject?: string;
  grade_band?: string;
  tag?: string;
};
