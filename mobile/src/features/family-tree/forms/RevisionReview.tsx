import { Text, View } from "react-native";
import { SectionCard } from "../../../components/SectionCard";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import type { TreeState } from "../lib/workflows/treeWorkflow";
import { personFields, type Field } from "./payload";
import { dateLabel } from "../lib/workflows/view";
import type {
  FamilyTreePartialDate,
  FamilyTreeIdentityLink,
} from "@family-manager/family-api/models";
function fact(f: Field, value: unknown) {
  if (f.kind === "date")
    return dateLabel(value as FamilyTreePartialDate | null);
  if (Array.isArray(value))
    return (
      value
        .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
        .join(", ") || "Unknown"
    );
  return String(value ?? "Unknown");
}
function association(link: FamilyTreeIdentityLink | null | undefined) {
  if (!link) return "None";
  return `${link.label} · ${link.user_id !== null ? "parent account" : "child account"} · ${link.active ? "active" : "inactive"}`;
}
export function RevisionReview({ state }: { state: TreeState }) {
  const p = state.detail?.person;
  return (
    <SectionCard title="Updated records for review">
      <Text style={shellStyles.mutedText}>
        These are the latest saved facts. Your draft below has not been
        replaced.
      </Text>
      {state.pending?.action.type === "unlinkIdentity" ? (
        <View>
          <Text selectable style={shellStyles.mutedText}>
            Original association:{" "}
            {association(state.pending.action.originalLink)}
          </Text>
          <Text selectable style={shellStyles.mutedText}>
            Latest association: {association(state.detail?.identity_link)}
          </Text>
          <Text style={shellStyles.mutedText}>
            Reapply unlinks the currently shown association only; it never
            deletes a user or child account.
          </Text>
        </View>
      ) : null}
      {p ? (
        personFields.map((f) => (
          <View key={f.key}>
            <Text style={formStyles.fieldLabel}>{`Latest ${f.label}`}</Text>
            <Text selectable style={shellStyles.mutedText}>
              {fact(f, (p as unknown as Record<string, unknown>)[f.key])}
            </Text>
          </View>
        ))
      ) : (
        <Text style={shellStyles.mutedText}>
          No selected person; review the refreshed directory before adding a new
          person.
        </Text>
      )}
      {state.detail ? (
        <Text style={shellStyles.mutedText}>
          Latest relationship records:{" "}
          {state.detail.parent_links.length +
            state.detail.care_links.length +
            state.detail.partner_episodes.length}
        </Text>
      ) : null}
      {state.stories?.items.map((s) => (
        <Text key={s.id} selectable style={shellStyles.mutedText}>
          Latest story #{s.id}: {s.title} — {s.body_md}
        </Text>
      ))}
      {state.residences?.items.map((r) => (
        <Text key={r.id} selectable style={shellStyles.mutedText}>
          Latest residence #{r.id}: {r.place} ·{" "}
          {r.is_primary ? "Primary" : "Not primary"} · {dateLabel(r.start_date)}{" "}
          – {dateLabel(r.end_date)}
        </Text>
      ))}
      <Text style={shellStyles.mutedText}>
        Pending change:{" "}
        {state.pending?.action.type.replace(/([A-Z])/g, " $1").toLowerCase()}
      </Text>
    </SectionCard>
  );
}
