import { Text, View } from "react-native";
import { patternVertexFit } from "@family-manager/family-api/discovery-models/patterns";
import { ActionButton } from "../../../components/ActionButton";
import { Control } from "./Primitives";
import {
  Choice,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";
import {
  PatternMotifDiagram,
  PatternTileDiagram,
} from "./pattern/PatternVisuals";
import {
  type NativeCornerPrediction,
  type NativeMotifTransformation,
  type NativeTransformPrediction,
  useNativePatternLesson,
} from "./pattern/useNativePatternLesson";
import { colors } from "../../../styles/colors";

const motifStates: Record<
  NativeMotifTransformation,
  {
    rotation: 0 | 90 | 180 | 270;
    reflected: boolean;
    label: string;
  }
> = {
  original: { rotation: 0, reflected: false, label: "Original motif" },
  "quarter-turn": {
    rotation: 90,
    reflected: false,
    label: "90° clockwise turn",
  },
  "half-turn": {
    rotation: 180,
    reflected: false,
    label: "180° turn",
  },
  reflection: {
    rotation: 0,
    reflected: true,
    label: "Vertical reflection",
  },
};

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

export function PatternExploration() {
  const lesson = useNativePatternLesson();
  const sides = Number(lesson.sides);
  const fit = patternVertexFit(sides, lesson.copies)!;
  const motif = motifStates[lesson.transformation];
  const fitResult =
    fit.relation === "gap"
      ? `${fit.gapAngle}° gap`
      : fit.relation === "overlap"
        ? `${fit.overlapAngle}° overlap`
        : "exact 360° fit";

  return (
    <LearningFrame onReset={lesson.reset} resetLabel="Reset lesson">
      <PatternTileDiagram sides={sides} copies={lesson.copies} />
      <Explanation>
        Corner calculation: {fit.copies} × {fit.interiorAngle}° ={" "}
        {fit.occupiedAngle}° · {fitResult}.
      </Explanation>

      <SectionTitle>1 · Turn or reflect?</SectionTitle>
      <PatternMotifDiagram
        rotation={0}
        reflected={false}
        label="Original motif"
      />
      <Explanation>
        Point M starts 30 units left and 18 units up. Which operation moves M
        farther right while the motif size and center stay fixed?
      </Explanation>
      <Choice
        label="Prediction: farther right"
        value={lesson.transformPrediction ?? ""}
        onChange={(value) =>
          lesson.setTransformPrediction(value as NativeTransformPrediction)
        }
        options={[
          { value: "turn", label: "Quarter-turn" },
          { value: "reflection", label: "Reflection" },
          { value: "same", label: "Same horizontal position" },
        ]}
      />
      <ActionButton
        label="Compare the two transformations"
        disabled={!lesson.transformPrediction}
        onPress={lesson.compareTransformations}
      />
      {lesson.transformCompared && (
        <>
          <PatternMotifDiagram
            rotation={90}
            reflected={false}
            label="90° clockwise turn"
          />
          <PatternMotifDiagram
            rotation={0}
            reflected
            label="Vertical reflection"
          />
          <Explanation>
            {lesson.transformPrediction === "reflection"
              ? "The evidence matches your prediction. "
              : "The evidence differs from your prediction. "}
            Turn: M is 18 right and 30 up. Reflection: M is 30 right and 18 up.
            M moved farther right after the reflection. Changed: transformation.
            Held: motif dimensions · center · marked point M. Corresponding
            lengths and angles stay equal.
          </Explanation>
        </>
      )}

      <SectionTitle>2 · Add one pentagon</SectionTitle>
      <Explanation>
        Three regular pentagons leave 36°. Keep their shape, size, 108° corner
        and meeting point fixed. What happens when a fourth is added?
      </Explanation>
      <Choice
        label="Prediction: fourth pentagon"
        value={lesson.cornerPrediction ?? ""}
        onChange={(value) =>
          lesson.setCornerPrediction(value as NativeCornerPrediction)
        }
        options={[
          { value: "exact", label: "Exact fit" },
          { value: "gap", label: "Still a gap" },
          { value: "overlap", label: "72° overlap" },
        ]}
      />
      <ActionButton
        label="Compare 3 and 4 pentagons"
        disabled={!lesson.cornerPrediction}
        onPress={lesson.compareCorners}
      />
      {lesson.cornerCompared && (
        <Explanation>
          {lesson.cornerPrediction === "overlap"
            ? "The evidence matches your prediction. "
            : "The evidence differs from your prediction. "}
          3 × 108° = 324°, leaving 36°. 4 × 108° = 432°, so the fourth pentagon
          overlaps 72°. Changed: number of pentagons. Held: regular shape · side
          length · interior angle · meeting point.
        </Explanation>
      )}

      {lesson.explorationUnlocked ? (
        <View style={{ gap: 16 }}>
          <SectionTitle>Explore one change at a time</SectionTitle>
          <Choice
            label="Regular tile"
            value={lesson.sides}
            onChange={lesson.setSides}
            options={[
              { value: "3", label: "Triangle" },
              { value: "4", label: "Square" },
              { value: "5", label: "Pentagon" },
              { value: "6", label: "Hexagon" },
            ]}
          />
          <Control
            label="Tiles around one point"
            value={lesson.copies}
            min={1}
            max={8}
            onChange={lesson.setCopies}
          />
          <Choice
            label="Motif transformation"
            value={lesson.transformation}
            onChange={lesson.setTransformation}
            options={[
              { value: "original", label: "Original" },
              { value: "quarter-turn", label: "90° clockwise turn" },
              { value: "half-turn", label: "180° turn" },
              { value: "reflection", label: "Vertical reflection" },
            ]}
          />
          <PatternMotifDiagram
            rotation={motif.rotation}
            reflected={motif.reflected}
            label={motif.label}
          />
        </View>
      ) : (
        <Explanation>
          Complete both comparisons to unlock the shape and transformation
          controls.
        </Explanation>
      )}

      <ModelNote>
        Model boundary: every corner tile shown is regular, with equal sides and
        equal interior angles. A 360° fit at one observed point is necessary for
        this local arrangement, but a finite example alone does not prove a rule
        extends across the plane. Irregular polygons can behave differently.
      </ModelNote>
    </LearningFrame>
  );
}
