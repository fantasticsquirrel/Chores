import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SoundDrawing } from "./SoundDrawing";
import { SoundPlaygroundSimulation } from "./SoundPlaygroundSimulation";

afterEach(cleanup);

describe("Sound Playground controlled investigation", () => {
  it("identifies the time trace as string midpoint displacement, not pressure", () => {
    render(<SoundPlaygroundSimulation />);

    expect(
      screen.getByRole("img", {
        name: "Modeled string midpoint displacement over 10 milliseconds. Amplitude 3 millimeters; 2.36 cycles. No acoustic radiation is calculated.",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Modeled string midpoint displacement"),
    ).toBeVisible();
    expect(screen.getByText("±3 mm · 2.36 cycles / 10 ms")).toBeVisible();
    expect(
      screen.queryByText(
        /modeled pressure pattern|air pressure at one point|pressure trace/i,
      ),
    ).toBeNull();
  });

  it("keeps the fallback trace labeled as midpoint displacement with units", () => {
    render(
      <svg>
        <SoundDrawing
          length={60}
          amplitude={3}
          progress={0}
          frequency={235.7}
        />
      </svg>,
    );

    expect(
      screen.getByText("STRING MIDPOINT DISPLACEMENT · ±3 mm"),
    ).toBeVisible();
    expect(
      screen.getByText("More cycles in 10 ms = higher frequency"),
    ).toBeVisible();
    expect(screen.queryByText(/air pressure at one point/i)).toBeNull();
  });

  it("gates both comparisons behind predictions and records controlled evidence", () => {
    render(<SoundPlaygroundSimulation />);

    const lengthCompare = screen.getByRole("button", {
      name: "Compare string lengths",
    });
    const amplitudeCompare = screen.getByRole("button", {
      name: "Compare pluck amplitudes",
    });
    expect(lengthCompare).toBeDisabled();
    expect(amplitudeCompare).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Half as many cycles per second",
      }),
    );
    expect(lengthCompare).toBeEnabled();
    fireEvent.click(lengthCompare);
    expect(screen.getByTestId("sound-length-feedback")).toHaveTextContent(
      "matches your prediction",
    );
    expect(screen.getByTestId("sound-length-feedback")).toHaveTextContent(
      "60 cm: 235.7 Hz · 120 cm: 117.9 Hz",
    );
    expect(screen.getByTestId("sound-length-feedback")).toHaveTextContent(
      "Changed: vibrating length",
    );

    fireEvent.click(screen.getByRole("button", { name: "Double frequency" }));
    expect(amplitudeCompare).toBeEnabled();
    fireEvent.click(amplitudeCompare);
    expect(screen.getByTestId("sound-amplitude-feedback")).toHaveTextContent(
      "differs from your prediction",
    );
    expect(screen.getByTestId("sound-amplitude-feedback")).toHaveTextContent(
      "3 mm: 235.7 Hz · 6 mm: 235.7 Hz",
    );
    expect(screen.getByTestId("sound-amplitude-feedback")).toHaveTextContent(
      "Index 9 → 36",
    );
    expect(screen.getByTestId("sound-amplitude-feedback")).toHaveTextContent(
      "Held: 60 cm length, 80 N tension, 1 g/m linear density",
    );
  });

  it("restores either evidence trial and reset clears predictions, evidence, motion and controls", () => {
    render(<SoundPlaygroundSimulation />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Half as many cycles per second",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare string lengths" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Show 60 cm evidence" }),
    );
    expect(screen.getByLabelText("Frequency")).toHaveTextContent("235.7 Hz");
    fireEvent.click(
      screen.getByRole("button", { name: "Show 120 cm evidence" }),
    );
    expect(screen.getByLabelText("Frequency")).toHaveTextContent("117.9 Hz");

    fireEvent.click(screen.getByRole("button", { name: "Same frequency" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Compare pluck amplitudes" }),
    );
    fireEvent.change(screen.getByLabelText("Slowed-motion position"), {
      target: { value: 90 },
    });
    expect(screen.getByLabelText("Slowed-motion position")).toHaveValue("90");
    fireEvent.click(screen.getByRole("button", { name: "Show 3 mm evidence" }));
    expect(screen.getByLabelText("Slowed-motion position")).toHaveValue("0");
    fireEvent.change(screen.getByLabelText("Slowed-motion position"), {
      target: { value: 90 },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show 6 mm evidence" }));
    expect(screen.getByLabelText("Slowed-motion position")).toHaveValue("0");

    fireEvent.click(screen.getByRole("button", { name: "Play slowed motion" }));
    expect(
      screen.getByRole("button", { name: "Pause slowed motion" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset lesson" }));

    expect(screen.queryByLabelText("String length")).toBeNull();
    expect(screen.queryByLabelText("String tension")).toBeNull();
    expect(screen.queryByLabelText("Model amplitude")).toBeNull();
    expect(screen.queryByTestId("sound-length-feedback")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Compare string lengths" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Play slowed motion" }),
    ).toBeNull();
  });

  it("reports zero displacement without erasing the string's natural frequency", () => {
    render(<SoundPlaygroundSimulation />);
    const frequency = screen.getByLabelText(
      "Fundamental frequency",
    ).textContent;

    fireEvent.click(
      screen.getByRole("button", {
        name: "Half as many cycles per second",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare string lengths" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Same frequency" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Compare pluck amplitudes" }),
    );
    fireEvent.change(screen.getByLabelText("Model amplitude"), {
      target: { value: 0 },
    });

    expect(screen.getByLabelText("Fundamental frequency").textContent).toBe(
      frequency,
    );
    expect(screen.getByLabelText("Relative vibration index")).toHaveTextContent(
      "0",
    );
    expect(
      screen.getByText(/no vibration is being shown or played/i),
    ).toBeVisible();
  });

  it("clears recorded evidence when a prediction is changed", () => {
    render(<SoundPlaygroundSimulation />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Half as many cycles per second",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Compare string lengths" }),
    );
    expect(screen.getByTestId("sound-length-feedback")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Same number of cycles per second",
      }),
    );
    expect(screen.queryByTestId("sound-length-feedback")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Compare string lengths" }),
    ).toBeEnabled();
  });
});
