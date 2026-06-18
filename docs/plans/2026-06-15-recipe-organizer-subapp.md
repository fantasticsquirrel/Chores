# Family Manager Recipe Organizer Sub-App Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a household-native recipe organizer inside Family Manager that supports structured recipes, categories/tags, ingredients, alternate sub-recipes/varieties, scaling, cooking views, URL import, family feedback, and future meal-plan/grocery integrations.

**Architecture:** Implement recipes as a protected parent/admin Family Manager module under `/chore/recipes`, backed by FastAPI routes under `/chore-api/recipes`, SQLAlchemy/Alembic tables, Pydantic schemas, and React/Vite pages/components. Keep canonical recipe data immutable during cooking-time scaling; derive scaled ingredient/step display from default servings or multiplier. Model recipe variants/sub-recipes and feedback as first-class relational data rather than freeform notes.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic, SQLite WAL, React 18, TypeScript, Vite, React Router, Vitest/Testing Library, Playwright, pytest.

---

## Research Summary

Comparable apps reviewed: Recipe Keeper, Paprika, Copy Me That, RecipeSage, Mealie, Tandoor, and AnyList.

Key product patterns to copy:

1. **Structured recipe library**
   - Title, description, photo, source URL/name, category, tags, prep/cook/total time, servings/yield, ingredients, steps, notes.
   - Search by title, source, category, tag, ingredient, favorite/rating.

2. **Categories + tags**
   - Broad categories such as Breakfast, Lunch, Dinner, Dessert, Side, Sauce, Drink.
   - Flexible tags for cuisine, appliance, diet, holiday, kid-friendly, quick, freezer-friendly, make-ahead.
   - Mealie’s guidance is useful: categories for broad groupings; tags for flexible filtering.

3. **Ingredients as structured rows**
   - Store raw text plus parsed `quantity`, `unit`, `item`, `preparation`, `optional`, `section`, and order.
   - Preserve raw text so parsing mistakes do not destroy recipe fidelity.
   - Ingredient structure enables scaling, shopping lists, meal plans, search, and future normalization.

4. **Scaling/yield**
   - Recipe Keeper/Paprika-style saved default servings/yield plus cooking-time target servings or multiplier.
   - Scaling must not mutate the saved canonical recipe.
   - Display warnings when default servings are missing and only multiplier scaling is possible.

5. **Variants, sub-recipes, and alternatives**
   - Comparable apps often handle variants indirectly via duplicate/edit flows; Family Manager should make this a differentiator.
   - Support core recipes with child variants like “gluten-free crust,” “kid-safe mild version,” “spicy Dad version,” “Ninja Creami chocolate base.”
   - Support components/sub-recipes such as sauces, doughs, marinades, spice blends.

6. **Cooking mode**
   - Tablet/mobile friendly detail route.
   - Ingredient checkoffs, step navigation, large touch targets, scale controls near ingredients/steps.
   - Keep screen awake later if browser API is available.

7. **Import/export**
   - MVP import should support JSON-LD Recipe extraction from URLs plus manual entry and paste cleanup.
   - V2 can add OCR/photo/PDF import, app importers, AI cleanup, browser extension/bookmarklet.
   - Print/PDF and JSON backup/export should be planned early.

8. **Household/family utility**
   - Family Manager’s differentiator is household context: shared cookbook, family feedback, child preferences, meal plan, grocery list.
   - Model feedback separately from recipe content: per reviewer rating/verdict/notes.

---

## Current Codebase State

The repository already contains a substantial recipe module. Treat implementation work as either validating/completing the existing slice or expanding it, not starting from zero.

- Repo: `/var/ralph-projects/chore_tracking`
- Public route: `/chore/recipes`
- API prefix: `/chore-api/recipes`
- Backend upstream: `127.0.0.1:8501`
- Frontend dist route: `/chore/`

Existing backend files:

- `backend/app/main.py`
  - Mounts `recipes_router` under `/chore-api/recipes`.
  - Serves `/chore` frontend fallback.
