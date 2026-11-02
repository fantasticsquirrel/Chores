import { Text, View } from "react-native";
import {
  CARAVAN_CARGO,
  CARAVAN_ROUTES,
  CARAVAN_ROUTE_TRIAL,
  CARAVAN_SEASON_TRIAL,
  calculateCaravanJourney,
  compareCaravanPlans,
  type CaravanCargo,
  type CaravanRoute,
  type CaravanSeason,
} from "@family-manager/family-api/discovery-models/caravans";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
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
import {
  type NativeRoutePrediction,
  type NativeSeasonPrediction,
  useNativeCaravanLesson,
} from "./caravan/useNativeCaravanLesson";

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

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}
    >
      {children}
    </Text>
  );
}

export function CaravanExploration() {
  const lesson = useNativeCaravanLesson();
  const journey = calculateCaravanJourney(lesson.plan)!;
  const route = CARAVAN_ROUTES[lesson.plan.route];

  return (
    <LearningFrame onReset={lesson.reset} resetLabel="Reset lesson">
      <Diagram
        visualState={{
          kind: "caravan",
          route: lesson.plan.route,
          season: lesson.plan.season,
          cargo: lesson.plan.cargo,
          units: lesson.plan.units,
          supplies: lesson.plan.supplyDays,
          days: journey.days,
          load: journey.load,
        }}
        label={`Fictional dimensional relief map with three undirected routes and intermediate exchange stops. Selected ${route.name}, ${lesson.plan.season} season, ${journey.days} modeled days. ${journey.delivered} of ${lesson.plan.units} cargo units delivered; ${journey.load} of 100 kilograms packed. This single comparison segment is not the historical Silk Roads network.`}
      >
        {(width) => (
          <>
            {(["ridge", "river", "oasis"] as const).map((name, index) => (
              <Line
                key={name}
                x={28}
                y={105}
                x2={width - 28}
                y2={55 + index * 60}
                color={name === lesson.plan.route ? "#ffe49b" : "#71819d"}
              />
            ))}
            <Dot x={28} y={105} size={18} color="#91ede4" />
            {(["ridge", "river", "oasis"] as const).map((name, index) => (
              <DiagramLabel key={name} x={width / 2 - 25} y={30 + index * 60}>
                {CARAVAN_ROUTES[name].name}:{" "}
                {CARAVAN_ROUTES[name][lesson.plan.season]} days
              </DiagramLabel>
            ))}
          </>
        )}
      </Diagram>

      <Explanation>
        Current fictional plan: {route.name} · {lesson.plan.season} season ·{" "}
        {journey.days} days · {journey.delivered} / {lesson.plan.units}{" "}
        delivered · {journey.load} / 100 kg · margin {credits(journey.margin)}.
      </Explanation>
      <Meter
        label="Packed load"
        value={journey.load}
        max={100}
        detail={`${journey.load} / 100 kg`}
        color={journey.overCapacity ? "#ad3d2e" : "#217d69"}
      />

      <SectionTitle>1 · Change the season</SectionTitle>
      <Explanation>
        River Road, 6 grain units and 14 packed supply days stay fixed. If only
        wet season changes to dry, what happens to travel time?
      </Explanation>
      <Choice
        label="Prediction: travel time"
        value={lesson.seasonPrediction ?? ""}
        onChange={(value) =>
          lesson.setSeasonPrediction(value as NativeSeasonPrediction)
        }
        options={[
          { value: "more", label: "More travel days" },
          { value: "same", label: "Same travel time" },
          { value: "fewer", label: "Fewer travel days" },
        ]}
      />
      <ActionButton
        label="Compare wet and dry river plans"
        disabled={!lesson.seasonPrediction}
        onPress={lesson.compareSeasons}
      />
      {lesson.seasonCompared && (
        <>
          <Explanation>
            {lesson.seasonPrediction === "more"
              ? "The evidence matches your prediction. "
              : "The evidence differs from your prediction. "}
            Wet: {seasonEvidence.baseline.days} days ·{" "}
            {seasonEvidence.baseline.delivered} of 6 delivered ·{" "}
            {seasonEvidence.baseline.load} / 100 kg ·{" "}
            {credits(seasonEvidence.baseline.margin)}. Dry:{" "}
            {seasonEvidence.comparison.days} days ·{" "}
            {seasonEvidence.comparison.delivered} of 6 delivered ·{" "}
            {seasonEvidence.comparison.load} / 100 kg ·{" "}
            {credits(seasonEvidence.comparison.margin)}. Changed: season. Held:
            River Road, 6 grain units, 14 supply days, the 100 kg limit and all
            price and loss rules. The invented dry rule adds 6 days and crosses
            the invented grain-spoilage threshold.
          </Explanation>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show wet evidence"
                variant="secondary"
                onPress={lesson.showSeasonBaseline}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show dry evidence"
                variant="secondary"
                onPress={lesson.showSeasonComparison}
              />
            </View>
          </View>
        </>
      )}

      <SectionTitle>2 · Change the route</SectionTitle>
      <Explanation>
        Dry season, 6 pottery units and 12 packed supply days stay fixed. Which
        plan delivers more pottery and keeps the larger margin?
      </Explanation>
      <Choice
        label="Prediction: stronger plan"
        value={lesson.routePrediction ?? ""}
        onChange={(value) =>
          lesson.setRoutePrediction(value as NativeRoutePrediction)
        }
        options={[
          { value: "mountain", label: "Mountain Pass" },
          { value: "oasis", label: "Oasis Trail" },
          { value: "same", label: "Same outcome" },
        ]}
      />
      <ActionButton
        label="Compare mountain and oasis plans"
        disabled={!lesson.routePrediction}
        onPress={lesson.compareRoutes}
      />
      {lesson.routeCompared && (
        <>
          <Explanation>
            {lesson.routePrediction === "oasis"
              ? "The evidence matches your prediction. "
              : "The evidence differs from your prediction. "}
            Mountain: {routeEvidence.baseline.days} days ·{" "}
            {routeEvidence.baseline.delivered} of 6 delivered · toll{" "}
            {routeEvidence.baseline.toll} · margin{" "}
            {credits(routeEvidence.baseline.margin)}. Oasis:{" "}
            {routeEvidence.comparison.days} days ·{" "}
            {routeEvidence.comparison.delivered} of 6 delivered · toll{" "}
            {routeEvidence.comparison.toll} · margin{" "}
            {credits(routeEvidence.comparison.margin)}. Changed: route. Held:
            dry season, 6 pottery units, 12 supply days, the 100 kg limit and
            all price and loss rules. In this model, the longer Oasis Trail
            avoids the invented mountain breakage and has the lower toll.
          </Explanation>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show mountain evidence"
                variant="secondary"
                onPress={lesson.showRouteBaseline}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Show oasis evidence"
                variant="secondary"
                onPress={lesson.showRouteComparison}
              />
            </View>
          </View>
        </>
      )}

      {lesson.explorationUnlocked ? (
        <View style={{ gap: 16 }}>
          <SectionTitle>Explore one change at a time</SectionTitle>
          <Choice
            label="Route"
            value={lesson.plan.route}
            onChange={lesson.setRoute}
            options={(Object.keys(CARAVAN_ROUTES) as CaravanRoute[]).map(
              (value) => ({ value, label: CARAVAN_ROUTES[value].name }),
            )}
          />
          <Choice
            label="Season"
            value={lesson.plan.season}
            onChange={lesson.setSeason}
            options={
              [
                { value: "wet", label: "Wet season" },
                { value: "dry", label: "Dry season" },
              ] as { value: CaravanSeason; label: string }[]
            }
          />
          <Choice
            label="Cargo"
            value={lesson.plan.cargo}
            onChange={lesson.setCargo}
            options={(Object.keys(CARAVAN_CARGO) as CaravanCargo[]).map(
              (value) => ({ value, label: CARAVAN_CARGO[value].name }),
            )}
          />
          <Control
            label="Cargo units"
            value={lesson.plan.units}
            min={1}
            max={15}
            onChange={lesson.setUnits}
          />
          <Control
            label="Supply days"
            value={lesson.plan.supplyDays}
            min={0}
            max={20}
            onChange={lesson.setSupplyDays}
          />
          <ActionButton
            label={`Pack exactly ${journey.days} days`}
            variant="secondary"
            onPress={lesson.packExactDays}
          />
        </View>
      ) : (
        <Explanation>
          Complete both prediction-first comparisons to unlock route, cargo and
          packing controls.
        </Explanation>
      )}

      <ModelNote>
        Historical Silk Roads were overlapping land and sea networks connecting
        many communities in many directions; goods often changed hands between
        merchants. This is one fictional composite segment, not a reconstruction
        of a place, people or century. Every location, duration, season effect,
        100 kg limit, price, toll, margin and loss is invented. Fixed rules use
        2 kg per supply day, 25% grain spoilage after 10 days and 15% mountain
        pottery breakage, rounded up. They are not historical measurements,
        probabilities or forecasts.
      </ModelNote>
    </LearningFrame>
  );
}
