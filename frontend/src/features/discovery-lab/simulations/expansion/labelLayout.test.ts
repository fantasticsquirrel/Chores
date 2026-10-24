import { expect, it } from "vitest";
import { placeLabel, type LabelBox } from "./labelLayout";
it("separates clustered labels near the lower edge without reclamping overlaps", () => {
  const placed: LabelBox[] = [];
  for (const h of [35.5, 49.25, 35.5, 21.75, 49.25, 35.5]) {
    const p = placeLabel({ x: 60, y: 410, w: 105, h }, placed, 368, 420);
    expect(p.x - p.w / 2).toBeGreaterThanOrEqual(6);
    expect(p.x + p.w / 2).toBeLessThanOrEqual(362);
    expect(p.y - p.h / 2).toBeGreaterThanOrEqual(6);
    expect(p.y + p.h / 2).toBeLessThanOrEqual(414);
    for (const q of placed)
      expect(
        Math.abs(p.x - q.x) >= (p.w + q.w) / 2 + 4 ||
          Math.abs(p.y - q.y) >= (p.h + q.h) / 2 + 4,
      ).toBe(true);
    placed.push(p);
  }
});
