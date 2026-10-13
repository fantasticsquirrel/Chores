import type { ReactNode, RefObject } from "react";
import { useMemo } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import type { LayoutResult, ListRow } from "@family-manager/family-tree-core";
import { useTheme } from "../../../theme/ThemeContext";
import { generationRows } from "../lib/presentation/graphPresentation";

interface FamilyTreeViewportProps {
  layout: LayoutResult;
  isGraph: boolean;
  context: string;
  verticalRef: RefObject<ScrollView | null>;
  horizontalRef: RefObject<ScrollView | null>;
  renderCard: (row: ListRow) => ReactNode;
  onRowLayout: (row: number, y: number) => void;
  onPersonLayout: (id: number, x: number) => void;
}
/** Internal overflow lives in native scroll views, never in the screen shell. */
export function FamilyTreeViewport({
  layout,
  isGraph,
  context,
  verticalRef,
  horizontalRef,
  renderCard,
  onRowLayout,
  onPersonLayout,
}: FamilyTreeViewportProps) {
  const {
    definition: { colors },
  } = useTheme();
  const { height } = useWindowDimensions();
  const rows = useMemo(() => generationRows(layout), [layout]);
  const byId = useMemo(
    () => new Map(layout.list.map((row) => [row.node.id, row])),
    [layout],
  );
  return (
    <View
      testID="family-tree-viewport"
      style={{
        height: Math.max(160, Math.min(480, height * 0.55)),
        width: "100%",
        minWidth: 0,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: 16,
      }}
    >
      {isGraph ? (
        <ScrollView
          ref={verticalRef}
          testID="family-tree-row-graph"
          nestedScrollEnabled
          contentContainerStyle={{ padding: 12 }}
        >
          <ScrollView
            ref={horizontalRef}
            horizontal
            nestedScrollEnabled
            contentContainerStyle={{ gap: 12 }}
          >
            <View style={{ gap: 16 }}>
              {rows.map((group) => (
                <View
                  key={`${context}:${group.row}`}
                  testID={`family-tree-generation-${group.row}`}
                  onLayout={(event) =>
                    onRowLayout(group.row, event.nativeEvent.layout.y)
                  }
                  style={{ gap: 8 }}
                >
                  <Text
                    accessibilityRole="header"
                    style={{
                      fontSize: 16,
                      color: colors.text,
                      fontWeight: "700",
                    }}
                  >
                    Generation row {group.row}
                    {group.row === 0 ? " · Focus row" : ""}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    {group.nodes.map((item) => (
                      <View
                        key={item.node.id}
                        testID={`family-tree-position-${item.node.id}`}
                        onLayout={(event) =>
                          onPersonLayout(
                            item.node.id,
                            event.nativeEvent.layout.x,
                          )
                        }
                        style={{ width: 220 }}
                      >
                        {renderCard(byId.get(item.node.id)!)}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      ) : (
        <ScrollView
          testID="family-tree-relationship-list"
          nestedScrollEnabled
          contentContainerStyle={{ padding: 12, gap: 12 }}
        >
          {layout.list.map((row) => (
            <View key={row.node.id}>{renderCard(row)}</View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
