import { useId } from "react";
import { patternVertexFit } from "@family-manager/family-api/discovery-models/patterns";
import { Slider } from "./SimulationPrimitives";
import { PatternPredictionTrials } from "./pattern/PatternPredictionTrials";
import {
  type MotifTransformation,
  usePatternLesson,
} from "./pattern/usePatternLesson";
import { PatternWorkbench } from "./tactile/PatternWorkbench";
import "./tactile/tactile.css";
import "./pattern/pattern-palace.css";

const transformationDetails: Record<
  MotifTransformation,
  { rotation: number; mirror: boolean; label: string }
> = {
  original: { rotation: 0, mirror: false, label: "original position" },
  "quarter-turn": {
    rotation: 90,
    mirror: false,
    label: "clockwise quarter-turn",
  },
  "half-turn": {
    rotation: 180,
    mirror: false,
    label: "clockwise half-turn",
  },
  reflection: {
    rotation: 0,
    mirror: true,
    label: "reflection across the vertical line",
  },
};

export function PatternPalaceSimulation() {
  const id = useId();
  const lesson = usePatternLesson();
  const fit = patternVertexFit(lesson.sides, lesson.copies)!;
  const transform = transformationDetails[lesson.transformation];
  const fitLabel =
    fit.relation === "gap"
      ? `${fit.gapAngle}° gap`
      : fit.relation === "overlap"
        ? `${fit.overlapAngle}° overlap`
        : "exact 360° fit";

  return (
    <div className="tactile-exhibit pattern-exhibit">
      <header className="tactile-heading pattern-heading">
        <h2>Test turns and corner fits</h2>
        <p>
          Predict first. Compare one changed variable, then use the angle
          evidence to explain the result.
        </p>
      </header>

      <PatternWorkbench
        sides={lesson.sides}
        copies={lesson.copies}
        rotation={transform.rotation}
        mirror={transform.mirror}
        repeat={5}
        transformationLabel={transform.label}
      />

      <PatternPredictionTrials
        transformPrediction={lesson.transformPrediction}
        cornerPrediction={lesson.cornerPrediction}
        transformCompared={lesson.transformCompared}
        cornerCompared={lesson.cornerCompared}
        onTransformPrediction={lesson.setTransformPrediction}
        onCornerPrediction={lesson.setCornerPrediction}
        onCompareTransformations={lesson.compareTransformations}
        onCompareCorners={lesson.compareCorners}
      />

      <div
        className="tactile-readout pattern-readout"
        role="status"
        aria-live="polite"
      >
        <div>
          <span>Corner calculation</span>
          <strong>
            {fit.copies} × {fit.interiorAngle}° = {fit.occupiedAngle}°
          </strong>
          <small>{fitLabel}</small>
        </div>
        <div>
          <span>Motif image</span>
          <strong>{transform.label}</strong>
          <small>corresponding lengths and angles unchanged</small>
        </div>
      </div>

      {lesson.explorationUnlocked ? (
        <section className="pattern-explore" aria-labelledby={`${id}-explore`}>
          <div className="pattern-explore-heading">
            <div>
              <h3 id={`${id}-explore`}>Explore one change at a time</h3>
              <p>
                Reset the selected control before a new comparison. The corner
                calculation is local evidence, not proof of a full tiling.
              </p>
            </div>
            <button type="button" onClick={lesson.reset}>
              Reset lesson
            </button>
          </div>
          <div className="pattern-free-controls">
            <label>
              <span>Regular tile shape</span>
              <select
                value={lesson.sides}
                onChange={(event) =>
                  lesson.setSides(Number(event.target.value))
                }
              >
                <option value={3}>Equilateral triangle</option>
                <option value={4}>Square</option>
                <option value={5}>Regular pentagon</option>
                <option value={6}>Regular hexagon</option>
              </select>
            </label>
            <Slider
              label="Tiles around one point"
              value={lesson.copies}
              min={1}
              max={8}
              onChange={lesson.setCopies}
            />
            <label>
              <span>Motif transformation</span>
              <select
                value={lesson.transformation}
                onChange={(event) =>
                  lesson.setTransformation(
                    event.target.value as MotifTransformation,
                  )
                }
              >
                <option value="original">Original</option>
                <option value="quarter-turn">90° clockwise turn</option>
                <option value="half-turn">180° turn</option>
                <option value="reflection">Vertical reflection</option>
              </select>
            </label>
          </div>
        </section>
      ) : (
        <div className="pattern-locked">
          Complete both comparisons to unlock the shape and transformation
          controls.
          <button type="button" onClick={lesson.reset}>
            Reset lesson
          </button>
        </div>
      )}

      <p className="tactile-model-note pattern-model-note">
        Model boundary: every corner tile here is a regular polygon, with equal
        sides and equal interior angles. A 360° fit at one observed point is
        necessary for this local arrangement, but a finite example alone does
        not prove that a proposed rule extends without gaps across the plane.
        Irregular polygons with the same number of sides can behave differently.
      </p>
    </div>
  );
}
