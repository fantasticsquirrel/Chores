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
export type CircuitSwitches = readonly [boolean, boolean, boolean];
export type CircuitInputs = {
  mode: CircuitMode;
  sourceVoltageVolts: number;
  switches: CircuitSwitches;
};

export const CIRCUIT_HOUSE_RESISTANCE_OHMS = 12;
export const CIRCUIT_OBSERVATION_SECONDS = 10;
export const CIRCUIT_DEFAULT_INPUTS = {
  mode: "series",
  sourceVoltageVolts: 12,
  switches: [true, true, true],
} as const satisfies CircuitInputs;
export const CIRCUIT_SWITCH_COMPARISON = [
  {
    mode: "series",
    sourceVoltageVolts: 12,
    switches: [true, false, true],
  },
  {
    mode: "parallel",
    sourceVoltageVolts: 12,
    switches: [true, false, true],
  },
] as const satisfies readonly CircuitInputs[];
export const CIRCUIT_VOLTAGE_COMPARISON = [
  {
    mode: "parallel",
    sourceVoltageVolts: 6,
    switches: [true, true, true],
  },
  {
    mode: "parallel",
    sourceVoltageVolts: 12,
    switches: [true, true, true],
  },
] as const satisfies readonly CircuitInputs[];

function boundedVoltage(value: number) {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(18, value))
    : CIRCUIT_DEFAULT_INPUTS.sourceVoltageVolts;
}

export function normalizeCircuitInputs(inputs: CircuitInputs): CircuitInputs {
  const switches =
    Array.isArray(inputs.switches) && inputs.switches.length === 3
      ? ([
          inputs.switches[0] === true,
          inputs.switches[1] === true,
          inputs.switches[2] === true,
        ] as const)
      : CIRCUIT_DEFAULT_INPUTS.switches;
  return {
    mode:
      inputs.mode === "series" || inputs.mode === "parallel"
        ? inputs.mode
        : CIRCUIT_DEFAULT_INPUTS.mode,
    sourceVoltageVolts: boundedVoltage(inputs.sourceVoltageVolts),
    switches,
  };
}

/** Exact ideal-DC model: fixed 12 Ω loads, ideal source, zero-resistance wires. */
export function circuitActivity(rawInputs: CircuitInputs) {
  const inputs = normalizeCircuitInputs(rawInputs);
  const allClosed = inputs.switches.every(Boolean);
  const closedBranchCount = inputs.switches.filter(Boolean).length;
  const seriesCurrentAmperes = allClosed
    ? inputs.sourceVoltageVolts /
      (CIRCUIT_HOUSE_RESISTANCE_OHMS * inputs.switches.length)
    : 0;
  const houseCurrentAmperes = inputs.switches.map((closed) =>
    inputs.mode === "series"
      ? seriesCurrentAmperes
      : closed
        ? inputs.sourceVoltageVolts / CIRCUIT_HOUSE_RESISTANCE_OHMS
        : 0,
  ) as [number, number, number];
  const houseVoltageVolts = houseCurrentAmperes.map(
    (current) => current * CIRCUIT_HOUSE_RESISTANCE_OHMS,
  ) as [number, number, number];
  const housePowerWatts = houseCurrentAmperes.map(
    (current, index) => current * houseVoltageVolts[index],
  ) as [number, number, number];
  const totalCurrentAmperes =
    inputs.mode === "series"
      ? seriesCurrentAmperes
      : houseCurrentAmperes.reduce((sum, value) => sum + value, 0);
  const sourcePowerWatts = inputs.sourceVoltageVolts * totalCurrentAmperes;
  const sourceChargeCoulombs =
    totalCurrentAmperes * CIRCUIT_OBSERVATION_SECONDS;
  const houseChargeCoulombs = houseCurrentAmperes.map(
    (current) => current * CIRCUIT_OBSERVATION_SECONDS,
  ) as [number, number, number];
  const houseEnergyJoules = housePowerWatts.map(
    (power) => power * CIRCUIT_OBSERVATION_SECONDS,
  ) as [number, number, number];
  return {
    ...inputs,
    resistancePerHouseOhms: CIRCUIT_HOUSE_RESISTANCE_OHMS,
    observationSeconds: CIRCUIT_OBSERVATION_SECONDS,
    completePath: inputs.mode === "series" ? allClosed : closedBranchCount > 0,
    equivalentResistanceOhms:
      inputs.mode === "series"
        ? allClosed
          ? CIRCUIT_HOUSE_RESISTANCE_OHMS * inputs.switches.length
          : null
        : closedBranchCount > 0
          ? CIRCUIT_HOUSE_RESISTANCE_OHMS / closedBranchCount
          : null,
    totalCurrentAmperes,
    houseCurrentAmperes,
    houseVoltageVolts,
    housePowerWatts,
    sourcePowerWatts,
    sourceChargeCoulombs,
    returnedChargeCoulombs: sourceChargeCoulombs,
    houseChargeCoulombs,
    sourceEnergyJoules: sourcePowerWatts * CIRCUIT_OBSERVATION_SECONDS,
    houseEnergyJoules,
  };
}

export function circuitStateAtPhase(inputs: CircuitInputs, rawPhase: number) {
  const finitePhase = Number.isFinite(rawPhase) ? rawPhase : 0;
  return {
    ...circuitActivity(inputs),
    visualPhase: ((finitePhase % 1) + 1) % 1,
  };
}

export function compareCircuitTrials(
  first: CircuitInputs,
  second: CircuitInputs,
) {
  const a = normalizeCircuitInputs(first);
  const b = normalizeCircuitInputs(second);
  const changed: string[] = [];
  if (a.mode !== b.mode) changed.push("wiring arrangement");
  if (a.sourceVoltageVolts !== b.sourceVoltageVolts)
    changed.push("source voltage");
  if (a.switches.some((value, index) => value !== b.switches[index]))
    changed.push("switch state");
  const held: string[] = [];
  if (a.mode === b.mode) held.push(`${a.mode} wiring`);
  if (a.sourceVoltageVolts === b.sourceVoltageVolts)
    held.push(`${a.sourceVoltageVolts} V ideal source`);
  held.push("three fixed 12 Ω resistors");
  if (a.switches.every((value, index) => value === b.switches[index])) {
    const open = a.switches
      .map((closed, index) => (!closed ? index + 1 : null))
      .filter((value): value is number => value !== null);
    if (open.length === 0) held.push("all switches closed");
    else {
      for (const index of open) held.push(`house ${index} switch open`);
      const closed = a.switches
        .map((value, index) => (value ? index + 1 : null))
        .filter((value): value is number => value !== null);
      if (closed.length > 0)
        held.push(`houses ${closed.join(" and ")} switches closed`);
    }
  }
  held.push(`${CIRCUIT_OBSERVATION_SECONDS} s observation interval`);
  return { changed, held };
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
