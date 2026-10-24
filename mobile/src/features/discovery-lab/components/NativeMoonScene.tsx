import { useState } from "react";
import { MoonDisk } from "./NativeAstronomyDiagrams";
import { NativeSceneSurface } from "./NativeSceneSurface";

export function NativeMoonScene({
  angle,
  onChange,
  label,
}: {
  angle: number;
  onChange: (angle: number) => void;
  label: string;
}) {
  const [width, setWidth] = useState(280);
  return (
    <NativeSceneSurface
      state={{ kind: "moon", angle }}
      label={label}
      onAngle={onChange}
      onWidthChange={setWidth}
      height={300}
      fallback={
        <MoonDisk
          angle={angle}
          x={width / 2}
          y={150}
          radius={Math.min(105, width * 0.38)}
        />
      }
    />
  );
}
