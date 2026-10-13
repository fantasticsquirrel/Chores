import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { birthBandAccent, birthYearPresentation } from "@family-manager/family-tree-core";
import { ThemeProvider, useTheme } from "../../../theme/ThemeContext";
import { FamilyTreeButton } from "./FamilyTreeControls";
import { FamilyTreeGraph } from "./FamilyTreeGraph";

const graph = {
  nodes: [{ id: 1, label: "Older", birthDate: "1984" }, { id: 2, label: "Younger", birthDate: "2001" }, { id: 3, label: "Unknown" }],
  edges: [
    { id: 1, type: "parent" as const, kind: "unknown" as const, source: 1, target: 2 },
    { id: 2, type: "parent" as const, kind: "unknown" as const, source: 1, target: 3 },
  ],
};
const props = { graph, focusPersonId: 1, graphRevision: 1, onSelectPerson: jest.fn(), onFocusPerson: jest.fn() };

function ThemeSwitch() {
  const { setTheme } = useTheme();
  return <FamilyTreeButton label="Use dark theme" onPress={() => setTheme("orbit-club")} />;
}
describe("actual native birth-band preferences", () => {
  it("resolves shared dark accents while preserving the theme surface and text", () => {
    const view = render(<ThemeProvider><ThemeSwitch /><FamilyTreeGraph {...props} /></ThemeProvider>);
    fireEvent.press(view.getByRole("button", { name: "Use dark theme" }));
    const accent = birthBandAccent(birthYearPresentation("1984").bucket);
    expect(StyleSheet.flatten(view.getByTestId("family-tree-birth-accent-1").props.style).borderLeftColor).toBe(accent.dark);
    expect(StyleSheet.flatten(view.getByTestId("family-tree-person-1").props.style).backgroundColor).toBe("#2c2849");
    expect(StyleSheet.flatten(view.getByText("Birth year 1984").props.style).color).toBe("#d5cee7");
  });
  it("uses band labels/accents distinct from generation, and dashed unknown", () => {
    const view = render(<FamilyTreeGraph {...props} />);
    expect(view.getByText("Birth band 1975–1999")).toBeTruthy();
    expect(view.getByText("Birth band 2000–2024")).toBeTruthy();
    const style = (id: number) => StyleSheet.flatten(view.getByTestId(`family-tree-birth-accent-${id}`).props.style);
    expect(style(1).borderLeftColor).not.toBe(style(2).borderLeftColor);
    expect(style(3).borderStyle).toBe("dashed");
    expect(view.queryByText("Birth band 0–24")).toBeNull();
  });
  it("validates accents, keeps readable theme colors and targets, preserves refresh, resets", () => {
    const optionsChange = jest.fn();
    const view = render(<FamilyTreeGraph {...props} onOptionsChange={optionsChange} />);
    fireEvent.press(view.getByRole("button", { name: "Show birth-band colors" }));
    const field = view.getByLabelText("Accent for birth band 1975–1999");
    expect(StyleSheet.flatten(field.props.style).minHeight).toBeGreaterThanOrEqual(44);
    const before = StyleSheet.flatten(view.getByTestId("family-tree-person-1").props.style);
    fireEvent.changeText(field, "#aBc");
    fireEvent.press(view.getByRole("button", { name: "Apply accent for birth band 1975–1999" }));
    const accent = () => StyleSheet.flatten(view.getByTestId("family-tree-birth-accent-1").props.style);
    expect(accent().borderLeftColor).toBe("#aabbcc");
    expect(StyleSheet.flatten(view.getByTestId("family-tree-person-1").props.style).backgroundColor).toBe(before.backgroundColor);
    fireEvent.changeText(field, "transparent");
    fireEvent.press(view.getByRole("button", { name: "Apply accent for birth band 1975–1999" }));
    expect(view.getByText(/Use #RGB or #RRGGBB/)).toBeTruthy();
    expect(accent().borderLeftColor).toBe("#aabbcc");
    view.rerender(<FamilyTreeGraph {...props} graphRevision={9} graph={{ nodes: [...graph.nodes], edges: [...graph.edges] }} onOptionsChange={optionsChange} />);
    expect(accent().borderLeftColor).toBe("#aabbcc");
    fireEvent.press(view.getByRole("button", { name: "Reset birth-band colors" }));
    expect(accent().borderLeftColor).not.toBe("#aabbcc");
    expect(view.queryByText(/Use #RGB or #RRGGBB/)).toBeNull();
    fireEvent.changeText(view.getByLabelText("Accent for unknown birth year"), "#000");
    fireEvent.press(view.getByRole("button", { name: "Apply accent for unknown birth year" }));
    const unknown = StyleSheet.flatten(view.getByTestId("family-tree-birth-accent-3").props.style);
    expect(unknown.borderLeftColor).toBe("#000000");
    expect(unknown.borderStyle).toBe("dashed");
    expect(accent().borderLeftColor).not.toBe("#000000");
    fireEvent.press(view.getByRole("button", { name: "Relationship list" }));
    expect(view.getByTestId("family-tree-relationship-list")).toBeTruthy();
    expect(view.getByText("Birth band 1975–1999")).toBeTruthy();
    expect(optionsChange).not.toHaveBeenCalled();
    for (const button of view.getAllByRole("button")) {
      expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});
