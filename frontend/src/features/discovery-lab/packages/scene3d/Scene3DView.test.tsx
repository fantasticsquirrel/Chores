import { render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import Scene3DView from "./Scene3DView";
import { parseScene3D } from "./parseScene3D";
vi.mock("./createScene3D", () => ({
  createScene3D: () => {
    throw Error("WebGL unavailable");
  },
}));
it("shows package-authored fallback without changing the working WebGL contract", () => {
  const scene = parseScene3D({
    materials: [{ id: "m", kind: "basic", color: 0 }],
    textures: [],
    nodes: [],
    camera: {
      target: [0, 0, 0],
      radius: 10,
      yaw: 0,
      elevation: 0.7,
      zoom: 1,
      halfHeight: 5,
      narrowHalfWidth: 5,
      narrowAspect: 1,
      presets: [],
    },
    lighting: {
      hemisphere: { sky: 0, ground: 0, intensity: 1 },
      directional: [],
    },
    labels: [],
    presentation: {
      title: "Compare walls",
      background: ["#fff", "#eee", "#ddd"],
    },
  })!;
  render(
    <Scene3DView
      scene={scene}
      description="Compare defenses"
      fallback={<svg role="img" aria-label="Package fallback castle" />}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("3D view unavailable");
  expect(
    screen.getByRole("img", { name: "Package fallback castle" }),
  ).toBeInTheDocument();
});
