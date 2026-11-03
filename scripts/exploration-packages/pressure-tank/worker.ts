import { installLesson } from "../physical-lesson";
import { serializeExpansionScene } from "../shared/serialize-scene";
import {
  defaultPressureState,
  normalizePressure,
  pressureResult,
  pressureTankBoundary,
} from "./model";
import { createPressureScene } from "./pressureScene";
import { experiments } from "./lessons";
installLesson({
  initial: defaultPressureState,
  normalize: normalizePressure,
  build: createPressureScene,
  serialize: (scene, presentation) =>
    serializeExpansionScene(scene, { ...presentation, showHeading: false }),
  title: "Test pressure on a wall sensor",
  introduction:
    "The closed sensor and separate nozzle share a height. Predict first, change one input, then compare pressure and the free jet.",
  drag: true,
  fields: [
    {
      id: "shape",
      label: "Tank shape",
      options: ["narrow", "wide", "tapered"],
    },
    {
      id: "depthM",
      label: "Water surface height (m)",
      min: 0.2,
      max: 3,
      step: 0.1,
    },
    {
      id: "outletM",
      label: "Outlet height above floor (m)",
      min: 0.1,
      max: 2.5,
      step: 0.1,
    },
  ],
  trials: experiments,
  select: (s, v) => ({ ...s, depthM: v }),
  describe: (s) => {
    const r = pressureResult(s);
    return `${s.shape} tank. Surface ${s.depthM.toFixed(1)} m and outlet ${s.outletM.toFixed(1)} m above the floor give ${r.headM.toFixed(1)} m head. The separate closed wall sensor at that height has calculated gauge pressure ${(r.gaugePressurePa / 1_000).toFixed(3)} kPa and absolute pressure ${(r.absolutePressurePa / 1_000).toFixed(3)} kPa. Its net force is ${r.sensorNetForceN.toFixed(2)} N on 100 cm² because its back face is exposed to atmosphere. A dark insulated electrical cable carries its signal to the remote display; it is not a liquid pressure line. Ideal outlet speed ${r.jetSpeedMps.toFixed(2)} m/s. Volume ${r.volumeLiters.toFixed(0)} L. ${r.outletSubmerged ? `Horizontal range to floor level ${r.rangeM.toFixed(2)} m; outlet height sets fall time while head sets speed.` : "The sensor and outlet are at or above the surface: no outward water jet, positive water gauge pressure or sensor net force."} The nozzle is separate from the wall sensor; its emerging free jet is approximately atmospheric.`;
  },
  vector: (s) => {
    const r = pressureResult(s);
    return {
      viewBox: [0, 0, 400, 92],
      description: `Head ${r.headM.toFixed(1)} metres. Wall-sensor gauge pressure ${(r.gaugePressurePa / 1_000).toFixed(3)} kilopascals, absolute pressure ${(r.absolutePressurePa / 1_000).toFixed(3)} kilopascals, sensor net force ${r.sensorNetForceN.toFixed(2)} newtons and ideal jet speed ${r.jetSpeedMps.toFixed(2)} metres per second. Exact values do not depend on color.`,
      nodes: [
        {
          tag: "text",
          attrs: { x: 10, y: 20, fill: "#18332c", fontSize: 14 },
          children: [
            `h ${r.headM.toFixed(1)} m → gauge ${(r.gaugePressurePa / 1_000).toFixed(3)} kPa → net ${r.sensorNetForceN.toFixed(2)} N on 100 cm²`,
          ],
        },
        {
          tag: "rect",
          attrs: {
            x: 10,
            y: 34,
            width: Math.min(380, (r.gaugePressurePa / 30_000) * 380),
            height: 20,
            fill: "#3b7880",
          },
          children: [],
        },
        {
          tag: "text",
          attrs: { x: 10, y: 78, fill: "#18332c", fontSize: 13 },
          children: [
            `Ideal speed ${r.jetSpeedMps.toFixed(2)} m/s · range ${r.rangeM.toFixed(2)} m · volume ${r.volumeLiters.toFixed(0)} L`,
          ],
        },
      ],
    };
  },
  note: pressureTankBoundary,
});
