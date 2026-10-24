import { lazy, Suspense, useState, type ReactNode } from "react";
import type { PhysicalAction, PhysicalSceneState } from "./sceneTypes";
const PhysicalCanvas = lazy(() => import("./PhysicalCanvas"));
export function PhysicalStage({
  state,
  onAction,
  description,
  fallback,
  children,
  header,
}: {
  state: PhysicalSceneState;
  onAction: (action: PhysicalAction) => void;
  description: string;
  fallback: ReactNode;
  children?: ReactNode;
  header?: ReactNode;
}) {
  const [unavailable, setUnavailable] = useState<boolean>(
    typeof window !== "undefined" && !window.WebGLRenderingContext,
  );
  return (
    <div className={`dl-physical-stage dl-physical-stage--${state.kind}`}>
      {header}
      <div className="dl-physical-view" role="img" aria-label={description}>
        {!unavailable ? (
          <Suspense
            fallback={
              <div className="dl-physical-loading">Loading the model…</div>
            }
          >
            <PhysicalCanvas
              state={state}
              onAction={onAction}
              onUnavailable={() => setUnavailable(true)}
            />
          </Suspense>
        ) : (
          <div className="dl-physical-fallback">
            <svg viewBox="0 0 720 420" aria-hidden="true">
              {fallback}
            </svg>
            <p>3D view unavailable. Use the controls and measurements below.</p>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
export function PhysicalLayout({
  children,
  controls,
  readout,
  question,
  explanation,
  caveat,
}: {
  children: ReactNode;
  controls: ReactNode;
  readout: ReactNode;
  question: string;
  explanation: string;
  caveat: string;
}) {
  return (
    <section className="dl-physical">
      {children}
      <div className="dl-physical-controls">{controls}</div>
      <div className="dl-physical-investigation">
        <div>
          <strong>Try this</strong>
          <p>{question}</p>
        </div>
        <div>
          <strong>What explains it?</strong>
          <p>{explanation}</p>
        </div>
      </div>
      <div className="dl-physical-readout">{readout}</div>
      <p className="dl-physical-caveat">{caveat}</p>
    </section>
  );
}
