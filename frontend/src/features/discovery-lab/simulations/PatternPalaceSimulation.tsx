import { useId, useState } from "react";
import {
  transformPoint,
  vertexFit,
} from "@family-manager/family-api/discovery-models/math-life";
import { Slider } from "./SimulationPrimitives";
import { PatternWorkbench } from "./tactile/PatternWorkbench";
import "./tactile/tactile.css";
export function PatternPalaceSimulation() {
  const id = useId();
  const [rotation, setRotation] = useState(0),
    [mirror, setMirror] = useState(false),
    [repeat, setRepeat] = useState(5);
  const [sides, setSides] = useState(5),
    [copies, setCopies] = useState(3),
    [prediction, setPrediction] = useState<string | null>(null);
  const fit = vertexFit(sides, copies);
  const marker = transformPoint(-28, -26, rotation, mirror);
  const markerLocation = `${marker.y < 0 ? "upper" : "lower"} ${marker.x < 0 ? "left" : "right"}`;
  const result =
    fit.gap > 0
      ? `${fit.gap}° gap`
      : fit.overlap > 0
        ? `${fit.overlap}° overlap`
        : "360°: an exact fit";
  const reset = () => {
    setRotation(0);
    setMirror(false);
    setRepeat(5);
    setSides(5);
    setCopies(3);
    setPrediction(null);
  };
  return (
    <div className="tactile-exhibit pattern-exhibit">
      <header className="tactile-heading">
        <span>ONE POINT / A FULL TURN IS 360°</span>
        <h2>Will the tiles fit together?</h2>
        <p>
          Keep each tile regular. Change the shape or the number meeting at a
          corner.
        </p>
      </header>
      <PatternWorkbench
        sides={sides}
        copies={copies}
        rotation={rotation}
        mirror={mirror}
        repeat={repeat}
      />
      <div className="tactile-console pattern-console">
        <div className="tactile-control-group">
          <span className="tactile-kicker">SHAPE & CORNERS</span>
          <label htmlFor={`${id}-shape`}>Regular tile shape</label>
          <select
            id={`${id}-shape`}
            value={sides}
            onChange={(event) => setSides(Number(event.target.value))}
          >
            {[
              [3, "Equilateral triangles"],
              [4, "Squares"],
              [5, "Regular pentagons"],
              [6, "Regular hexagons"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Slider
            label="Tiles around one point"
            value={copies}
            min={1}
            max={6}
            onChange={setCopies}
          />
        </div>
        <div className="tactile-control-group">
          <span className="tactile-kicker">TURN & REFLECT</span>
          <Slider
            label="Motif rotation"
            value={rotation}
            min={0}
            max={345}
            step={15}
            unit="°"
            onChange={setRotation}
          />
          <label className="tactile-check">
            <input
              type="checkbox"
              checked={mirror}
              onChange={(event) => setMirror(event.target.checked)}
            />{" "}
            Reflect left to right
          </label>
          <button
            type="button"
            onClick={() => setRotation((rotation + 90) % 360)}
          >
            Turn 90°
          </button>
        </div>
        <div className="tactile-control-group">
          <span className="tactile-kicker">REPEAT</span>
          <Slider
            label="Repeated motifs"
            value={repeat}
            min={1}
            max={6}
            onChange={setRepeat}
          />
          <button type="button" onClick={reset}>
            Reset
          </button>
        </div>
      </div>
      <div className="tactile-investigation">
        <div>
          <span className="tactile-kicker">PREDICT</span>
          <h3>Will three regular pentagons fill one full turn?</h3>
          <div className="dl-actions">
            {["A gap", "An exact fit", "An overlap"].map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={prediction === label}
                onClick={() => setPrediction(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="tactile-kicker">OBSERVE</span>
          <h3>Compare three pentagons with four.</h3>
          <div className="dl-actions">
            <button
              type="button"
              onClick={() => {
                setSides(5);
                setCopies(3);
              }}
            >
              Test 3 pentagons
            </button>
            <button
              type="button"
              onClick={() => {
                setSides(5);
                setCopies(4);
              }}
            >
              Test 4 pentagons
            </button>
          </div>
          <p>
            Keep the tile size fixed. Does adding a tile close the gap exactly?
          </p>
        </div>
        <div>
          <span className="tactile-kicker">EXPLAIN</span>
          <p>
            Each regular pentagon has a 108° corner. Three total 324°; four
            total 432°. Neither is 360°.
          </p>
          <p>
            Next, predict where the red dot goes after a reflection, then a 90°
            turn. Compare the original and changed motif.
          </p>
        </div>
      </div>
      <div className="tactile-readout" role="status" aria-live="polite">
        <strong>{result}</strong> · {copies} × {fit.angle}° ={" "}
        {copies * fit.angle}°.
        <br />
        {fit.gap > 0
          ? "The gold sector is still uncovered."
          : fit.overlap > 0
            ? "The rose sector is covered more than once."
            : "The corners meet without a gap or overlap."}{" "}
        Reflection flips the motif; rotation turns it. Red dot: {markerLocation}
        . Lengths and angles are unchanged.
      </div>
      <p className="tactile-model-note">
        The tile faces are shown from directly above, so their angles are not
        distorted. A 360° corner fit is necessary but does not alone prove a
        full-plane tiling. These regular triangles, squares and hexagons do tile
        the plane; other tilings may mix shapes.
      </p>
    </div>
  );
}
