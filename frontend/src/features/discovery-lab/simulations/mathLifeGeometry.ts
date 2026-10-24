export function sectorPath(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
) {
  if (end - start >= 359.999)
    return `M${cx - radius},${cy}a${radius},${radius} 0 1,0 ${radius * 2},0a${radius},${radius} 0 1,0 ${-radius * 2},0`;
  const point = (angle: number) => [
    cx + radius * Math.cos((angle * Math.PI) / 180),
    cy + radius * Math.sin((angle * Math.PI) / 180),
  ];
  const a = point(start),
    b = point(end);
  return `M${cx},${cy}L${a[0]},${a[1]}A${radius},${radius} 0 ${end - start > 180 ? 1 : 0},1 ${b[0]},${b[1]}Z`;
}
