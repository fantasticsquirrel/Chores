import { soundActivity } from "./sound";
import { riverActivity } from "./river";
import { circuitActivity, type CircuitMode } from "./circuit";

export type { CircuitMode } from "./circuit";

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

/** Ideal string fundamental; fixed linear density of 0.001 kg/m. */
export function stringWave(
  lengthCm: number,
  tensionN: number,
  amplitudeMm: number,
) {
  const activity = soundActivity({ lengthCm, tensionN, amplitudeMm });
  return {
    frequency: activity.fundamentalFrequencyHz,
    wavelength: activity.airWavelengthMeters,
    // Energy comparison is at fixed frequency, string length, and tension.
    relativeEnergy: activity.relativeVibrationIndex,
  };
}

/** Compatibility wrapper for the dedicated Circuit City ideal-resistor model. */
export function circuit(
  mode: CircuitMode,
  voltage: number,
  switches: readonly boolean[],
) {
  const result = circuitActivity({
    mode,
    sourceVoltageVolts: voltage,
    switches: [
      switches[0] === true,
      switches[1] === true,
      switches[2] === true,
    ],
  });
  return {
    totalCurrent: result.totalCurrentAmperes,
    houseCurrent: result.houseCurrentAmperes,
    houseVoltage: result.houseVoltageVolts,
    housePower: result.housePowerWatts,
  };
}

export type BridgeMaterial = "timber" | "steel";
/** Static simply-supported beam moments; capacities/bracing and costs are illustrative. */
export function bridge(
  material: BridgeMaterial,
  braces: readonly boolean[],
  loadKN: number,
  positionPercent: number,
) {
  const span = 10;
  const position = (clamp(positionPercent) / 100) * span;
  const load = Math.max(0, loadKN);
  const leftReaction = (load * (span - position)) / span;
  const rightReaction = (load * position) / span;
  const moment = (x: number) =>
    leftReaction * x - load * Math.max(0, x - position);
  const capacity = material === "steel" ? 45 : 16;
  const utilization = Array.from({ length: 4 }, (_, index) => {
    const start = index * 2.5,
      end = start + 2.5;
    const zoneMoment = Math.max(
      moment(start),
      moment(end),
      position >= start && position <= end ? moment(position) : 0,
    );
    return zoneMoment / (capacity * (braces[index] ? 2.4 : 1));
  });
  return {
    leftReaction,
    rightReaction,
    maxMoment: moment(position),
    utilization,
    maxUtilization: Math.max(...utilization),
    cost:
      (material === "steel" ? 240 : 80) +
      braces.filter(Boolean).length * (material === "steel" ? 80 : 35),
  };
}

/** Compatibility wrapper for the dedicated River Sculptor teaching model. */
export function riverStorm(
  slopePercent: number,
  rainMm: number,
  vegetationPercent: number,
  availableSoil = 5000,
) {
  const result = riverActivity(
    {
      catchmentSlopePercent: slopePercent,
      rainfallMillimeters: rainMm,
      vegetationCoverPercent: vegetationPercent,
    },
    availableSoil,
  );
  return {
    rainVolume: result.rainfallVolumeCubicMeters,
    runoff: result.runoffCubicMeters,
    infiltration: result.infiltrationCubicMeters,
    eroded: result.soilMovedKilograms,
    exported: result.exportedKilograms,
    deposited: result.depositedKilograms,
    floodVolume: result.channelCapacityExcessCubicMeters,
  };
}

export interface PondState {
  algae: number;
  zooplankton: number;
  fish: number;
  oxygen: number;
}
export interface PondConditions {
  nutrients: number;
  drought: number;
}
export const initialPond: PondState = {
  algae: 45,
  zooplankton: 35,
  fish: 20,
  oxygen: 80,
};
/** Bounded food-web indices; one step is an illustrative week, not a field prediction. */
export function pondWeek(
  state: PondState,
  conditions: PondConditions,
): PondState {
  let { algae, zooplankton, fish, oxygen } = state;
  const nutrients = clamp(conditions.nutrients),
    drought = clamp(conditions.drought);
  const capacity = 20 + nutrients * 0.8;
  for (let i = 0; i < 10; i++) {
    const grazing = (0.018 * algae * zooplankton) / (1 + algae / 35);
    const predation = (0.012 * zooplankton * fish) / (1 + zooplankton / 35);
    const oxygenTarget = clamp(100 - 0.65 * algae - 0.5 * drought);
    const oxygenStress = Math.max(0, 40 - oxygen) / 100;
    algae = clamp(
      algae +
        0.1 *
          (0.5 * algae * (1 - algae / capacity) -
            grazing -
            drought * 0.0007 * algae),
    );
    zooplankton = clamp(
      zooplankton +
        0.1 *
          (0.4 * grazing - predation - (0.025 + oxygenStress) * zooplankton),
    );
    fish = clamp(
      fish + 0.1 * (0.3 * predation - (0.035 + oxygenStress * 1.7) * fish),
    );
    oxygen = clamp(oxygen + 0.1 * (oxygenTarget - oxygen) * 0.8);
  }
  return { algae, zooplankton, fish, oxygen };
}
