import { installLesson } from "../physical-lesson";
import { serializeExpansionScene } from "../shared/serialize-scene";
import { defaultMachineState, normalizeMachine, machineResult } from "./model";
import { createMachineScene } from "./machineScene";
import { experiments } from "./lessons";
const packageCrankDrumLabel = "Crank/drum r=0.20m";
installLesson({
  initial: defaultMachineState,
  normalize: normalizeMachine,
  build: createMachineScene,
  serialize: (scene, presentation) => {
    const serialized = serializeExpansionScene(scene, {
      ...presentation,
      showHeading: false,
    });
    return {
      ...serialized,
      labels: serialized.labels.map((label) =>
        label.text === "Crank + drum radii · 0.20 m"
          ? { ...label, text: packageCrankDrumLabel }
          : label,
      ),
    };
  },
  title: "Test the force–distance trade-off",
  introduction:
    "Predict first, change one ratio, then compare ideal input force, travel and energy for the same load and lift.",
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
    return `${s.mode} ideal lifting model: load mass ${r.loadMassKg} kg; weight ${r.loadWeightN.toFixed(1)} N using fixed gravity 9.81 N/kg. Ideal mechanical advantage ${r.ratio}. Ideal input force ${r.idealInputForceN.toFixed(1)} N through ${r.inputTravelM.toFixed(2)} m; lift ${s.liftM.toFixed(1)} m. Ideal input work ${r.idealInputWorkJ.toFixed(1)} J; gravitational energy gained ${r.gravitationalEnergyGainJ.toFixed(1)} J. ${s.mode === "gears" ? `Crank turns ${r.crankTurns.toFixed(2)}; input torque ${r.inputTorqueNm.toFixed(2)} N·m, output torque ${r.outputTorqueNm.toFixed(2)} N·m. Torque is a turning effect; work and energy are in J.` : ""} At zero lift, balancing still takes force but zero displacement means no lifting work.`;
  },
  note: "Ideal, slow-lifting model with fixed gravity 9.81 N/kg: it leaves out friction, stretching or bending parts, acceleration and the machine's own weight. Ideal efficiency is 100%, so ideal input work equals the load's gravitational energy gain. Real friction and flexing require extra input energy, so real efficiency is below 100%; this model cannot predict actual input force or efficiency. For the gear winch, the hand pushes at a right angle to the 0.20 m crank and the drum radius is 0.20 m. The ruler and every load use one scene unit per metre of vertical rise; lever effort travel follows the shown arm ratio. Not lifting-equipment guidance.",
});
