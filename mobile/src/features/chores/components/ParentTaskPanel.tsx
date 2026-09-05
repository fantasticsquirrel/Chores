import { Text, View } from "react-native";

import type { Chore } from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { SectionCard } from "../../../components/SectionCard";
import { cardStyles } from "../../../styles/cards";
import { formStyles } from "../../../styles/forms";
import { shellStyles } from "../../../styles/shell";

export function ParentTaskPanel({
  onComplete,
  tasks,
}: {
  onComplete: (choreId: number) => Promise<void>;
  tasks: Chore[];
}) {
  return (
    <SectionCard subtitle="Money-free recurring chores" title="My To-Do List">
      {tasks.length === 0 ? (
        <Text style={shellStyles.mutedText}>No personal chores due.</Text>
      ) : (
        tasks.map((task) => (
          <View key={task.id} style={cardStyles.reviewItem}>
            <View style={shellStyles.splitRow}>
              <Text style={formStyles.rowTitle}>{task.name}</Text>
              <ActionButton
                compact
                label="Done"
                onPress={() => {
                  void onComplete(task.id);
                }}
                variant="secondary"
              />
            </View>
          </View>
        ))
      )}
    </SectionCard>
  );
}
