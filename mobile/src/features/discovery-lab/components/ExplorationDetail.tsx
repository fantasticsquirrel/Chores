import { Text } from "react-native";
import type { DiscoveryExploration } from "@family-manager/family-api/models/discovery-lab";
import { SectionCard } from "../../../components/SectionCard";
import { colors } from "../../../styles/colors";
import { NativeExploration } from "./NativeExploration";
export function ExplorationDetail({
  detail,
}: {
  detail: DiscoveryExploration;
}) {
  if (detail.package) {
    return (
      <SectionCard title={detail.title} subtitle="Web-only Exploration">
        <Text
          accessibilityRole="alert"
          style={{ color: colors.text, lineHeight: 23 }}
        >
          This published Exploration runs in the web app. Open Discovery Lab in
          your browser to use its interactive model.
        </Text>
      </SectionCard>
    );
  }
  return (
    <>
      <SectionCard
        title={detail.title}
        subtitle={`${detail.subject} · ${detail.grade_bands.join(", ")}`}
      >
        <Text style={{ color: colors.text, fontSize: 19, fontWeight: "700" }}>
          {detail.question}
        </Text>
        <NativeExploration key={detail.id} id={detail.id} />
        <Text style={{ color: colors.text, lineHeight: 23 }}>
          {detail.explanation}
        </Text>
      </SectionCard>
      {detail.experiments.map((experiment) => (
        <SectionCard key={experiment.title} title={experiment.title}>
          <Text style={{ color: colors.text, lineHeight: 23 }}>
            {experiment.instruction}
          </Text>
          <Text style={{ color: colors.textMuted, lineHeight: 23 }}>
            Look for: {experiment.observe}
          </Text>
        </SectionCard>
      ))}
      <SectionCard title="Think again">
        <Text style={{ color: colors.text, lineHeight: 23 }}>
          {detail.misconception}
        </Text>
      </SectionCard>
      <SectionCard title="Sources">
        {detail.id === "moon-phases" && (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 22 }}>
            Lunar surface maps: NASA / LRO / LROC / LOLA, CGI Moon Kit.
            https://svs.gsfc.nasa.gov/4720/
          </Text>
        )}
        {["orbital-mechanics", "solar-system"].includes(detail.id) && (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 22 }}>
            Earth surface map: NASA Earth Observatory, Blue Marble Next
            Generation, August 2004.
            https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/
          </Text>
        )}
        {detail.sources.map((source) => (
          <Text
            key={source.url}
            selectable
            style={{ color: colors.text, lineHeight: 22 }}
          >
            {source.title}: {source.url}
          </Text>
        ))}
      </SectionCard>
    </>
  );
}
