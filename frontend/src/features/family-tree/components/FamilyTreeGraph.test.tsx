import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { layoutGraph, type GraphInput } from "@family-manager/family-tree-core";
import { FamilyTreeGraph, type FamilyTreeGraphProps } from "./FamilyTreeGraph";

const graph: GraphInput = {
  nodes: [
    { id: 1, label: "Alex", birthDate: "1980" },
    { id: 2, label: "Sam" },
    { id: 3, label: "River", birthDate: { value: "2010", uncertain: true } },
    { id: 4, label: "Pat" },
    { id: 5, label: "Jo" },
  ],
  edges: [
    { id: 1, type: "parent", kind: "biological", source: 1, target: 3 },
    {
      id: 2,
      type: "parent",
      kind: "adoptive",
      source: 2,
      target: 3,
      metadata: { source: "record" },
    },
    { id: 1, type: "care", kind: "guardian", source: 4, target: 3 },
    {
      id: 1,
      type: "partner",
      kind: "partners",
      status: "ended",
      source: 1,
      target: 5,
    },
  ],
};
function props(
  overrides: Partial<FamilyTreeGraphProps> = {},
): FamilyTreeGraphProps {
  return {
    graph,
    focusPersonId: 3,
    graphRevision: 1,
    onSelectPerson: vi.fn(),
    onFocusPerson: vi.fn(),
    ...overrides,
  };
}
function list() {
  return screen.getByRole("region", { name: "Relationships" });
}
function tree() {
  return screen.getByRole("region", { name: "Tree viewport" });
}

