import { installLesson } from "../physical-lesson";
import { defaultMachineState, normalizeMachine, machineResult } from "./model";
import { createMachineScene } from "./machineScene";
import { experiments } from "./lessons";
installLesson({
  initial: defaultMachineState,
  normalize: normalizeMachine,
  build: createMachineScene,
  title: "Can less force lift the same load?",
  introduction:
    "Compare a pulley, lever and gear-driven winch. Less effort force trades for more effort distance.",
  drag: true,
  fields: [
    {
      id: "mode",
      label: "Machine type",
      options: ["pulley", "lever", "gears"],
      labels: ["Pulley", "Lever", "Gear winch"],
    },
    {
      id: "advantage",
      label:
        "Mechanical advantage: supporting sections / effort arm ratio / driven-to-driver teeth ratio",
      min: 1,
      max: 4,
    },
    { id: "loadKg", label: "Load mass (kg)", min: 10, max: 100, step: 10 },
    { id: "liftM", label: "Lift height (m)", min: 0, max: 1, step: 0.1 },
  ],
  trials: experiments,
  select: (s, v) => ({ ...s, liftM: v }),
  describe: (s) => {
    const r = machineResult(s);
    return `${s.mode}: load ${s.loadKg} kg weighs ${r.loadForceN.toFixed(1)} N. Advantage ${r.ratio}. Effort ${r.inputForceN.toFixed(1)} N through ${r.inputDistanceM.toFixed(2)} m; lift ${s.liftM.toFixed(1)} m. Input work ${r.inputWorkJ.toFixed(1)} J; output work ${r.outputWorkJ.toFixed(1)} J. ${s.mode === "gears" ? `Crank turns ${r.crankTurns.toFixed(2)}; input torque ${r.inputTorqueNm.toFixed(2)} N·m, output torque ${r.outputTorqueNm.toFixed(2)} N·m.` : ""} At zero lift, balancing still takes force but no displacement means no lifting work.`;
  },
  note: "Ideal, slow lifting: no friction, rope stretch or machine mass. Real machines need extra input work. Work is force × distance in the force direction. Gear torque = force × radius; crank and drum radii are both 0.2 m. Lever arms and travel are reduced drawing scale. The machine changes effort, not load weight. Not a lifting-equipment design.",
});
