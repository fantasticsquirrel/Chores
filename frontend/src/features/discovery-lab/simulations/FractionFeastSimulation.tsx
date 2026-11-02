import { lazy, Suspense, useState } from "react";
import {
  FRACTION_ADDITION_TRIAL,
  addFractionParts,
  equivalentFractions,
  normalizeFraction,
} from "@family-manager/family-api/discovery-models/fractions";
import { Slider } from "./SimulationPrimitives";
import { FractionAmountDiagram } from "./fraction/FractionAmountDiagram";
import { FractionPieceToggles } from "./fraction/FractionPieceToggles";
import { FractionPredictionTrials } from "./fraction/FractionPredictionTrials";
import { useFractionLesson } from "./fraction/useFractionLesson";
import type { PizzaPlate } from "./tactile/tableGeometry";
import "./tactile/tactile.css";
import "./fraction/fraction-feast.css";

const TableCanvas = lazy(() =>
  import("./tactile/TableCanvas").then((module) => ({
    default: module.TableCanvas,
  })),
);

const makePlate = (n: number, d: number): PizzaPlate => ({
  n,
  d,
  slices: Array.from({ length: n }, (_, index) => index),
});

const startingPlates = () => [makePlate(1, 2), makePlate(2, 4)];

export function FractionFeastSimulation() {
  const [plates, setPlates] = useState(startingPlates);
  const [active, setActive] = useState(0);
  const [combined, setCombined] = useState(false);
  const lesson = useFractionLesson();
  const [left, right] = plates;
  const activePlate = plates[active];
  const relation = equivalentFractions(left.n, left.d, right.n, right.d);
  const addition = addFractionParts(left.n, left.d, right.n, right.d)!;
  const simplified = normalizeFraction(activePlate.n, activePlate.d)!;

  const showEquivalentBefore = () => {
    setPlates(startingPlates());
    setActive(0);
    setCombined(false);
  };
  const showEquivalentAfter = () => {
    setPlates([makePlate(2, 4), makePlate(2, 4)]);
    setActive(0);
    setCombined(false);
  };
  const showAdditionParts = () => {
    setPlates([
      makePlate(
        FRACTION_ADDITION_TRIAL.left.numerator,
        FRACTION_ADDITION_TRIAL.left.denominator,
      ),
      makePlate(
        FRACTION_ADDITION_TRIAL.right.numerator,
        FRACTION_ADDITION_TRIAL.right.denominator,
      ),
    ]);
    setActive(0);
    setCombined(false);
  };
  const showAdditionTotal = () => {
    showAdditionParts();
    setCombined(true);
  };

  const updateActivePlate = (n: number, d: number) => {
    setPlates((current) =>
      current.map((plate, index) =>
        index === active ? makePlate(Math.min(n, d), d) : plate,
      ),
    );
    setCombined(false);
  };
  const selectSlice = (plateIndex: number, slice: number) => {
    if (!lesson.freeExploration) return;
    setActive(plateIndex);
    setCombined(false);
    setPlates((current) =>
      current.map((plate, index) => {
        if (index !== plateIndex) return plate;
        const slices = plate.slices.includes(slice)
          ? plate.slices.filter((selected) => selected !== slice)
          : [...plate.slices, slice].sort((a, b) => a - b);
        return { ...plate, n: slices.length, slices };
      }),
    );
  };
  const splitActivePlate = () => {
    if (activePlate.d > 12) return;
    setPlates((current) =>
      current.map((plate, index) =>
        index === active
          ? {
              n: plate.n * 2,
              d: plate.d * 2,
              slices: plate.slices.flatMap((slice) => [
                slice * 2,
                slice * 2 + 1,
              ]),
            }
          : plate,
      ),
    );
    setCombined(false);
  };
  const reset = () => {
    setPlates(startingPlates());
    setActive(0);
    setCombined(false);
    lesson.resetLesson();
  };

  const relationLabel = relation
    ? "equal to"
    : left.n * right.d > right.n * left.d
      ? "greater than"
      : "less than";
  const description = `Two equal-area pizzas. Plate A has ${left.n} of ${left.d} equal pieces selected. Plate B has ${right.n} of ${right.d} equal pieces selected. Plate A is ${relationLabel} Plate B. ${combined ? `Using ${addition.commonDenominator}ths, the combined amount is ${addition.commonSumNumerator}/${addition.commonDenominator}, or ${addition.wholeCount} whole and ${addition.remainder.numerator}/${addition.remainder.denominator}.` : "The unselected spaces keep each whole's area visible."}`;

  return (
    <div className="tactile-exhibit fraction-exhibit">
      <header className="fraction-heading">
        <h2>Fractions need a fair whole</h2>
        <p>
          Predict first. Compare equal-area pizzas cut into equal pieces, then
          explain the exact result.
        </p>
      </header>

      <section className="fraction-table" aria-label="Fraction pizza table">
        <div className="fraction-render" role="img" aria-label={description}>
          <Suspense
            fallback={
              <div className="tactile-loading">Loading the pizza model…</div>
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
          {combined
            ? "+"
            : relation
              ? "="
              : left.n * right.d > right.n * left.d
                ? ">"
                : "<"}
        </div>
        <div className="fraction-plate-captions">
          {plates.map((plate, index) => (
            <div key={index}>
              <span>Plate {index === 0 ? "A" : "B"}</span>
              <strong>
                {plate.n}/{plate.d}
              </strong>
              <small>
                {plate.n} of {plate.d} equal pieces selected
              </small>
            </div>
          ))}
        </div>
        <p className="tactile-scene-hint">
          The two plate rims mark equal-area wholes. Piece boundaries are
          numbered.
        </p>
      </section>

      <FractionPredictionTrials
        lesson={lesson}
        onEquivalentPrediction={showEquivalentBefore}
        onEquivalentCompare={() => {
          lesson.completeEquivalent();
          showEquivalentAfter();
        }}
        onShowEquivalentBefore={showEquivalentBefore}
        onShowEquivalentAfter={showEquivalentAfter}
        onAdditionPrediction={showAdditionParts}
        onAdditionCompare={() => {
          lesson.completeAddition();
          showAdditionTotal();
        }}
        onShowAdditionParts={showAdditionParts}
        onShowAdditionTotal={showAdditionTotal}
      />

      {combined && <FractionAmountDiagram addition={addition} />}

      <div className="fraction-readout" role="status" aria-live="polite">
        <div>
          <span>Plate comparison</span>
          <strong>
            {left.n}/{left.d}{" "}
            {relation ? "=" : left.n * right.d > right.n * left.d ? ">" : "<"}{" "}
            {right.n}/{right.d}
          </strong>
        </div>
        <div>
          <span>Selected plate in simplest form</span>
          <strong>
            {simplified.numerator}/{simplified.denominator}
          </strong>
        </div>
        {combined && (
          <div>
            <span>Exact combined amount</span>
            <strong>
              {addition.commonSumNumerator}/{addition.commonDenominator} ={" "}
              {addition.wholeCount} whole
              {addition.wholeCount === 1 ? "" : "s"}
              {addition.remainder.numerator
                ? ` and ${addition.remainder.numerator}/${addition.remainder.denominator}`
                : ""}
            </strong>
          </div>
        )}
      </div>

      <section className="fraction-explore">
        <div className="fraction-explore-heading">
          <div>
            <h3>
              {lesson.freeExploration
                ? "Explore fractions"
                : "Complete both comparisons to unlock exploration"}
            </h3>
            <p>
              {lesson.freeExploration
                ? "Keep the whole area fixed. Change one plate, then compare the exact fractions."
                : "Each fixed trial shows what changes and what stays the same."}
            </p>
          </div>
          <button type="button" onClick={reset}>
            Reset lesson
          </button>
        </div>
        {lesson.freeExploration && (
          <div className="fraction-free-controls">
            <div className="fraction-active-control">
              <label htmlFor="fraction-active-plate">Active plate</label>
              <select
                id="fraction-active-plate"
                value={active}
                onChange={(event) => {
                  setActive(Number(event.target.value));
                  setCombined(false);
                }}
              >
                <option value={0}>Plate A</option>
                <option value={1}>Plate B</option>
              </select>
            </div>
            <div className="fraction-active-control">
              <label htmlFor="fraction-parts">Equal parts in this whole</label>
              <select
                id="fraction-parts"
                value={activePlate.d}
                onChange={(event) =>
                  updateActivePlate(activePlate.n, Number(event.target.value))
                }
              >
                {[2, 3, 4, 6, 8, 12, 16, 24].map((value) => (
                  <option key={value} value={value}>
                    {value} equal parts
                  </option>
                ))}
              </select>
            </div>
            <Slider
              label="Selected slices"
              value={activePlate.n}
              min={0}
              max={activePlate.d}
              onChange={(value) => updateActivePlate(value, activePlate.d)}
            />
            <div className="fraction-free-actions">
              <button
                type="button"
                disabled={activePlate.d > 12}
                onClick={splitActivePlate}
              >
                Split every slice
              </button>
              <button
                type="button"
                onClick={() => setCombined((value) => !value)}
              >
                {combined ? "Separate portions" : "Combine slices"}
              </button>
            </div>
            <FractionPieceToggles
              plate={activePlate}
              plateName={`Plate ${active === 0 ? "A" : "B"}`}
              onToggle={(piece) => selectSlice(active, piece)}
            />
          </div>
        )}
      </section>

      <p className="tactile-model-note">
        Model boundary: each plate represents the same whole area and each cut
        makes equal-area pieces. The pizza, toppings, plate depth, and lighting
        help show the partitions but do not affect the exact arithmetic.
      </p>
    </div>
  );
}
