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

/**
 * A deliberately simple relationship model for a one-hour storm over one
 * hectare. The coefficients are invented for controlled comparison and are
 * not calibrated against a river or intended for prediction.
 */
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

  // 1 mm of rain across 1 hectare is 10 m³ of water.
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

function normalizeLedger(ledger: RiverLedger): RiverLedger {
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
  const ledger = normalizeLedger(rawLedger);
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
