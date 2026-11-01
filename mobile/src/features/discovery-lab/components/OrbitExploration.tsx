import { useState } from "react";
import { Text, View } from "react-native";
import {
  ORBIT_MASS_COMPARISON,
  orbitActivity,
  type OrbitInputs,
} from "@family-manager/family-api/discovery-models/orbit";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { Control, Dot } from "./Primitives";
import {
  Choice,
  Diagram,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";

type SpeedPrediction = "" | "hit-orbit-escape" | "all-orbit" | "all-escape";
type MassPrediction = "" | "tighter" | "same" | "escape";

function displayedTraceRange(closest: number, farthest: number) {
  return `${closest.toFixed(2)}–${farthest.toFixed(2)} starting radii`;
}

export function OrbitExploration() {
  const [inputs, setInputs] = useState<OrbitInputs>({ speed: 1, mass: 1 });
  const [speedPrediction, setSpeedPrediction] = useState<SpeedPrediction>("");
  const [speedComplete, setSpeedComplete] = useState(false);
  const [massPrediction, setMassPrediction] = useState<MassPrediction>("");
  const [massComplete, setMassComplete] = useState(false);
  const current = orbitActivity(inputs);
  const massTrials = ORBIT_MASS_COMPARISON.map(orbitActivity);

  const reset = () => {
    setInputs({ speed: 1, mass: 1 });
    setSpeedPrediction("");
    setSpeedComplete(false);
    setMassPrediction("");
    setMassComplete(false);
  };

  return (
    <LearningFrame onReset={reset}>
      <Diagram
        label={`Trajectory model: ${current.outcome}. Launch speed ${current.inputs.speed.toFixed(2)} times baseline; central mass ${current.inputs.mass.toFixed(1)} times. The displayed trace spans ${displayedTraceRange(current.closestRadius, current.farthestRadius)}.`}
        visualState={{ kind: "orbit", points: current.points, progress: 0.78 }}
      >
        {(width) => (
          <View style={{ flex: 1 }}>
            <Dot x={width / 2} y={160} size={60} color="#4f7dba" />
            <Dot x={width * 0.78} y={160} size={12} color="#d8ff5f" />
          </View>
        )}
      </Diagram>
      <Explanation>
        Current result: {current.outcome}. Speed{" "}
        {current.inputs.speed.toFixed(2)}× · mass{" "}
        {current.inputs.mass.toFixed(1)}× · displayed trace{" "}
        {displayedTraceRange(current.closestRadius, current.farthestRadius)}.
      </Explanation>

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 23, fontWeight: "800" }}
      >
        1. Change only sideways speed
      </Text>
      <Explanation>
        Keep central mass at 1× and the starting distance fixed. Compare three
        launch speeds.
      </Explanation>
      <Choice
        label="Predict the order at 0.60×, 1.00× and 1.42× speed"
        value={speedPrediction}
        onChange={(prediction) => {
          setSpeedPrediction(prediction);
          setSpeedComplete(false);
          setMassPrediction("");
          setMassComplete(false);
        }}
        options={[
          { value: "hit-orbit-escape", label: "Hit → orbit → escape" },
          { value: "all-orbit", label: "All three orbit" },
          { value: "all-escape", label: "All three escape" },
        ]}
      />
      <ActionButton
        label="Compare 0.60×, 1.00× and 1.42×"
        disabled={!speedPrediction}
        onPress={() => {
          setSpeedComplete(true);
          setMassPrediction("");
          setMassComplete(false);
          setInputs({ speed: 1.42, mass: 1 });
        }}
      />
      {speedComplete && (
        <Explanation>
          0.60× collision · 1.00× near-circle orbit · 1.42× escape.{" "}
          {speedPrediction === "hit-orbit-escape"
            ? "The result matches your prediction. "
            : "The result differs from your prediction. "}
          Sideways motion carries the probe forward while gravity bends its path
          inward. Even on escape, gravity still acts along the escape path;
          escape means the path does not return in this two-body model.
        </Explanation>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        2. Change only central mass
      </Text>
      <Explanation>
        Keep speed at 1.00× and the starting distance fixed. Compare 1× and 2×
        central mass.
      </Explanation>
      {speedComplete ? (
        <Choice
          label="Predict the 2×-mass path"
          value={massPrediction}
          onChange={(prediction) => {
            setMassPrediction(prediction);
            setMassComplete(false);
          }}
          options={[
            { value: "tighter", label: "Curves into a tighter ellipse" },
            { value: "same", label: "Stays on the same circle" },
            { value: "escape", label: "Escapes" },
          ]}
        />
      ) : (
        <Explanation>Complete the speed comparison first.</Explanation>
      )}
      <ActionButton
        label="Compare 1× and 2× mass"
        disabled={!speedComplete || !massPrediction}
        onPress={() => {
          setMassComplete(true);
          setInputs({ speed: 1, mass: 2 });
        }}
      />
      {massComplete && (
        <Explanation>
          The displayed 1×-mass trace spans 1.00–1.00 starting radii. The
          displayed 2×-mass trace spans{" "}
          {displayedTraceRange(
            massTrials[1].closestRadius,
            massTrials[1].farthestRadius,
          )}
          .{" "}
          {massPrediction === "tighter"
            ? "The result matches your prediction. "
            : "The result differs from your prediction. "}
          The same launch speed is below the heavier body's 1.41× circular
          speed, so the path curves inward more strongly.
        </Explanation>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}
      >
        Open controls
      </Text>
      <Control
        label="Launch speed"
        value={inputs.speed}
        min={0}
        max={1.8}
        step={0.1}
        onChange={(speed) => setInputs((old) => ({ ...old, speed }))}
      />
      <Control
        label="Central mass"
        value={inputs.mass}
        min={0.5}
        max={2}
        step={0.1}
        onChange={(mass) => setInputs((old) => ({ ...old, mass }))}
      />

      <ModelNote>
        This dimensionless fixed-step two-body model starts one radius unit from
        a point-like central mass. The drawn planet has radius 0.22 unit. It
        omits air, other bodies, burns and the probe's pull on the planet. A
        finite trace labeled escape is not proof that gravity becomes zero.
      </ModelNote>
    </LearningFrame>
  );
}
