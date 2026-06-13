# Recipe Organizer Sub-App Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a parent-accessible recipe organizer module to Family Manager with per-parent-account recipe storage, categories/tags, structured ingredients, alternate sub-recipes/varieties, recipe scaling, search/filtering, and a cooking-friendly detail view.

**Architecture:** Implement recipes as a new Family Manager module beside `chores`, `homeschool`, and `admin`. Recipes are scoped to the signed-in parent account (`owner_user_id`) rather than shared household-wide, while still retaining `household_id` for authorization/module boundaries. Keep the first release self-contained in the current FastAPI + SQLite + React/Vite stack, using normalized recipe tables for durable search/filter/edit behavior and pure TypeScript/Python scaling helpers for testable math.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite `create_all`, Pydantic, Pytest, React 18, TypeScript, Vite/Vitest, React Router, custom Jewel Pop UI components.

---

## Research Summary

I reviewed Recipe Keeper, Paprika, Copy Me That, RecipeSage, Mealie, and Tandoor. The feature patterns worth copying are:

- **Recipe Keeper:** course/category organization, photos, favorites/ratings, website/photo/PDF import, search by name/ingredient/directions, serving-size scaling, weekly/monthly meal planning, shopping lists grouped by aisle, family sharing, printable cookbooks.
- **Paprika:** built-in web import, cloud sync, smart grocery lists with ingredient combining, interactive cooking mode with checked-off ingredients and highlighted steps, auto-detected timers, pinned active recipes, serving scaling, metric/imperial conversion, reusable menus.
- **Copy Me That:** one-click recipe clipper, editable copied recipes, collections, search/filter/print/scale/email/share, integrated shopping list and meal planner, multiple lists, pantry list.
- **RecipeSage:** URL/photo/PDF/document import, nutrition tracking, offline access, drag/drop meal planning, smart shopping lists, recipe scaling and unit conversion including instructions, powerful labels/search with typo tolerance, sharing/collaboration, import/export portability.
- **Mealie:** household sharing, categories and tags, REST API, custom key/value pairs, raw JSON editor, migration/import, random meal plan rules, PWA.
- **Tandoor:** powerful recipe editor, ingredient/fridge-based search, permissioned sharing, supermarket-sorted shopping lists, automatic meal plans, nutrition/price/custom property calculations, URL importer, space-based collaboration.

## MVP Scope for Family Manager

Build the core organizer first, then layer import/meal planning/shopping later.

### MVP must support

- Parent-only recipe module available in module access controls.
- Recipes with title, description, source URL, notes, prep/cook time, yield quantity/unit, serving count, favorite flag, rating, archived flag.
- Categories and tags, separate from chore tags to avoid semantic coupling.
- Structured ingredients with quantity, unit, item name, preparation, optional group heading, and ordering.
- Ordered directions/steps with optional section heading.
- Alternate sub-recipes/varieties:
  - A recipe can have child variants such as “gluten-free crust”, “spicy version”, “instant pot version”.
  - A recipe can reference another recipe as a component/sub-recipe such as sauce, dough, rub, frosting.
- Scaling preview from base servings/yield to target servings/yield without mutating saved recipe.
- List/search/filter by text, category, tag, favorite, rating, and ingredient query.
- Cooking-friendly detail view with ingredients, steps, checkboxes, scale selector, and variant/sub-recipe links.

### Defer until v2

- Website import/clipper.
- OCR/PDF/photo parsing.
- Meal planner integration.
- Shopping list generation and aisle grouping.
- Nutrition, cost, pantry, inventory.
- Public sharing/print cookbook export.
- AI substitutions/import cleanup.

---

## Data Model

Add the following SQLAlchemy models to `backend/app/models/core.py`.

### `RecipeCategory`

- `id` primary key
- `household_id` FK `households.id`, indexed, cascade delete
- `owner_user_id` FK `users.id`, indexed, cascade delete; signed-in parent/admin owner
- `name` string 100
- `color` string 32 default `#f97316`
- unique `(owner_user_id, name)`

### `RecipeTag`

- `id` primary key
- `household_id` FK, indexed
- `owner_user_id` FK `users.id`, indexed, cascade delete; signed-in parent/admin owner
- `name` string 100
- unique `(owner_user_id, name)`

### `Recipe`

