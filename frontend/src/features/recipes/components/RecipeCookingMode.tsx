import type { Dispatch, ReactElement, SetStateAction } from "react";

import type { RecipeDetail } from "../../../api";
import { Button, Card } from "../../../ui";
import type {
  DisplayedRecipeStep,
  UseRecipeDetailResult,
} from "../hooks/useRecipeDetail";
import {
  displayStepInstruction,
  formatIngredientLine,
} from "../lib/payloadMapping";

type RecipeCookingModeProps = {
  currentStep: DisplayedRecipeStep | undefined;
  currentStepIndex: number;
  displayedSteps: DisplayedRecipeStep[];
  linkedCurrentIngredients: RecipeDetail["ingredients"];
  recipe: RecipeDetail;
  setCookingMode: UseRecipeDetailResult["setCookingMode"];
  setCurrentStepIndex: Dispatch<SetStateAction<number>>;
};

export function RecipeCookingMode({
  currentStep,
  currentStepIndex,
  displayedSteps,
  linkedCurrentIngredients,
  recipe,
  setCookingMode,
  setCurrentStepIndex,
}: RecipeCookingModeProps): ReactElement {
  return (
    <Card as="section" className="recipe-detail-card cooking-mode-card">
      <Button type="button" onClick={() => setCookingMode(false)}>
        Exit Cooking Mode
      </Button>
      <p className="eyebrow">
        Cooking Mode · Step {Math.min(currentStepIndex + 1, displayedSteps.length)} of{" "}
        {displayedSteps.length}
      </p>
      <h1>{recipe.title}</h1>
      <h2>
        {currentStep !== undefined
          ? displayStepInstruction(currentStep)
          : "No steps yet."}
      </h2>
      {linkedCurrentIngredients.length > 0 ? (
        <p>
          Uses: {linkedCurrentIngredients.map(formatIngredientLine).join("; ")}
        </p>
      ) : null}
      <div className="recipe-print-actions cooking-step-actions">
        <Button
          type="button"
          disabled={currentStepIndex === 0}
          onClick={() =>
            setCurrentStepIndex((value) => Math.max(0, value - 1))
          }
        >
          Previous Step
        </Button>
        <Button
          type="button"
          disabled={currentStepIndex >= displayedSteps.length - 1}
          onClick={() =>
            setCurrentStepIndex((value) =>
              Math.min(displayedSteps.length - 1, value + 1),
            )
          }
        >
          Next Step
        </Button>
      </div>
    </Card>
  );
}
