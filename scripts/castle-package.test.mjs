import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
const base = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, base), "utf8");
const source = read(
  "docs/examples/discovery-packages/castle-defenses/castle.js",
);
function simulation() {
  let output;
  const context = vm.createContext({
    self: {
      postMessage: (value) => {
        output = JSON.parse(JSON.stringify(value));
      },
    },
  });
  vm.runInContext(source, context, { timeout: 500 });
  return (type = "reset", values = {}, control) => {
    context.input = {
      type,
      values,
      control,
      time: 0,
      dt: 0,
      width: 800,
      height: 480,
    };
    vm.runInContext("self.onmessage({data:input})", context, { timeout: 500 });
    return output;
  };
}
const valuesOf = (s) =>
  Object.fromEntries(s.controls.map((c) => [c.id, c.value]));
function nodesOf(s) {
  const result = [];
  const visit = (n) => {
    result.push(n);
    (n.children ?? []).forEach(visit);
  };
  s.scene3d.nodes.forEach(visit);
  return result;
}

test("castle independent source retains every original geometry and landscape detail", () => {
  for (const file of [
    "castleGeometry.ts",
    "castleStructure.ts",
    "castleLandscape.ts",
  ]) {
    const original = read(
      "frontend/src/features/discovery-lab/simulations/castle/" + file,
    );
    const authored = read("scripts/castle-package/" + file)
      .replace(
        "// Independent package authoring source, copied from the bundled Castle reference.\n",
        "",
      )
      .replace('from "./scene-builder"', 'from "three"');
    assert.equal(authored, original, `${file} lost fidelity`);
  }
  for (const file of readdirSync(new URL("scripts/castle-package/", base))) {
    const authored = read("scripts/castle-package/" + file);
    assert.doesNotMatch(authored, /from ["'](?:three|react|.*frontend.*)["']/);
  }
  assert.ok(source.length < 262144);
  assert.doesNotMatch(
    source,
    /\b(?:fetch|XMLHttpRequest|importScripts|document|window)\s*[.(]/,
  );
});

test("default castle preserves rich geometry and resets sight overlay off", () => {
  const run = simulation(),
    initial = run();
  assert.deepEqual(valuesOf(initial), {
    approach: 0,
    moat: 22,
    gate: 1,
    towers: 1,
    inner: 0,
    sight: 0,
  });
  assert.equal(initial.animate, false);
  assert.equal(initial.scene3d.textures[0].rects.length, 3201);
  const nodes = nodesOf(initial);
  assert.ok(nodes.length > 500, "not a simplified replacement");
  for (const kind of [
    "box",
    "cylinder",
    "torus",
    "circle",
    "icosahedron",
    "extrude",
    "line",
  ])
    assert.ok(
      nodes.some((n) => n.geometry?.kind === kind),
      kind,
    );
  assert.equal(initial.scene3d.camera.presets.length, 4);
  const altered = run("control", {
    ...valuesOf(initial),
    sight: 1,
    inner: 1,
    towers: 0,
    gate: 0,
    moat: 0,
    approach: 1,
  });
  assert.notDeepEqual(altered.scene3d.nodes, initial.scene3d.nodes);
  assert.deepEqual(run("reset", valuesOf(altered)), initial);
});

test("castle route/visibility observations and guided actions are causal", () => {
  const run = simulation();
  let s = run();
  const initial = valuesOf(s);
  s = run("control", initial, "testPrediction");
  assert.deepEqual(valuesOf(s), initial);
  assert.match(s.sections[0].text, /Choose a prediction/);
  assert.equal(
    s.buttons.find((button) => button.id === "testPrediction").disabled,
    true,
  );
  s = run("control", valuesOf(s), "routeBridge");
  assert.match(s.sections[0].text, /Your prediction: bridge/);
  s = run("control", valuesOf(s), "testPrediction");
  assert.equal(valuesOf(s).gate, 0);
  assert.match(s.description, /bridge route reaches outer entrance/);
  assert.match(s.sections[2].text, /matches your prediction/);
  assert.match(s.sections[2].text, /Changed: approach route/);
  assert.match(s.sections[2].text, /Held: open gate · 22 m ditch/);
  s = run("control", valuesOf(s), "showSecond");
  assert.equal(valuesOf(s).approach, 1);
  assert.match(s.description, /north route stops at ditch/);
  s = run("control", { ...valuesOf(s), moat: 0 });
  assert.match(s.description, /reaches solid outer wall/);
  s = run("control", valuesOf(s), "compareViews");
  s = run("control", valuesOf(s), "testPrediction");
  assert.equal(valuesOf(s).sight, 0);
  assert.equal(valuesOf(s).towers, 1);
  s = run("control", valuesOf(s), "viewTower");
  s = run("control", valuesOf(s), "testPrediction");
  assert.equal(valuesOf(s).sight, 1);
  assert.equal(valuesOf(s).towers, 1);
  assert.match(s.sections[2].text, /matches your prediction/);
  s = run("control", valuesOf(s), "showFirst");
  assert.equal(valuesOf(s).towers, 0);
  const without = nodesOf(s).filter(
    (n) =>
      n.kind === "line" &&
      n.material === s.scene3d.materials.find((m) => m.kind === "dashed").id,
  );
  assert.equal(without.length, 1);
  s = run("control", valuesOf(s), "showSecond");
  assert.equal(valuesOf(s).towers, 1);
  const withTowers = nodesOf(s).filter(
    (n) =>
      n.kind === "line" &&
      n.material === s.scene3d.materials.find((m) => m.kind === "dashed").id,
  );
  assert.equal(withTowers.length, 2);
  assert.equal(
    s.controls.find((c) => c.id === "sight").label,
    "Sight-line overlay (not structures)",
  );
  assert.equal(
    s.scene3d.materials.find((m) => m.kind === "dashed").color,
    0x58e8ee,
  );
  assert.equal(s.scene3d.labels.length, 0);
  assert.doesNotMatch(JSON.stringify(s), /siegeOutcome/);
});

test("castle package metadata stays aligned with the native exploration registry", () => {
  const manifest = JSON.parse(
    read("docs/examples/discovery-packages/castle-defenses/manifest.json"),
  );
  const registry = JSON.parse(
    read("packages/family-api/discovery-explorations.json"),
  ).find((entry) => entry.id === "castle-defenses");
  assert.equal(manifest.version, "1.1.0");
  assert.deepEqual(
    { ...manifest.exploration, id: "castle-defenses" },
    registry,
  );
});

test("all castle boundary combinations stay within transport and node bounds", () => {
  const run = simulation();
  for (const moat of [0, 1, 22, 36])
    for (const approach of [0, 1])
      for (const gate of [0, 1])
        for (const towers of [0, 1])
          for (const inner of [0, 1])
            for (const sight of [0, 1]) {
              const s = run("control", {
                moat,
                approach,
                gate,
                towers,
                inner,
                sight,
              });
              assert.ok(JSON.stringify(s).length <= 524288);
              assert.ok(s.description.length <= 2000);
              assert.ok(nodesOf(s).length <= 1024);
              assert.ok(s.scene3d.nodes.length === 3);
              assert.ok(!JSON.stringify(s).includes("NaN"));
            }
});