- `id` primary key
- `household_id` FK, indexed
- `owner_user_id` FK `users.id`, indexed, cascade delete; signed-in parent/admin owner
- `parent_recipe_id` nullable FK `recipes.id`, indexed, cascade delete; used for varieties/alternates
- `title` string 255, indexed enough via query filtering
- `description` string 2000 default `""`
- `source_name` string 255 default `""`
- `source_url` string 1000 nullable
- `prep_minutes` nullable int, check >= 0
- `cook_minutes` nullable int, check >= 0
- `servings` nullable numeric/float or integer; prefer `Float` because recipes use 2.5 servings occasionally
- `yield_quantity` nullable float
- `yield_unit` string 64 default `""`
- `rating` nullable int, check 1..5 when present
- `favorite` bool default false
- `notes` string 4000 default `""`
- `archived_at` nullable datetime
- `created_at` from `TimestampMixin`
- `updated_at` nullable datetime or explicit on-write timestamp if current patterns allow; otherwise defer and keep `created_at`

### `RecipeCategoryLink`

- `recipe_id` FK `recipes.id`, primary key
- `category_id` FK `recipe_categories.id`, primary key

### `RecipeTagLink`

- `recipe_id` FK, primary key
- `tag_id` FK, primary key

### `RecipeIngredient`

- `id` primary key
- `recipe_id` FK, indexed
- `position` int
- `group_name` string 100 default `""`
- `quantity` nullable float
- `unit` string 64 default `""`
- `item` string 255
- `preparation` string 255 default `""` for “chopped”, “melted”, etc.
- `note` string 500 default `""`
- `is_optional` bool default false
- unique `(recipe_id, position)`

### `RecipeStep`

- `id` primary key
- `recipe_id` FK, indexed
- `position` int
- `section` string 100 default `""`
- `instruction` string 2000
- unique `(recipe_id, position)`

### `RecipeComponent`

- `parent_recipe_id` FK `recipes.id`, primary key
- `component_recipe_id` FK `recipes.id`, primary key
- `label` string 100 default `""` such as “sauce”, “dough”, “filling”
- `quantity` nullable float
- `unit` string 64 default `""`
- check `parent_recipe_id != component_recipe_id`

---

## API Design

Create `backend/app/api/recipes.py` with router prefix `/recipes`. Include it from `backend/app/main.py` under `/chore-api`.

All endpoints require `require_module_access(MODULE_RECIPES, UserRole.PARENT_ADMIN, UserRole.PARENT)`. Children do not get recipe access in MVP.

### Category/tag endpoints

- `GET /recipes/categories?household_id=` → list categories by name
- `POST /recipes/categories` → create category
- `PUT /recipes/categories/{category_id}` → update category
- `DELETE /recipes/categories/{category_id}?household_id=` → delete only if no linked recipes, or unlink first if we choose forgiving UX
- `GET /recipes/tags?household_id=` → list tags
- `POST /recipes/tags` → create tag
- `PUT /recipes/tags/{tag_id}` → update tag
- `DELETE /recipes/tags/{tag_id}?household_id=` → delete only if no linked recipes or unlink first

### Recipe endpoints

- `GET /recipes?household_id=&query=&category_id=&tag_id=&favorite=&min_rating=&ingredient=&active_only=true`
  - Returns compact list cards with categories/tags and ingredient count.
  - Search `query` across title, description, source name, notes, step instructions.
  - Search `ingredient` against ingredient item/preparation/note.
- `POST /recipes` → create full recipe with category IDs, tag IDs, ingredients, steps, component IDs.
- `GET /recipes/{recipe_id}?household_id=` → return full detail with categories, tags, ingredients, steps, components, variants.
- `PUT /recipes/{recipe_id}` → replace full editable recipe payload.
- `PATCH /recipes/{recipe_id}/archive` → set/clear archive.
- `POST /recipes/{recipe_id}/duplicate` → copy recipe as new base recipe or variant.
- `GET /recipes/{recipe_id}/scale?household_id=&target_servings=` → return scaled ingredients preview.

### Scaling rules

- If `target_servings` and recipe has `servings`, scale factor = `target_servings / servings`.
- If no base serving/yield exists, return factor 1 with a warning message.
- Scale only numeric ingredient quantities. Leave text-only quantities unchanged.
- Preserve fractions by formatting in frontend helper:
  - 0.125 → `1/8`
  - 0.25 → `1/4`
  - 0.333 → `1/3`
  - 0.5 → `1/2`
  - 0.667 → `2/3`
  - 0.75 → `3/4`
  - otherwise decimal with max 2 places.
