import {
  cloudRainTrials,
  type CloudState,
} from "@family-manager/family-api/discovery-models/cloud-rain";
import { MechanicsComparison } from "../mechanics/MechanicsComparison";

export function CloudRainComparison({
  onApply,
}: {
  onApply: (state: CloudState) => void;
}) {
  return (
    <MechanicsComparison experiments={cloudRainTrials} onApply={onApply} />
  );
}
