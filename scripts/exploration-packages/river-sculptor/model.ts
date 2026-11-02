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

export type RiverInputs = {
  catchmentSlopePercent: number;
  rainfallMillimeters: number;
  vegetationCoverPercent: number;
};

export type RiverLedger = {
  stormCount: number;
  soilRemainingKilograms: number;
  depositedKilograms: number;
  exportedKilograms: number;
};

export const RIVER_CATCHMENT_HECTARES = 1;
export const RIVER_STORM_DURATION_HOURS = 1;
export const RIVER_CHANNEL_CAPACITY_CUBIC_METERS_PER_HOUR = 180;
export const RIVER_STARTING_SOIL_KILOGRAMS = 5_000;

export const RIVER_DEFAULT_INPUTS = {
  catchmentSlopePercent: 8,
  rainfallMillimeters: 40,
  vegetationCoverPercent: 40,
} as const satisfies RiverInputs;

export const RIVER_INITIAL_LEDGER = {
  stormCount: 0,
  soilRemainingKilograms: RIVER_STARTING_SOIL_KILOGRAMS,
  depositedKilograms: 0,
  exportedKilograms: 0,
} as const satisfies RiverLedger;

export const RIVER_VEGETATION_COMPARISON = [
  { ...RIVER_DEFAULT_INPUTS, vegetationCoverPercent: 0 },
  { ...RIVER_DEFAULT_INPUTS, vegetationCoverPercent: 100 },
] as const satisfies readonly RiverInputs[];

export const RIVER_SLOPE_COMPARISON = [
  {
    ...RIVER_DEFAULT_INPUTS,
    catchmentSlopePercent: 2,
    vegetationCoverPercent: 40,
  },
  {
    ...RIVER_DEFAULT_INPUTS,
    catchmentSlopePercent: 20,
    vegetationCoverPercent: 40,
  },
] as const satisfies readonly RiverInputs[];

function bounded(
  value: number,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;
}

export function normalizeRiverInputs(inputs: RiverInputs): RiverInputs {
  return {
    catchmentSlopePercent: bounded(
      inputs.catchmentSlopePercent,
      0,
      20,
      RIVER_DEFAULT_INPUTS.catchmentSlopePercent,
    ),
    rainfallMillimeters: bounded(
      inputs.rainfallMillimeters,
      0,
      100,
      RIVER_DEFAULT_INPUTS.rainfallMillimeters,
    ),
    vegetationCoverPercent: bounded(
      inputs.vegetationCoverPercent,
      0,
      100,
      RIVER_DEFAULT_INPUTS.vegetationCoverPercent,
    ),
  };
}

/** Exact package mirror of the shared one-hour, one-hectare teaching model. */
export function riverActivity(
  rawInputs: RiverInputs,
  rawAvailableSoilKilograms = RIVER_STARTING_SOIL_KILOGRAMS,
) {
  const inputs = normalizeRiverInputs(rawInputs);
  const availableSoilKilograms = bounded(
    rawAvailableSoilKilograms,
    0,
    RIVER_STARTING_SOIL_KILOGRAMS,
    RIVER_STARTING_SOIL_KILOGRAMS,
  );
  const vegetationFraction = inputs.vegetationCoverPercent / 100;
  const normalizedSlope = inputs.catchmentSlopePercent / 20;
  const rainfallVolumeCubicMeters = inputs.rainfallMillimeters * 10;
  const runoffFraction = 0.8 - 0.55 * vegetationFraction;
  const runoffCubicMeters = rainfallVolumeCubicMeters * runoffFraction;
  const infiltrationCubicMeters = rainfallVolumeCubicMeters - runoffCubicMeters;
  const soilMovedKilograms = Math.min(
    availableSoilKilograms,
    runoffCubicMeters *
      (0.1 + 0.9 * normalizedSlope) *
      (1 - 0.85 * vegetationFraction),
  );
  const exportFraction = bounded(
    0.25 + 0.6 * normalizedSlope - 0.2 * vegetationFraction,
    0,
    1,
    0,
  );
  const exportedKilograms = soilMovedKilograms * exportFraction;
  const depositedKilograms = soilMovedKilograms - exportedKilograms;
  return {
    catchmentSlopePercent: inputs.catchmentSlopePercent,
    rainfallMillimeters: inputs.rainfallMillimeters,
    vegetationCoverPercent: inputs.vegetationCoverPercent,
    availableSoilKilograms,
    rainfallVolumeCubicMeters,
    runoffFraction,
    runoffCubicMeters,
    infiltrationCubicMeters,
    soilMovedKilograms,
    exportFraction,
    exportedKilograms,
    depositedKilograms,
    channelCapacityExcessCubicMeters: Math.max(
      0,
      runoffCubicMeters -
        RIVER_CHANNEL_CAPACITY_CUBIC_METERS_PER_HOUR *
          RIVER_STORM_DURATION_HOURS,
    ),
  };
}

