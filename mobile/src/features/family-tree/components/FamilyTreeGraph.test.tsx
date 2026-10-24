import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { ScrollView, StyleSheet } from "react-native";
import type { GraphInput } from "@family-manager/family-tree-core";
import { FamilyTreeGraph, type FamilyTreeGraphProps } from "./FamilyTreeGraph";
import { family } from "./testFixtures";
const props = (
  extra: Partial<FamilyTreeGraphProps> = {},
): FamilyTreeGraphProps => ({
  graph: family,
  focusPersonId: 1,
  graphRevision: 7,
  onSelectPerson: jest.fn(),
  onFocusPerson: jest.fn(),
  ...extra,
});
afterEach(() => {
  jest.restoreAllMocks();
});
describe("FamilyTreeGraph native presentation", () => {
  it("semantically disables network lens and person actions during an owned request", () => {
    const change = jest.fn();
    const select = jest.fn();
    const focus = jest.fn();
    const view = render(
      <FamilyTreeGraph
        {...props({
          loading: true,
          onOptionsChange: change,
          onSelectPerson: select,
          onFocusPerson: focus,
        })}
      />,
    );
    fireEvent.press(view.getByRole("button", { name: "Tree lens options" }));
    const history = view.getByRole("checkbox", {
      name: "Show historical partnerships",
    });
    expect(history.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(history);
    fireEvent.press(view.getByRole("button", { name: "Select Alex" }));
    fireEvent.press(view.getByRole("button", { name: "Show Alex in tree" }));
    expect(change).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });
  it("expands server-horizon counts and explicitly disables at production depth cap", () => {
    const graph: GraphInput = {
      nodes: [{ id: 1, label: "Frontier" }],
      edges: [],
    };
    const change = jest.fn();
    const p = props({
      graph,
      focusPersonId: 1,
      options: { ancestorDepth: 9, descendantDepth: 2 },
      onOptionsChange: change,
      maxDepth: 10,
      expansionCounts: { 1: { parents: 2, children: 0 } },
    });
    const view = render(<FamilyTreeGraph {...p} />);
    fireEvent.press(view.getByRole("button", { name: "Tree lens options" }));
    fireEvent.press(
      view.getByRole("button", { name: "Expand ancestors of Frontier" }),
    );
    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({ ancestorDepth: 10 }),
    );
    view.rerender(
      <FamilyTreeGraph
        {...p}
        options={{ ancestorDepth: 10, descendantDepth: 2 }}
      />,
    );
    expect(
      view.getByRole("button", { name: "Expand ancestors of Frontier" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    fireEvent.press(
      view.getByRole("button", { name: "Expand ancestors of Frontier" }),
    );
    expect(change).toHaveBeenCalledTimes(1);
    expect(view.getByText(/Maximum server depth: 10/)).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Relationship list" }));
    expect(
      view.getByRole("button", { name: "Expand ancestors of Frontier" }).props
        .accessibilityState.disabled,
    ).toBe(true);
  });
  it("publishes server lens changes and invalidates old continuation", () => {
    const onOptionsChange =
      jest.fn<
        (options: NonNullable<FamilyTreeGraphProps["options"]>) => void
      >();
    const onLoadMore = jest.fn();
    const p = props({
      onOptionsChange,
      onLoadMore,
      expansionToken: "old-lens",
    });
    const view = render(<FamilyTreeGraph {...p} />);
    fireEvent.press(view.getByRole("button", { name: "Tree lens options" }));
    fireEvent.press(
      view.getByRole("checkbox", { name: "Show historical partnerships" }),
    );
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        focusId: 1,
        showHistoricalPartners: true,
        includeCare: false,
      }),
    );
    expect(
      view.queryByRole("button", { name: "Load more relatives" }),
    ).toBeNull();
    const options = onOptionsChange.mock.calls[0][0];
    view.rerender(
      <FamilyTreeGraph {...p} options={options} expansionToken="new-lens" />,
    );
    expect(
      view.getByRole("checkbox", { name: "Show historical partnerships" }).props
        .accessibilityState.checked,
    ).toBe(true);
    fireEvent.press(view.getByRole("button", { name: "Load more relatives" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    fireEvent.press(
      view.getByRole("checkbox", { name: "Show care connections" }),
    );
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeCare: true }),
    );
    fireEvent.press(
      view.getByRole("button", { name: "Collapse descendants of Alex" }),
    );
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ collapsedDescendants: [1] }),
    );
  });
  it("fits a new focus only after fresh native measurements", () => {
    const scroll = jest
      .spyOn(ScrollView.prototype, "scrollTo")
      .mockImplementation(() => undefined);
    const p = props();
    const view = render(<FamilyTreeGraph {...p} />);
    fireEvent(view.getByTestId("family-tree-generation-0"), "layout", {
      nativeEvent: { layout: { x: 0, y: 20, width: 600, height: 300 } },
    });
    fireEvent(view.getByTestId("family-tree-position-1"), "layout", {
      nativeEvent: { layout: { x: 110, y: 0, width: 220, height: 260 } },
    });
    fireEvent(view.getByTestId("family-tree-position-3"), "layout", {
      nativeEvent: { layout: { x: 999, y: 0, width: 220, height: 260 } },
    });
    scroll.mockClear();
    view.rerender(<FamilyTreeGraph {...p} focusPersonId={3} />);
    expect(scroll).not.toHaveBeenCalled();
    fireEvent(view.getByTestId("family-tree-generation-0"), "layout", {
      nativeEvent: { layout: { x: 0, y: 400, width: 600, height: 300 } },
    });
    fireEvent(view.getByTestId("family-tree-position-3"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 260 } },
    });
    expect(scroll).toHaveBeenCalledWith(
      expect.objectContaining({ y: 400, animated: false }),
    );
    expect(scroll).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, animated: false }),
    );
  });
  it("renders entered facts and independent touch selection/focus actions", () => {
    const p = props();
    const view = render(<FamilyTreeGraph {...p} />);
    expect(view.getByText("Birth year 1984 (uncertain)")).toBeTruthy();
    expect(view.getAllByText("Birth year unknown").length).toBeGreaterThan(0);
    fireEvent.press(view.getByRole("button", { name: "Select Alex" }));
    fireEvent.press(view.getByRole("button", { name: "Show Alex in tree" }));
    expect(p.onSelectPerson).toHaveBeenCalledWith(1);
    expect(p.onFocusPerson).toHaveBeenCalledWith(1);
    expect(
      view.getByRole("button", { name: "Select Alex" }).props.accessibilityState
        .selected,
    ).toBe(true);
  });
  it("has explicit historical/care decisions and real filters", () => {
    const view = render(<FamilyTreeGraph {...props()} />);
    fireEvent.press(view.getByRole("button", { name: "Tree lens options" }));
    expect(view.queryByRole("button", { name: "Select Carer" })).toBeNull();
    expect(
      view.queryByRole("button", { name: "Select Past partner" }),
    ).toBeNull();
    const care = view.getByRole("checkbox", { name: "Show care connections" });
    expect(care.props.accessibilityState.checked).toBe(false);
    fireEvent.press(care);
    expect(view.getByRole("button", { name: "Select Carer" })).toBeTruthy();
    expect(view.getAllByText(/Guardian connection/).length).toBeGreaterThan(0);
    fireEvent.press(
      view.getByRole("checkbox", { name: "Show historical partnerships" }),
    );
    expect(
      view.getByRole("button", { name: "Select Past partner" }),
    ).toBeTruthy();
    expect(view.getAllByText(/Married · ended/).length).toBeGreaterThan(0);
    fireEvent.press(
      view.getByRole("checkbox", { name: "Show historical partnerships" }),
    );
    expect(
      view.queryByRole("button", { name: "Select Past partner" }),
    ).toBeNull();
  });
  it("provides a typed non-color legend and list-only navigation", () => {
    const view = render(<FamilyTreeGraph {...props({ focusPersonId: 3 })} />);
    fireEvent.press(view.getByRole("button", { name: "Relationship list" }));
    expect(view.queryByTestId("family-tree-row-graph")).toBeNull();
    expect(view.getByTestId("family-tree-relationship-list")).toBeTruthy();
    expect(
      view.getAllByText(/Recorded child through adoptive parent/).length,
    ).toBeGreaterThan(0);
    fireEvent.press(
      view.getByRole("button", { name: "Show relationship legend" }),
    );
    expect(
      view.getByText("Recorded co-parents (not a partnership) — solid"),
    ).toBeTruthy();
    expect(view.getByText("Recorded adoptive parent — double")).toBeTruthy();
  });
  it("collapses a directional route without erasing a shared descendant", () => {
    const graph: GraphInput = {
      nodes: [...family.nodes.slice(0, 3), { id: 6, label: "Root" }],
      edges: [
        ...family.edges.slice(0, 2),
        { id: 10, type: "parent", kind: "unknown", source: 6, target: 1 },
        { id: 11, type: "parent", kind: "unknown", source: 6, target: 2 },
      ],
    };
    const view = render(
      <FamilyTreeGraph {...props({ graph, focusPersonId: 6 })} />,
    );
    fireEvent.press(
      view.getByRole("button", { name: "Collapse descendants of Alex" }),
    );
    expect(view.getByRole("button", { name: "Select Child" })).toBeTruthy();
    expect(
      view.queryByText("Recorded biological parent → Child — solid"),
    ).toBeNull();
    expect(
      view.getByText(/Also connected through another branch/),
    ).toBeTruthy();
    fireEvent.press(
      view.getByRole("button", { name: "Expand descendants of Alex" }),
    );
    expect(
      view.getByText("Recorded biological parent → Child — solid"),
    ).toBeTruthy();
  });
  it("expands a depth-limited loaded branch locally", () => {
    const view = render(
      <FamilyTreeGraph {...props({ options: { descendantDepth: 0 } })} />,
    );
    expect(view.queryByRole("button", { name: "Select Child" })).toBeNull();
    fireEvent.press(
      view.getByRole("button", { name: "Expand descendants of Alex" }),
    );
    expect(view.getByRole("button", { name: "Select Child" })).toBeTruthy();
  });
  it("uses a recoverable list for corrupt cycles and invalid focus", () => {
    const cyclic: GraphInput = {
      nodes: family.nodes.slice(0, 3),
      edges: [
        ...family.edges.slice(0, 2),
        { id: 8, type: "parent", kind: "step", source: 3, target: 1 },
      ],
    };
    const view = render(<FamilyTreeGraph {...props({ graph: cyclic })} />);
    expect(view.getByTestId("family-tree-relationship-list")).toBeTruthy();
    expect(view.getByText(/Recorded parentage contains a cycle/)).toBeTruthy();
    expect(view.queryByRole("button", { name: "Fit" })).toBeNull();
    view.rerender(<FamilyTreeGraph {...props({ focusPersonId: 999 })} />);
    expect(
      view.getByText(/Select a person from the authorized directory/),
    ).toBeTruthy();
    expect(
      view.getByRole("button", { name: "Show Morgan in tree" }),
    ).toBeTruthy();
  });
  it("distinguishes empty/loading and never creates demo people", () => {
    const view = render(
      <FamilyTreeGraph {...props({ graph: { nodes: [], edges: [] } })} />,
    );
    expect(view.getByText("No people in this projection.")).toBeTruthy();
    expect(view.queryByRole("button", { name: "Select Alex" })).toBeNull();
    view.rerender(
      <FamilyTreeGraph
        {...props({ graph: { nodes: [], edges: [] }, loading: true })}
      />,
    );
    expect(view.getByText("Loading family tree…")).toBeTruthy();
    expect(view.queryByText("No people in this projection.")).toBeNull();
  });
  it("caps oversized input and offers only an operable continuation", () => {
    const graph: GraphInput = {
      nodes: Array.from({ length: 600 }, (_, i) => ({
        id: i + 1,
        label: `Person ${i + 1}`,
      })),
      edges: [],
    };
    const load = jest.fn();
    const p = props({ graph, expansionToken: "opaque", onLoadMore: load });
    const view = render(<FamilyTreeGraph {...p} />);
    expect(
      view.getAllByRole("button", { name: /^Select Person / }).length,
    ).toBeLessThanOrEqual(500);
    expect(view.getByText(/Projection is truncated/)).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Load more relatives" }));
    expect(load).toHaveBeenCalledTimes(1);
    view.rerender(<FamilyTreeGraph {...p} loading />);
    expect(
      view.getByRole("button", { name: "Load more relatives" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    fireEvent.press(view.getByRole("button", { name: "Load more relatives" }));
    expect(load).toHaveBeenCalledTimes(1);
    view.rerender(<FamilyTreeGraph {...p} onLoadMore={undefined} />);
    expect(
      view.queryByRole("button", { name: "Load more relatives" }),
    ).toBeNull();
  });
  it("preserves local filters and collapse across new arrays/revision", () => {
    const view = render(<FamilyTreeGraph {...props()} />);
    fireEvent.press(view.getByRole("button", { name: "Tree lens options" }));
    fireEvent.press(
      view.getByRole("checkbox", { name: "Show care connections" }),
    );
    fireEvent.press(
      view.getByRole("button", { name: "Collapse descendants of Alex" }),
    );
    view.rerender(
      <FamilyTreeGraph
        {...props({
          graph: { nodes: [...family.nodes], edges: [...family.edges] },
          graphRevision: 8,
        })}
      />,
    );
    expect(
      view.getByRole("checkbox", { name: "Show care connections" }).props
        .accessibilityState.checked,
    ).toBe(true);
    expect(
      view.getByRole("button", { name: "Expand descendants of Alex" }),
    ).toBeTruthy();
  });
  it("Fits measured focus but never scrolls for incidental revision/arrays", () => {
    const scroll = jest
      .spyOn(ScrollView.prototype, "scrollTo")
      .mockImplementation(() => undefined);
    const p = props();
    const view = render(<FamilyTreeGraph {...p} />);
    fireEvent(view.getByTestId("family-tree-generation-0"), "layout", {
      nativeEvent: { layout: { x: 0, y: 140, width: 600, height: 300 } },
    });
    fireEvent(view.getByTestId("family-tree-position-1"), "layout", {
      nativeEvent: { layout: { x: 280, y: 0, width: 220, height: 260 } },
    });
    fireEvent.press(view.getByRole("button", { name: "Fit" }));
    expect(scroll).toHaveBeenCalledWith(
      expect.objectContaining({ x: 280, animated: false }),
    );
    expect(scroll).toHaveBeenCalledWith(
      expect.objectContaining({ y: 140, animated: false }),
    );
    scroll.mockClear();
    view.rerender(
      <FamilyTreeGraph
        {...p}
        graph={{ nodes: [...family.nodes], edges: [...family.edges] }}
        graphRevision={8}
      />,
    );
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole("button", { name: "Fit" }));
    expect(scroll).toHaveBeenCalled();
  });
  it("preserves explicit cross-generation partnerships without flattening ancestry", () => {
    const graph: GraphInput = {
      nodes: family.nodes.slice(0, 3),
      edges: [
        ...family.edges.slice(0, 2),
        {
          id: 12,
          type: "partner",
          kind: "partners",
          status: "current",
          source: 1,
          target: 3,
        },
      ],
    };
    const view = render(<FamilyTreeGraph {...props({ graph })} />);
    expect(
      view.getAllByText(/cross-generation partnership/).length,
    ).toBeGreaterThan(0);
    expect(view.getByTestId("family-tree-generation-0")).toBeTruthy();
    expect(view.getByTestId("family-tree-generation-1")).toBeTruthy();
  });
  it("excludes archived/merged records and diagnoses malformed root input", () => {
    const graph: GraphInput = {
      ...family,
      nodes: [
        ...family.nodes,
        { id: 9, label: "Archived", archived: true },
        { id: 10, label: "Alias", mergedIntoId: 1 },
      ],
    };
    const view = render(
      <FamilyTreeGraph {...props({ graph, focusPersonId: null })} />,
    );
    expect(view.getByTestId("family-tree-relationship-list")).toBeTruthy();
    expect(view.queryByRole("button", { name: "Select Archived" })).toBeNull();
    expect(view.queryByRole("button", { name: "Select Alias" })).toBeNull();
    view.rerender(
      <FamilyTreeGraph {...props({ graph: null as unknown as GraphInput })} />,
    );
    expect(view.getByText("Person projection must be an array.")).toBeTruthy();
    expect(view.queryByRole("button", { name: "Select Alex" })).toBeNull();
  });
  it("honors supplied historical/care/collapse options and restores supplied collapse", () => {
    const onOptionsChange = jest.fn();
    const view = render(
      <FamilyTreeGraph
        {...props({
          options: {
            includeCare: true,
            showHistoricalPartners: true,
            collapsedDescendants: [1],
          },
          onOptionsChange,
        })}
      />,
    );
    expect(view.getByRole("button", { name: "Select Carer" })).toBeTruthy();
    expect(
      view.getByRole("button", { name: "Select Past partner" }),
    ).toBeTruthy();
    expect(view.queryByRole("button", { name: "Select Child" })).toBeNull();
    fireEvent.press(
      view.getByRole("button", { name: "Expand descendants of Alex" }),
    );
    expect(onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        collapsedDescendants: [],
        includeCare: true,
        showHistoricalPartners: true,
      }),
    );
    expect(view.getByRole("button", { name: "Select Child" })).toBeTruthy();
  });
  it("keeps handset viewport bounded and every native action touch sized", () => {
    const view = render(<FamilyTreeGraph {...props()} />);
    fireEvent.press(view.getByRole("button", { name: "Tree lens options" }));
    const viewport = StyleSheet.flatten(
      view.getByTestId("family-tree-viewport").props.style,
    );
    expect(viewport.height).toBeLessThanOrEqual(480);
    expect(viewport.overflow).toBe("hidden");
    for (const button of view.getAllByRole("button")) {
      const style = StyleSheet.flatten(
        typeof button.props.style === "function"
          ? button.props.style({ pressed: false })
          : button.props.style,
      );
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    }
    for (const checkbox of view.getAllByRole("checkbox"))
      expect(
        StyleSheet.flatten(checkbox.props.style).minHeight,
      ).toBeGreaterThanOrEqual(44);
  });
});
