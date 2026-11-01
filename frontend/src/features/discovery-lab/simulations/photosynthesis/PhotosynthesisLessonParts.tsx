import {
  photosynthesisActivity,
  type PhotosynthesisInputs,
} from "@family-manager/family-api/discovery-models/photosynthesis";
import { roundIndex } from "./photosynthesisFormat";

export function ActivityRow({
  label,
  inputs,
}: {
  label: string;
  inputs: PhotosynthesisInputs;
}) {
  const result = photosynthesisActivity(inputs);
  return (
    <div className="leaf-evidence-row">
      <div className="leaf-evidence-copy">
        <strong>{label}</strong>
        <span>{roundIndex(result.activityIndex)} / 100</span>
      </div>
      <div className="leaf-evidence-track" aria-hidden="true">
        <span style={{ width: `${result.activityIndex}%` }} />
      </div>
    </div>
  );
}

export function PredictionButtons<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="leaf-prediction" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="leaf-prediction-options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
