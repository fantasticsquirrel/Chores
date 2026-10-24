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
  onReset: () => Promise<void>;
  loading: boolean;
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
  onReset,
  loading,
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
    <Card
      as="section"
      className="recipe-page-card recipe-tool-card recipe-browse-search"
    >
      <div className="recipe-section-heading">
        <div>
          <h2>Find a recipe</h2>
        </div>
        <Button
          type="button"
          aria-expanded={showAdvancedFilters}
          onClick={toggleAdvancedFilters}
        >
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
          <label className="recipe-checkbox-pill">
            <input
              type="checkbox"
              checked={favoriteOnly}
              onChange={(event) => setFavoriteOnly(event.target.checked)}
            />{" "}
            Favorites only
          </label>
          {showAdvancedFilters ? (
            <>
              <FormField label="Ingredient" className="recipe-form-field">
                <TextInput
                  value={ingredient}
                  onChange={(event) => setIngredient(event.target.value)}
                  placeholder="beef, flour, peppers..."
                />
              </FormField>
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
            </>
          ) : null}
        </div>
        <div className="recipe-filter-actions">
          <Button type="submit" disabled={loading}>
            {loading ? "Loading…" : "Apply Filters"}
          </Button>
          <Button
            type="button"
            className="recipe-secondary"
            onClick={() => void onReset()}
          >
            Reset filters
          </Button>
        </div>
      </form>
    </Card>
  );
}
