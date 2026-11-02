import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SoundPlaygroundSimulation } from "./SoundPlaygroundSimulation";

const lifecycle = vi.hoisted(() => ({
  pause: vi.fn(),
  audioStop: vi.fn(),
}));

vi.mock("./usePlayback", () => ({
  usePlayback: () => ({
    progress: 0,
    playing: true,
    pause: lifecycle.pause,
    reset: vi.fn(),
    setProgress: vi.fn(),
    toggle: vi.fn(),
  }),
}));
vi.mock("./useStringAudio", () => ({
  useStringAudio: () => ({
    playing: true,
    error: "",
    play: vi.fn(),
    stop: lifecycle.audioStop,
  }),
}));

it("stops motion and audio when a changed prediction relocks exploration", () => {
  render(<SoundPlaygroundSimulation />);
  fireEvent.click(
    screen.getByRole("button", { name: "Half as many cycles per second" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Compare string lengths" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Same frequency" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Compare pluck amplitudes" }),
  );
  lifecycle.pause.mockClear();
  lifecycle.audioStop.mockClear();

  fireEvent.click(screen.getByRole("button", { name: "Double frequency" }));

  expect(lifecycle.pause).toHaveBeenCalledOnce();
  expect(lifecycle.audioStop).toHaveBeenCalledOnce();
  expect(screen.queryByLabelText("String length")).toBeNull();
  expect(screen.queryByTestId("sound-amplitude-feedback")).toBeNull();
});
