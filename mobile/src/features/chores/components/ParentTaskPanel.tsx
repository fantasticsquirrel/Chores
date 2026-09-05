import { Text, View } from "react-native";

import type { Chore } from "../../../api/models";
import { ActionButton } from "../../../components/ActionButton";
import { SectionCard } from "../../../components/SectionCard";
import { styles } from "../../../styles/layout";

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
        <Text style={styles.mutedText}>No personal chores due.</Text>
      ) : (
        tasks.map((task) => (
          <View key={task.id} style={styles.reviewItem}>
            <View style={styles.splitRow}>
              <Text style={styles.rowTitle}>{task.name}</Text>
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
