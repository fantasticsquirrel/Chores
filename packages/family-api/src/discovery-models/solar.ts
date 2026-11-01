export type SolarPlanet = {
  name: string;
  kind: "Rocky planet" | "Gas giant" | "Ice giant";
  meanDistanceAu: number;
  orbitalPeriodYears: number;
  diameterKm: number;
  color: string;
};

export type SolarSystemInputs = {
  selected: number;
  earthYears: number;
};

/**
 * Rounded mean-distance, equatorial-diameter and orbital-period values from
 * NASA's Planetary Fact Sheet and Basics of Space Flight. The scene uses these
 * measurements as data; its drawn orbit gaps and planet sizes are separate
 * teaching scales.
 */
export const SOLAR_PLANETS = [
  {
    name: "Mercury",
    kind: "Rocky planet",
    meanDistanceAu: 0.387,
    orbitalPeriodYears: 0.241,
    diameterKm: 4_879,
    color: "#b9afac",
  },
  {
    name: "Venus",
    kind: "Rocky planet",
    meanDistanceAu: 0.723,
    orbitalPeriodYears: 0.615,
    diameterKm: 12_104,
    color: "#e8ba7c",
  },
  {
    name: "Earth",
    kind: "Rocky planet",
    meanDistanceAu: 1,
    orbitalPeriodYears: 1,
    diameterKm: 12_756,
    color: "#73b9e8",
  },
  {
    name: "Mars",
    kind: "Rocky planet",
    meanDistanceAu: 1.524,
    orbitalPeriodYears: 1.881,
    diameterKm: 6_792,
    color: "#e18d73",
  },
  {
    name: "Jupiter",
    kind: "Gas giant",
    meanDistanceAu: 5.203,
    orbitalPeriodYears: 11.86,
    diameterKm: 142_984,
    color: "#dcb695",
  },
  {
    name: "Saturn",
    kind: "Gas giant",
    meanDistanceAu: 9.537,
    orbitalPeriodYears: 29.45,
    diameterKm: 120_536,
    color: "#e4d4a0",
  },
  {
    name: "Uranus",
    kind: "Ice giant",
    meanDistanceAu: 19.19,
    orbitalPeriodYears: 84.02,
    diameterKm: 51_118,
    color: "#8cdbde",
  },
  {
    name: "Neptune",
    kind: "Ice giant",
    meanDistanceAu: 30.07,
    orbitalPeriodYears: 164.8,
    diameterKm: 49_528,
    color: "#7299f2",
  },
] as const satisfies readonly SolarPlanet[];

export const SOLAR_ORBIT_COMPARISON = [
  { selected: 2, earthYears: 1 },
  { selected: 7, earthYears: 1 },
] as const satisfies readonly SolarSystemInputs[];

export const SOLAR_DIAMETER_COMPARISON = [
  { selected: 2, earthYears: 0 },
  { selected: 4, earthYears: 0 },
] as const satisfies readonly SolarSystemInputs[];

function bound(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

export function normalizeSolarSystemInputs(
  inputs: SolarSystemInputs,
): SolarSystemInputs {
  return {
    selected: Math.round(bound(inputs.selected, 0, 7, 2)),
    earthYears: bound(inputs.earthYears, 0, 165, 0),
  };
}

/** A data-driven circular teaching phase, not a present-day ephemeris. */
export function planetAngle(index: number, earthYears: number) {
  const inputs = normalizeSolarSystemInputs({ selected: index, earthYears });
  return (
    (inputs.earthYears / SOLAR_PLANETS[inputs.selected].orbitalPeriodYears) *
      Math.PI *
      2 +
    inputs.selected * 0.8
  );
}

export function solarSystemActivity(raw: SolarSystemInputs) {
  const inputs = normalizeSolarSystemInputs(raw);
  const planet = SOLAR_PLANETS[inputs.selected];
  const orbitFraction = inputs.earthYears / planet.orbitalPeriodYears;
  return {
    inputs,
    planet,
    orbitFraction,
    displayedPhase: orbitFraction - Math.floor(orbitFraction),
    diameterEarths: planet.diameterKm / SOLAR_PLANETS[2].diameterKm,
    angle: planetAngle(inputs.selected, inputs.earthYears),
  };
}

export function compareSolarTrials(
  first: SolarSystemInputs,
  second: SolarSystemInputs,
) {
  const a = normalizeSolarSystemInputs(first);
  const b = normalizeSolarSystemInputs(second);
  const changed: string[] = [];
  const held: string[] = [];
  for (const [label, equal] of [
    ["planet", a.selected === b.selected],
    ["elapsed time", a.earthYears === b.earthYears],
  ] as const)
    (equal ? held : changed).push(label);
  return { changed, held };
}
