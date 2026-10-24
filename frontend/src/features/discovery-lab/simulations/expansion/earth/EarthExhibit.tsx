import type { ReactNode } from "react";
import "../../landscape/landscape-learning.css";
import "./earth.css";
export function EarthExhibit({
  question,
  introduction,
  scene,
  controls,
  evidence,
  investigations,
  note,
}: {
  question: string;
  introduction: string;
  scene: ReactNode;
  controls: ReactNode;
  evidence: ReactNode;
  investigations: ReactNode;
  note: string;
}) {
  return (
    <section className="earth-exhibit">
      <header>
        <h2>{question}</h2>
        <p>{introduction}</p>
      </header>
      <div className="earth-workbench">
        <div className="earth-visual">{scene}</div>
        <div className="earth-controls">{controls}</div>
      </div>
      <div className="earth-evidence" aria-live="polite" aria-atomic="true">
        {evidence}
      </div>
      {investigations}
      <p className="earth-model-note">{note}</p>
    </section>
  );
}
export function EarthMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="earth-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
