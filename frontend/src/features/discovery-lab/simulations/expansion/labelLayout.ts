export type LabelBox = { x: number; y: number; w: number; h: number };
export function placeLabel(
  target: LabelBox,
  placed: LabelBox[],
  width: number,
  height: number,
): LabelBox {
  const { w, h } = target,
    minX = 6 + w / 2,
    maxX = width - 6 - w / 2,
    minY = 6 + h / 2,
    maxY = height - 6 - h / 2;
  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));
  const x = clamp(target.x, minX, maxX),
    y = clamp(target.y, minY, maxY);
  const xs = [
    x,
    minX,
    maxX,
    ...placed.flatMap((p) => [
      p.x - (p.w + w) / 2 - 5,
      p.x + (p.w + w) / 2 + 5,
    ]),
  ];
  const ys = [
    y,
    minY,
    maxY,
    ...placed.flatMap((p) => [
      p.y - (p.h + h) / 2 - 5,
      p.y + (p.h + h) / 2 + 5,
    ]),
  ];
  const options = xs
    .flatMap((cx) => ys.map((cy) => ({ x: cx, y: cy, w, h })))
    .filter((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY)
    .filter(
      (p) =>
        !placed.some(
          (q) =>
            Math.abs(p.x - q.x) < (w + q.w) / 2 + 4 &&
            Math.abs(p.y - q.y) < (h + q.h) / 2 + 4,
        ),
    );
  options.sort(
    (a, b) =>
      Math.abs(a.x - x) * 1.4 +
      Math.abs(a.y - y) -
      Math.abs(b.x - x) * 1.4 -
      Math.abs(b.y - y),
  );
  return options[0] ?? { x, y, w, h };
}
