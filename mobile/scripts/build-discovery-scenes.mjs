import { buildSvgAtlas } from "./discovery-scenes/build-svg-atlas.mjs";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const output = path.join(
  root,
  "mobile/src/features/discovery-lab/rendering/offline-scenes.generated.json",
);
const bundle = await build({
  absWorkingDir: root,
  entryPoints: ["mobile/scripts/discovery-scenes/scene-entry.js"],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  loader: { ".jpg": "dataurl" },
  legalComments: "inline",
});
const require = createRequire(import.meta.url);
const threeLicense = await readFile(
  path.resolve(path.dirname(require.resolve("three")), "../LICENSE"),
  "utf8",
);
const script =
  `/* ${threeLicense.replaceAll("*/", "* /")} */\n${bundle.outputFiles[0].text}`.replace(
    /<\/script/gi,
    "<\\/script",
  );
const style =
  "html,body,#scene{width:100%;height:100%;margin:0;overflow:hidden;background:#020611}#scene{touch-action:pan-y}canvas{display:block}#labels{position:absolute;inset:0;pointer-events:none}#labels span{position:absolute;transform:translate(-50%,-50%);padding:4px 6px;color:#fff9ef;background:#101d20c9;border-radius:3px;font:12px system-ui;white-space:nowrap}";
const hash = (value) =>
  `'sha256-${createHash("sha256").update(value).digest("base64")}'`;
const csp = `default-src 'none'; script-src ${hash(script)}; style-src ${hash(style)}; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'; media-src 'none'`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Science model</title><style>${style}</style></head><body><div id="scene" aria-hidden="true"></div><div id="labels" aria-hidden="true"></div><script>${script}</script></body></html>`;
if (Buffer.byteLength(html) > 2 * 1024 * 1024)
  throw new Error("Offline scenes exceeds the 2 MiB review budget.");
const atlas = await buildSvgAtlas(root);
const svgBuilt = await build({
  absWorkingDir: root,
  entryPoints: ["mobile/scripts/discovery-scenes/svg-entry.js"],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  plugins: [
    {
      name: "local-svg-atlas",
      setup(build) {
        build.onResolve({ filter: /^offline-svg-atlas$/ }, () => ({
          path: "atlas",
          namespace: "local-atlas",
        }));
        build.onLoad({ filter: /.*/, namespace: "local-atlas" }, () => ({
          contents: `export default ${JSON.stringify(atlas)}`,
          loader: "js",
        }));
      },
    },
  ],
});
const svgScript = svgBuilt.outputFiles[0].text.replace(
  /<\/script/gi,
  "<\\/script",
);
const svgStyle =
  "html,body,#scene{width:100%;height:100%;margin:0;overflow:hidden;background:#10212b}#scene{display:flex;align-items:center;justify-content:center}svg{width:100%;height:100%;display:block}text{font-family:system-ui}";
const svgCsp = `default-src 'none'; script-src ${hash(svgScript)}; style-src ${hash(svgStyle)}; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'`;
const svgHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${svgCsp}"><style>${svgStyle}</style></head><body><div id="scene" aria-hidden="true"></div><script>${svgScript}</script></body></html>`;
if (Buffer.byteLength(svgHtml) > 2 * 1024 * 1024)
  throw new Error("SVG atlas exceeds 2MiB; review required before writing.");
const svgOutput = path.join(
  root,
  "mobile/src/features/discovery-lab/rendering/offline-svg.generated.json",
);
const svgArtifact = JSON.stringify({ html: svgHtml }) + "\n";
const artifact = JSON.stringify({ html }) + "\n";
if (process.argv.includes("--check")) {
  if (
    (await readFile(output, "utf8")) !== artifact ||
    (await readFile(svgOutput, "utf8")) !== svgArtifact
  )
    throw new Error(
      "Offline scenes is stale. Run npm run scenes:build --workspace mobile.",
    );
} else {
  await writeFile(output, artifact);
  await writeFile(svgOutput, svgArtifact);
}
console.log(
  `Offline scenes ${process.argv.includes("--check") ? "verified" : "built"}: ${Buffer.byteLength(html).toLocaleString()} bytes.`,
);

console.log(
  `Offline SVG atlas: ${Buffer.byteLength(svgHtml).toLocaleString()} bytes; 34 optics, 32 tile and 8 motif states.`,
);
