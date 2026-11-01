import { useState } from "react";
import { Text, View } from "react-native";
import {
  CASTLE_DEFAULT_INPUTS,
  CASTLE_GATE_COMPARISON,
  CASTLE_TOWER_COMPARISON,
  castleActivity,
  compareCastleTrials,
  type CastleInputs,
} from "@family-manager/family-api/discovery-models/castle";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { Control } from "./Primitives";
import {
  Choice,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";
import { NativeSceneSurface } from "./NativeSceneSurface";

type RoutePrediction = "" | "both" | "bridge" | "neither";
type ViewPrediction = "" | "tower" | "same" | "flat";

const routeEvidence = CASTLE_GATE_COMPARISON.map(castleActivity);
const towerEvidence = CASTLE_TOWER_COMPARISON.map(castleActivity);
const routeVariables = compareCastleTrials(...CASTLE_GATE_COMPARISON);
const towerVariables = compareCastleTrials(...CASTLE_TOWER_COMPARISON);

function stateForScene(inputs: CastleInputs) {
  return {
    kind: "castle" as const,
    moat: inputs.ditchWidthMeters,
    towers: inputs.towers,
    gate: inputs.gate,
    inner: inputs.inner,
    approach: inputs.approach,
    sight: inputs.sight,
    wallHeightMeters: inputs.wallHeightMeters,
  };
}

export function CastleExploration() {
  const [inputs, setInputs] = useState<CastleInputs>(CASTLE_DEFAULT_INPUTS);
  const [routePrediction, setRoutePrediction] = useState<RoutePrediction>("");
  const [routeComplete, setRouteComplete] = useState(false);
  const [viewPrediction, setViewPrediction] = useState<ViewPrediction>("");
  const [viewComplete, setViewComplete] = useState(false);
  const activity = castleActivity(inputs);

  const reset = () => {
    setInputs(CASTLE_DEFAULT_INPUTS);
    setRoutePrediction("");
    setRouteComplete(false);
    setViewPrediction("");
    setViewComplete(false);
  };
  const label = `English-inspired castle model. ${inputs.ditchWidthMeters} metre ditch; ${inputs.gate ? "closed" : "open"} portcullis; ${inputs.towers ? "projecting corner towers" : "flat curtain-wall corners"}. The ${inputs.approach} route ${activity.routeOutcome}. ${inputs.sight ? `${activity.sightLineCount} illustrative sight-line directions shown.` : "Sight-line directions hidden."}`;

  return (
    <LearningFrame onReset={reset}>
      <NativeSceneSurface
        state={stateForScene(inputs)}
        label={label}
        fallback={
          <View style={{ flex: 1, backgroundColor: "#182a31", padding: 28 }}>
            <View
              style={{
                flex: 1,
                borderWidth: 12,
                borderColor: "#c0ad83",
                backgroundColor: "#6e7650",
              }}
            />
          </View>
        }
        height={360}
      />
      <Explanation>
        {inputs.approach === "bridge" ? "Bridge" : "North"} route ·{" "}
        {activity.routeOutcome}. Sight-line directions:{" "}
        {activity.sightLineCount}.
      </Explanation>

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        1. Compare open-gate routes
      </Text>
      <Explanation>
        Keep the gate open and ditch at 22 m. Which routes reach an entrance?
      </Explanation>
      <Choice
        label="Your route prediction"
        value={routePrediction}
        onChange={(value) => {
          setRoutePrediction(value);
          setRouteComplete(false);
        }}
        options={[
          { value: "both", label: "Both routes" },
          { value: "bridge", label: "Bridge only" },
          { value: "neither", label: "Neither route" },
        ]}
      />
      <ActionButton
        label="Compare open-gate routes"
        disabled={!routePrediction}
        onPress={() => {
          setRouteComplete(true);
          setInputs(CASTLE_GATE_COMPARISON[1]);
        }}
      />
      {routeComplete && (
        <>
          <Explanation>
            The result{" "}
            {routePrediction === "bridge" ? "matches" : "differs from"} your
            prediction. Bridge: {routeEvidence[0].routeOutcome} · North:{" "}
            {routeEvidence[1].routeOutcome}. Changed:{" "}
            {routeVariables.changed.join(", ")}. Held:{" "}
            {routeVariables.held.join(" · ")}.
          </Explanation>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionButton
              label="Show bridge evidence"
              variant="secondary"
              onPress={() => setInputs(CASTLE_GATE_COMPARISON[0])}
            />
            <ActionButton
              label="Show north evidence"
              variant="secondary"
              onPress={() => setInputs(CASTLE_GATE_COMPARISON[1])}
            />
          </View>
        </>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        2. Compare sight lines
      </Text>
      <Explanation>
        Keep the bridge route, closed gate and 22 m ditch fixed. Which position
        shows more adjoining wall faces?
      </Explanation>
      <Choice
        label="Your viewpoint prediction"
        value={viewPrediction}
        onChange={(value) => {
          setViewPrediction(value);
          setViewComplete(false);
        }}
        options={[
          { value: "tower", label: "Projecting tower" },
          { value: "same", label: "Same view" },
          { value: "flat", label: "Flat wall" },
        ]}
      />
      <ActionButton
        label="Compare wall-side views"
        disabled={!viewPrediction}
        onPress={() => {
          setViewComplete(true);
          setInputs(CASTLE_TOWER_COMPARISON[1]);
        }}
      />
      {viewComplete && (
        <>
          <Explanation>
            The result {viewPrediction === "tower" ? "matches" : "differs from"}{" "}
            your prediction. Flat wall: {towerEvidence[0].sightLineCount}{" "}
            illustrated direction · Projecting tower:{" "}
            {towerEvidence[1].sightLineCount}. Changed:{" "}
            {towerVariables.changed.join(", ")}. Held:{" "}
            {towerVariables.held.join(" · ")}. These directions are not complete
            visibility or weapon ranges.
          </Explanation>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionButton
              label="Show flat-wall evidence"
              variant="secondary"
              onPress={() => setInputs(CASTLE_TOWER_COMPARISON[0])}
            />
            <ActionButton
              label="Show tower evidence"
              variant="secondary"
              onPress={() => setInputs(CASTLE_TOWER_COMPARISON[1])}
            />
          </View>
        </>
      )}

      {routeComplete && viewComplete && (
        <>
          <Text
            accessibilityRole="header"
            style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}
          >
            Open design controls
          </Text>
          <Control
            label="Ditch width (m)"
            value={inputs.ditchWidthMeters}
            min={0}
            max={36}
            step={2}
            onChange={(ditchWidthMeters) =>
              setInputs((current) => ({ ...current, ditchWidthMeters }))
            }
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionButton
              label={inputs.gate ? "Open gate" : "Close gate"}
              variant="secondary"
              onPress={() =>
                setInputs((current) => ({ ...current, gate: !current.gate }))
              }
            />
            <ActionButton
              label={inputs.inner ? "Remove inner wall" : "Add inner wall"}
              variant="secondary"
              onPress={() =>
                setInputs((current) => ({ ...current, inner: !current.inner }))
              }
            />
          </View>
        </>
      )}

      <ModelNote>
        This is a 13th-century English-inspired composite, not one castle.
        Dimensions and ditch width are schematic. Ditches could be wet or dry;
        this view uses water only to make the boundary legible. The route and
        sight-line comparisons do not predict a siege result.
      </ModelNote>
    </LearningFrame>
  );
}
