import { useState } from "react";
import { Text, View } from "react-native";
import {
  BRIDGE_DEFAULT_INPUTS,
  BRIDGE_LOAD_COMPARISON,
  BRIDGE_POSITION_COMPARISON,
  bridgeActivity,
  compareBridgeTrials,
  type BridgeInputs,
} from "@family-manager/family-api/discovery-models/bridge";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
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

type PositionPrediction = "" | "left" | "right" | "equal";
type LoadPrediction = "" | "both-double" | "moment-only" | "quadruple";

const positionEvidence = BRIDGE_POSITION_COMPARISON.map(bridgeActivity);
const loadEvidence = BRIDGE_LOAD_COMPARISON.map(bridgeActivity);
const positionVariables = compareBridgeTrials(...BRIDGE_POSITION_COMPARISON);
const loadVariables = compareBridgeTrials(...BRIDGE_LOAD_COMPARISON);

export function BridgeExploration() {
  const [inputs, setInputs] = useState<BridgeInputs>(BRIDGE_DEFAULT_INPUTS);
  const [phase, setPhase] = useState(0);
  const [positionPrediction, setPositionPrediction] =
    useState<PositionPrediction>("");
  const [positionComplete, setPositionComplete] = useState(false);
  const [loadPrediction, setLoadPrediction] = useState<LoadPrediction>("");
  const [loadComplete, setLoadComplete] = useState(false);
  const result = bridgeActivity(inputs);
  const freeExploration = positionComplete && loadComplete;
  const summary = `Left reaction ${result.leftReactionKilonewtons.toFixed(1)} kN; right reaction ${result.rightReactionKilonewtons.toFixed(1)} kN; peak moment ${result.peakBendingMomentKilonewtonMeters.toFixed(1)} kN·m; deflection at load ${result.deflectionAtLoadMillimeters.toFixed(2)} mm.`;

  const showTrial = (trial: BridgeInputs) => {
    setInputs(trial);
    setPhase(0);
  };
  const reset = () => {
    setInputs(BRIDGE_DEFAULT_INPUTS);
    setPhase(0);
    setPositionPrediction("");
    setPositionComplete(false);
    setLoadPrediction("");
    setLoadComplete(false);
  };

  return (
    <LearningFrame onReset={reset}>
      <Diagram
        visualState={{
          kind: "bridge",
          material: "timber",
          braces: result.inputs.braces,
          load: result.inputs.pointLoadKilonewtons,
          position: result.inputs.loadPositionPercent,
          utilization: result.braceReferenceUseIndex,
          leftReaction: result.leftReactionKilonewtons,
          rightReaction: result.rightReactionKilonewtons,
          progress: phase / 100,
          deflectionMillimeters: result.deflectionAtLoadMillimeters,
        }}
        label={`Dimensional timber demonstration bridge. ${summary} The truss and load-path position are explanatory artwork, not a solved truss or safety result.`}
      >
        {(width) => (
          <>
            <Line x={20} y={160} x2={width - 20} y2={160} color="#b3bdcc" />
            {result.inputs.braces.map((present, index) => {
              const x = 20 + (index * (width - 40)) / 4;
              const next = 20 + ((index + 1) * (width - 40)) / 4;
              return (
                <View key={index}>
                  <Line
                    x={x}
                    y={130}
                    x2={next}
                    y2={130}
                    color={present ? "#9dd8c5" : "#8fb1b6"}
                  />
                  {present && (
                    <Line x={x} y={160} x2={next} y2={130} color="#ffe49b" />
                  )}
                </View>
              );
            })}
            <Line x={20} y={130} x2={20} y2={190} />
            <Line x={width - 20} y={130} x2={width - 20} y2={190} />
            <Dot
              x={20 + (result.inputs.loadPositionPercent / 100) * (width - 40)}
              y={114}
              size={22}
              color="#ffe49b"
            />
            <DiagramLabel x={15} y={15}>
              10 m equivalent beam · {result.inputs.pointLoadKilonewtons} kN
            </DiagramLabel>
            <DiagramLabel x={15} y={193}>
              Left {result.leftReactionKilonewtons.toFixed(1)} kN · Right{" "}
              {result.rightReactionKilonewtons.toFixed(1)} kN
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {summary} The reactions sum to the{" "}
        {result.inputs.pointLoadKilonewtons.toFixed(1)}
        {" kN point load. Flexural rigidity EI is "}
        {result.inputs.flexuralRigidityMeganewtonMetersSquared} MN·m².
      </Explanation>

      <Text accessibilityRole="header" style={headingStyle}>
        1. Move the same load
      </Text>
      <Explanation>
        Move 12 kN from the center to 20% of the span. Which support carries
        more while span, flexural rigidity and brace index stay fixed?
      </Explanation>
      <Choice
        label="Your support prediction"
        value={positionPrediction}
        onChange={(value) => {
          setPositionPrediction(value);
          setPositionComplete(false);
          setPhase(0);
        }}
        options={[
          { value: "left", label: "Left support carries more" },
          { value: "right", label: "Right support carries more" },
          { value: "equal", label: "Both supports stay equal" },
        ]}
      />
      <ActionButton
        label="Compare load positions"
        disabled={!positionPrediction}
        onPress={() => {
          setPositionComplete(true);
          showTrial(BRIDGE_POSITION_COMPARISON[1]);
        }}
      />
      {positionComplete && (
        <>
          <Explanation>
            The evidence{" "}
            {positionPrediction === "left" ? "matches" : "differs from"}
            {" your prediction. Center: left "}
            {positionEvidence[0].leftReactionKilonewtons.toFixed(1)} kN · right{" "}
            {positionEvidence[0].rightReactionKilonewtons.toFixed(1)} kN · peak
            moment{" "}
            {positionEvidence[0].peakBendingMomentKilonewtonMeters.toFixed(1)}
            {" kN·m · deflection at load "}
            {positionEvidence[0].deflectionAtLoadMillimeters.toFixed(2)} mm.
            20%: left {positionEvidence[1].leftReactionKilonewtons.toFixed(1)}{" "}
            kN · right {positionEvidence[1].rightReactionKilonewtons.toFixed(1)}{" "}
            kN · peak moment{" "}
            {positionEvidence[1].peakBendingMomentKilonewtonMeters.toFixed(1)}
            {" kN·m · deflection at load "}
            {positionEvidence[1].deflectionAtLoadMillimeters.toFixed(2)} mm.
            Changed: {positionVariables.changed.join(", ")}. Held:{" "}
            {positionVariables.held.join(" · ")}.
          </Explanation>
          <View style={buttonRowStyle}>
            <ActionButton
              label="Show center evidence"
              variant="secondary"
              onPress={() => showTrial(BRIDGE_POSITION_COMPARISON[0])}
            />
            <ActionButton
              label="Show 20% evidence"
              variant="secondary"
              onPress={() => showTrial(BRIDGE_POSITION_COMPARISON[1])}
            />
          </View>
        </>
      )}

      <Text accessibilityRole="header" style={headingStyle}>
        2. Double the point load
      </Text>
      <Explanation>
        At midspan, change only the point load from 8 to 16 kN. What happens to
        peak moment and deflection at the load?
      </Explanation>
      <Choice
        label="Your load prediction"
        value={loadPrediction}
        onChange={(value) => {
          setLoadPrediction(value);
          setLoadComplete(false);
          setPhase(0);
        }}
        options={[
          {
            value: "both-double",
            label: "Moment and deflection both double",
          },
          {
            value: "moment-only",
            label: "Moment doubles; deflection stays the same",
          },
          {
            value: "quadruple",
            label: "Moment and deflection both quadruple",
          },
        ]}
      />
      <ActionButton
        label="Compare point loads"
        disabled={!loadPrediction}
        onPress={() => {
          setLoadComplete(true);
          showTrial(BRIDGE_LOAD_COMPARISON[1]);
        }}
      />
      {loadComplete && (
        <>
          <Explanation>
            The evidence{" "}
            {loadPrediction === "both-double" ? "matches" : "differs from"}
            {" your prediction. 8 kN: "}
            {loadEvidence[0].peakBendingMomentKilonewtonMeters.toFixed(1)} kN·m
            and {loadEvidence[0].deflectionAtLoadMillimeters.toFixed(2)} mm · 16
            kN: {loadEvidence[1].peakBendingMomentKilonewtonMeters.toFixed(1)}
            {" kN·m and "}
            {loadEvidence[1].deflectionAtLoadMillimeters.toFixed(2)} mm.
            Changed: {loadVariables.changed.join(", ")}. Held:{" "}
            {loadVariables.held.join(" · ")}.
          </Explanation>
          <View style={buttonRowStyle}>
            <ActionButton
              label="Show 8 kN evidence"
              variant="secondary"
              onPress={() => showTrial(BRIDGE_LOAD_COMPARISON[0])}
            />
            <ActionButton
              label="Show 16 kN evidence"
              variant="secondary"
              onPress={() => showTrial(BRIDGE_LOAD_COMPARISON[1])}
            />
          </View>
        </>
      )}

      {freeExploration && (
        <>
          <Text accessibilityRole="header" style={headingStyle}>
            3. Explore one variable
          </Text>
          <Control
            label="Load position (%)"
            value={result.inputs.loadPositionPercent}
            min={5}
            max={95}
            step={5}
            onChange={(loadPositionPercent) =>
              setInputs((current) => ({ ...current, loadPositionPercent }))
            }
          />
          <Control
            label="Point load (kN)"
            value={result.inputs.pointLoadKilonewtons}
            min={0}
            max={30}
            onChange={(pointLoadKilonewtons) =>
              setInputs((current) => ({ ...current, pointLoadKilonewtons }))
            }
          />
          <Control
            label="Beam flexural rigidity (MN·m²)"
            value={result.inputs.flexuralRigidityMeganewtonMetersSquared}
            min={50}
            max={250}
            step={10}
            onChange={(flexuralRigidityMeganewtonMetersSquared) =>
              setInputs((current) => ({
                ...current,
                flexuralRigidityMeganewtonMetersSquared,
              }))
            }
          />
          <Control
            label="Load-path phase (%)"
            value={phase}
            min={0}
            max={100}
            step={10}
            onChange={setPhase}
          />
          {result.braceReferenceUseIndex.map((value, index) => (
            <Meter
              key={index}
              label={`Section ${index + 1} brace reference-use index`}
              value={value}
              max={2.5}
              detail={`${value.toFixed(2)}×`}
              color={result.inputs.braces[index] ? "#217d69" : "#4d7780"}
            />
          ))}
          {result.inputs.braces.map((present, index) => (
            <ActionButton
              key={index}
              label={`${present ? "Remove" : "Add"} section ${index + 1} brace index modifier`}
              variant="secondary"
              onPress={() =>
                setInputs((current) => ({
                  ...current,
                  braces: current.braces.map((value, braceIndex) =>
                    braceIndex === index ? !value : value,
                  ),
                }))
              }
            />
          ))}
          <Explanation>
            Brace reference-use is an invented comparison index (zone moment ÷
            16 kN·m, then ÷ 2.4 when selected), not a capacity, allowable load
            or safety check. It does not change reactions, moment or deflection.
          </Explanation>
        </>
      )}

      <ModelNote>
        Model boundary: one static point load on a 10 m simply supported
        Euler–Bernoulli equivalent beam with constant EI. Deflection uses the
        small-deflection equation and is visually enlarged. The timber truss is
        illustrative, not the solved structure. Self-weight, multiple axles,
        connections, shear, buckling, fatigue, impact, wind, material limits and
        safety factors are omitted. This is not a construction design, load
        rating or safety certification.
      </ModelNote>
    </LearningFrame>
  );
}

const headingStyle = {
  color: colors.text,
  fontSize: 22,
  fontWeight: "800" as const,
};
const buttonRowStyle = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 8,
};