- `backend/app/api/recipes.py`
  - Categories, tags, CRUD, archive/delete, duplicate, variants, scaling, feedback, import-url, backup/export.
  - Guard: `require_module_access(MODULE_RECIPES, UserRole.PARENT_ADMIN, UserRole.PARENT)`.
  - Current ownership scoping: `owner_user_id == current_user.id`.
- `backend/app/services/recipes.py`
  - Scaling helpers.
- `backend/app/schemas/recipes.py`
  - Recipe/category/tag/ingredient/step/component/feedback/backup/scale schemas.
- `backend/app/models/core.py`
  - Recipe models and join tables.
- Alembic migrations:
  - `backend/alembic/versions/20260530_0007_recipes.py`
  - `backend/alembic/versions/20260614_0008_recipe_step_ingredient_links.py`
  - `backend/alembic/versions/20260614_0009_recipe_feedback.py`
  - `backend/alembic/versions/20260614_0010_recipe_photo_url.py`

Existing frontend files:

- `frontend/src/App.tsx`
  - Nav item `/recipes`, module key `recipes`.
  - Protected routes `/recipes` and `/recipes/:recipeId`.
- `frontend/src/pages/RecipeOrganizerPage.tsx`
  - List, filters, create/edit, detail/cooking, scaling, print, feedback, variants, delete UI.
- `frontend/src/api/client.ts`
  - Recipe API client methods.
- `frontend/src/api/models.ts`
  - Recipe types.
- `frontend/src/modules/registry.ts`
  - Recipes module registration.
- `frontend/src/app.css`
  - Recipe list/detail/editor/cooking/print styles.

Existing tests:

- `backend/tests/test_recipes_api.py`
- `backend/tests/test_recipe_scaling.py`
- `frontend/src/App.recipes.test.tsx`
- Related auth/module/routing tests.

---

## Scope Decision

### MVP scope

The MVP should be a polished, reliable recipe organizer:

- Parent/admin-only access.
- Recipe list, filters, detail route, create/edit/delete.
- Categories and tags.
- Structured ingredients and steps.
- Photo URL, source URL/name, notes, rating/favorite.
- Default servings/yield.
- Scaling by target servings and multiplier.
- Variants and sub-recipes/components.
- Family feedback.
- URL JSON-LD import.
- JSON backup/import.
- Print/PDF-friendly recipe sheet.
- Playwright verified on the live deployed route.

### V2 scope

Defer these until MVP is verified in production:

- OCR/photo/PDF import.
- Browser extension/bookmarklet.
- AI cleanup of pasted recipes.
- App importers from Paprika/Recipe Keeper/Copy Me That/Mealie/Tandoor.
- Full grocery-list generation with duplicate combining and aisle sorting.
- Weekly meal planner with recipe slots.
- Pantry, nutrition, pricing, budget.
- Rich ingredient normalization and unit conversions.
- Public share links and cookbook PDFs.
- Voice/hands-free cooking assistant.

---

## Data Model Design

The current repo already has most of this. Use this section as the target model; add migrations only for missing fields.

### Recipe

Fields:

- `id`
- `household_id`
- `owner_user_id`
- `parent_recipe_id` nullable, for variants
- `title`
- `description`
- `source_url`
- `source_name`
- `photo_url`
- `servings`
- `yield_text`
- `prep_time_minutes`
- `cook_time_minutes`
- `total_time_minutes`
- `rating`
- `is_favorite`
- `notes`
- `is_archived`
- `created_at`
- `updated_at`

Ownership rule to decide explicitly:

- Current implementation uses per-parent `owner_user_id` scoping.
- If Family Manager should be a household-shared cookbook, change list/detail/mutation queries to allow household-visible recipes while preserving `owner_user_id` for attribution and edit permissions.
- Add tests before changing this behavior.

### RecipeCategory / RecipeTag

Fields:

- `id`
- `household_id`
- `owner_user_id` if keeping private taxonomy
- `name`
- optional `color` or `icon`
- timestamps

Associations:

- `RecipeCategoryLink(recipe_id, category_id)`
- `RecipeTagLink(recipe_id, tag_id)`

