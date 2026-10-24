/** Browser parity harness: actual original and trusted package renderers, no app/backend mutations. Run from repository root. */
import { writeFileSync, mkdirSync } from "node:fs";
import { build } from "esbuild";
const root = process.cwd();
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
mkdirSync("/tmp/physical-browser", { recursive: true });
let source = `import React from 'react';import {createRoot} from 'react-dom/client';import {ExpansionCanvas} from './frontend/src/features/discovery-lab/simulations/expansion/ExpansionCanvas';import RichSceneView from './frontend/src/features/discovery-lab/packages/rich/RichSceneView';import {RichVectorView} from './frontend/src/features/discovery-lab/packages/rich/vector';\n`;
for (let i = 0; i < specs.length; i++) {
  const [id, p, f, g, s] = specs[i];
  source += `import {${f} as f${i}} from './packages/discovery-scenes/src/expansion/${p}';import {${s} as s${i}} from './packages/family-api/src/discovery-models/expansion-${g}';\n`;
}
source += `const topics={${specs.map((s, i) => `'${s[0]}':{factory:f${i},initial:s${i}}`).join(",")}};const root=createRoot(document.getElementById('root'));const assets={};window.renderProof=async(config)=>{const t=topics[config.topic];root.render(<main><section id="original"><h1>Original · {config.topic}</h1><ExpansionCanvas key={config.topic+config.name} state={{...t.initial,...config.state}} buildScene={t.factory} description="Original simulation visual"/></section><section id="package" className="discovery-package-runtime"><h1>Package · {config.topic}</h1><RichSceneView key={config.topic+config.name} scene={config.frame.scene3d} assets={assets} description={config.frame.description}/>{config.frame.vector&&<RichVectorView scene={config.frame.vector}/>}<p>{config.frame.description}</p><div>{config.frame.controls.map(c=><label key={c.id}>{c.label}: {c.value}<input type="range" min={c.min} max={c.max} step={c.step} value={c.value} readOnly/></label>)}</div>{config.frame.sections.map(s=><section key={s.heading}><h2>{s.heading}</h2><p>{s.text}</p></section>)}<p>{config.frame.footnote}</p></section></main>);};`;
await build({
  stdin: { contents: source, loader: "tsx", resolveDir: root },
  bundle: true,
  outfile: "/tmp/physical-browser/harness.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".css": "css" },
});
writeFileSync(
  "/tmp/physical-browser/index.html",
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/harness.css"><style>body{margin:0;background:#edf1ed;font-family:system-ui}main{max-width:1100px;margin:auto}h1{font-size:20px}label{display:block;padding:8px}section{min-width:0}#package>p,#package>section{padding:12px}</style><div id="root"></div><script src="/harness.js"></script>',
);
