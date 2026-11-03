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
