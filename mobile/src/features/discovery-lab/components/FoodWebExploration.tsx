import { useState } from "react";
import {
  initialPond,
  pondWeek,
  type PondState,
} from "@family-manager/family-api/discovery-models/physical-world";
import { ActionButton } from "../../../components/ActionButton";
import { Control, Dot, Line } from "./Primitives";
import {
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "./LearningPrimitives";

export function FoodWebExploration() {
  const [pond, setPond] = useState<PondState>({ ...initialPond });
  const [nutrients, setNutrients] = useState(50);
  const [drought, setDrought] = useState(0);
  const [week, setWeek] = useState(0);
  return (
    <LearningFrame
      onReset={() => {
        setPond({ ...initialPond });
        setNutrients(50);
        setDrought(0);
        setWeek(0);
      }}
    >
      <Diagram
        visualState={{ kind: "pond", ...pond, drought, nutrients }}
        label="Food moves from algae to zooplankton to fish. Nutrients feed algae. All populations depend on pond conditions."
      >
        {(width) => (
          <>
            <DiagramLabel x={15} y={12}>
              Food → consumer · week {week}
            </DiagramLabel>
            {["Algae", "Zooplankton", "Fish"].map((label, i) => (
              <DiagramLabel key={label} x={12 + (i * (width - 40)) / 3} y={155}>
                {label}
              </DiagramLabel>
            ))}
            {[pond.algae, pond.zooplankton, pond.fish].map((value, i) => (
              <Dot
                key={i}
                x={40 + (i * (width - 80)) / 2}
                y={100}
                size={value > 0 ? 12 + value * 0.45 : 0}
                color={["#8bdda1", "#e2b3ff", "#ffce87"][i]}
              />
            ))}
            <Line x={60} y={100} x2={width / 2 - 25} y2={100} />
            <Line x={width / 2 + 25} y={100} x2={width - 60} y2={100} />
          </>
        )}
      </Diagram>
      <Meter label="Algae population index" value={pond.algae} />
      <Meter
        label="Zooplankton population index"
        value={pond.zooplankton}
        color="#8158a3"
      />
      <Meter label="Fish population index" value={pond.fish} color="#a46b22" />
      <Meter
        label="Dissolved oxygen index"
        value={pond.oxygen}
        color="#256c9a"
      />
      <Explanation>
        Week {week}. Fish eat zooplankton; zooplankton graze algae. A nutrient
        increase can feed algae, but a large bloom and drought can lower oxygen.
        Population responses take time.
      </Explanation>
      <Control
        label="Nutrient input"
        value={nutrients}
        min={0}
        max={100}
        step={10}
        onChange={setNutrients}
      />
      <Control
        label="Drought severity"
        value={drought}
        min={0}
        max={100}
        step={10}
        onChange={setDrought}
      />
      {(["algae", "zooplankton", "fish"] as const).map((species) => (
        <ActionButton
          key={species}
          label={`${pond[species] > 0 ? "Remove" : "Restore"} ${species}`}
          variant="secondary"
          onPress={() =>
            setPond({
              ...pond,
              [species]: pond[species] > 0 ? 0 : initialPond[species],
            })
          }
        />
      ))}
      <ActionButton
        label="Advance one week"
        onPress={() => {
          setPond((state) => pondWeek(state, { nutrients, drought }));
          setWeek(week + 1);
        }}
      />
      <ModelNote>
        These are relative population and oxygen indices, not animal counts or
        measured concentrations. One step represents an illustrative week. The
        model excludes migration, other species, and seasons; a removed
        population does not return unless restored.
      </ModelNote>
    </LearningFrame>
  );
}
