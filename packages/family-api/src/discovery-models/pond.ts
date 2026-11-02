export interface PondState {
  algae: number;
  zooplankton: number;
  fish: number;
  oxygen: number;
  detritus: number;
}

export interface PondConditions {
  /** Invented 0–100 nutrient-supply index, not a concentration. */
  nutrients: number;
  /** Illustrative drought severity from 0–100 percent. */
  drought: number;
}

export interface PondScenario {
  state: PondState;
  conditions: PondConditions;
  observationWeeks: number;
}

export interface PondFeedingTransfer {
  /** All values are bookkeeping terms in the model's shared relative index. */
  algaeConsumedIndex: number;
  grazerGrowthFromFeedingIndex: number;
  unretainedAfterGrazingIndex: number;
  zooplanktonConsumedIndex: number;
  fishGrowthFromFeedingIndex: number;
  unretainedAfterPredationIndex: number;
}

export const POND_INITIAL_STATE: PondState = {
  algae: 45,
  zooplankton: 35,
  fish: 20,
  oxygen: 80,
  detritus: 10,
};

export const POND_DEFAULT_CONDITIONS: PondConditions = {
  nutrients: 50,
  drought: 0,
};

export const POND_PREDATOR_COMPARISON_WEEKS = 6;
export const POND_NUTRIENT_COMPARISON_WEEKS = 8;

export const POND_PREDATOR_COMPARISON = [
  {
    state: { ...POND_INITIAL_STATE },
    conditions: { ...POND_DEFAULT_CONDITIONS },
    observationWeeks: POND_PREDATOR_COMPARISON_WEEKS,
  },
  {
    state: { ...POND_INITIAL_STATE, fish: 0 },
    conditions: { ...POND_DEFAULT_CONDITIONS },
    observationWeeks: POND_PREDATOR_COMPARISON_WEEKS,
  },
] as const satisfies readonly PondScenario[];

export const POND_NUTRIENT_COMPARISON = [
  {
    state: { ...POND_INITIAL_STATE },
    conditions: { nutrients: 20, drought: 60 },
    observationWeeks: POND_NUTRIENT_COMPARISON_WEEKS,
  },
  {
    state: { ...POND_INITIAL_STATE },
    conditions: { nutrients: 100, drought: 60 },
    observationWeeks: POND_NUTRIENT_COMPARISON_WEEKS,
  },
] as const satisfies readonly PondScenario[];

function boundedIndex(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
}

export function normalizePondState(raw: PondState): PondState {
  return {
    algae: boundedIndex(raw.algae, POND_INITIAL_STATE.algae),
    zooplankton: boundedIndex(raw.zooplankton, POND_INITIAL_STATE.zooplankton),
    fish: boundedIndex(raw.fish, POND_INITIAL_STATE.fish),
    oxygen: boundedIndex(raw.oxygen, POND_INITIAL_STATE.oxygen),
    detritus: boundedIndex(raw.detritus, POND_INITIAL_STATE.detritus),
  };
}

export function normalizePondConditions(raw: PondConditions): PondConditions {
  return {
    nutrients: boundedIndex(raw.nutrients, POND_DEFAULT_CONDITIONS.nutrients),
    drought: boundedIndex(raw.drought, POND_DEFAULT_CONDITIONS.drought),
  };
}

/**
 * Advances one bounded teaching iteration. The coefficients and shared index
 * are invented to expose qualitative interactions; they are not calibrated
 * population, dissolved-oxygen, nutrient, or time measurements.
 */
