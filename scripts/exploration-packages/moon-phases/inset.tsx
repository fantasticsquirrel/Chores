/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from "../space-life-support/vector-author";
import { EarthGlobe } from "./EarthGlobe";
export function moonInset(radians: number, narrow = false) {
  return {
    viewBox: [0, 0, 250, 200],
    inset: { width: narrow ? 120 : 205, corner: "top-right" },
    description:
      "Orbit view, not to scale. Sunlight arrives from the right. The Moon moves around Earth; its Earth-view sunlit fraction changes.",
    nodes: [
      <circle
        cx="105"
        cy="96"
        r="65"
        fill="none"
        stroke="#667c93"
        strokeDasharray="2 5"
      />,
      EarthGlobe({ x: 105, y: 96, r: 18, sunlightFromRight: true }),
      <path
        d={`M105 96L${105 + 65 * Math.cos(radians)} ${96 - 65 * Math.sin(radians)}`}
        stroke="#a6cbd1"
        opacity=".45"
      />,
      <circle
        cx={105 + 65 * Math.cos(radians)}
        cy={96 - 65 * Math.sin(radians)}
        r="7"
        fill="#d2d1c8"
      />,
      ...[65, 96, 127].map((y) => (
        <path
          d={`M231 ${y}h-35m6-4-6 4 6 4`}
          fill="none"
          stroke="#eecb8f"
          strokeWidth="1.5"
        />
      )),
      <text x="198" y="153" fill="#eecb8f" fontSize="10">
        Sunlight
      </text>,
      <text x="105" y="184" textAnchor="middle" fill="#9eb6c5" fontSize="10">
        Orbit view · not to scale
      </text>,
    ],
  };
}
