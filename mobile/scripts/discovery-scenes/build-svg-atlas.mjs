import { build } from "esbuild";
import { createRequire } from "node:module";
import path from "node:path";
export async function buildSvgAtlas(root) {
  const require = createRequire(path.join(root, "frontend/package.json"));
  const react = path.dirname(require.resolve("react/package.json"));
  const reactDom = path.dirname(require.resolve("react-dom/package.json"));
  const built = await build({
    absWorkingDir: root,
    entryPoints: ["mobile/scripts/discovery-scenes/svg-atlas-source.jsx"],
    bundle: true,
    write: false,
    jsx: "automatic",
    format: "cjs",
    platform: "node",
    target: "node20",
    alias: { react, "react-dom": reactDom },
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", built.outputFiles[0].text)(
    require,
    module,
    module.exports,
  );
  return module.exports.makeAtlas();
}
