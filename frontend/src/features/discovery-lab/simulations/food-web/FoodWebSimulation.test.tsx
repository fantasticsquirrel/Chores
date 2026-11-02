import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FoodWebSimulation } from "../FoodWebSimulation";

afterEach(cleanup);

function finishPredatorComparison() {
  fireEvent.click(
    screen.getByRole("button", {
      name: "Zooplankton rises and algae falls",
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Compare fish present and absent" }),
  );
}

function finishNutrientComparison() {
  fireEvent.click(
    screen.getByRole("button", {
      name: "Fish and oxygen both finish lower",
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Compare low and high nutrients" }),
  );
}

describe("Food Web Rescue learning workflow", () => {
  it("gates exploration behind predictions and reports two controlled comparisons", () => {
    render(<FoodWebSimulation />);

    expect(screen.queryByLabelText("Nutrient supply index")).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Compare fish present and absent",
      }).disabled,
    ).toBe(true);

    finishPredatorComparison();
    expect(
      screen.getByTestId("food-web-predator-feedback").textContent,
    ).toContain("Fish absent: algae 10.6 · zooplankton 56.6");
    expect(
      screen.getByTestId("food-web-predator-feedback").textContent,
    ).toContain("Changed: fish presence");
    expect(screen.queryByLabelText("Nutrient supply index")).toBeNull();

    finishNutrientComparison();
    expect(
      screen.getByTestId("food-web-nutrient-feedback").textContent,
    ).toContain("High nutrients: algae 40.9");
    expect(
      screen.getByTestId("food-web-nutrient-feedback").textContent,
    ).toContain("oxygen 45.7");
    expect(
      screen.getByTestId("food-web-nutrient-feedback").textContent,
    ).toContain("Held: drought severity 60%");
    expect(screen.getByLabelText("Nutrient supply index")).toBeTruthy();
    expect(screen.getByLabelText("Energy-flow marker phase")).toBeTruthy();
  });

  it("keeps absent species at zero, supports static marker control, and fully resets", () => {
    render(<FoodWebSimulation />);
    finishPredatorComparison();
    finishNutrientComparison();

    fireEvent.click(screen.getByLabelText("Fish present"));
    fireEvent.click(screen.getByRole("button", { name: "Advance one week" }));
    expect(screen.getByLabelText("Fish population index").textContent).toBe(
      "0.0",
    );
    expect(screen.getByText("Week 9")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Energy-flow marker phase"), {
      target: { value: "70" },
    });
    expect(
      (screen.getByLabelText("Energy-flow marker phase") as HTMLInputElement)
        .value,
    ).toBe("70");

    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(screen.queryByLabelText("Nutrient supply index")).toBeNull();
    expect(screen.getByLabelText("Fish population index").textContent).toBe(
      "20.0",
    );
  });
});
