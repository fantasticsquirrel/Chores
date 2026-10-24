import type {
  MachineState,
  HeatState,
  PressureState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import type {
  PlateState,
  CloudState,
  MagneticState,
} from "@family-manager/family-api/discovery-models/expansion-earth";

import type {
  CellExplorerState,
  ShapeSlicerState,
  AdaptationIslandState,
} from "@family-manager/family-api/discovery-models/expansion-life-geometry";

export type ExpansionSceneState =
  | ({ kind: "cell-explorer" } & CellExplorerState)
  | ({ kind: "shape-slicer" } & ShapeSlicerState)
  | ({ kind: "adaptation-island" } & AdaptationIslandState)
  | ({ kind: "machine-workshop" } & MachineState)
  | ({ kind: "heat-house" } & HeatState)
  | ({ kind: "pressure-tank" } & PressureState)
  | ({ kind: "moving-plates" } & PlateState)
  | ({ kind: "cloud-rain-lab" } & CloudState)
  | ({ kind: "magnetic-fields" } & MagneticState);
