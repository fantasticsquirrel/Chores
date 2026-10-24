import { installLesson } from "../physical-lesson";
import { defaultHeatState, normalizeHeat, heatResult } from "./model";
import { createHeatScene } from "./heatScene";
import { experiments } from "./lessons";
installLesson({
  initial: defaultHeatState,
  normalize: normalizeHeat,
  build: createHeatScene,
  title: "Which path transfers more heat?",
  introduction:
    "Hold temperatures steady and change one wall or window property at a time.",
  drag: true,
  fields: [
    {
      id: "material",
      label: "Base wall material",
      options: ["brick", "wood", "insulation"],
      labels: ["Brick", "Wood", "Insulated panel"],
    },
    { id: "insulationCm", label: "Added insulation (cm)", min: 0, max: 20 },
    { id: "windowM2", label: "Window area (m²)", min: 2, max: 18 },
    { id: "insideC", label: "Indoor temperature (°C)", min: 16, max: 24 },
    { id: "outsideC", label: "Outdoor temperature (°C)", min: -5, max: 25 },
  ],
  trials: experiments,
  select: (s, v) => ({ ...s, insulationCm: v }),
  describe: (s) => {
    const r = heatResult(s);
    return `Net outward wall transfer ${r.wallWatts.toFixed(0)} W; window transfer ${r.windowWatts.toFixed(0)} W; total ${r.totalWatts.toFixed(0)} W. Negative means heat enters. ${r.wallAreaM2} m² opaque wall + ${r.windowAreaM2} m² windows = 60 m². Wall U ${r.wallU.toFixed(2)} W/(m²·K), window U 2.8. Temperature difference ${r.deltaC}°C. ${r.deltaC === 0 ? "Equal temperatures give zero net transfer whatever the insulation." : "Insulation slows transfer; it does not supply heat."} A watt is one joule per second, not a temperature.`;
  },
  vector: (s) => {
    const r = heatResult(s),
      m = Math.abs(r.totalWatts),
      wall = m ? Math.abs(r.wallWatts) / m : 0;
    return {
      viewBox: [0, 0, 400, 80],
      description: `Wall transfer ${r.wallWatts.toFixed(0)} watts and window transfer ${r.windowWatts.toFixed(0)} watts. Bar compares magnitudes.`,
      nodes: [
        {
          tag: "text",
          attrs: { x: 10, y: 20, fill: "#18332c", fontSize: 14 },
          children: [
            `Walls ${r.wallWatts.toFixed(0)} W · Windows ${r.windowWatts.toFixed(0)} W`,
          ],
        },
        {
          tag: "rect",
          attrs: {
            x: 10,
            y: 32,
            width: 380 * wall,
            height: 24,
            fill: "#ca6847",
          },
          children: [],
        },
        {
          tag: "rect",
          attrs: {
            x: 10 + 380 * wall,
            y: 32,
            width: m ? 380 * (1 - wall) : 0,
            height: 24,
            fill: "#cba45d",
          },
          children: [],
        },
      ],
    };
  },
  note: "Steady wall-and-window comparison, not a whole-house bill. Transfer rate = U × area × temperature difference. Base wall 20 cm; conductivities brick 0.6, wood 0.12, insulated panel/additional insulation 0.04 W/(m·K), surface resistance 0.17 m²·K/W: teaching values, not product ratings. Temperatures are maintained, no cooling timer. Roof, floor, drafts, sunlight, moisture and joints omitted. Facade/cutaway schematic; numerical areas define comparison. Arrows show direction and relative transfer per square meter.",
});
