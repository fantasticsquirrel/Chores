import type { FormEvent, ReactElement } from "react";

import type {
  CreateRecipeRequest,
  RecipeCategory,
  RecipeIngredientRequest,
  RecipeStepRequest,
  RecipeSummary,
  RecipeTag,
} from "../../../api";
import { Button, FormField, TextInput } from "../../../ui";
import { emptyIngredient, emptyStep, parsePositionRefs } from "../lib/payloadMapping";

type RecipeEditorProps = {
  payload: CreateRecipeRequest;
  setPayload: (next: CreateRecipeRequest | ((prev: CreateRecipeRequest) => CreateRecipeRequest)) => void;
  categories: RecipeCategory[];
  tags: RecipeTag[];
  availableRecipes: RecipeSummary[];
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
};

export function RecipeEditor({ payload, setPayload, categories, tags, availableRecipes, submitLabel, onSubmit, onCancel }: RecipeEditorProps): ReactElement {
  const ingredients = payload.ingredients ?? [emptyIngredient()];
  const steps = payload.steps ?? [emptyStep()];
  const components = payload.components ?? [];

  function updateIngredient(index: number, patch: Partial<RecipeIngredientRequest>): void {
    setPayload((prev) => {
      const rows = [...(prev.ingredients ?? [])];
      rows[index] = { ...emptyIngredient(index + 1), ...rows[index], ...patch, position: index + 1 };
      return { ...prev, ingredients: rows.map((row, rowIndex) => ({ ...row, position: rowIndex + 1 })) };
    });
  }

  function updateStep(index: number, patch: Partial<RecipeStepRequest>): void {
    setPayload((prev) => {
      const rows = [...(prev.steps ?? [])];
      rows[index] = { ...emptyStep(index + 1), ...rows[index], ...patch, position: index + 1 };
      return { ...prev, steps: rows.map((row, rowIndex) => ({ ...row, position: rowIndex + 1 })) };
    });
  }

  function updateComponent(index: number, patch: Partial<NonNullable<CreateRecipeRequest["components"]>[number]>): void {
    setPayload((prev) => {
      const rows = [...(prev.components ?? [])];
      rows[index] = { component_recipe_id: 0, label: "", quantity: null, unit: "", ...rows[index], ...patch };
      return { ...prev, components: rows };
    });
  }

  return (
    <form className="recipe-editor-form" onSubmit={onSubmit}>
      <div className="recipe-editor-grid">
        <FormField label="Title"><TextInput value={payload.title} onChange={(event) => setPayload((prev) => ({ ...prev, title: event.target.value }))} required /></FormField>
        <FormField label="Recipe Photo URL"><TextInput type="url" value={payload.photo_url ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, photo_url: event.target.value.trim() === "" ? null : event.target.value }))} /></FormField>
        <FormField label="Description"><TextInput value={payload.description ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, description: event.target.value }))} /></FormField>
        <FormField label="Source URL"><TextInput type="url" value={payload.source_url ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, source_url: event.target.value.trim() === "" ? null : event.target.value }))} /></FormField>
        <FormField label="Source Name"><TextInput value={payload.source_name ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, source_name: event.target.value }))} /></FormField>
        <FormField label="Default Servings"><TextInput type="number" value={payload.servings ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, servings: event.target.value === "" ? null : Number(event.target.value) }))} /></FormField>
        <FormField label="Prep Minutes"><TextInput type="number" value={payload.prep_minutes ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, prep_minutes: event.target.value === "" ? null : Number(event.target.value) }))} /></FormField>
        <FormField label="Cook Minutes"><TextInput type="number" value={payload.cook_minutes ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, cook_minutes: event.target.value === "" ? null : Number(event.target.value) }))} /></FormField>
        <FormField label="Rating"><TextInput type="number" min="1" max="5" value={payload.rating ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, rating: event.target.value === "" ? null : Number(event.target.value) }))} /></FormField>
        <FormField label="Notes"><TextInput value={payload.notes ?? ""} onChange={(event) => setPayload((prev) => ({ ...prev, notes: event.target.value }))} /></FormField>
      </div>
      <label><input type="checkbox" checked={payload.favorite ?? false} onChange={(event) => setPayload((prev) => ({ ...prev, favorite: event.target.checked }))} /> Favorite</label>
      <FormField label="Categories"><select multiple value={(payload.category_ids ?? []).map(String)} onChange={(event) => setPayload((prev) => ({ ...prev, category_ids: Array.from(event.target.selectedOptions).map((option) => Number(option.value)) }))}>{categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></FormField>
      <FormField label="Tags"><select multiple value={(payload.tag_ids ?? []).map(String)} onChange={(event) => setPayload((prev) => ({ ...prev, tag_ids: Array.from(event.target.selectedOptions).map((option) => Number(option.value)) }))}>{tags.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></FormField>

      <h3>Ingredients</h3>
      {ingredients.map((row, index) => (
        <div className="recipe-row-editor" key={index}>
          <strong>#{index + 1}</strong>
          <TextInput aria-label={index === 0 ? "Ingredient Item" : `Ingredient ${index + 1} item`} placeholder="Item" value={row.item} onChange={(event) => updateIngredient(index, { item: event.target.value })} />
          <TextInput aria-label={index === 0 ? "Ingredient Quantity" : `Ingredient ${index + 1} quantity`} type="number" placeholder="Qty" value={row.quantity ?? ""} onChange={(event) => updateIngredient(index, { quantity: event.target.value === "" ? null : Number(event.target.value) })} />
          <TextInput aria-label={index === 0 ? "Ingredient Unit" : `Ingredient ${index + 1} unit`} placeholder="Unit" value={row.unit ?? ""} onChange={(event) => updateIngredient(index, { unit: event.target.value })} />
          <TextInput aria-label={`Ingredient ${index + 1} prep`} placeholder="Preparation" value={row.preparation ?? ""} onChange={(event) => updateIngredient(index, { preparation: event.target.value })} />
          <Button type="button" variant="danger" onClick={() => setPayload((prev) => ({ ...prev, ingredients: (prev.ingredients ?? []).filter((_, rowIndex) => rowIndex !== index).map((item, rowIndex) => ({ ...item, position: rowIndex + 1 })) }))}>Remove</Button>
        </div>
      ))}
      <Button type="button" onClick={() => setPayload((prev) => ({ ...prev, ingredients: [...(prev.ingredients ?? []), emptyIngredient((prev.ingredients ?? []).length + 1)] }))}>Add Ingredient</Button>

      <h3>Steps</h3>
      {steps.map((row, index) => (
        <div className="recipe-row-editor" key={index}>
          <strong>#{index + 1}</strong>
          <TextInput aria-label={index === 0 ? "Step Instruction" : `Step ${index + 1} instruction`} placeholder="Instruction" value={row.instruction} onChange={(event) => updateStep(index, { instruction: event.target.value })} />
          <TextInput aria-label={`Step ${index + 1} linked ingredients`} placeholder="Linked ingredient positions, e.g. 1,2" value={(row.ingredient_position_refs ?? []).join(",")} onChange={(event) => updateStep(index, { ingredient_position_refs: parsePositionRefs(event.target.value) })} />
          <Button type="button" variant="danger" onClick={() => setPayload((prev) => ({ ...prev, steps: (prev.steps ?? []).filter((_, rowIndex) => rowIndex !== index).map((item, rowIndex) => ({ ...item, position: rowIndex + 1 })) }))}>Remove</Button>
        </div>
      ))}
      <Button type="button" onClick={() => setPayload((prev) => ({ ...prev, steps: [...(prev.steps ?? []), emptyStep((prev.steps ?? []).length + 1)] }))}>Add Step</Button>

      <h3>Sub-recipes / Components</h3>
      {components.map((row, index) => (
        <div className="recipe-row-editor" key={index}>
          <select aria-label={`Sub-recipe ${index + 1}`} value={row.component_recipe_id} onChange={(event) => updateComponent(index, { component_recipe_id: Number(event.target.value) })}>
            <option value={0}>Choose recipe</option>
            {availableRecipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}
          </select>
          <TextInput aria-label={`Sub-recipe ${index + 1} label`} placeholder="Label, e.g. sauce" value={row.label ?? ""} onChange={(event) => updateComponent(index, { label: event.target.value })} />
          <TextInput aria-label={`Sub-recipe ${index + 1} quantity`} type="number" placeholder="Qty" value={row.quantity ?? ""} onChange={(event) => updateComponent(index, { quantity: event.target.value === "" ? null : Number(event.target.value) })} />
          <TextInput aria-label={`Sub-recipe ${index + 1} unit`} placeholder="Unit" value={row.unit ?? ""} onChange={(event) => updateComponent(index, { unit: event.target.value })} />
          <Button type="button" variant="danger" onClick={() => setPayload((prev) => ({ ...prev, components: (prev.components ?? []).filter((_, rowIndex) => rowIndex !== index) }))}>Remove</Button>
        </div>
      ))}
      <Button type="button" onClick={() => setPayload((prev) => ({ ...prev, components: [...(prev.components ?? []), { component_recipe_id: 0, label: "", quantity: null, unit: "" }] }))}>Add Sub-recipe</Button>

      <div className="recipe-print-actions">
        <Button type="submit">{submitLabel}</Button>
        {onCancel !== undefined ? <Button type="button" onClick={onCancel}>Cancel</Button> : null}
      </div>
    </form>
  );
}