- Do not mutate stored base quantities during scaling preview.

---

## Frontend UX

### Routes

- Add nav item: `/recipes`, label `Recipes`, module key `recipes`, roles `PARENT_ADMIN`, `PARENT`.
- Add route guard under `ModuleProtectedRoute moduleKey="recipes"`.
- Add `RecipeOrganizerPage` at `frontend/src/pages/RecipeOrganizerPage.tsx`.

### Page structure

Use the existing Jewel Pop `Card`, `Button`, `InlineNotice`, `Form` UI pattern.

- Header card:
  - Title: “Recipe Organizer”
  - Quick stats: total recipes, favorites, categories, tags
  - Primary action: “New Recipe”
- Filter/search card:
  - text search
  - category select
  - tag select
  - ingredient contains field
  - favorite toggle
  - rating filter
  - show archived toggle
- Recipe list:
  - cards with title, categories, tags, source, prep/cook time, serving/yield, favorite/rating
  - quick actions: view, edit, duplicate as variant, archive
- Detail/cooking card:
  - scale selector: base, 0.5x, 2x, custom target servings
  - grouped ingredients with checkboxes
  - ordered steps with checkboxes/highlight current step
  - components/sub-recipes links
  - variants list
- Editor card/modal:
  - title/details fields
  - category/tag multi-select, with quick create
  - dynamic ingredient rows
  - dynamic step rows
  - component recipe picker
  - parent recipe/variant selector
  - save/cancel

---

## Implementation Tasks

### Task 1: Add recipes module constants

**Objective:** Register the recipes module in backend and frontend module registries.

**Files:**
- Modify: `backend/app/modules.py`
- Modify: `frontend/src/modules/registry.ts`
- Test: `backend/tests/test_modules_api.py` or existing module tests if present
- Test: `frontend/src/App.protected-routes.test.tsx` or a new route visibility test

**Steps:**
1. Add `MODULE_RECIPES = "recipes"` in `backend/app/modules.py`.
2. Add `AppModule(key=MODULE_RECIPES, name="Recipes", description="Recipe collection, categories, ingredients, scaling, and cooking notes.")` to `AVAILABLE_MODULES`.
3. Add `MODULE_RECIPES` to `PARENT_ADMIN` and `PARENT` defaults, not `CHILD`.
4. Extend `FamilyModuleKey` in `frontend/src/modules/registry.ts` to include `"recipes"`.
5. Add a `familyModules` entry pointing to `/recipes`.
6. Add/adjust tests proving parents see the recipes module and children do not.
7. Run backend and frontend targeted tests.

### Task 2: Add recipe SQLAlchemy models

**Objective:** Persist recipes, categories, tags, ingredients, steps, variants, and components.

**Files:**
- Modify: `backend/app/models/core.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_recipes_api.py`

**Steps:**
1. Write a failing pytest that initializes a temp DB and asserts all recipe tables exist.
2. Add imports for `Float`, `Text`, and any needed SQLAlchemy constraints.
3. Add the models from the Data Model section.
4. Add the classes to `ALL_MODELS` in `backend/app/models/__init__.py`.
5. Run `pytest backend/tests/test_recipes_api.py -q` and verify table creation passes.

### Task 3: Add Pydantic recipe schemas

**Objective:** Define validated API payloads/responses for recipe CRUD.

**Files:**
- Create: `backend/app/schemas/recipes.py`
- Test: `backend/tests/test_recipes_api.py`

**Steps:**
1. Add request/response models for categories, tags, ingredients, steps, components, recipe summary, recipe detail, create/update recipe, archive request, duplicate request, and scale response.
2. Enforce non-empty title, item, and instruction fields.
3. Enforce ratings 1..5, non-negative times, positive target servings, and no duplicate positions in payload lists.
4. Add schema-level tests for invalid rating, duplicate ingredient positions, and empty title.

### Task 4: Implement recipe API helpers

**Objective:** Centralize household authorization and full recipe read/write assembly.

**Files:**
- Create: `backend/app/api/recipes.py`
- Test: `backend/tests/test_recipes_api.py`

