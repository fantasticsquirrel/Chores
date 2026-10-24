import {
  MachineWorkshopSimulation,
  HeatHouseSimulation,
  PressureTankSimulation,
} from "./expansion/mechanics";
import {
  MovingPlatesSimulation,
  CloudRainSimulation,
  MagneticFieldsSimulation,
} from "./expansion/earth";
import {
  CellExplorerSimulation,
  ShapeSlicerSimulation,
  AdaptationIslandSimulation,
} from "./expansion/life-geometry";
import { SoundPlaygroundSimulation } from "./SoundPlaygroundSimulation";
import { BridgeBuilderSimulation } from "./BridgeBuilderSimulation";
import { RiverSculptorSimulation } from "./RiverSculptorSimulation";
import { CircuitCitySimulation } from "./CircuitCitySimulation";
import { FoodWebSimulation } from "./FoodWebSimulation";
import { FractionFeastSimulation } from "./FractionFeastSimulation";
import { PatternPalaceSimulation } from "./PatternPalaceSimulation";
import { CaravanSimulation } from "./CaravanSimulation";
import { PollinatorSimulation } from "./PollinatorSimulation";
import { ChanceCarnivalSimulation } from "./ChanceCarnivalSimulation";
import { CastleSimulation } from "./CastleSimulation";
import { GravitySimulation } from "./GravitySimulation";
import { MoonSimulation } from "./MoonSimulation";
import { OpticsSimulation } from "./OpticsSimulation";
import { OrbitSimulation } from "./OrbitSimulation";
import { PhotosynthesisSimulation } from "./PhotosynthesisSimulation";
import { SolarSystemSimulation } from "./SolarSystemSimulation";
import "./simulations.css";
const SIMULATIONS = {
  "machine-workshop": MachineWorkshopSimulation,
  "heat-house": HeatHouseSimulation,
  "pressure-tank": PressureTankSimulation,
  "moving-plates": MovingPlatesSimulation,
  "cloud-rain-lab": CloudRainSimulation,
  "magnetic-fields": MagneticFieldsSimulation,
  "cell-explorer": CellExplorerSimulation,
  "shape-slicer": ShapeSlicerSimulation,
  "adaptation-island": AdaptationIslandSimulation,
  "orbital-mechanics": OrbitSimulation,
  "reflection-refraction": OpticsSimulation,
  gravity: GravitySimulation,
  "solar-system": SolarSystemSimulation,
  "moon-phases": MoonSimulation,
  photosynthesis: PhotosynthesisSimulation,
  "castle-defenses": CastleSimulation,
  "sound-playground": SoundPlaygroundSimulation,
  "bridge-builder": BridgeBuilderSimulation,
  "river-sculptor": RiverSculptorSimulation,
  "circuit-city": CircuitCitySimulation,
  "food-web-rescue": FoodWebSimulation,
  "fraction-feast": FractionFeastSimulation,
  "pattern-palace": PatternPalaceSimulation,
  "caravan-crossroads": CaravanSimulation,
  "pollinator-express": PollinatorSimulation,
  "chance-carnival": ChanceCarnivalSimulation,
};
export function ExplorationSimulation({
  explorationId,
}: {
  explorationId: string;
}) {
  const Component = Object.prototype.hasOwnProperty.call(
    SIMULATIONS,
    explorationId,
  )
    ? SIMULATIONS[explorationId as keyof typeof SIMULATIONS]
    : undefined;
  return Component ? (
    <Component key={explorationId} />
  ) : (
    <p>This exploration's interactive model is not available.</p>
  );
}
