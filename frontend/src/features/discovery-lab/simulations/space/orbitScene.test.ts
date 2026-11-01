import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { orbitActivity } from "@family-manager/family-api/discovery-models/orbit";
import { buildOrbitScene } from "./orbitScene";

afterEach(() => vi.restoreAllMocks());

describe("dimensional Orbit scene", () => {
  it("renders the shared trajectory with a textured planet, atmosphere and detailed probe", () => {
    const texture = new THREE.Texture(document.createElement("img"));
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockReturnValue(texture);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 150);
    const renderer = {
      capabilities: { getMaxAnisotropy: () => 16 },
    } as unknown as THREE.WebGLRenderer;
    const exhibit = buildOrbitScene(
      { scene, camera, renderer, invalidate: vi.fn() },
      "earth.jpg",
    );
    const result = orbitActivity({ speed: 1, mass: 1 });

    exhibit.resize?.(1.8);
    exhibit.update({ points: result.points, progress: 0 });

    const planet = scene.getObjectByName("orbit-planet")!;
    const probe = scene.getObjectByName("orbit-probe")!;
    const future = scene.getObjectByName("orbit-future-path") as THREE.Line;
    expect(texture.anisotropy).toBe(8);
    expect(planet.children.length).toBeGreaterThanOrEqual(2);
    expect(probe.children.length).toBeGreaterThan(12);
    expect(future.geometry.getAttribute("position").count).toBe(
      result.points.length,
    );
    expect(
      scene.children.filter((child) => child instanceof THREE.Light),
    ).toHaveLength(3);
    expect(camera.top).toBeLessThan(1);
    expect(probe.position.x).toBeCloseTo(1);
  });

  it("keeps the final incoming motion direction visible", () => {
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockReturnValue(
      new THREE.Texture(document.createElement("img")),
    );
    const scene = new THREE.Scene();
    const exhibit = buildOrbitScene(
      {
        scene,
        camera: new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 150),
        renderer: {
          capabilities: { getMaxAnisotropy: () => 4 },
        } as unknown as THREE.WebGLRenderer,
        invalidate: vi.fn(),
      },
      "earth.jpg",
    );
    const result = orbitActivity({ speed: 1, mass: 2 });

    exhibit.update({ points: result.points, progress: 1 });

    const motion = scene.getObjectByName(
      "orbit-motion-vector",
    ) as THREE.ArrowHelper;
    const traveled = scene.getObjectByName("orbit-traveled-path") as THREE.Line;
    expect(motion.visible).toBe(true);
    expect(motion.scale.y).toBeGreaterThan(0);
    expect(traveled.geometry.drawRange.count).toBe(result.points.length);
  });

  it("follows the calculated probe position on an escape without changing its points", () => {
    vi.spyOn(THREE.TextureLoader.prototype, "load").mockReturnValue(
      new THREE.Texture(document.createElement("img")),
    );
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 150);
    const exhibit = buildOrbitScene(
      {
        scene,
        camera,
        renderer: {
          capabilities: { getMaxAnisotropy: () => 4 },
        } as unknown as THREE.WebGLRenderer,
        invalidate: vi.fn(),
      },
      "earth.jpg",
    );
    const result = orbitActivity({ speed: 1.42, mass: 1 });
    const originalLast = { ...result.points.at(-1)! };

    exhibit.resize?.(1);
    exhibit.update({
      points: result.points,
      progress: 1,
      cameraMode: "follow",
    });

    const probe = scene.getObjectByName("orbit-probe")!;
    expect(Math.hypot(probe.position.x, probe.position.z)).toBeGreaterThan(5);
    expect(camera.position.distanceTo(probe.position)).toBeGreaterThan(8);
    expect(result.points.at(-1)).toEqual(originalLast);
  });
});
