import { useId, useState } from "react";
import {
  bridge,
  type BridgeMaterial,
} from "@family-manager/family-api/discovery-models/physical-world";
import { Slider } from "./SimulationPrimitives";
import { BridgeDrawing } from "./BridgeDrawing";
import {
  PhysicalLayout,
  PhysicalStage,
} from "./physical-exhibits/PhysicalStage";
import "./physical-exhibits/physical-exhibits.css";
export function BridgeBuilderSimulation() {
  const materialId = useId();
  const [material, setMaterial] = useState<BridgeMaterial>("timber"),
    [braces, setBraces] = useState([false, false, false, false]);
  const [load, setLoad] = useState(10),
    [position, setPosition] = useState(50);
  const result = bridge(material, braces, load, position);
  const toggleBrace = (index: number) =>
    setBraces((current) => current.map((on, i) => (i === index ? !on : on)));
  const reset = () => {
    setMaterial("timber");
    setBraces([false, false, false, false]);
    setLoad(10);
    setPosition(50);
  };
  return (
    <PhysicalLayout
      question="Before moving the truck left, predict which support will carry more load. Then keep the truck still and reinforce only the section with the greatest capacity use. What changes?"
      explanation="The two upward support forces add to the downward load. Moving the load left increases the left reaction. Bending is greatest beneath the load; reinforcement raises a section’s illustrative capacity, not the applied force."
      caveat="10 m simply supported beam, one static point load. The truss is a visual structure, not a solved truss: colored beam capacity use, brace benefits and credit costs are illustrative. Truck weight is represented by one point; self-weight, joints, buckling and moving-load effects are omitted. This is not a safety rating."
      controls={
        <>
          <div className="dl-physical-control-group">
            <Slider
              label="Load position"
              value={position}
              min={5}
              max={95}
              unit="%"
              onChange={setPosition}
            />
            <div className="dl-physical-shortcuts">
              <button
                type="button"
                aria-label="Move load toward left bank"
                onClick={() => setPosition(15)}
              >
                Left bank
              </button>
              <button
                type="button"
                aria-label="Move load to center"
                onClick={() => setPosition(50)}
              >
                Center
              </button>
              <button
                type="button"
                aria-label="Move load toward right bank"
                onClick={() => setPosition(85)}
              >
                Right bank
              </button>
            </div>
          </div>
          <div className="dl-physical-control-group">
            <Slider
              label="Point load"
              value={load}
              min={0}
              max={30}
              unit=" kN"
              onChange={setLoad}
            />
            <div>
              <label className="dl-physical-select-label" htmlFor={materialId}>
                Beam material
              </label>
              <select
                id={materialId}
                value={material}
                onChange={(event) =>
                  setMaterial(event.target.value as BridgeMaterial)
                }
              >
                <option value="timber">Timber · 80 credits</option>
                <option value="steel">Steel · 240 credits</option>
              </select>
            </div>
          </div>
          <div className="dl-physical-control-group">
            <div className="dl-physical-number">
              <strong>
                <output aria-label="Build cost">
                  {result.cost} / 400 credits
                </output>
              </strong>
              <small>
                {result.cost > 400
                  ? "Over the 400-credit budget"
                  : "Budget for the beam and reinforcement"}
              </small>
            </div>
            <div className="dl-actions">
              <button type="button" onClick={reset}>
                Reset
              </button>
            </div>
          </div>
        </>
      }
      readout={
        <>
          <span>
            Peak bending moment:{" "}
            <strong>{result.maxMoment.toFixed(1)} kN·m</strong>
          </span>
          <span>
            {result.maxUtilization > 1
              ? "At least one section exceeds its modeled capacity. Reinforce it or reduce the load."
              : "All sections are within this model’s capacity. Compare the cost of a lighter design."}
          </span>
        </>
      }
    >
      <PhysicalStage
        state={{
          kind: "bridge",
          material,
          braces,
          load,
          position,
          utilization: result.utilization,
          leftReaction: result.leftReaction,
          rightReaction: result.rightReaction,
        }}
        onAction={(action) => {
          if (action.type === "position") setPosition(action.value);
        }}
        description={`Four-section ${material} bridge over a river. Truck load ${load} kilonewtons at ${position} percent of the 10 meter span. Left support ${result.leftReaction.toFixed(1)} kilonewtons; right support ${result.rightReaction.toFixed(1)}. Colored lower beams show illustrative capacity use.`}
        fallback={
          <BridgeDrawing
            material={material}
            braces={braces}
            load={load}
            position={position}
            result={result}
          />
        }
        header={
          <div className="dl-physical-header">
            <div>
              <h3>
                {load} kN at{" "}
                {position === 50 ? "midspan" : `${position}% of the span`}
              </h3>
              <p>
                Drag the truck along the deck. Select a section below to add a
                diagonal brace.
              </p>
            </div>
            <div className="dl-physical-number">
              <strong>
                <output aria-label="Peak capacity use">
                  {Math.round(result.maxUtilization * 100)}%
                </output>
              </strong>
              <small>peak modeled capacity use</small>
            </div>
          </div>
        }
      >
        <div className="dl-physical-reactions">
          <div>
            Left support ↑
            <output aria-label="Left support force">
              {result.leftReaction.toFixed(1)} kN
            </output>
          </div>
          <span>10 m span · load supported at both ends</span>
          <div>
            Right support ↑
            <output aria-label="Right support force">
              {result.rightReaction.toFixed(1)} kN
            </output>
          </div>
        </div>
        <div className="dl-physical-strip">
          {braces.map((on, i) => (
            <button
              type="button"
              key={i}
              aria-label={`Brace section ${i + 1}`}
              aria-pressed={on}
              aria-describedby={`${materialId}-capacity-${i}`}
              data-stress={
                result.utilization[i] > 1
                  ? "high"
                  : result.utilization[i] > 0.7
                    ? "medium"
                    : "low"
              }
              onClick={() => toggleBrace(i)}
            >
              <strong>
                Section {i + 1}
                <span
                  className="dl-physical-stress"
                  id={`${materialId}-capacity-${i}`}
                >
                  {Math.round(result.utilization[i] * 100)}%
                </span>
              </strong>
              <span>
                {on ? "Diagonal added · remove" : "Add diagonal reinforcement"}
              </span>
            </button>
          ))}
        </div>
      </PhysicalStage>
    </PhysicalLayout>
  );
}
