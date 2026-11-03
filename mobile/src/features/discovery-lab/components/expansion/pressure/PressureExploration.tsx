import { useState } from "react";
import {
  defaultPressureState,
  normalizePressure,
  pressureResult,
  pressureTankBoundary,
  type PressureState,
} from "@family-manager/family-api/discovery-models/pressure-tank";
import { Control, Dot, Line } from "../../Primitives";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  ModelNote,
} from "../../LearningPrimitives";
import { PressureComparison } from "./PressureComparison";

export function PressureExploration() {
  const [state, setState] = useState<PressureState>({
    ...defaultPressureState,
  });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const update = (next: PressureState) => {
    setState(normalizePressure(next));
    setComparisonVersion((value) => value + 1);
  };
  const reset = () => {
    setState({ ...defaultPressureState });
    setComparisonVersion((value) => value + 1);
  };
  const result = pressureResult(state);
  const label =
    `Surface ${state.depthM.toFixed(1)} m and outlet ${state.outletM.toFixed(1)} m above the floor; head ${result.headM.toFixed(1)} m. ` +
    `The separate closed wall sensor at outlet height has calculated gauge pressure ${(result.gaugePressurePa / 1_000).toFixed(3)} kPa; absolute pressure ${(result.absolutePressurePa / 1_000).toFixed(3)} kPa. ` +
    `Its net force is ${result.sensorNetForceN.toFixed(2)} N on 100 cm² because its back face is exposed to atmosphere. ` +
    `A dark insulated electrical cable carries its signal to the remote gauge display; it is not a liquid pressure line. ` +
    `Ideal jet speed ${result.jetSpeedMps.toFixed(2)} m/s; floor-level range ${result.rangeM.toFixed(2)} m. ` +
    `${state.shape} tank volume ${result.volumeLiters.toFixed(0)} L.`;
  const widthAt = (heightM: number) =>
    state.shape === "wide"
      ? 0.72
      : state.shape === "tapered"
        ? 0.32 + 0.4 * (heightM / 3)
        : 0.48;
  const left = (width: number, heightM: number) =>
    width * (0.5 - widthAt(heightM) / 2);
  const right = (width: number, heightM: number) =>
    width * (0.5 + widthAt(heightM) / 2);
  const yAt = (heightM: number) => 245 - heightM * 60;
  return (
    <LearningFrame onReset={reset} resetLabel="Reset lesson">
      <Diagram visualState={{ kind: "pressure-tank", ...state }} label={label}>
        {(width) => (
          <>
            <Line
              x={left(width, 3)}
              y={yAt(3)}
              x2={left(width, 0)}
              y2={yAt(0)}
            />
            <Line
              x={left(width, 0)}
              y={yAt(0)}
              x2={right(width, 0)}
              y2={yAt(0)}
            />
            <Line
              x={right(width, 0)}
              y={yAt(0)}
              x2={right(width, 3)}
              y2={yAt(3)}
            />
            <Line
              x={left(width, state.depthM)}
              y={yAt(state.depthM)}
              x2={right(width, state.depthM)}
              y2={yAt(state.depthM)}
              color="#87dbf5"
            />
            {result.outletSubmerged && (
              <Line
                x={left(width, state.outletM) - 8}
                y={yAt(state.depthM)}
                x2={left(width, state.outletM) - 8}
                y2={yAt(state.outletM)}
                color="#e3ac5c"
              />
            )}
            <Dot
              x={right(width, state.outletM)}
              y={yAt(state.outletM)}
              size={12}
              color="#e3ac5c"
            />
            {result.outletSubmerged && (
              <>
                {Array.from({ length: 8 }, (_, index) => {
                  const start = index / 8;
                  const end = (index + 1) / 8;
                  const nozzleX = right(width, state.outletM);
                  const rangePx = Math.min(
                    width - nozzleX - 10,
                    result.rangeM * 22,
                  );
                  return (
                    <Line
                      key={index}
                      x={nozzleX + rangePx * start}
                      y={yAt(state.outletM) + state.outletM * 60 * start ** 2}
                      x2={nozzleX + rangePx * end}
                      y2={yAt(state.outletM) + state.outletM * 60 * end ** 2}
                      color="#87dbf5"
                    />
                  );
                })}
              </>
            )}
            <DiagramLabel x={18} y={270}>
              {result.headM.toFixed(1)} m head ·{" "}
              {(result.gaugePressurePa / 1_000).toFixed(3)} kPa gauge ·{" "}
              {result.volumeLiters.toFixed(0)} L
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label} Gauge pressure is pressure above the surrounding air; absolute
        pressure adds the fixed 101.325 kPa atmosphere. The model multiplies
        gauge pressure by 0.0100 m² to get sensor net force because its back
        face is exposed to atmosphere. A dark insulated electrical cable carries
        the sensor signal to the remote display; it is not a liquid pressure
        line. The nozzle is separate from this closed sensor; its emerging free
        jet is approximately atmospheric.
      </Explanation>
      <Control
        label="Water surface height (m)"
        value={state.depthM}
        min={0.2}
        max={3}
        step={0.1}
        onChange={(depthM) => update({ ...state, depthM })}
      />
      <Control
        label="Outlet height above floor (m)"
        value={state.outletM}
        min={0.1}
        max={2.5}
        step={0.1}
        onChange={(outletM) => update({ ...state, outletM })}
      />
      <Choice
        label="Tank shape"
        value={state.shape}
        onChange={(shape) => update({ ...state, shape })}
        options={[
          { value: "narrow", label: "Narrow" },
          { value: "wide", label: "Wide" },
          { value: "tapered", label: "Tapered" },
        ]}
      />
      <PressureComparison key={comparisonVersion} onApply={setState} />
      <ModelNote>{pressureTankBoundary}</ModelNote>
    </LearningFrame>
  );
}
