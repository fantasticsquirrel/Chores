import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CreateRecipeRequest } from "../../../api";
import { RecipeEditor } from "../components/RecipeEditor";

import {
  buildEmptyRecipePayload,
  buildRecipePayloadForSave,
  buildRecipePayloadForUpdate,
  parsePositionRefs,
} from "./payloadMapping";

describe("recipe payload mapping", () => {
  it("preserves a selected sub-recipe and sibling metadata when editing component fields", () => {
    let payload: CreateRecipeRequest = {
      ...buildEmptyRecipePayload(),
      components: [{ component_recipe_id: 11 }],
    };
    const setPayload = vi.fn((next: CreateRecipeRequest | ((previous: CreateRecipeRequest) => CreateRecipeRequest)) => {
      payload = typeof next === "function" ? next(payload) : next;
    });
    const editor = () => createElement(RecipeEditor, {
      payload,
      setPayload,
      categories: [],
      tags: [],
      availableRecipes: [],
      submitLabel: "Save Recipe",
      onSubmit: vi.fn(),
    });
    const { rerender } = render(editor());

    fireEvent.change(screen.getByLabelText("Sub-recipe 1 label"), { target: { value: "Sauce" } });
    expect(payload.components).toEqual([
      { component_recipe_id: 11, label: "Sauce", quantity: null, unit: "" },
    ]);
    rerender(editor());
    fireEvent.change(screen.getByLabelText("Sub-recipe 1 quantity"), { target: { value: "2" } });
    rerender(editor());
    fireEvent.change(screen.getByLabelText("Sub-recipe 1 unit"), { target: { value: "cups" } });
    expect(payload.components).toEqual([
      { component_recipe_id: 11, label: "Sauce", quantity: 2, unit: "cups" },
    ]);
    rerender(editor());
    fireEvent.change(screen.getByLabelText("Sub-recipe 1 quantity"), { target: { value: "" } });
    expect(payload.components).toEqual([
      { component_recipe_id: 11, label: "Sauce", quantity: null, unit: "cups" },
    ]);
  });

  it("starts new recipes with one ingredient and one step", () => {
    const payload = buildEmptyRecipePayload();

    expect(payload.ingredients).toHaveLength(1);
    expect(payload.ingredients?.[0]).toMatchObject({ position: 1, item: "" });
    expect(payload.steps).toHaveLength(1);
    expect(payload.steps?.[0]).toMatchObject({ position: 1, instruction: "" });
  });

  it("normalizes update rows while excluding the recipe from its own components", () => {
    const payload = buildEmptyRecipePayload();
    payload.title = "  Dinner  ";
    payload.ingredients = [
      { ...payload.ingredients![0], position: 4, item: "rice" },
    ];
    payload.steps = [
      {
        ...payload.steps![0],
        position: 7,
        instruction: "Cook it",
        ingredient_position_refs: [1, 4],
      },
    ];
    payload.components = [
      { component_recipe_id: 10 },
      { component_recipe_id: 11 },
    ];

    expect(buildRecipePayloadForUpdate(payload, 10)).toMatchObject({
      title: "Dinner",
      ingredients: [expect.objectContaining({ position: 1, item: "rice" })],
      steps: [
        expect.objectContaining({
          position: 1,
          ingredient_position_refs: [1],
        }),
      ],
      components: [{ component_recipe_id: 11 }],
    });
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
