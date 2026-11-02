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
      expect(screen.getByRole("button", { name: /Reset/ })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Pause motion" })).toBeNull();
    },
  );

  it("splits fractions without changing area, then combines unlike denominators", () => {
    render(<FractionFeastSimulation />);
    expect(screen.getByRole("status")).toHaveTextContent("1/2 = 2/4");
    fireEvent.click(screen.getByRole("button", { name: "The same amount" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Compare 1/2 with 2/4" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "More than one whole" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Combine 2/3 and 3/4" }),
    );
    expect(
      screen.getByText("Exact combined amount").parentElement,
    ).toHaveTextContent("17/12 = 1 whole and 5/12");

    change("Active plate", 0);
    change("Equal parts in this whole", 2);
    change("Selected slices", 1);
    fireEvent.click(screen.getByRole("button", { name: "Split every slice" }));
    expect(
      screen.getByText("Plate comparison").parentElement,
    ).toHaveTextContent("2/4 < 3/4");
    change("Equal parts in this whole", 3);
    change("Selected slices", 2);
    change("Active plate", 1);
    change("Equal parts in this whole", 4);
    change("Selected slices", 3);
    fireEvent.click(screen.getByRole("button", { name: "Combine slices" }));
    expect(
      screen.getByText("Exact combined amount").parentElement,
    ).toHaveTextContent("17/12 = 1 whole and 5/12");
    expect(
      screen.getByRole("img", {
        name: /together 17\/12, or 1 whole and 5\/12/,
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(
      screen.getByText("Plate comparison").parentElement,
    ).toHaveTextContent("1/2 = 2/4");
  });

  it("shows a real gap and overlap rather than claiming pentagons tile", () => {
    render(<PatternPalaceSimulation />);
    const compareTransform = screen.getByRole("button", {
      name: "Compare the two transformations",
    });
    const comparePentagons = screen.getByRole("button", {
      name: "Compare 3 and 4 pentagons",
    });
    expect(compareTransform).toBeDisabled();
    expect(comparePentagons).toBeDisabled();
    expect(screen.queryByLabelText("Regular tile shape")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reflection" }));
    fireEvent.click(compareTransform);
    expect(screen.getByTestId("pattern-transform-feedback")).toHaveTextContent(
      "M moved farther right after the reflection",
    );
    expect(screen.getByTestId("pattern-transform-feedback")).toHaveTextContent(
      "Held: motif dimensions · center · marked point M",
    );

    fireEvent.click(screen.getByRole("button", { name: "72° overlap" }));
    fireEvent.click(comparePentagons);
    expect(screen.getByTestId("pattern-corner-feedback")).toHaveTextContent(
      "3 × 108° = 324°",
    );
    expect(screen.getByTestId("pattern-corner-feedback")).toHaveTextContent(
      "4 × 108° = 432°",
    );
    expect(screen.getByLabelText("Regular tile shape")).toBeTruthy();

    change("Tiles around one point", 4);
    expect(
      screen.getByText("Corner calculation").parentElement,
    ).toHaveTextContent("72° overlap");
    change("Regular tile shape", 4);
    expect(
      screen.getByText("Corner calculation").parentElement,
    ).toHaveTextContent("exact 360° fit");
    change("Motif transformation", "quarter-turn");
    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("clockwise quarter-turn"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Quarter-turn" }));
    expect(screen.queryByTestId("pattern-transform-feedback")).toBeNull();
    expect(screen.queryByLabelText("Regular tile shape")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(compareTransform).toBeDisabled();
  });

  it("gates controlled caravan comparisons, reports evidence and clears stale results", () => {
    render(<CaravanSimulation />);
    const compareSeason = screen.getByRole("button", {
      name: "Compare wet and dry river plans",
    });
    const compareRoutes = screen.getByRole("button", {
      name: "Compare mountain and oasis plans",
    });
    expect(compareSeason).toBeDisabled();
    expect(compareRoutes).toBeDisabled();
    expect(screen.queryByLabelText("Trade route")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "More travel days" }));
    fireEvent.click(compareSeason);
    expect(screen.getByTestId("caravan-season-feedback")).toHaveTextContent(
      "Wet: 8 days · 6 of 6 delivered · 64 / 100 kg · −8 teaching credits",
    );
    expect(screen.getByTestId("caravan-season-feedback")).toHaveTextContent(
      "Dry: 14 days · 4 of 6 delivered · 64 / 100 kg · −22 teaching credits",
    );
    expect(screen.getByTestId("caravan-season-feedback")).toHaveTextContent(
      "Changed: season",
    );

    fireEvent.click(screen.getByRole("button", { name: "Oasis Trail" }));
    fireEvent.click(compareRoutes);
    expect(screen.getByTestId("caravan-route-feedback")).toHaveTextContent(
      "Mountain: 9 days · 5 of 6 delivered · toll 8 · margin 0 teaching credits",
    );
    expect(screen.getByTestId("caravan-route-feedback")).toHaveTextContent(
      "Oasis: 12 days · 6 of 6 delivered · toll 3 · margin 15 teaching credits",
    );
    expect(screen.getByLabelText("Trade route")).toBeTruthy();

    change("Trade route", "ridge");
    change("Cargo", "pottery");
    change("Cargo units", 10);
    change("Supply days packed", 20);
    expect(screen.getByRole("status")).toHaveTextContent("110 / 100 kg");

    fireEvent.click(screen.getByRole("button", { name: "Same travel time" }));
    expect(screen.queryByTestId("caravan-season-feedback")).toBeNull();
    expect(screen.queryByLabelText("Trade route")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(compareSeason).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "River Road · wet season · 8 days",
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
