import { useState } from "react";
import type { CastleState } from "./castleState";
export function CastleInvestigation({
  state,
  onChange,
}: {
  state: CastleState;
  onChange: (state: CastleState) => void;
}) {
  const [topic, setTopic] = useState<"routes" | "views">("routes");
  const [prediction, setPrediction] = useState<string | null>(null),
    [tested, setTested] = useState(false);
  return (
    <section className="castle-investigation" aria-label="Guided comparisons">
      <div className="castle-investigation-tabs">
        <button
          type="button"
          aria-pressed={topic === "routes"}
          onClick={() => {
            setTopic("routes");
            setPrediction(null);
            setTested(false);
          }}
        >
          Compare routes
        </button>
        <button
          type="button"
          aria-pressed={topic === "views"}
          onClick={() => {
            setTopic("views");
            setPrediction(null);
            setTested(false);
          }}
        >
          Compare sight lines
        </button>
      </div>
      <div className="castle-investigation-grid">
        <div>
          <span>1. Predict</span>
          <h3>
            {topic === "routes"
              ? "Does opening the gate open both approaches?"
              : "Can a flat wall give the same view along its base as a projecting tower?"}
          </h3>
          <div className="castle-predictions">
            {["Yes", "No"].map((answer) => (
              <button
                type="button"
                key={answer}
                aria-pressed={prediction === answer}
                onClick={() => {
                  setPrediction(answer);
                  setTested(false);
                }}
              >
                {answer}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span>2. Compare</span>
          <p>
            {topic === "routes"
              ? "Open the gate. Compare the bridge with the north route, keeping the ditch at 22 m."
              : "Keep the route and ditch fixed. Remove the corner towers, then add them back. Follow the dashed sight-line overlay at the front corner."}
          </p>
          <button
            type="button"
            className="castle-test"
            onClick={() => {
              onChange(
                topic === "routes"
                  ? {
                      ...state,
                      moat: 22,
                      gate: false,
                      approach:
                        tested && state.approach === "bridge"
                          ? "north"
                          : "bridge",
                    }
                  : {
                      ...state,
                      towers: tested ? !state.towers : false,
                      sight: true,
                    },
              );
              setTested(true);
            }}
          >
            {topic === "routes"
              ? tested && state.approach === "bridge"
                ? "Compare north route"
                : "Test open gate"
              : tested && !state.towers
                ? "Restore towers"
                : "Remove corner towers"}{" "}
            →
          </button>
        </div>
        <div>
          <span>3. Explain</span>
          <p>
            {tested
              ? topic === "routes"
                ? "The bridge reaches the open entrance. On the north side, the ditch still interrupts the route. Even without a ditch, that route meets a solid wall, not a doorway. Why does an entrance need extra protection?"
                : "A tower projects beyond the wall, giving an observer a position to look along its outside face. The lines show possible views, not weapon range or a guaranteed defense. Why does standing farther out change what is visible?"
              : topic === "routes"
                ? "What still stops the north approach when the gate is open? Use the route endpoint as evidence."
                : "Which part of the wall can an observer on a projecting tower see? Compare the lines with and without towers."}
          </p>
        </div>
      </div>
    </section>
  );
}
