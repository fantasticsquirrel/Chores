import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  bridge,
  circuit,
} from "@family-manager/family-api/discovery-models/physical-world";
import {
  createBridgeScene,
  bridgeDeckSurface,
  truckAxleHeight,
  truckTireRadius,
  bridgeLoadX,
} from "./bridgeScene";
import { createCircuitScene } from "./circuitScene";
import { createSoundScene, stringEndX } from "./soundScene";
import type { BridgeSceneState, CircuitSceneState } from "./sceneTypes";
describe("pure physical exhibit models", () => {
  it("grounds both truck axles on the deck as the load moves", () => {
    const state: BridgeSceneState = {
      kind: "bridge",
      material: "timber",
      braces: [false, false, false, false],
      load: 10,
      position: 50,
      ...bridge("timber", [false, false, false, false], 10, 50),
    };
    const model = createBridgeScene(state);
    expect(truckAxleHeight - truckTireRadius).toBe(bridgeDeckSurface);
    model.update({ ...state, position: 15 });
    expect(model.group.getObjectByName("truck")?.position.x).toBe(
      bridgeLoadX(15),
    );
    expect(model.group.getObjectByName("truck")?.position.y).toBe(
      truckAxleHeight,
    );
    expect(model.interact("truck", new Vector3(4, 1.5, 0), true)).toEqual({
      type: "position",
      value: 90,
    });
    model.dispose();
  });
  it("keeps native-reusable string geometry tied to vibrating length", () => {
    const model = createSoundScene({
      kind: "sound",
      length: 60,
      tension: 80,
      amplitude: 3,
      progress: 0,
    });
    expect(stringEndX(60)).toBeCloseTo(0.2);
    expect(
      model.interact("length-bridge", new Vector3(5.2, 1.02, 0), true),
    ).toEqual({ type: "length", value: 120 });
    expect(model.interact("pluck", new Vector3(), false)).toEqual({
      type: "pluck",
    });
    model.update({
      kind: "sound",
      length: 120,
      tension: 80,
      amplitude: 0,
      progress: 0.5,
    });
    model.dispose();
  });
  it("maps all switch hits to the correct controlled branch", () => {
    const initial = circuit("parallel", 12, [true, false, true]);
    const state: CircuitSceneState = {
      kind: "circuit",
      mode: "parallel",
      switches: [true, false, true],
      voltage: 12,
      current: initial.houseCurrent,
      power: initial.housePower,
    };
    const model = createCircuitScene(state);
    expect(model.interact("switch-1", new Vector3(), false)).toEqual({
      type: "switch",
      index: 1,
    });
    expect(model.interact("", new Vector3(), false)).toBeUndefined();
    const off = circuit("series", 12, [true, false, true]);
    model.update({
      ...state,
      mode: "series",
      current: off.houseCurrent,
      power: off.housePower,
    });
    model.dispose();
  });
});
