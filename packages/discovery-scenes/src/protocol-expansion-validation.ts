import type { ExpansionSceneState } from "./protocol-expansion-state";
import { exact, number, record } from "./protocol-guards";

/** No arbitrary strings, identifiers, model commands, or unbounded values. */
export function validExpansionState(
  value: unknown,
): value is ExpansionSceneState {
  if (!record(value)) return false;
  switch (value.kind) {
    case "machine-workshop":
      return (
        exact(value, ["kind", "mode", "loadKg", "advantage", "liftM"]) &&
        ["pulley", "lever", "gears"].includes(value.mode as string) &&
        number(value.loadKg, 10, 100) &&
        number(value.advantage, 1, 4) &&
        Number.isInteger(value.advantage) &&
        number(value.liftM, 0, 1)
      );
    case "heat-house":
      return (
        exact(value, [
          "kind",
          "insulationCm",
          "windowM2",
          "material",
          "insideC",
          "outsideC",
        ]) &&
        number(value.insulationCm, 0, 20) &&
        number(value.windowM2, 2, 18) &&
        ["brick", "wood", "insulation"].includes(value.material as string) &&
        number(value.insideC, 16, 24) &&
        number(value.outsideC, -5, 25)
      );
    case "pressure-tank":
      return (
        exact(value, ["kind", "depthM", "outletM", "shape"]) &&
        number(value.depthM, 0.2, 3) &&
        number(value.outletM, 0.1, 2.5) &&
        ["narrow", "wide", "tapered"].includes(value.shape as string)
      );
    case "moving-plates":
      return (
        exact(value, ["kind", "boundary", "movement", "stress", "slips"]) &&
        ["divergent", "convergent", "transform"].includes(
          value.boundary as string,
        ) &&
        number(value.movement, 0, 100) &&
        number(value.stress, 0, 100) &&
        number(value.slips, 0, 20) &&
        Number.isInteger(value.slips)
      );
    case "cloud-rain-lab":
      return (
        exact(value, [
          "kind",
          "temperatureC",
          "vaporGPerKg",
          "upliftM",
          "dropletGrowth",
        ]) &&
        number(value.temperatureC, 20, 35) &&
        number(value.vaporGPerKg, 2, 14) &&
        number(value.upliftM, 0, 2000) &&
        number(value.dropletGrowth, 0, 100)
      );
    case "magnetic-fields":
      return (
        exact(value, ["kind", "gap", "flipped", "probeX", "probeZ"]) &&
        number(value.gap, 0.5, 4.5) &&
        typeof value.flipped === "boolean" &&
        number(value.probeX, -6, 6) &&
        number(value.probeZ, -4, 4)
      );
    case "cell-explorer":
      return (
        exact(value, [
          "kind",
          "cellType",
          "selected",
          "molecule",
          "carrier",
          "outside",
          "inside",
        ]) &&
        ["plant", "animal"].includes(value.cellType as string) &&
        [
          "membrane",
          "nucleus",
          "mitochondrion",
          "chloroplast",
          "vacuole",
          "wall",
        ].includes(value.selected as string) &&
        ["oxygen", "glucose"].includes(value.molecule as string) &&
        typeof value.carrier === "boolean" &&
        number(value.outside, 0, 20) &&
        number(value.inside, 0, 20)
      );
    case "shape-slicer":
      return (
        exact(value, ["kind", "solid", "tilt", "turn", "offset"]) &&
        ["cube", "tetrahedron", "sphere"].includes(value.solid as string) &&
        number(value.tilt, 0, 90) &&
        number(value.turn, 0, 90) &&
        number(value.offset, -1.75, 1.75)
      );
    case "adaptation-island":
      return (
        exact(value, [
          "kind",
          "habitat",
          "predators",
          "generation",
          "darkCount",
          "lightCount",
          "initialDark",
        ]) &&
        ["dark", "light"].includes(value.habitat as string) &&
        typeof value.predators === "boolean" &&
        number(value.generation, 0, 20) &&
        Number.isInteger(value.generation) &&
        [value.darkCount, value.lightCount, value.initialDark].every((v) =>
          number(v, 0, 100),
        ) &&
        Math.abs(
          (value.darkCount as number) + (value.lightCount as number) - 100,
        ) < 0.000001
      );
    default:
      return false;
  }
}
