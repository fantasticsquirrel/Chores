/** Independent check that fixed authored cameras cannot be manipulated through host controls. */
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RichSceneView from "./RichSceneView";
import { parseRichScene } from "./parseRichScene";
import { richFixture } from "./testFixture";
const runtime = vi.hoisted(() => ({
  orbit: vi.fn(),
  zoomBy: vi.fn(),
  setView: vi.fn(),
  update: vi.fn(),
  dispose: vi.fn(),
  pick: vi.fn(),
}));
vi.mock("./createRichScene", () => ({ createRichScene: () => runtime }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("blocks keyboard and pointer camera movement while preserving the bounded stage layout", () => {
  const s = richFixture();
  const scene = parseRichScene({
    ...s,
    camera: { ...s.camera, interactive: false },
    presentation: {
      ...s.presentation,
      layout: { height: 420, canvasInset: [-20, 0, -20, 0] },
    },
  })!;
  const { container } = render(
    <RichSceneView
      scene={scene}
      description="Fixed scene"
      assets={new Map()}
    />,
  );
  const host = screen.getByRole("img", { name: "Fixed scene" });
  Object.defineProperty(host, "setPointerCapture", { value: vi.fn() });
  Object.defineProperty(host, "releasePointerCapture", { value: vi.fn() });
  for (const key of [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "+",
    "=",
    "-",
    "Home",
  ])
    fireEvent.keyDown(host, { key });
  fireEvent(
    host,
    new MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    }),
  );
  expect(host.setPointerCapture).toHaveBeenCalled();
  fireEvent(
    host,
    new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 100,
      clientY: 100,
    }),
  );
  fireEvent(
    host,
    new MouseEvent("pointerup", { bubbles: true, clientX: 100, clientY: 100 }),
  );
  expect(runtime.orbit).not.toHaveBeenCalled();
  expect(runtime.zoomBy).not.toHaveBeenCalled();
  expect(runtime.setView).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
  expect(container.firstChild).toHaveStyle({
    height: "420px",
    overflow: "hidden",
  });
  expect(host).toHaveStyle({ inset: "-20px 0px -20px 0px" });
});
