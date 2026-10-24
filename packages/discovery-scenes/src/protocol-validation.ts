import { validExpansionState } from "./protocol-expansion-validation";
import type { OfflineSceneState } from "./protocol-state";
import { number, record, exact, numbers } from "./protocol-guards";

export function validSceneState(value: unknown): value is OfflineSceneState {
  if (!record(value)) return false;
  switch (value.kind) {
    case "bridge":
      return (
        exact(value, [
          "kind",
          "material",
          "braces",
          "load",
          "position",
          "utilization",
          "leftReaction",
          "rightReaction",
        ]) &&
        (value.material === "timber" || value.material === "steel") &&
        Array.isArray(value.braces) &&
        value.braces.length === 4 &&
        value.braces.every((v) => typeof v === "boolean") &&
        number(value.load, 0, 100) &&
        number(value.position, 0, 100) &&
        numbers(value.utilization, 4, 0, 100) &&
        number(value.leftReaction, 0, 100) &&
        number(value.rightReaction, 0, 100)
      );
    case "sound":
      return (
        exact(value, ["kind", "length", "tension", "amplitude", "progress"]) &&
        number(value.length, 20, 120) &&
        number(value.tension, 1, 200) &&
        number(value.amplitude, 0, 10) &&
        number(value.progress, 0, 1)
      );
    case "circuit":
      return (
        exact(value, [
          "kind",
          "mode",
          "switches",
          "power",
          "current",
          "voltage",
        ]) &&
        (value.mode === "parallel" || value.mode === "series") &&
        Array.isArray(value.switches) &&
        value.switches.length === 3 &&
        value.switches.every((v) => typeof v === "boolean") &&
        numbers(value.power, 3, 0, 1000) &&
        numbers(value.current, 3, 0, 100) &&
        number(value.voltage, 0, 100)
      );
    case "pizza":
      return (
        exact(value, ["kind", "plates", "active"]) &&
        number(value.active, 0, 1) &&
        Number.isInteger(value.active) &&
        Array.isArray(value.plates) &&
        value.plates.length === 2 &&
        value.plates.every(
          (p) =>
            record(p) &&
            exact(p, ["n", "d", "slices"]) &&
            number(p.d, 2, 24) &&
            Number.isInteger(p.d) &&
            number(p.n, 0, p.d) &&
            Number.isInteger(p.n) &&
            Array.isArray(p.slices) &&
            p.slices.length === p.n &&
            p.slices.every(
              (v) => number(v, 0, (p.d as number) - 1) && Number.isInteger(v),
            ) &&
            new Set(p.slices).size === p.slices.length,
        )
      );
    case "chance":
      return (
        exact(value, ["kind", "chances", "die", "last", "selected"]) &&
        typeof value.die === "boolean" &&
        numbers(value.chances, value.die ? 6 : 4, 0, 1) &&
        Math.abs((value.chances as number[]).reduce((a, b) => a + b, 0) - 1) <
          0.000001 &&
        (value.last === null ||
          (number(value.last, 0, value.die ? 5 : 3) &&
            Number.isInteger(value.last))) &&
        number(value.selected, -1, value.die ? 5 : 3) &&
        Number.isInteger(value.selected)
      );
    case "optics":
      return (
        exact(value, ["kind", "angle", "reverse"]) &&
        number(value.angle, 0, 80) &&
        value.angle % 5 === 0 &&
        typeof value.reverse === "boolean"
      );
    case "pattern":
      return (
        exact(value, [
          "kind",
          "sides",
          "copies",
          "rotation",
          "reflected",
          "view",
        ]) &&
        number(value.sides, 3, 6) &&
        Number.isInteger(value.sides) &&
        number(value.copies, 1, 8) &&
        Number.isInteger(value.copies) &&
        number(value.rotation, 0, 270) &&
        value.rotation % 90 === 0 &&
        typeof value.reflected === "boolean" &&
        (value.view === "tiles" || value.view === "motif")
      );
    case "river":
      return (
        exact(value, [
          "kind",
          "slope",
          "rain",
          "vegetation",
          "runoff",
          "infiltration",
          "eroded",
          "flood",
          "deposited",
          "soil",
        ]) &&
        number(value.slope, 1, 20) &&
        number(value.rain, 0, 120) &&
        number(value.vegetation, 0, 100) &&
        [
          value.runoff,
          value.infiltration,
          value.eroded,
          value.flood,
          value.deposited,
          value.soil,
        ].every((v) => number(v, 0, 1000000))
      );
    case "pond":
      return (
        exact(value, [
          "kind",
          "algae",
          "zooplankton",
          "fish",
          "oxygen",
          "drought",
          "nutrients",
        ]) &&
        [
          value.algae,
          value.zooplankton,
          value.fish,
          value.oxygen,
          value.drought,
          value.nutrients,
        ].every((v) => number(v, 0, 100))
      );
    case "caravan":
      return (
        exact(value, [
          "kind",
          "route",
          "season",
          "cargo",
          "units",
          "supplies",
          "days",
          "load",
        ]) &&
        ["ridge", "river", "oasis"].includes(value.route as string) &&
        ["wet", "dry"].includes(value.season as string) &&
        ["grain", "cloth", "pottery"].includes(value.cargo as string) &&
        number(value.units, 1, 20) &&
        Number.isInteger(value.units) &&
        number(value.supplies, 0, 16) &&
        number(value.days, 0, 100) &&
        number(value.load, 0, 1000)
      );
    case "garden":
      return (
        exact(value, [
          "kind",
          "x",
          "y",
          "reach",
          "habitat",
          "pollen",
          "received",
          "path",
        ]) &&
        number(value.x, 0, 760) &&
        number(value.y, 0, 450) &&
        number(value.reach, 80, 240) &&
        typeof value.habitat === "boolean" &&
        ["none", "gold", "violet"].includes(value.pollen as string) &&
        Array.isArray(value.received) &&
        value.received.length <= 8 &&
        value.received.every((v) => number(v, 0, 7) && Number.isInteger(v)) &&
        new Set(value.received).size === value.received.length &&
        Array.isArray(value.path) &&
        value.path.length <= 24 &&
        value.path.every(
          (p) =>
            record(p) &&
            exact(p, ["x", "y"]) &&
            number(p.x, 0, 760) &&
            number(p.y, 0, 450),
        )
      );
    case "moon":
      return exact(value, ["kind", "angle"]) && number(value.angle, 0, 360);
    case "orbit":
      return (
        exact(value, ["kind", "points", "progress"]) &&
        number(value.progress, 0, 1) &&
        Array.isArray(value.points) &&
        value.points.length > 0 &&
        value.points.length <= 512 &&
        value.points.every(
          (point) =>
            record(point) &&
            exact(point, ["x", "y"]) &&
            number(point.x, -1000, 1000) &&
            number(point.y, -1000, 1000),
        )
      );
    case "solar":
      return (
        exact(value, ["kind", "selected", "earthYears", "mode", "angles"]) &&
        number(value.selected, 0, 7) &&
        Number.isInteger(value.selected) &&
        number(value.earthYears, 0, 10000) &&
        (value.mode === "orbits" || value.mode === "sizes") &&
        numbers(value.angles, 8, -10000, 10000)
      );
    case "gravity":
      return (
        exact(value, [
          "kind",
          "height",
          "gravity",
          "elapsed",
          "mass",
          "referenceGravity",
          "referenceMass",
          "distances",
        ]) &&
        number(value.height, 1, 100) &&
        number(value.gravity, 0.1, 100) &&
        number(value.elapsed, 0, 100) &&
        number(value.mass, 0.1, 100) &&
        number(value.referenceGravity, 0.1, 100) &&
        number(value.referenceMass, 0.1, 100) &&
        numbers(value.distances, 2, 0, value.height)
      );
    case "leaf":
      return (
        exact(value, ["kind", "light", "water", "carbon", "rate"]) &&
        [value.light, value.water, value.carbon, value.rate].every((item) =>
          number(item, 0, 100),
        )
      );
    case "castle":
      return (
        exact(value, [
          "kind",
          "moat",
          "towers",
          "gate",
          "inner",
          "approach",
          "sight",
          "wallHeightMeters",
        ]) &&
        number(value.moat, 0, 40) &&
        number(value.wallHeightMeters, 3, 18) &&
        [value.towers, value.gate, value.inner, value.sight].every(
          (item) => typeof item === "boolean",
        ) &&
        (value.approach === "bridge" || value.approach === "north")
      );
    default:
      return validExpansionState(value);
  }
}
