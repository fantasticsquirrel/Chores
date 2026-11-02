import { Fragment, useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
  POND_DEFAULT_CONDITIONS,
  POND_INITIAL_STATE,
  POND_NUTRIENT_COMPARISON,
  POND_PREDATOR_COMPARISON,
  advancePondWeek,
  comparePondScenarios,
  normalizePondConditions,
  pondStateAtPhase,
  runPondTrial,
  type PondConditions,
  type PondScenario,
  type PondState,
} from "@family-manager/family-api/discovery-models/pond";
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

type PredatorPrediction = "" | "cascade" | "algae-up" | "unchanged";
type NutrientPrediction = "" | "fish-lower" | "all-higher" | "same";
type Trial = { week: number; pond: PondState; trail: PondState[] };
const species = ["algae", "zooplankton", "fish"] as const;
const predatorEvidence = POND_PREDATOR_COMPARISON.map((scenario) =>
  runPondTrial(scenario),
);
const nutrientEvidence = POND_NUTRIENT_COMPARISON.map((scenario) =>
  runPondTrial(scenario),
);
const predatorVariables = comparePondScenarios(...POND_PREDATOR_COMPARISON);
const nutrientVariables = comparePondScenarios(...POND_NUTRIENT_COMPARISON);
const freshTrial = (): Trial => ({
  week: 0,
  pond: { ...POND_INITIAL_STATE },
  trail: [{ ...POND_INITIAL_STATE }],
});

function readings(label: string, result: (typeof predatorEvidence)[number]) {
  const state = result.state;
  return `${label}: algae ${state.algae.toFixed(1)} · zooplankton ${state.zooplankton.toFixed(1)} · fish ${state.fish.toFixed(1)} · oxygen ${state.oxygen.toFixed(1)} · detritus ${state.detritus.toFixed(1)}`;
}

