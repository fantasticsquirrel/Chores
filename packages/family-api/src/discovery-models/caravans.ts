export const CARAVAN_ROUTES = {
  ridge: {
    name: "Mountain Pass",
    dry: 9,
    wet: 13,
    toll: 8,
    description:
      "The shortest dry-season route; the model breaks some pottery on its steep path.",
  },
  river: {
    name: "River Road",
    dry: 14,
    wet: 8,
    toll: 12,
    description:
      "The model makes low dry-season water slow this route and wet-season water shorten it.",
  },
  oasis: {
    name: "Oasis Trail",
    dry: 12,
    wet: 11,
    toll: 3,
    description:
      "A longer dry-season route with a lower toll and no pottery-breakage rule.",
  },
} as const;

export const CARAVAN_CARGO = {
  grain: { name: "Grain", weight: 6, buy: 4, sell: 7 },
  cloth: { name: "Cloth", weight: 3, buy: 8, sell: 12 },
  pottery: { name: "Pottery", weight: 7, buy: 5, sell: 10 },
} as const;

export const CARAVAN_TEACHING_ASSUMPTIONS = Object.freeze({
  capacityKg: 100,
  supplyWeightKgPerDay: 2,
  supplyCostCreditsPerDay: 1,
  grainSpoilageThresholdDays: 10,
  grainSpoilageRate: 0.25,
  mountainPotteryBreakageRate: 0.15,
  maximumCargoUnits: 15,
  maximumSupplyDays: 20,
});

export type CaravanRoute = keyof typeof CARAVAN_ROUTES;
export type CaravanCargo = keyof typeof CARAVAN_CARGO;
export type CaravanSeason = "dry" | "wet";

export type CaravanJourneyInput = Readonly<{
  route: CaravanRoute;
  season: CaravanSeason;
  cargo: CaravanCargo;
  units: number;
  supplyDays: number;
}>;

export type CaravanJourneyResult = Readonly<{
  days: number;
  spoiled: number;
  broken: number;
  delivered: number;
  cargoWeight: number;
  supplyWeight: number;
  load: number;
  capacity: number;
  capacityRemaining: number;
  shortfall: number;
  unusedSupplyDays: number;
  overCapacity: boolean;
  toll: number;
  purchaseCost: number;
  supplyCost: number;
  costs: number;
  revenue: number;
  margin: number;
  viable: boolean;
}>;

export type CaravanPlanComparison = Readonly<{
  baseline: CaravanJourneyResult;
  comparison: CaravanJourneyResult;
  change: Readonly<{
    days: number;
    delivered: number;
    load: number;
    costs: number;
    margin: number;
  }>;
}>;

const boundedInteger = (value: number, minimum: number, maximum: number) =>
  Number.isSafeInteger(value) && value >= minimum && value <= maximum;

const isRoute = (value: unknown): value is CaravanRoute =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(CARAVAN_ROUTES, value);
const isCargo = (value: unknown): value is CaravanCargo =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(CARAVAN_CARGO, value);
const isSeason = (value: unknown): value is CaravanSeason =>
  value === "dry" || value === "wet";

export function calculateCaravanJourney(
  input: CaravanJourneyInput,
): CaravanJourneyResult | null {
  if (
    !isRoute(input?.route) ||
    !isSeason(input?.season) ||
    !isCargo(input?.cargo) ||
    !boundedInteger(
      input?.units,
      1,
      CARAVAN_TEACHING_ASSUMPTIONS.maximumCargoUnits,
    ) ||
    !boundedInteger(
      input?.supplyDays,
      0,
      CARAVAN_TEACHING_ASSUMPTIONS.maximumSupplyDays,
    )
  )
    return null;

  const road = CARAVAN_ROUTES[input.route];
  const goods = CARAVAN_CARGO[input.cargo];
  const days = road[input.season];
  const spoiled =
    input.cargo === "grain" &&
    days > CARAVAN_TEACHING_ASSUMPTIONS.grainSpoilageThresholdDays
      ? Math.ceil(input.units * CARAVAN_TEACHING_ASSUMPTIONS.grainSpoilageRate)
      : 0;
  const broken =
    input.cargo === "pottery" && input.route === "ridge"
      ? Math.ceil(
          input.units *
            CARAVAN_TEACHING_ASSUMPTIONS.mountainPotteryBreakageRate,
        )
      : 0;
  const delivered = input.units - spoiled - broken;
  const cargoWeight = input.units * goods.weight;
  const supplyWeight =
    input.supplyDays * CARAVAN_TEACHING_ASSUMPTIONS.supplyWeightKgPerDay;
  const load = cargoWeight + supplyWeight;
  const capacity = CARAVAN_TEACHING_ASSUMPTIONS.capacityKg;
  const shortfall = Math.max(0, days - input.supplyDays);
  const unusedSupplyDays = Math.max(0, input.supplyDays - days);
  const purchaseCost = input.units * goods.buy;
  const supplyCost =
    input.supplyDays * CARAVAN_TEACHING_ASSUMPTIONS.supplyCostCreditsPerDay;
  const costs = purchaseCost + supplyCost + road.toll;
  const revenue = delivered * goods.sell;

  return {
    days,
    spoiled,
    broken,
    delivered,
    cargoWeight,
    supplyWeight,
    load,
    capacity,
    capacityRemaining: capacity - load,
    shortfall,
    unusedSupplyDays,
    overCapacity: load > capacity,
    toll: road.toll,
    purchaseCost,
    supplyCost,
    costs,
    revenue,
    margin: revenue - costs,
    viable: load <= capacity && shortfall === 0,
  };
}

export function compareCaravanPlans(
  baselineInput: CaravanJourneyInput,
  comparisonInput: CaravanJourneyInput,
): CaravanPlanComparison | null {
  const baseline = calculateCaravanJourney(baselineInput);
  const comparison = calculateCaravanJourney(comparisonInput);
  if (!baseline || !comparison) return null;
  return {
    baseline,
    comparison,
    change: {
      days: comparison.days - baseline.days,
      delivered: comparison.delivered - baseline.delivered,
      load: comparison.load - baseline.load,
      costs: comparison.costs - baseline.costs,
      margin: comparison.margin - baseline.margin,
    },
  };
}

export function caravanJourney(
  route: CaravanRoute,
  season: CaravanSeason,
  cargo: CaravanCargo,
  units: number,
  supplyDays: number,
) {
  const result = calculateCaravanJourney({
    route,
    season,
    cargo,
    units,
    supplyDays,
  });
  if (!result) throw new RangeError("Invalid bounded caravan input.");
  return result;
}

export const CARAVAN_SEASON_TRIAL = Object.freeze({
  baseline: Object.freeze({
    route: "river",
    season: "wet",
    cargo: "grain",
    units: 6,
    supplyDays: 14,
  } satisfies CaravanJourneyInput),
  comparison: Object.freeze({
    route: "river",
    season: "dry",
    cargo: "grain",
    units: 6,
    supplyDays: 14,
  } satisfies CaravanJourneyInput),
});

export const CARAVAN_ROUTE_TRIAL = Object.freeze({
  baseline: Object.freeze({
    route: "ridge",
    season: "dry",
    cargo: "pottery",
    units: 6,
    supplyDays: 12,
  } satisfies CaravanJourneyInput),
  comparison: Object.freeze({
    route: "oasis",
    season: "dry",
    cargo: "pottery",
    units: 6,
    supplyDays: 12,
  } satisfies CaravanJourneyInput),
});
