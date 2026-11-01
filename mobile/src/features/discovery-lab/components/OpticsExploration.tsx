import { useState } from "react";
import { Text, View } from "react-native";
import {
  OPTICAL_MATERIALS,
  OPTICS_CRITICAL_COMPARISON,
  OPTICS_DIRECTION_COMPARISON,
  opticsActivity,
  type OpticalMaterialId,
  type OpticsInputs,
} from "@family-manager/family-api/discovery-models/optics";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { Control, Line } from "./Primitives";
import {
  Choice,
  Diagram,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";

type CriticalPrediction = "" | "none" | "remains";
type DirectionPrediction = "" | "opposite" | "same";

function mediumColor(id: OpticalMaterialId) {
  if (id === "water") return "#15536a";
  if (id === "glass") return "#285362";
  return "#14293b";
}

function OpticsDiagram({ inputs }: { inputs: OpticsInputs }) {
  const result = opticsActivity(inputs);
  const label = `${result.from.name} to ${result.to.name}. Incident angle ${inputs.angle.toFixed(1)} degrees from the normal. ${
    result.reflectedAngle === null
      ? "No reflected branch because the indices are equal."
      : `Reflected angle ${result.reflectedAngle.toFixed(1)} degrees.`
  } ${
    result.tir
      ? "Total internal reflection; no transmitted ray."
      : `Refracted angle ${result.refractedAngle?.toFixed(1)} degrees.`
  }`;
  return (
    <Diagram label={label} height={250}>
      {(width) => {
        const cx = width / 2;
        const cy = 125;
        const length = Math.min(92, width * 0.32);
        const incidentRadians = (inputs.angle * Math.PI) / 180;
        const refractedRadians = ((result.refractedAngle ?? 0) * Math.PI) / 180;
        return (
          <View style={{ flex: 1 }}>
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: cy,
                backgroundColor: mediumColor(result.from.id),
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: cy,
                bottom: 0,
                backgroundColor: mediumColor(result.to.id),
              }}
            />
            <Line x={cx} y={18} x2={cx} y2={232} color="#b7c9d5" />
            <Line x={18} y={cy} x2={width - 18} y2={cy} color="#d2f3f0" />
            <Line
              x={cx - Math.sin(incidentRadians) * length}
              y={cy - Math.cos(incidentRadians) * length}
              x2={cx}
              y2={cy}
              color="#ffd27a"
            />
            {result.reflectedAngle !== null && (
              <Line
                x={cx}
                y={cy}
                x2={cx + Math.sin(incidentRadians) * length}
                y2={cy - Math.cos(incidentRadians) * length}
                color="#ff9cae"
              />
            )}
            {!result.tir && (
              <Line
                x={cx}
                y={cy}
                x2={cx + Math.sin(refractedRadians) * length}
                y2={cy + Math.cos(refractedRadians) * length}
                color="#8fffe1"
              />
            )}
            <Text
              style={{
                position: "absolute",
                left: 12,
                top: 10,
                color: "#dcebec",
                fontWeight: "800",
              }}
            >
              FROM · {result.from.name} · n{" "}
              {result.from.refractiveIndex.toFixed(3)}
            </Text>
            <Text
              style={{
                position: "absolute",
                left: 12,
                top: cy + 10,
                color: "#dcebec",
                fontWeight: "800",
              }}
            >
              TO · {result.to.name} · n {result.to.refractiveIndex.toFixed(3)}
            </Text>
            <Text
              style={{
                position: "absolute",
                right: 12,
                bottom: 12,
                color: result.tir ? "#ffc1cc" : "#dcebec",
                fontWeight: "800",
              }}
            >
              {result.tir
                ? "Total internal reflection"
                : `Refracted ${result.refractedAngle?.toFixed(1)}°`}
            </Text>
          </View>
        );
      }}
    </Diagram>
  );
}

