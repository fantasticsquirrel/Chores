import {
  PlatesComparisons,
  CloudComparisons,
  MagnetComparisons,
} from "./earthComparisons";
import { useState } from "react";
import {
  initialPlate,
  advancePlate,
  plateResult,
  initialCloud,
  cloudResult,
  initialMagnetic,
  magneticResult,
} from "@family-manager/family-api/discovery-models/expansion-earth";
import { ActionButton } from "../../../../components/ActionButton";
import { Control, Dot, Line } from "../Primitives";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "../LearningPrimitives";

export function PlatesExploration() {
  const [state, setState] = useState(initialPlate);
  const result = plateResult(state);
  const label = `${result.terrain}. Movement ${state.movement} diagram units; stress index ${state.stress}; ${state.slips} modeled slips.`;
  return (
    <LearningFrame onReset={() => setState(initialPlate)}>
      <Diagram visualState={{ kind: "moving-plates", ...state }} label={label}>
        {(width) => (
          <>
            <Line
              x={20}
              y={120}
              x2={width / 2 - state.movement / 3}
              y2={120}
              color="#a2d5eb"
            />
            <Line
              x={width / 2 + state.movement / 3}
              y={state.boundary === "convergent" ? 145 : 120}
              x2={width - 20}
              y2={120}
              color="#e9bd7a"
            />
            <Line
              x={width / 2 - 20}
              y={155}
              x2={width / 2 + 20}
              y2={state.boundary === "convergent" ? 200 : 155}
              color="#ec8a66"
            />
            <DiagramLabel x={18} y={220}>
              Plates move {result.motion}
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label}{" "}
        {state.boundary === "transform"
          ? "Locked segments build stress; a slip releases some of the stored strain. This repeating threshold is invented, not an earthquake clock."
          : state.boundary === "convergent"
            ? "This example shows denser oceanic crust subducting beneath a continent. Continental collisions behave differently."
            : "At this divergent boundary, plates separate and rising magma can form new oceanic crust."}
      </Explanation>
      <Choice
        label="Boundary motion"
        value={state.boundary}
        onChange={(boundary) => setState({ ...initialPlate, boundary })}
        options={[
          { value: "divergent", label: "Move apart" },
          { value: "convergent", label: "Move together" },
          { value: "transform", label: "Slide past" },
        ]}
      />
      <ActionButton
        label="Advance one step"
        onPress={() => setState(advancePlate(state))}
      />
      <ActionButton
        label="Advance five steps"
        onPress={() => setState(advancePlate(state, 5))}
      />
      <Meter label="Stored stress index" value={state.stress} />
      <PlatesComparisons setState={setState} />
      <ModelNote>
        A step is a diagram increment, not years. Crust thickness, movement, and
        fault threshold are schematic; these controls cannot predict
        earthquakes. Changing boundary resets movement and stress for a fair
        comparison.
      </ModelNote>
    </LearningFrame>
  );
}

export function CloudExploration() {
  const [state, setState] = useState(initialCloud);
  const result = cloudResult(state);
  const label = `Parcel temperature ${result.parcelTemperatureC.toFixed(1)}°C; condensation level about ${result.condensationHeightM.toFixed(0)} m. ${result.cloud ? "Cloud droplets are present" : "No cloud droplets yet"}; ${result.rain ? "rain is represented" : "no rain is represented"}.`;
  return (
    <LearningFrame onReset={() => setState(initialCloud)}>
      <Diagram visualState={{ kind: "cloud-rain-lab", ...state }} label={label}>
        {(width) => (
          <>
            <Line x={35} y={260} x2={35} y2={40} />
            <Dot
              x={width / 2}
              y={245 - state.upliftM / 15}
              size={result.cloud ? 70 : 35}
              color={result.cloud ? "#dbe7ee" : "#ebba67"}
            />
            {result.rain &&
              [0, 1, 2, 3].map((i) => (
                <Line
                  key={i}
                  x={width / 2 - 25 + i * 16}
                  y={145}
                  x2={width / 2 - 30 + i * 16}
                  y2={215}
                  color="#77d0f4"
                />
              ))}
            <DiagramLabel x={18} y={280}>
              Lift {state.upliftM} m · droplet growth {state.dropletGrowth}
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label} Rising air expands and cools. Condensation forms tiny liquid
        droplets, while rain requires droplets to grow enough to fall. A visible
        cloud is not invisible water vapor.
      </Explanation>
      <Control
        label="Starting temperature (°C)"
        value={state.temperatureC}
        min={20}
        max={35}
        onChange={(temperatureC) => setState({ ...state, temperatureC })}
      />
      <Control
        label="Water vapor (g/kg)"
        value={state.vaporGPerKg}
        min={2}
        max={14}
        onChange={(vaporGPerKg) => setState({ ...state, vaporGPerKg })}
      />
      <Control
        label="Uplift (m)"
        value={state.upliftM}
        min={0}
        max={2000}
        step={100}
        onChange={(upliftM) => setState({ ...state, upliftM })}
      />
      <Control
        label="Droplet growth index"
        value={state.dropletGrowth}
        min={0}
        max={100}
        step={5}
        onChange={(dropletGrowth) => setState({ ...state, dropletGrowth })}
      />
      <CloudComparisons setState={setState} />
      <ModelNote>
        Approximate condensation height and fixed cooling rates at a starting
        pressure of 1000 hPa. Mixing, ice, changing weather, and droplet-size
        distributions are omitted. The rain threshold and growth index are
        invented teaching values, not a forecast.
      </ModelNote>
    </LearningFrame>
  );
}

export function MagnetExploration() {
  const [state, setState] = useState(initialMagnetic);
  const result = magneticResult(state);
  const label = `Facing poles ${result.interaction}. ${result.insideMagnet ? "Probe is inside a magnet; exterior-field direction is not reported." : result.direction === null ? "Fields cancel at the probe; no unique compass direction." : `Compass north end points ${result.direction.toFixed(0)}° from +x toward +z in the diagram.`} Relative field strength ${result.strength.toFixed(3)}.`;
  return (
    <LearningFrame onReset={() => setState(initialMagnetic)}>
      <Diagram
        visualState={{ kind: "magnetic-fields", ...state }}
        label={label}
      >
        {(width) => (
          <>
            <Line
              x={30}
              y={140}
              x2={width / 2 - state.gap * 8}
              y2={140}
              color="#ee8c82"
            />
            <Line
              x={width / 2 + state.gap * 8}
              y={140}
              x2={width - 30}
              y2={140}
              color="#83bbeb"
            />
            <Dot
              x={width / 2 + state.probeX * 16}
              y={140 - state.probeZ * 20}
              size={20}
              color="#f4d578"
            />
            <DiagramLabel x={18} y={230}>
              Probe ({state.probeX}, {state.probeZ}) · {result.interaction}
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label} Outside a magnet, the compass north-seeking end follows the
        combined field direction. Field lines show directions, not physical
        strings.
      </Explanation>
      <Control
        label="Magnet gap (diagram units)"
        value={state.gap}
        min={0.5}
        max={4.5}
        step={0.5}
        onChange={(gap) => setState({ ...state, gap })}
      />
      <ActionButton
        label="Flip right magnet"
        onPress={() => setState({ ...state, flipped: !state.flipped })}
      />
      <Control
        label="Probe horizontal position (x)"
        value={state.probeX}
        min={-6}
        max={6}
        step={0.5}
        onChange={(probeX) => setState({ ...state, probeX })}
      />
      <Control
        label="Probe depth position (z)"
        value={state.probeZ}
        min={-4}
        max={4}
        step={0.5}
        onChange={(probeZ) => setState({ ...state, probeZ })}
      />
      <MagnetComparisons setState={setState} />
      <ModelNote>
        Paired softened-pole approximation for exterior directions. Real magnets
        do not contain isolated magnetic monopoles; fields continue through
        magnets in loops. Strength and spacing are relative diagram values, not
        tesla or measured force.
      </ModelNote>
    </LearningFrame>
  );
}
