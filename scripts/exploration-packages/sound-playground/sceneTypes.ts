import type { Group, Vector3 } from "three";
export type SoundSceneState = {
  kind: "sound";
  length: number;
  tension: number;
  amplitude: number;
  progress: number;
};
export type PhysicalSceneState = SoundSceneState;
export type PhysicalAction =
  | { type: "length"; value: number }
  | { type: "pluck" };
/** Pure Three scene model: no DOM, browser renderer, audio or application state. */
export interface PhysicalSceneModel {
  group: Group;
  view: {
    position: [number, number, number];
    target: [number, number, number];
    width: number;
    height: number;
  };
  update: (state: PhysicalSceneState) => void;
  labels?: () => { text: string; at: [number, number, number] }[];
  interact: (
    name: string,
    point: Vector3,
    dragging: boolean,
  ) => PhysicalAction | undefined;
  dispose: () => void;
}
