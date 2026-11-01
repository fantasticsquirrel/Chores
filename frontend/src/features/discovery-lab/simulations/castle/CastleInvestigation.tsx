import { useState } from "react";
import {
  CASTLE_GATE_COMPARISON,
  CASTLE_TOWER_COMPARISON,
  castleActivity,
  compareCastleTrials,
  type CastleInputs,
} from "@family-manager/family-api/discovery-models/castle";
import type { CastleState } from "./castleState";

type Topic = "routes" | "views";
type Prediction = "both" | "bridge" | "neither" | "tower" | "same" | "flat";

const toState = (inputs: CastleInputs): CastleState => ({
  moat: inputs.ditchWidthMeters,
  wallHeightMeters: inputs.wallHeightMeters,
  towers: inputs.towers,
  gate: inputs.gate,
  inner: inputs.inner,
  approach: inputs.approach,
  sight: inputs.sight,
});

const routeEvidence = CASTLE_GATE_COMPARISON.map(castleActivity);
const towerEvidence = CASTLE_TOWER_COMPARISON.map(castleActivity);
const routeVariables = compareCastleTrials(...CASTLE_GATE_COMPARISON);
const towerVariables = compareCastleTrials(...CASTLE_TOWER_COMPARISON);

export function CastleInvestigation({
  onChange,
}: {
  state: CastleState;
  onChange: (state: CastleState) => void;
}) {
  const [topic, setTopic] = useState<Topic>("routes");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [tested, setTested] = useState(false);
  const choices =
    topic === "routes"
      ? ([
          ["both", "Both routes"],
          ["bridge", "Bridge only"],
          ["neither", "Neither route"],
        ] as const)
      : ([
          ["tower", "Projecting tower"],
          ["same", "Same view"],
          ["flat", "Flat wall"],
        ] as const);

  const chooseTopic = (next: Topic) => {
    setTopic(next);
    setPrediction(null);
    setTested(false);
  };

  const compare = () => {
    if (!prediction) return;
    setTested(true);
    onChange(
      toState(
        topic === "routes"
          ? CASTLE_GATE_COMPARISON[0]
          : CASTLE_TOWER_COMPARISON[1],
      ),
    );
  };

  const feedback =
    topic === "routes"
      ? `The result ${prediction === "bridge" ? "matches" : "differs from"} your prediction. Bridge: ${routeEvidence[0].routeOutcome} · North: ${routeEvidence[1].routeOutcome}. Changed: ${routeVariables.changed.join(", ")}. Held: ${routeVariables.held.join(" · ")}. Opening the gate does not create an entrance through the north wall.`
      : `The result ${prediction === "tower" ? "matches" : "differs from"} your prediction. Flat wall: ${towerEvidence[0].sightLineCount} illustrated direction · Projecting tower: ${towerEvidence[1].sightLineCount}. Changed: ${towerVariables.changed.join(", ")}. Held: ${towerVariables.held.join(" · ")}. Projecting outward changes the wall faces visible from this example position.`;

  return (
    <section className="castle-investigation" aria-label="Guided comparisons">
      <div className="castle-investigation-tabs">
        <button
          type="button"
          aria-pressed={topic === "routes"}
          onClick={() => chooseTopic("routes")}
        >
          Compare routes
        </button>
        <button
          type="button"
          aria-pressed={topic === "views"}
          onClick={() => chooseTopic("views")}
        >
          Compare sight lines
        </button>
      </div>
      <div className="castle-investigation-grid">
        <div>
          <span>1. Predict</span>
          <h3>
            {topic === "routes"
              ? "With the gate open, which routes reach an entrance?"
              : "Which position shows more adjoining wall faces?"}
          </h3>
          <div className="castle-predictions">
            {choices.map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={prediction === value}
                onClick={() => {
                  setPrediction(value);
                  setTested(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span>2. Compare</span>
          <p>
            {topic === "routes"
              ? "Keep the gate open and ditch at 22 m. Compare the bridge route with the north wall route."
              : "Keep the bridge route, closed gate and 22 m ditch fixed. Compare the front corner with and without its projecting tower."}
          </p>
          <button
            type="button"
            className="castle-test"
            disabled={!prediction}
            onClick={compare}
          >
            {topic === "routes"
              ? "Compare open-gate routes"
              : "Compare wall-side views"}
          </button>
          {tested && (
            <div
              className="castle-evidence-controls"
              aria-label="Show evidence"
            >
              {(topic === "routes"
                ? ([
                    ["Show bridge evidence", CASTLE_GATE_COMPARISON[0]],
                    ["Show north evidence", CASTLE_GATE_COMPARISON[1]],
                  ] as const)
                : ([
                    ["Show flat-wall evidence", CASTLE_TOWER_COMPARISON[0]],
                    ["Show tower evidence", CASTLE_TOWER_COMPARISON[1]],
                  ] as const)
              ).map(([label, inputs]) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => onChange(toState(inputs))}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <span>3. Explain</span>
          {tested ? (
            <p
              className="castle-investigation-feedback"
              data-testid="castle-investigation-feedback"
              role="status"
            >
              {feedback}
              {topic === "views" &&
                " The dashed directions are not complete visibility or weapon ranges."}
            </p>
          ) : (
            <p>
              {topic === "routes"
                ? "Predict first. Then use both route endpoints as evidence."
                : "Predict first. Then count the illustrated directions in both views."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
