import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FractionFeastSimulation } from "../FractionFeastSimulation";
import { PatternPalaceSimulation } from "../PatternPalaceSimulation";
import { ChanceCarnivalSimulation } from "../ChanceCarnivalSimulation";
import { ChanceDeviceGraphic } from "../chance/ChanceDeviceGraphic";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function unlockFractionExploration() {
  fireEvent.click(screen.getByRole("button", { name: "The same amount" }));
  fireEvent.click(screen.getByRole("button", { name: "Compare 1/2 with 2/4" }));
  fireEvent.click(screen.getByRole("button", { name: "More than one whole" }));
  fireEvent.click(screen.getByRole("button", { name: "Combine 2/3 and 3/4" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Show 1/2 before the split" }),
  );
}

describe("tactile mathematical exhibits", () => {
  it("keeps weighted spinner badges readable above the sampled pointer", () => {
    const { container } = render(
      <ChanceDeviceGraphic
        chances={[0.4, 0.2, 0.2, 0.2]}
        die={false}
        last={0}
        selected={2}
      />,
    );

    expect(screen.getByTestId("chance-sector-1")).toHaveAttribute(
      "data-share",
      "40.0",
    );
    expect(screen.getByTestId("chance-sector-3")).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(screen.getByTestId("chance-pointer")).toHaveAttribute(
      "data-outcome",
      "1",
    );
    expect(screen.getAllByTestId("chance-sector-pattern")).toHaveLength(4);

    const pointer = screen.getByTestId("chance-pointer");
    const labels = container.querySelectorAll(".chance-sector-label");
    expect(labels).toHaveLength(4);
    labels.forEach((label) => {
      const badge = label.previousElementSibling;
      expect(badge?.tagName.toLowerCase()).toBe("circle");
      expect(
        pointer.compareDocumentPosition(badge as Element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        pointer.compareDocumentPosition(label) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it("selects individual equal slices and preserves selection when subdividing", () => {
    render(<FractionFeastSimulation />);
    unlockFractionExploration();
    fireEvent.click(screen.getByRole("button", { name: "Plate A slice 2" }));
    expect(
      screen.getByText("Plate comparison").parentElement,
    ).toHaveTextContent("2/2 > 2/4");
    fireEvent.click(screen.getByRole("button", { name: "Split every slice" }));
    expect(
      screen.getByText("Plate comparison").parentElement,
    ).toHaveTextContent("4/4 > 2/4");
    fireEvent.click(screen.getByRole("button", { name: "Plate A slice 2" }));
    expect(
      screen.getByText("Plate comparison").parentElement,
    ).toHaveTextContent("3/4 > 2/4");
  });
  it("supports a prediction before testing equivalent fractions", () => {
    render(<FractionFeastSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "The same amount" }));
    expect(
      screen.getByRole("button", { name: "The same amount" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      screen.getByRole("button", { name: "Compare 1/2 with 2/4" }),
    );
    expect(
      screen.getByText("Plate comparison").parentElement,
    ).toHaveTextContent("2/4 = 2/4");
    expect(screen.getByText(/selected amount did not/)).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Add trials" }));
    expect(random).toHaveBeenCalledTimes(10);
    expect(screen.getByTestId("chance-last-outcome")).toHaveTextContent("4");
    expect(
      screen.getByRole("button", { name: "Inspect outcome 4" }),
    ).toHaveTextContent("10 draws100.0% · expected 25.0%");
    fireEvent.click(screen.getByRole("button", { name: "Clear sample" }));
    expect(screen.getByTestId("chance-last-outcome")).toHaveTextContent("—");
  });
  it("does not invent a trial when every outcome has zero weight", () => {
    render(<ChanceCarnivalSimulation />);
    for (let outcome = 0; outcome < 4; outcome++) {
      fireEvent.change(screen.getByLabelText("Outcome"), {
        target: { value: outcome },
      });
      fireEvent.change(screen.getByLabelText(`Outcome ${outcome + 1} weight`), {
        target: { value: 0 },
      });
    }
    const random = vi.spyOn(Math, "random");
    expect(screen.getByRole("button", { name: "Add trials" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Set at least one weight above zero",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("NaN");
    expect(random).not.toHaveBeenCalled();
  });
  it("subdivides an empty plate without adding area", () => {
    render(<FractionFeastSimulation />);
    unlockFractionExploration();
    fireEvent.change(screen.getByLabelText("Selected slices"), {
      target: { value: 0 },
    });
    fireEvent.click(screen.getByRole("button", { name: "Split every slice" }));
    expect(
      screen.getByText("Plate comparison").parentElement,
    ).toHaveTextContent("0/4 < 2/4");
    expect(
      screen.getByText("Selected plate in simplest form").parentElement,
    ).toHaveTextContent("0/1");
  });
});
