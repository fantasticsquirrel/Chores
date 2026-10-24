import { afterEach, it, expect, vi } from "vitest";
import * as THREE from "three";
import { createRichScene } from "./createRichScene";
import { parseRichScene } from "./parseRichScene";
import { richFixture } from "./testFixture";
const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  loss: vi.fn(),
}));
vi.mock("three", async (original) => ({
  ...(await original<typeof import("three")>()),
  WebGLRenderer: class {
    domElement = document.createElement("canvas");
    shadowMap = { enabled: false, type: 0 };
    render = mocks.render;
    dispose = mocks.dispose;
    forceContextLoss = mocks.loss;
    setPixelRatio() {}
    setSize() {}
  },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("reuses GPU resources across animated transforms and disposes exactly once", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const host = document.createElement("div");
  host.getBoundingClientRect = () => ({ width: 800, height: 480 }) as DOMRect;
  const disposeGeometry = vi.spyOn(THREE.BufferGeometry.prototype, "dispose"),
    disposeMaterial = vi.spyOn(THREE.Material.prototype, "dispose");
  const initial = parseRichScene(richFixture())!;
  const runtime = createRichScene(host, initial, new Map(), vi.fn());
  const first = mocks.render.mock.calls[0][0] as THREE.Scene;
  const firstMesh = first.children.find(
    (o) => o instanceof THREE.Mesh,
  ) as THREE.Mesh;
  runtime.update({
    ...initial,
    nodes: [{ ...initial.nodes[0], position: [1, 0, 0] }],
  });
  const second = mocks.render.mock.calls.at(-1)![0] as THREE.Scene;
  const secondMesh = second.children.find(
    (o) => o instanceof THREE.Mesh,
  ) as THREE.Mesh;
  expect(secondMesh).toBe(firstMesh);
  expect(second.children.find((o) => o instanceof THREE.HemisphereLight)).toBe(
    first.children.find((o) => o instanceof THREE.HemisphereLight),
  );
  expect(secondMesh.geometry).toBe(firstMesh.geometry);
  expect(secondMesh.material).toBe(firstMesh.material);
  expect(disposeGeometry).not.toHaveBeenCalled();
  expect(runtime.pick(0.5, 0.5)).toEqual(
    expect.objectContaining({
      rayOrigin: expect.any(Array),
      rayDirection: expect.any(Array),
    }),
  );
  runtime.dispose();
  runtime.dispose();
  expect(disposeGeometry).toHaveBeenCalledTimes(1);
  expect(disposeMaterial).toHaveBeenCalledTimes(1);
  expect(mocks.dispose).toHaveBeenCalledTimes(1);
  expect(host.querySelector("canvas")).toBeNull();
});
it("cleans already-created resources when a verified asset is missing", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const s = richFixture();
  const data = parseRichScene(
    {
      ...s,
      textures: [
        {
          id: "t",
          asset: "image.png",
          width: 1,
          height: 1,
          repeat: [1, 1],
          anisotropy: 1,
        },
      ],
    },
    new Set(["image.png"]),
  )!;
  const host = document.createElement("div");
  expect(() => createRichScene(host, data, new Map(), vi.fn())).toThrow(
    "Texture asset",
  );
  expect(mocks.dispose).toHaveBeenCalledTimes(1);
  expect(host.querySelector("canvas")).toBeNull();
});
it("preserves a Z-up tabletop view when orbiting begins", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const host = document.createElement("div");
  host.getBoundingClientRect = () => ({ width: 800, height: 480 }) as DOMRect;
  const s = richFixture(),
    position: [number, number, number] = [0, -5.8, 11];
  const data = parseRichScene({
    ...s,
    camera: {
      ...s.camera,
      position,
      up: [0, 0, 1],
      radius: Math.hypot(...position),
    },
  })!;
  const runtime = createRichScene(host, data, new Map(), vi.fn());
  const initial = (
    mocks.render.mock.calls.at(-1)![1] as THREE.Camera
  ).position.clone();
  runtime.orbit(0, 0);
  const camera = mocks.render.mock.calls.at(-1)![1] as THREE.Camera;
  expect(camera.position.distanceTo(initial)).toBeLessThan(0.000001);
  runtime.dispose();
});
