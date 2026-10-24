import { lazy, Suspense } from "react";
const LeafCanvas = lazy(() =>
  import("./botany/LeafCanvas").then((module) => ({
    default: module.LeafCanvas,
  })),
);
import { useState } from "react";
import { photosynthesis } from "./physics";
import { LabLayout, Slider } from "./SimulationPrimitives";
export function PhotosynthesisSimulation() {
  const [light, setLight] = useState(70),
    [water, setWater] = useState(60),
    [carbon, setCarbon] = useState(80),
    [saved, setSaved] = useState<number | null>(null);
  const result = photosynthesis(light, water, carbon);
  return (
    <LabLayout
      question="Set water to zero. Can extra light restore sugar production? Restore water slowly and notice when a different resource becomes limiting."
      controls={
        <>
          <Slider
            label="Light availability"
            value={light}
            min={0}
            max={100}
            unit="%"
            onChange={setLight}
          />
          <Slider
            label="Water availability"
            value={water}
            min={0}
            max={100}
            unit="%"
            onChange={setWater}
          />
          <Slider
            label="Carbon dioxide"
            value={carbon}
            min={0}
            max={100}
            unit="%"
            onChange={setCarbon}
          />
          <div className="dl-actions">
            <button type="button" onClick={() => setSaved(result.rate)}>
              Save comparison
            </button>
            <button
              type="button"
              onClick={() => {
                setLight(70);
                setWater(60);
                setCarbon(80);
                setSaved(null);
              }}
            >
              Reset
            </button>
          </div>
          <p className="dl-note">
            Illustrative resource model, not a plant-growth prediction.
            Temperature, species and nutrients are held constant. Plants also
            respire, day and night.
          </p>
        </>
      }
      readout={
        <>
          <span>
            Relative activity: <strong>{Math.round(result.rate)} / 100</strong>
          </span>
          <span>
            Limiting resource: <strong>{result.limiting}</strong>
          </span>
          {saved !== null && (
            <span>
              Saved trial: <strong>{Math.round(saved)} / 100</strong> · change{" "}
              {Math.round(result.rate - saved) >= 0 ? "+" : ""}
              {Math.round(result.rate - saved)}
            </span>
          )}
        </>
      }
    >
      <Suspense fallback={<p>Loading leaf model…</p>}>
        <LeafCanvas
          light={light}
          water={water}
          carbon={carbon}
          rate={result.rate}
        />
      </Suspense>
    </LabLayout>
  );
}
