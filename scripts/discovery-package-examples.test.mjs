import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(
  new URL(
    "../docs/examples/discovery-packages/pendulum-period/pendulum.js",
    import.meta.url,
  ),
  "utf8",
);
function run(values = {}, type = "control") {
  let scene;
  const context = vm.createContext({
    self: {
      postMessage: (value) => {
        scene = value;
      },
    },
  });
  vm.runInContext(source, context, { timeout: 500 });
  context.input = { type, values, time: 0, dt: 0, width: 800, height: 480 };
  vm.runInContext("self.onmessage({data:input})", context, { timeout: 500 });
  return JSON.parse(JSON.stringify(scene));
}
function period(scene) {
  return Number(
    scene.shapes
      .find((shape) => shape.text?.startsWith("Period:"))
      .text.match(/[\d.]+/)[0],
  );
}

test("quadrupling pendulum length doubles period, mass does not affect it", () => {
  assert.equal(period(run({ length: 2 })), 2 * period(run({ length: 0.5 })));
  const light = run({ length: 1, mass: 0.5, time: 1 });
  const heavy = run({ length: 1, mass: 2, time: 1 });
  assert.equal(period(light), period(heavy));
  const curve = (scene) =>
    scene.shapes.filter((shape) => shape.stroke === "#66d5e5");
  assert.deepEqual(curve(light), curve(heavy));
});

test("time scrub changes position; reset returns deterministic starting state", () => {
  assert.notDeepEqual(run({ time: 0 }), run({ time: 1 }));
  assert.deepEqual(
    run({ time: 8, length: 2, mass: 2 }, "reset"),
    run({}, "reset"),
  );
});

test("all boundary combinations produce bounded finite evidence and vector shapes", () => {
  for (const length of [0.5, 1, 2])
    for (const mass of [0.5, 1, 2])
      for (const time of [0, 1, 5, 10]) {
        const scene = run({ length, mass, time });
        assert.ok(scene.description.length < 2000);
        assert.ok(scene.shapes.length <= 256);
        assert.ok(JSON.stringify(scene).length < 64000);
        assert.equal(scene.controls.length, 3);
        for (const shape of scene.shapes) {
          assert.ok(["line", "rect", "circle", "text"].includes(shape.kind));
          for (const value of Object.values(shape))
            if (typeof value === "number") {
              assert.ok(Number.isFinite(value));
              assert.ok(Math.abs(value) <= 2000);
            }
        }
      }
});
