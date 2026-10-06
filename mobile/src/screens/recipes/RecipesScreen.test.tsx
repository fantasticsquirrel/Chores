import React from 'react';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BackHandler, Linking } from 'react-native';
import { printRecipe, shareCookbookBackup } from '../../features/recipes/lib/recipe-output';
import { apiClient } from '../../api/client';
import { modules, recipe, scaled, session } from './fixtures';
import { RecipesScreen } from './RecipesScreen';
import {ActionButton} from '../../components/ActionButton';

jest.mock('../../api/client', () => ({ apiClient: Object.fromEntries(['listRecipes', 'listRecipeCategories', 'listRecipeTags', 'listChildren', 'getRecipe', 'scaleRecipe', 'createRecipe', 'updateRecipe', 'importRecipeFromUrl', 'exportRecipeBackup', 'importRecipeBackup', 'duplicateRecipe', 'createRecipeVariant', 'upsertRecipeFeedback', 'deleteRecipe'].map(k => [k, jest.fn()])) }));
jest.mock('../../features/recipes/lib/recipe-output',()=>({printRecipe:jest.fn(),shareCookbookBackup:jest.fn()}));
const api = apiClient as unknown as Record<string, jest.Mock<(...args: unknown[]) => Promise<unknown>>>;
const press = (label: string) => fireEvent.press(screen.queryByRole('button', { name: label }) ?? screen.getByRole('checkbox', { name: label }));
const change = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);
async function open() {
  render(<RecipesScreen modules={modules} session={session} />);
  await screen.findByRole('button', { name: 'Open Soup' });
  press('Open Soup');
  await screen.findByText('Default Servings: 4');
}
beforeEach(() => {
  jest.clearAllMocks();
  api.listRecipes.mockResolvedValue([recipe]); api.listRecipeCategories.mockResolvedValue(recipe.categories); api.listRecipeTags.mockResolvedValue(recipe.tags);
  api.listChildren.mockResolvedValue([{ id: 8, household_id: 7, name: 'Alex', active: true }, { id: 9, household_id: 7, name: 'Inactive', active: false }, { id: 10, household_id: 99, name: 'Foreign', active: true }]);
  api.getRecipe.mockResolvedValue(recipe); api.scaleRecipe.mockResolvedValue(scaled);
  api.createRecipe.mockResolvedValue(recipe); api.updateRecipe.mockResolvedValue(recipe); api.importRecipeFromUrl.mockResolvedValue(recipe);
  api.exportRecipeBackup.mockResolvedValue({ version: 1, recipes: [recipe] }); api.importRecipeBackup.mockResolvedValue({ imported_count: 1, recipes: [recipe] });
  api.duplicateRecipe.mockResolvedValue({ ...recipe, id: 12, title: 'Soup copy' }); api.createRecipeVariant.mockResolvedValue({ ...recipe, id: 13, title: 'Soup variant', parent_recipe_id: 11 });
  api.upsertRecipeFeedback.mockResolvedValue(recipe.feedback[0]); api.deleteRecipe.mockResolvedValue(undefined);
});
afterEach(() => { jest.restoreAllMocks(); });

it.each(['list','detail','editor','cooking'] as const)('keeps one primary action in the %s workflow',async(state)=>{
 if(state==='list'||state==='editor'){
  render(<RecipesScreen modules={modules} session={session}/>);await screen.findByRole('button',{name:'New Recipe'});
  if(state==='editor'){press('New Recipe');change('Title','Soup draft');}
 }else{await open();if(state==='cooking')press('Start Cooking');}
 const primary=screen.UNSAFE_getAllByType(ActionButton).filter(node=>!node.props.disabled&&(node.props.variant??'primary')==='primary');
 expect(primary.map(node=>node.props.label)).toEqual([state==='list'?'New Recipe':state==='detail'?'Start Cooking':state==='editor'?'Save Recipe':'Next step']);
});

