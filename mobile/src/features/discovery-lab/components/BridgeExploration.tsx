import { useState } from "react";
import { bridge } from "@family-manager/family-api/discovery-models/physical-world";
import { ActionButton } from "../../../components/ActionButton";
import { Control, Dot, Line } from "./Primitives";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "./LearningPrimitives";

export function BridgeExploration() {
  const [material, setMaterial] = useState<"timber" | "steel">("timber");
  const [braces, setBraces] = useState([false, false, false, false]);
  const [load, setLoad] = useState(20);
  const [position, setPosition] = useState(50);
  const [budget, setBudget] = useState(300);
  const model = bridge(material, braces, load, position);
  return (
    <LearningFrame
      onReset={() => {
        setMaterial("timber");
        setBraces([false, false, false, false]);
        setLoad(20);
        setPosition(50);
        setBudget(300);
      }}
    >
      <Diagram
        visualState={{
          kind: "bridge",
          material,
          braces,
          load,
          position,
          utilization: model.utilization,
          leftReaction: model.leftReaction,
          rightReaction: model.rightReaction,
        }}
        label={`Bridge with ${braces.filter(Boolean).length} reinforced zones. Load ${load} kN at ${position}% of the span. Support reactions ${model.leftReaction.toFixed(1)} and ${model.rightReaction.toFixed(1)} kN.`}
      >
        {(width) => (
          <>
            <Line x={20} y={160} x2={width - 20} y2={160} color="#b3bdcc" />
            {[0, 1, 2, 3].map((i) => {
              const x = 20 + (i * (width - 40)) / 4,
                next = 20 + ((i + 1) * (width - 40)) / 4;
              return (
                <Line
                  key={i}
                  x={x}
                  y={130}
                  x2={next}
                  y2={130}
                  color={model.utilization[i] > 1 ? "#ff9e8c" : "#8be3d5"}
                />
              );
            })}
            {braces.map((present, i) =>
              present ? (
                <Line
                  key={i}
                  x={20 + (i * (width - 40)) / 4}
                  y={160}
                  x2={20 + ((i + 1) * (width - 40)) / 4}
                  y2={130}
                  color="#ffe49b"
                />
              ) : null,
            )}
            <Line x={20} y={130} x2={20} y2={190} />
            <Line x={width - 20} y={130} x2={width - 20} y2={190} />
            <Dot
              x={20 + (position / 100) * (width - 40)}
              y={114}
              size={22}
              color="#ffe49b"
            />
            <DiagramLabel x={15} y={15}>
              10 m span · {load} kN load
            </DiagramLabel>
            <DiagramLabel x={15} y={193}>
              Left {model.leftReaction.toFixed(1)} kN · Right{" "}
              {model.rightReaction.toFixed(1)} kN
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        Peak bending moment: {model.maxMoment.toFixed(1)} kN·m. Highest
        stress-to-capacity ratio: {model.maxUtilization.toFixed(2)}.{" "}
        {model.maxUtilization > 1
          ? "At least one zone exceeds its model capacity."
          : "All zones are within their model capacity."}
      </Explanation>
      {model.utilization.map((value, i) => (
        <Meter
          key={i}
          label={`Zone ${i + 1} stress / capacity`}
          value={value * 100}
          max={200}
          detail={`${value.toFixed(2)} (limit 1.00)`}
          color={value > 1 ? "#ad3d2e" : "#217d69"}
        />
      ))}
      <Choice
        label="Beam material"
        value={material}
        onChange={setMaterial}
        options={[
          { value: "timber", label: "Timber" },
          { value: "steel", label: "Steel" },
        ]}
      />
      {braces.map((present, i) => (
        <ActionButton
          key={i}
          label={`${present ? "Remove" : "Add"} zone ${i + 1} reinforcement`}
          variant="secondary"
          onPress={() =>
            setBraces(braces.map((value, j) => (j === i ? !value : value)))
          }
        />
      ))}
      <Control
        label="Vehicle load"
        value={load}
        min={0}
        max={100}
        step={10}
        onChange={setLoad}
      />
      <Control
        label="Load position (%)"
        value={position}
        min={0}
        max={100}
        step={10}
        onChange={setPosition}
      />
      <Control
        label="Material budget"
        value={budget}
        min={100}
        max={1000}
        step={100}
        onChange={setBudget}
      />
      <Explanation>
        Materials cost {model.cost} units.{" "}
        {model.cost > budget
          ? `${model.cost - budget} units over budget.`
          : `${budget - model.cost} units remain.`}{" "}
        Adding reinforcement changes strength and cost, not the total downward
        load.
      </Explanation>
      <ModelNote>
        Single-load, simply supported beam model. Capacity and cost are
        illustrative; real bridge design also checks deflection, buckling,
        fatigue, connections, and safety factors.
      </ModelNote>
    </LearningFrame>
  );
}
