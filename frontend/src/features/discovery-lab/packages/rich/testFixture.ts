export const richFixture = () => ({
  geometries: [
    {
      id: "g0",
      kind: "buffer",
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
    },
  ],
  materials: [{ id: "m0", kind: "standard", color: 0xffffff }],
  textures: [],
  nodes: [{ kind: "mesh", geometry: "g0", material: "m0" }],
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
    hemisphere: { sky: 0xffffff, ground: 0, intensity: 1 },
    directional: [],
  },
  labels: [],
  presentation: { title: "Observe", background: ["#fff", "#eee", "#ddd"] },
});
