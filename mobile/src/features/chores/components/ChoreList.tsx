import { Text, View } from "react-native";

import type { Child, Chore } from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { InlineNotice } from "../../../components/InlineNotice";
import { LoadingRow } from "../../../components/LoadingRow";
import { SectionCard } from "../../../components/SectionCard";
import { cardStyles } from "../../../styles/cards";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";
import { choreStyles } from "../styles";
import type { ChoresState } from "../hooks/useChoreData";
import {
  completionLabel,
  eligibilityLabel,
  rewardLabel,
  scheduleLabel,
  timingLabel,
} from "../lib/chorePresentation";

export function ChoreList({
  archivingId,
  children,
  choresState,
  onArchive,
  onEdit,
}: {
  archivingId: number | null;
  children: Child[];
  choresState: ChoresState;
  onArchive: (chore: Chore) => void;
  onEdit: (chore: Chore) => void;
}) {
  return (
    <SectionCard title="All Chores">
      {choresState.loading ? <LoadingRow label="Loading chores" /> : null}
      {choresState.error !== null ? (
        <InlineNotice
          tone="error"
          message={`Could not load chores: ${choresState.error}`}
        />
      ) : null}
      {!choresState.loading && choresState.chores.length === 0 ? (
        <Text style={shellStyles.mutedText}>No chores have been created yet.</Text>
      ) : null}
      {choresState.chores.map((chore) => (
        <ChoreCard
          archiving={archivingId === chore.id}
          chore={chore}
          children={children}
          key={chore.id}
          onArchive={onArchive}
          onEdit={onEdit}
        />
      ))}
    </SectionCard>
  );
}

export function ChoreCard({
  archiving,
  chore,
  children,
  onArchive,
  onEdit,
}: {
  archiving: boolean;
  chore: Chore;
  children: Child[];
  onArchive: (chore: Chore) => void;
  onEdit: (chore: Chore) => void;
}) {
  const timing = timingLabel(chore);
  return (
    <View style={cardStyles.reviewItem}>
      <Text style={formStyles.rowTitle}>{chore.name}</Text>
      <Text style={formStyles.rowMeta}>
        {scheduleLabel(chore)} · {completionLabel(chore)}
      </Text>
      <Text style={formStyles.rowMeta}>{rewardLabel(chore)}</Text>
      {chore.owner_user_id === null ? (
        <Text style={formStyles.rowMeta}>{eligibilityLabel(chore, children)}</Text>
      ) : null}
      {timing.length > 0 ? <Text style={formStyles.rowMeta}>{timing}</Text> : null}
      {chore.archived_at !== null ? (
        <Text style={[formStyles.rowMeta, choreStyles.dangerText]}>Archived</Text>
      ) : null}
      <View style={formStyles.inlineButtons}>
        <ActionButton
          compact
          label="Edit"
          onPress={() => onEdit(chore)}
          variant="secondary"
        />
        {chore.archived_at === null ? (
          <ActionButton
            compact
            disabled={archiving}
            label={archiving ? "Archiving" : "Archive"}
            onPress={() => onArchive(chore)}
            variant="danger"
          />
        ) : null}
      </View>
    </View>
  );
}
