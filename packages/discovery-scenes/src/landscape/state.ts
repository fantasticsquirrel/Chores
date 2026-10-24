export type RiverSceneState = {
  kind: "river";
  slope: number;
  rain: number;
  vegetation: number;
  runoff: number;
  infiltration: number;
  eroded: number;
  flood: number;
  deposited: number;
  soil: number;
};
export type PondSceneState = {
  kind: "pond";
  algae: number;
  zooplankton: number;
  fish: number;
  oxygen: number;
  drought: number;
  nutrients: number;
};
export type CaravanSceneState = {
  kind: "caravan";
  route: "ridge" | "river" | "oasis";
  season: "wet" | "dry";
  cargo: "grain" | "cloth" | "pottery";
  units: number;
  supplies: number;
  days: number;
  load: number;
};
export type GardenSceneState = {
  kind: "garden";
  x: number;
  y: number;
  reach: number;
  habitat: boolean;
  pollen: "none" | "gold" | "violet";
  received: number[];
  path: { x: number; y: number }[];
};
export type LandscapeState =
  | RiverSceneState
  | PondSceneState
  | CaravanSceneState
  | GardenSceneState;
export type LandscapeKind = LandscapeState["kind"];
export type SceneLabel = { text: string; x: number; y: number; z: number };
