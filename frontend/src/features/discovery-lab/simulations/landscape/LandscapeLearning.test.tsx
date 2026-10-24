import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RiverSculptorSimulation } from "../RiverSculptorSimulation";
import { FoodWebSimulation } from "../FoodWebSimulation";
import { CaravanSimulation } from "../CaravanSimulation";
import { PollinatorSimulation } from "../PollinatorSimulation";
import { gardenFlowers } from "@family-manager/discovery-scenes/landscape/garden";
import { POLLINATOR_FLOWERS } from "@family-manager/family-api/discovery-models/math-life";
afterEach(cleanup);
const change = (label: string, value: number | string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
describe("landscape investigations", () => {
  it.each([
    RiverSculptorSimulation,
    FoodWebSimulation,
    CaravanSimulation,
    PollinatorSimulation,
  ])("keeps two prediction and comparison investigations", (Component) => {
    render(<Component />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(screen.getByText("1. Predict")).toBeTruthy();
    expect(screen.getByText("2. Compare")).toBeTruthy();
    expect(screen.getByText("3. Explain")).toBeTruthy();
    fireEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getAllByRole("button", { pressed: false }).length,
    ).toBeGreaterThanOrEqual(2);
  });
  it("restores soil without changing the independent storm inputs", () => {
    render(<RiverSculptorSimulation />);
    change("Rainfall", 80);
    change("Channel slope", 18);
    change("Vegetation cover", 0);
    fireEvent.click(screen.getByRole("button", { name: "Run one storm" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore soil" }));
    expect(screen.getByLabelText("Soil remaining")).toHaveTextContent(
      "5000.0 kg",
    );
    expect(screen.getByLabelText("Rainfall")).toHaveValue("80");
    expect(screen.getByLabelText("Channel slope")).toHaveValue("18");
    expect(screen.getByLabelText("Vegetation cover")).toHaveValue("0");
  });
  it("preserves the exact garden coordinates and species used for reach calculations", () => {
    expect(
      gardenFlowers.map(({ x, y, species, name }) => ({ x, y, species, name })),
    ).toEqual(
      POLLINATOR_FLOWERS.map(({ x, y, species, name }) => ({
        x,
        y,
        species,
        name,
      })),
    );
  });
  it("reports species mismatch separately from a successful flight", () => {
    render(<PollinatorSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Visit Gold 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Visit Violet 1" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Different flower species",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Flower visits: 2");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Compatible transfers: 0",
    );
  });
});