**Steps:**
1. Add `_require_recipes_access = require_module_access(MODULE_RECIPES, UserRole.PARENT_ADMIN, UserRole.PARENT)`.
2. Add `_ensure_household_access(current_user, household_id)` matching homeschool API style.
3. Add `_get_recipe_or_404(session, recipe_id, household_id)`.
4. Add `_replace_recipe_links_and_children(session, recipe, payload)` that deletes/recreates category links, tag links, ingredients, steps, and components on full update.
5. Add `_serialize_recipe_detail(session, recipe)` or use response assembly functions if raw ORM relationships are not configured.

### Task 5: Implement category/tag endpoints

**Objective:** CRUD recipe categories and tags with household isolation.

**Files:**
- Modify: `backend/app/api/recipes.py`
- Test: `backend/tests/test_recipes_api.py`

**Steps:**
1. Write tests for list/create/update/delete category.
2. Write tests for duplicate category returning 400.
3. Repeat for tags.
4. Implement endpoints.
5. Verify cross-household access returns 403/404 as appropriate.

### Task 6: Implement recipe create/list/detail/update/archive

**Objective:** Provide the core recipe organizer API.

**Files:**
- Modify: `backend/app/api/recipes.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_recipes_api.py`

**Steps:**
1. Include `recipes_router` in `backend/app/main.py`.
2. Write a test that creates a full recipe with category, tag, two ingredients, two steps, then reads detail.
3. Write list/filter tests for query, category, tag, favorite, rating, ingredient, active_only.
4. Write update test replacing ingredients/steps and changing categories/tags.
5. Write archive/unarchive test.
6. Implement endpoints.
7. Run `pytest backend/tests/test_recipes_api.py -q`.

### Task 7: Implement variants and components

**Objective:** Support alternate versions and sub-recipes.

**Files:**
- Modify: `backend/app/api/recipes.py`
- Test: `backend/tests/test_recipes_api.py`

**Steps:**
1. Write a test creating a base “Pizza” recipe and variant “Gluten-free Pizza” with `parent_recipe_id`.
2. Assert detail for the base includes variants.
3. Write a test creating “Tomato Sauce” and referencing it as a component of “Lasagna”.
4. Assert detail includes component labels and linked recipe IDs/titles.
5. Reject self-component and cross-household component IDs.
6. Implement validation and serialization.

### Task 8: Implement scaling service

**Objective:** Make recipe scaling deterministic and independently tested.

**Files:**
- Create: `backend/app/services/recipes.py`
- Modify: `backend/app/api/recipes.py`
- Test: `backend/tests/test_recipe_scaling.py`

**Steps:**
1. Add pure function `scale_ingredients(ingredients, base_servings, target_servings)` returning factor and scaled quantities.
2. Test normal scaling, half scaling, missing base serving fallback, and ingredients without quantity.
3. Add `GET /recipes/{recipe_id}/scale` endpoint.
4. Verify endpoint response includes original and scaled quantities.

### Task 9: Add frontend recipe TypeScript models and client methods

**Objective:** Expose recipe API to React.

**Files:**
- Modify: `frontend/src/api/models.ts`
- Modify: `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.test.ts`

**Steps:**
1. Add interfaces mirroring backend schema.
2. Add `listRecipeCategories`, `createRecipeCategory`, `updateRecipeCategory`, `deleteRecipeCategory`.
3. Add equivalent tag methods.
4. Add `listRecipes`, `getRecipe`, `createRecipe`, `updateRecipe`, `archiveRecipe`, `duplicateRecipe`, `scaleRecipe`.
5. Add client tests for URL/query construction and CSRF write headers.

### Task 10: Add recipe data hook and scaling formatter

**Objective:** Keep page UI manageable and scaling display consistent.

**Files:**
- Create: `frontend/src/pages/recipes/useRecipeData.ts`
- Create: `frontend/src/pages/recipes/scaling.ts`
- Test: `frontend/src/pages/recipes/scaling.test.ts`

**Steps:**
1. Add `formatQuantity(value: number | null)` with fraction-friendly output.
2. Add tests for 1/8, 1/4, 1/3, 1/2, 2/3, 3/4, whole numbers, and decimals.
3. Add `useRecipeData(householdId, filters)` to load categories, tags, and recipe summaries.
4. Return `refresh`, loading state, and normalized error text.

### Task 11: Build RecipeOrganizerPage shell