export function advancePondWeek(
  rawState: PondState,
  rawConditions: PondConditions,
) {
  let { algae, zooplankton, fish, oxygen, detritus } =
    normalizePondState(rawState);
  const conditions = normalizePondConditions(rawConditions);
  const nutrientCapacity = 20 + conditions.nutrients * 0.8;
  const feeding: PondFeedingTransfer = {
    algaeConsumedIndex: 0,
    grazerGrowthFromFeedingIndex: 0,
    unretainedAfterGrazingIndex: 0,
    zooplanktonConsumedIndex: 0,
    fishGrowthFromFeedingIndex: 0,
    unretainedAfterPredationIndex: 0,
  };

  for (let substep = 0; substep < 10; substep += 1) {
    const grazing =
      (0.018 * algae * zooplankton) / (1 + Math.max(0, algae) / 35);
    const predation =
      (0.012 * zooplankton * fish) / (1 + Math.max(0, zooplankton) / 35);
    const algaeConsumed = 0.1 * grazing;
    const grazerGrowthFromFeeding = algaeConsumed * 0.4;
    const zooplanktonConsumed = 0.1 * predation;
    const fishGrowthFromFeeding = zooplanktonConsumed * 0.3;

    feeding.algaeConsumedIndex += algaeConsumed;
    feeding.grazerGrowthFromFeedingIndex += grazerGrowthFromFeeding;
    feeding.unretainedAfterGrazingIndex +=
      algaeConsumed - grazerGrowthFromFeeding;
    feeding.zooplanktonConsumedIndex += zooplanktonConsumed;
    feeding.fishGrowthFromFeedingIndex += fishGrowthFromFeeding;
    feeding.unretainedAfterPredationIndex +=
      zooplanktonConsumed - fishGrowthFromFeeding;

    const grossAlgaeGrowth = 0.5 * algae * (1 - algae / nutrientCapacity);
    const droughtAlgaeLoss = conditions.drought * 0.0007 * algae;
    const algaeTurnover = 0.015 * algae;
    const zooplanktonTurnover = 0.025 * zooplankton;
    const fishTurnover = 0.035 * fish;
    const detritusBreakdown = 0.055 * detritus;
    const netOxygenTarget = boundedIndex(
      100 - 0.42 * algae - 0.65 * detritus - 0.4 * conditions.drought,
      POND_INITIAL_STATE.oxygen,
    );
    const oxygenStress = Math.max(0, 55 - oxygen) / 100;

    algae = boundedIndex(
      algae +
        0.1 * (grossAlgaeGrowth - grazing - droughtAlgaeLoss - algaeTurnover),
      POND_INITIAL_STATE.algae,
    );
    zooplankton = boundedIndex(
      zooplankton +
        0.1 *
          (0.4 * grazing -
            predation -
            zooplanktonTurnover -
            oxygenStress * zooplankton),
      POND_INITIAL_STATE.zooplankton,
    );
    fish = boundedIndex(
      fish + 0.1 * (0.3 * predation - fishTurnover - oxygenStress * 1.7 * fish),
      POND_INITIAL_STATE.fish,
    );
    detritus = boundedIndex(
      detritus +
        0.1 *
          (algaeTurnover +
            droughtAlgaeLoss +
            0.2 * (zooplanktonTurnover + fishTurnover) -
            detritusBreakdown),
      POND_INITIAL_STATE.detritus,
    );
    oxygen = boundedIndex(
      oxygen + 0.1 * (netOxygenTarget - oxygen) * 0.8,
      POND_INITIAL_STATE.oxygen,
    );
  }

  return {
    state: { algae, zooplankton, fish, oxygen, detritus },
    feeding,
  };
}

/** Compatibility entry point retained for existing callers. */
export function pondWeek(state: PondState, conditions: PondConditions) {
  return advancePondWeek(state, conditions).state;
}

export function runPondTrial(
  scenario: PondScenario,
  rawWeeks = scenario.observationWeeks,
) {
  const weeks = Number.isFinite(rawWeeks)
    ? Math.max(0, Math.min(40, Math.floor(rawWeeks)))
    : scenario.observationWeeks;
  let state = normalizePondState(scenario.state);
  const conditions = normalizePondConditions(scenario.conditions);
  const trail = [{ ...state }];
  const feeding: PondFeedingTransfer = {
    algaeConsumedIndex: 0,
    grazerGrowthFromFeedingIndex: 0,
    unretainedAfterGrazingIndex: 0,
    zooplanktonConsumedIndex: 0,
    fishGrowthFromFeedingIndex: 0,
    unretainedAfterPredationIndex: 0,
  };

  for (let week = 0; week < weeks; week += 1) {
    const result = advancePondWeek(state, conditions);
    state = result.state;
    trail.push({ ...state });
    for (const key of Object.keys(feeding) as (keyof PondFeedingTransfer)[])
      feeding[key] += result.feeding[key];
  }

  return { week: weeks, state, conditions, trail, feeding };
}

export function pondStateAtPhase(
  state: PondState,
  conditions: PondConditions,
  rawPhase: number,
) {
  const finitePhase = Number.isFinite(rawPhase) ? rawPhase : 0;
  return {
    ...normalizePondState(state),
    ...normalizePondConditions(conditions),
    energyFlowPhase: ((finitePhase % 1) + 1) % 1,
  };
}

function samePopulationPresence(a: PondState, b: PondState) {
  return (["algae", "zooplankton", "fish"] as const).every(
    (key) => a[key] > 0 === b[key] > 0,
  );
}

export function comparePondScenarios(
  first: PondScenario,
  second: PondScenario,
) {
  const a = {
    state: normalizePondState(first.state),
    conditions: normalizePondConditions(first.conditions),
    observationWeeks: first.observationWeeks,
  };
  const b = {
    state: normalizePondState(second.state),
    conditions: normalizePondConditions(second.conditions),
    observationWeeks: second.observationWeeks,
  };
  const changed: string[] = [];
  if (a.state.fish > 0 !== b.state.fish > 0) changed.push("fish presence");
  if (a.conditions.nutrients !== b.conditions.nutrients)
    changed.push("nutrient supply index");
  if (a.conditions.drought !== b.conditions.drought)
    changed.push("drought severity");

  const held: string[] = [];
  if (a.conditions.nutrients === b.conditions.nutrients)
    held.push(`nutrient supply index ${a.conditions.nutrients}`);
  if (a.conditions.drought === b.conditions.drought)
    held.push(`drought severity ${a.conditions.drought}%`);
  if (a.state.fish > 0 !== b.state.fish > 0) {
    held.push("same algae, zooplankton, oxygen and detritus starting indices");
  } else if (samePopulationPresence(a.state, b.state)) {
    held.push("all three populations present", "same starting indices");
  }
  if (a.observationWeeks === b.observationWeeks)
    held.push(`${a.observationWeeks} illustrative weeks`);
  return { changed, held };
}

export const initialPond = POND_INITIAL_STATE;
