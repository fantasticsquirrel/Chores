import type { Group, Raycaster } from "three";
export type ExpansionLabel = { text: string; at: [number, number, number] };
export type ExpansionScene<S> = {
  group: Group;
  view: {
    position: [number, number, number];
    target: [number, number, number];
    width: number;
    height: number;
  };
  update: (state: S) => void;
  labels: () => ExpansionLabel[];
  pick?: (ray: Raycaster) => number | null;
  dispose: () => void;
};
