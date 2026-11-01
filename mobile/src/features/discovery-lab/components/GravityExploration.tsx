import { useState } from "react";
import { Text, View } from "react-native";
import {
  GRAVITY_MASS_COMPARISON,
  GRAVITY_WORLD_COMPARISON,
  GRAVITY_WORLDS,
  gravityDropActivity,
  gravityDropAtTime,
  type GravityDropInputs,
  type GravityWorldId,
} from "@family-manager/family-api/discovery-models/gravity";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { Control, Dot, Line } from "./Primitives";
import {
  Choice,
  Diagram,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";

type MassPrediction = "" | "light" | "heavy" | "same";
type WorldPrediction = "" | "earth" | "moon" | "same";
type Comparison = "mass" | "world" | "open";
type Trial = { label: string; inputs: GravityDropInputs };

const massTrials: readonly [Trial, Trial] = [
  { label: "Earth · 1 kg", inputs: GRAVITY_MASS_COMPARISON[0] },
  { label: "Earth · 10 kg", inputs: GRAVITY_MASS_COMPARISON[1] },
];
const worldTrials: readonly [Trial, Trial] = [
  { label: "Earth · 5 kg", inputs: GRAVITY_WORLD_COMPARISON[0] },
  { label: "Moon · 5 kg", inputs: GRAVITY_WORLD_COMPARISON[1] },
];

function worldById(id: GravityWorldId) {
  return GRAVITY_WORLDS.find((world) => world.id === id) ?? GRAVITY_WORLDS[0];
}

export function GravityExploration() {
  const [comparison, setComparison] = useState<Comparison>("mass");
  const [height, setHeight] = useState(20);
  const [mass, setMass] = useState(5);
  const [world, setWorld] = useState<GravityWorldId>("earth");
  const [elapsed, setElapsed] = useState(0);
  const [massPrediction, setMassPrediction] = useState<MassPrediction>("");
  const [massComplete, setMassComplete] = useState(false);
  const [worldPrediction, setWorldPrediction] = useState<WorldPrediction>("");
  const [worldComplete, setWorldComplete] = useState(false);
  const selectedWorld = worldById(world);
  const trials: readonly [Trial, Trial] =
    comparison === "mass"
      ? massTrials
      : comparison === "world"
        ? worldTrials
        : [
            {
              label: "Earth · 1 kg",
              inputs: { height, mass: 1, gravity: 9.81 },
            },
            {
              label: `${selectedWorld.name} · ${mass} kg`,
              inputs: { height, mass, gravity: selectedWorld.gravity },
            },
          ];
  const results = trials.map((trial) => gravityDropActivity(trial.inputs));
  const positions = trials.map((trial) =>
    gravityDropAtTime(trial.inputs, elapsed),
  );
  const sceneLabel = `${comparison === "world" ? "Earth and Moon gravity comparison" : comparison === "mass" ? "Earth mass comparison" : "Open gravity comparison"}. ${trials[0].label}: ${positions[0].remaining.toFixed(1)} metres above the floor, ${results[0].fallTime.toFixed(2)} second fall. ${trials[1].label}: ${positions[1].remaining.toFixed(1)} metres above the floor, ${results[1].fallTime.toFixed(2)} second fall. Equal drawn sizes do not encode mass.`;

  const reset = () => {
    setComparison("mass");
    setHeight(20);
    setMass(5);
    setWorld("earth");
    setElapsed(0);
    setMassPrediction("");
    setMassComplete(false);
    setWorldPrediction("");
    setWorldComplete(false);
  };

  return (
    <LearningFrame onReset={reset}>
      <Diagram
        label={sceneLabel}
        height={330}
        visualState={{
          kind: "gravity",
          height: trials[1].inputs.height,
          gravity: trials[1].inputs.gravity,
          elapsed,
          mass: trials[1].inputs.mass,
          referenceGravity: trials[0].inputs.gravity,
          referenceMass: trials[0].inputs.mass,
          distances: [positions[0].distance, positions[1].distance],
        }}
      >
        {(width) => (
          <View style={{ flex: 1, backgroundColor: "#0b2028" }}>
            <Line x={18} y={286} x2={width - 18} y2={286} color="#b7d5d0" />
            {[0, 1].map((index) => {
              const x = width * (index === 0 ? 0.31 : 0.69);
              const y =
                45 +
                (positions[index].distance / trials[index].inputs.height) * 225;
              return (
                <View key={trials[index].label}>
                  <View
                    style={{
                      position: "absolute",
                      left: x - 35,
                      top: 30,
                      width: 70,
                      height: 255,
                      borderWidth: 2,
                      borderColor: index === 0 ? "#d9bd7a" : "#79cfc5",
                      borderRadius: 28,
                      backgroundColor: "#4e87901f",
                    }}
                  />
                  <Dot
                    x={x}
                    y={y}
                    size={17}
                    color={index === 0 ? "#f0d293" : "#84d8cf"}
                  />
                  <Text
                    style={{
                      position: "absolute",
                      top: 295,
                      left: x - 55,
                      width: 110,
                      color: "#f4f3e7",
                      fontSize: 11,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    {trials[index].label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Diagram>
      <Explanation>
        At {elapsed.toFixed(2)} s: {trials[0].label}{" "}
        {positions[0].landed
          ? "is at the ideal floor"
          : `is ${positions[0].remaining.toFixed(1)} m above it`}
        ; {trials[1].label}{" "}
        {positions[1].landed
          ? "is at the ideal floor"
          : `is ${positions[1].remaining.toFixed(1)} m above it`}
        .
      </Explanation>

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        1. Change only mass
      </Text>
      <Explanation>
        Keep Earth gravity and a 20 m release height fixed.
      </Explanation>
      <Choice
        label="Which object lands first?"
        value={massPrediction}
        onChange={(prediction) => {
          setMassPrediction(prediction);
          setMassComplete(false);
          setWorldPrediction("");
          setWorldComplete(false);
          setComparison("mass");
          setElapsed(0);
        }}
        options={[
          { value: "light", label: "1 kg lands first" },
          { value: "heavy", label: "10 kg lands first" },
          { value: "same", label: "Same landing time" },
        ]}
      />
      <ActionButton
        label="Compare 1 kg and 10 kg"
        disabled={!massPrediction}
        onPress={() => {
          setMassComplete(true);
          setComparison("mass");
          setElapsed(gravityDropActivity(massTrials[0].inputs).fallTime);
        }}
      />
      {massComplete && (
        <Explanation>
          The result {massPrediction === "same" ? "matches" : "differs from"}{" "}
          your prediction. Both land in {results[0].fallTime.toFixed(2)} s at
          9.81 m/s². Their weights are 9.81 N and 98.1 N. Extra force and extra
          inertia scale together, so mass does not change vacuum acceleration.
          Explain why the weights differ while the landing times match.
        </Explanation>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        2. Change only local gravity
      </Text>
      <Explanation>
        Keep mass at 5 kg and the release height at 20 m.
      </Explanation>
      {massComplete ? (
        <Choice
          label="How does the Moon drop compare with Earth?"
          value={worldPrediction}
          onChange={(prediction) => {
            setWorldPrediction(prediction);
            setWorldComplete(false);
            setComparison("world");
            setElapsed(0);
          }}
          options={[
            { value: "earth", label: "Earth takes longer" },
            { value: "moon", label: "Moon takes longer" },
            { value: "same", label: "Same landing time" },
          ]}
        />
      ) : (
        <Explanation>Complete the mass comparison first.</Explanation>
      )}
      <ActionButton
        label="Compare Earth and Moon"
        disabled={!massComplete || !worldPrediction}
        onPress={() => {
          setWorldComplete(true);
          setComparison("world");
          setElapsed(gravityDropActivity(worldTrials[0].inputs).fallTime);
        }}
      />
      {worldComplete && (
        <Explanation>
          The result {worldPrediction === "moon" ? "matches" : "differs from"}{" "}
          your prediction. Earth 2.02 s and 49.1 N; Moon 4.97 s and 8.1 N.
          Weaker local gravity gives the unchanged 5 kg mass less acceleration.
          Explain which held value rules out mass as the cause.
        </Explanation>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}
      >
        Open controls
      </Text>
      <Control
        label="Drop height (m)"
        value={height}
        min={5}
        max={50}
        step={1}
        onChange={(value) => {
          setHeight(value);
          setComparison("open");
          setElapsed(0);
        }}
      />
      <Control
        label="Comparison mass (kg)"
        value={mass}
        min={1}
        max={20}
        step={1}
        onChange={(value) => {
          setMass(value);
          setComparison("open");
          setElapsed(0);
        }}
      />
      <Control
        label="Elapsed time (s)"
        value={elapsed}
        min={0}
        max={6}
        step={0.1}
        onChange={setElapsed}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {GRAVITY_WORLDS.map((option) => (
          <ActionButton
            key={option.id}
            label={`${option.name} · ${option.gravity} m/s²`}
            variant={world === option.id ? "primary" : "secondary"}
            onPress={() => {
              setWorld(option.id);
              setComparison("open");
              setElapsed(0);
            }}
          />
        ))}
      </View>

      <ModelNote>
        Mass is amount of matter; weight is gravitational force. This is a
        one-dimensional release from rest with constant local gravity, no air,
        wind, buoyancy, rotation or terrain, and an ideal floor. Equal drawn
        size does not encode mass. Jupiter is excluded because it has no true
        solid surface for this floor-drop model.
      </ModelNote>
    </LearningFrame>
  );
}
