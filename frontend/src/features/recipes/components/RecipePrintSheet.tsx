import type { ReactElement } from "react";

import type { RecipeDetail } from "../../../api";
import type {
  DisplayedRecipeIngredient,
  DisplayedRecipeStep,
} from "../hooks/useRecipeDetail";
import {
  displayStepInstruction,
  formatIngredientLine,
} from "../lib/payloadMapping";
import { formatQuantity } from "../lib/scaling";

type RecipePrintSheetProps = {
  displayedIngredients: DisplayedRecipeIngredient[];
  displayedSteps: DisplayedRecipeStep[];
  recipe: RecipeDetail;
};

export function RecipePrintSheet({
  displayedIngredients,
  displayedSteps,
  recipe,
}: RecipePrintSheetProps): ReactElement {
  return (
    <article
      className="recipe-pdf-sheet"
      aria-label={`${recipe.title} PDF export`}
      aria-hidden="true"
    >
      <header>
        <p className="recipe-pdf-kicker">Family Manager Recipe</p>
        <h1>{recipe.title}</h1>
        <p className="recipe-pdf-meta">
          {recipe.servings !== null
            ? `Serves ${formatQuantity(recipe.servings)}`
            : "Servings not set"}
          {recipe.categories.length > 0
            ? ` · ${recipe.categories.map((row) => row.name).join(", ")}`
            : ""}
          {recipe.tags.length > 0
            ? ` · ${recipe.tags.map((row) => row.name).join(", ")}`
            : ""}
        </p>
        {recipe.description.trim().length > 0 ? (
          <p>{recipe.description}</p>
        ) : null}
        {recipe.source_url !== null ? (
          <p className="recipe-pdf-source">
            Source: {recipe.source_name || recipe.source_url}
          </p>
        ) : null}
      </header>
      <section className="recipe-pdf-grid">
        <div>
          <h2>Ingredients</h2>
          <ul>
            {displayedIngredients.map((row) => (
              <li key={row.id}>{formatIngredientLine(row)}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Steps</h2>
          <ol>
            {displayedSteps.map((step) => (
              <li key={step.id}>{displayStepInstruction(step)}</li>
            ))}
          </ol>
        </div>
      </section>
      {recipe.notes.trim().length > 0 ? (
        <p className="recipe-pdf-notes">
          <strong>Notes:</strong> {recipe.notes}
        </p>
      ) : null}
    </article>
  );
}
