import { installLesson } from "../physical-lesson";
import {
  defaultPressureState,
  normalizePressure,
  pressureResult,
} from "./model";
import { createPressureScene } from "./pressureScene";
import { experiments } from "./lessons";
installLesson({
  initial: defaultPressureState,
  normalize: normalizePressure,
  build: createPressureScene,
  title: "Does depth or water volume set the pressure?",
  introduction:
    "Compare the vertical distance from the water surface to the outlet in different tanks.",
  drag: true,
  fields: [
    {
      id: "shape",
      label: "Tank shape",
      options: ["narrow", "wide", "tapered"],
    },
    {
      id: "depthM",
      label: "Water surface height above floor (m)",
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
    return `${s.shape} tank. Head ${r.headM.toFixed(1)} m: surface ${s.depthM.toFixed(1)} m minus outlet ${s.outletM.toFixed(1)} m when submerged. Static tank gauge pressure ${(r.pressurePa / 1000).toFixed(3)} kPa; ideal outlet speed ${r.jetSpeedMps.toFixed(2)} m/s. Volume ${r.volumeLiters.toFixed(0)} L. ${r.headM > 0 ? `Horizontal range to floor ${r.rangeM.toFixed(2)} m. Lower outlets have more head but less falling time.` : "Outlet is at or above surface: no outward water jet or positive water gauge pressure."} Gauge pressure is above surrounding air pressure; the emerging free jet is approximately atmospheric.`;
  },
  note: "Open tanks, small horizontal outlet, incompressible water. Static gauge pressure = 1000 kg/m³ × 9.81 m/s² × head. Speed = √(2 × 9.81 × head). Each view is instantaneous with fixed level, not timed draining. Friction, viscosity, turbulence, air drag and outlet contraction omitted. Shape changes volume and future draining, not static pressure at equal head.",
});
