import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FractionFeastSimulation } from "../FractionFeastSimulation";

afterEach(cleanup);

function completeEquivalentTrial() {
  fireEvent.click(screen.getByRole("button", { name: "The same amount" }));
  fireEvent.click(screen.getByRole("button", { name: "Compare 1/2 with 2/4" }));
}

describe("Fraction Feast learning workflow", () => {
  it("gates free exploration behind two prediction-first comparisons", () => {
    render(<FractionFeastSimulation />);

    expect(screen.queryByLabelText("Active plate")).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Compare 1/2 with 2/4",
      }).disabled,
    ).toBe(true);

    completeEquivalentTrial();
    expect(
      screen.getByTestId("fraction-equivalent-feedback"),
    ).toHaveTextContent("1/2 = 2/4");
    expect(
      screen.getByTestId("fraction-equivalent-feedback"),
    ).toHaveTextContent("Changed: piece count · piece size");
    expect(
      screen.getByTestId("fraction-equivalent-feedback"),
    ).toHaveTextContent("Held: whole area · selected amount");

    fireEvent.click(screen.getByRole("button", { name: "More pizza" }));
    expect(screen.queryByTestId("fraction-equivalent-feedback")).toBeNull();
    expect(screen.queryByLabelText("Active plate")).toBeNull();
    completeEquivalentTrial();

    const addButton = screen.getByRole<HTMLButtonElement>("button", {
      name: "Combine 2/3 and 3/4",
    });
    expect(addButton.disabled).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "More than one whole" }),
    );
    fireEvent.click(addButton);

    const addition = screen.getByTestId("fraction-addition-feedback");
    expect(addition).toHaveTextContent("2/3 = 8/12");
    expect(addition).toHaveTextContent("3/4 = 9/12");
    expect(addition).toHaveTextContent("17/12 = 1 whole and 5/12");
    expect(screen.getByLabelText("Active plate")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Explore fractions" }),
    ).toBeTruthy();
  });

  it("clears all evidence and restores the fixed starting scene on reset", () => {
    render(<FractionFeastSimulation />);
    completeEquivalentTrial();
    fireEvent.click(
      screen.getByRole("button", { name: "More than one whole" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Combine 2/3 and 3/4" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(screen.queryByTestId("fraction-equivalent-feedback")).toBeNull();
    expect(screen.queryByTestId("fraction-addition-feedback")).toBeNull();
    expect(screen.queryByLabelText("Active plate")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("1/2 = 2/4");
  });
});
