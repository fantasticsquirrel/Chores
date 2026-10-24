// Build-time only. Requires the optional @napi-rs/canvas authoring tool; no Canvas/DOM code enters installed workers.
const { buildSync } = require(process.cwd() + "/node_modules/esbuild");
const vm = require("vm"),
  fs = require("fs");
const { createCanvas } = require("@napi-rs/canvas");
const out = buildSync({
  entryPoints: [
    "scripts/exploration-packages/fraction-feast/texture-author.ts",
  ],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
const mod = { exports: {} };
vm.runInNewContext(out.outputFiles[0].text, {
  module: mod,
  exports: mod.exports,
  document: { createElement: () => createCanvas(1, 1) },
  console,
});
const api = mod.exports;
for (const id of ["fraction-feast", "chance-carnival"]) {
  const dir = `scripts/exploration-packages/${id}/assets`;
  fs.mkdirSync(dir, { recursive: true });
  const save = (name, t) =>
    fs.writeFileSync(`${dir}/${name}.png`, t.image.toBuffer("image/png"));
  if (id === "fraction-feast") {
    save("wood", api.woodTexture());
    save("bread", api.foodTexture("#e9b66b", "#74401b", 160));
    save("cheese", api.foodTexture("#ffe6a0", "#ad5f26", 100));
    save("pepperoni", api.foodTexture("#b9482c", "#f4bc80", 200));
    for (let n = 1; n <= 24; n++)
      save(`number-${n}`, api.numberTexture(n, "#685d4a"));
  } else {
    for (let n = 1; n <= 6; n++) {
      save(`pips-${n}`, api.pipsTexture(n));
      save(`number-${n}`, api.numberTexture(n, "#273f38"));
    }
  }
}
