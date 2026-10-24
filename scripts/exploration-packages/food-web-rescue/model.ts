const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

/** Ideal string fundamental; fixed linear density of 0.001 kg/m. */
export function stringWave(
  lengthCm: number,
  tensionN: number,
  amplitudeMm: number,
) {
  const length = Math.max(0.01, lengthCm / 100);
  const frequency = Math.sqrt(Math.max(0, tensionN) / 0.001) / (2 * length);
  return {
    frequency,
    wavelength: frequency > 0 ? 343 / frequency : 0,
    // Energy comparison is at fixed frequency, string length, and tension.
    relativeEnergy: Math.max(0, amplitudeMm) ** 2,
  };
}

export type CircuitMode = "series" | "parallel";
/** Ideal battery, wires and switches; each house is a fixed 12-ohm resistor. */
export function circuit(
  mode: CircuitMode,
  voltage: number,
  switches: readonly boolean[],
) {
  const supply = Math.max(0, voltage);
  const closed = switches.every(Boolean) && switches.length > 0;
  const seriesCurrent = closed ? supply / (12 * switches.length) : 0;
  const houseCurrent = switches.map((on) =>
    mode === "series" ? seriesCurrent : on ? supply / 12 : 0,
  );
  const houseVoltage = houseCurrent.map((current) => current * 12);
  return {
    totalCurrent:
      mode === "series"
        ? seriesCurrent
        : houseCurrent.reduce((a, b) => a + b, 0),
    houseCurrent,
    houseVoltage,
    housePower: houseCurrent.map((current) => current ** 2 * 12),
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

/** One-hour storm on one hectare; empirical teaching coefficients, not a flood forecast. */
export function riverStorm(
  slopePercent: number,
  rainMm: number,
  vegetationPercent: number,
  availableSoil = 5000,
) {
  const vegetation = clamp(vegetationPercent) / 100;
  const slope = clamp(slopePercent, 0, 20) / 20;
  const rainVolume = Math.max(0, rainMm) * 10;
  const runoff = rainVolume * (0.8 - 0.55 * vegetation);
  const infiltration = rainVolume - runoff;
  const eroded = Math.min(
    Math.max(0, availableSoil),
    runoff * (0.1 + 0.9 * slope) * (1 - 0.85 * vegetation),
  );
  const exported = eroded * clamp(0.25 + 0.6 * slope - 0.2 * vegetation, 0, 1);
  return {
    rainVolume,
    runoff,
    infiltration,
    eroded,
    exported,
    deposited: eroded - exported,
    // 180 m³ passes within the channel during the modeled hour.
    floodVolume: Math.max(0, runoff - 180),
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
