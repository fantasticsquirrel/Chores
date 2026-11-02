import { useId } from "react";
import {
  CARAVAN_CARGO,
  CARAVAN_ROUTES,
  calculateCaravanJourney,
  type CaravanCargo,
  type CaravanRoute,
  type CaravanSeason,
} from "@family-manager/family-api/discovery-models/caravans";
import { Slider } from "./SimulationPrimitives";
import {
  LandscapeExhibit,
  LandscapeMetric,
} from "./landscape/LandscapeExhibit";
import { CaravanPredictionTrials } from "./caravan/CaravanPredictionTrials";
import { useCaravanLesson } from "./caravan/useCaravanLesson";
import "./caravan/caravan-crossroads.css";

const formatCredits = (value: number) =>
  `${value < 0 ? "−" : ""}${Math.abs(value)} teaching credits`;

export function CaravanSimulation() {
  const id = useId();
  const lesson = useCaravanLesson();
  const result = calculateCaravanJourney(lesson.plan)!;
  const route = CARAVAN_ROUTES[lesson.plan.route];
  const cargo = CARAVAN_CARGO[lesson.plan.cargo];
  const packingStatus = result.overCapacity
    ? `${result.load - result.capacity} kg over capacity`
    : result.shortfall > 0
      ? `${result.shortfall} supply days missing`
      : `${result.capacityRemaining} kg capacity remains`;

  return (
    <LandscapeExhibit
      title="Compare route constraints"
      introduction="Predict first. Change one modeled condition, then use travel, delivery, load and margin evidence to explain the result."
      state={{
        kind: "caravan",
        route: lesson.plan.route,
        season: lesson.plan.season,
        cargo: lesson.plan.cargo,
        units: lesson.plan.units,
        supplies: lesson.plan.supplyDays,
        days: result.days,
        load: result.load,
      }}
      description={`Fictional dimensional relief map with three undirected routes between Willow Market and Harbor Town and intermediate exchange stops. Selected ${route.name}, ${lesson.plan.season} season, ${result.days} modeled days. ${lesson.plan.units} ${cargo.name.toLowerCase()} units and ${lesson.plan.supplyDays} supply days make a ${result.load} kilogram load against a 100 kilogram teaching limit. ${result.delivered} units are delivered; ${result.spoiled} spoil and ${result.broken} break under the invented rules. This single segment represents one small comparison within historical networks that connected many communities in many directions.`}
      controls={
        lesson.explorationUnlocked ? (
          <section
            className="caravan-explore"
            aria-labelledby={`${id}-explore`}
          >
            <div className="caravan-explore-heading">
              <div>
                <h3 id={`${id}-explore`}>Explore one change at a time</h3>
                <p>
                  Restore a comparison before drawing a conclusion. These are
                  invented values, not a travel recommendation.
                </p>
              </div>
              <button type="button" onClick={lesson.reset}>
                Reset lesson
              </button>
            </div>
            <div className="caravan-free-controls">
              <label htmlFor={`${id}-route`}>
                Trade route
                <select
                  aria-label="Trade route"
                  id={`${id}-route`}
                  value={lesson.plan.route}
                  onChange={(event) =>
                    lesson.setRoute(event.target.value as CaravanRoute)
                  }
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
                  value={lesson.plan.season}
                  onChange={(event) =>
                    lesson.setSeason(event.target.value as CaravanSeason)
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
                  value={lesson.plan.cargo}
                  onChange={(event) =>
                    lesson.setCargo(event.target.value as CaravanCargo)
                  }
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
                value={lesson.plan.units}
                min={1}
                max={15}
                onChange={lesson.setUnits}
              />
              <Slider
                label="Supply days packed"
                value={lesson.plan.supplyDays}
                min={0}
                max={20}
                onChange={lesson.setSupplyDays}
              />
              <div className="caravan-actions">
                <button type="button" onClick={lesson.packExactDays}>
                  Pack exactly {result.days} days
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div className="caravan-locked">
            <span>
              Complete both prediction-first comparisons to unlock route, cargo
              and packing controls.
            </span>
            <button type="button" onClick={lesson.reset}>
              Reset lesson
            </button>
          </div>
        )
      }
      evidence={
        <div className="caravan-current" role="status" aria-live="polite">
          <div className="caravan-current-heading">
            <div>
              <span>Current fictional plan</span>
              <strong>
                {route.name} · {lesson.plan.season} season · {result.days} days
              </strong>
            </div>
            <span data-viable={result.viable}>{packingStatus}</span>
          </div>
          <div className="landscape-metrics caravan-metrics">
            <LandscapeMetric
              label="Delivered"
              value={`${result.delivered} / ${lesson.plan.units} units`}
            >
              <small>
                {result.spoiled} spoiled · {result.broken} broken
              </small>
            </LandscapeMetric>
            <LandscapeMetric
              label="Packed load"
              value={`${result.load} / ${result.capacity} kg`}
            >
              <small>
                cargo {result.cargoWeight} + supplies {result.supplyWeight}
              </small>
            </LandscapeMetric>
            <LandscapeMetric label="Toll" value={`${result.toll} credits`}>
              <small>invented route charge</small>
            </LandscapeMetric>
            <LandscapeMetric
              label="Margin"
              value={
                result.viable ? formatCredits(result.margin) : "Not compared"
              }
            >
              <small>
                {result.viable
                  ? `${result.revenue} revenue − ${result.costs} costs`
                  : "resolve supply or capacity first"}
              </small>
            </LandscapeMetric>
          </div>
        </div>
      }
      investigations={
        <CaravanPredictionTrials
          lesson={lesson}
          onShowSeasonWet={lesson.showSeasonBaseline}
          onShowSeasonDry={lesson.showSeasonComparison}
          onShowRouteMountain={lesson.showRouteBaseline}
          onShowRouteOasis={lesson.showRouteComparison}
        />
      }
      note="Model boundary: this is a fictional composite segment, not a reconstruction of a place, people or century. Historical Silk Roads were overlapping land and sea networks connecting many communities in many directions; goods often changed hands between merchants. Every location, route, season effect, duration, 100 kg limit, price, toll, margin and loss here is invented. Fixed teaching rules use 2 kg per supply day, 25% grain spoilage after 10 days and 15% mountain pottery breakage, rounded up. They are not historical measurements, probabilities or forecasts."
    />
  );
}
