import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CellExplorerSimulation,
  ShapeSlicerSimulation,
  AdaptationIslandSimulation,
} from "./index";
vi.mock("../ExpansionCanvas", () => ({
  ExpansionCanvas: ({ description }: { description: string }) => (
    <div role="img" aria-label={description} />
  ),
}));
afterEach(cleanup);
describe("cell controls", () => {
  it("keeps numeric transport evidence accessible and allows carrier comparison", () => {
    render(<CellExplorerSimulation />);
    fireEvent.change(screen.getByLabelText("Molecule"), {
      target: { value: "glucose" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Transfer one step" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Outside 12.0; inside 4.0",
    );
    fireEvent.click(screen.getByLabelText("Glucose carrier"));
    fireEvent.click(screen.getByRole("button", { name: "Transfer one step" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Outside 11.0; inside 5.0",
    );
  });
  it("does not claim animal cells have chloroplasts", () => {
    render(<CellExplorerSimulation />);
    fireEvent.change(screen.getByLabelText("Cell type"), {
      target: { value: "animal" },
    });
    expect(screen.getByRole("button", { name: "Chloroplast" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Mitochondrion" }),
    ).not.toBeDisabled();
  });
});
describe("slicing controls", () => {
  it("reports exact sides and can restore center cut", () => {
    render(<ShapeSlicerSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Diagonal cube cut" }));
    expect(screen.getByRole("status").textContent).toContain("hexagon");
    fireEvent.change(screen.getByLabelText("Cut height"), {
      target: { value: "1.75" },
    });
    expect(screen.getByRole("status").textContent).toContain("empty");
    fireEvent.click(screen.getByRole("button", { name: "Center the cut" }));
    expect(screen.getByRole("status").textContent).toContain("hexagon");
  });
});
describe("selection controls", () => {
  it("reset preserves current environment and restores inherited variation", () => {
    render(<AdaptationIslandSimulation />);
    fireEvent.change(screen.getByLabelText("Ground color"), {
      target: { value: "light" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next generation" }));
    expect(screen.getByRole("status").textContent).toContain(
      "dark shells 35.7%",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset population" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Generation 0: dark shells 50.0%",
    );
    expect(screen.getByLabelText("Ground color")).toHaveValue("light");
  });
  it("guided comparisons ask for a prediction and expose measured evidence", () => {
    render(<AdaptationIslandSimulation />);
    expect(
      screen.getByRole("button", { name: "Dark ground · 5 generations" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Different proportions" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dark ground · 5 generations" }),
    );
    expect(screen.getByRole("status").textContent).toContain("Generation 5");
    expect(screen.getByText(/Evidence from dark ground/i)).toBeVisible();
  });
});
describe("controlled investigations", () => {
  it("compares both cell molecules and then carriers from identical concentrations", () => {
    render(<CellExplorerSimulation />);
    fireEvent.change(screen.getByLabelText("Outside concentration"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Different transfer" }));
    fireEvent.click(screen.getByRole("button", { name: "Oxygen · one step" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Outside 11.0; inside 5.0",
    );
    fireEvent.click(screen.getByRole("button", { name: "Glucose · one step" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Outside 12.0; inside 4.0",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Add a carrier" }));
    fireEvent.click(screen.getByRole("button", { name: "Transfer changes" }));
    fireEvent.click(
      screen.getByRole("button", { name: "No carrier · one step" }),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "No glucose transfer",
    );
    fireEvent.click(screen.getByRole("button", { name: "Carrier · one step" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Outside 11.0; inside 5.0",
    );
  });
  it("hides sphere size explanation until both observations and preserves exact circle evidence", () => {
    render(<ShapeSlicerSimulation />);
    fireEvent.click(screen.getByRole("tab", { name: "Move through a sphere" }));
    expect(
      screen.queryByText(/Why does the circle shrink/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Size only" }));
    fireEvent.click(screen.getByRole("button", { name: "Sphere · center" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Radius 1.00 units",
    );
    expect(
      screen.queryByText(/Why does the circle shrink/),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Sphere · height 0.6" }),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Radius 0.80 units",
    );
    expect(screen.getByText(/Why does the circle shrink/)).toBeVisible();
  });
  it("resets both population trials to equal variation and equal five-generation duration", () => {
    render(<AdaptationIslandSimulation />);
    fireEvent.change(screen.getByLabelText("Initial dark-shell share"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Remove predation" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Proportions stay fixed" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Predation on · 5 generations" }),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Generation 5: dark shells 95.0%",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Predation off · 5 generations" }),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Generation 5: dark shells 50.0%",
    );
  });
});
