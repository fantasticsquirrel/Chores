import type { ReactElement } from "react";
import { Link } from "react-router-dom";

import type { RecipeDetail } from "../../../api";
import { Button } from "../../../ui";

type RecipeRelationsProps = {
  onAddVariant: () => Promise<void>;
  recipe: RecipeDetail;
};

export function RecipeRelations({
  onAddVariant,
  recipe,
}: RecipeRelationsProps): ReactElement {
  return (
    <>
      <h2>Recipe Variants</h2>
      <p>
        Use variants for varieties like gluten-free, spicy, kid-friendly, or
        batch-size versions that stay attached to this core recipe.
      </p>
      <Button type="button" onClick={() => void onAddVariant()}>
        Add Variant
      </Button>
      {recipe.variants.length > 0 ? (
        <ul>
          {recipe.variants.map((row) => (
            <li key={row.id}>
              <Link to={`/recipes/${row.id}`}>{row.title}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No variants yet.</p>
      )}
      <h2>Sub-recipes</h2>
      {recipe.components.length > 0 ? (
        <ul>
          {recipe.components.map((row) => (
            <li key={row.component_recipe_id}>
              <Link to={`/recipes/${row.component_recipe_id}`}>
                {row.component_recipe.title}
              </Link>
              {row.label ? ` · ${row.label}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No sub-recipes attached yet. Use Edit Recipe to add sauces, doughs,
          marinades, or frostings.
        </p>
      )}
    </>
  );
}
