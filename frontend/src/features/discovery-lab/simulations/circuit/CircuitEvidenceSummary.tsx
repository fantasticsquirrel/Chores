import { circuitStateAtPhase } from "@family-manager/family-api/discovery-models/circuit";

type CircuitResult = ReturnType<typeof circuitStateAtPhase>;

export function CircuitEvidenceSummary({ result }: { result: CircuitResult }) {
  const loadEnergy = result.houseEnergyJoules.reduce(
    (sum, value) => sum + value,
    0,
  );
  const branchCharge = result.houseChargeCoulombs
    .map((value) => value.toFixed(1))
    .join(" + ");

  return (
    <>
      <div className="dl-circuit-definitions">
        <strong>Units used in the evidence</strong>
        <p>
          Current I is charge flow rate (A = C/s). Voltage V is energy
          transferred per charge (V = J/C). For these fixed resistors, I = V ÷ R
          and power P = V × I is energy transfer rate (W = J/s).
        </p>
      </div>

      <div className="dl-circuit-ledger" role="status" aria-live="polite">
        <span aria-label="Charge ledger">
          Charge in 10 s: {result.sourceChargeCoulombs.toFixed(1)} C leaves the
          source and {result.returnedChargeCoulombs.toFixed(1)} C returns.
        </span>
        <span>
          {result.mode === "parallel"
            ? "Branch charges: " +
              branchCharge +
              " = " +
              result.sourceChargeCoulombs.toFixed(1) +
              " C at the junction."
            : "The same " +
              result.sourceChargeCoulombs.toFixed(1) +
              " C passes each series load; it is not used up."}
        </span>
        <span aria-label="Energy ledger">
          Energy in 10 s: {result.sourceEnergyJoules.toFixed(1)} J supplied ={" "}
          {loadEnergy.toFixed(1)} J transferred to the loads.
        </span>
        <span>
          Charge is conserved around complete paths; energy is transferred from
          the source to the resistors.
        </span>
      </div>

      <p className="dl-circuit-caveat">
        Model boundary: steady direct current from an ideal 0–18 V source, three
        fixed 12 Ω resistors, zero-resistance wires and switches, and
        instantaneous changes. The source never sags or runs down; resistance
        never changes with heating. Transients, component limits and protective
        devices are omitted. Houses, light and moving arrows are schematic. Real
        household mains uses dangerous alternating current and protective
        systems—never test mains wiring. Use only classroom-approved low-voltage
        circuits with teacher or adult supervision.
      </p>
    </>
  );
}