### RecipeIngredient

Fields:

- `id`
- `recipe_id`
- `section_name` nullable
- `display_text` or `raw_text`
- `quantity` nullable decimal/string-safe numeric
- `unit` nullable
- `item`
- `preparation` nullable
- `note` nullable
- `is_optional`
- `linked_recipe_id` nullable, for component/sub-recipe ingredient lines
- `sort_order`

Rules:

- Preserve raw/display text.
- Scale only parsed quantities.
- Never mutate canonical amounts from scaling controls.

### RecipeStep

Fields:

- `id`
- `recipe_id`
- `section_name` nullable
- `instruction`
- `sort_order`

Ingredient linking:

- `RecipeStepIngredientLink(step_id, ingredient_id)`.
- Create/update payloads may reference ingredient positions before DB IDs exist.
- Scale responses include both scaled ingredients and linked usage text for steps.

### RecipeComponent / Sub-Recipe

Fields:

- `id`
- `recipe_id`
- `component_recipe_id`
- `label`
- `quantity`
- `unit`
- `sort_order`

Rules:

- Prevent self-links.
- V1 can show linked components and include them as notes.
- V2 can expand component ingredients into grocery lists and scaling.

### RecipeFeedback

Fields:

- `id`
- `recipe_id`
- `reviewer_type`: parent/child
- `reviewer_key`: user id or child id
- `rating`
- `verdict`
- `notes`
- `created_at`
- `updated_at`

Rules:

- Unique per `(recipe_id, reviewer_type, reviewer_key)`.
- Validate reviewer belongs to same household.
- Do not overwrite feedback when editing recipe content.

---

## API Design

All endpoints are under `/chore-api/recipes`.

### Categories

- `GET /categories`
- `POST /categories`
- `PUT /categories/{category_id}`
- `DELETE /categories/{category_id}`

### Tags

- `GET /tags`
- `POST /tags`
- `PUT /tags/{tag_id}`
- `DELETE /tags/{tag_id}`

### Recipes

- `GET /recipes`
  - Query params: `query`, `category_id`, `tag_id`, `favorite`, `min_rating`, `ingredient`, `active_only`.
- `POST /recipes`
- `GET /recipes/{recipe_id}`
- `PUT /recipes/{recipe_id}`
- `PATCH /recipes/{recipe_id}/archive`
- `DELETE /recipes/{recipe_id}`
- `POST /recipes/{recipe_id}/duplicate`
- `POST /recipes/{recipe_id}/variants`
- `GET /recipes/{recipe_id}/scale?target_servings=...`
- `GET /recipes/{recipe_id}/scale?scale_factor=...`
- `PUT /recipes/{recipe_id}/feedback`

### Import/export

- `POST /recipes/import-url`
  - Fetch URL.
  - Extract JSON-LD `Recipe` data.
  - Normalize title, image, description, yield, ingredients, instructions, source URL/name.
  - Create through the same service path as manual create.
- `GET /recipes/backup`
- `POST /recipes/backup/import`

### Authorization rules

- Require authenticated parent/admin and module access for every route.
- Children should not access recipe module unless a future child-view mode is explicitly added.
- Owner/household scoping must be tested for:
  - another parent in same household,
  - parent in another household,
  - child user,
  - admin/parent admin.

---

## Frontend UX

### Routes

- `/chore/recipes`
  - Recipe organizer overview.
  - Search/filter/import/create.
  - Recipe cards.
- `/chore/recipes/:recipeId`
  - Routeable recipe detail and cooking view.
  - Shareable/bookmarkable URL.
  - Back to recipes link.

### Organizer page

Sections:

1. Header: title, helper copy, quick stats.
2. Quick URL import.
3. Backup/restore disclosure.
4. Advanced filters disclosure.
5. Recipe cards grid.
6. Create recipe editor.

Filters:

- Search text.
- Category.
- Tag.
- Ingredient.
- Favorite.
- Minimum rating.

Card content:

- Photo.
- Title.
- Description.
- Source.
- Default servings/yield.
- Time.
- Categories/tags.
- Favorite/rating.
- CTA to open detail.

