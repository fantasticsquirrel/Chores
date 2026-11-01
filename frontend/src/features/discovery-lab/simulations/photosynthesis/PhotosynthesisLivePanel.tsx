import type { CSSProperties } from "react";
import {
  photosynthesisActivity,
} from "@family-manager/family-api/discovery-models/photosynthesis";
import { resourceList, roundIndex } from "./photosynthesisFormat";

type PhotosynthesisResult = ReturnType<typeof photosynthesisActivity>;

export function PhotosynthesisLivePanel({
  current,
}: {
  current: PhotosynthesisResult;
}) {
  return (
    <aside className="leaf-live-panel" aria-label="Current model reading">
      <div className="leaf-current-result" role="status" aria-live="polite">
        <div
          className="leaf-index-gauge"
          style={{
            "--leaf-index": `${current.activityIndex * 3.6}deg`,
          } as CSSProperties}
          aria-hidden="true"
        >
          <div>
            <strong>{roundIndex(current.activityIndex)}</strong>
            <span>/ 100</span>
          </div>
        </div>
        <div className="leaf-reading-copy">
          <span>
            Toy activity index: {" "}
            <strong>{roundIndex(current.activityIndex)} / 100</strong>
          </span>
          <span>
            Model limit(s): {" "}
            <strong>{resourceList(current.limitingResources)}</strong>
          </span>
        </div>
        <div className="leaf-input-readings" aria-label="Current input settings">
          {([
            ["Light energy", current.inputs.light, "leaf-input-light"],
            ["Water", current.inputs.water, "leaf-input-water"],
            [
              "Carbon dioxide",
              current.inputs.carbonDioxide,
              "leaf-input-carbon",
            ],
          ] as const).map(([label, value, className]) => (
            <div key={label} className={className}>
              <span>{label}</span>
              <strong>{value}%</strong>
              <i aria-hidden="true">
                <b style={{ width: `${value}%` }} />
              </i>
            </div>
          ))}
        </div>
      </div>
      <div className="leaf-process-note" data-testid="leaf-process-note">
        <p>
          Light supplies energy. Water and carbon dioxide supply matter for
          sugars; the oxygen released comes from water.
        </p>
      </div>
    </aside>
  );
}

