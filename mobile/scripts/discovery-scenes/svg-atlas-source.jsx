import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OpticsBench } from "../../../frontend/src/features/discovery-lab/simulations/optics/OpticsBench";
import {
  PatternWorkbench,
  MosaicMotif,
} from "../../../frontend/src/features/discovery-lab/simulations/tactile/PatternWorkbench";

export function makeAtlas() {
  const optics = {},
    tiles = {},
    motifs = {};
  for (const reverse of [false, true])
    for (let angle = 0; angle <= 80; angle += 5) {
      optics[`${reverse ? 1 : 0}:${angle}`] = renderToStaticMarkup(
        <OpticsBench
          angle={angle}
          n1={reverse ? 1.333 : 1}
          n2={reverse ? 1 : 1.333}
          onAngle={() => {}}
        />,
      ).replace(
        "Drag the laser or adjust the angle below.",
        "Adjust the incident angle with the controls below.",
      );
    }
  for (const sides of [3, 4, 5, 6])
    for (let copies = 1; copies <= 8; copies++) {
      const markup = renderToStaticMarkup(
        <PatternWorkbench
          sides={sides}
          copies={copies}
          rotation={0}
          mirror={false}
          repeat={2}
        />,
      );
      const svg = markup.match(/<svg[\s\S]*?<\/svg>/)?.[0];
      if (!svg)
        throw new Error(
          "Pattern tile SVG is missing from the shared component.",
        );
      tiles[`${sides}:${copies}`] = svg;
    }
  for (const rotation of [0, 90, 180, 270])
    for (const mirror of [false, true]) {
      motifs[`${rotation}:${mirror ? 1 : 0}`] = renderToStaticMarkup(
        <svg viewBox="0 0 280 150" xmlns="http://www.w3.org/2000/svg">
          <MosaicMotif x={65} y={65} />
          <MosaicMotif x={215} y={65} rotation={rotation} mirror={mirror} />
          <text x={65} y={140} textAnchor="middle" fill="#fff9ef" fontSize="12">
            Original
          </text>
          <text
            x={215}
            y={140}
            textAnchor="middle"
            fill="#fff9ef"
            fontSize="12"
          >
            {mirror ? "Reflected, then rotated" : "Rotated"}
          </text>
        </svg>,
      );
    }
  return { optics, tiles, motifs };
}
