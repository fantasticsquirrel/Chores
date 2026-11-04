import { AdaptationComparisons } from "./lifeGeometryComparisons";
import { useState, type SetStateAction } from "react";
import {
  cellExplorerBoundary,
  cellExplorerCoreBoundary,
  defaultCellExplorerState,
  defaultShapeSlicerState,
  defaultAdaptationIslandState,
  stepCellTransport,
  cellObservation,
  cellParts,
  crossSection,
  shapeObservation,
  nextIslandGeneration,
  resetIsland,
  islandObservation,
  type CellExplorerState,
  type CellPart,
  type ShapeSlicerState,
} from "@family-manager/family-api/discovery-models/expansion-life-geometry";
import {
  diagonalCubeState,
  shapeSlicerBoundary,
  shapeSlicerCoreBoundary,
} from "@family-manager/family-api/discovery-models/shape-slicer";
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
import { CellComparison } from "./cells/CellComparison";
import { ShapeComparison } from "./shapes/ShapeComparison";

export function CellExploration() {
  const [state, setState] = useState(defaultCellExplorerState);
  const [comparisonReset, setComparisonReset] = useState(0);
  const setManualState = (next: SetStateAction<CellExplorerState>) => {
    setState(next);
    setComparisonReset((value) => value + 1);
  };
  const label = cellObservation(state);
  const parts = (Object.keys(cellParts) as CellPart[]).filter(
    (part) => state.cellType === "plant" || !cellParts[part].plantOnly,
  );
  return (
    <LearningFrame
      resetLabel="Reset cell explorer"
      onReset={() => setManualState(defaultCellExplorerState)}
    >
      <Diagram
        visualState={{ kind: "cell-explorer", ...state }}
        label={`${state.cellType} cell. ${cellParts[state.selected].name}. ${label}`}
      >
        {(width) => (
          <>
            <Dot x={width / 2} y={145} size={180} color="#345e75" />
            <Dot x={width / 2} y={145} size={165} color="#b8ddcd" />
            <Dot x={width / 2 - 20} y={130} size={50} color="#8d6fbb" />
            {[0, 1, 2].map((i) => (
              <Dot
                key={i}
                x={width / 2 - 50 + i * 45}
                y={180}
                size={15}
                color="#c9775c"
              />
            ))}
            <DiagramLabel x={18} y={260}>
              Outside {state.outside.toFixed(1)} · inside{" "}
              {state.inside.toFixed(1)}
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {cellParts[state.selected].name}: {cellParts[state.selected].function}
      </Explanation>
      <Explanation>{label}</Explanation>
      <Choice
        label="Cell type"
        value={state.cellType}
        onChange={(cellType) =>
          setManualState({
            ...state,
            cellType,
            selected:
              cellType === "animal" && cellParts[state.selected].plantOnly
                ? "membrane"
                : state.selected,
          })
        }
        options={[
          { value: "plant", label: "Plant cell" },
          { value: "animal", label: "Animal cell" },
        ]}
      />
      <Choice
        label="Cell part"
        value={state.selected}
        onChange={(selected) => setManualState({ ...state, selected })}
        options={parts.map((value) => ({
          value,
          label: cellParts[value].name,
        }))}
      />
      <Choice
        label="Molecule"
        value={state.molecule}
        onChange={(molecule) => setManualState({ ...state, molecule })}
        options={[
          { value: "oxygen", label: "Oxygen" },
          { value: "glucose", label: "Glucose" },
        ]}
      />
      <ActionButton
        label={state.carrier ? "Remove glucose carrier" : "Add glucose carrier"}
        onPress={() => setManualState({ ...state, carrier: !state.carrier })}
      />
      <Control
        label="Outside concentration"
        value={state.outside}
        min={0}
        max={20}
        onChange={(outside) => setManualState({ ...state, outside })}
      />
      <Control
        label="Inside concentration"
        value={state.inside}
        min={0}
        max={20}
        onChange={(inside) => setManualState({ ...state, inside })}
      />
      <ActionButton
        label="Transfer one step"
        onPress={() => setManualState(stepCellTransport(state))}
      />
      <CellComparison onApply={setState} resetKey={comparisonReset} />
      <ModelNote>
        {cellExplorerCoreBoundary} A cell wall does not replace a membrane.
        Molecule symbols are rounded; use the concentration readouts for exact
        comparisons. {cellExplorerBoundary}
      </ModelNote>
    </LearningFrame>
  );
}

export function ShapeExploration() {
  const [state, setState] = useState(defaultShapeSlicerState);
  const [comparisonReset, setComparisonReset] = useState(0);
  const setManualState = (next: SetStateAction<ShapeSlicerState>) => {
    setState(next);
    setComparisonReset((value) => value + 1);
  };
  const result = crossSection(state),
    label = shapeObservation(state);
  return (
    <LearningFrame
      resetLabel="Reset shape slicer"
      onReset={() => setManualState(defaultShapeSlicerState)}
    >
      <Diagram visualState={{ kind: "shape-slicer", ...state }} label={label}>
        {(width) => (
          <>
            {result.points.map((point, i) => {
              const next = result.points[(i + 1) % result.points.length];
              return (
                <Line
                  key={i}
                  x={width / 2 + point[0] * 55}
                  y={145 + point[2] * 55}
                  x2={width / 2 + next[0] * 55}
                  y2={145 + next[2] * 55}
                  color="#efc77a"
                />
              );
            })}
            {result.points.length === 1 && (
              <Dot x={width / 2} y={145} size={8} />
            )}
            <DiagramLabel x={18} y={260}>
              {result.name} · area {result.area.toFixed(2)} square units
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label} The cross-section is where a flat plane meets the solid, not the
        solid's shadow or its outer face.
      </Explanation>
      <Choice
        label="Solid"
        value={state.solid}
        onChange={(solid) => setManualState({ ...state, solid })}
        options={[
          { value: "cube", label: "Cube" },
          { value: "tetrahedron", label: "Tetrahedron" },
          { value: "sphere", label: "Sphere" },
        ]}
      />
      <Control
        label="Tilt (degrees)"
        value={state.tilt}
        min={0}
        max={90}
        step={5}
        onChange={(tilt) => setManualState({ ...state, tilt })}
      />
      <Control
        label="Turn (degrees)"
        value={state.turn}
        min={0}
        max={90}
        step={5}
        onChange={(turn) => setManualState({ ...state, turn })}
      />
      <Control
        label="Slice offset (units)"
        value={state.offset}
        min={-1.75}
        max={1.75}
        step={0.05}
        onChange={(offset) => setManualState({ ...state, offset })}
      />
      <ActionButton
        label="Center slice"
        onPress={() => setManualState({ ...state, offset: 0 })}
      />
      <ActionButton
        label="Diagonal cube slice"
        onPress={() => setManualState(diagonalCubeState)}
      />
      <ShapeComparison onApply={setState} resetKey={comparisonReset} />
      <ModelNote>
        {shapeSlicerCoreBoundary} {shapeSlicerBoundary}
      </ModelNote>
    </LearningFrame>
  );
}

export function AdaptationExploration() {
  const [state, setState] = useState(defaultAdaptationIslandState);
  const label = islandObservation(state);
  return (
    <LearningFrame onReset={() => setState(defaultAdaptationIslandState)}>
      <Diagram
        visualState={{ kind: "adaptation-island", ...state }}
        label={label}
      >
        {(width) => (
          <>
            <Line
              x={15}
              y={200}
              x2={width - 15}
              y2={200}
              color={state.habitat === "dark" ? "#777b88" : "#e2c996"}
            />
            {Array.from({ length: 20 }, (_, i) => (
              <Dot
                key={i}
                x={28 + ((i % 10) * (width - 56)) / 9}
                y={110 + Math.floor(i / 10) * 45}
                size={15}
                color={i < state.darkCount / 5 ? "#675a4c" : "#eedbb5"}
              />
            ))}
            <DiagramLabel x={18} y={240}>
              Dark {state.darkCount.toFixed(1)}% · pale{" "}
              {state.lightCount.toFixed(1)}%
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>{label}</Explanation>
      <Meter
        label="Expected dark-shell share"
        value={state.darkCount}
        detail={`${state.darkCount.toFixed(1)}%`}
      />
      <Choice
        label="Habitat"
        value={state.habitat}
        onChange={(habitat) => setState({ ...state, habitat })}
        options={[
          { value: "dark", label: "Dark ground" },
          { value: "light", label: "Light ground" },
        ]}
      />
      <ActionButton
        label={state.predators ? "Remove predators" : "Add predators"}
        onPress={() => setState({ ...state, predators: !state.predators })}
      />
      <Control
        label="Starting dark-shell share (%)"
        value={state.initialDark}
        min={0}
        max={100}
        step={10}
        onChange={(initialDark) =>
          setState(resetIsland({ ...state, initialDark }))
        }
      />
      <ActionButton
        label="Restart generations"
        onPress={() => setState(resetIsland(state))}
        variant="secondary"
      />
      <ActionButton
        label="Next generation"
        disabled={state.generation >= 20}
        onPress={() => setState(nextIslandGeneration(state))}
      />
      <ActionButton
        label="Advance five generations"
        disabled={state.generation >= 20}
        onPress={() =>
          setState(
            Array.from({ length: 5 }).reduce<typeof state>(
              (next) => nextIslandGeneration(next),
              state,
            ),
          )
        }
      />
      <AdaptationComparisons setState={setState} />
      <ModelNote>
        Deterministic expected proportions, not sampled animal counts. Twenty
        symbols approximate shares; percentages are authoritative. Invented
        survival weights favor camouflage only when predators are present.
        Reproduction returns the total to 100%; mutation, migration, chance, and
        other traits are omitted. Individuals do not choose new traits because
        they need them.
      </ModelNote>
    </LearningFrame>
  );
}
