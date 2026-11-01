import { describe, expect, it } from "vitest";
import {
  SOLAR_OVERVIEW_GLYPH_HEIGHT_PX,
  layoutSolarOverviewCallouts,
} from "./solarScene";

describe("Solar overview callouts", () => {
  it("keeps overview label glyphs readable at native desktop and mobile scale", () => {
    expect(SOLAR_OVERVIEW_GLYPH_HEIGHT_PX).toBeGreaterThanOrEqual(11);
  });

  it("separates overview labels from one another and the nine bodies at 366 px", () => {
    const anchors = [
      { x: 183, y: 251 }, // Sun
      { x: 220, y: 240 },
      { x: 209, y: 212 },
      { x: 183, y: 195 },
      { x: 146, y: 204 },
      { x: 82, y: 255 },
      { x: 101, y: 345 },
      { x: 197, y: 399 },
      { x: 304, y: 352 },
    ];
    const widths = [38, 74, 58, 53, 49, 65, 64, 63, 72];
    const placements = layoutSolarOverviewCallouts(anchors, widths, 366, 500);
    const height = 30;

    placements.forEach((placement, index) => {
      expect(placement.x - widths[index] / 2).toBeGreaterThanOrEqual(8);
      expect(placement.x + widths[index] / 2).toBeLessThanOrEqual(358);
      expect(placement.y - height / 2).toBeGreaterThanOrEqual(116);
      expect(placement.y + height / 2).toBeLessThanOrEqual(484);
    });

    for (let first = 0; first < placements.length; first += 1) {
      for (let second = first + 1; second < placements.length; second += 1) {
        const horizontalGap =
          Math.abs(placements[first].x - placements[second].x) -
          (widths[first] + widths[second]) / 2;
        const verticalGap =
          Math.abs(placements[first].y - placements[second].y) - height;
        expect(
          horizontalGap >= 6 || verticalGap >= 6,
          `labels ${first} and ${second} overlap`,
        ).toBe(true);
      }

      anchors.forEach((anchor, anchorIndex) => {
        const outsideLabel =
          Math.abs(anchor.x - placements[first].x) >= widths[first] / 2 + 7 ||
          Math.abs(anchor.y - placements[first].y) >= height / 2 + 7;
        expect(outsideLabel, `label ${first} covers body ${anchorIndex}`).toBe(
          true,
        );
      });
    }
  });
});
