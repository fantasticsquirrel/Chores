import { useState } from "react";
import { Text, View } from "react-native";
import {
  SOLAR_PLANETS,
  planetAngle,
  solarSystemActivity,
} from "@family-manager/family-api/discovery-models/solar";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { Control, Dot } from "./Primitives";
import {
  Choice,
  Diagram,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";
import { PlanetDiameterComparison } from "./NativeAstronomyDiagrams";

type OrbitPrediction = "" | "earth" | "neptune" | "same";
type DiameterPrediction = "" | "five" | "eleven" | "fifty";
type ViewMode = "orbits" | "sizes";

export function SolarSystemExploration() {
  const [selected, setSelected] = useState(2);
  const [earthYears, setEarthYears] = useState(0);
  const [mode, setMode] = useState<ViewMode>("orbits");
  const [orbitPrediction, setOrbitPrediction] = useState<OrbitPrediction>("");
  const [orbitComplete, setOrbitComplete] = useState(false);
  const [diameterPrediction, setDiameterPrediction] =
    useState<DiameterPrediction>("");
  const [diameterComplete, setDiameterComplete] = useState(false);
  const activity = solarSystemActivity({ selected, earthYears });
  const planet = activity.planet;

  const reset = () => {
    setSelected(2);
    setEarthYears(0);
    setMode("orbits");
    setOrbitPrediction("");
    setOrbitComplete(false);
    setDiameterPrediction("");
    setDiameterComplete(false);
  };

  const label = `${planet.name}, planet ${selected + 1} of eight. Mean distance ${planet.meanDistanceAu} astronomical units, orbital period ${planet.orbitalPeriodYears} Earth years, equatorial diameter ${planet.diameterKm.toLocaleString()} kilometres. ${earthYears.toFixed(2)} Earth years elapsed, equal to ${activity.orbitFraction.toFixed(3)} ${planet.name} orbits. ${mode === "sizes" ? `Earth and ${planet.name} use one linear diameter scale.` : "Orbit paths compress unequal mean distances; globes are enlarged and positions are illustrative."}`;

  return (
    <LearningFrame onReset={reset}>
      <Diagram
        label={label}
        height={350}
        visualState={{
          kind: "solar",
          selected,
          earthYears,
          mode,
          angles: SOLAR_PLANETS.map((_, index) =>
            planetAngle(index, earthYears),
          ),
        }}
      >
        {(width) =>
          mode === "sizes" ? (
            <PlanetDiameterComparison index={selected} width={width} />
          ) : (
            <View style={{ flex: 1, backgroundColor: "#071724" }}>
              <Dot x={width / 2} y={170} size={34} color="#ffd47d" />
              {SOLAR_PLANETS.map((option, index) => {
                const radius = 35 + index * 14;
                const angle = planetAngle(index, earthYears);
                return (
                  <Dot
                    key={option.name}
                    x={width / 2 + Math.cos(angle) * radius}
                    y={170 + Math.sin(angle) * radius * 0.48}
                    size={index === selected ? 14 : 7}
                    color={option.color}
                  />
                );
              })}
            </View>
          )
        }
      </Diagram>
      <Explanation>
        {planet.name}: {planet.meanDistanceAu} AU mean distance ·{" "}
        {planet.orbitalPeriodYears} Earth-year orbit ·{" "}
        {planet.diameterKm.toLocaleString()} km equatorial diameter ·{" "}
        {activity.orbitFraction.toFixed(3)} orbit elapsed.
      </Explanation>

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        1. Hold elapsed time fixed
      </Text>
      <Explanation>
        Predict which planet completes more of its orbit in one Earth year.
      </Explanation>
      <Choice
        label="Your orbit prediction"
        value={orbitPrediction}
        onChange={(prediction) => {
          setOrbitPrediction(prediction);
          setOrbitComplete(false);
          setDiameterPrediction("");
          setDiameterComplete(false);
          setMode("orbits");
          setEarthYears(0);
        }}
        options={[
          { value: "earth", label: "Earth" },
          { value: "neptune", label: "Neptune" },
          { value: "same", label: "Same fraction" },
        ]}
      />
      <ActionButton
        label="Compare one Earth year"
        disabled={!orbitPrediction}
        onPress={() => {
          setOrbitComplete(true);
          setSelected(7);
          setEarthYears(1);
          setMode("orbits");
        }}
      />
      {orbitComplete && (
        <Explanation>
          The result {orbitPrediction === "earth" ? "matches" : "differs from"}{" "}
          your prediction. Earth completes 1.000 orbit; Neptune completes 0.006
          orbit, about 1/165. Equal elapsed time is held fixed; the measured
          orbital period changes with planet. Farther planets have longer paths
          and lower average orbital speeds. Explain why the fractions differ.
        </Explanation>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        2. Hold diameter scale fixed
      </Text>
      <Explanation>
        Predict how many Earth diameters fit across Jupiter. Both values use
        equatorial diameter.
      </Explanation>
      {orbitComplete ? (
        <Choice
          label="Your diameter prediction"
          value={diameterPrediction}
          onChange={(prediction) => {
            setDiameterPrediction(prediction);
            setDiameterComplete(false);
          }}
          options={[
            { value: "five", label: "About 5×" },
            { value: "eleven", label: "About 11×" },
            { value: "fifty", label: "About 50×" },
          ]}
        />
      ) : (
        <Explanation>Complete the orbit comparison first.</Explanation>
      )}
      <ActionButton
        label="Compare Earth and Jupiter"
        disabled={!orbitComplete || !diameterPrediction}
        onPress={() => {
          setDiameterComplete(true);
          setSelected(4);
          setMode("sizes");
        }}
      />
      {diameterComplete && (
        <Explanation>
          The result{" "}
          {diameterPrediction === "eleven" ? "matches" : "differs from"} your
          prediction. Earth is 12,756 km across; Jupiter is 142,984 km, or 11.21
          Earth diameters. The two globes now use one linear diameter scale.
          Explain why the true Sun–planet gaps cannot also fit here at that
          scale.
        </Explanation>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}
      >
        Open controls
      </Text>
      <Control
        label="Planet index (Mercury 0 to Neptune 7)"
        value={selected}
        min={0}
        max={7}
        onChange={setSelected}
      />
      <Control
        label="Elapsed Earth years"
        value={earthYears}
        min={0}
        max={10}
        step={0.25}
        onChange={setEarthYears}
      />
      <ActionButton
        label={
          mode === "sizes"
            ? "Show Sun-centered orbits"
            : "Show same-scale diameters"
        }
        variant="secondary"
        onPress={() => setMode(mode === "sizes" ? "orbits" : "sizes")}
      />

      <ModelNote>
        One AU is about Earth’s mean Sun distance, roughly 150 million km. The
        readouts use rounded mean distance, equatorial diameter and orbital
        period data. Orbit paths are circular, coplanar and distance-compressed;
        globes are enlarged and positions are not today’s sky. Diameter mode
        uses one linear scale and baseline for the two globes, excludes Saturn’s
        rings, and omits the Sun and true gaps. Non-Earth globe textures are
        illustrations, including the atmospheric banding shown for the gas and
        ice giants. The native scene and web composition differ graphically
        while using the same measurements and comparisons.
      </ModelNote>
    </LearningFrame>
  );
}
