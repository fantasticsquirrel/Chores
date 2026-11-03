import { describe, expect, it } from "vitest";
import { machineResult } from "./expansion-mechanics";
import {
  machineWorkshopBoundary,
  machineWorkshopTrials,
} from "./machine-workshop";

describe("Machine Workshop controlled investigations", () => {
  it("changes only ideal mechanical advantage in both guided trials", () => {
    expect(machineWorkshopTrials).toHaveLength(2);
    for (const trial of machineWorkshopTrials) {
      const changedKeys = Object.keys(trial.before).filter(
        (key) =>
          trial.before[key as keyof typeof trial.before] !==
          trial.after[key as keyof typeof trial.after],
      );
      expect(changedKeys).toEqual(["advantage"]);
      expect(trial.held).toContain("40 kg load mass");
      expect(trial.held).toContain("0.5 m lift height");
      expect(trial.choices).toContain(trial.correctChoice);
      expect(trial.evidence).toContain("196.2 J");
    }
  });

  it("labels mass, weight, work and energy with consistent SI quantities", () => {
    const result = machineResult(machineWorkshopTrials[0].after);
    expect(result.loadMassKg).toBe(40);
    expect(result.loadWeightN).toBeCloseTo(392.4);
    expect(result.idealInputForceN).toBeCloseTo(196.2);
    expect(result.inputTravelM).toBeCloseTo(1);
    expect(result.idealInputWorkJ).toBeCloseTo(196.2);
    expect(result.gravitationalEnergyGainJ).toBeCloseTo(196.2);
    expect(result.idealEfficiencyPercent).toBe(100);
  });

  it("keeps ideal outputs separate from unknown real-machine losses", () => {
    expect(machineWorkshopBoundary).toContain("ideal");
    expect(machineWorkshopBoundary).toContain("friction");
    expect(machineWorkshopBoundary).toContain("efficiency");
    expect(machineWorkshopBoundary).toContain("cannot predict");
  });

  it("states the absolute gear result and compares output torque with input torque", () => {
    const trial = machineWorkshopTrials[1];
    const before = machineResult(trial.before);
    const after = machineResult(trial.after);
    expect(before.crankTurns).toBeCloseTo(0.397887);
    expect(after.crankTurns).toBeCloseTo(1.591549);
    expect(before.idealInputForceN).toBeCloseTo(392.4);
    expect(after.idealInputForceN).toBeCloseTo(98.1);
    expect(before.inputTorqueNm).toBeCloseTo(78.48);
    expect(after.inputTorqueNm).toBeCloseTo(19.62);
    expect(after.outputTorqueNm).toBeCloseTo(78.48);
    expect(after.idealInputWorkJ).toBeCloseTo(196.2);
    expect(trial.explain).toContain("four times the input torque");
    expect(trial.explain).toContain("required output torque stays fixed");
  });
});
