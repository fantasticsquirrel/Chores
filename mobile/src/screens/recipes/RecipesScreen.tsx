import { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Linking, View } from 'react-native';
import {RecipeText as Text} from '../../features/recipes/components/RecipeText';
import type { AuthSessionResponse, CreateRecipeRequest, FamilyModule, ListRecipesParams, RecipeCategory, RecipeDetail, RecipeIngredient, RecipeScaleResponse, RecipeStep, RecipeSummary, RecipeTag } from '@family-manager/family-api/models';
import { apiClient } from '../../api/client';
import { ActionButton } from '../../components/ActionButton';
import { SectionCard } from '../../components/SectionCard';
import { RecipeEditor } from '../../features/recipes/components/RecipeEditor';
import { Copy, Field, Toggle } from '../../features/recipes/components/RecipeFields';
import { emptyPayload, parseBackup, payloadFromRecipe, preparePayload, stepIngredientPositions } from '../../features/recipes/lib/payload';
import { printRecipe, shareCookbookBackup } from '../../features/recipes/lib/recipe-output';

type Props = { session: AuthSessionResponse; modules: FamilyModule[]; onViewChanged?: () => void };
type Child = Awaited<ReturnType<typeof apiClient.listChildren>>[number];
type Current = () => boolean;
type EditorMode = 'new' | 'edit' | 'variant';

// Mount no data-owning component until a current module grant is available.
// A grant/session change unmounts pending work and clears the previous account's data.
export function RecipesScreen({ session, modules, onViewChanged }: Props) {
  const grant = modules?.find(module => module.key === 'recipes');
  const parent = session.user.role === 'PARENT' || session.user.role === 'PARENT_ADMIN';
  if (!grant || !parent) return <Text>Recipes is not enabled for this account.</Text>;
  const canManage = grant.can_manage === true;
  const canReadChildren = modules.some(module => module.key === 'chores');
  return <Cookbook key={`${session.user.household_id}:${session.user.id}:${session.user.role}:${canManage}:${canReadChildren}`} session={session} canManage={canManage} canReadChildren={canReadChildren} onViewChanged={onViewChanged} />;
}

