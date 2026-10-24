import {
  MachineExploration,
  HeatExploration,
  PressureExploration,
} from "./expansion/MechanicsExplorations";
import {
  PlatesExploration,
  CloudExploration,
  MagnetExploration,
} from "./expansion/EarthExplorations";
import {
  CellExploration,
  ShapeExploration,
  AdaptationExploration,
} from "./expansion/LifeGeometryExplorations";
import { useState, type ComponentType } from "react";
import { Text, View } from "react-native";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { physicalScene } from "./physicalScene";
import { worldScene } from "./worldScene";
import { SoundExploration } from "./SoundExploration";
import { BridgeExploration } from "./BridgeExploration";
import { RiverExploration } from "./RiverExploration";
import { CircuitExploration } from "./CircuitExploration";
import { FoodWebExploration } from "./FoodWebExploration";
import { FractionExploration } from "./FractionExploration";
import { PatternExploration } from "./PatternExploration";
import { CaravanExploration } from "./CaravanExploration";
import { PollinatorExploration } from "./PollinatorExploration";
import { ChanceExploration } from "./ChanceExploration";
import { NativeMoonScene } from "./NativeMoonScene";
import { NativeSceneSurface } from "./NativeSceneSurface";
import { nativeSceneState } from "../rendering/nativeSceneState";
/** Deliberately manual time controls: no automatic motion, timers, or reduced-motion exceptions. */
const supportedIds = new Set([
  "orbital-mechanics",
  "reflection-refraction",
  "gravity",
  "solar-system",
  "moon-phases",
  "photosynthesis",
  "castle-defenses",
]);
const extendedExplorations: Record<string, ComponentType> = {
  "machine-workshop": MachineExploration,
  "heat-house": HeatExploration,
  "pressure-tank": PressureExploration,
  "moving-plates": PlatesExploration,
  "cloud-rain-lab": CloudExploration,
  "magnetic-fields": MagnetExploration,
  "cell-explorer": CellExploration,
  "shape-slicer": ShapeExploration,
  "adaptation-island": AdaptationExploration,
  "sound-playground": SoundExploration,
  "bridge-builder": BridgeExploration,
  "river-sculptor": RiverExploration,
  "circuit-city": CircuitExploration,
  "food-web-rescue": FoodWebExploration,
  "fraction-feast": FractionExploration,
  "pattern-palace": PatternExploration,
  "caravan-crossroads": CaravanExploration,
  "pollinator-express": PollinatorExploration,
  "chance-carnival": ChanceExploration,
};
export function NativeExploration({ id }: { id: string }) {
  const Extended = Object.prototype.hasOwnProperty.call(
    extendedExplorations,
    id,
  )
    ? extendedExplorations[id]
    : undefined;
  if (Extended) return <Extended key={id} />;
  if (!supportedIds.has(id)) {
    return (
      <Text accessibilityRole="alert" style={{ color: colors.text }}>
        This Exploration's interactive model is not available in this app yet.
      </Text>
    );
  }
  return <SupportedNativeExploration key={id} id={id} />;
}
function SupportedNativeExploration({ id }: { id: string }) {
  const [value, setValue] = useState(
    id === "orbital-mechanics"
      ? 1
      : id === "reflection-refraction"
        ? 40
        : id === "gravity"
          ? 9.81
          : id === "solar-system"
            ? 2
            : id === "moon-phases"
              ? 90
              : id === "photosynthesis"
                ? 50
                : 3,
  );
  const [second, setSecond] = useState(id === "photosynthesis" ? 75 : 0);
  const [third, setThird] = useState(1),
    [fourth, setFourth] = useState(id === "castle-defenses" ? 0 : 3);
  const [width, setWidth] = useState(280);
  const cx = width / 2,
    cy = 115;
  const renderScene = [
    "orbital-mechanics",
    "reflection-refraction",
    "gravity",
  ].includes(id)
    ? physicalScene
    : worldScene;
  const { scene, result, control } = renderScene({
    id,
    value,
    second,
    third,
    fourth,
    setValue,
    setSecond,
    setThird,
    setFourth,
    width,
    cx,
    cy,
  });
  const visualState = nativeSceneState(id, value, second, third, fourth);
  return (
    <View style={{ gap: 14 }}>
      {id === "moon-phases" && (
        <NativeMoonScene angle={value} onChange={setValue} label={result} />
      )}
      {visualState && visualState.kind !== "moon" ? (
        <NativeSceneSurface
          state={visualState}
          label={result}
          fallback={scene}
          onWidthChange={setWidth}
        />
      ) : (
        <View
          accessible
          accessibilityLabel={result}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={{
            height: 240,
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: "#13203b",
            borderWidth: 1,
            borderColor: "#67749a",
          }}
        >
          {scene}
        </View>
      )}
      <Text
        accessibilityLiveRegion="polite"
        style={{ color: colors.text, lineHeight: 22 }}
      >
        {result}
      </Text>
      {control}
      <ActionButton
        label="Reset experiment"
        variant="secondary"
        onPress={() => {
          setValue(
            id === "orbital-mechanics"
              ? 1
              : id === "reflection-refraction"
                ? 40
                : id === "gravity"
                  ? 9.81
                  : id === "solar-system"
                    ? 2
                    : id === "moon-phases"
                      ? 90
                      : id === "photosynthesis"
                        ? 50
                        : 3,
          );
          setSecond(id === "photosynthesis" ? 75 : 0);
          setThird(1);
          setFourth(id === "castle-defenses" ? 0 : 3);
        }}
      />
    </View>
  );
}
