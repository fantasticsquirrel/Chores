import { describe, expect, it } from "vitest";
import content from "../discovery-explorations.json";

const expectedIds = [
  "orbital-mechanics",
  "reflection-refraction",
  "gravity",
  "solar-system",
  "moon-phases",
  "photosynthesis",
  "castle-defenses",
  "sound-playground",
  "bridge-builder",
  "river-sculptor",
  "circuit-city",
  "food-web-rescue",
  "fraction-feast",
  "pattern-palace",
  "caravan-crossroads",
  "pollinator-express",
  "chance-carnival",
  "machine-workshop",
  "heat-house",
  "pressure-tank",
  "moving-plates",
  "cloud-rain-lab",
  "magnetic-fields",
  "cell-explorer",
  "shape-slicer",
  "adaptation-island",
];

describe("Discovery Lab educational content", () => {
  it("publishes the complete collection under unique stable identifiers", () => {
    const ids = content.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...expectedIds].sort());
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it.each(content)(
    "gives $id complete lessons and useful catalog metadata",
    (entry) => {
      for (const key of [
        "title",
        "subject",
        "summary",
        "question",
        "explanation",
        "misconception",
      ] as const) {
        expect(entry[key].trim(), key).not.toBe("");
      }
      expect(entry.grade_bands.length).toBeGreaterThan(0);
      expect(new Set(entry.grade_bands).size).toBe(entry.grade_bands.length);
      for (const band of entry.grade_bands) {
        expect(["K-2", "3-5", "6-8", "9-12"]).toContain(band);
      }
      expect(entry.tags.length).toBeGreaterThan(0);
      expect(new Set(entry.tags).size).toBe(entry.tags.length);
      for (const tag of entry.tags) expect(tag).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(Number.isInteger(entry.duration_minutes)).toBe(true);
      expect(entry.duration_minutes).toBeGreaterThan(0);
      expect(entry.duration_minutes).toBeLessThanOrEqual(180);
      expect(entry.experiments.length).toBeGreaterThanOrEqual(2);
      for (const experiment of entry.experiments) {
        expect(experiment.title.trim()).not.toBe("");
        expect(experiment.instruction.trim()).not.toBe("");
        expect(experiment.observe.trim()).not.toBe("");
      }
      expect(entry.sources.length).toBeGreaterThan(0);
      for (const source of entry.sources) {
        expect(source.title.trim()).not.toBe("");
        const url = new URL(source.url);
        expect(url.protocol).toBe("https:");
        expect(url.username).toBe("");
        expect(url.password).toBe("");
        expect(url.hostname).not.toBe("");
      }
    },
  );

  it("makes Chance Carnival's controlled comparisons executable and sourced", () => {
    const chance = content.find((entry) => entry.id === "chance-carnival");
    expect(chance).toBeDefined();
    expect(chance?.experiments[0].instruction).toContain("12");
    expect(chance?.experiments[0].instruction).toContain("1,200");
    expect(chance?.experiments[0].observe).toContain("25% expected");
    expect(chance?.experiments[1].instruction).toContain("40% (2 of 5)");
    expect(JSON.stringify(chance)).not.toMatch(
      /percentage[- ]point|\bpp\b|\bgap\b/i,
    );
    expect(chance?.sources.map((source) => source.url)).toEqual(
      expect.arrayContaining([
        "https://openstax.org/books/introductory-statistics/pages/3-1-terminology",
        "https://openstax.org/books/introductory-statistics/pages/3-2-independent-and-mutually-exclusive-events",
      ]),
    );
  });
});
