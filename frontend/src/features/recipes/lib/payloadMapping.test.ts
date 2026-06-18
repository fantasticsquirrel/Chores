import { describe, expect, it } from "vitest";

import {
  buildEmptyRecipePayload,
  buildRecipePayloadForSave,
  parsePositionRefs,
} from "./payloadMapping";

describe("recipe payload mapping", () => {
  it("starts new recipes with one ingredient and one step", () => {
    const payload = buildEmptyRecipePayload();

    expect(payload.ingredients).toHaveLength(1);
    expect(payload.ingredients?.[0]).toMatchObject({ position: 1, item: "" });
    expect(payload.steps).toHaveLength(1);
    expect(payload.steps?.[0]).toMatchObject({ position: 1, instruction: "" });
  });

  it("parses comma-separated positive step ingredient references", () => {
    expect(parsePositionRefs("1, 2, nope, 0, 3")).toEqual([1, 2, 3]);
  });

  it("normalizes save payload rows and drops invalid linked ingredient refs", () => {
    const payload = buildEmptyRecipePayload();
    payload.title = "  Chili  ";
    payload.ingredients = [
      { position: 9, group_name: "", quantity: 1, unit: "cup", item: "Beans", preparation: "", note: "", is_optional: false },
      { position: 10, group_name: "", quantity: null, unit: "", item: "   ", preparation: "", note: "", is_optional: false },
    ];
    payload.steps = [
      { position: 3, section: "", instruction: "Simmer", ingredient_position_refs: [1, 2] },
    ];
    payload.components = [{ component_recipe_id: 0, label: "", quantity: null, unit: "" }];

    expect(buildRecipePayloadForSave(payload)).toMatchObject({
      title: "Chili",
      ingredients: [{ position: 1, item: "Beans" }],
      steps: [{ position: 1, instruction: "Simmer", ingredient_position_refs: [1] }],
      components: [],
    });
  });
});