export function OpticsExploration() {
  const [inputs, setInputs] = useState<OpticsInputs>({
    angle: 40,
    from: "glass",
    to: "air",
  });
  const [criticalPrediction, setCriticalPrediction] =
    useState<CriticalPrediction>("");
  const [criticalComplete, setCriticalComplete] = useState(false);
  const [directionPrediction, setDirectionPrediction] =
    useState<DirectionPrediction>("");
  const [directionComplete, setDirectionComplete] = useState(false);
  const current = opticsActivity(inputs);
  const criticalTrials = OPTICS_CRITICAL_COMPARISON.map(opticsActivity);
  const directionTrials = OPTICS_DIRECTION_COMPARISON.map(opticsActivity);

  const reset = () => {
    setInputs({ angle: 40, from: "glass", to: "air" });
    setCriticalPrediction("");
    setCriticalComplete(false);
    setDirectionPrediction("");
    setDirectionComplete(false);
  };

  return (
    <LearningFrame onReset={reset}>
      <OpticsDiagram inputs={inputs} />
      <Explanation>
        Current ray: {current.from.name} → {current.to.name} · incident{" "}
        {current.inputs.angle.toFixed(1)}° · reflected{" "}
        {current.reflectedAngle === null
          ? "none"
          : `${current.reflectedAngle.toFixed(1)}°`}{" "}
        ·{" "}
        {current.tir
          ? "total internal reflection"
          : `refracted ${current.refractedAngle?.toFixed(1)}°`}
        .
      </Explanation>

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        1. Cross the critical angle
      </Text>
      <Explanation>
        Keep glass → air fixed. Change only the angle from 40° to 43°.
      </Explanation>
      <Choice
        label="At 43°, what happens to the transmitted ray?"
        value={criticalPrediction}
        onChange={(prediction) => {
          setCriticalPrediction(prediction);
          setCriticalComplete(false);
          setDirectionPrediction("");
          setDirectionComplete(false);
        }}
        options={[
          { value: "none", label: "No transmitted ray" },
          { value: "remains", label: "Transmitted ray remains" },
        ]}
      />
      <ActionButton
        label="Compare 40° and 43°"
        disabled={!criticalPrediction}
        onPress={() => {
          setCriticalComplete(true);
          setDirectionPrediction("");
          setDirectionComplete(false);
          setInputs({ angle: 43, from: "glass", to: "air" });
        }}
      />
      {criticalComplete && (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show 40° · refracted 74.6°"
                variant="secondary"
                onPress={() =>
                  setInputs({ angle: 40, from: "glass", to: "air" })
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show 43° · no transmitted ray"
                variant="secondary"
                onPress={() =>
                  setInputs({ angle: 43, from: "glass", to: "air" })
                }
              />
            </View>
          </View>
          <Explanation>
            Glass → air at 40° refracts to{" "}
            {criticalTrials[0].refractedAngle?.toFixed(1)}°; at 43° there is no
            transmitted ray.{" "}
            {criticalPrediction === "none"
              ? "The result matches your prediction. "
              : "The result differs from your prediction. "}
            The critical angle is {criticalTrials[0].criticalAngle?.toFixed(1)}
            °. TIR begins only above it. Explain: Why does the 43° ray stay in
            glass while the 40° ray crosses the boundary?
          </Explanation>
        </>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        2. Reverse the boundary
      </Text>
      <Explanation>
        Keep the angle at 30°. Compare air → glass with glass → air.
      </Explanation>
      {criticalComplete ? (
        <Choice
          label="How will the refracted ray change?"
          value={directionPrediction}
          onChange={(prediction) => {
            setDirectionPrediction(prediction);
            setDirectionComplete(false);
          }}
          options={[
            { value: "opposite", label: "Toward in glass; away in air" },
            { value: "same", label: "Same bend in both directions" },
          ]}
        />
      ) : (
        <Explanation>Complete the critical-angle comparison first.</Explanation>
      )}
      <ActionButton
        label="Compare both directions"
        disabled={!criticalComplete || !directionPrediction}
        onPress={() => {
          setDirectionComplete(true);
          setInputs({ angle: 30, from: "glass", to: "air" });
        }}
      />
      {directionComplete && (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show air → glass · refracted 19.5°"
                variant="secondary"
                onPress={() =>
                  setInputs({ angle: 30, from: "air", to: "glass" })
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show glass → air · refracted 48.6°"
                variant="secondary"
                onPress={() =>
                  setInputs({ angle: 30, from: "glass", to: "air" })
                }
              />
            </View>
          </View>
          <Explanation>
            Air → glass: {directionTrials[0].refractedAngle?.toFixed(1)}°,
            toward the normal. Glass → air:{" "}
            {directionTrials[1].refractedAngle?.toFixed(1)}°, away from the
            normal.{" "}
            {directionPrediction === "opposite"
              ? "The result matches your prediction. "
              : "The result differs from your prediction. "}
            The reflected angle remains 30°. Explain: Why does reversing the
            boundary change the bend even though the incident angle stays fixed?
          </Explanation>
        </>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}
      >
        Open controls
      </Text>
      <Choice
        label="From material"
        value={inputs.from}
        onChange={(from: OpticalMaterialId) =>
          setInputs((old) => ({ ...old, from }))
        }
        options={Object.values(OPTICAL_MATERIALS).map((material) => ({
          value: material.id,
          label: material.name,
        }))}
      />
      <Choice
        label="To material"
        value={inputs.to}
        onChange={(to: OpticalMaterialId) =>
          setInputs((old) => ({ ...old, to }))
        }
        options={Object.values(OPTICAL_MATERIALS).map((material) => ({
          value: material.id,
          label: material.name,
        }))}
      />
      <Control
        label="Incident angle"
        value={inputs.angle}
        min={0}
        max={80}
        onChange={(angle) => setInputs((old) => ({ ...old, angle }))}
      />

      <ModelNote>
        Refractive index compares light’s speed in vacuum with its speed in a
        material; a higher index means slower light. Snell’s law bends a ray
        toward the normal on entering a higher index and away on entering a
        lower one. A large angle alone cannot cause total internal reflection:
        the ray must travel from higher to lower index and exceed that pair’s
        critical angle. This single-color ray model omits absorption,
        scattering, polarization and color separation. Ray brightness is
        illustrative, not a calculated energy split.
      </ModelNote>
    </LearningFrame>
  );
}
