import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
const base = new URL("../", import.meta.url);
const entry = new URL("scripts/castle-package/castle-worker.ts", base).pathname;
const output = new URL(
  "docs/examples/discovery-packages/castle-defenses/castle.js",
  base,
);
await build({
  entryPoints: [entry],
  outfile: output.pathname,
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2020",
  minify: false,
  legalComments: "none",
});
const manifestPath = new URL(
  "docs/examples/discovery-packages/castle-defenses/manifest.json",
  base,
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const registry = JSON.parse(
  readFileSync(
    new URL("packages/family-api/discovery-explorations.json", base),
    "utf8",
  ),
);
const exploration = registry.find((entry) => entry.id === "castle-defenses");
if (!exploration) throw new Error("castle-defenses registry entry is missing");
manifest.version = "1.1.0";
manifest.exploration = { ...exploration, id: manifest.package_id };
manifest.assets[0].sha256 = createHash("sha256")
  .update(readFileSync(output))
  .digest("hex");
writeFileSync(
  manifestPath,
  await format(JSON.stringify(manifest), { parser: "json" }),
);
console.log(
  `Built independent castle worker (${readFileSync(output).length} bytes).`,
);
