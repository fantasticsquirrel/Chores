import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FractionFeastSimulation } from "../FractionFeastSimulation";
import { PatternPalaceSimulation } from "../PatternPalaceSimulation";
import { ChanceCarnivalSimulation } from "../ChanceCarnivalSimulation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("tactile mathematical exhibits", () => {
  it("selects individual equal slices and preserves selection when subdividing", () => {
    render(<FractionFeastSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Plate A slice 2" }));
    expect(screen.getByRole("status")).toHaveTextContent("2/2 > 2/4");
    fireEvent.click(screen.getByRole("button", { name: "Split every slice" }));
    expect(screen.getByRole("status")).toHaveTextContent("4/4 > 2/4");
    fireEvent.click(screen.getByRole("button", { name: "Plate A slice 2" }));
    expect(screen.getByRole("status")).toHaveTextContent("3/4 > 2/4");
  });
  it("supports a prediction before testing equivalent fractions", () => {
    render(<FractionFeastSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "The same amount" }));
    expect(
      screen.getByRole("button", { name: "The same amount" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Test the split" }));
    expect(screen.getByRole("status")).toHaveTextContent("2/4 = 2/4");
    expect(screen.getByText(/The amount stayed the same/)).toBeTruthy();
  });
  it("makes the transform demonstrable without changing shape measurements", () => {
    render(<PatternPalaceSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Turn 90°" }));
    expect(screen.getByLabelText("Motif rotation")).toHaveValue("90");
    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("rotated 90 degrees"),
    );
    expect(screen.getByRole("status")).toHaveTextContent("36° gap");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Red dot: upper right",
    );
    fireEvent.click(screen.getByLabelText("Reflect left to right"));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Red dot: lower right",
    );
  });
  it("uses the real final random draw for its visible outcome", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.8);
    render(<ChanceCarnivalSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Run trials" }));
    expect(random).toHaveBeenCalledTimes(10);
    expect(screen.getByTestId("chance-last-outcome")).toHaveTextContent("4");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Outcome 4: theory 25.0% · observed 10 (100.0%)",
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear sample" }));
    expect(screen.getByTestId("chance-last-outcome")).toHaveTextContent(
      "No trials yet",
    );
  });
  it("does not invent a trial when every outcome has zero weight", () => {
    render(<ChanceCarnivalSimulation />);
    for (let outcome = 0; outcome < 4; outcome++) {
      fireEvent.change(screen.getByLabelText("Adjust outcome"), {
        target: { value: outcome },
      });
      fireEvent.change(screen.getByLabelText(`Outcome ${outcome + 1} weight`), {
        target: { value: 0 },
      });
    }
    const random = vi.spyOn(Math, "random");
    expect(screen.getByRole("button", { name: "Run trials" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Run 10,000 more" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Set at least one weight above zero",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("NaN");
    expect(random).not.toHaveBeenCalled();
  });
  it("subdivides an empty plate without adding area", () => {
    render(<FractionFeastSimulation />);
    fireEvent.change(screen.getByLabelText("Selected slices"), {
      target: { value: 0 },
    });
    fireEvent.click(screen.getByRole("button", { name: "Split every slice" }));
    expect(screen.getByRole("status")).toHaveTextContent("0/4 < 2/4");
    expect(screen.getByRole("status")).toHaveTextContent("simplest form: 0/1");
  });
});