### Editor

Fields:

- Title.
- Description.
- Photo URL.
- Source URL/name.
- Category and tag selectors/create controls.
- Default servings and yield text.
- Prep/cook/total times.
- Ingredients rows.
- Step rows.
- Component/sub-recipe rows.
- Notes.

Ingredient row fields:

- Section.
- Quantity.
- Unit.
- Item.
- Preparation/note.
- Optional.
- Display/raw text override.

Step row fields:

- Section.
- Instruction.
- Linked ingredient position refs.

### Detail/cooking view

Sections:

- Hero with title, photo, metadata, source.
- Scaling controls:
  - Default servings display.
  - Target servings input.
  - Multiplier input.
  - Reset to original.
- Ingredients with scaled amounts.
- Steps with linked scaled ingredient usage.
- Components/sub-recipes.
- Cooking mode:
  - current step,
  - previous/next,
  - active linked ingredients,
  - large buttons.
- Variants:
  - list child variants,
  - create variant from current recipe,
  - link back to core recipe.
- Family feedback:
  - aggregate rating,
  - parent/child selector,
  - verdict/notes,
  - existing feedback list.
- Print/PDF button.
- Edit and delete controls.

---

## Bite-Sized Implementation Tasks

The repo already contains many of these capabilities. For implementation, run the tasks as an audit-and-complete sequence: if a task is already fully implemented and tested, mark it verified and move to the next task; if not, complete it.

### Task 1: Verify recipe module registration and route protection

**Objective:** Ensure Recipes appears as a protected Family Manager module only for parent/admin roles.

**Files:**

- Modify if needed: `backend/app/modules.py`
- Modify if needed: `backend/app/api/dependencies.py`
- Modify if needed: `frontend/src/App.tsx`
- Modify if needed: `frontend/src/modules/registry.ts`
- Test: `backend/tests/test_modules_api.py`
- Test: `frontend/src/App.protected-routes.test.tsx`

**Steps:**

1. Confirm `MODULE_RECIPES = "recipes"` exists.
2. Confirm parent/admin default access includes recipes.
3. Confirm child default access excludes recipes.
4. Confirm frontend nav uses module key `recipes`.
5. Add or update tests for parent/admin access and child denial.
6. Run:

```bash
cd /var/ralph-projects/chore_tracking/backend
python -m pytest tests/test_modules_api.py tests/test_permissions_api.py -q
```

7. Run:

```bash
cd /var/ralph-projects/chore_tracking/frontend
npm run test -- App.protected-routes.test.tsx
```

8. Commit if changes were needed:

```bash
git add backend/app/modules.py backend/app/api/dependencies.py frontend/src/App.tsx frontend/src/modules/registry.ts backend/tests/test_modules_api.py frontend/src/App.protected-routes.test.tsx
git commit -m "test: verify recipe module access"
```

### Task 2: Audit and complete recipe database schema

**Objective:** Ensure schema supports categories, tags, structured ingredients, steps, scaling links, variants, components, feedback, source, photo, and default servings.

**Files:**

- Modify if needed: `backend/app/models/core.py`
- Create if needed: `backend/alembic/versions/<next>_recipe_schema_completion.py`
- Test: `backend/tests/test_alembic_migrations.py`

**Steps:**

1. Compare current models to the target model in this plan.
2. Add missing nullable fields only when needed; avoid unnecessary churn.
3. If adding fields, create Alembic migration.
4. Run migration test:

```bash
cd /var/ralph-projects/chore_tracking/backend
python -m pytest tests/test_alembic_migrations.py -q
```

5. Run full recipe API tests after migration:

```bash
python -m pytest tests/test_recipes_api.py tests/test_recipe_scaling.py -q
```

6. Commit if changes were needed.

### Task 3: Decide and test ownership model

**Objective:** Make recipe privacy explicit: per-parent private cookbook vs household-shared cookbook.

**Files:**

- Modify if changing behavior: `backend/app/api/recipes.py`
- Test: `backend/tests/test_recipes_api.py`

