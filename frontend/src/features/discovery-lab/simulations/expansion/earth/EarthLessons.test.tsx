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
  it("keeps the plate-motion sweep opt-in and respects reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(<MovingPlatesSimulation />);
    fireEvent.click(
      screen.getByRole("button", { name: "Replay relative-motion sweep" }),
    );
    expect(
      screen.getByText(
        "Reduced motion is on; the final calculated relative motion stays shown.",
      ),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("cancels an active plate-motion sweep when a control changes", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("requestAnimationFrame", () => 59);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    render(<MovingPlatesSimulation />);
    fireEvent.click(
      screen.getByRole("button", { name: "Replay relative-motion sweep" }),
    );
    expect(
      screen.getByRole("button", {
        name: "Replaying relative-motion sweep…",
      }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Together" }));
    expect(
      screen.getByRole("button", { name: "Replay relative-motion sweep" }),
    ).toBeEnabled();
    expect(
      screen.queryByText(/Replaying a schematic sweep/),
    ).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("keeps quarter-million-year arithmetic exact in accessible descriptions", () => {
    render(<MovingPlatesSimulation />);
    const elapsedTime = screen.getByRole("slider", {
      name: "Elapsed model time",
    });

    fireEvent.change(elapsedTime, { target: { value: "0.25" } });
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /4 centimetres per year over 0\.25 million years gives 10 kilometres of relative motion/i,
    );
    expect(
      screen.getByLabelText(
        "4 centimetres per year times 0.25 million years equals 10 kilometres of relative motion.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(elapsedTime, { target: { value: "0.75" } });
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /4 centimetres per year over 0\.75 million years gives 30 kilometres of relative motion/i,
    );
    expect(
      screen.getByLabelText(
        "4 centimetres per year times 0.75 million years equals 30 kilometres of relative motion.",
      ),
    ).toBeInTheDocument();
  });

  it("resets a boundary and shows deformation release after five loading steps", () => {
    render(<MovingPlatesSimulation />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /4 centimetres per year over 2\.0 million years gives 80 kilometres of relative motion/i,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sideways" }));
    for (let i = 0; i < 4; i++)
      fireEvent.click(
        screen.getByRole("button", { name: "Add one loading step" }),
      );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /elastic-loading index 80 percent; 0 illustrated slips/i,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add one loading step" }),
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /elastic-loading index 0 percent; 1 illustrated slip/i,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reset this boundary" }),
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /elastic-loading index 0 percent; 0 illustrated slips/i,
    );
  });
  it("requires a prediction and reports controlled Moving Plates evidence", () => {
    render(<MovingPlatesSimulation />);
    expect(screen.getByRole("button", { name: "Set baseline" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Different structures" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Set baseline" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Compare convergent boundary" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /evidence supports your prediction/i,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /both examples show 80 km of relative plate motion/i,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /Changed: boundary interaction/i,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(screen.queryByText(/evidence supports your prediction/i)).toBeNull();
  });
  it("distinguishes cloud droplets, ground rain, virga and invisible vapor", () => {
    render(<CloudRainSimulation />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /Visible cloud droplets; no precipitation-sized particles/,
    );
    const lift = screen.getByRole("slider", { name: "Parcel lift" });
    const diameter = screen.getByRole("slider", {
      name: "Representative particle diameter",
    });
    fireEvent.change(diameter, { target: { value: "300" } });
    fireEvent.change(
      screen.getByRole("slider", {
        name: "Below-cloud relative humidity",
      }),
      { target: { value: "95" } },
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /Small liquid precipitation reaches the ground as drizzle/,
    );
    fireEvent.change(diameter, { target: { value: "1000" } });
    fireEvent.change(
      screen.getByRole("slider", {
        name: "Below-cloud relative humidity",
      }),
      { target: { value: "80" } },
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /Rain reaches the ground/,
    );
    expect(lift).toHaveValue("1600");
    fireEvent.change(
      screen.getByRole("slider", {
        name: "Below-cloud relative humidity",
      }),
      { target: { value: "20" } },
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/virga/i);
    fireEvent.change(lift, { target: { value: "0" } });
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /No cloud yet: water vapor remains invisible/,
    );
    expect(
      screen.getByText(/one vapor mixing ratio until saturation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/virga requires complete evaporation before ground/i),
    ).toBeInTheDocument();
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
  it("requires predictions and reports exact controlled cloud evidence", () => {
    render(<CloudRainSimulation />);
    expect(screen.getByRole("button", { name: "Set baseline" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Cloud only after more lift" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Set baseline" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Lift parcel to 1,600 m" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /evidence supports your prediction/i,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /saturated at 100% RH/i,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /Changed: parcel lift, 400 to 1,600 m/i,
    );
    fireEvent.click(screen.getByRole("button", { name: "Grow precipitation" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Both reach the ground" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Set baseline" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Grow particle to 1,000 µm" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /evidence does not support your prediction/i,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /125,000 times the volume/i,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));
    expect(screen.queryByText(/evidence does not support/i)).toBeNull();
  });

  it("keeps parcel replay opt-in and reports reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(<CloudRainSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Replay parcel lift" }));
    expect(
      screen.getByText(
        "Reduced motion is on; the final lift, temperature and humidity stay shown.",
      ),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("cancels active parcel replay on control change and unmount", () => {
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("requestAnimationFrame", () => 61);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    const view = render(<CloudRainSimulation />);
    fireEvent.click(screen.getByRole("button", { name: "Replay parcel lift" }));
    expect(
      screen.getByRole("button", { name: "Replaying parcel lift…" }),
    ).toBeDisabled();
    fireEvent.change(
      screen.getByRole("slider", { name: "Starting relative humidity" }),
      { target: { value: "65" } },
    );
    expect(
      screen.getByRole("button", { name: "Replay parcel lift" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Replay parcel lift" }));
    view.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(61);
    vi.unstubAllGlobals();
  });
});
