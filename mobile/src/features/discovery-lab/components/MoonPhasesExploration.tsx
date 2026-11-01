import { useState } from "react";
import { Text, View } from "react-native";
import {
  MOON_SIDEREAL_DAYS,
  MOON_SYNODIC_DAYS,
  moonPhaseActivity,
} from "@family-manager/family-api/discovery-models/moon";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { Control } from "./Primitives";
import {
  Choice,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";
import { NativeMoonScene } from "./NativeMoonScene";

type QuarterPrediction = "" | "25" | "50" | "75";
type OppositePrediction = "" | "first" | "last" | "same";
const INITIAL_ANGLE = 45;

export function MoonPhasesExploration() {
  const [angle, setAngle] = useState(INITIAL_ANGLE);
  const [view, setView] = useState<"earth" | "orbit">("earth");
  const [quarterPrediction, setQuarterPrediction] =
    useState<QuarterPrediction>("");
  const [quarterComplete, setQuarterComplete] = useState(false);
  const [oppositePrediction, setOppositePrediction] =
    useState<OppositePrediction>("");
  const [oppositeComplete, setOppositeComplete] = useState(false);
  const activity = moonPhaseActivity({ angle });

  const reset = () => {
    setAngle(INITIAL_ANGLE);
    setView("earth");
    setQuarterPrediction("");
    setQuarterComplete(false);
    setOppositePrediction("");
    setOppositeComplete(false);
  };
  const label = `${activity.phase}. ${activity.visiblePercent}% of the disk visible from Earth is illuminated. ${view === "earth" ? "Earth view keeps the near side facing the viewer." : "Orbit geometry shows sunlight arriving from the right while the Moon moves around Earth."} Half the whole Moon is sunlit; bodies and gaps are not to scale.`;

  return (
    <LearningFrame onReset={reset}>
      <NativeMoonScene
        angle={activity.inputs.angle}
        view={view}
        onChange={oppositeComplete ? setAngle : () => undefined}
        label={label}
      />
      <Explanation>
        {activity.phase} · {activity.visiblePercent}% of the Earth-view disk lit
        · orbital position {activity.inputs.angle.toFixed(0)}° · mean
        phase-cycle day {activity.cycleDay.toFixed(1)}.
      </Explanation>

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}
      >
        Viewpoint
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <ActionButton
          label="Earth view"
          variant={view === "earth" ? "primary" : "secondary"}
          onPress={() => setView("earth")}
        />
        <ActionButton
          label="Orbit geometry"
          variant={view === "orbit" ? "primary" : "secondary"}
          onPress={() => setView("orbit")}
        />
      </View>

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        1. Test first quarter
      </Text>
      <Explanation>
        Keep the Sun direction and Earth viewpoint fixed. At 90° around the
        orbit, how much of the Earth-view disk will look lit?
      </Explanation>
      <Choice
        label="Your first-quarter prediction"
        value={quarterPrediction}
        onChange={(prediction) => {
          setQuarterPrediction(prediction);
          setQuarterComplete(false);
          setOppositePrediction("");
          setOppositeComplete(false);
        }}
        options={[
          { value: "25", label: "25%" },
          { value: "50", label: "50%" },
          { value: "75", label: "75%" },
        ]}
      />
      <ActionButton
        label="Observe first quarter"
        disabled={!quarterPrediction}
        onPress={() => {
          setQuarterComplete(true);
          setOppositePrediction("");
          setOppositeComplete(false);
          setView("earth");
          setAngle(90);
        }}
      />
      {quarterComplete && (
        <Explanation>
          The result {quarterPrediction === "50" ? "matches" : "differs from"}{" "}
          your prediction. The Earth-view disk is 50% lit. Orbital position
          changed; the Sun direction, Earth viewpoint and sunlit half stayed
          fixed.
        </Explanation>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        2. Compare opposite quarters
      </Text>
      <Explanation>
        Predict whether 90° and 270° show the same visible lit fraction from the
        fixed Earth viewpoint.
      </Explanation>
      {quarterComplete ? (
        <Choice
          label="Your opposite-quarter prediction"
          value={oppositePrediction}
          onChange={(prediction) => {
            setOppositePrediction(prediction);
            setOppositeComplete(false);
          }}
          options={[
            { value: "first", label: "First quarter is larger" },
            { value: "last", label: "Last quarter is larger" },
            { value: "same", label: "Same fraction, opposite sides" },
          ]}
        />
      ) : (
        <Explanation>Complete Investigation 1 first.</Explanation>
      )}
      <ActionButton
        label="Compare opposite quarters"
        disabled={!quarterComplete || !oppositePrediction}
        onPress={() => {
          setOppositeComplete(true);
          setView("earth");
          setAngle(270);
        }}
      />
      {oppositeComplete && (
        <Explanation>
          The result{" "}
          {oppositePrediction === "same" ? "matches" : "differs from"} your
          prediction. First quarter: 50% · Last quarter: 50%. The bright half
          appears on opposite sides because orbital position changed. Earth’s
          shadow was not used. Why can equal fractions have different names?
        </Explanation>
      )}

      {oppositeComplete ? (
        <>
          <Text
            accessibilityRole="header"
            style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}
          >
            Open controls
          </Text>
          <Control
            label="Moon orbital position"
            value={activity.inputs.angle}
            min={0}
            max={360}
            step={15}
            onChange={setAngle}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(
              [
                ["New", 0],
                ["Quarter", 90],
                ["Full", 180],
                ["Last quarter", 270],
              ] as const
            ).map(([phase, value]) => (
              <ActionButton
                key={phase}
                label={phase}
                variant="secondary"
                onPress={() => setAngle(value)}
              />
            ))}
          </View>
        </>
      ) : (
        <Explanation>
          Complete both predictions to unlock open exploration.
        </Explanation>
      )}

      <ModelNote>
        The Sun illuminates half the Moon. This circular, coplanar model changes
        orbital position; ordinary phases are not Earth’s shadow. The real orbit
        is tilted about 5°. Mean phase cycle {MOON_SYNODIC_DAYS.toFixed(2)}
        days; sidereal orbit {MOON_SIDEREAL_DAYS.toFixed(2)} days. Sizes and
        gaps are redrawn. Local sky orientation, libration, eclipses, terrain
        shadows and exact timing are not predicted.
      </ModelNote>
    </LearningFrame>
  );
}
