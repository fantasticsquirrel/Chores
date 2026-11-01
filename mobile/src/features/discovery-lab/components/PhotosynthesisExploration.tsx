import { useState } from "react";
import { Text, View } from "react-native";
import {
  comparePhotosynthesisInputs,
  photosynthesisActivity,
  PHOTOSYNTHESIS_DEFAULT_INPUTS,
  PHOTOSYNTHESIS_LIGHT_STEPS,
  PHOTOSYNTHESIS_ZERO_WATER,
  type PhotosynthesisInputs,
  type PhotosynthesisResource,
} from "@family-manager/family-api/discovery-models/photosynthesis";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { Control } from "./Primitives";
import {
  Choice,
  Diagram,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "./LearningPrimitives";

type ZeroPrediction = "" | "restores" | "stays-zero";
type LightPrediction = "" | "keeps-rising" | "levels-off";

function roundIndex(value: number) {
  return Math.round(value);
}

const RESOURCE_FIELDS: Record<
  PhotosynthesisResource,
  keyof PhotosynthesisInputs
> = {
  light: "light",
  water: "water",
  "carbon dioxide": "carbonDioxide",
};

function changedSettings(
  resources: PhotosynthesisResource[],
  first: PhotosynthesisInputs,
  second: PhotosynthesisInputs,
) {
  return resources
    .map((resource) => {
      const field = RESOURCE_FIELDS[resource];
      return `${resource} ${first[field]}% → ${second[field]}%`;
    })
    .join(" · ");
}

function heldSettings(
  resources: PhotosynthesisResource[],
  inputs: PhotosynthesisInputs,
) {
  return resources
    .map((resource) => `${resource} ${inputs[RESOURCE_FIELDS[resource]]}%`)
    .join(" · ");
}

export function PhotosynthesisExploration() {
  const [inputs, setInputs] = useState<PhotosynthesisInputs>({
    ...PHOTOSYNTHESIS_DEFAULT_INPUTS,
  });
  const [zeroPrediction, setZeroPrediction] = useState<ZeroPrediction>("");
  const [zeroComplete, setZeroComplete] = useState(false);
  const [lightPrediction, setLightPrediction] = useState<LightPrediction>("");
  const [lightComplete, setLightComplete] = useState(false);
  const [comparisonA, setComparisonA] = useState<PhotosynthesisInputs | null>(
    null,
  );

  const current = photosynthesisActivity(inputs);
  const lowLight = photosynthesisActivity(PHOTOSYNTHESIS_LIGHT_STEPS[0]);
  const tiedLight = photosynthesisActivity(PHOTOSYNTHESIS_LIGHT_STEPS[1]);
  const highLight = photosynthesisActivity(PHOTOSYNTHESIS_LIGHT_STEPS[2]);
  const comparison = comparisonA
    ? comparePhotosynthesisInputs(comparisonA, inputs)
    : null;

  const reset = () => {
    setInputs({ ...PHOTOSYNTHESIS_DEFAULT_INPUTS });
    setZeroPrediction("");
    setZeroComplete(false);
    setLightPrediction("");
    setLightComplete(false);
    setComparisonA(null);
  };

  return (
    <LearningFrame onReset={reset}>
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 23, fontWeight: "800" }}
      >
        1. Test a missing input
      </Text>
      <Explanation>
        Hold water at 0% and carbon dioxide at 80%. Change only light.
      </Explanation>
      <Choice
        label="Predict: what will 100% light do?"
        value={zeroPrediction}
        onChange={(prediction) => {
          setZeroPrediction(prediction);
          setZeroComplete(false);
          setLightPrediction("");
          setLightComplete(false);
        }}
        options={[
          { value: "restores", label: "More light restores activity" },
          { value: "stays-zero", label: "Activity stays at zero" },
        ]}
      />
      <ActionButton
        label="Compare light at zero water"
        disabled={!zeroPrediction}
        onPress={() => {
          setZeroComplete(true);
          setLightPrediction("");
          setLightComplete(false);
          setInputs({ ...PHOTOSYNTHESIS_ZERO_WATER.high });
        }}
      />
      {zeroComplete && (
        <Explanation>
          Water held at 0% · carbon dioxide held at 80%. At 30% and 100% light,
          both toy activity indices are 0.{" "}
          {zeroPrediction === "stays-zero"
            ? "The result matches your prediction. "
            : "The result differs from your prediction. "}
          More light cannot replace water, a matter input in photosynthesis.
        </Explanation>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        2. Find the limiting input
      </Text>
      <Explanation>
        Hold water at 35% and carbon dioxide at 80%. Change only light.
      </Explanation>
      {zeroComplete ? (
        <Choice
          label="Predict: what happens above 35% light?"
          value={lightPrediction}
          onChange={(prediction) => {
            setLightPrediction(prediction);
            setLightComplete(false);
          }}
          options={[
            { value: "keeps-rising", label: "Keeps rising with light" },
            {
              value: "levels-off",
              label: "Levels off once water limits",
            },
          ]}
        />
      ) : (
        <Explanation>Complete the zero-water comparison first.</Explanation>
      )}
      <ActionButton
        label="Compare three light levels"
        disabled={!zeroComplete || !lightPrediction}
        onPress={() => {
          setLightComplete(true);
          setInputs({ ...PHOTOSYNTHESIS_LIGHT_STEPS[2] });
        }}
      />
      {lightComplete && (
        <Explanation>
          Water: 35% · carbon dioxide: 80%. The index is{" "}
          {roundIndex(lowLight.activityIndex)} at 15% light,{" "}
          {roundIndex(tiedLight.activityIndex)} at 35%, and{" "}
          {roundIndex(highLight.activityIndex)} at 100%.{" "}
          {lightPrediction === "levels-off"
            ? "The result matches your prediction. "
            : "The result differs from your prediction. "}
          At 35%, light and water tie. At 100% light, water limits this model.
        </Explanation>
      )}

      <Diagram
        label={
          "Magnified leaf model. Toy activity index " +
          roundIndex(current.activityIndex) +
          " out of 100. Model limit or limits: " +
          current.limitingResources.join(" and ") +
          ". Light " +
          current.inputs.light +
          " percent, water " +
          current.inputs.water +
          " percent, carbon dioxide " +
          current.inputs.carbonDioxide +
          " percent."
        }
        visualState={{
          kind: "leaf",
          light: current.inputs.light,
          water: current.inputs.water,
          carbon: current.inputs.carbonDioxide,
          rate: current.activityIndex,
        }}
      >
        {(width) => (
          <View
            style={{
              position: "absolute",
              left: width * 0.2,
              right: width * 0.2,
              top: 70,
              bottom: 50,
              borderRadius: 70,
              backgroundColor: "#4f9a58",
              transform: [{ rotate: "-16deg" }],
            }}
          />
        )}
      </Diagram>
      <Meter
        label="Toy activity index"
        value={current.activityIndex}
        detail={
          roundIndex(current.activityIndex) +
          " / 100 · model limit(s): " +
          current.limitingResources.join(" and ")
        }
      />
      <Explanation>
        Light energy + water + carbon dioxide → sugars + oxygen. Light supplies
        energy, not food; the oxygen released comes from water.
      </Explanation>

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}
      >
        Open controls
      </Text>
      <Control
        label="Light availability"
        value={inputs.light}
        min={0}
        max={100}
        step={10}
        onChange={(light) => setInputs((old) => ({ ...old, light }))}
      />
      <Control
        label="Water availability"
        value={inputs.water}
        min={0}
        max={100}
        step={10}
        onChange={(water) => setInputs((old) => ({ ...old, water }))}
      />
      <Control
        label="Carbon dioxide"
        value={inputs.carbonDioxide}
        min={0}
        max={100}
        step={10}
        onChange={(carbonDioxide) =>
          setInputs((old) => ({ ...old, carbonDioxide }))
        }
      />
      <ActionButton
        label={comparisonA ? "Replace comparison A" : "Set comparison A"}
        onPress={() => setComparisonA({ ...current.inputs })}
      />
      {comparisonA && comparison ? (
        <Explanation>
          A: {roundIndex(photosynthesisActivity(comparisonA).activityIndex)}{" "}
          /100 · current: {roundIndex(current.activityIndex)} /100.{" "}
          {comparison.changed.length === 0
            ? "Change one resource to compare with A."
            : "Changed: " +
              changedSettings(comparison.changed, comparisonA, inputs) +
              ". Held: " +
              (comparison.held.length
                ? heldSettings(comparison.held, inputs)
                : "none") +
              "." +
              (comparison.controlled
                ? ""
                : " Change only one resource for a controlled comparison.")}
        </Explanation>
      ) : (
        <Explanation>Set A, then change one resource.</Explanation>
      )}

      <ModelNote>
        Settings are invented availability levels. The toy index applies the
        same saturating rule to each input, then uses the lowest response. It is
        not a measured photosynthesis rate, sugar amount or growth forecast.
        Temperature, species, nutrients, stored water and stomatal behavior are
        omitted. Plants respire day and night; the index does not subtract
        respiration.
      </ModelNote>
    </LearningFrame>
  );
}
