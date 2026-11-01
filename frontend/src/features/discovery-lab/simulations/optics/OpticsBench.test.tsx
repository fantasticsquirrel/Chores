import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OpticsSimulation } from "../OpticsSimulation";

afterEach(cleanup);

describe("Light Bending Studio", () => {
  it("requires predictions and preserves both controlled comparisons", () => {
    render(<OpticsSimulation />);
    const criticalAction = screen.getByRole("button", {
      name: "Compare 40° and 43°",
    });
    const directionAction = screen.getByRole("button", {
      name: "Compare both directions",
    });
    expect((criticalAction as HTMLButtonElement).disabled).toBe(true);
    expect((directionAction as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Transmitted ray remains" }),
    );
    fireEvent.click(criticalAction);
    expect(screen.getByTestId("optics-critical-evidence")).toHaveTextContent(
      "40°",
    );
    expect(screen.getByTestId("optics-critical-evidence")).toHaveTextContent(
      "43°",
    );
    expect(screen.getByTestId("optics-critical-evidence")).toHaveTextContent(
      "differs from your prediction",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Toward in glass; away in air" }),
    );
    fireEvent.click(directionAction);
    expect(screen.getByTestId("optics-direction-evidence")).toHaveTextContent(
      "Air → glass",
    );
    expect(screen.getByTestId("optics-direction-evidence")).toHaveTextContent(
      "Glass → air",
    );
    expect(screen.getByTestId("optics-direction-evidence")).toHaveTextContent(
      "matches your prediction",
    );
  });

  it("exposes boundaries in open controls and resets all lesson state", () => {
    render(<OpticsSimulation />);
    fireEvent.click(screen.getByText("Open controls", { exact: true }));
    fireEvent.change(screen.getByLabelText("From material"), {
      target: { value: "water" },
    });
    fireEvent.change(screen.getByLabelText("To material"), {
      target: { value: "air" },
    });
    fireEvent.change(screen.getByLabelText("Incident angle"), {
      target: { value: 49 },
    });
    expect(screen.getByTestId("optics-current-outcome")).toHaveTextContent(
      "Total internal reflection",
    );

    fireEvent.change(screen.getByLabelText("To material"), {
      target: { value: "water" },
    });
    expect(screen.queryByTestId("reflected-ray")).toBeNull();
    expect(screen.getByTestId("optics-current-outcome")).toHaveTextContent(
      "Straight through",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("From material")).toHaveValue("glass");
    expect(screen.getByLabelText("To material")).toHaveValue("air");
    expect(screen.getByLabelText("Incident angle")).toHaveValue("40");
    expect(screen.queryByTestId("optics-critical-evidence")).toBeNull();
  });
});
