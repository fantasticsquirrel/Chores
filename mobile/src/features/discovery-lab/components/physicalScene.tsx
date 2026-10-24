import { View } from "react-native";
import { ActionButton } from "../../../components/ActionButton";
import { Dot, Line, Control } from "./Primitives";
import {
  dropTime,
  illumination,
  orbitModel,
  planets,
  productionRate,
  refractedAngle,
} from "../lib/models";
import type { SceneProps } from "./scene-types";
export function physicalScene({
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
}: SceneProps) {
  let scene: React.ReactNode;
  let result = "";
  let control: React.ReactNode;
  if (id === "orbital-mechanics") {
    const { points, outcome } = orbitModel(value, third);
    scene = (
      <>
        <Dot x={cx} y={cy} size={17.28} color="#f9cc7e" />
        {points.map((p, i) => (
          <Dot
            key={i}
            x={cx + p.x * 48}
            y={cy + p.y * 48}
            size={3}
            color="#79dce9"
          />
        ))}
        <Dot x={cx + 48} y={cy} size={9} />
      </>
    );
    result = `Launch speed ${value.toFixed(2)} relative to the reference circular speed; central mass ${third.toFixed(1)}. ${outcome}. Gravity acts throughout the orbit.`;
    control = (
      <>
        <Control
          label="Launch speed"
          value={value}
          min={0.2}
          max={1.6}
          step={0.1}
          onChange={setValue}
        />
        <Control
          label="Central mass"
          value={third}
          min={0.5}
          max={3}
          step={0.25}
          onChange={setThird}
        />
      </>
    );
  } else if (id === "reflection-refraction") {
    const angle = (value * Math.PI) / 180;
    const refracted = refractedAngle(
      value,
      second ? 1.333 : 1,
      second ? 1 : 1.333,
    );
    scene = (
      <>
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: cy,
            bottom: 0,
            backgroundColor: "#163f62",
          }}
        />
        <Line x={cx} y={15} x2={cx} y2={220} color="#788bad" />
        <Line
          x={cx - Math.sin(angle) * 95}
          y={cy - Math.cos(angle) * 95}
          x2={cx}
          y2={cy}
          color="#ffce79"
        />
        <Line
          x={cx}
          y={cy}
          x2={cx + Math.sin(angle) * 95}
          y2={cy - Math.cos(angle) * 95}
          color="#c995ff"
        />
        {refracted !== null ? (
          <Line
            x={cx}
            y={cy}
            x2={cx + Math.sin((refracted * Math.PI) / 180) * 95}
            y2={cy + Math.cos((refracted * Math.PI) / 180) * 95}
          />
        ) : null}
      </>
    );
    result = `${second ? "Water → air" : "Air → water"}. Reflection angle ${value}°. ${refracted === null ? "Total internal reflection; no transmitted ray." : `Refraction angle ${refracted.toFixed(1)}°.`} Angles are measured from the vertical normal. Ray brightness is illustrative.`;
    control = (
      <>
        <Control
          label="Incident angle"
          value={value}
          min={0}
          max={80}
          step={5}
          onChange={setValue}
        />
        <ActionButton
          label="Swap materials"
          onPress={() => setSecond(second ? 0 : 1)}
          variant="secondary"
        />
      </>
    );
  } else if (id === "gravity") {
    const time = second / 10,
      fallen = Math.min(20, 0.5 * value * time * time);
    scene = (
      <>
        <Line x={20} y={210} x2={width - 20} y2={210} />
        <Dot
          x={cx - 45}
          y={25 + fallen * 8.5}
          size={8 + third * 2}
          color="#f5ce82"
        />
        <Dot
          x={cx + 45}
          y={25 + fallen * 8.5}
          size={8 + fourth * 2}
          color="#9eb5ff"
        />
      </>
    );
    result = `Masses ${third} kg and ${fourth} kg fall ${fallen.toFixed(1)} m in ${time.toFixed(1)} s in a vacuum. Both land after ${dropTime(20, value).toFixed(2)} s. Air resistance is excluded.`;
    control = (
      <>
        <Control
          label="Gravity (m/s²)"
          value={value}
          min={1.62}
          max={24.81}
          step={1}
          onChange={setValue}
        />
        <Control
          label="First mass (kg)"
          value={third}
          min={1}
          max={8}
          onChange={setThird}
        />
        <Control
          label="Second mass (kg)"
          value={fourth}
          min={1}
          max={8}
          onChange={setFourth}
        />
        <ActionButton label="Earth gravity" onPress={() => setValue(9.81)} />
        <ActionButton label="Moon gravity" onPress={() => setValue(1.62)} />
        <Control
          label="Time (tenths of seconds)"
          value={second}
          min={0}
          max={50}
          step={2}
          onChange={setSecond}
        />
      </>
    );
  }

  return { scene, result, control };
}
