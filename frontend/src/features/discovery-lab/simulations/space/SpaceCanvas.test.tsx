import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpaceCanvas } from "./SpaceCanvas";

let unavailable = false;
const update = vi.fn();
const dispose = vi.fn();

vi.mock("./createSpaceScene", () => ({
  createSpaceScene: (
    host: HTMLElement,
    _build: unknown,
    onUnavailable: () => void,
  ) => {
    if (unavailable) {
      onUnavailable();
      return null;
    }
    host.dataset.sceneReady = "true";
    return { update, dispose };
  },
}));

afterEach(cleanup);
beforeEach(() => {
  unavailable = false;
  update.mockClear();
  dispose.mockClear();
});

describe("SpaceCanvas orbit controls", () => {
  it("supports keyboard scrubbing without requiring continuous motion", async () => {
    const onProgress = vi.fn();
    render(
      <SpaceCanvas
        kind="orbit"
        state={{ points: [{ x: 1, y: 0 }], progress: 0.4 }}
        progress={0.4}
        onProgress={onProgress}
        label="Dimensional orbit scene"
      />,
    );
    const scene = screen.getByRole("img", { name: "Dimensional orbit scene" });
    await waitFor(() => expect(update).toHaveBeenCalled());

    fireEvent.keyDown(scene, { key: "ArrowRight" });
    fireEvent.keyDown(scene, { key: "ArrowLeft" });
    fireEvent.keyDown(scene, { key: "End" });
    fireEvent.keyDown(scene, { key: "Home" });
    const values = onProgress.mock.calls.map(([value]) => value as number);
    expect(values[0]).toBeCloseTo(0.425);
    expect(values.slice(1)).toEqual([0.375, 0.9999, 0]);
    expect(scene).toHaveAttribute(
      "aria-keyshortcuts",
      "ArrowLeft ArrowRight Home End",
    );
  });

  it("keeps model results available when 3D rendering is unavailable", async () => {
    unavailable = true;
    render(
      <SpaceCanvas
        kind="orbit"
        state={{ points: [{ x: 1, y: 0 }], progress: 0 }}
        progress={0}
        onProgress={() => undefined}
        label="Bound orbit at baseline speed and mass."
        fallbackLabel="Bound orbit. Gravity keeps curving the probe inward."
      />,
    );

    expect(await screen.findByText("3D view unavailable")).toBeVisible();
    expect(
      screen.getByText(
        /comparison diagrams below still report the model results/,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Bound orbit at baseline speed and mass.",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Bound orbit. Gravity keeps curving the probe inward."),
    ).toBeVisible();
  });
});
