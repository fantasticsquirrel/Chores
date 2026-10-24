import { useId, useState } from "react";
import {
  CARAVAN_CARGO,
  CARAVAN_ROUTES,
  caravanJourney,
  type CaravanCargo,
  type CaravanRoute,
  type CaravanSeason,
} from "@family-manager/family-api/discovery-models/math-life";
import { Slider } from "./SimulationPrimitives";
import {
  LandscapeExhibit,
  LandscapeInvestigation,
  LandscapeMetric,
} from "./landscape/LandscapeExhibit";
export function CaravanSimulation() {
  const id = useId(),
    [route, setRoute] = useState<CaravanRoute>("river"),
    [season, setSeason] = useState<CaravanSeason>("wet"),
    [cargo, setCargo] = useState<CaravanCargo>("grain"),
    [units, setUnits] = useState(6),
    [supplies, setSupplies] = useState(10);
  const result = caravanJourney(route, season, cargo, units, supplies),
    status = result.overCapacity
      ? "Over the 100 kg carrying limit"
      : result.shortfall > 0
        ? `${result.shortfall} more supply days needed`
        : "Enough supplies and carrying capacity";
  const reset = () => {
    setRoute("river");
    setSeason("wet");
    setCargo("grain");
    setUnits(6);
    setSupplies(10);
  };
  return (
    <LandscapeExhibit
      title="Which route fits the cargo?"
      introduction="Compare three routes between fictional markets. Weather, supplies and fragile or perishable goods change the tradeoff."
      state={{
        kind: "caravan",
        route,
        season,
        cargo,
        units,
        supplies,
        days: result.days,
        load: result.load,
      }}
      description={`Fictional relief map. The selected ${CARAVAN_ROUTES[route].name} takes ${result.days} days in the ${season} season. ${units} ${cargo} units and ${supplies} days of supplies weigh ${result.load} kilograms. ${status}. Mountains lie to the north, an oasis to the south, and a river between the markets.`}
      controls={
        <>
          <label htmlFor={`${id}-route`}>
            Trade route
            <select
              aria-label="Trade route"
              id={`${id}-route`}
              value={route}
              onChange={(event) => setRoute(event.target.value as CaravanRoute)}
            >
              {Object.entries(CARAVAN_ROUTES).map(([value, item]) => (
                <option key={value} value={value}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-season`}>
            Season
            <select
              aria-label="Season"
              id={`${id}-season`}
              value={season}
              onChange={(event) =>
                setSeason(event.target.value as CaravanSeason)
              }
            >
              <option value="wet">Wet season</option>
              <option value="dry">Dry season</option>
            </select>
          </label>
          <label htmlFor={`${id}-cargo`}>
            Cargo
            <select
              aria-label="Cargo"
              id={`${id}-cargo`}
              value={cargo}
              onChange={(event) => setCargo(event.target.value as CaravanCargo)}
            >
              {Object.entries(CARAVAN_CARGO).map(([value, item]) => (
                <option key={value} value={value}>
                  {item.name} · {item.weight} kg each
                </option>
              ))}
            </select>
          </label>
          <Slider
            label="Cargo units"
            value={units}
            min={1}
            max={10}
            onChange={setUnits}
          />
          <Slider
            label="Supply days packed"
            value={supplies}
            min={0}
            max={20}
            onChange={setSupplies}
          />
          <div className="landscape-actions">
            <button type="button" onClick={() => setSupplies(result.days)}>
              Pack enough days
            </button>
            <button type="button" onClick={reset}>
              Reset
            </button>
          </div>
        </>
      }
      evidence={
        <>
          <div className="landscape-metrics">
            <LandscapeMetric label="Journey" value={`${result.days} days`}>
              <small>{CARAVAN_ROUTES[route].name}</small>
            </LandscapeMetric>
            <LandscapeMetric
              label="Supply days packed"
              value={`${supplies} / ${result.days}`}
            >
              <div className="landscape-bars" aria-hidden="true">
                {Array.from(
                  { length: Math.max(supplies, result.days) },
                  (_, i) => (
                    <i key={i} data-missing={i >= supplies} />
                  ),
                )}
              </div>
            </LandscapeMetric>
            <LandscapeMetric
              label="Packed load"
              value={`${result.load} / 100 kg`}
            >
              <small>
                Cargo {units * CARAVAN_CARGO[cargo].weight} kg + supplies{" "}
                {supplies * 2} kg
              </small>
            </LandscapeMetric>
            <LandscapeMetric
              label="Trade margin"
              value={
                result.viable ? `${result.margin} coins` : "Plan incomplete"
              }
            >
              <small>
                {result.viable
                  ? `${result.revenue} sales − ${result.costs} costs`
                  : "Resolve supplies and carrying capacity"}
              </small>
            </LandscapeMetric>
          </div>
          <div className="landscape-observation" role="status">
            <strong>{status}</strong>. {result.days} travel days · {result.load}
            /100 kg packed · toll {result.toll} coins.{" "}
            {CARAVAN_ROUTES[route].description}{" "}
            {result.spoiled > 0
              ? `${result.spoiled} grain unit${result.spoiled === 1 ? "" : "s"} spoil during the journey. `
              : ""}
            {result.broken > 0
              ? `${result.broken} pottery unit${result.broken === 1 ? "" : "s"} break on the steep path. `
              : ""}
            {result.viable
              ? `Estimated delivery: ${result.delivered} units. Sale ${result.revenue} − purchase, supplies and tolls ${result.costs} = ${result.margin} coins remaining from this trade.`
              : "Change the packing plan before estimating a completed trade."}
          </div>
        </>
      }
      investigations={
        <LandscapeInvestigation
          items={[
            {
              label: "Compare seasons",
              predict:
                "Will a dry-season river journey need more or fewer supplies?",
              options: ["More", "Fewer"],
              action:
                "Keep six grain units and the river road. Compare wet and dry seasons. Pack enough days for each and compare delivered cargo and margin.",
              explain:
                "Low water slows this modeled river route. A longer journey needs supplies and passes the grain-spoilage threshold. Why is travel time not the only cost?",
              test: reset,
              testLabel: "Set wet-season baseline",
            },
            {
              label: "Compare cargo",
              predict: "Is the shortest route always best for pottery?",
              options: ["Always", "Not always"],
              action:
                "In the dry season, carry six pottery units. Compare the mountain pass with the oasis trail. Pack enough days separately for each route.",
              explain:
                "The pass is shorter but breaks some pottery; the oasis route needs more supplies but has a lower toll. Use delivered units, carrying capacity and margin as evidence.",
              test: () => {
                setSeason("dry");
                setCargo("pottery");
                setUnits(6);
                setRoute("ridge");
                setSupplies(9);
              },
              testLabel: "Set pottery comparison",
            },
          ]}
        />
      }
      note="Fictional composite map, not a reconstruction of a real historical route. Trade connected many communities in multiple directions. Locations, durations, prices and losses are invented teaching parameters. Supplies weigh 2 kg/day. Grain loses 25% after ten days; mountain travel breaks 15% of pottery, rounded up. These fixed rules reveal constraints, not historical probabilities."
    />
  );
}
