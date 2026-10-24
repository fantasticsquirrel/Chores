import { lazy, Suspense, useId, useState } from "react";
import {
  addFractions,
  simplifyFraction,
} from "@family-manager/family-api/discovery-models/math-life";
import { Slider } from "./SimulationPrimitives";
import type { PizzaPlate } from "./tactile/tableGeometry";
import "./tactile/tactile.css";
const TableCanvas = lazy(() =>
  import("./tactile/TableCanvas").then((module) => ({
    default: module.TableCanvas,
  })),
);
const makePlate = (n: number, d: number): PizzaPlate => ({
  n,
  d,
  slices: Array.from({ length: n }, (_, i) => i),
});
export function FractionFeastSimulation() {
  const id = useId();
  const [plates, setPlates] = useState([makePlate(1, 2), makePlate(2, 4)]);
  const [active, setActive] = useState(0),
    [combined, setCombined] = useState(false);
  const [prediction, setPrediction] = useState<string | null>(null),
    [tested, setTested] = useState(false);
  const plate = plates[active],
    [a, b] = plates;
  const equal = a.n * b.d === b.n * a.d;
  const relation = equal ? "=" : a.n * b.d > b.n * a.d ? ">" : "<";
  const sum = addFractions(a.n, a.d, b.n, b.d),
    simple = simplifyFraction(plate.n, plate.d);
  const update = (n: number, d: number) => {
    setPlates(
      plates.map((value, i) => (i === active ? makePlate(n, d) : value)),
    );
    setCombined(false);
    setTested(false);
  };
  const selectSlice = (p: number, slice: number) => {
    setActive(p);
    setCombined(false);
    setTested(false);
    setPlates((values) =>
      values.map((value, i) => {
        if (i !== p) return value;
        const slices = value.slices.includes(slice)
          ? value.slices.filter((s) => s !== slice)
          : [...value.slices, slice];
        return { ...value, n: slices.length, slices };
      }),
    );
  };
  const split = () => {
    if (plate.d >= 24) return;
    setPlates(
      plates.map((value, i) =>
        i === active
          ? {
              n: value.n * 2,
              d: value.d * 2,
              slices: value.slices.flatMap((slice) => [
                slice * 2,
                slice * 2 + 1,
              ]),
            }
          : value,
      ),
    );
    setCombined(false);
    setTested(true);
  };
  const reset = () => {
    setPlates([makePlate(1, 2), makePlate(2, 4)]);
    setActive(0);
    setCombined(false);
    setPrediction(null);
    setTested(false);
  };
  return (
    <div className="tactile-exhibit fraction-exhibit">
      <section className="fraction-table" aria-label="Fraction table">
        <header className="tactile-heading">
          <span>EQUAL-SIZED WHOLES</span>
          <h2>How much is on your plate?</h2>
          <p>Count the pieces. Then compare the amount.</p>
        </header>
        <div
          className="fraction-render"
          role="img"
          aria-label={`Fraction feast: two equal-sized pizzas. Plate A has ${a.n} of ${a.d} equal slices. Plate B has ${b.n} of ${b.d}. ${equal ? "The selected amounts are equal." : "The selected amounts are different."}`}
        >
          <Suspense
            fallback={
              <div className="tactile-loading">Loading the fraction model…</div>
            }
          >
            <TableCanvas
              kind="pizza"
              plates={plates}
              active={active}
              onSlice={selectSlice}
            />
          </Suspense>
        </div>
        <div className="fraction-equation" aria-hidden="true">
          {combined ? "+" : relation}
        </div>
        <div className="fraction-plate-captions" aria-hidden="true">
          {plates.map((value, i) => (
            <div key={i}>
              <span>PLATE {i === 0 ? "A" : "B"}</span>
              <strong>
                {value.n}
                <i>/</i>
                {value.d}
              </strong>
              <small>
                {Number.isInteger((value.n * 100) / value.d) ? "" : "≈"}
                {Math.round((value.n / value.d) * 100)}% of one whole
              </small>
            </div>
          ))}
        </div>
        <p className="tactile-scene-hint">
          Tap a slice or an empty space to change your portion.
        </p>
      </section>
      <div className="tactile-console fraction-console">
        <div className="tactile-control-group">
          <span className="tactile-kicker">01 / CHOOSE & CUT</span>
          <div className="dl-actions" role="group" aria-label="Choose a plate">
            {["Plate A", "Plate B"].map((label, index) => (
              <button
                key={label}
                type="button"
                aria-pressed={active === index}
                onClick={() => setActive(index)}
              >
                {label}
              </button>
            ))}
          </div>
          <label htmlFor={`${id}-parts`}>Equal parts in this whole</label>
          <select
            id={`${id}-parts`}
            value={plate.d}
            onChange={(event) =>
              update(
                Math.min(plate.n, Number(event.target.value)),
                Number(event.target.value),
              )
            }
          >
            {[...new Set([2, 3, 4, 6, 8, 12, plate.d])]
              .sort((x, y) => x - y)
              .map((value) => (
                <option key={value} value={value}>
                  {value} equal parts
                </option>
              ))}
          </select>
        </div>
        <div className="tactile-control-group">
          <span className="tactile-kicker">02 / SELECT A PORTION</span>
          <Slider
            label="Selected slices"
            value={plate.n}
            min={0}
            max={plate.d}
            onChange={(n) => update(n, plate.d)}
          />
          <div
            className="fraction-slice-buttons"
            role="group"
            aria-label={`Individual slices on Plate ${active === 0 ? "A" : "B"}`}
          >
            {Array.from({ length: plate.d }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Plate ${active === 0 ? "A" : "B"} slice ${i + 1}`}
                aria-pressed={plate.slices.includes(i)}
                onClick={() => selectSlice(active, i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="tactile-control-group">
          <span className="tactile-kicker">03 / COMPARE</span>
          <div className="dl-actions tactile-stacked">
            <button type="button" disabled={plate.d >= 24} onClick={split}>
              Split every slice
            </button>
            <button type="button" onClick={() => setCombined(!combined)}>
              {combined ? "Compare plates" : "Combine slices"}
            </button>
            <button type="button" onClick={reset}>
              Reset
            </button>
          </div>
        </div>
      </div>
      {combined && (
        <div
          className="fraction-combined"
          role="img"
          aria-label={`Combined area equals ${sum.numerator}/${sum.denominator} wholes`}
        >
          <div>
            <span className="tactile-kicker">COMBINED AMOUNT</span>
            <h3>
              {sum.numerator}/{sum.denominator} wholes
            </h3>
          </div>
          <div className="fraction-whole-bars">
            {[0, 1].map((whole) => (
              <div key={whole}>
                <div className="fraction-whole-track">
                  <span
                    style={{
                      width: `${100 * Math.min(1, Math.max(0, sum.numerator / sum.denominator - whole))}%`,
                    }}
                  />
                  {Array.from({ length: sum.denominator - 1 }, (_, i) => (
                    <i
                      key={i}
                      style={{ left: `${((i + 1) / sum.denominator) * 100}%` }}
                    />
                  ))}
                </div>
                <small>whole {whole + 1}</small>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="tactile-investigation">
        <div>
          <span className="tactile-kicker">PREDICT</span>
          <h3>If you split every slice in two, will you have more pizza?</h3>
          <div className="dl-actions">
            {["More pizza", "The same amount", "Less pizza"].map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={prediction === label}
                onClick={() => {
                  setPrediction(label);
                  setTested(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="tactile-kicker">OBSERVE</span>
          <h3>Keep the whole and your portion fixed. Change only the cuts.</h3>
          <button
            type="button"
            className="tactile-text-button"
            disabled={plate.d >= 24}
            onClick={split}
          >
            Test the split
          </button>
          <p>Compare the covered area before and after.</p>
        </div>
        <div>
          <span className="tactile-kicker">EXPLAIN</span>
          <p>
            {tested
              ? "The amount stayed the same: each selected piece became two smaller pieces. Both the numerator and denominator doubled."
              : "The denominator counts all equal pieces in one whole. The numerator counts your selected pieces."}
          </p>
          <p>
            Next, set A to 2/3 and B to 3/4. Predict whether their sum fits in
            one whole, then combine them.
          </p>
        </div>
      </div>
      <div className="tactile-readout" role="status" aria-live="polite">
        <strong>
          {a.n}/{a.d} {relation} {b.n}/{b.d}
        </strong>{" "}
        ·{" "}
        {equal
          ? "Equal amounts, even with different pieces."
          : "Compare the covered area, not just the slice count."}
        <br />
        Selected plate in simplest form:{" "}
        <strong>
          {simple.numerator}/{simple.denominator}
        </strong>
        {combined && (
          <p>
            {a.n}/{a.d} + {b.n}/{b.d} ={" "}
            <strong>
              {sum.numerator}/{sum.denominator} whole
              {sum.numerator === sum.denominator ? "" : "s"}
            </strong>
            {sum.numerator > sum.denominator
              ? sum.numerator % sum.denominator === 0
                ? `: exactly ${sum.numerator / sum.denominator} wholes.`
                : `: ${Math.floor(sum.numerator / sum.denominator)} whole and ${sum.numerator % sum.denominator}/${sum.denominator} left over.`
              : "."}
          </p>
        )}
      </div>
      <p className="tactile-model-note">
        Both wholes have the same area. The outlined spaces are unselected
        slices. Every slice in a whole has equal area; toppings do not change
        the fraction.
      </p>
    </div>
  );
}
