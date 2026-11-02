import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RiverSculptorSimulation } from "../RiverSculptorSimulation";
import { CaravanSimulation } from "../CaravanSimulation";
import { PollinatorSimulation } from "../PollinatorSimulation";
import { gardenFlowers } from "@family-manager/discovery-scenes/landscape/garden";
import { POLLINATOR_FLOWERS } from "@family-manager/family-api/discovery-models/math-life";
afterEach(cleanup);
const change = (label: string, value: number | string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
describe("landscape investigations", () => {
  it("keeps two tabbed pollinator prediction and comparison investigations", () => {
    render(<PollinatorSimulation />);
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

  it("keeps two controlled Caravan prediction and comparison investigations", () => {
    render(<CaravanSimulation />);
    const seasonCompare = screen.getByRole("button", {
      name: "Compare wet and dry river plans",
    });
    const routeCompare = screen.getByRole("button", {
      name: "Compare mountain and oasis plans",
    });
    expect(seasonCompare).toBeDisabled();
    expect(routeCompare).toBeDisabled();
    expect(screen.queryByLabelText("Trade route")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "More travel days" }));
    fireEvent.click(seasonCompare);
    expect(screen.getByTestId("caravan-season-feedback")).toHaveTextContent(
      "Wet: 8 days · 6 of 6 delivered",
    );
    fireEvent.click(screen.getByRole("button", { name: "Oasis Trail" }));
    fireEvent.click(routeCompare);
    expect(screen.getByTestId("caravan-route-feedback")).toHaveTextContent(
      "Oasis: 12 days · 6 of 6 delivered",
    );
    expect(screen.getByLabelText("Trade route")).toBeTruthy();
  });
  it("restores soil without changing the independent storm inputs", () => {
    render(<RiverSculptorSimulation />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Runoff and soil export both decrease",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare vegetation cover" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Only soil moved increases" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare catchment slopes" }),
    );
    change("Rainfall in one hour", 80);
    change("Catchment slope", 18);
    change("Vegetation cover", 0);
    fireEvent.click(screen.getByRole("button", { name: "Run one storm" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore soil" }));
    expect(screen.getByLabelText("Soil remaining")).toHaveTextContent(
      "5000.0 kg",
    );
    expect(screen.getByLabelText("Rainfall in one hour")).toHaveValue("80");
    expect(screen.getByLabelText("Catchment slope")).toHaveValue("18");
    expect(screen.getByLabelText("Vegetation cover")).toHaveValue("0");
  });

  it("gates River controls behind two predictions and reports fixed evidence", () => {
    render(<RiverSculptorSimulation />);
    expect(screen.queryByLabelText("Catchment slope")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Compare vegetation cover" }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Runoff and soil export both decrease",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare vegetation cover" }),
    );
    expect(screen.getByTestId("river-vegetation-feedback")).toHaveTextContent(
      "Bare: runoff 320.0 m³",
    );
    expect(screen.getByTestId("river-vegetation-feedback")).toHaveTextContent(
      "100% cover: runoff 100.0 m³",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Only soil moved increases" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare catchment slopes" }),
    );
    expect(screen.getByTestId("river-slope-feedback")).toHaveTextContent(
      "2% slope: runoff 232.0 m³",
    );
    expect(screen.getByTestId("river-slope-feedback")).toHaveTextContent(
      "20% slope: runoff 232.0 m³",
    );
    expect(screen.getByLabelText("Catchment slope")).toBeTruthy();
    expect(screen.getByLabelText("Sediment tracer phase")).toBeTruthy();
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
