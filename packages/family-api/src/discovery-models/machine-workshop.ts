import {
  defaultMachineState,
  machineResult,
  type MachineState,
} from "./expansion-mechanics";

export type MachineWorkshopTrial = {
  id: "pulley-sections" | "gear-ratio";
  title: string;
  question: string;
  choices: readonly string[];
  correctChoice: string;
  controlled: string;
  before: MachineState;
  after: MachineState;
  change: string;
  changed: string;
  held: readonly string[];
  evidence: string;
  explain: string;
};

const held = [
  "40 kg load mass",
  "0.5 m lift height",
  "local gravity 9.81 m/s²",
] as const;

const pulleyBefore = { ...defaultMachineState, advantage: 1 } as const;
const pulleyAfter = { ...defaultMachineState, advantage: 2 } as const;
const gearBefore = {
  ...defaultMachineState,
  mode: "gears",
  advantage: 1,
} as const;
const gearAfter = {
  ...defaultMachineState,
  mode: "gears",
  advantage: 4,
} as const;

const pulleyOne = machineResult(pulleyBefore);
const pulleyTwo = machineResult(pulleyAfter);
const gearOne = machineResult(gearBefore);
const gearFour = machineResult(gearAfter);

export const machineWorkshopTrials: readonly MachineWorkshopTrial[] = [
  {
    id: "pulley-sections",
    title: "Pulley sections",
    question:
      "If two rope sections support the load instead of one, what happens to the ideal pulling force and rope travel?",
    choices: [
      "Less force, more rope",
      "Same force and rope",
      "More force, less rope",
    ],
    correctChoice: "Less force, more rope",
    controlled:
      "Start with one supporting section, then change only to two. Count rope sections lifting the moving load—not pulley wheels.",
    before: pulleyBefore,
    after: pulleyAfter,
    change: "Use two sections",
    changed: "supporting rope sections, 1 to 2",
    held,
    evidence: `Ideal pulling force falls from ${pulleyOne.idealInputForceN.toFixed(1)} N to ${pulleyTwo.idealInputForceN.toFixed(1)} N; rope travel rises from ${pulleyOne.inputTravelM.toFixed(1)} m to ${pulleyTwo.inputTravelM.toFixed(1)} m. Ideal input work and the load's gravitational energy gain are both ${pulleyTwo.gravitationalEnergyGainJ.toFixed(1)} J.`,
    explain:
      "The same energy transfer is spread across twice the input distance, so the ideal input force is half as large. Why does this not mean the machine created energy?",
  },
  {
    id: "gear-ratio",
    title: "Gear ratio",
    question:
      "With the 12-tooth driver fixed, what happens to crank turns and hand force at the crank when the driven gear changes from 12 to 48 teeth?",
    choices: [
      "More crank turns, less hand force",
      "Same turns and force",
      "Fewer crank turns, more hand force",
    ],
    correctChoice: "More crank turns, less hand force",
    controlled:
      "Start with 12 driven teeth, then change only to 48. The driver stays at 12 teeth; crank and drum radii stay 0.20 m.",
    before: gearBefore,
    after: gearAfter,
    change: "Use 48 driven teeth",
    changed: "driven gear teeth, 12 to 48 (ratio 1:1 to 4:1)",
    held: [...held, "12-tooth driver", "0.20 m crank and drum radii"],
    evidence: `Crank turns rise from ${gearOne.crankTurns.toFixed(2)} to ${gearFour.crankTurns.toFixed(2)}; ideal hand force at the crank falls from ${gearOne.idealInputForceN.toFixed(1)} N to ${gearFour.idealInputForceN.toFixed(1)} N; input torque falls from ${gearOne.inputTorqueNm.toFixed(2)} to ${gearFour.inputTorqueNm.toFixed(2)} N·m. Output torque stays ${gearFour.outputTorqueNm.toFixed(2)} N·m and ideal work stays ${gearFour.idealInputWorkJ.toFixed(1)} J.`,
    explain:
      "For the fixed load and drum, required output torque stays fixed. At 4:1, output torque is four times the input torque, so ideal input torque falls to one quarter while the driver makes four times as many turns for the same lift.",
  },
] as const;

export const machineWorkshopBoundary =
  "This is an ideal, slow-lifting model. Weight uses a fixed local gravitational field strength of 9.81 N/kg (equivalently 9.81 m/s²). The model leaves out friction, stretching or bending parts, acceleration and the machine's own weight. Its ideal efficiency is 100%, so ideal input work equals the load's gravitational energy gain. In a real machine, friction and flexing turn some input energy into thermal energy and sometimes sound. Real efficiency is below 100%, so this model cannot predict actual input force or efficiency. It is not lifting-equipment guidance.";
