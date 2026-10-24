/** Package build only: does not build or deploy the application. */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const registry = JSON.parse(
  readFileSync(
    join(root, "packages/family-api/discovery-explorations.json"),
    "utf8",
  ),
);
const selection = process.argv.slice(2);
if (selection.some((id) => !registry.some((item) => item.id === id)))
  throw Error("Unknown exploration selection.");
const topics = selection.length
  ? registry.filter((item) => selection.includes(item.id))
  : registry;
const mime = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".json": "application/json",
};
function copyAssets(source, destination, assets) {
  if (!existsSync(source)) return;
  for (const item of readdirSync(source, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw Error("Symlink assets are not allowed.");
    const input = join(source, item.name),
      output = join(destination, item.name);
    if (item.isDirectory()) copyAssets(input, output, assets);
    else if (item.isFile()) {
      const type = mime[item.name.slice(item.name.lastIndexOf("."))];
      if (!type) throw Error(`Unsupported asset ${item.name}`);
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, readFileSync(input));
      assets.push({ output, mime_type: type });
    }
  }
}
for (const original of topics) {
  if (original.id === "castle-defenses") {
    await import("./build-castle-package.mjs");
    continue;
  }
  const source = join(root, "scripts/exploration-packages", original.id);
  const entry = join(source, "worker.ts");
  if (!existsSync(entry))
    throw Error(
      `Not converted: ${original.id} has no worker.ts. No placeholder generated.`,
    );
  const output = join(root, "docs/examples/discovery-packages", original.id);
  mkdirSync(output, { recursive: true });
  const worker = join(output, "worker.js");
  const result = await build({
    entryPoints: [entry],
    outfile: worker,
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2020",
    minify: true,
    legalComments: "none",
    metafile: true,
  });
  for (const dependency of Object.keys(result.metafile.inputs)) {
    if (
      /frontend\/src|mobile\/src|packages\/discovery-scenes\/src|packages\/family-api\/src\/discovery-models/.test(
        dependency,
      )
    )
      throw Error(`Package imports app topic code: ${dependency}`);
  }
  if (readFileSync(worker).length > 1048576)
    throw Error(`${original.id} exceeds rich worker source cap.`);
  const assets = [{ output: worker, mime_type: "text/javascript" }];
  copyAssets(join(source, "assets"), join(output, "assets"), assets);
  const license = join(output, "THREE-LICENSE.txt");
  writeFileSync(
    license,
    readFileSync(join(root, "packages/discovery-scenes/THREE-LICENSE.txt")),
  );
  assets.push({ output: license, mime_type: "text/plain" });
  const overridePath = join(source, "exploration.json");
  const overrides = existsSync(overridePath)
    ? JSON.parse(readFileSync(overridePath, "utf8"))
    : {};
  const packageId = `${original.id}-package`;
  const versionPath = join(source, "version.json");
  const version = existsSync(versionPath)
    ? JSON.parse(readFileSync(versionPath, "utf8")).version
    : "1.0.0";
  const manifest = {
    schema_version: 1,
    package_id: packageId,
    version,
    runtime: "worker-rich-v1",
    exploration: { ...original, ...overrides, id: packageId },
    entry: "worker.js",
    assets: assets.map(({ output: file, mime_type }) => ({
      path: relative(output, file).split("\\").join("/"),
      mime_type,
      sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
    })),
  };
  writeFileSync(
    join(output, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    `${original.id}: ${readFileSync(worker).length} worker bytes; ${assets.length} assets`,
  );
}