function Cookbook({ session, canManage, canReadChildren, onViewChanged }: { session: AuthSessionResponse; canManage: boolean; canReadChildren: boolean; onViewChanged?: () => void }) {
  const mounted = useRef(true);
  const locked = useRef(false);
  const retry = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [available, setAvailable] = useState<RecipeSummary[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [query, setQuery] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [tagId, setTagId] = useState<number | undefined>();
  const [favorite, setFavorite] = useState(false);
  const [minRating, setMinRating] = useState('');
  const [ingredient, setIngredient] = useState('');
  const [applied, setApplied] = useState<ListRecipesParams>({ active_only: true });
  const [url, setUrl] = useState('');
  const [backup, setBackup] = useState(false);
  const [exported, setExported] = useState('');
  const [restore, setRestore] = useState('');
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [payload, setPayload] = useState<CreateRecipeRequest>(emptyPayload);
  const [scaled, setScaled] = useState<RecipeScaleResponse | null>(null);
  const [servings, setServings] = useState('');
  const [multiplier, setMultiplier] = useState('1');
  const [checked, setChecked] = useState<number[]>([]);
  const [cooking, setCooking] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [typedTitle, setTypedTitle] = useState('');
  const [reviewer, setReviewer] = useState<'PARENT' | 'CHILD'>('PARENT');
  const [childId, setChildId] = useState<number | null>(null);
  const [familyRating, setFamilyRating] = useState('');
  const [verdict, setVerdict] = useState('');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const canWriteDetail = canManage && detail !== null;
  const canEditDetail = canWriteDetail && (detail?.owner_user_id === session.user.id || session.user.role === 'PARENT_ADMIN');

  async function run(task: (current: Current) => Promise<void>, onRetry: (() => void) | null = null) {
    if (!mounted.current || locked.current) return;
    locked.current = true;
    setBusy(true); setError(''); setNotice(''); retry.current = onRetry;
    try { await task(() => mounted.current); }
    catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Recipe request failed. Please try again.');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function refreshRecipes(current: Current, params = applied) {
    const rows = await apiClient.listRecipes(params);
    if (!current()) return;
    setRecipes(rows);
    // The component picker is not restricted to the current cookbook filter.
    if (!params.query && !params.category_id && !params.tag_id && !params.favorite && params.min_rating == null && !params.ingredient) setAvailable(rows);
  }

  function load() {
    void run(async current => {
      const [rows, cats, labels, reviewers] = await Promise.all([
        apiClient.listRecipes(applied), apiClient.listRecipeCategories(), apiClient.listRecipeTags(),
        canManage && canReadChildren ? apiClient.listChildren({ household_id: session.user.household_id, active_only: true }) : Promise.resolve([] as Child[]),
      ]);
      if (!current()) return;
      setRecipes(rows); setAvailable(rows); setCategories(cats); setTags(labels);
      setChildren(reviewers.filter(child => child.active && child.household_id === session.user.household_id));
    }, load);
  }

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
    // This component is keyed by the current grant and session in RecipesScreen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showDetail(recipe: RecipeDetail) {
    setDetail(recipe); setEditor(null); setBackup(false); setDeleting(false); setTypedTitle('');
    setScaled(null); setServings(recipe.servings == null ? '' : String(recipe.servings)); setMultiplier('1');
    setChecked([]); setCooking(null); setReviewer('PARENT'); setChildId(null);
    const ownFeedback = recipe.feedback.find(row => row.reviewer_type === 'PARENT' && row.parent_user_id === session.user.id);
    setFamilyRating(ownFeedback?.rating == null ? '' : String(ownFeedback.rating));
    setVerdict(ownFeedback?.verdict ?? ''); setFeedbackNotes(ownFeedback?.notes ?? '');
  }

  function openRecipe(id: number) {
    void run(async current => {
      const recipe = await apiClient.getRecipe(id);
      if (current()) showDetail(recipe);
    }, () => openRecipe(id));
  }

  function back() {
    if (locked.current) return true;
    if (deleting) { setDeleting(false); setTypedTitle(''); }
    else if (editor) setEditor(null);
    else if (cooking !== null) setCooking(null);
    else if (detail) { setDetail(null); setScaled(null); }
    else if (backup) setBackup(false);
    else if (advanced) setAdvanced(false);
    else return false;
    setError(''); setNotice(''); return true;
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', back);
    return () => subscription.remove();
  });

  function startEditor(mode: EditorMode) {
    if (!canManage || locked.current || (mode === 'edit' && !canEditDetail) || (mode === 'variant' && !canWriteDetail)) return;
    setPayload(mode === 'new' ? emptyPayload() : { ...payloadFromRecipe(detail!), ...(mode === 'variant' ? { title: `${detail!.title} variant`, parent_recipe_id: detail!.id } : {}) });
    setEditor(mode); setError(''); setNotice('');
    if (applied.query || applied.category_id || applied.tag_id || applied.favorite || applied.min_rating != null || applied.ingredient) {
      void run(async current => {
        const all = await apiClient.listRecipes({ active_only: true });
        if (current()) setAvailable(all);
      }, () => startEditor(mode));
    }
  }

  function saveRecipe() {
    if (!canManage || !editor || !payload.title.trim() || (editor === 'edit' && !canEditDetail) || (editor === 'variant' && !canWriteDetail)) return;
    const request = preparePayload(payload, detail?.id);
    void run(async current => {
      const saved = editor === 'edit' ? await apiClient.updateRecipe(detail!.id, request)
        : editor === 'variant' ? await apiClient.createRecipeVariant(detail!.id, request)
        : await apiClient.createRecipe(request);
      if (!current()) return;
      const verified = await apiClient.getRecipe(saved.id);
      if (!current()) return;
      showDetail(verified);
      await refreshRecipes(current);
    });
  }

  function applyFilters() {
    if (minRating.trim() && (!Number.isFinite(Number(minRating)) || Number(minRating) < 0 || Number(minRating) > 5)) { setError('Minimum rating must be between 0 and 5.'); return; }
    const params: ListRecipesParams = { active_only: true, query: query.trim() || undefined, category_id: categoryId, tag_id: tagId, favorite: favorite || undefined, min_rating: minRating.trim() ? Number(minRating) : undefined, ingredient: ingredient.trim() || undefined };
    setApplied(params);
    void run(current => refreshRecipes(current, params), () => { void run(current => refreshRecipes(current, params)); });
  }

  function importUrl() {
    if (!canManage) return;
    if (!/^https?:\/\/\S+$/i.test(url.trim())) { setError('Enter an http or https recipe URL.'); return; }
    void run(async current => {
      const saved = await apiClient.importRecipeFromUrl(url.trim());
      if (!current()) return;
      const verified = await apiClient.getRecipe(saved.id);
      if (!current()) return;
      showDetail(verified); setUrl('');
      await refreshRecipes(current);
    });
  }

  function exportBackup() {
    void run(async current => {
      const data = await apiClient.exportRecipeBackup();
      if (current()) setExported(JSON.stringify(data, null, 2));
    }, exportBackup);
  }

  function restoreBackup() {
    if (!canManage) return;
    void run(async current => {
      const requests = parseBackup(restore);
      const result = await apiClient.importRecipeBackup(requests);
      if (!current()) return;
      await refreshRecipes(current);
      if (current()) { setRestore(''); setNotice(`Imported ${result.imported_count} recipes from backup.`); }
    });
  }

  function scale(by: 'servings' | 'multiplier') {
    if (!detail) return;
    const number = Number(by === 'servings' ? servings : multiplier);
    if (!Number.isFinite(number) || number <= 0) { setError('Enter a positive number for scaling.'); return; }
    void run(async current => {
      const result = await apiClient.scaleRecipe(detail.id, by === 'servings' ? { targetServings: number } : { scaleFactor: number });
      if (!current()) return;
      setScaled(result); setMultiplier(String(result.factor)); setServings(result.target_servings == null ? '' : String(result.target_servings));
    }, () => scale(by));
  }

  function duplicate() {
    if (!canWriteDetail) return;
    void run(async current => {
      const saved = await apiClient.duplicateRecipe(detail!.id, { as_variant: false });
      if (!current()) return;
      const verified = await apiClient.getRecipe(saved.id);
      if (!current()) return;
      showDetail(verified); await refreshRecipes(current);
    });
  }

  function selectReviewer(type: 'PARENT' | 'CHILD', id: number | null = null) {
    setReviewer(type); setChildId(id);
    const row = detail?.feedback.find(feedback => type === 'CHILD' ? feedback.child_id === id && feedback.reviewer_type === type : feedback.parent_user_id === session.user.id && feedback.reviewer_type === type);
    setFamilyRating(row?.rating == null ? '' : String(row.rating)); setVerdict(row?.verdict ?? ''); setFeedbackNotes(row?.notes ?? '');
  }

  function saveFeedback() {
    if (!canWriteDetail) return;
    if (reviewer === 'CHILD' && !children.some(child => child.id === childId)) { setError('Choose an active household child.'); return; }
    const rating = familyRating.trim() ? Number(familyRating) : null;
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) { setError('Family rating must be an integer from 1 to 5.'); return; }
    void run(async current => {
      await apiClient.upsertRecipeFeedback(detail!.id, { reviewer_type: reviewer, child_id: reviewer === 'CHILD' ? childId : null, parent_user_id: reviewer === 'PARENT' ? session.user.id : null, rating, verdict: verdict.trim(), notes: feedbackNotes.trim() });
      if (!current()) return;
      const verified = await apiClient.getRecipe(detail!.id);
      if (!current()) return;
      setDetail(verified); setNotice('Family feedback saved.'); await refreshRecipes(current);
    });
  }

  function removeRecipe() {
    if (!canEditDetail || !deleting || typedTitle !== detail!.title) return;
    void run(async current => {
      await apiClient.deleteRecipe(detail!.id);
      if (!current()) return;
      await refreshRecipes(current);
      if (current()) { setDetail(null); setDeleting(false); setTypedTitle(''); setNotice('Recipe permanently deleted.'); }
    });
  }

  const ingredients = scaled?.ingredients ?? detail?.ingredients ?? [];
  const steps = scaled?.steps ?? detail?.steps ?? [];
  function renderStep(step: RecipeStep, index: number) {
    const scaledStep = scaled?.steps[index];
    const positions = stepIngredientPositions(step, ingredients);
    const linked = scaledStep?.linked_ingredients ?? ingredients.filter(item => positions.includes(item.position));
    return <View key={step.id} style={{ marginVertical: 8 }}>
      {!!step.section && <Text>{step.section}</Text>}
      <Text>{scaledStep?.scaled_instruction ?? step.instruction}</Text>
      {!!linked.length && <Text>Uses: {linked.map(ingredientText).join(', ')}</Text>}
    </View>;
  }

  useEffect(() => { onViewChanged?.(); }, [detail?.id, editor, cooking, backup, deleting, onViewChanged]);

  return <View style={{ gap: 12 }}>
    {busy && <Text accessibilityLiveRegion="polite">Loading recipes…</Text>}
    {!!error && <View><Text accessibilityRole="alert">{error}</Text>{retry.current && <ActionButton label="Retry" disabled={busy} onPress={() => retry.current?.()} />}</View>}
    {!!notice && <Text accessibilityRole="alert">{notice}</Text>}
    {editor ? <RecipeEditor payload={payload} setPayload={setPayload} categories={categories} tags={tags} available={available} recipeId={editor === 'new' ? undefined : detail?.id} busy={busy} submitLabel={editor === 'edit' ? 'Save Changes' : editor === 'variant' ? 'Save Variant' : 'Save Recipe'} onSave={saveRecipe} onCancel={() => { back(); }} />
      : detail ? <>
        <ActionButton label="Back to Recipes" variant="secondary" disabled={busy} onPress={() => { setCooking(null); setDeleting(false); setDetail(null); setError(''); setNotice(''); }} />
        {deleting ? <SectionCard title="Permanently delete recipe">
          <Text>This cannot be undone. Type the exact title: {detail.title}</Text>
          <Field label="Type recipe title" value={typedTitle} onChange={setTypedTitle} disabled={busy} />
          <ActionButton label="Permanently Delete" variant="danger" disabled={busy || typedTitle !== detail.title} onPress={removeRecipe} />
          <ActionButton label="Cancel Delete" variant="secondary" disabled={busy} onPress={() => { back(); }} />
        </SectionCard> : cooking !== null ? <SectionCard title={detail.title}>
          <Text>Step {cooking + 1} of {steps.length}</Text>
          {steps[cooking] && renderStep(steps[cooking], cooking)}
          <ActionButton label="Previous step" variant="secondary" disabled={busy || cooking === 0} onPress={() => setCooking(value => Math.max(0, (value ?? 0) - 1))} />
          <ActionButton label="Next step" disabled={busy || cooking >= steps.length - 1} onPress={() => setCooking(value => Math.min(steps.length - 1, (value ?? 0) + 1))} />
          <ActionButton label="Exit Cooking" variant="secondary" disabled={busy} onPress={() => setCooking(null)} />
        </SectionCard> : <>
          <SectionCard title={detail.title}>
            {!!detail.photo_url && /^https?:\/\//i.test(detail.photo_url) && <Image source={{ uri: detail.photo_url }} accessibilityLabel={`Photo of ${detail.title}`} style={{ height: 180, width: '100%', borderRadius: 12 }} />}
            <Copy text={detail.description} />
            <Text>Default Servings: {detail.servings ?? 'not specified'}</Text>
            {detail.yield_quantity !== null && <Text>Yield: {detail.yield_quantity} {detail.yield_unit}</Text>}
            <Text>Prep: {detail.prep_minutes ?? '—'} min · Cook: {detail.cook_minutes ?? '—'} min</Text>
            <Text>Rating: {detail.rating ?? 'unrated'}{detail.favorite ? ' · Favorite' : ''}</Text>
            <Text>{detail.categories.map(category => category.name).join(', ')}</Text>
            <Text>{detail.tags.map(tag => tag.name).join(', ')}</Text>
            {!!detail.notes && <Copy text={detail.notes} />}
            {!!detail.source_url && <ActionButton label={`Open source: ${detail.source_name || detail.source_url}`} variant="secondary" disabled={busy} onPress={() => {
              void run(async () => { if (!/^https?:\/\//i.test(detail.source_url!)) throw new Error('Only http and https source links can be opened.'); await Linking.openURL(detail.source_url!); });
            }} />}
            {!detail.source_url && !!detail.source_name && <Text>Source: {detail.source_name}</Text>}
            <ActionButton label="Print / PDF" variant="secondary" disabled={busy} onPress={() => { void run(async () => { await printRecipe(detail, scaled); }); }} />
            {canEditDetail && <ActionButton label="Edit Recipe" variant="secondary" disabled={busy} onPress={() => startEditor('edit')} />}
            {canWriteDetail && <>
              <ActionButton label="Duplicate Recipe" variant="secondary" disabled={busy} onPress={duplicate} />
              <ActionButton label="Add Variant" variant="secondary" disabled={busy} onPress={() => startEditor('variant')} />
            </>}
            {canEditDetail && <ActionButton label="Delete Recipe" variant="danger" disabled={busy} onPress={() => { setTypedTitle(''); setDeleting(true); }} />}
          </SectionCard>
          <SectionCard title="Scale recipe">
            <Field label="Target servings" numeric value={servings} onChange={setServings} disabled={busy} />
            <ActionButton label="Scale servings" variant="secondary" disabled={busy} onPress={() => scale('servings')} />
            <Field label="Multiplier" numeric value={multiplier} onChange={setMultiplier} disabled={busy} />
            <ActionButton label="Scale multiplier" variant="secondary" disabled={busy} onPress={() => scale('multiplier')} />
            {scaled?.warnings.map((warning, index) => <Text key={index} accessibilityRole="alert">{warning}</Text>)}
          </SectionCard>
          <SectionCard title="Ingredients">
            {ingredients.map(item => <View key={item.id}>
              {!!item.group_name && <Text>{item.group_name}</Text>}
              <Toggle label={`Ingredient ${item.position}: ${ingredientText(item)}`} checked={checked.includes(item.position)} disabled={busy} onPress={() => setChecked(prev => prev.includes(item.position) ? prev.filter(position => position !== item.position) : [...prev, item.position])} />
              {(item.is_optional || item.note) && <Text>{[item.is_optional ? 'Optional' : '', item.note].filter(Boolean).join(' · ')}</Text>}
            </View>)}
          </SectionCard>
          <SectionCard title="Steps">
            {steps.map(renderStep)}
            <ActionButton label="Start Cooking" disabled={busy || !steps.length} onPress={() => setCooking(0)} />
          </SectionCard>
          {!!detail.components.length && <SectionCard title="Sub-recipes / Components">
            {detail.components.map(component => <View key={component.component_recipe_id}>
              <Text>{component.label || component.component_recipe.title} · {component.quantity ?? ''} {component.unit}</Text>
              <ActionButton label={`Open component: ${component.component_recipe.title}`} variant="secondary" disabled={busy} onPress={() => openRecipe(component.component_recipe_id)} />
            </View>)}
          </SectionCard>}
          {(detail.core_recipe || detail.variants.length > 0) && <SectionCard title="Recipe family">
            {detail.core_recipe && <ActionButton label={`Open core: ${detail.core_recipe.title}`} variant="secondary" disabled={busy} onPress={() => openRecipe(detail.core_recipe!.id)} />}
            {detail.variants.map(variant => <ActionButton key={variant.id} label={`Open variant: ${variant.title}`} variant="secondary" disabled={busy} onPress={() => openRecipe(variant.id)} />)}
          </SectionCard>}
          <SectionCard title="Family feedback">
            <Text>Family average: {detail.feedback_summary.average_rating ?? 'unrated'} ({detail.feedback_summary.rating_count} ratings)</Text>
            {detail.feedback.map(row => <View key={row.id}><Text>{row.reviewer_name}: {row.rating ?? 'unrated'} · {row.verdict}</Text><Copy text={row.notes} /></View>)}
            {canWriteDetail && <>
              <Toggle label="Parent feedback" checked={reviewer === 'PARENT'} disabled={busy} onPress={() => selectReviewer('PARENT')} />
              {canReadChildren && <Toggle label="Child feedback" checked={reviewer === 'CHILD'} disabled={busy} onPress={() => selectReviewer('CHILD')} />}
              {reviewer === 'CHILD' && children.map(child => <Toggle key={child.id} label={`Reviewer ${child.name}`} checked={childId === child.id} disabled={busy} onPress={() => selectReviewer('CHILD', child.id)} />)}
              <Field label="Family rating" numeric value={familyRating} onChange={setFamilyRating} disabled={busy} />
              <Field label="Verdict" value={verdict} onChange={setVerdict} disabled={busy} />
              <Field label="Feedback notes" value={feedbackNotes} onChange={setFeedbackNotes} multiline disabled={busy} />
              <ActionButton label="Save Feedback" variant="secondary" disabled={busy || (reviewer === 'CHILD' && childId === null)} onPress={saveFeedback} />
            </>}
          </SectionCard>
        </>}
      </> : <>
        <SectionCard title="Recipes">
          <Field label="Search recipes" value={query} onChange={setQuery} disabled={busy} />
          <ActionButton label="Advanced Filters" variant="secondary" disabled={busy} onPress={() => setAdvanced(value => !value)} />
          {advanced && <>
            {categories.map(category => <Toggle key={category.id} label={`Category ${category.name}`} checked={categoryId === category.id} disabled={busy} onPress={() => setCategoryId(value => value === category.id ? undefined : category.id)} />)}
            {tags.map(tag => <Toggle key={tag.id} label={`Tag ${tag.name}`} checked={tagId === tag.id} disabled={busy} onPress={() => setTagId(value => value === tag.id ? undefined : tag.id)} />)}
            <Toggle label="Favorites only" checked={favorite} disabled={busy} onPress={() => setFavorite(value => !value)} />
            <Field label="Minimum rating" numeric value={minRating} onChange={setMinRating} disabled={busy} />
            <Field label="Ingredient filter" value={ingredient} onChange={setIngredient} disabled={busy} />
          </>}
          <ActionButton label="Apply filters" variant="secondary" disabled={busy} onPress={applyFilters} />
          {canManage && <>
            <ActionButton label="New Recipe" disabled={busy} onPress={() => startEditor('new')} />
            <Field label="Recipe URL" value={url} onChange={setUrl} disabled={busy} />
            <ActionButton label="Import URL" variant="secondary" disabled={busy || !url.trim()} onPress={importUrl} />
          </>}
          <ActionButton label="Backup & Restore" variant="secondary" disabled={busy} onPress={() => setBackup(value => !value)} />
        </SectionCard>
        {backup && <SectionCard title="Backup & Restore">
          <Text>Export and share a portable JSON backup. This is not a PDF.</Text>
          <ActionButton label="Export JSON" variant="secondary" disabled={busy} onPress={exportBackup} />
          {!!exported && <>
            <Text accessibilityLabel="Exported backup JSON" selectable>{exported}</Text>
            <ActionButton label="Share JSON" variant="secondary" disabled={busy} onPress={() => { void run(async () => { await shareCookbookBackup(JSON.parse(exported)); }); }} />
          </>}
          {canManage && <>
            <Text>Restore creates new recipes. Database IDs and cross-recipe links are not portable and are removed.</Text>
            <Field label="Restore JSON" value={restore} onChange={setRestore} multiline disabled={busy} />
            <ActionButton label="Restore backup" variant="secondary" disabled={busy || !restore.trim()} onPress={restoreBackup} />
          </>}
        </SectionCard>}
        {!busy && !error && !recipes.length && <Text>No recipes match these filters.</Text>}
        {recipes.map(recipe => <SectionCard key={recipe.id} title={recipe.title} subtitle={recipe.description}>
          <Text>{recipe.ingredient_count} ingredients · {recipe.servings ?? '—'} servings</Text>
          <ActionButton label={`Open ${recipe.title}`} variant="secondary" disabled={busy} onPress={() => openRecipe(recipe.id)} />
        </SectionCard>)}
      </>}
  </View>;
}

function ingredientText(item: RecipeIngredient & { scaled_quantity?: number | null }) {
  const quantity = 'scaled_quantity' in item ? item.scaled_quantity : item.quantity;
  return [quantity == null ? '' : String(quantity), item.unit, item.item, item.preparation].filter(Boolean).join(' ');
}
