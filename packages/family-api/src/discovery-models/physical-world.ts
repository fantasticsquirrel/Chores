import { soundActivity } from "./sound";
import { riverActivity } from "./river";
import { circuitActivity, type CircuitMode } from "./circuit";

export type { CircuitMode } from "./circuit";
export { initialPond, pondWeek } from "./pond";
export type { PondConditions, PondState } from "./pond";

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
