import type { Group, Vector3 } from "three";
import type { BridgeMaterial, CircuitMode } from "./model";
export type BridgeSceneState = {
  kind: "bridge";
  material: BridgeMaterial;
  braces: boolean[];
  load: number;
  position: number;
  utilization: number[];
  leftReaction: number;
  rightReaction: number;
};
export type SoundSceneState = {
  kind: "sound";
  length: number;
  tension: number;
  amplitude: number;
  progress: number;
};
export type CircuitSceneState = {
  kind: "circuit";
  mode: CircuitMode;
  switches: boolean[];
  power: number[];
  current: number[];
  voltage: number;
};
export type PhysicalSceneState =
  | BridgeSceneState
  | SoundSceneState
  | CircuitSceneState;
export type PhysicalAction =
  | { type: "position" | "length"; value: number }
  | { type: "switch"; index: number }
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
