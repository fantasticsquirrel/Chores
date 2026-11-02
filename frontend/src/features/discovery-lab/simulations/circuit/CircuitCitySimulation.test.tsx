import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CircuitCitySimulation } from "../CircuitCitySimulation";

afterEach(cleanup);

function completeFixedComparisons() {
  fireEvent.click(
    screen.getByRole("button", {
      name: "All off in series; houses 1 and 3 on in parallel",
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Compare series and parallel" }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Current doubles; power and energy quadruple",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Compare 6 V and 12 V" }));
}

describe("Circuit City controlled learning workflow", () => {
  it("gates two fair comparisons and reports numerical evidence", () => {
    render(<CircuitCitySimulation />);

    expect(
      screen.getByRole("button", { name: "Compare series and parallel" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Compare 6 V and 12 V" }),
    ).toBeDisabled();
    expect(screen.queryByLabelText("Wiring")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "All off in series; houses 1 and 3 on in parallel",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare series and parallel" }),
    );
    expect(
      screen.getByRole("button", { name: "Compare series and parallel" }),
    ).toBeDisabled();
    expect(screen.getByTestId("circuit-path-feedback")).toHaveTextContent(
      "Series, house 2 open: 0.00 A source current",
    );
    expect(screen.getByTestId("circuit-path-feedback")).toHaveTextContent(
      "Parallel, house 2 open: 2.00 A source current",
    );
    expect(screen.getByTestId("circuit-path-feedback")).toHaveTextContent(
      "Changed: wiring arrangement",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Current doubles; power and energy quadruple",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare 6 V and 12 V" }),
    );
    expect(screen.getByTestId("circuit-voltage-feedback")).toHaveTextContent(
      "6 V: each house 0.50 A · 3.0 W · 30.0 J in 10 s",
    );
    expect(screen.getByTestId("circuit-voltage-feedback")).toHaveTextContent(
      "12 V: each house 1.00 A · 12.0 W · 120.0 J in 10 s",
    );
    expect(screen.getByTestId("circuit-voltage-feedback")).toHaveTextContent(
      "Changed: source voltage",
    );
    expect(screen.getByLabelText("Wiring")).toBeTruthy();
    expect(
      screen.getByLabelText("Conventional-current marker phase"),
    ).toBeTruthy();
  });

  it("keeps branch behavior, the charge/energy ledger, and reset available", () => {
    render(<CircuitCitySimulation />);
    completeFixedComparisons();

    fireEvent.click(screen.getByRole("button", { name: "Toggle House 2" }));
    expect(screen.getByLabelText("House 1 current")).toHaveTextContent(
      "1.00 A",
    );
    expect(screen.getByLabelText("House 2 current")).toHaveTextContent(
      "0.00 A",
    );
    expect(screen.getByLabelText("House 3 current")).toHaveTextContent(
      "1.00 A",
    );
    expect(screen.getByLabelText("Charge ledger")).toHaveTextContent(
      "20.0 C leaves the source and 20.0 C returns",
    );
    expect(screen.getByLabelText("Energy ledger")).toHaveTextContent(
      "240.0 J supplied = 240.0 J transferred to the loads",
    );

    fireEvent.change(screen.getByLabelText("Wiring"), {
      target: { value: "series" },
    });
    expect(screen.getByLabelText("House 1 current")).toHaveTextContent(
      "0.00 A",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(
      screen.getByRole("button", { name: "Compare series and parallel" }),
    ).toBeDisabled();
    expect(screen.queryByLabelText("Wiring")).toBeNull();
  });
});