describe("FamilyTreeGraph with the real bounded pure core", () => {
  it("renders core typed routes, distinct patterns, qualified co-parent legend and unknown birth years", () => {
    render(<FamilyTreeGraph {...props()} />);
    const actual = layoutGraph(graph, {
      focusId: 3,
      includePartners: true,
      showHistoricalPartners: false,
    });
    expect(tree().querySelectorAll("[data-edge-key]")).toHaveLength(
      actual.routes.length,
    );
    expect(tree().querySelector('[data-edge-key="parent:2"]')).toHaveAttribute(
      "data-pattern",
      "double",
    );
    expect(tree().querySelector('[data-edge-key="parent:1"]')).toHaveAttribute(
      "data-pattern",
      "solid",
    );
    expect(
      within(tree()).getByRole("button", { name: "Select Sam" }),
    ).toBeVisible();
    expect(within(list()).getByText("Birth year unknown")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Relationship legend" }),
    ).toHaveTextContent("Recorded co-parents (not a partnership)");
    expect(list()).not.toHaveTextContent("Married");
    expect(
      tree().querySelector('[data-junction-id="coparents:3"]'),
    ).toBeInTheDocument();
  });

  it("places same-row typed edge labels outside the person cards rather than underneath them", () => {
    render(
      <FamilyTreeGraph
        {...props({
          options: { includeCare: true, showHistoricalPartners: true },
        })}
      />,
    );
    const partnerLabel = tree().querySelector(
      '[data-edge-key="partner:1"] text',
    )!;
    const careLabel = tree().querySelector('[data-edge-key="care:1"] text')!;
    const alex = tree().querySelector<HTMLElement>(
      'article[aria-label="Alex"]',
    )!;
    const river = tree().querySelector<HTMLElement>(
      'article[aria-label="River"]',
    )!;
    expect(Number(partnerLabel.getAttribute("y"))).toBeLessThan(
      parseFloat(alex.style.top),
    );
    expect(Number(careLabel.getAttribute("y"))).toBeLessThan(
      parseFloat(river.style.top),
    );
    expect(partnerLabel).toHaveTextContent("Partners · ended");
    expect(careLabel).toHaveTextContent("Guardian connection");
  });

  it("keeps web cards separated with small layout gaps and uses a safe list for invalid collapse options", () => {
    const p = props({ options: { rowGap: 1, columnGap: 1 } });
    const { rerender } = render(<FamilyTreeGraph {...p} />);
    const alex = tree().querySelector<HTMLElement>(
      'article[aria-label="Alex"]',
    )!;
    const sam = tree().querySelector<HTMLElement>('article[aria-label="Sam"]')!;
    const river = tree().querySelector<HTMLElement>(
      'article[aria-label="River"]',
    )!;
    expect(
      Math.abs(parseFloat(sam.style.left) - parseFloat(alex.style.left)),
    ).toBeGreaterThanOrEqual(216);
    expect(
      Math.abs(parseFloat(river.style.top) - parseFloat(alex.style.top)),
    ).toBeGreaterThanOrEqual(260);
    rerender(
      <FamilyTreeGraph
        {...p}
        options={
          {
            collapsedAncestors: {},
          } as unknown as FamilyTreeGraphProps["options"]
        }
      />,
    );
    expect(
      screen.queryByRole("region", { name: "Tree viewport" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Invalid bounded collapse identifiers",
    );
    expect(list()).toHaveTextContent("Alex");
  });

  it("supports selection and directory focus without conflating callbacks", () => {
    const p = props();
    render(<FamilyTreeGraph {...p} />);
    fireEvent.click(
      within(list()).getByRole("button", { name: "Select Alex" }),
    );
    expect(p.onSelectPerson).toHaveBeenCalledWith(1);
    expect(p.onFocusPerson).not.toHaveBeenCalled();
    fireEvent.click(
      within(list()).getByRole("button", { name: "Show Alex in tree" }),
    );
    expect(p.onFocusPerson).toHaveBeenCalledWith(1);
  });

  it("has operable care/history filters and an accessible list-only mode", () => {
    render(<FamilyTreeGraph {...props()} />);
    expect(
      within(list()).queryByRole("button", { name: "Select Pat" }),
    ).not.toBeInTheDocument();
    expect(
      within(list()).queryByRole("button", { name: "Select Jo" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Care connections" }));
    expect(list()).toHaveTextContent("Guardian connection");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Historical partnerships" }),
    );
    expect(list()).toHaveTextContent("Partners · ended");
    fireEvent.click(
      screen.getByRole("button", { name: "Relationship list only" }),
    );
    expect(
      screen.queryByRole("region", { name: "Tree viewport" }),
    ).not.toBeInTheDocument();
    expect(
      within(list()).getByRole("button", { name: "Select River" }),
    ).toBeVisible();
  });

  it("honors external filters and updates them on new options without stale overrides", () => {
    const p = props({
      options: { includeCare: true, showHistoricalPartners: true },
    });
    const { rerender } = render(<FamilyTreeGraph {...p} />);
    expect(list()).toHaveTextContent("Guardian connection");
    expect(list()).toHaveTextContent("Partners · ended");
    rerender(
      <FamilyTreeGraph
        {...p}
        options={{ includeCare: false, showHistoricalPartners: false }}
      />,
    );
    expect(list()).not.toHaveTextContent("Guardian connection");
    expect(list()).not.toHaveTextContent("Partners · ended");
  });

  it("collapses and expands a branch using the actual core and hides collapsed routes", () => {
    render(<FamilyTreeGraph {...props({ focusPersonId: 1 })} />);
    fireEvent.click(
      within(tree()).getByRole("button", {
        name: "Collapse descendants of Alex",
      }),
    );
    expect(
      within(list()).queryByRole("button", { name: "Select River" }),
    ).not.toBeInTheDocument();
    expect(
      tree().querySelector('[data-edge-key="parent:1"]'),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(tree()).getByRole("button", {
        name: "Expand descendants of Alex",
      }),
    );
    expect(
      within(list()).getByRole("button", { name: "Select River" }),
    ).toBeVisible();
  });

  it("does not offer a dead collapse action for ancestry hidden behind care-only context", () => {
    const context: GraphInput = {
      nodes: [...graph.nodes, { id: 6, label: "Outside lens" }],
      edges: [
        ...graph.edges,
        { id: 3, type: "parent", kind: "biological", source: 4, target: 6 },
      ],
    };
    render(
      <FamilyTreeGraph
        {...props({ graph: context, options: { includeCare: true } })}
      />,
    );
    expect(
      within(tree()).getByRole("button", { name: "Select Pat" }),
    ).toBeVisible();
    expect(
      within(tree()).queryByRole("button", {
        name: "Collapse descendants of Pat",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(list()).queryByRole("button", { name: "Select Outside lens" }),
    ).not.toBeInTheDocument();
  });

  it("offers depth expansion only when more recorded ancestors are available", () => {
    render(<FamilyTreeGraph {...props({ options: { ancestorDepth: 0 } })} />);
    expect(
      within(list()).queryByRole("button", { name: "Select Alex" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(tree()).getByRole("button", {
        name: "Show more ancestors of River (2)",
      }),
    );
    expect(
      within(list()).getByRole("button", { name: "Select Alex" }),
    ).toBeVisible();
  });

  it("retains manual zoom/pan through equivalent arrays and revision refreshes until explicit Fit or context change", () => {
    const p = props();
    const { rerender } = render(<FamilyTreeGraph {...p} />);
    const canvas = () => tree().querySelector("[data-tree-transform]")!;
    const initial = canvas().getAttribute("style");
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Pan right" }));
    const manual = canvas().getAttribute("style");
    expect(manual).not.toBe(initial);
    rerender(
      <FamilyTreeGraph
        {...p}
        graph={{
          nodes: graph.nodes.map((n) => ({ ...n })),
          edges: graph.edges.map((e) => ({ ...e })),
        }}
        graphRevision={7}
      />,
    );
    expect(canvas().getAttribute("style")).toBe(manual);
    fireEvent.click(screen.getByRole("button", { name: "Fit tree" }));
    expect(canvas().getAttribute("style")).toBe(initial);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    rerender(<FamilyTreeGraph {...p} focusPersonId={1} />);
    expect(canvas().getAttribute("style")).not.toBe(manual);
  });

  it("supports keyboard pan/zoom while leaving card buttons to native keyboard behavior", () => {
    render(<FamilyTreeGraph {...props()} />);
    const canvas = () =>
      tree().querySelector("[data-tree-transform]")!.getAttribute("style");
    const initial = canvas();
    fireEvent.keyDown(tree(), { key: "ArrowRight" });
    expect(canvas()).not.toBe(initial);
    const panned = canvas();
    fireEvent.keyDown(
      within(tree()).getByRole("button", { name: "Select Alex" }),
      { key: "ArrowLeft" },
    );
    expect(canvas()).toBe(panned);
    fireEvent.keyDown(tree(), { key: "+" });
    expect(canvas()).not.toBe(panned);
    fireEvent.keyDown(tree(), { key: "Home" });
    expect(canvas()).toBe(initial);
  });

  it("distinguishes loading, empty, missing focus and safe corrupt-cycle fallback", () => {
    const p = props();
    const { rerender } = render(
      <FamilyTreeGraph {...p} graph={{ nodes: [], edges: [] }} loading />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading family tree");
    expect(
      screen.queryByText("No active people in this projection."),
    ).not.toBeInTheDocument();
    rerender(<FamilyTreeGraph {...p} graph={{ nodes: [], edges: [] }} />);
    expect(
      screen.getByText("No active people in this projection."),
    ).toBeVisible();
    rerender(<FamilyTreeGraph {...p} focusPersonId={null} />);
    expect(
      screen.getByText(/Select a person from the authorized directory/),
    ).toBeVisible();
    expect(
      within(list()).getByRole("button", { name: "Show Pat in tree" }),
    ).toBeVisible();
    const cyclic: GraphInput = {
      nodes: graph.nodes.slice(0, 2),
      edges: [
        { id: 1, type: "parent", kind: "unknown", source: 1, target: 2 },
        { id: 2, type: "parent", kind: "step", source: 2, target: 1 },
      ],
    };
    rerender(<FamilyTreeGraph {...p} graph={cyclic} focusPersonId={1} />);
    expect(
      screen.queryByRole("region", { name: "Tree viewport" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Recorded parentage contains a cycle",
    );
    expect(
      within(list()).getByRole("button", { name: "Select Alex" }),
    ).toBeVisible();
  });

  it("enforces node/edge ceilings and only offers caller-owned continuation when operable", () => {
    const dense: GraphInput = {
      nodes: Array.from({ length: 600 }, (_, i) => ({
        id: i + 1,
        label: `Person ${i + 1}`,
      })),
      edges: [],
    };
    const p = props({
      graph: dense,
      focusPersonId: 1,
      options: { limits: { maxNodes: 500 } },
      expansionToken: "next",
      onLoadMore: vi.fn(),
    });
    const { rerender } = render(<FamilyTreeGraph {...p} />);
    expect(
      within(list()).getAllByRole("button", { name: /^Select Person/ }),
    ).toHaveLength(500);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Projection is bounded",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Load more people and relationships",
      }),
    );
    expect(p.onLoadMore).toHaveBeenCalledTimes(1);
    rerender(<FamilyTreeGraph {...p} loading />);
    expect(
      screen.getByRole("button", {
        name: "Load more people and relationships",
      }),
    ).toBeDisabled();
    rerender(<FamilyTreeGraph {...p} onLoadMore={undefined} />);
    expect(
      screen.queryByRole("button", {
        name: "Load more people and relationships",
      }),
    ).not.toBeInTheDocument();
  }, 30000);

  it("delegates controlled lens changes to caller without pretending omitted server facts are loaded", () => {
    const change = vi.fn();
    const p = props({
      onOptionsChange: change,
      options: { includeCare: false, showHistoricalPartners: false },
    });
    const { rerender } = render(<FamilyTreeGraph {...p} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Care connections" }));
    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({
        includeCare: true,
        showHistoricalPartners: false,
        focusId: 3,
      }),
    );
    expect(list()).not.toHaveTextContent("Guardian connection");
    rerender(<FamilyTreeGraph {...p} options={change.mock.lastCall![0]} />);
    expect(list()).toHaveTextContent("Guardian connection");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Historical partnerships" }),
    );
    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({
        includeCare: true,
        showHistoricalPartners: true,
      }),
    );
    expect(list()).not.toHaveTextContent("Partners · ended");
    fireEvent.click(
      within(tree()).getByRole("button", {
        name: "Collapse ancestors of River",
      }),
    );
    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({ collapsedAncestors: [3] }),
    );
    expect(
      tree().querySelector('[data-edge-key="parent:1"]'),
    ).toBeInTheDocument();
  });

  it("retains a shared descendant through an open branch but never redraws a collapsed directional fact", () => {
    const shared: GraphInput = {
      nodes: graph.nodes.slice(0, 3),
      edges: [
        graph.edges[0],
        graph.edges[1],
        {
          id: 2,
          type: "partner",
          kind: "partners",
          status: "current",
          source: 1,
          target: 2,
        },
      ],
    };
    render(<FamilyTreeGraph {...props({ graph: shared, focusPersonId: 3 })} />);
    fireEvent.click(
      within(tree()).getByRole("button", {
        name: "Collapse descendants of Alex",
      }),
    );
    expect(
      within(list()).getByRole("button", { name: "Select River" }),
    ).toBeVisible();
    expect(
      tree().querySelector('[data-edge-key="parent:1"]'),
    ).not.toBeInTheDocument();
    expect(
      tree().querySelector('[data-edge-key="parent:2"]'),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Also connected through another branch",
    );
  });

  it("supports pointer/touch drag, ends drag on cancellation and does not drag from buttons", () => {
    render(<FamilyTreeGraph {...props()} />);
    const canvas = () =>
      tree().querySelector("[data-tree-transform]")!.getAttribute("style");
    function pointer(target: HTMLElement, type: string, x: number, y: number) {
      const event = new MouseEvent(type, {
        bubbles: true,
        button: 0,
        clientX: x,
        clientY: y,
      });
      Object.defineProperty(event, "pointerId", { value: 1 });
      Object.defineProperty(event, "pointerType", { value: "touch" });
      fireEvent(target, event);
    }
    const initial = canvas();
    pointer(tree(), "pointerdown", 20, 30);
    pointer(tree(), "pointermove", 70, 80);
    const moved = canvas();
    expect(moved).not.toBe(initial);
    pointer(tree(), "pointercancel", 70, 80);
    pointer(tree(), "pointermove", 90, 90);
    expect(canvas()).toBe(moved);
    pointer(
      within(tree()).getByRole("button", { name: "Select Alex" }),
      "pointerdown",
      0,
      0,
    );
    pointer(tree(), "pointermove", 40, 40);
    expect(canvas()).toBe(moved);
  });

  it("enforces edge ceilings, rejects malformed records safely and excludes archived/merged aliases", () => {
    const edges = Array.from({ length: 1100 }, (_, i) => ({
      id: i + 1,
      type: "care" as const,
      kind: "caregiver" as const,
      source: 1,
      target: 2,
    }));
    const p = props({
      graph: { nodes: graph.nodes.slice(0, 2), edges },
      focusPersonId: 1,
      options: { includeCare: true },
    });
    const { rerender } = render(<FamilyTreeGraph {...p} />);
    expect(
      screen.queryByRole("region", { name: "Tree viewport" }),
    ).not.toBeInTheDocument();
    expect(within(list()).getAllByText("Caregiver connection")).toHaveLength(
      1000,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Edge projection limit reached",
    );
    const malformed = {
      nodes: [null, { id: 1, label: "Alex" }],
      edges: [null],
    } as unknown as GraphInput;
    rerender(<FamilyTreeGraph {...p} graph={malformed} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Invalid person record",
    );
    expect(list()).toHaveTextContent("Alex");
    rerender(
      <FamilyTreeGraph
        {...p}
        graph={{
          nodes: [
            { id: 1, label: "Alex" },
            { id: 2, label: "Archived", archived: true },
            { id: 3, label: "Alias", mergedIntoId: 1 },
          ],
          edges: [],
        }}
      />,
    );
    expect(
      within(list()).queryByRole("button", { name: "Select Archived" }),
    ).not.toBeInTheDocument();
    expect(
      within(list()).queryByRole("button", { name: "Select Alias" }),
    ).not.toBeInTheDocument();
  }, 30000);

  it("keeps invalid dates and cross-generation partnerships explicitly labeled in fallback/list output", () => {
    const p = props({
      graph: {
        nodes: [{ id: 1, label: "Unknown", birthDate: "bad" }],
        edges: [],
      },
      focusPersonId: 1,
    });
    const { rerender } = render(<FamilyTreeGraph {...p} />);
    expect(list()).toHaveTextContent(
      "Birth date invalid; review recorded value",
    );
    const crossed: GraphInput = {
      nodes: graph.nodes.slice(0, 3),
      edges: [
        graph.edges[0],
        {
          id: 2,
          type: "partner",
          kind: "civil_union",
          status: "current",
          source: 1,
          target: 3,
        },
      ],
    };
    rerender(<FamilyTreeGraph {...p} graph={crossed} />);
    expect(tree()).toHaveTextContent("cross-generation partnership");
    expect(list()).toHaveTextContent("Civil union · current");
  });
});
