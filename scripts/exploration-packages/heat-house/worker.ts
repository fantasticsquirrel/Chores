import { installLesson } from "../physical-lesson";
import { serializeExpansionScene } from "../shared/serialize-scene";
import { defaultHeatState, normalizeHeat, heatResult } from "./model";
import { createHeatScene } from "./heatScene";
import { experiments } from "./lessons";
installLesson({
  initial: defaultHeatState,
  normalize: normalizeHeat,
  build: createHeatScene,
  serialize: (scene, presentation) =>
    serializeExpansionScene(scene, { ...presentation, showHeading: false }),
  title: "Compare heat-transfer paths",
  introduction:
    "Predict first, change one wall or window input, then compare power and energy for equal elapsed time.",
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
    { id: "elapsedHours", label: "Elapsed time (h)", min: 0, max: 24 },
  ],
  trials: experiments,
  select: (s, v) => ({ ...s, insulationCm: v }),
  describe: (s) => {
    const r = heatResult(s);
    const direction =
      r.direction === "outward"
        ? "out of the house"
        : r.direction === "inward"
          ? "into the house"
          : "with no net direction";
    return `Signed outward heat-transfer power: walls ${r.wallWatts.toFixed(0)} W; windows ${r.windowWatts.toFixed(0)} W; combined ${r.totalWatts.toFixed(0)} W. Over ${s.elapsedHours} h, ${Math.abs(r.totalEnergyKWh).toFixed(2)} kWh (${(Math.abs(r.totalEnergyJ) / 1_000_000).toFixed(2)} MJ) transfers ${direction}. ${r.wallAreaM2} m² opaque wall + ${r.windowAreaM2} m² windows = 60 m². Wall U ${r.wallU.toFixed(2)} W/(m²·K); fixed window U ${r.windowU.toFixed(1)} W/(m²·K). Temperature difference ${Math.abs(r.deltaK)} K, the same size as ${Math.abs(r.deltaC)}°C. ${r.deltaC === 0 ? "Equal temperatures give zero net power and zero elapsed energy." : "Insulation raises resistance; it does not generate thermal energy."} Power is energy each second: 1 W = 1 J/s. Energy accumulates with time: 1 kWh = 3.6 MJ.`;
  },
  vector: (s) => {
    const r = heatResult(s),
      m = Math.abs(r.totalWatts),
      wall = m ? Math.abs(r.wallWatts) / m : 0;
    return {
      viewBox: [0, 0, 400, 80],
      description: `Wall heat-transfer power ${r.wallWatts.toFixed(0)} watts and window power ${r.windowWatts.toFixed(0)} watts. Over ${s.elapsedHours} hours the combined transferred energy magnitude is ${Math.abs(r.totalEnergyKWh).toFixed(2)} kilowatt-hours. Bar compares power magnitudes; exact values do not depend on color.`,
      nodes: [
        {
          tag: "text",
          attrs: { x: 10, y: 20, fill: "#18332c", fontSize: 14 },
          children: [
            `Wall power ${r.wallWatts.toFixed(0)} W · Window power ${r.windowWatts.toFixed(0)} W`,
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
  note: "This steady-state teaching model holds the indoor and outdoor temperatures fixed. It uses power = U × area × temperature difference for separate opaque-wall and whole-window paths, then multiplies that constant power by elapsed time to calculate transferred energy. The wall U-factor combines a 20 cm base layer, added insulation and a fixed surface resistance; the window U-factor is fixed at 2.8 W/(m²·K). These are ideal teaching inputs, not measurements, product ratings, a weather forecast or an energy-bill estimate. Real building transfer includes conduction through materials, convection in moving fluids and radiation across space; their combined effects are represented only by the simplified U-factors here, not calculated separately. Roof, floor, air leaks, sunlight, moisture, thermal bridges, stored heat and heating or cooling equipment are omitted. Insulation adds thermal resistance and slows transfer through its path; it does not generate thermal energy.",
});
