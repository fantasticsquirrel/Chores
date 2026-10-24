import { useState } from "react";
import {
  POLLINATOR_FLOWERS,
  initialPollinator,
  visitFlower,
} from "@family-manager/family-api/discovery-models/math-life";
import { ActionButton } from "../../../components/ActionButton";
import { Control, Dot, Line } from "./Primitives";
import {
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";

export function PollinatorExploration() {
  const [bee, setBee] = useState(initialPollinator);
  const [reach, setReach] = useState(170);
  const [habitat, setHabitat] = useState(false);
  return (
    <LearningFrame
      onReset={() => {
        setBee(initialPollinator());
        setReach(170);
        setHabitat(false);
      }}
    >
      <Diagram
        visualState={{
          kind: "garden",
          x: bee.x,
          y: bee.y,
          reach,
          habitat,
          pollen: bee.pollen?.species ?? "none",
          received: bee.pollinated.map((id) =>
            POLLINATOR_FLOWERS.findIndex((f) => f.id === id),
          ),
          path: bee.path,
        }}
        label={`Bee carrying ${bee.pollen?.species ?? "no"} pollen. ${bee.visits} visits, ${bee.transfers} compatible transfers, ${bee.pollinated.length} different flowers pollinated. Habitat ${habitat ? "connected" : "disconnected"}.`}
      >
        {(width) => {
          const x = (value: number) => 12 + (value / 660) * (width - 24),
            y = (value: number) => 20 + ((value - 100) / 240) * 160;
          return (
            <>
              {bee.path.slice(1).map((point, i) => (
                <Line
                  key={i}
                  x={x(bee.path[i].x)}
                  y={y(bee.path[i].y)}
                  x2={x(point.x)}
                  y2={y(point.y)}
                  color="#7e8ba4"
                />
              ))}
              {POLLINATOR_FLOWERS.filter(
                (flower) => !flower.bridge || habitat,
              ).map((flower) => (
                <Dot
                  key={flower.id}
                  x={x(flower.x)}
                  y={y(flower.y)}
                  size={bee.pollinated.includes(flower.id) ? 19 : 11}
                  color={flower.species === "gold" ? "#ffe49b" : "#d4b5ff"}
                />
              ))}
              <Dot x={x(bee.x)} y={y(bee.y)} size={8} color="#fff9ef" />
              <DiagramLabel x={12} y={192}>
                White bee · larger flowers received pollen
              </DiagramLabel>
            </>
          );
        }}
      </Diagram>
      <Explanation>{bee.message}</Explanation>
      <Explanation>
        {bee.visits} flower visits; {bee.transfers} compatible pollen transfers;{" "}
        {bee.pollinated.length} different flowers received compatible pollen.
        Carried pollen: {bee.pollen?.species ?? "none"}.
      </Explanation>
      <Control
        label="Flight reach (plot units)"
        value={reach}
        min={80}
        max={240}
        step={10}
        onChange={setReach}
      />
      <ActionButton
        label={habitat ? "Remove habitat patches" : "Add habitat patches"}
        onPress={() => setHabitat(!habitat)}
      />
      {POLLINATOR_FLOWERS.filter((flower) => !flower.bridge || habitat).map(
        (flower) => (
          <ActionButton
            key={flower.id}
            label={`Visit ${flower.name}`}
            variant="secondary"
            onPress={() =>
              setBee((state) => visitFlower(state, flower.id, reach, habitat))
            }
          />
        ),
      )}
      <ModelNote>
        A visit is not necessarily pollination. This model requires pollen from
        a different flower of the same species. New flowers provide stepping
        stones within flight reach. Real plants vary in self-pollination,
        pollinator needs, and pollen compatibility.
      </ModelNote>
    </LearningFrame>
  );
}
