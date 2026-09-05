import type { ReactElement } from "react";

import { FormField, TextInput } from "../../../ui";
import type {
  DisplayedRecipeIngredient,
  DisplayedRecipeStep,
} from "../hooks/useRecipeDetail";
import {
  displayStepInstruction,
  formatIngredientLine,
} from "../lib/payloadMapping";

type RecipeInstructionsProps = {
  displayedIngredients: DisplayedRecipeIngredient[];
  displayedSteps: DisplayedRecipeStep[];
  onScaleMultiplier: (value: string) => Promise<void>;
  onScaleServings: (value: string) => Promise<void>;
  scaleMultiplier: string;
  targetServings: string;
};

export function RecipeInstructions({
  displayedIngredients,
  displayedSteps,
  onScaleMultiplier,
  onScaleServings,
  scaleMultiplier,
  targetServings,
}: RecipeInstructionsProps): ReactElement {
  return (
    <>
      <FormField label="Scaled Servings">
        <TextInput
          type="number"
          value={targetServings}
          onChange={(event) => void onScaleServings(event.target.value)}
        />
      </FormField>
      <FormField label="Scale Multiplier">
        <TextInput
          type="number"
          step="0.25"
          value={scaleMultiplier}
          onChange={(event) => void onScaleMultiplier(event.target.value)}
        />
      </FormField>
      <h2>Ingredients</h2>
      <ul>
        {displayedIngredients.map((row) => (
          <li key={row.id}>
            <label>
              <input type="checkbox" /> {formatIngredientLine(row)}
            </label>
          </li>
        ))}
      </ul>
      <h2>Steps</h2>
      <ol>
        {displayedSteps.map((step) => (
          <li key={step.id}>{displayStepInstruction(step)}</li>
        ))}
      </ol>
    </>
  );
}
