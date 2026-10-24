import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createSpaceScene } from "./createSpaceScene";
const rendererMocks = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  forceContextLoss: vi.fn(),
  setPixelRatio: vi.fn(),
}));
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement("canvas");
      shadowMap = { enabled: false, type: 0 };
      render = rendererMocks.render;
      dispose = rendererMocks.dispose;
      forceContextLoss = rendererMocks.forceContextLoss;
      setPixelRatio = rendererMocks.setPixelRatio;
      setClearColor() {}
      setSize() {}
    },
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});
describe("demand-rendered space scene lifecycle", () => {
  it("caps pixel ratio, coalesces changes, and disposes every GPU resource", () => {
    vi.stubGlobal("WebGLRenderingContext", class {});
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    const raf = vi.fn(() => 7);
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 3,
    });
    const host = document.createElement("div");
    document.body.append(host);
    host.getBoundingClientRect = () => ({ width: 800, height: 500 }) as DOMRect;
    const texture = new THREE.Texture(),
      geometry = new THREE.BoxGeometry(),
      material = new THREE.MeshBasicMaterial({ map: texture });
    const textureDispose = vi.spyOn(texture, "dispose"),
      geometryDispose = vi.spyOn(geometry, "dispose"),
      materialDispose = vi.spyOn(material, "dispose");
    const update = vi.fn();
    const scene = createSpaceScene(
      host,
      (context) => {
        context.scene.add(new THREE.Mesh(geometry, material));
        return { update };
      },
      vi.fn(),
    );
    expect(rendererMocks.setPixelRatio).toHaveBeenCalledWith(1.5);
    scene?.update(1);
    scene?.update(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(raf).toHaveBeenCalledTimes(1);
    scene?.dispose();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(rendererMocks.dispose).toHaveBeenCalledOnce();
    expect(host.querySelector("canvas")).toBeNull();
  });
  it("retains accessible controls through the unavailable callback", () => {
    vi.stubGlobal("WebGLRenderingContext", undefined);
    const unavailable = vi.fn(),
      build = vi.fn();
    expect(
      createSpaceScene(document.createElement("div"), build, unavailable),
    ).toBeNull();
    expect(unavailable).toHaveBeenCalledOnce();
    expect(build).not.toHaveBeenCalled();
  });
});