**Recommendation:** For Family Manager, default to household-shared recipes with `owner_user_id` as creator attribution, unless Jon wants parent-private recipe boxes.

**Steps:**

1. Add tests for current expected behavior before changing code:
   - creator can list/detail/edit/delete own recipe,
   - another parent in same household can or cannot see based on chosen model,
   - parent in another household cannot see,
   - child cannot access.
2. If choosing household-shared, update query filters from strict `owner_user_id == current_user.id` to household visibility plus edit rules.
3. Run:

```bash
cd /var/ralph-projects/chore_tracking/backend
python -m pytest tests/test_recipes_api.py::test_recipe_owner_scoping -q
```

4. Run all recipe API tests.
5. Commit.

### Task 4: Verify category/tag CRUD and filter UX

**Objective:** Ensure categories/tags are first-class and usable from the list/editor.

**Files:**

- Backend: `backend/app/api/recipes.py`
- Schemas: `backend/app/schemas/recipes.py`
- Frontend: `frontend/src/pages/RecipeOrganizerPage.tsx`
- Client/types: `frontend/src/api/client.ts`, `frontend/src/api/models.ts`
- Tests: `backend/tests/test_recipes_api.py`, `frontend/src/App.recipes.test.tsx`

**Steps:**

1. Backend: verify create/list/update/delete for categories and tags.
2. Frontend: verify recipe editor can assign categories and tags.
3. Frontend: verify filters can select category/tag and clear filters.
4. Add tests if missing.
5. Run:

```bash
cd /var/ralph-projects/chore_tracking/backend
python -m pytest tests/test_recipes_api.py -q
cd /var/ralph-projects/chore_tracking/frontend
npm run test -- App.recipes.test.tsx
```

6. Commit if changes were needed.

### Task 5: Verify structured ingredient and step editor

**Objective:** Ensure the editor supports enough structure for scaling, sub-recipes, and readable cooking views.

**Files:**

- `frontend/src/pages/RecipeOrganizerPage.tsx`
- `frontend/src/api/models.ts`
- `frontend/src/api/client.ts`
- `backend/app/schemas/recipes.py`
- `backend/app/api/recipes.py`
- Tests: `frontend/src/App.recipes.test.tsx`, `backend/tests/test_recipes_api.py`

**Steps:**

1. Confirm ingredient rows support quantity, unit, item/name, preparation/note, section, optional/display text where available.
2. Confirm step rows support ordered instructions and linked ingredient references.
3. Confirm create/update payload preserves order and sections.
4. Add frontend tests for adding multiple ingredient rows and step rows.
5. Add backend tests for payload round-trip.
6. Run recipe frontend/backend tests.
7. Commit.

### Task 6: Verify scaling by servings and multiplier

**Objective:** Provide Recipe Keeper/Paprika-style scaling from a saved default serving count.

**Files:**

- `backend/app/services/recipes.py`
- `backend/app/api/recipes.py`
- `frontend/src/pages/RecipeOrganizerPage.tsx`
- Tests: `backend/tests/test_recipe_scaling.py`, `backend/tests/test_recipes_api.py`, `frontend/src/App.recipes.test.tsx`

**Steps:**

1. Backend: assert `GET /recipes/{id}/scale?target_servings=...` scales parsed quantities.
2. Backend: assert `GET /recipes/{id}/scale?scale_factor=...` works without servings.
3. Backend: assert linked step usage text scales with linked ingredients.
4. Frontend: show Default Servings distinctly from Target Servings.
5. Frontend: changing target servings updates multiplier.
6. Frontend: changing multiplier updates target servings when default servings exists.
7. Add warning when default servings missing.
8. Run:

```bash
cd /var/ralph-projects/chore_tracking/backend
python -m pytest tests/test_recipe_scaling.py tests/test_recipes_api.py -q
cd /var/ralph-projects/chore_tracking/frontend
npm run test -- App.recipes.test.tsx
```

9. Commit.

### Task 7: Verify variants and sub-recipes/components

**Objective:** Support alternate recipe varieties and linked component recipes.

**Files:**

