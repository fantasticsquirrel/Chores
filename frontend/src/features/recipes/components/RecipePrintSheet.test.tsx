import { render, screen } from "@testing-library/react";
import type { RecipeDetail } from "../../../api";
import { RecipePrintSheet } from "./RecipePrintSheet";
it("prints the selected servings and multiplier, not the original servings", () => {
  const recipe = {
    title: "Soup",
    servings: 4,
    categories: [],
    tags: [],
    description: "",
    source_url: null,
    source_name: "Family card",
    notes: "",
  } as unknown as RecipeDetail;
  render(
    <RecipePrintSheet
      recipe={recipe}
      displayedIngredients={[]}
      displayedSteps={[]}
      targetServings="8"
      scaleMultiplier="2"
    />,
  );
  expect(screen.getByText("Serves 8 · Scale 2×")).toBeInTheDocument();
  expect(screen.getByText("Source: Family card")).toBeInTheDocument();
});
