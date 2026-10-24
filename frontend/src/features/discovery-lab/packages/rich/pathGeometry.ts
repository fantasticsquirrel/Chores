import { z } from "zod";
const n = z.number().finite().min(-2000).max(2000),
  positive = n.min(0.000001),
  angle = n.min(-Math.PI * 2).max(Math.PI * 2);
const command = z.discriminatedUnion("op", [
  z.object({ op: z.literal("moveTo"), args: z.tuple([n, n]) }).strict(),
  z.object({ op: z.literal("lineTo"), args: z.tuple([n, n]) }).strict(),
  z
    .object({
      op: z.literal("bezierCurveTo"),
      args: z.tuple([n, n, n, n, n, n]),
    })
    .strict(),
  z
    .object({ op: z.literal("quadraticCurveTo"), args: z.tuple([n, n, n, n]) })
    .strict(),
  z
    .object({
      op: z.literal("absellipse"),
      args: z.tuple([
        n,
        n,
        positive,
        positive,
        angle,
        angle,
        z.union([z.literal(0), z.literal(1)]),
        angle,
      ]),
    })
    .strict(),
  z.object({ op: z.literal("closePath"), args: z.tuple([]) }).strict(),
]);
// absellipse is eight values: x, y, x-radius, y-radius, start, end, clockwise, rotation.
const fields = {
  commands: z.array(command).min(2).max(64),
  curveSegments: z.number().int().min(1).max(64),
};
export const shapeFields = fields;
export type PathGeometry = {
  kind: "shape" | "extrude";
  commands: z.infer<typeof command>[];
  curveSegments: number;
  depth?: number;
};
export function pathPointBudget(g: PathGeometry) {
  return g.commands.reduce(
    (sum, c) =>
      sum +
      (c.op === "absellipse"
        ? 2 * g.curveSegments + 1
        : c.op === "bezierCurveTo" || c.op === "quadraticCurveTo"
          ? g.curveSegments
          : 1),
    1,
  );
}
export function validPathGeometry(g: PathGeometry) {
  return (
    g.commands[0].op === "moveTo" &&
    !g.commands.slice(1).some((c) => c.op === "moveTo") &&
    pathPointBudget(g) <= 1024
  );
}
