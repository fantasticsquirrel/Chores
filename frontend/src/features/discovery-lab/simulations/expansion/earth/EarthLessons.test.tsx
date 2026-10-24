import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import {
  CloudRainSimulation,
  MagneticFieldsSimulation,
  MovingPlatesSimulation,
} from "./index";
vi.mock("../ExpansionCanvas", () => ({
  ExpansionCanvas: ({ description }: { description: string }) => (
    <div role="img" aria-label={description} />
  ),
}));
describe("earth exploration controls and evidence", () => {
  it("resets a boundary and shows deformation release after five loading steps", () => {
    render(<MovingPlatesSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Sideways" }));
    for (let i = 0; i < 4; i++)
      fireEvent.click(
        screen.getByRole("button", { name: "Add one loading step" }),
      );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /index 48; 0 illustrated slips/,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add one loading step" }),
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /index 12; 1 illustrated slips/,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reset this boundary" }),
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /index 0; 0 illustrated slips/,
    );
  });
  it("holds cloud conditions fixed while independently changing growth", () => {
    render(<CloudRainSimulation />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/Cloud without rain/);
    const lift = screen.getByRole("slider", { name: "Air parcel lift" });
    fireEvent.change(
      screen.getByRole("slider", { name: "Droplet-growth teaching index" }),
      { target: { value: "90" } },
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /Cloud with falling drops/,
    );
    expect(lift).toHaveValue("1400");
    fireEvent.change(lift, { target: { value: "0" } });
    expect(screen.getByRole("img")).toHaveAccessibleName(/No cloud yet/);
  });
  it("makes cancellation accessible without relying on a color or arrow", () => {
    render(<MagneticFieldsSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Flip right magnet" }));
    fireEvent.change(
      screen.getByRole("slider", { name: "Compass z · diagram units" }),
      { target: { value: "0" } },
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /repel.*No preferred direction/,
    );
    fireEvent.change(
      screen.getByRole("slider", { name: "Compass z · diagram units" }),
      { target: { value: "2" } },
    );
    expect(screen.getByRole("img")).not.toHaveAccessibleName(
      /No preferred direction/,
    );
  });
  it("offers prediction, executable comparison and explanation for both investigations", () => {
    render(<CloudRainSimulation />);
    fireEvent.click(screen.getByRole("button", { name: /Set lift to 600 m/ }));
    expect(screen.getByRole("slider", { name: "Air parcel lift" })).toHaveValue(
      "600",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Cloud is not rain" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Set cloud without rain/ }),
    );
    expect(screen.getByRole("slider", { name: "Air parcel lift" })).toHaveValue(
      "1400",
    );
    expect(screen.getByText("1. Predict")).toBeInTheDocument();
    expect(screen.getByText("3. Explain")).toBeInTheDocument();
  });
});
