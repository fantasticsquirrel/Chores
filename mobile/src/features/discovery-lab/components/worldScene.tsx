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
import { MoonDisk, PlanetDiameterComparison } from "./NativeAstronomyDiagrams";
import { DiagramLabel } from "./LearningPrimitives";
export function worldScene({
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
  if (id === "solar-system") {
    const p = planets[value];
    scene = (
      <>
        <Dot x={cx} y={cy} size={30} color="#ffd387" />
        {planets.map((planet, i) => {
          const radius = 24 + i * 10,
            angle = (second / 12 / planet.years) * Math.PI * 2;
          return (
            <View key={planet.name}>
              <View
                style={{
                  position: "absolute",
                  left: cx - radius,
                  top: cy - radius,
                  width: radius * 2,
                  height: radius * 2,
                  borderRadius: radius,
                  borderWidth: 1,
                  borderColor: i === value ? "#b9b6ff" : "#344565",
                }}
              />
              <Dot
                x={cx + radius * Math.cos(angle)}
                y={cy + radius * Math.sin(angle)}
                size={i === value ? 12 : 6}
                color={planet.color}
              />
            </View>
          );
        })}
      </>
    );
    if (third === 2)
      scene = <PlanetDiameterComparison index={value} width={width} />;
    result = `${p.name}: ${p.au} AU from the Sun (mean distance); one orbit takes ${p.years} Earth years. Time: ${second} months. ${third === 2 ? `Equatorial diameter ${p.diameterKm.toLocaleString()} km; ${(p.diameterKm / planets[2].diameterKm).toFixed(2)} Earth diameters. The two disks use the same diameter scale.` : "Distances and planet sizes in the orbit map are schematic, not to scale."}`;
    control = (
      <>
        <Control
          label="Planet index (Mercury 0 to Neptune 7)"
          value={value}
          min={0}
          max={7}
          onChange={setValue}
        />
        <ActionButton
          label={third === 2 ? "Show orbit map" : "Compare planet diameters"}
          onPress={() => setThird(third === 2 ? 1 : 2)}
        />
        <Control
          label="Time in months"
          value={second}
          min={0}
          max={120}
          step={3}
          onChange={setSecond}
        />
      </>
    );
  } else if (id === "moon-phases") {
    const angle = (value * Math.PI) / 180,
      lit = illumination(value);
    scene = (
      <>
        <Dot x={30} y={cy} size={30} color="#f9d681" />
        <Dot x={cx} y={cy} size={38} color="#62c2e1" />
        <Dot
          x={cx - 65 * Math.cos(angle)}
          y={cy - 65 * Math.sin(angle)}
          size={18}
          color="#c8cddd"
        />
        <MoonDisk angle={value} x={width - 38} y={35} radius={22} />
        <DiagramLabel x={width - 88} y={62}>
          Earth-view disk
        </DiagramLabel>
        <View
          style={{
            position: "absolute",
            bottom: 12,
            left: 15,
            right: 15,
            height: 12,
            borderRadius: 8,
            backgroundColor: "#303f60",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 12,
              width: `${lit * 100}%`,
              backgroundColor: "#e8edf8",
            }}
          />
        </View>
      </>
    );
    result = `${value}° orbital angle; ${(lit * 100).toFixed(0)}% of the Moon's visible disk is illuminated. ${value % 360 === 0 ? "New Moon." : value === 180 ? "Full Moon." : value < 180 ? "Waxing." : "Waning."} Half the Moon is always sunlit; phases are not Earth's shadow. Bar shows visible illuminated fraction.`;
    control = (
      <Control
        label="Moon angle"
        value={value}
        min={0}
        max={360}
        step={15}
        onChange={setValue}
      />
    );
  } else if (id === "photosynthesis") {
    const rate = productionRate(value, second);
    scene = (
      <>
        <Dot x={width - 45} y={40} size={20 + value * 0.25} color="#f8cf73" />
        <Line x={cx} y={210} x2={cx} y2={125 - rate * 0.5} color="#73d99d" />
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: cx + (i % 2 ? 0 : -38),
              top: 145 - i * 16,
              width: 38,
              height: 18,
              borderRadius: 20,
              backgroundColor: "#67cda0",
              opacity: 0.3 + rate / 140,
              transform: [{ rotate: i % 2 ? "30deg" : "-30deg" }],
            }}
          />
        ))}
      </>
    );
    result = `Relative production index ${rate.toFixed(0)}/100; ${value < second ? "light" : value > second ? "water" : "light and water"} limits this simplified model. Both resources saturate; CO₂ and temperature are held suitable. CO₂ enters through stomata; veins supply water and carry sugar away. The index compares resource limits, not measured growth.`;
    control = (
      <>
        <Control
          label="Light"
          value={value}
          min={0}
          max={100}
          step={10}
          onChange={setValue}
        />
        <Control
          label="Water availability"
          value={second}
          min={0}
          max={100}
          step={10}
          onChange={setSecond}
        />
      </>
    );
  } else {
    scene = (
      <>
        <View
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 18,
            height: second ? 28 : 10,
            backgroundColor: "#427aab",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: cx - 70,
            bottom: 45,
            width: 140,
            height: value * 18 + 30,
            backgroundColor: "#9588b0",
            borderTopWidth: 9,
            borderColor: "#c2b4db",
          }}
        />
        {fourth ? (
          <>
            {Array.from({ length: 7 }, (_, i) => {
              const t = i / 7,
                end = (i + 0.5) / 7;
              return (
                <Line
                  key={i}
                  x={cx - 60 + (20 - cx + 60) * t}
                  y={100 + 110 * t}
                  x2={cx - 60 + (20 - cx + 60) * end}
                  y2={100 + 110 * end}
                  color="#87e8f4"
                />
              );
            })}
          </>
        ) : null}
        {[-70, 45].map((x) => (
          <View
            key={x}
            style={{
              position: "absolute",
              left: cx + x,
              bottom: 45,
              width: 25,
              height: value * 18 + 50,
              backgroundColor: "#b3a5ca",
              borderTopWidth: 10,
              borderColor: "#e1d4ef",
            }}
          />
        ))}
        <View
          style={{
            position: "absolute",
            left: cx - 12,
            bottom: 45,
            width: 24,
            height: 28,
            backgroundColor: third ? "#cbaa7c" : "#342a47",
          }}
        />
      </>
    );
    result = `Wall height ${value * 3} m; ${second ? "wet moat added: attackers face an additional approach obstacle" : "dry approach: attackers can reach the wall directly"}. Higher walls complicate ladder access but require more material. ${third ? "Gate closed: the direct entrance is blocked." : "Gate open: the direct entrance route remains."} ${fourth ? "Sight-line overlay shown: dashed rays show possible views, not physical beams or cables. Blind spots remain." : "Sight-line overlay hidden."} Simplified 13th-century English-inspired model, not a siege prediction or a universal castle.`;
    control = (
      <>
        <Control
          label="Wall height level"
          value={value}
          min={1}
          max={6}
          onChange={setValue}
        />
        <ActionButton
          label={second ? "Remove moat" : "Add moat"}
          onPress={() => setSecond(second ? 0 : 1)}
          variant="secondary"
        />
        <ActionButton
          label={third ? "Open gate" : "Close gate"}
          onPress={() => setThird(third ? 0 : 1)}
        />
        <ActionButton
          label={
            fourth
              ? "Hide sight-line overlay"
              : "Show sight-line overlay (not structures)"
          }
          onPress={() => setFourth(fourth ? 0 : 1)}
        />
      </>
    );
  }

  return { scene, result, control };
}
