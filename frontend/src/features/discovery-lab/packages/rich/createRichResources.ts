import * as THREE from "three";
import { createPathGeometry } from "./createPathGeometry";
import type { RichScene } from "./parseRichScene";
import type { RasterAssets } from "./rasterAssets";
type Resource<T> = { key: string; value: T };
/** GPU resource cache: descriptors are already validated by the bridge. */
export function createRichResources(assets: RasterAssets) {
  const geometries = new Map<string, Resource<THREE.BufferGeometry>>(),
    materials = new Map<string, Resource<THREE.Material>>(),
    textures = new Map<string, Resource<THREE.Texture>>();
  function cached<T extends { dispose(): void }>(
    cache: Map<string, Resource<T>>,
    id: string,
    key: string,
    make: () => T,
  ) {
    const old = cache.get(id);
    if (old?.key === key) return old.value;
    const value = make();
    old?.value.dispose();
    cache.set(id, { key, value });
    return value;
  }
  function prune<T extends { dispose(): void }>(
    cache: Map<string, Resource<T>>,
    ids: Set<string>,
  ) {
    for (const [id, r] of cache)
      if (!ids.has(id)) {
        r.value.dispose();
        cache.delete(id);
      }
  }
  const update = (data: RichScene) => {
    for (const t of data.textures)
      cached(textures, t.id, JSON.stringify(t), () => {
        const image = assets.get(t.asset);
        if (
          !image ||
          image.naturalWidth !== t.width ||
          image.naturalHeight !== t.height
        )
          throw Error("Texture asset missing or dimensions differ");
        const texture = new THREE.Texture(image);
        texture.needsUpdate = true;
        texture.colorSpace =
          t.colorSpace === "linear" ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT =
          t.wrap === "clamp" ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
        texture.repeat.set(...t.repeat);
        texture.anisotropy = t.anisotropy;
        texture.flipY = t.flipY ?? true;
        if (t.offset) texture.offset.set(...t.offset);
        texture.rotation = t.rotation ?? 0;
        if (t.center) texture.center.set(...t.center);
        return texture;
      });
    for (const g of data.geometries)
      cached(geometries, g.id, JSON.stringify(g), () => {
        if (g.kind === "shape" || g.kind === "extrude")
          return createPathGeometry(g);
        if (g.kind !== "buffer") {
          const a = g.args;
          switch (g.kind) {
            case "sphere":
              return new THREE.SphereGeometry(...a);
            case "box":
              return new THREE.BoxGeometry(...a);
            case "plane":
              return new THREE.PlaneGeometry(...a);
            case "cylinder":
              return new THREE.CylinderGeometry(
                a[0],
                a[1],
                a[2],
                a[3],
                a[4],
                !!a[5],
                a[6],
                a[7],
              );
            case "cone":
              return new THREE.ConeGeometry(
                a[0],
                a[1],
                a[2],
                a[3],
                !!a[4],
                a[5],
                a[6],
              );
            case "torus":
              return new THREE.TorusGeometry(...a);
            case "circle":
              return new THREE.CircleGeometry(...a);
            case "ring":
              return new THREE.RingGeometry(...a);
            case "icosahedron":
              return new THREE.IcosahedronGeometry(...a);
            case "dodecahedron":
              return new THREE.DodecahedronGeometry(...a);
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(g.positions, 3),
        );
        if (g.normals)
          geometry.setAttribute(
            "normal",
            new THREE.Float32BufferAttribute(g.normals, 3),
          );
        if (g.colors)
          geometry.setAttribute(
            "color",
            new THREE.Float32BufferAttribute(g.colors, 3),
          );
        if (g.uvs)
          geometry.setAttribute(
            "uv",
            new THREE.Float32BufferAttribute(g.uvs, 2),
          );
        if (g.indices) geometry.setIndex(g.indices);
        if (!g.normals) geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        return geometry;
      });
    for (const m of data.materials)
      cached(
        materials,
        m.id,
        JSON.stringify([
          m,
          m.map ? textures.get(m.map)?.key : null,
          m.bumpMap ? textures.get(m.bumpMap)?.key : null,
        ]),
        () => {
          const base = {
            color: m.color,
            opacity: m.opacity ?? 1,
            transparent: m.transparent ?? false,
            side: m.side ?? THREE.FrontSide,
            depthWrite: m.depthWrite ?? true,
            depthTest: m.depthTest ?? true,
            vertexColors: m.vertexColors ?? false,
            toneMapped: m.toneMapped ?? true,
          };
          const mesh = {
            ...base,
            map: m.map ? textures.get(m.map)!.value : null,
            wireframe: m.wireframe ?? false,
          };
          const standard = {
            ...mesh,
            roughness: m.roughness ?? 1,
            metalness: m.metalness ?? 0,
            emissive: m.emissive ?? 0,
            emissiveIntensity: m.emissiveIntensity ?? 1,
            bumpMap: m.bumpMap ? textures.get(m.bumpMap)!.value : null,
            bumpScale: m.bumpScale ?? 1,
            flatShading: m.flatShading ?? false,
          };
          switch (m.kind) {
            case "physical":
              return new THREE.MeshPhysicalMaterial({
                ...standard,
                transmission: m.transmission ?? 0,
                thickness: m.thickness ?? 0,
                ior: m.ior ?? 1.5,
              });
            case "standard":
              return new THREE.MeshStandardMaterial(standard);
            case "basic":
              return new THREE.MeshBasicMaterial(mesh);
            case "points":
              return new THREE.PointsMaterial({
                ...base,
                size: m.size ?? 1,
                sizeAttenuation: m.sizeAttenuation ?? true,
              });
            case "shadow":
              return new THREE.ShadowMaterial(base);
            case "dashed":
              return new THREE.LineDashedMaterial({
                ...base,
                dashSize: m.dashSize ?? 3,
                gapSize: m.gapSize ?? 1,
              });
            case "line":
              return new THREE.LineBasicMaterial(base);
          }
        },
      );
    prune(materials, new Set(data.materials.map((m) => m.id)));
    prune(geometries, new Set(data.geometries.map((g) => g.id)));
    prune(textures, new Set(data.textures.map((t) => t.id)));
  };
  const dispose = () => {
    for (const cache of [geometries, materials, textures])
      for (const resource of cache.values()) resource.value.dispose();
    geometries.clear();
    materials.clear();
    textures.clear();
  };
  return { update, dispose, geometries, materials };
}
