import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BridgeBuilderSimulation } from "./BridgeBuilderSimulation";

afterEach(cleanup);

function completeInvestigations() {
  fireEvent.click(
    screen.getByRole("button", { name: "Left support carries more" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Compare load positions" }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Moment and deflection both double",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Compare point loads" }));
}

describe("Bridge Builder controlled investigations", () => {
  it("gates both comparisons and reports controlled, unit-labeled evidence", () => {
    render(<BridgeBuilderSimulation />);

    const positionCompare = screen.getByRole("button", {
      name: "Compare load positions",
    });
    const loadCompare = screen.getByRole("button", {
      name: "Compare point loads",
    });
    expect(positionCompare).toBeDisabled();
    expect(loadCompare).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Left support carries more" }),
    );
    fireEvent.click(positionCompare);
    expect(screen.getByTestId("bridge-position-feedback")).toHaveTextContent(
      "matches your prediction",
    );
    expect(screen.getByTestId("bridge-position-feedback")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByTestId("bridge-position-feedback")).toHaveTextContent(
      "Center: left 6.0 kN · right 6.0 kN · peak moment 30.0 kN·m · deflection at load 2.50 mm",
    );
    expect(screen.getByTestId("bridge-position-feedback")).toHaveTextContent(
      "20%: left 9.6 kN · right 2.4 kN · peak moment 19.2 kN·m · deflection at load 1.02 mm",
    );
    expect(screen.getByTestId("bridge-position-feedback")).toHaveTextContent(
      "Changed: load position",
    );
    expect(screen.getByTestId("bridge-position-feedback")).toHaveTextContent(
      "Held: 12 kN point load · 100 MN·m² flexural rigidity · 10 m span · no brace-index modifiers",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Moment doubles; deflection stays the same",
      }),
    );
    fireEvent.click(loadCompare);
    expect(screen.getByTestId("bridge-load-feedback")).toHaveTextContent(
      "differs from your prediction",
    );
    expect(screen.getByTestId("bridge-load-feedback")).toHaveTextContent(
      "8 kN: 20.0 kN·m and 1.67 mm · 16 kN: 40.0 kN·m and 3.33 mm",
    );
  });

  it("relocks changed predictions and reset restores the fixed baseline", () => {
    render(<BridgeBuilderSimulation />);
    completeInvestigations();

    expect(screen.getByLabelText("Load position")).toBeVisible();
    expect(screen.getByLabelText("Point load")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Play load path" }));
    expect(
      screen.getByRole("button", { name: "Pause load path" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Both supports stay equal" }),
    );
    expect(screen.queryByTestId("bridge-position-feedback")).toBeNull();
    expect(screen.queryByLabelText("Load position")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Pause load path" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Compare load positions" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(
      screen.getByRole("button", { name: "Compare load positions" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Compare point loads" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Left support force")).toHaveTextContent(
      "6.0 kN",
    );
    expect(screen.getByLabelText("Right support force")).toHaveTextContent(
      "6.0 kN",
    );
  });

  it("keeps brace changes separate from the computed beam quantities", () => {
    render(<BridgeBuilderSimulation />);
    completeInvestigations();

    const left = screen.getByLabelText("Left support force").textContent;
    const moment = screen.getByLabelText("Peak bending moment").textContent;
    const deflection = screen.getByLabelText("Deflection at load").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Brace section 2" }));
    expect(screen.getByLabelText("Left support force").textContent).toBe(left);
    expect(screen.getByLabelText("Peak bending moment").textContent).toBe(
      moment,
    );
    expect(screen.getByLabelText("Deflection at load").textContent).toBe(
      deflection,
    );
    expect(
      screen.getByText(/invented comparison index.*not a capacity/i),
    ).toBeVisible();
    expect(screen.queryByText(/within.*capacity/i)).toBeNull();
  });
});
