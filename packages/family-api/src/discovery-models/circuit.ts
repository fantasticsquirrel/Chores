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

/**
 * Exact ideal-DC comparison model. Every house is a fixed 12 Ω resistor;
 * source voltage never sags and wires/switches have zero resistance.
 */
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
