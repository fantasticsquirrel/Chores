import {
  magneticFieldsTrials,
  type MagneticState,
} from "@family-manager/family-api/discovery-models/magnetic-fields";
import { MechanicsComparison } from "../mechanics/MechanicsComparison";

export function MagneticFieldsComparison({
  onApply,
}: {
  onApply: (state: MagneticState) => void;
}) {
  return (
    <MechanicsComparison experiments={magneticFieldsTrials} onApply={onApply} />
  );
}
