import { useState } from "react";
import {
  CARAVAN_CARGO,
  CARAVAN_ROUTES,
  caravanJourney,
  type CaravanCargo,
  type CaravanRoute,
  type CaravanSeason,
} from "@family-manager/family-api/discovery-models/math-life";
import { Control, Dot, Line } from "./Primitives";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "./LearningPrimitives";

export function CaravanExploration() {
  const [route, setRoute] = useState<CaravanRoute>("ridge");
  const [season, setSeason] = useState<CaravanSeason>("dry");
  const [cargo, setCargo] = useState<CaravanCargo>("grain");
  const [units, setUnits] = useState(8);
  const [supplies, setSupplies] = useState(10);
  const journey = caravanJourney(route, season, cargo, units, supplies);
  return (
    <LearningFrame
      onReset={() => {
        setRoute("ridge");
        setSeason("dry");
        setCargo("grain");
        setUnits(8);
        setSupplies(10);
      }}
    >
      <Diagram
        visualState={{
          kind: "caravan",
          route,
          season,
          cargo,
          units,
          supplies,
          days: journey.days,
          load: journey.load,
        }}
        label={`Fictional routes: Mountain pass, River road, Oasis trail. Selected ${CARAVAN_ROUTES[route].name}, ${journey.days} travel days, toll ${journey.toll} coins.`}
      >
        {(width) => (
          <>
            {(["ridge", "river", "oasis"] as const).map((name, i) => (
              <Line
                key={name}
                x={28}
                y={105}
                x2={width - 28}
                y2={55 + i * 60}
                color={name === route ? "#ffe49b" : "#71819d"}
              />
            ))}
            <Dot x={28} y={105} size={18} color="#91ede4" />
            {(["ridge", "river", "oasis"] as const).map((name, i) => (
              <DiagramLabel key={name} x={width / 2 - 25} y={30 + i * 60}>
                {CARAVAN_ROUTES[name].name}: {CARAVAN_ROUTES[name][season]} days
              </DiagramLabel>
            ))}
            <DiagramLabel x={15} y={190}>
              Departure · three alternative routes
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Choice
        label="Route"
        value={route}
        onChange={setRoute}
        options={(Object.keys(CARAVAN_ROUTES) as CaravanRoute[]).map(
          (value) => ({ value, label: CARAVAN_ROUTES[value].name }),
        )}
      />
      <Choice
        label="Season"
        value={season}
        onChange={setSeason}
        options={[
          { value: "dry", label: "Dry season" },
          { value: "wet", label: "Wet season" },
        ]}
      />
      <Choice
        label="Cargo"
        value={cargo}
        onChange={setCargo}
        options={(Object.keys(CARAVAN_CARGO) as CaravanCargo[]).map(
          (value) => ({ value, label: CARAVAN_CARGO[value].name }),
        )}
      />
      <Control
        label="Cargo units"
        value={units}
        min={1}
        max={20}
        onChange={setUnits}
      />
      <Control
        label="Supply days"
        value={supplies}
        min={0}
        max={16}
        onChange={setSupplies}
      />
      <Meter
        label="Carrying load"
        value={journey.load}
        max={150}
        detail={`${journey.load} / 100 capacity`}
        color={journey.overCapacity ? "#ad3d2e" : "#217d69"}
      />
      <Explanation>
        {journey.days} days of travel;{" "}
        {journey.shortfall
          ? `${journey.shortfall} days short of supplies.`
          : "Enough supplies."}{" "}
        {journey.overCapacity
          ? "The load exceeds the caravan's capacity."
          : "The load fits."}{" "}
        Toll: {journey.toll} coins.
      </Explanation>
      <Explanation>
        {journey.delivered} of {units} cargo units reach the destination in the
        model: {journey.spoiled} spoiled, {journey.broken} broken. Costs:{" "}
        {journey.costs} coins. Revenue: {journey.revenue} coins. Projected
        balance: {journey.margin} coins.{" "}
        {!journey.viable
          ? "This plan cannot depart as packed; resolve supply or capacity limits before comparing its projected balance."
          : "This plan meets the supply and capacity limits."}
      </Explanation>
      <ModelNote>
        All places, prices, routes, and timings are fictional. Grain can spoil
        on long trips; pottery can break on the mountain pass. This compares
        trade-offs, not the history of a single culture or a real travel
        recommendation.
      </ModelNote>
    </LearningFrame>
  );
}
