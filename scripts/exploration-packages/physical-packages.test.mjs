import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
const topics = [
  "machine-workshop",
  "heat-house",
  "pressure-tank",
  "moving-plates",
  "cloud-rain-lab",
  "magnetic-fields",
  "cell-explorer",
  "shape-slicer",
  "adaptation-island",
];
const parserBuild = await build({
  entryPoints: ["frontend/src/features/discovery-lab/packages/bridge.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
});
const parserContext = {
  exports: {},
  module: { exports: {} },
  require: () => {
    throw Error("unexpected dependency");
  },
  TextEncoder,
  TextDecoder,
  console,
  process: { env: { NODE_ENV: "production" } },
};
parserContext.exports = parserContext.module.exports;
vm.runInNewContext(parserBuild.outputFiles[0].text, parserContext);
const { parseScene } = parserContext.module.exports;
export async function worker(topic) {
  const buildResult = await build({
    entryPoints: [`scripts/exploration-packages/${topic}/worker.ts`],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    minify: true,
    target: "es2020",
  });
  assert.ok(
    buildResult.outputFiles[0].contents.length <= 1048576,
    `${topic} source budget`,
  );
  let result, previous;
  const context = {
    console,
    TextEncoder,
    TextDecoder,
    structuredClone,
    performance,
    postMessage: (value) => {
      result = value;
    },
  };
  vm.createContext(context);
  vm.runInContext(buildResult.outputFiles[0].text, context);
  return (input) => {
    context.onmessage({ data: input });
    assert.ok(
      JSON.stringify(result).length <= 4194304,
      `${topic} frame budget`,
    );
    const parsed = parseScene(result, "rich", new Set(), previous);
    assert.ok(
      parsed,
      `${topic}: ${input.type} ${input.control ?? ""} frame validates`,
    );
    previous = parsed;
    return structuredClone({ ...result, scene3d: parsed.rich3d });
  };
}
for (const topic of topics)
  test(`${topic}: independent worker, all controls, guided comparisons and reset`, async () => {
    const send = await worker(topic);
    const initial = send({ type: "step", values: {} });
    assert.equal(initial.animate, false);
    assert.ok(initial.scene3d.geometries.length > 10);
    assert.equal(initial.sections.length, 3);
    assert.ok(initial.footnote.length > 100);
    for (const control of initial.controls)
      for (const value of control.options?.map((o) => o.value) ?? [
        control.min,
        control.max,
      ])
        send({
          type: "control",
          control: control.id,
          values: { [control.id]: value },
        });
    for (const i of [0, 1]) {
      send({ type: "reset", values: {} });
      send({ type: "control", control: `trial_${i}`, values: {} });
      const gated = send({
        type: "control",
        control: "comparison",
        values: {},
      });
      assert.match(gated.sections[2].text, /After comparing/);
      send({ type: "control", control: "predict_0", values: {} });
      const baseline = send({
        type: "control",
        control: "baseline",
        values: {},
      });
      assert.match(baseline.sections[1].text, /Baseline is set/);
      const compared = send({
        type: "control",
        control: "comparison",
        values: {},
      });
      assert.doesNotMatch(compared.sections[2].text, /After comparing/);
    }
    const reset = send({ type: "reset", values: {} });
    assert.deepEqual(reset.controls, initial.controls);
    assert.equal(reset.description, initial.description);
    for (const button of initial.buttons.filter(
      (b) => !/^trial_|^predict_|^baseline$|^comparison$/.test(b.id),
    ))
      send({ type: "control", control: button.id, values: {} });
  });
test("specific physical relationships stay observable", async () => {
  const machine = await worker("machine-workshop");
  machine({ type: "step", values: {} });
  let s = machine({ type: "control", control: "liftM", values: { liftM: 0 } });
  assert.match(s.description, /Input work 0.0 J/);
  assert.match(s.description, /Effort 196.2 N/);
  const pressure = await worker("pressure-tank");
  pressure({ type: "step", values: {} });
  s = pressure({
    type: "control",
    control: "outletM",
    values: { outletM: 2.5 },
  });
  assert.match(s.description, /no outward water jet/);
  const magnet = await worker("magnetic-fields");
  magnet({ type: "step", values: {} });
  magnet({ type: "control", control: "flipped", values: { flipped: 1 } });
  s = magnet({ type: "control", control: "probeZ", values: { probeZ: 0 } });
  assert.match(s.description, /no preferred compass direction/);
  const cell = await worker("cell-explorer");
  cell({ type: "step", values: {} });
  s = cell({ type: "control", control: "transfer", values: {} });
  assert.match(s.description, /Outside 11.0; inside 5.0/);
  assert.match(s.description, /16.0/);
  const shape = await worker("shape-slicer");
  shape({ type: "step", values: {} });
  s = shape({ type: "control", control: "diagonal", values: {} });
  assert.match(s.description, /hexagon/i);
  assert.ok(s.vector.nodes.length > 20);
  const island = await worker("adaptation-island");
  island({ type: "step", values: {} });
  island({
    type: "control",
    control: "initialDark",
    values: { initialDark: 0 },
  });
  s = island({ type: "control", control: "five", values: {} });
  assert.match(s.description, /Current dark 0.0%/);
});
test("all nine package-local scenes and teaching models preserve original default geometry", async () => {
  const specs = [
    [
      "machine-workshop",
      "mechanics/machineScene",
      "createMachineScene",
      "mechanics",
      "defaultMachineState",
    ],
    [
      "heat-house",
      "mechanics/heatScene",
      "createHeatScene",
      "mechanics",
      "defaultHeatState",
    ],
    [
      "pressure-tank",
      "mechanics/pressureScene",
      "createPressureScene",
      "mechanics",
      "defaultPressureState",
    ],
    [
      "moving-plates",
      "earth/plates",
      "createMovingPlatesScene",
      "earth",
      "initialPlate",
    ],
    [
      "cloud-rain-lab",
      "earth/clouds",
      "createCloudRainScene",
      "earth",
      "initialCloud",
    ],
    [
      "magnetic-fields",
      "earth/magnets",
      "createMagneticFieldsScene",
      "earth",
      "initialMagnetic",
    ],
    [
      "cell-explorer",
      "life-geometry/cell",
      "createCellExplorerScene",
      "life-geometry",
      "defaultCellExplorerState",
    ],
    [
      "shape-slicer",
      "life-geometry/shape",
      "createShapeSlicerScene",
      "life-geometry",
      "defaultShapeSlicerState",
    ],
    [
      "adaptation-island",
      "life-geometry/island",
      "createAdaptationIslandScene",
      "life-geometry",
      "defaultAdaptationIslandState",
    ],
  ];
  for (const [topic, path, factory, group, initial] of specs) {
    const leaf = path.split("/").at(-1);
    const contents = `import {${factory} as original} from './packages/discovery-scenes/src/expansion/${path}'; import {${factory} as converted} from './scripts/exploration-packages/${topic}/${leaf}'; import {${initial} as a} from './packages/family-api/src/discovery-models/expansion-${group}'; import {${initial} as b} from './scripts/exploration-packages/${topic}/model'; import {serializeExpansionScene} from './scripts/exploration-packages/shared/serialize-scene'; const p={title:'Parity',background:['#10212b','#142b35','#10212b']}; globalThis.result=[serializeExpansionScene(original(a),p),serializeExpansionScene(converted(b),p)];`;
    const bundle = await build({
      stdin: { contents, resolveDir: process.cwd(), loader: "ts" },
      bundle: true,
      write: false,
      platform: "node",
      format: "iife",
    });
    const context = { console };
    vm.runInNewContext(bundle.outputFiles[0].text, context);
    assert.deepEqual(
      JSON.parse(JSON.stringify(context.result[0])),
      JSON.parse(JSON.stringify(context.result[1])),
      `${topic} original geometry/materials/labels/camera parity`,
    );
  }
});
test("mechanical marker drag rays update controls and misses leave orbit available", async () => {
  for (const [topic, control, point, expected] of [
    ["machine-workshop", "liftM", [-2.8, 1.26, 20], 0.8],
    ["heat-house", "insulationCm", [-3.1, 0.4, 20], 10],
    ["pressure-tank", "depthM", [-3, 2.48, 20], 2.3],
  ]) {
    const send = await worker(topic);
    send({ type: "step", values: {} });
    const hit = send({
      type: "pointer",
      pointer: {
        phase: "down",
        x: 0.5,
        y: 0.5,
        rayOrigin: point,
        rayDirection: [0, 0, -1],
      },
      values: {},
    });
    assert.equal(
      hit.controls.find((c) => c.id === control).value,
      expected,
      topic + " selected marker",
    );
    assert.equal(hit.pointerMode, "drag");
    send({
      type: "pointer",
      pointer: {
        phase: "up",
        x: 0.5,
        y: 0.5,
        rayOrigin: point,
        rayDirection: [0, 0, -1],
      },
      values: {},
    });
    const miss = send({
      type: "pointer",
      pointer: {
        phase: "down",
        x: 1,
        y: 1,
        rayOrigin: [100, 100, 100],
        rayDirection: [0, 0, -1],
      },
      values: {},
    });
    assert.equal(miss.pointerMode, "tap", topic + " orbit after miss");
  }
});
test("manual changes invalidate stale comparison evidence and require a fresh baseline", async () => {
  for (const topic of ["machine-workshop", "heat-house", "pressure-tank"]) {
    const send = await worker(topic);
    const initial = send({ type: "step", values: {} });
    send({ type: "control", control: "predict_0", values: {} });
    send({ type: "control", control: "baseline", values: {} });
    send({ type: "control", control: "comparison", values: {} });
    const control = initial.controls.find((c) => !c.kind);
    const changed = send({
      type: "control",
      control: control.id,
      values: { [control.id]: control.max },
    });
    assert.match(changed.sections[2].text, /After comparing/);
    const gated = send({ type: "control", control: "comparison", values: {} });
    assert.match(gated.sections[2].text, /After comparing/);
  }
});
