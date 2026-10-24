import { useState } from "react";
import {
  initialPollinator,
  POLLINATOR_FLOWERS,
  visitFlower,
} from "@family-manager/family-api/discovery-models/math-life";
import { Slider } from "./SimulationPrimitives";
import {
  LandscapeExhibit,
  LandscapeInvestigation,
  LandscapeMetric,
} from "./landscape/LandscapeExhibit";
export function PollinatorSimulation() {
  const [state, setState] = useState(initialPollinator),
    [reach, setReach] = useState(170),
    [habitat, setHabitat] = useState(false);
  const flowers = POLLINATOR_FLOWERS.filter(
      (flower) => habitat || !flower.bridge,
    ),
    visit = (id: string) =>
      setState((current) => visitFlower(current, id, reach, habitat));
  const reset = () => {
    setState(initialPollinator());
    setReach(170);
    setHabitat(false);
  };
  const pollen = state.pollen
    ? state.pollen.species === "gold"
      ? "Gold-flower pollen"
      : "Violet-flower pollen"
    : "None yet";
  return (
    <LandscapeExhibit
      title="Does a flower visit transfer useful pollen?"
      introduction="Choose a flower in the garden or use its button. Follow the bee's reach and the pollen it carries."
      state={{
        kind: "garden",
        x: state.x,
        y: state.y,
        reach,
        habitat,
        pollen: state.pollen?.species ?? "none",
        received: state.pollinated.map((id) =>
          POLLINATOR_FLOWERS.findIndex((flower) => flower.id === id),
        ),
        path: state.path,
      }}
      onSelect={(index) => {
        const flower = POLLINATOR_FLOWERS[index];
        if (flower) visit(flower.id);
      }}
      description={`Two flower patches ${habitat ? "connected by extra habitat" : "separated by a gap"}. Bee position ${state.x}, ${state.y}; flight reach ${reach} garden units. ${state.visits} visits, ${state.transfers} compatible transfers. Pollen carried: ${pollen}. ${state.message}`}
      controls={
        <>
          <Slider
            label="Flight reach"
            value={reach}
            min={80}
            max={240}
            step={10}
            unit=" garden units"
            onChange={setReach}
          />
          <div className="landscape-control-group">
            <label className="landscape-switches">
              <span>
                <input
                  type="checkbox"
                  checked={habitat}
                  onChange={(event) => {
                    setHabitat(event.target.checked);
                    setState(initialPollinator());
                  }}
                />{" "}
                Add habitat patches
              </span>
            </label>
            <small>Changing habitat starts a fresh journey.</small>
          </div>
          <div className="landscape-actions">
            <button type="button" onClick={() => setState(initialPollinator())}>
              Return to nest
            </button>
            <button type="button" onClick={reset}>
              Reset
            </button>
          </div>
          <div
            className="landscape-flower-controls"
            role="group"
            aria-label="Visit a flower"
          >
            {flowers.map((flower) => {
              const distance = Math.hypot(
                flower.x - state.x,
                flower.y - state.y,
              );
              return (
                <button
                  key={flower.id}
                  type="button"
                  aria-label={`Visit ${flower.name}`}
                  data-species={flower.species}
                  onClick={() => visit(flower.id)}
                >
                  {flower.name}
                  {state.pollinated.includes(flower.id) ? " ✓" : ""}
                  <small>
                    {distance <= reach ? "Within reach" : "Beyond reach"} ·{" "}
                    {Math.round(distance)} units
                  </small>
                </button>
              );
            })}
          </div>
        </>
      }
      evidence={
        <>
          <div className="landscape-metrics">
            <LandscapeMetric label="Flower visits" value={`${state.visits}`} />
            <LandscapeMetric
              label="Compatible transfers"
              value={`${state.transfers}`}
            />
            <LandscapeMetric
              label="Flowers receiving pollen"
              value={`${state.pollinated.length}`}
            />
            <LandscapeMetric label="Pollen carried" value={pollen} />
          </div>
          <div className="landscape-observation" role="status">
            <strong>{state.message}</strong>
            <br />
            Flower visits: <strong>{state.visits}</strong> · Compatible
            transfers: <strong>{state.transfers}</strong> · Flowers receiving
            pollen: <strong>{state.pollinated.length}</strong>.<br />
            Dashed circle: maximum reach from the current position. A pale ring
            and ✓ mark compatible pollen received, not seeds produced.
          </div>
        </>
      }
      investigations={
        <LandscapeInvestigation
          items={[
            {
              label: "Connect habitat",
              predict:
                "At reach 170, can the bee cross the gap without extra flowers?",
              options: ["Yes", "No"],
              action:
                "Visit Gold 1 → Gold 2 → Gold 3. Then add habitat patches and repeat Gold 1 → Gold 2 → Gold bridge → Gold 3. Keep reach at 170.",
              explain:
                "Each flight must be short enough from the bee's current position. Which new stopping place connects the patches? Compare reach, not just the total journey length.",
              test: reset,
              testLabel: "Start without habitat",
            },
            {
              label: "Compare pollen",
              predict: "Will Gold 1 → Violet 1 give a compatible transfer?",
              options: ["Yes", "No"],
              action:
                "From the nest at reach 170, compare Gold 1 → Gold 2 with Gold 1 → Violet 1. Return to the nest between trials; keep the same habitat and reach.",
              explain:
                "A different flower of the same species can receive compatible pollen. A visit to another species is not the same thing. What did the visit count miss?",
              test: reset,
              testLabel: "Start pollen comparison",
            },
          ]}
        />
      }
      note="Garden units are schematic, not real flight distances. The bee carries only its last flower's pollen; real bees carry mixed loads. Compatible transfer requires a different flower of the same species here and does not guarantee fertilization or seeds. Flight reach and flower positions are teaching assumptions. Flower forms and bee size are enlarged to show pollen movement."
    />
  );
}
