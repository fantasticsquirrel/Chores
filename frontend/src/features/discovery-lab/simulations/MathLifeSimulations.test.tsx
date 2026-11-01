import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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
    fireEvent.click(screen.getByText("Open controls"));
    change("Trials to add", 10000);
    fireEvent.click(screen.getByRole("button", { name: "Add trials" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Equal chances · 10,000 trials",
    );
    expect(
      screen.getByRole("button", { name: "Inspect outcome 1" }),
    ).toHaveTextContent("10,000 draws100.0% · expected 25.0%");
    change("Outcome 1 weight", 2);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Weighted chances · 0 trials",
    );
    change("Device", "die");
    expect(
      screen.getByRole("button", { name: "Inspect outcome 6" }),
    ).toHaveTextContent("— · expected 16.7%");
  });

  it("gates a fair controlled comparison on prediction and preserves both samples", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    render(<ChanceCarnivalSimulation />);

    const smallRun = screen.getByRole("button", {
      name: "Run 12 trials",
    });
    expect(smallRun).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Counts can differ" }));
    expect(smallRun).toBeEnabled();
    fireEvent.click(smallRun);

    expect(
      screen.getByTestId("chance-challenge-one-feedback"),
    ).toHaveTextContent("Each fair draw is 25%");
    const recent = within(
      screen.getByTestId("chance-recent-outcomes"),
    ).getAllByRole("listitem");
    expect(recent).toHaveLength(12);
    for (const outcome of recent) expect(outcome).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Run 1,200 trials" }));
    const comparison = screen.getByTestId("chance-sample-comparison");
    expect(comparison).toHaveTextContent("12 trials");
    expect(comparison).toHaveTextContent("1,200 trials");
    expect(comparison).toHaveTextContent("Expected for both: 25% each");
    expect(comparison).toHaveTextContent(
      "This time, 1,200 trials are not closer overall",
    );
    expect(comparison).not.toHaveTextContent(/\bpp\b|percentage points|gap/i);
  });

  it("unlocks the doubled-weight challenge and explains 2 out of 5", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    render(<ChanceCarnivalSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Counts can differ" }));
    fireEvent.click(screen.getByRole("button", { name: "Run 12 trials" }));
    fireEvent.click(screen.getByRole("button", { name: "Run 1,200 trials" }));

    const weightedRun = screen.getByRole("button", {
      name: "Run 200 trials",
    });
    expect(weightedRun).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "40% (2 of 5)" }));
    expect(weightedRun).toBeEnabled();
    fireEvent.click(weightedRun);
    expect(
      screen.getByTestId("chance-challenge-two-feedback"),
    ).toHaveTextContent("Correct: 2/5 = 40%");
    expect(
      screen.getByTestId("chance-challenge-two-feedback"),
    ).toHaveTextContent("100.0% · expected 40%");
  });
});
