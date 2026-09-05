import type { FormEvent, ReactElement } from "react";

import type { RecipeCategory, RecipeTag } from "../../../api";
import { Button, Card, FormField, TextInput } from "../../../ui";

type RecipeFilterPanelProps = {
  categories: RecipeCategory[];
  categoryId: string;
  favoriteOnly: boolean;
  ingredient: string;
  minRating: string;
  onFilter: () => Promise<void>;
  query: string;
  setCategoryId: (value: string) => void;
  setFavoriteOnly: (value: boolean) => void;
  setIngredient: (value: string) => void;
  setMinRating: (value: string) => void;
  setQuery: (value: string) => void;
  setTagId: (value: string) => void;
  showAdvancedFilters: boolean;
  tagId: string;
  tags: RecipeTag[];
  toggleAdvancedFilters: () => void;
};

export function RecipeFilterPanel({
  categories,
  categoryId,
  favoriteOnly,
  ingredient,
  minRating,
  onFilter,
  query,
  setCategoryId,
  setFavoriteOnly,
  setIngredient,
  setMinRating,
  setQuery,
  setTagId,
  showAdvancedFilters,
  tagId,
  tags,
  toggleAdvancedFilters,
}: RecipeFilterPanelProps): ReactElement {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void onFilter();
  }

  return (
    <Card as="section" className="recipe-page-card recipe-tool-card">
      <div className="recipe-section-heading">
        <div>
          <p className="eyebrow">Cookbook Search</p>
          <h2>Find a recipe</h2>
          <p>
            Search by name or ingredient, then narrow by category, tags,
            favorites, or rating.
          </p>
        </div>
        <Button type="button" onClick={toggleAdvancedFilters}>
          {showAdvancedFilters ? "Hide Advanced" : "Advanced Filters"}
        </Button>
      </div>
      <form className="recipe-filter-form" onSubmit={handleSubmit}>
        <div className="recipe-filter-grid">
          <FormField label="Search" className="recipe-form-field">
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Spaghetti, cake, fajitas..."
            />
          </FormField>
          <FormField label="Ingredient" className="recipe-form-field">
            <TextInput
              value={ingredient}
              onChange={(event) => setIngredient(event.target.value)}
              placeholder="beef, flour, peppers..."
            />
          </FormField>
          {showAdvancedFilters ? (
            <>
              <FormField label="Category" className="recipe-form-field">
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Any category</option>
                  {categories.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Tag" className="recipe-form-field">
                <select
                  value={tagId}
                  onChange={(event) => setTagId(event.target.value)}
                >
                  <option value="">Any tag</option>
                  {tags.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Minimum Rating" className="recipe-form-field">
                <TextInput
                  type="number"
                  min="1"
                  max="5"
                  value={minRating}
                  onChange={(event) => setMinRating(event.target.value)}
                />
              </FormField>
              <label className="recipe-checkbox-pill">
                <input
                  type="checkbox"
                  checked={favoriteOnly}
                  onChange={(event) => setFavoriteOnly(event.target.checked)}
                />{" "}
                Favorites only
              </label>
            </>
          ) : null}
        </div>
        <div className="recipe-filter-actions">
          <Button type="submit">Apply Filters</Button>
        </div>
      </form>
    </Card>
  );
}