**Objective:** Add the navigable recipes page with filters and list cards.

**Files:**
- Create: `frontend/src/pages/RecipeOrganizerPage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/App.recipes.test.tsx`

**Steps:**
1. Add nav item `{ to: "/recipes", label: "Recipes", roles: ["PARENT_ADMIN", "PARENT"], moduleKey: "recipes" }`.
2. Add route under parent role and `ModuleProtectedRoute moduleKey="recipes"`.
3. Render header, stats, filter controls, empty state, and recipe cards.
4. Test that parent with recipes module can navigate/render page.
5. Test that child cannot access recipes route.

### Task 12: Build recipe editor component

**Objective:** Let parents create and edit recipe details, ingredients, steps, variants, and components.

**Files:**
- Create: `frontend/src/pages/recipes/RecipeEditor.tsx`
- Modify: `frontend/src/pages/RecipeOrganizerPage.tsx`
- Test: `frontend/src/App.recipes.test.tsx`

**Steps:**
1. Add controlled fields for recipe metadata.
2. Add category/tag selectors and quick-create controls.
3. Add dynamic ingredient rows with add/remove/reorder.
4. Add dynamic step rows with add/remove/reorder.
5. Add parent recipe selector for varieties.
6. Add component recipe selector with label/quantity/unit.
7. Save via API and refresh list/detail.
8. Test creating a recipe from the UI with one category, one tag, one ingredient, and one step.

### Task 13: Build recipe detail/cooking view

**Objective:** Provide a kitchen-friendly read view with scaling and checkoffs.

**Files:**
- Create: `frontend/src/pages/recipes/RecipeDetail.tsx`
- Modify: `frontend/src/pages/RecipeOrganizerPage.tsx`
- Test: `frontend/src/App.recipes.test.tsx`

**Steps:**
1. Render selected recipe title, source, time, servings/yield, notes.
2. Render scale selector and call `scaleRecipe` when target servings changes.
3. Render grouped ingredients with local checkbox state.
4. Render steps with local checkbox/highlight state.
5. Render variants and components as buttons that open linked recipes.
6. Test that changing target servings updates displayed quantities.

### Task 14: Add browser-level smoke test

**Objective:** Prove the recipe module works through the real app shell.

**Files:**
- Create: `frontend/e2e/recipes.spec.ts`
- Possibly modify test fixture/seed helpers if current e2e tests use them.

**Steps:**
1. Seed/login as a parent user.
2. Visit `/recipes`.
3. Create a category and tag.
4. Create a recipe with ingredient and step.
5. Filter by ingredient and verify the recipe remains visible.
6. Open detail and scale from 4 servings to 8 servings.
7. Verify ingredient quantity doubles.

### Task 15: Full verification

**Objective:** Ensure the feature is safe for release.

**Commands:**

```bash
cd /var/ralph-projects/chore_tracking/backend
pytest -q

cd /var/ralph-projects/chore_tracking/frontend
npm test -- --run
npm run build
npx playwright test e2e/recipes.spec.ts
```

**Expected:** all backend tests pass, frontend tests pass, production build succeeds, and recipe e2e smoke passes.

---

## Acceptance Criteria

- Parent/admin users see a Recipes module; child users do not.
- A parent can create categories and tags.
- A parent can create a recipe with structured ingredients and steps.
- A parent can mark favorite/rating and filter recipes by text, category, tag, favorite, rating, and ingredient.
- A parent can create a variant of a recipe and see it from the base recipe detail page.
- A parent can attach another recipe as a sub-recipe/component.
- Scaling from base servings to target servings returns correct quantities and leaves the stored base recipe unchanged.
- UI uses existing Family Manager/Jewel Pop visual language.
- Backend enforces household isolation and module access on every endpoint.
- Tests cover API CRUD, household isolation, scaling math, route visibility, recipe creation UI, and e2e smoke.

## Release Notes Template

When implemented, report:

- Module added: `recipes`
- Backend endpoints added under `/chore-api/recipes`
- Data tables added: `recipe_categories`, `recipe_tags`, `recipes`, `recipe_category_links`, `recipe_tag_links`, `recipe_ingredients`, `recipe_steps`, `recipe_components`
- Frontend route: `/recipes`
- Tests/builds run and results
- Screenshot evidence for list, editor, detail/scaling view if deployed
