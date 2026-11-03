import {
  movingPlatesTrials,
  type PlateState,
} from "@family-manager/family-api/discovery-models/moving-plates";
import { MechanicsComparison } from "../mechanics/MechanicsComparison";

export function MovingPlatesComparison({
  onApply,
}: {
  onApply: (state: PlateState) => void;
}) {
  return (
    <MechanicsComparison experiments={movingPlatesTrials} onApply={onApply} />
  );
}
