import { writeFileSync, mkdirSync } from "node:fs";
import { build } from "esbuild";
const root = process.cwd();
mkdirSync("/tmp/tactile-browser", { recursive: true });
const specs = [
  ["sound-playground", "SoundPlaygroundSimulation"],
  ["bridge-builder", "BridgeBuilderSimulation"],
  ["river-sculptor", "RiverSculptorSimulation"],
  ["circuit-city", "CircuitCitySimulation"],
  ["food-web-rescue", "FoodWebSimulation"],
  ["fraction-feast", "FractionFeastSimulation"],
  ["pattern-palace", "PatternPalaceSimulation"],
  ["caravan-crossroads", "CaravanSimulation"],
  ["pollinator-express", "PollinatorSimulation"],
  ["chance-carnival", "ChanceCarnivalSimulation"],
];
let source = `import React from 'react';import {createRoot} from 'react-dom/client';import RichSceneView from './frontend/src/features/discovery-lab/packages/rich/RichSceneView';import {RichVectorView} from './frontend/src/features/discovery-lab/packages/rich/vector';import './frontend/src/features/discovery-lab/simulations/simulations.css';import './frontend/src/features/discovery-lab/simulations/physical-world.css';\n`;
for (let i = 0; i < specs.length; i++)
  source += `import {${specs[i][1]} as C${i}} from './frontend/src/features/discovery-lab/simulations/${specs[i][1]}';\n`;
source += `const topics={${specs.map((s, i) => `'${s[0]}':C${i}`).join(",")}};const root=createRoot(document.getElementById('root'));window.renderProof=async(config)=>{const C=topics[config.topic];const images=new Map();await Promise.all(Object.entries(config.assets).map(async([name,url])=>{const img=new Image();img.src=url;await img.decode();images.set(name,img);}));root.render(<main><section id="original"><h1>Original · {config.topic}</h1><C key={config.topic+config.name}/></section><section id="package" className="discovery-package-runtime"><h1>Package · {config.topic}</h1>{config.frame.scene3d&&<RichSceneView key={config.topic+config.name} scene={config.frame.scene3d} assets={images} description={config.frame.description}/>} {config.frame.vector&&<RichVectorView scene={config.frame.vector}/>}<p>{config.frame.description}</p><div>{config.frame.controls.map(c=><label key={c.id}>{c.label}: {c.value}<input type="range" min={c.min} max={c.max} step={c.step} value={c.value} readOnly/></label>)}</div>{config.frame.sections.map(s=><section key={s.heading}><h2>{s.heading}</h2><p>{s.text}</p></section>)}<p>{config.frame.footnote}</p></section></main>);};`;
await build({
  stdin: { contents: source, loader: "tsx", resolveDir: root },
  bundle: true,
  outfile: "/tmp/tactile-browser/harness.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".css": "css" },
});
writeFileSync(
  "/tmp/tactile-browser/index.html",
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/harness.css"><style>*{box-sizing:border-box}body{margin:0;background:#edf1ed;font-family:system-ui}main{max-width:1100px;margin:auto}h1{font-size:20px}label{display:block;padding:8px}section{min-width:0}#package>p,#package>section{padding:12px}</style><div id="root"></div><script src="/harness.js"></script>',
);
