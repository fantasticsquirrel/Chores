import { useState } from "react";
import { MoonDisk, MoonOrbitGeometry } from "./NativeAstronomyDiagrams";
import { NativeSceneSurface } from "./NativeSceneSurface";

export function NativeMoonScene({
  angle,
  view = "earth",
  onChange,
  label,
}: {
  angle: number;
  view?: "earth" | "orbit";
  onChange: (angle: number) => void;
  label: string;
}) {
  const [width, setWidth] = useState(280);
  return (
    <NativeSceneSurface
      state={{ kind: "moon", angle, view }}
      label={label}
      onAngle={onChange}
      onWidthChange={setWidth}
      height={340}
      fallback={
        view === "earth" ? (
          <MoonDisk
            angle={angle}
            x={width / 2}
            y={170}
            radius={Math.min(115, width * 0.38)}
          />
        ) : (
          <MoonOrbitGeometry angle={angle} width={width} />
        )
      }
    />
  );
}