export function FoodWebExploration() {
  const [trial, setTrial] = useState<Trial>(freshTrial);
  const [conditions, setConditions] = useState<PondConditions>({
    ...POND_DEFAULT_CONDITIONS,
  });
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [predatorPrediction, setPredatorPrediction] =
    useState<PredatorPrediction>("");
  const [nutrientPrediction, setNutrientPrediction] =
    useState<NutrientPrediction>("");
  const [predatorComplete, setPredatorComplete] = useState(false);
  const [nutrientComplete, setNutrientComplete] = useState(false);
  const freeExploration = predatorComplete && nutrientComplete;
  const visual = pondStateAtPhase(trial.pond, conditions, phase / 100);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setPhase((current) => (current + 8) % 100),
      280,
    );
    return () => clearInterval(timer);
  }, [playing]);

  const stopMarkers = () => {
    setPhase(0);
    setPlaying(false);
  };
  const showTrial = (scenario: PondScenario) => {
    const result = runPondTrial(scenario);
    setTrial({ week: result.week, pond: result.state, trail: result.trail });
    setConditions({ ...result.conditions });
    stopMarkers();
  };
  const reset = () => {
    setTrial(freshTrial());
    setConditions({ ...POND_DEFAULT_CONDITIONS });
    stopMarkers();
    setPredatorPrediction("");
    setNutrientPrediction("");
    setPredatorComplete(false);
    setNutrientComplete(false);
  };

  return (
    <LearningFrame onReset={reset}>
      <Diagram
        visualState={{ kind: "pond", ...visual }}
        label={`Dimensional pond at model week ${trial.week}. Algae ${trial.pond.algae.toFixed(1)}, zooplankton ${trial.pond.zooplankton.toFixed(1)}, fish ${trial.pond.fish.toFixed(1)}, net oxygen ${trial.pond.oxygen.toFixed(1)}, and detritus ${trial.pond.detritus.toFixed(1)}; all are relative indices. Nutrient supply index ${conditions.nutrients} and drought severity ${conditions.drought} percent. Energy-flow arrows point algae to zooplankton to fish, from resource or prey toward consumer; they do not show animals moving.`}
      >
        {(width) => (
          <>
            <DiagramLabel x={15} y={12}>
              Energy: resource → consumer · week {trial.week}
            </DiagramLabel>
            {species.map((name, index) => {
              const x = 45 + (index * (width - 90)) / 2;
              const value = trial.pond[name];
              return (
                <Fragment key={name}>
                  <Dot
                    x={x}
                    y={105}
                    size={value > 0 ? 12 + value * 0.42 : 0}
                    color={["#8bdda1", "#e2b3ff", "#ffce87"][index]}
                  />
                  <DiagramLabel x={x - 20} y={155}>
                    {name === "zooplankton"
                      ? "Zooplankton"
                      : name[0].toUpperCase() + name.slice(1)}
                  </DiagramLabel>
                </Fragment>
              );
            })}
            {trial.pond.algae > 0 && trial.pond.zooplankton > 0 && (
              <>
                <Line
                  x={72}
                  y={105}
                  x2={width / 2 - 32}
                  y2={105}
                  color="#f2c85a"
                />
                <Dot
                  x={72 + ((width / 2 - 104) * phase) / 100}
                  y={105}
                  size={7}
                  color="#fff1a8"
                />
                <DiagramLabel x={width / 2 - 48} y={76}>
                  →
                </DiagramLabel>
              </>
            )}
            {trial.pond.zooplankton > 0 && trial.pond.fish > 0 && (
              <>
                <Line
                  x={width / 2 + 32}
                  y={105}
                  x2={width - 72}
                  y2={105}
                  color="#f2c85a"
                />
                <Dot
                  x={width / 2 + 32 + ((width / 2 - 104) * phase) / 100}
                  y={105}
                  size={7}
                  color="#fff1a8"
                />
                <DiagramLabel x={width - 78} y={76}>
                  →
                </DiagramLabel>
              </>
            )}
          </>
        )}
      </Diagram>

      <Meter label="Algae population index" value={trial.pond.algae} />
      <Meter
        label="Zooplankton population index"
        value={trial.pond.zooplankton}
        color="#8158a3"
      />
      <Meter
        label="Fish population index"
        value={trial.pond.fish}
        color="#a46b22"
      />
      <Meter
        label="Net oxygen index"
        value={trial.pond.oxygen}
        color="#256c9a"
      />
      <Meter
        label="Detritus index"
        value={trial.pond.detritus}
        color="#80603c"
      />
      <Explanation>
        Week {trial.week}. Arrows trace modeled energy flow from food to
        consumer—not organism movement. All readings are 0–100 relative indices;
        population responses occur only when model time advances.
      </Explanation>

      <Text accessibilityRole="header">1. Remove a consumer</Text>
      <Explanation>
        Keep nutrient supply at 50, drought at 0%, and every other starting
        index the same. After 6 model weeks, what changes when fish are absent?
      </Explanation>
      <Choice
        label="Your consumer-removal prediction"
        value={predatorPrediction}
        onChange={(value) => {
          setPredatorPrediction(value);
          setPredatorComplete(false);
          stopMarkers();
        }}
        options={[
          { value: "cascade", label: "Zooplankton rises and algae falls" },
          { value: "algae-up", label: "Algae and zooplankton both rise" },
          { value: "unchanged", label: "Only fish changes" },
        ]}
      />
      <ActionButton
        label="Compare fish present and absent"
        disabled={!predatorPrediction || predatorComplete}
        onPress={() => {
          setPredatorComplete(true);
          showTrial(POND_PREDATOR_COMPARISON[1]);
        }}
      />
      {predatorComplete && (
        <>
          <Explanation>
            The evidence{" "}
            {predatorPrediction === "cascade" ? "matches" : "differs from"} your
            prediction. {readings("Fish present", predatorEvidence[0])}.{" "}
            {readings("Fish absent", predatorEvidence[1])}. Changed:{" "}
            {predatorVariables.changed.join(", ")}. Held:{" "}
            {predatorVariables.held.join(" · ")}. With no fish predation,
            grazers rise and grazing pushes algae lower.
          </Explanation>
          <View>
            <ActionButton
              label="Show fish-present evidence"
              variant="secondary"
              onPress={() => showTrial(POND_PREDATOR_COMPARISON[0])}
            />
            <ActionButton
              label="Show fish-absent evidence"
              variant="secondary"
              onPress={() => showTrial(POND_PREDATOR_COMPARISON[1])}
            />
          </View>
        </>
      )}

      <Text accessibilityRole="header">2. Increase nutrient supply</Text>
      <Explanation>
        Keep drought at 60%, every population present, and all starting indices
        the same. After 8 model weeks, what changes from nutrient index 20 to
        100?
      </Explanation>
      <Choice
        label="Your nutrient prediction"
        value={nutrientPrediction}
        onChange={(value) => {
          setNutrientPrediction(value);
          setNutrientComplete(false);
          stopMarkers();
        }}
        options={[
          { value: "fish-lower", label: "Fish and oxygen both finish lower" },
          { value: "all-higher", label: "Every index finishes higher" },
          { value: "same", label: "Nutrients make no difference" },
        ]}
      />
      <ActionButton
        label="Compare low and high nutrients"
        disabled={!nutrientPrediction || nutrientComplete}
        onPress={() => {
          setNutrientComplete(true);
          showTrial(POND_NUTRIENT_COMPARISON[1]);
        }}
      />
      {nutrientComplete && (
        <>
          <Explanation>
            The evidence{" "}
            {nutrientPrediction === "fish-lower" ? "matches" : "differs from"}{" "}
            your prediction. {readings("Low nutrients", nutrientEvidence[0])}.{" "}
            {readings("High nutrients", nutrientEvidence[1])}. Changed:{" "}
            {nutrientVariables.changed.join(", ")}. Held:{" "}
            {nutrientVariables.held.join(" · ")}. Added nutrients support more
            algae in this model; algal turnover and detritus are linked to lower
            net oxygen. This is not a real-pond forecast.
          </Explanation>
          <View>
            <ActionButton
              label="Show low-nutrient evidence"
              variant="secondary"
              onPress={() => showTrial(POND_NUTRIENT_COMPARISON[0])}
            />
            <ActionButton
              label="Show high-nutrient evidence"
              variant="secondary"
              onPress={() => showTrial(POND_NUTRIENT_COMPARISON[1])}
            />
          </View>
        </>
      )}

      {freeExploration && (
        <>
          <Text accessibilityRole="header">3. Explore one variable</Text>
          <Explanation>
            Reset before a new comparison, change one input, and advance equal
            numbers of illustrative weeks.
          </Explanation>
          <Control
            label="Nutrient supply index"
            value={conditions.nutrients}
            min={0}
            max={100}
            step={10}
            onChange={(nutrients) => {
              setConditions((current) =>
                normalizePondConditions({ ...current, nutrients }),
              );
              setPlaying(false);
            }}
          />
          <Control
            label="Drought severity (%)"
            value={conditions.drought}
            min={0}
            max={100}
            step={10}
            onChange={(drought) => {
              setConditions((current) =>
                normalizePondConditions({ ...current, drought }),
              );
              setPlaying(false);
            }}
          />
          {species.map((name) => (
            <ActionButton
              key={name}
              label={`${trial.pond[name] > 0 ? "Remove" : "Restore"} ${name}`}
              variant="secondary"
              onPress={() => {
                setTrial((current) => {
                  const pond = {
                    ...current.pond,
                    [name]:
                      current.pond[name] > 0 ? 0 : POND_INITIAL_STATE[name],
                  };
                  return {
                    ...current,
                    pond,
                    trail: [...current.trail.slice(0, -1), pond],
                  };
                });
                setPlaying(false);
              }}
            />
          ))}
          <ActionButton
            label="Advance one week"
            onPress={() => {
              setTrial((current) => {
                const pond = advancePondWeek(current.pond, conditions).state;
                return {
                  week: current.week + 1,
                  pond,
                  trail: [...current.trail.slice(-20), pond],
                };
              });
              setPlaying(false);
            }}
          />
          <Control
            label="Energy-flow marker phase (%)"
            value={phase}
            min={0}
            max={100}
            step={5}
            onChange={(value) => {
              setPhase(value);
              setPlaying(false);
            }}
          />
          <ActionButton
            label={playing ? "Pause energy flow" : "Play energy flow"}
            variant="secondary"
            onPress={() => setPlaying((current) => !current)}
          />
          <ActionButton
            label="Start markers"
            variant="secondary"
            onPress={stopMarkers}
          />
          <Explanation>
            Motion is optional and starts paused. Markers show direction only,
            not energy amount, organism movement, or animal speed.
          </Explanation>
        </>
      )}

      <ModelNote>
        Model boundary: one algae–grazer–fish chain inside a larger food web.
        The 0–100 population, nutrient, oxygen, and detritus indices; weekly
        step; and coefficients are invented bounded teaching quantities—not
        counts, concentrations, measured rates, or forecasts. Oxygen is a
        simplified net-balance index. Real outcomes also depend on temperature,
        light, mixing, nutrient form, species, and other processes. The native
        fallback diagram is simplified; downloaded offline scenes retain the
        dimensional pond geometry used by web and package builds.
      </ModelNote>
    </LearningFrame>
  );
}
