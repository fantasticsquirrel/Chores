import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FamilyTreeGraph } from "./FamilyTreeGraph";

const graph = {
  nodes: [
    { id: 1, label: "Older", birthDate: "1984" },
    { id: 2, label: "Younger", birthDate: "2001" },
    { id: 3, label: "Unknown" },
  ],
  edges: [
    { id: 1, type: "parent" as const, kind: "unknown" as const, source: 1, target: 2 },
    { id: 2, type: "parent" as const, kind: "unknown" as const, source: 1, target: 3 },
  ],
};
const props = { graph, focusPersonId: 1, graphRevision: 1, onSelectPerson: vi.fn(), onFocusPerson: vi.fn() };
const card = (name: string) => screen.getByRole("article", { name });

describe("actual web birth-band preferences", () => {
  it("shows non-color band labels and independent accents, with unknown pattern", () => {
    render(<FamilyTreeGraph {...props} />);
    expect(within(card("Older")).getByText("Birth band 1975–1999")).toBeVisible();
    expect(within(card("Younger")).getByText("Birth band 2000–2024")).toBeVisible();
    expect(card("Unknown")).toHaveClass("family-tree-person-unknown");
    expect(card("Older").style.getPropertyValue("--family-tree-accent-light")).not.toBe(
      card("Younger").style.getPropertyValue("--family-tree-accent-light"),
    );
    expect(screen.queryByText("Birth band 0–24")).not.toBeInTheDocument();
  });
  it("discloses usable validated custom accents and reset without changing lens or text/background", () => {
    const optionsChange = vi.fn();
    const view = render(<FamilyTreeGraph {...props} onOptionsChange={optionsChange} />);
    fireEvent.click(screen.getByText("Birth-band colors"));
    const field = screen.getByRole("textbox", { name: "Accent for birth band 1975–1999" });
    fireEvent.change(field, { target: { value: "#aBc" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply accent for birth band 1975–1999" }));
    expect(card("Older").style.getPropertyValue("--family-tree-accent-light")).toBe("#aabbcc");
    expect(card("Older").style.backgroundColor).toBe("");
    expect(card("Older").style.color).toBe("");
    fireEvent.change(field, { target: { value: "#fff; background:red" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply accent for birth band 1975–1999" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Use #RGB or #RRGGBB");
    expect(card("Older").style.getPropertyValue("--family-tree-accent-light")).toBe("#aabbcc");
    view.rerender(<FamilyTreeGraph {...props} graphRevision={9} graph={{ nodes: [...graph.nodes], edges: [...graph.edges] }} onOptionsChange={optionsChange} />);
    expect(card("Older").style.getPropertyValue("--family-tree-accent-light")).toBe("#aabbcc");
    fireEvent.click(screen.getByRole("button", { name: "Reset birth-band colors" }));
    expect(card("Older").style.getPropertyValue("--family-tree-accent-light")).not.toBe("#aabbcc");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const unknown = screen.getByRole("textbox", { name: "Accent for unknown birth year" });
    fireEvent.change(unknown, { target: { value: "#000" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply accent for unknown birth year" }));
    expect(card("Unknown").style.getPropertyValue("--family-tree-accent-light")).toBe("#000000");
    expect(card("Unknown")).toHaveClass("family-tree-person-unknown");
    expect(card("Older").style.getPropertyValue("--family-tree-accent-light")).not.toBe("#000000");
    fireEvent.click(screen.getByRole("button", { name: "Relationship list only" }));
    const list = screen.getByRole("region", { name: "Relationships" });
    expect(list).toHaveTextContent("Birth band 1975–1999");
    expect(within(list).getByRole("button", { name: "Select Unknown" }).closest("li")).toHaveClass("family-tree-person-unknown");
    expect(optionsChange).not.toHaveBeenCalled();
  });
});
