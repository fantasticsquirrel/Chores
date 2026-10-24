import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FractionFeastSimulation } from "./FractionFeastSimulation";
import { PatternPalaceSimulation } from "./PatternPalaceSimulation";
import { CaravanSimulation } from "./CaravanSimulation";
import { PollinatorSimulation } from "./PollinatorSimulation";
import { ChanceCarnivalSimulation } from "./ChanceCarnivalSimulation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const change = (label: string, value: number | string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("fractions, patterns, trade, pollination and chance", () => {
  it.each([
    ["fractions", FractionFeastSimulation],
    ["patterns", PatternPalaceSimulation],
    ["caravans", CaravanSimulation],
    ["pollination", PollinatorSimulation],
    ["chance", ChanceCarnivalSimulation],
  ])(
    "makes %s usable without motion, with an accessible result",
    (_name, Component) => {
      render(<Component />);
      expect(screen.getAllByRole("img")[0]).toHaveAccessibleName();
      expect(screen.getByRole("status")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Pause motion" })).toBeNull();
    },
  );

  it("splits fractions without changing area, then combines unlike denominators", () => {
    render(<FractionFeastSimulation />);
    expect(screen.getByRole("status")).toHaveTextContent("1/2 = 2/4");
    fireEvent.click(screen.getByRole("button", { name: "Split every slice" }));
    expect(screen.getByRole("status")).toHaveTextContent("2/4 = 2/4");
    change("Equal parts in this whole", 3);
    change("Selected slices", 2);
    fireEvent.click(screen.getByRole("button", { name: "Plate B" }));
    change("Selected slices", 3);
    fireEvent.click(screen.getByRole("button", { name: "Combine slices" }));
    expect(screen.getByRole("status")).toHaveTextContent("17/12 wholes");
    expect(
      screen.getByRole("img", { name: "Combined area equals 17/12 wholes" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("status")).toHaveTextContent("1/2 = 2/4");
  });

  it("shows a real gap and overlap rather than claiming pentagons tile", () => {
    render(<PatternPalaceSimulation />);
    expect(screen.getByRole("status")).toHaveTextContent("36° gap");
    change("Tiles around one point", 4);
    expect(screen.getByRole("status")).toHaveTextContent("72° overlap");
    change("Regular tile shape", 4);
    expect(screen.getByRole("status")).toHaveTextContent("360°: an exact fit");
    change("Motif rotation", 90);
    fireEvent.click(screen.getByLabelText("Reflect left to right"));
    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("rotated 90 degrees and reflected"),
    );
  });

  it("recalculates seasonal travel and resolves a supply shortfall", () => {
    render(<CaravanSimulation />);
    expect(screen.getByRole("status")).toHaveTextContent("8 travel days");
    change("Season", "dry");
    expect(screen.getByRole("status")).toHaveTextContent(
      "4 more supply days needed",
    );
    fireEvent.click(screen.getByRole("button", { name: "Pack enough days" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Enough supplies and carrying capacity",
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 grain units spoil");
    change("Cargo", "pottery");
    change("Cargo units", 10);
    change("Supply days packed", 20);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Over the 100 kg carrying limit",
    );
  });

  it("distinguishes compatible transfer from visits and makes habitat consequential", () => {
    render(<PollinatorSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Visit Gold 1" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Compatible transfers: 0",
    );
    fireEvent.click(screen.getByRole("button", { name: "Visit Gold 2" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Compatible transfers: 1",
    );
    fireEvent.click(screen.getByRole("button", { name: "Visit Gold 3" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "beyond the bee's flight reach",
    );
    fireEvent.click(screen.getByLabelText("Add habitat patches"));
    for (const name of ["Gold 1", "Gold 2", "Gold bridge", "Gold 3"])
      fireEvent.click(screen.getByRole("button", { name: `Visit ${name}` }));
    expect(screen.getByRole("status")).toHaveTextContent("Flower visits: 4");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Compatible transfers: 3",
    );
  });

  it("runs 10000 actual weighted trials and clears stale samples after edits", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    render(<ChanceCarnivalSimulation />);
    change("Trials in next batch", 10000);
    fireEvent.click(screen.getByRole("button", { name: "Run trials" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Trials recorded: 10,000",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Outcome 1: theory 25.0% · observed 10000 (100.0%)",
    );
    change("Outcome 1 weight", 2);
    expect(screen.getByRole("status")).toHaveTextContent("Trials recorded: 0");
    expect(screen.getByRole("status")).toHaveTextContent("Unequal chances");
    change("Chance device", "die");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Outcome 6: theory 16.7%",
    );
  });
});
