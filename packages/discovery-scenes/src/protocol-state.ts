import type { ExpansionSceneState } from "./protocol-expansion-state";
import type { LandscapeState } from "./landscape/state";
/** Only bounded public model values cross the offline scene boundary. */
export type PizzaPlateState = { n: number; d: number; slices: number[] };
export type OfflineSceneState =
  | ExpansionSceneState
  | LandscapeState
  | { kind: "optics"; angle: number; reverse: boolean }
  | {
      kind: "pattern";
      sides: number;
      copies: number;
      rotation: number;
      reflected: boolean;
      view: "tiles" | "motif";
    }
  | {
      kind: "bridge";
      material: "timber" | "steel";
      braces: boolean[];
      load: number;
      position: number;
      utilization: number[];
      leftReaction: number;
      rightReaction: number;
    }
  | {
      kind: "sound";
      length: number;
      tension: number;
      amplitude: number;
      progress: number;
    }
  | {
      kind: "circuit";
      mode: "parallel" | "series";
      switches: boolean[];
      power: number[];
      current: number[];
      voltage: number;
    }
  | { kind: "pizza"; plates: PizzaPlateState[]; active: number }
  | {
      kind: "chance";
      chances: number[];
      die: boolean;
      last: number | null;
      selected: number;
    }
  | { kind: "moon"; angle: number }
  | { kind: "orbit"; points: { x: number; y: number }[]; progress: number }
  | {
      kind: "solar";
      selected: number;
      earthYears: number;
      mode: "orbits" | "sizes";
      angles: number[];
    }
  | {
      kind: "gravity";
      height: number;
      gravity: number;
      elapsed: number;
      mass: number;
      referenceGravity: number;
      referenceMass: number;
      distances: number[];
    }
  | { kind: "leaf"; light: number; water: number; carbon: number; rate: number }
  | {
      kind: "castle";
      moat: number;
      towers: boolean;
      gate: boolean;
      inner: boolean;
      approach: "bridge" | "north";
      sight: boolean;
      wallHeightMeters: number;
    };
export type OfflineSceneKind = OfflineSceneState["kind"];