export function riverStateAtPhase(
  inputs: RiverInputs,
  rawPhase: number,
  availableSoilKilograms = RIVER_STARTING_SOIL_KILOGRAMS,
) {
  const activity = riverActivity(inputs, availableSoilKilograms);
  const finitePhase = Number.isFinite(rawPhase) ? rawPhase : 0;
  return {
    ...activity,
    visualPhase: ((finitePhase % 1) + 1) % 1,
  };
}

function normalizeRiverLedger(ledger: RiverLedger): RiverLedger {
  const soilRemainingKilograms = bounded(
    ledger.soilRemainingKilograms,
    0,
    RIVER_STARTING_SOIL_KILOGRAMS,
    RIVER_STARTING_SOIL_KILOGRAMS,
  );
  const accountedKilograms =
    RIVER_STARTING_SOIL_KILOGRAMS - soilRemainingKilograms;
  const rawDeposited = bounded(
    ledger.depositedKilograms,
    0,
    RIVER_STARTING_SOIL_KILOGRAMS,
    0,
  );
  const rawExported = bounded(
    ledger.exportedKilograms,
    0,
    RIVER_STARTING_SOIL_KILOGRAMS,
    0,
  );
  const rawAccounted = rawDeposited + rawExported;
  const depositedKilograms =
    rawAccounted > 0
      ? (rawDeposited / rawAccounted) * accountedKilograms
      : accountedKilograms;
  return {
    stormCount: Math.max(
      0,
      Math.floor(Number.isFinite(ledger.stormCount) ? ledger.stormCount : 0),
    ),
    soilRemainingKilograms,
    depositedKilograms,
    exportedKilograms: accountedKilograms - depositedKilograms,
  };
}

export function applyRiverStorm(inputs: RiverInputs, rawLedger: RiverLedger) {
  const ledger = normalizeRiverLedger(rawLedger);
  const result = riverActivity(inputs, ledger.soilRemainingKilograms);
  return {
    stormCount: ledger.stormCount + 1,
    soilRemainingKilograms:
      ledger.soilRemainingKilograms - result.soilMovedKilograms,
    depositedKilograms: ledger.depositedKilograms + result.depositedKilograms,
    exportedKilograms: ledger.exportedKilograms + result.exportedKilograms,
  } satisfies RiverLedger;
}

export function compareRiverTrials(first: RiverInputs, second: RiverInputs) {
  const a = normalizeRiverInputs(first);
  const b = normalizeRiverInputs(second);
  const changed: string[] = [];
  if (a.catchmentSlopePercent !== b.catchmentSlopePercent)
    changed.push("catchment slope");
  if (a.rainfallMillimeters !== b.rainfallMillimeters) changed.push("rainfall");
  if (a.vegetationCoverPercent !== b.vegetationCoverPercent)
    changed.push("vegetation cover");
  const held: string[] = [];
  if (a.catchmentSlopePercent === b.catchmentSlopePercent)
    held.push(`${a.catchmentSlopePercent}% catchment slope`);
  if (a.rainfallMillimeters === b.rainfallMillimeters)
    held.push(`${a.rainfallMillimeters} mm rainfall in one hour`);
  if (a.vegetationCoverPercent === b.vegetationCoverPercent)
    held.push(`${a.vegetationCoverPercent}% vegetation cover`);
  held.push(`${RIVER_CATCHMENT_HECTARES} hectare catchment`);
  held.push("5,000 kg starting soil");
  return { changed, held };
}

/** Compatibility wrapper retained for older package tests. */
export function riverStorm(
  slopePercent: number,
  rainMm: number,
  vegetationPercent: number,
  availableSoil = RIVER_STARTING_SOIL_KILOGRAMS,
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
