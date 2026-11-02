import { Text, View } from "react-native";
import {
  POLLINATOR_COMPATIBILITY_TRIAL,
  POLLINATOR_COMPATIBILITY_TARGETS,
  POLLINATOR_FLOWERS,
  POLLINATOR_HABITAT_TRIAL,
  comparePollinatorRoutes,
} from "@family-manager/family-api/discovery-models/pollinators";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { Control, Dot, Line } from "./Primitives";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";
import {
  type NativeCompatibilityPrediction,
  type NativeHabitatPrediction,
  useNativePollinatorLesson,
} from "./pollinator/useNativePollinatorLesson";

const compatibility = comparePollinatorRoutes(
  POLLINATOR_COMPATIBILITY_TRIAL.baseline,
  POLLINATOR_COMPATIBILITY_TRIAL.comparison,
)!;
const habitatEvidence = comparePollinatorRoutes(
  POLLINATOR_HABITAT_TRIAL.baseline,
  POLLINATOR_HABITAT_TRIAL.comparison,
)!;
function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}
    >
      {children}
    </Text>
  );
}

export function PollinatorExploration() {
  const lesson = useNativePollinatorLesson();
  const bee = lesson.journey;
  const source = bee.pollen?.sourceId.startsWith("trial-")
    ? POLLINATOR_COMPATIBILITY_TARGETS[bee.pollen.species].name
    : POLLINATOR_FLOWERS.find((flower) => flower.id === bee.pollen?.sourceId)
        ?.name;
  return (
    <LearningFrame onReset={lesson.reset} resetLabel="Reset lesson">
      <Diagram
        visualState={{
          kind: "garden",
          x: bee.x,
          y: bee.y,
          reach: lesson.reach,
          habitat: lesson.habitat,
          pollen: bee.pollen?.species ?? "none",
          trialSpecies: lesson.trialSpecies,
          received: bee.pollinated.map((id) =>
            id.startsWith("trial-")
              ? 1
              : POLLINATOR_FLOWERS.findIndex((flower) => flower.id === id),
          ),
          path: bee.path,
        }}
        label={`Dimensional teaching garden with enlarged flowers and a bee. Reach ${lesson.reach} invented garden units. ${bee.visits} visits, ${bee.transfers} compatible pollen transfers and ${bee.pollinated.length} receiving flowers. Bridge habitat patch containing Gold and Violet flowers ${lesson.habitat ? "present" : "absent"}. A received-pollen mark does not show fertilization or seeds.`}
      >
        {(width) => {
          const x = (value: number) => 12 + (value / 660) * (width - 24);
          const y = (value: number) => 20 + ((value - 100) / 240) * 160;
          return (
            <>
              {bee.path.slice(1).map((point, index) => (
                <Line
                  key={index}
                  x={x(bee.path[index].x)}
                  y={y(bee.path[index].y)}
                  x2={x(point.x)}
                  y2={y(point.y)}
                  color="#7e8ba4"
                />
              ))}
              {POLLINATOR_FLOWERS.filter(
                (flower) =>
                  !("bridge" in flower && flower.bridge) || lesson.habitat,
              ).map((flower, index) => {
                const species =
                  index === 1 && lesson.trialSpecies !== "none"
                    ? lesson.trialSpecies
                    : flower.species;
                const received =
                  bee.pollinated.includes(flower.id) ||
                  (index === 1 &&
                    bee.pollinated.some((id) => id.startsWith("trial-")));
                return (
                  <Dot
                    key={flower.id}
                    x={x(flower.x)}
                    y={y(flower.y)}
                    size={received ? 19 : 11}
                    color={species === "gold" ? "#ffe49b" : "#d4b5ff"}
                  />
                );
              })}
              <Dot x={x(bee.x)} y={y(bee.y)} size={8} color="#fff9ef" />
              <DiagramLabel x={12} y={192}>
                White bee · larger dots received compatible pollen
              </DiagramLabel>
            </>
          );
        }}
      </Diagram>
      <Explanation>
        {bee.message} Flower visits: {bee.visits} · Compatible transfers:{" "}
        {bee.transfers} · Receiving flowers: {bee.pollinated.length}. Carried
        pollen: {bee.pollen ? `${bee.pollen.species} from ${source}` : "none"}.
      </Explanation>

      <SectionTitle>1 · Change the second flower</SectionTitle>
      <Explanation>
        The bee visits Gold 1 first. Reach 170, the nest, habitat and every
        coordinate stay fixed. Which second flower receives compatible pollen in
        this model?
      </Explanation>
      <Choice
        label="Prediction: receiving flower"
        value={lesson.compatibilityPrediction ?? ""}
        onChange={(value) =>
          lesson.setCompatibilityPrediction(
            value as NativeCompatibilityPrediction,
          )
        }
        options={[
          { value: "gold", label: "Gold trial flower" },
          { value: "violet", label: "Violet trial flower" },
          { value: "neither", label: "Neither flower" },
        ]}
      />
      <ActionButton
        label="Compare the two second flowers"
        disabled={!lesson.compatibilityPrediction}
        onPress={lesson.compareCompatibility}
      />
      {lesson.compatibilityCompared && (
        <>
          <Explanation>
            {lesson.compatibilityPrediction === "gold"
              ? "The evidence matches your prediction. "
              : "The evidence differs from your prediction. "}
            Gold 1 → fixed Gold trial flower: {compatibility.baseline.visits}{" "}
            visits · {compatibility.baseline.transfers} compatible transfer ·{" "}
            {compatibility.baseline.receivedCount} receiving flower. Gold 1 →
            fixed Violet trial flower: {compatibility.comparison.visits} visits
            · {compatibility.comparison.transfers} compatible transfers ·{" "}
            {compatibility.comparison.receivedCount} receiving flowers. Changed:
            trial flower species. Held: its position, start, first flower,
            reach, habitat, coordinates and transfer rule.
          </Explanation>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show Gold trial evidence"
                variant="secondary"
                onPress={lesson.showCompatibilityBaseline}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show Violet trial evidence"
                variant="secondary"
                onPress={lesson.showCompatibilityComparison}
              />
            </View>
          </View>
        </>
      )}

      <SectionTitle>2 · Add a bridge habitat patch</SectionTitle>
      <Explanation>
        The bee starts at the same nest and reach stays 170. The same planned
        route always attempts the Gold bridge stop. Which habitat condition
        reaches Gold 3 under the invented distance rule?
      </Explanation>
      <Choice
        label="Prediction: route that reaches Gold 3"
        value={lesson.habitatPrediction ?? ""}
        onChange={(value) =>
          lesson.setHabitatPrediction(value as NativeHabitatPrediction)
        }
        options={[
          { value: "without", label: "Without habitat" },
          { value: "with", label: "With habitat" },
          { value: "both", label: "Both routes" },
        ]}
      />
      <ActionButton
        label="Compare routes with and without habitat"
        disabled={!lesson.habitatPrediction}
        onPress={lesson.compareHabitat}
      />
      {lesson.habitatCompared && (
        <>
          <Explanation>
            {lesson.habitatPrediction === "with"
              ? "The evidence matches your prediction. "
              : "The evidence differs from your prediction. "}
            Without habitat: Gold 3 blocked · {habitatEvidence.baseline.visits}{" "}
            visits · {habitatEvidence.baseline.transfers} compatible transfer.
            With habitat: Gold 3 reached · {habitatEvidence.comparison.visits}{" "}
            visits · {habitatEvidence.comparison.transfers} compatible
            transfers. Changed: one bridge habitat patch containing a Gold and a
            Violet flower. Held: nest, reach, target, planned route, coordinates
            and transfer rule. The fixed planned route uses the Gold bridge
            stop; the Violet flower is visible but not visited in this trial.
            This is not a population forecast.
          </Explanation>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show blocked route"
                variant="secondary"
                onPress={lesson.showHabitatBaseline}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show connected route"
                variant="secondary"
                onPress={lesson.showHabitatComparison}
              />
            </View>
          </View>
        </>
      )}

      {lesson.explorationUnlocked ? (
        <View style={{ gap: 14 }}>
          <SectionTitle>Explore one change at a time</SectionTitle>
          <Control
            label="Flight reach (garden units)"
            value={lesson.reach}
            min={80}
            max={240}
            step={10}
            onChange={lesson.setReach}
          />
          <ActionButton
            label={
              lesson.habitat
                ? "Remove bridge habitat patch"
                : "Add bridge habitat patch (Gold and Violet)"
            }
            onPress={() => lesson.setHabitat(!lesson.habitat)}
          />
          <ActionButton
            label="Return to nest"
            variant="secondary"
            onPress={lesson.returnToNest}
          />
          {lesson.availableFlowers.map((flower) => (
            <ActionButton
              key={flower.id}
              label={`Visit ${flower.name}`}
              variant="secondary"
              onPress={() => lesson.visit(flower.id)}
            />
          ))}
        </View>
      ) : (
        <Explanation>
          Complete both prediction-first comparisons to unlock reach, habitat
          and flower controls.
        </Explanation>
      )}

      <SectionTitle>Keep the processes separate</SectionTitle>
      <Explanation>
        Pollination is pollen transfer to a flower’s receptive part.
        Fertilization can happen later after pollen-tube growth and the joining
        of sperm and egg cells. Seed dispersal moves formed seeds away from a
        parent plant. This lesson records only pollen transfer.
      </Explanation>
      <ModelNote>
        Every coordinate, flower placement, reach and route is an invented
        deterministic teaching assumption—not an ecological measurement,
        probability or forecast. The bee remembers only the last flower’s
        pollen; real pollinators can carry mixed loads. The same displayed
        flower type is compatible here, but real plants vary in self-pollination
        and compatibility. Pollinators seek resources such as nectar and pollen;
        a plant may receive pollen during a visit, but a visit does not
        guarantee pollination, fertilization, fruit or seeds.
      </ModelNote>
    </LearningFrame>
  );
}