it('disabled module makes no requests', () => {
  render(<RecipesScreen modules={[]} session={session} />);
  expect(screen.getByText('Recipes is not enabled for this account.')).toBeTruthy();
  Object.values(api).forEach(fn => expect(fn).not.toHaveBeenCalled());
});
it('child role makes no requests even with a module', () => {
  render(<RecipesScreen modules={modules} session={{ ...session, user: { ...session.user, role: 'CHILD' } }} />);
  expect(screen.getByText('Recipes is not enabled for this account.')).toBeTruthy();
  expect(api.listRecipes).not.toHaveBeenCalled();
});
it('resets the real shell scroll when changing recipe workflow views',async()=>{
 const changed=jest.fn();render(<RecipesScreen modules={modules} session={session} onViewChanged={changed}/>);
 await screen.findByRole('button',{name:'Open Soup'});changed.mockClear();press('Open Soup');await screen.findByRole('button',{name:'Back to Recipes'});
 await waitFor(()=>expect(changed).toHaveBeenCalled());changed.mockClear();press('Edit Recipe');await waitFor(()=>expect(changed).toHaveBeenCalled());
 expect(screen.UNSAFE_queryByType(require('react-native').ScrollView)).toBeNull();
});
it('opens standalone detail and Back restores cookbook', async () => {
  await open(); expect(screen.queryByLabelText('Search recipes')).toBeNull();
  expect(await screen.findByText(/Uses: 2 cup water hot/)).toBeTruthy();
  expect(api.getRecipe).toHaveBeenCalledWith(11);
  press('Back to Recipes'); expect(await screen.findByLabelText('Search recipes')).toBeTruthy();
});
it('sends all advanced filters without filtering only visible rows', async () => {
  render(<RecipesScreen modules={modules} session={session} />); await screen.findByRole('button', { name: 'Open Soup' });
  change('Search recipes', 'soup'); press('Advanced Filters'); press('Category Dinner'); press('Tag Easy'); press('Favorites only'); change('Minimum rating', '4'); change('Ingredient filter', 'water'); press('Apply filters');
  await waitFor(() => expect(api.listRecipes).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'soup', category_id: 3, tag_id: 5, favorite: true, min_rating: 4, ingredient: 'water' })));
});
it('creates full manual payload and opens saved detail', async () => {
  render(<RecipesScreen modules={modules} session={session} />); await screen.findByRole('button', { name: 'Open Soup' }); press('New Recipe');
  change('Title', ' Soup '); change('Default Servings', '4'); change('Yield quantity', '2'); change('Yield unit', 'liters'); change('Ingredient 1 item', 'water'); change('Ingredient 1 quantity', '2'); change('Ingredient 1 group', 'Broth'); change('Ingredient 1 preparation', 'hot'); change('Step 1 instruction', 'Boil water'); press('Step 1 uses ingredient 1'); press('Save Recipe');
  await waitFor(() => expect(api.createRecipe).toHaveBeenCalledWith(expect.objectContaining({ title: 'Soup', servings: 4, yield_quantity: 2, yield_unit: 'liters', ingredients: [expect.objectContaining({ item: 'water', quantity: 2, group_name: 'Broth', preparation: 'hot' })], steps: [expect.objectContaining({ instruction: 'Boil water', ingredient_position_refs: [1] })] })));
  expect(await screen.findByText('Default Servings: 4')).toBeTruthy();
});
it('editing title preserves every unrelated recipe field and step links', async () => {
  const withComponent = { ...recipe, components: [{ component_recipe_id: 12, label: 'Sauce', quantity: 0.5, unit: 'batch', component_recipe: { ...recipe, id: 12, title: 'Sauce' } }] };
  api.getRecipe.mockResolvedValue(withComponent); await open(); press('Edit Recipe'); change('Title', 'New Soup'); press('Save Changes');
  await waitFor(() => expect(api.updateRecipe).toHaveBeenCalledWith(11, expect.objectContaining({ title: 'New Soup', servings: 4, yield_quantity: 2, yield_unit: 'liters', photo_url: recipe.photo_url, source_url: recipe.source_url, category_ids: [3], tag_ids: [5], rating: 4, favorite: true, notes: 'Keep warm', ingredients: [expect.objectContaining({ group_name: 'Broth', note: 'filtered', preparation: 'hot' }), expect.objectContaining({ is_optional: true })], steps: [expect.objectContaining({ ingredient_position_refs: [1] }), expect.objectContaining({ ingredient_position_refs: [2] })], components: [{ component_recipe_id: 12, label: 'Sauce', quantity: 0.5, unit: 'batch' }] })));
});
it('imports a URL and navigates to attributable detail', async () => {
  render(<RecipesScreen modules={modules} session={session} />); await screen.findByRole('button', { name: 'Open Soup' }); change('Recipe URL', 'https://example.test/soup'); press('Import URL');
  await waitFor(() => expect(api.importRecipeFromUrl).toHaveBeenCalledWith('https://example.test/soup')); expect(await screen.findByText('Default Servings: 4')).toBeTruthy();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined); press('Open source: Test Kitchen'); await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith(recipe.source_url));
});
it('exports selectable JSON and shares a cookbook file with genuine backup', async () => {
  render(<RecipesScreen modules={modules} session={session} />); await screen.findByRole('button', { name: 'Open Soup' }); press('Backup & Restore'); press('Export JSON');
  await screen.findByLabelText('Exported backup JSON'); press('Share JSON');
  await waitFor(() => expect(shareCookbookBackup).toHaveBeenCalledWith({version:1,recipes:[recipe]}));
});
it('prints the current recipe through the native document output',async()=>{
 await open();press('Print / PDF');await waitFor(()=>expect(printRecipe).toHaveBeenCalledWith(recipe,null));
});
it('keeps a recipe-only account functional without requesting chores-protected children',async()=>{
 api.listChildren.mockRejectedValue(new Error('Chores access is denied.'));
 render(<RecipesScreen session={session} modules={modules.filter(module=>module.key==='recipes')}/>);
 expect(await screen.findByRole('button',{name:'Open Soup'})).toBeTruthy();
 expect(api.listChildren).not.toHaveBeenCalled();
});
it('restores portable JSON stripping database identities and foreign references', async () => {
  render(<RecipesScreen modules={modules} session={session} />); await screen.findByRole('button', { name: 'Open Soup' }); press('Backup & Restore'); change('Restore JSON', JSON.stringify({ version: 1, recipes: [{ ...recipe, parent_recipe_id: 999 }] })); press('Restore backup');
  await waitFor(() => expect(api.importRecipeBackup).toHaveBeenCalledWith([expect.objectContaining({ title: 'Soup', parent_recipe_id: null, category_ids: [], tag_ids: [], components: [] })]));
  expect(await screen.findByText('Imported 1 recipes from backup.')).toBeTruthy();
});
it('invalid restore has no mutation and leaves input available', async () => {
  render(<RecipesScreen modules={modules} session={session} />); await screen.findByRole('button', { name: 'Open Soup' }); press('Backup & Restore'); change('Restore JSON', '{"version":99,"recipes":[]}'); press('Restore backup');
  expect(await screen.findByText(/Unsupported or invalid recipe backup/)).toBeTruthy(); expect(api.importRecipeBackup).not.toHaveBeenCalled();
});
it('scales servings and multiplier from server and shows linked step ingredients', async () => {
  await open(); change('Target servings', '8'); press('Scale servings');
  await waitFor(() => expect(api.scaleRecipe).toHaveBeenLastCalledWith(11, { targetServings: 8 }));
  await waitFor(() => expect(screen.getByLabelText('Multiplier').props.value).toBe('2'));
  expect(screen.getByText('Boil water scaled')).toBeTruthy(); expect(screen.getByText('Uses: 4 cup water hot')).toBeTruthy();
  change('Multiplier', '3'); api.scaleRecipe.mockResolvedValue({ ...scaled, target_servings: 12, factor: 3 }); press('Scale multiplier');
  await waitFor(() => expect(api.scaleRecipe).toHaveBeenLastCalledWith(11, { scaleFactor: 3 })); await waitFor(() => expect(screen.getByLabelText('Target servings').props.value).toBe('12'));
});
it('ingredient checks survive cooking navigation and cooking has previous next exit', async () => {
  await open(); fireEvent.press(screen.getByRole('checkbox', { name: 'Ingredient 1: 2 cup water hot' })); expect(screen.getByRole('checkbox', { name: 'Ingredient 1: 2 cup water hot' }).props.accessibilityState.checked).toBe(true);
  press('Start Cooking'); expect(screen.getByText('Step 1 of 2')).toBeTruthy(); press('Next step'); expect(screen.getByText('Step 2 of 2')).toBeTruthy(); press('Previous step'); expect(screen.getByText('Step 1 of 2')).toBeTruthy(); press('Exit Cooking'); expect(screen.getByRole('checkbox', { name: 'Ingredient 1: 2 cup water hot' }).props.accessibilityState.checked).toBe(true);
});
it('Android Back closes confirmation then editor then cooking then detail', async () => {
  let back: (() => boolean | null | undefined) | undefined;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, cb) => { back = cb; return { remove: jest.fn() }; });
  await open(); press('Start Cooking'); act(() => { expect(back!()).toBe(true); }); expect(screen.getByRole('button', { name: 'Start Cooking' })).toBeTruthy();
  press('Edit Recipe'); act(() => { expect(back!()).toBe(true); }); expect(screen.getByRole('button', { name: 'Edit Recipe' })).toBeTruthy();
  press('Delete Recipe'); act(() => { expect(back!()).toBe(true); }); expect(screen.queryByLabelText('Type recipe title')).toBeNull();
  act(() => { expect(back!()).toBe(true); }); expect(screen.getByLabelText('Search recipes')).toBeTruthy(); act(() => { expect(back!()).toBe(false); });
});
it('only exact typed title enables permanent delete and returns to list', async () => {
  await open(); press('Delete Recipe'); change('Type recipe title', 'soup'); press('Permanently Delete'); expect(api.deleteRecipe).not.toHaveBeenCalled();
  change('Type recipe title', 'Soup'); press('Permanently Delete'); await waitFor(() => expect(api.deleteRecipe).toHaveBeenCalledWith(11)); expect(await screen.findByLabelText('Search recipes')).toBeTruthy();
});
it('view-only access hides every recipe mutation but allows detail cooking and export', async () => {
  render(<RecipesScreen modules={[{ ...modules[0], can_manage: false }]} session={session} />); await screen.findByRole('button', { name: 'Open Soup' }); expect(screen.queryByRole('button', { name: 'New Recipe' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Import URL' })).toBeNull(); press('Open Soup'); await screen.findByText('Default Servings: 4');
  for (const name of ['Edit Recipe', 'Delete Recipe', 'Duplicate Recipe', 'Add Variant', 'Save Feedback']) expect(screen.queryByRole('button', { name })).toBeNull(); expect(screen.getByRole('button', { name: 'Start Cooking' })).toBeTruthy();
});
it('household admin can edit another creator recipe with an explicit manage grant', async () => {
  api.getRecipe.mockResolvedValue({ ...recipe, owner_user_id: 99 });
  render(<RecipesScreen modules={modules} session={{ ...session, user: { ...session.user, role: 'PARENT_ADMIN' } }} />);
  await screen.findByRole('button', { name: 'Open Soup' }); press('Open Soup'); await screen.findByText('Default Servings: 4');
  expect(screen.getByRole('button', { name: 'Delete Recipe' })).toBeTruthy();
  press('Edit Recipe'); change('Title', 'Admin edit'); press('Save Changes');
  await waitFor(() => expect(api.updateRecipe).toHaveBeenCalledWith(11, expect.objectContaining({ title: 'Admin edit' })));
});
it.each(['duplicate', 'variant', 'feedback'] as const)('non-owner parent can create %s without editing another creator recipe', async (action) => {
  api.getRecipe.mockResolvedValue({ ...recipe, owner_user_id: 99 });
  await open();
  expect(screen.queryByRole('button', { name: 'Edit Recipe' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete Recipe' })).toBeNull();
  if (action === 'duplicate') {
    press('Duplicate Recipe'); await waitFor(() => expect(api.duplicateRecipe).toHaveBeenCalledWith(11, { as_variant: false }));
  } else if (action === 'variant') {
    press('Add Variant'); change('Title', 'My variant'); press('Save Variant');
    await waitFor(() => expect(api.createRecipeVariant).toHaveBeenCalledWith(11, expect.objectContaining({ title: 'My variant' })));
  } else {
    change('Family rating', '5'); press('Save Feedback');
    await waitFor(() => expect(api.upsertRecipeFeedback).toHaveBeenCalledWith(11, expect.objectContaining({ parent_user_id: session.user.id, rating: 5 })));
  }
  expect(api.updateRecipe).not.toHaveBeenCalled(); expect(api.deleteRecipe).not.toHaveBeenCalled();
});
it.each([false, undefined])('admin authority does not bypass manage grant %s', async (can_manage) => {
  api.getRecipe.mockResolvedValue({ ...recipe, owner_user_id: 99 });
  render(<RecipesScreen modules={[{ ...modules[0], can_manage }]} session={{ ...session, user: { ...session.user, role: 'PARENT_ADMIN' } }} />);
  await screen.findByRole('button', { name: 'Open Soup' }); press('Open Soup'); await screen.findByText('Default Servings: 4');
  for (const name of ['Edit Recipe', 'Delete Recipe', 'Duplicate Recipe', 'Add Variant', 'Save Feedback']) expect(screen.queryByRole('button', { name })).toBeNull();
});
it('duplicate and variant creation use separate endpoints and open their saved detail', async () => {
  await open(); api.getRecipe.mockResolvedValue({ ...recipe, id: 12, title: 'Soup copy' }); press('Duplicate Recipe'); await waitFor(() => expect(api.duplicateRecipe).toHaveBeenCalledWith(11, { as_variant: false })); expect(await screen.findByText('Soup copy')).toBeTruthy();
  press('Back to Recipes'); press('Open Soup'); await screen.findByText('Default Servings: 4'); press('Add Variant'); change('Title', 'Soup variant'); press('Save Variant'); await waitFor(() => expect(api.createRecipeVariant).toHaveBeenCalledWith(12, expect.objectContaining({ title: 'Soup variant' })));
});
it('feedback selects active household children and reads back saved family detail', async () => {
  await open(); expect(api.listChildren).toHaveBeenCalledWith({ household_id: 7, active_only: true }); press('Child feedback'); expect(screen.queryByText('Inactive')).toBeNull(); expect(screen.queryByText('Foreign')).toBeNull(); press('Reviewer Alex'); change('Family rating', '5'); change('Verdict', 'Loved it'); change('Feedback notes', 'More please'); press('Save Feedback');
  await waitFor(() => expect(api.upsertRecipeFeedback).toHaveBeenCalledWith(11, { reviewer_type: 'CHILD', child_id: 8, parent_user_id: null, rating: 5, verdict: 'Loved it', notes: 'More please' })); await waitFor(() => expect(api.getRecipe.mock.calls.length).toBeGreaterThan(1));
});
it('load errors are visible and retry refetches the real cookbook', async () => {
  api.listRecipes.mockRejectedValueOnce(new Error('offline')); render(<RecipesScreen modules={modules} session={session} />); expect(await screen.findByText(/offline/)).toBeTruthy(); press('Retry'); expect(await screen.findByRole('button', { name: 'Open Soup' })).toBeTruthy();
});
it('missing management flag never inherits an owner or admin write grant', async () => {
  render(<RecipesScreen modules={[{ ...modules[0], can_manage: undefined }]} session={session} />);
  await screen.findByRole('button', { name: 'Open Soup' });
  expect(screen.queryByRole('button', { name: 'New Recipe' })).toBeNull();
  expect(api.listChildren).not.toHaveBeenCalled();
  press('Backup & Restore'); expect(screen.queryByRole('button', { name: 'Restore backup' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Export JSON' })).toBeTruthy();
});
it('revoking management closes an already-open editor without a write', async () => {
  const view = render(<RecipesScreen modules={modules} session={session} />);
  await screen.findByRole('button', { name: 'Open Soup' }); press('New Recipe'); change('Title', 'Draft');
  view.rerender(<RecipesScreen modules={[{ ...modules[0], can_manage: false }]} session={session} />);
  expect(screen.queryByRole('button', { name: 'Save Recipe' })).toBeNull();
  expect(api.createRecipe).not.toHaveBeenCalled();
  await screen.findByRole('button', { name: 'Open Soup' });
});
it('removed grants discard pending cookbook responses and stop reads', async () => {
  let resolve!: (value: unknown) => void;
  api.listRecipes.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const view = render(<RecipesScreen modules={modules} session={session} />);
  view.rerender(<RecipesScreen modules={[]} session={session} />);
  const calls = api.listRecipes.mock.calls.length;
  await act(async () => { resolve([recipe]); });
  expect(screen.getByText('Recipes is not enabled for this account.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Open Soup' })).toBeNull();
  expect(api.listRecipes.mock.calls.length).toBe(calls);
});
it('opens component core and variant links through the detail endpoint', async () => {
  const related = { ...recipe, id: 12, title: 'Sauce' };
  api.getRecipe.mockResolvedValueOnce({ ...recipe, components: [{ component_recipe_id: 12, label: 'Sauce', quantity: 0.5, unit: 'batch', component_recipe: related }], core_recipe: { ...related, id: 13, title: 'Core' }, variants: [{ ...related, id: 14, title: 'Variation' }] });
  await open();
  expect(screen.getByRole('button', { name: 'Open core: Core' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Open variant: Variation' })).toBeTruthy();
  api.getRecipe.mockResolvedValue(related); press('Open component: Sauce');
  await waitFor(() => expect(api.getRecipe).toHaveBeenLastCalledWith(12));
  expect(await screen.findByText('Sauce')).toBeTruthy();
});
it('failed save preserves editable draft and reports the server error', async () => {
  api.createRecipe.mockRejectedValueOnce(new Error('save offline'));
  render(<RecipesScreen modules={modules} session={session} />);
  await screen.findByRole('button', { name: 'Open Soup' }); press('New Recipe'); change('Title', 'Draft'); press('Save Recipe');
  expect(await screen.findByText('save offline')).toBeTruthy();
  expect(screen.getByLabelText('Title').props.value).toBe('Draft');
  press('Save Recipe'); await screen.findByText('Default Servings: 4');
  expect(api.createRecipe).toHaveBeenCalledTimes(2);
});
it('rejects invalid scaling numbers without an API request', async () => {
  await open(); change('Target servings', '0'); press('Scale servings');
  expect(api.scaleRecipe).not.toHaveBeenCalled();
  expect(await screen.findByText('Enter a positive number for scaling.')).toBeTruthy();
});
