import type { ReactElement } from "react";
import { Link } from "react-router-dom";

import type { RecipeSummary } from "../../../api";
import { Card } from "../../../ui";
import { recipeMetaPills, recipeTaxonomy } from "../lib/payloadMapping";

type RecipeCardGridProps = {
  recipes: RecipeSummary[];
};

export function RecipeCardGrid({
  recipes,
}: RecipeCardGridProps): ReactElement {
  return (
    <section className="recipe-card-grid">
      {recipes.map((recipe) => (
        <Card as="article" key={recipe.id} className="recipe-card">
          <div className="recipe-card-media">
            {recipe.photo_url !== null ? (
              <img
                className="recipe-photo recipe-photo--card"
                src={recipe.photo_url}
                alt={`${recipe.title}`}
                loading="lazy"
              />
            ) : (
              <div className="recipe-photo-placeholder">Family Recipe</div>
            )}
            {recipe.favorite ? (
              <span
                className="recipe-favorite-badge"
                aria-label="Favorite recipe"
              >
                ★
              </span>
            ) : null}
          </div>
          <div className="recipe-card-body">
            <p className="eyebrow">Recipe</p>
            <h2>{recipe.title}</h2>
            <p className="recipe-card-description">
              {recipe.description || "No description yet."}
            </p>
            <div className="recipe-pill-row">
              {recipeMetaPills(recipe).map((pill) => (
                <span key={pill} className="recipe-meta-pill">
                  {pill}
                </span>
              ))}
            </div>
            {recipeTaxonomy(recipe).length > 0 ? (
              <div className="recipe-chip-row">
                {recipeTaxonomy(recipe).map((label) => (
                  <span key={label} className="recipe-chip">
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            <Link
              className="jewel-button button-reset recipe-card-cta"
              to={`/recipes/${recipe.id}`}
            >
              View Recipe
            </Link>
          </div>
        </Card>
      ))}
    </section>
  );
}
