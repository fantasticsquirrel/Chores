import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhotosynthesisSimulation } from "./PhotosynthesisSimulation";

vi.mock("./botany/LeafCanvas", () => ({
  LeafCanvas: ({ rate }: { rate: number }) => (
    <div
      role="img"
      aria-label={`Leaf model, activity index ${Math.round(rate)}`}
    />
  ),
}));

afterEach(cleanup);

describe("Leaf Energy Lab learning flow", () => {
  it("gates the zero-water comparison on a prediction and explains the result", () => {
    render(<PhotosynthesisSimulation />);

    const run = screen.getByRole("button", {
      name: "Compare light at zero water",
    });
    expect(run).toBeDisabled();
    const prediction = screen.getByRole("button", {
      name: "Activity stays at zero",
    });
    fireEvent.click(prediction);
    expect(prediction).toHaveAttribute("aria-pressed", "true");
    expect(run).toBeEnabled();
    fireEvent.click(run);

    const evidence = screen.getByTestId("leaf-zero-water-evidence");
    expect(evidence).toHaveTextContent("Water held at 0%");
    expect(evidence).toHaveTextContent("30% light");
    expect(evidence).toHaveTextContent("100% light");
    expect(evidence).toHaveTextContent("0 / 100");
    expect(screen.getByTestId("leaf-zero-water-feedback")).toHaveTextContent(
      "More light cannot replace water",
    );
  });

  it("gives useful feedback when either prediction differs from the evidence", () => {
    render(<PhotosynthesisSimulation />);
    fireEvent.click(
      screen.getByRole("button", { name: "More light restores activity" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare light at zero water" }),
    );
    expect(screen.getByTestId("leaf-zero-water-feedback")).toHaveTextContent(
      "differs from your prediction",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Keeps rising with light" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare three light levels" }),
    );
    expect(screen.getByTestId("leaf-light-steps-feedback")).toHaveTextContent(
      "differs from your prediction",
    );
  });

  it("compares three light levels with water and carbon dioxide fixed", () => {
    render(<PhotosynthesisSimulation />);
    fireEvent.click(
      screen.getByRole("button", { name: "Activity stays at zero" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare light at zero water" }),
    );

    const run = screen.getByRole("button", {
      name: "Compare three light levels",
    });
    expect(run).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Levels off once water limits" }),
    );
    fireEvent.click(run);

    const evidence = screen.getByTestId("leaf-light-steps-evidence");
    expect(evidence).toHaveTextContent("Water: 35% · carbon dioxide: 80%");
    expect(evidence).toHaveTextContent("15% light");
    expect(evidence).toHaveTextContent("35% light");
    expect(evidence).toHaveTextContent("100% light");
    expect(screen.getByTestId("leaf-light-steps-feedback")).toHaveTextContent(
      "light and water tie",
    );
    expect(screen.getByTestId("leaf-light-steps-feedback")).toHaveTextContent(
      "water limits",
    );
  });

  it("preserves full open-comparison settings and flags multiple changes", () => {
    render(<PhotosynthesisSimulation />);
    fireEvent.click(screen.getByText("Open controls"));
    fireEvent.click(screen.getByRole("button", { name: "Set comparison A" }));
    fireEvent.change(screen.getByLabelText("Light availability"), {
      target: { value: 90 },
    });

    const comparison = screen.getByTestId("leaf-open-comparison");
    expect(comparison).toHaveTextContent("Changed: light 70% → 90%");
    expect(comparison).toHaveTextContent(
      "Held: water 60% · carbon dioxide 80%",
    );

    fireEvent.change(screen.getByLabelText("Water availability"), {
      target: { value: 20 },
    });
    expect(comparison).toHaveTextContent(
      "Change only one resource for a controlled comparison",
    );
    fireEvent.change(screen.getByLabelText("Carbon dioxide"), {
      target: { value: 0 },
    });
    expect(comparison).toHaveTextContent("Held: none");
    expect(comparison).toHaveTextContent("carbon dioxide 80% → 0%");
  });

  it("reset clears predictions, evidence and restores the open settings", () => {
    render(<PhotosynthesisSimulation />);
    fireEvent.click(
      screen.getByRole("button", { name: "Activity stays at zero" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare light at zero water" }),
    );
    fireEvent.click(screen.getByText("Open controls"));
    fireEvent.change(screen.getByLabelText("Light availability"), {
      target: { value: 10 },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(
      screen.getByRole("button", { name: "Compare light at zero water" }),
    ).toBeDisabled();
    expect(screen.queryByTestId("leaf-zero-water-evidence")).toBeNull();
    expect(screen.getByLabelText("Light availability")).toHaveValue("70");
    expect(
      screen.getByRole("button", { name: "Activity stays at zero" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the explanatory result available without relying on the picture", () => {
    render(<PhotosynthesisSimulation />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Toy activity index");
    expect(status).toHaveTextContent("Model limit(s): water");
    expect(screen.getByRole("img")).toHaveAccessibleName();
    expect(
      within(screen.getByTestId("leaf-process-note")).getByText(
        /oxygen released comes from water/i,
      ),
    ).toBeTruthy();
  });
});