- `backend/app/api/recipes.py`
- `backend/app/schemas/recipes.py`
- `backend/app/models/core.py`
- `frontend/src/pages/RecipeOrganizerPage.tsx`
- Tests: `backend/tests/test_recipes_api.py`, `frontend/src/App.recipes.test.tsx`

**Steps:**

1. Backend: verify `POST /recipes/{recipe_id}/variants` creates child recipe with forced `parent_recipe_id`.
2. Backend: verify detail includes `variants` for core recipe and `core_recipe` for variant.
3. Backend: verify components reject self-links.
4. Frontend: detail page displays variants and component/sub-recipe links.
5. Frontend: editor supports component recipe selector and label/quantity/unit.
6. Add tests if missing.
7. Run backend/frontend recipe tests.
8. Commit.

### Task 8: Verify URL import and backup/import

**Objective:** Support practical onboarding and data portability.

**Files:**

- `backend/app/api/recipes.py`
- `backend/app/schemas/recipes.py`
- `frontend/src/pages/RecipeOrganizerPage.tsx`
- Tests: `backend/tests/test_recipes_api.py`, `frontend/src/App.recipes.test.tsx`

**Steps:**

1. Backend: use deterministic local JSON-LD fixture in tests.
2. Assert imported recipe has title, source, image/photo, ingredients, steps, servings/yield.
3. Frontend: URL import form calls API and navigates to detail.
4. Backup export strips secrets and includes portable recipe detail data.
5. Backup import remaps IDs safely.
6. Run tests.
7. Commit.

### Task 9: Verify cooking mode and print/PDF sheet

**Objective:** Make the recipe detail useful in the kitchen and printable.

**Files:**

- `frontend/src/pages/RecipeOrganizerPage.tsx`
- `frontend/src/app.css`
- Test: `frontend/src/App.recipes.test.tsx`
- Optional e2e: Playwright smoke script/config under frontend or repo root.

**Steps:**

1. Ensure detail route has a print-only `.recipe-pdf-sheet`.
2. Hide app chrome/action controls in print.
3. Force black text in print styles:

```css
.recipe-pdf-sheet,
.recipe-pdf-sheet * {
  color: #000 !important;
  text-shadow: none !important;
}
```

4. Ensure cooking mode step navigation uses large touch targets.
5. Add/update tests for `window.print()` call.
6. Generate a PDF smoke check with Playwright if touching print.
7. Commit.

### Task 10: Live Playwright smoke on deployed app

**Objective:** Prove the feature works through the real deployed route, not only unit tests.

**Files:**

- Add or update smoke script if needed under `frontend/` or repo test area.
- Do not commit screenshots or temporary cookies.

**Smoke flow:**

1. Authenticate as Dad/parent test account using existing app session/test helper.
2. Open `https://chore.multihost.ing/chore/recipes`.
3. Create temporary recipe with:
   - category,
   - tags,
   - ingredients,
   - steps,
   - default servings,
   - source URL/name,
   - photo URL if available.
4. Verify redirect/detail route `/chore/recipes/<id>`.
5. Verify search/filter finds recipe.
6. Verify target servings scaling changes ingredient amounts.
7. Verify multiplier scaling changes ingredient amounts.
8. Add variant.
9. Add feedback.
10. Enter/exit cooking mode.
11. Trigger print/PDF smoke if relevant.
12. Delete temporary recipe with typed confirmation.
13. Verify API detail returns 404.
14. Capture 1920x1080 screenshots of:
    - list/cards,
    - editor,
    - detail/scaling,
    - cooking mode,
    - variants/feedback.

**Commands:**

```bash
cd /var/ralph-projects/chore_tracking/frontend
npm run build
npm run test:smoke
```

If the smoke script requires root-level Playwright dependencies, run it from repo root and document the exact command.

### Task 11: Build, deploy, and report

**Objective:** Ship only after source tests and live route checks pass.

**Files:**

- Source changes only.
- Do not stage runtime DBs, screenshots, cookie files, build cache, or secrets.

**Steps:**

1. Check git status:

```bash
cd /var/ralph-projects/chore_tracking
git status --short
```

