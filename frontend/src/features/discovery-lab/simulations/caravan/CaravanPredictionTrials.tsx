import {
  CARAVAN_ROUTE_TRIAL,
  CARAVAN_SEASON_TRIAL,
  compareCaravanPlans,
} from "@family-manager/family-api/discovery-models/caravans";
import type {
  CaravanLesson,
  RoutePrediction,
  SeasonPrediction,
} from "./useCaravanLesson";

const seasonEvidence = compareCaravanPlans(
  CARAVAN_SEASON_TRIAL.baseline,
  CARAVAN_SEASON_TRIAL.comparison,
)!;
const routeEvidence = compareCaravanPlans(
  CARAVAN_ROUTE_TRIAL.baseline,
  CARAVAN_ROUTE_TRIAL.comparison,
)!;

const credits = (value: number) =>
  `${value < 0 ? "−" : ""}${Math.abs(value)} teaching credits`;

function PredictionButtons<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly { value: T; label: string }[];
  selected: T | null;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="caravan-predictions">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected === option.value}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function CaravanPredictionTrials({
  lesson,
  onShowSeasonWet,
  onShowSeasonDry,
  onShowRouteMountain,
  onShowRouteOasis,
}: {
  lesson: CaravanLesson;
  onShowSeasonWet: () => void;
  onShowSeasonDry: () => void;
  onShowRouteMountain: () => void;
  onShowRouteOasis: () => void;
}) {
  return (
    <div className="caravan-learning">
      <div className="caravan-trials">
        <fieldset className="caravan-trial">
          <legend>1 · Change the season</legend>
          <p>
            River Road, 6 grain units and 14 packed supply days stay fixed. If
            only wet season changes to dry, what happens to travel time?
          </p>
          <PredictionButtons<SeasonPrediction>
            options={[
              { value: "more", label: "More travel days" },
              { value: "same", label: "Same travel time" },
              { value: "fewer", label: "Fewer travel days" },
            ]}
            selected={lesson.seasonPrediction}
            onSelect={lesson.setSeasonPrediction}
          />
          <button
            className="caravan-compare"
            type="button"
            disabled={!lesson.seasonPrediction}
            onClick={lesson.compareSeasons}
          >
            Compare wet and dry river plans
          </button>
          {lesson.seasonCompared && (
            <div
              className="caravan-feedback"
              data-testid="caravan-season-feedback"
              aria-live="polite"
            >
              <strong>
                {lesson.seasonPrediction === "more"
                  ? "The evidence matches your prediction."
                  : "The evidence differs from your prediction."}
              </strong>
              <p>
                Wet: {seasonEvidence.baseline.days} days ·{" "}
                {seasonEvidence.baseline.delivered} of 6 delivered ·{" "}
                {seasonEvidence.baseline.load} / 100 kg ·{" "}
                {credits(seasonEvidence.baseline.margin)}.
              </p>
              <p>
                Dry: {seasonEvidence.comparison.days} days ·{" "}
                {seasonEvidence.comparison.delivered} of 6 delivered ·{" "}
                {seasonEvidence.comparison.load} / 100 kg ·{" "}
                {credits(seasonEvidence.comparison.margin)}.
              </p>
              <p>
                Changed: season. Held: River Road · 6 grain units · 14 supply
                days · 100 kg limit · all price and loss rules. The invented dry
                rule adds 6 days and crosses the invented grain-spoilage
                threshold, so 2 fewer units arrive.
              </p>
              <div className="caravan-evidence-actions">
                <button type="button" onClick={onShowSeasonWet}>
                  Show wet evidence
                </button>
                <button type="button" onClick={onShowSeasonDry}>
                  Show dry evidence
                </button>
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="caravan-trial">
          <legend>2 · Change the route</legend>
          <p>
            Dry season, 6 pottery units and 12 packed supply days stay fixed.
            Which plan delivers more pottery and keeps the larger margin?
          </p>
          <PredictionButtons<RoutePrediction>
            options={[
              { value: "mountain", label: "Mountain Pass" },
              { value: "oasis", label: "Oasis Trail" },
              { value: "same", label: "Same outcome" },
            ]}
            selected={lesson.routePrediction}
            onSelect={lesson.setRoutePrediction}
          />
          <button
            className="caravan-compare"
            type="button"
            disabled={!lesson.routePrediction}
            onClick={lesson.compareRoutes}
          >
            Compare mountain and oasis plans
          </button>
          {lesson.routeCompared && (
            <div
              className="caravan-feedback"
              data-testid="caravan-route-feedback"
              aria-live="polite"
            >
              <strong>
                {lesson.routePrediction === "oasis"
                  ? "The evidence matches your prediction."
                  : "The evidence differs from your prediction."}
              </strong>
              <p>
                Mountain: {routeEvidence.baseline.days} days ·{" "}
                {routeEvidence.baseline.delivered} of 6 delivered · toll{" "}
                {routeEvidence.baseline.toll} · margin{" "}
                {credits(routeEvidence.baseline.margin)}.
              </p>
              <p>
                Oasis: {routeEvidence.comparison.days} days ·{" "}
                {routeEvidence.comparison.delivered} of 6 delivered · toll{" "}
                {routeEvidence.comparison.toll} · margin{" "}
                {credits(routeEvidence.comparison.margin)}.
              </p>
              <p>
                Changed: route. Held: dry season · 6 pottery units · 12 supply
                days · 100 kg limit · all price and loss rules. The Oasis Trail
                takes 3 more days, but the invented mountain-breakage rule and
                higher toll make the shorter route deliver less with a lower
                margin.
              </p>
              <div className="caravan-evidence-actions">
                <button type="button" onClick={onShowRouteMountain}>
                  Show mountain evidence
                </button>
                <button type="button" onClick={onShowRouteOasis}>
                  Show oasis evidence
                </button>
              </div>
            </div>
          )}
        </fieldset>
      </div>
      <div className="caravan-history-connection">
        <strong>Historical connection</strong>
        <p>
          Institutional sources describe the Silk Roads as overlapping land and
          sea networks. Many communities, local markets and different merchants
          moved goods, skills and ideas in multiple directions. This map tests
          one invented segment; it does not represent the whole network or one
          universal traveler’s experience.
        </p>
      </div>
    </div>
  );
}
