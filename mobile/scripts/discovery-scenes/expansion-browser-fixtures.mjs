export const expansionCases = [
  {
    kind: "machine-workshop",
    initial: { mode: "pulley", loadKg: 40, advantage: 2, liftM: 0.5 },
    changed: { mode: "gears", loadKg: 80, advantage: 4, liftM: 1 },
  },
  {
    kind: "heat-house",
    initial: {
      insulationCm: 5,
      windowM2: 8,
      material: "brick",
      insideC: 20,
      outsideC: 0,
    },
    changed: {
      insulationCm: 20,
      windowM2: 18,
      material: "wood",
      insideC: 24,
      outsideC: -5,
    },
  },
  {
    kind: "pressure-tank",
    initial: { depthM: 2, outletM: 0.5, shape: "narrow" },
    changed: { depthM: 2.8, outletM: 1, shape: "wide" },
  },
  {
    kind: "moving-plates",
    initial: { boundary: "divergent", movement: 20, stress: 0, slips: 0 },
    changed: { boundary: "convergent", movement: 70, stress: 0, slips: 0 },
  },
  {
    kind: "cloud-rain-lab",
    initial: {
      temperatureC: 22,
      vaporGPerKg: 10,
      upliftM: 1400,
      dropletGrowth: 30,
    },
    changed: {
      temperatureC: 22,
      vaporGPerKg: 14,
      upliftM: 2000,
      dropletGrowth: 90,
    },
  },
  {
    kind: "magnetic-fields",
    initial: { gap: 2, flipped: false, probeX: 0, probeZ: 2 },
    changed: { gap: 4, flipped: true, probeX: 2, probeZ: -2 },
  },
  {
    kind: "cell-explorer",
    initial: {
      cellType: "plant",
      selected: "membrane",
      molecule: "oxygen",
      carrier: false,
      outside: 12,
      inside: 4,
    },
    changed: {
      cellType: "animal",
      selected: "nucleus",
      molecule: "glucose",
      carrier: true,
      outside: 9,
      inside: 7,
    },
  },
  {
    kind: "shape-slicer",
    initial: { solid: "cube", tilt: 0, turn: 0, offset: 0 },
    changed: { solid: "sphere", tilt: 45, turn: 35, offset: 0.6 },
  },
  {
    kind: "adaptation-island",
    initial: {
      habitat: "dark",
      predators: true,
      generation: 0,
      darkCount: 50,
      lightCount: 50,
      initialDark: 50,
    },
    changed: {
      habitat: "light",
      predators: false,
      generation: 5,
      darkCount: 20,
      lightCount: 80,
      initialDark: 50,
    },
  },
].map(({ kind, initial, changed }) => ({
  kind,
  initial: { kind, ...initial },
  changed: { kind, ...changed },
}));