2. Run backend tests:

```bash
cd backend
python -m pytest tests/test_recipes_api.py tests/test_recipe_scaling.py tests/test_modules_api.py tests/test_permissions_api.py -q
```

3. Run frontend tests/build:

```bash
cd ../frontend
npm run test -- App.recipes.test.tsx
npm run build
```

4. Deploy through the existing runtime path.
5. Verify public assets under `/chore/assets/` return 200.
6. Run live Playwright smoke.
7. Commit and push:

```bash
cd /var/ralph-projects/chore_tracking
git add backend frontend docs/plans
git diff --cached --check
git commit -m "feat: complete recipe organizer sub-app"
git push
```

8. Report:
   - URL,
   - commit,
   - tests/builds,
   - live smoke result,
   - screenshots,
   - any deferred V2 items.

---

## Acceptance Criteria

MVP is done when all are true:

- Recipes module is visible only to authorized parent/admin users.
- Parent can create, edit, view, archive/delete recipes.
- Categories and tags can be created/assigned/filtered.
- Ingredients and steps are structured and ordered.
- Recipe detail route is bookmarkable at `/chore/recipes/:recipeId`.
- Default servings/yield is clearly displayed.
- Scaling by target servings and multiplier works without changing the saved recipe.
- Linked step ingredient usage updates with scaled amounts where links exist.
- Variants and sub-recipes/components are visible and navigable.
- Family feedback is separate from recipe content and displayed on detail pages.
- URL JSON-LD import creates a usable recipe with source attribution.
- Backup export/import works for recipe data portability.
- Print/PDF view is legible and hides app chrome.
- Backend recipe tests pass.
- Frontend recipe tests pass.
- Production build passes.
- Live deployed Playwright smoke passes on `https://chore.multihost.ing/chore/recipes`.
- 1920x1080 screenshots prove key UI states.

---

## V2 Backlog

1. **Meal planning**
   - Weekly meal plan view with date + meal slot.
   - Add recipe/variant to plan.
   - Note-only meals.
   - Generate grocery list from date range.

2. **Grocery integration**
   - Add recipe ingredients to household shopping list.
   - Combine exact matches first.
   - Later normalize aliases and units.
   - Aisle/category sorting.

3. **Advanced import**
   - Paste parser.
   - OCR/photo/PDF import.
   - AI cleanup.
   - Importers for Paprika, Recipe Keeper, Copy Me That, Mealie/Tandoor, CSV/JSON-LD.

4. **Ingredient intelligence**
   - Units table and conversions.
   - Food aliases.
   - Pantry categories.
   - Nutrition/allergen metadata.

5. **Family intelligence**
   - Per-child likes/dislikes/allergies.
   - Conflict warnings when meal planning.
   - Made-it history.
   - Kid-approved badges.

6. **Export/share**
   - Share links.
   - Recipe cards.
   - Printable weekly plan.
   - PDF cookbook chapters.

7. **Cooking assistant**
   - Timer extraction.
   - Multi-recipe timeline.
   - Voice/hands-free mode.
   - Substitution suggestions.

---

## Release Notes Template

```markdown
## Recipe Organizer

Shipped the Family Manager recipe organizer at `/chore/recipes`.

Highlights:
- Categories/tags and recipe search/filtering.
- Structured ingredients and steps.
- Default servings plus target-serving/multiplier scaling.
- Recipe variants and sub-recipes/components.
- Family feedback.
- URL import and backup/export.
- Routeable cooking/detail pages and print/PDF-friendly layout.

Verified:
- Backend recipe tests: PASS
- Frontend recipe tests: PASS
- Production build: PASS
- Live Playwright smoke on `https://chore.multihost.ing/chore/recipes`: PASS

Screenshots:
- List/cards: MEDIA:/path/to/list.png
- Editor: MEDIA:/path/to/editor.png
- Detail/scaling: MEDIA:/path/to/detail.png
- Cooking mode: MEDIA:/path/to/cooking.png
- Variants/feedback: MEDIA:/path/to/variants-feedback.png
```
