import { useEffect, useState } from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { CreateRecipeRequest } from '@family-manager/family-api/models';
import { emptyPayload } from '../lib/payload';
import { RecipeEditor } from './RecipeEditor';

const input = (label: string) => screen.getByLabelText(label);
const save = () => screen.getByRole('button', { name: 'Save Recipe' });
const quantityLabel = 'Ingredient 1 quantity';
function fixture(): CreateRecipeRequest {
  return {
    ...emptyPayload(), title: 'Decimal soup', servings: null, yield_quantity: null,
    ingredients: [{ position: 1, item: 'Water', quantity: null }],
    components: [{ component_recipe_id: 12, label: 'Sauce', quantity: null }],
  };
}
function mount(initial = fixture()) {
  const saved = jest.fn<(payload: CreateRecipeRequest) => void>();
  let current = initial;
  function Editor({ data, recipeId }: { data: CreateRecipeRequest; recipeId?: number }) {
    const [payload, setPayload] = useState(data);
    useEffect(() => { setPayload(data); }, [data]);
    current = payload;
    return <RecipeEditor payload={payload} setPayload={setPayload} categories={[]} tags={[]} available={[]} recipeId={recipeId} busy={false} submitLabel="Save Recipe" onSave={() => saved(payload)} onCancel={jest.fn()} />;
  }
  const view = render(<Editor data={initial} />);
  return { saved, payload: () => current, replace: (data: CreateRecipeRequest, recipeId?: number) => view.rerender(<Editor data={data} recipeId={recipeId} />), unmount: view.unmount };
}
function typeCharacters(label: string, text: string) {
  fireEvent.changeText(input(label), '');
  for (const character of text) {
    const next = input(label).props.value + character;
    fireEvent.changeText(input(label), next);
    // Append to the CURRENT rendered value, not a precomputed/pasted string.
    expect(input(label).props.value).toBe(next);
  }
}

const numericCases: Array<[string, (p: CreateRecipeRequest) => number | null | undefined]> = [
  ['Default Servings', (p: CreateRecipeRequest) => p.servings],
  ['Yield quantity', (p: CreateRecipeRequest) => p.yield_quantity],
  [quantityLabel, (p: CreateRecipeRequest) => p.ingredients?.[0].quantity],
  ['Component 1 quantity', (p: CreateRecipeRequest) => p.components?.[0].quantity],
];

describe('RecipeEditor incremental numeric entry (UX-001)', () => {
  describe.each(numericCases)('%s', (label, numberIn) => {
    it.each(['1.5', '0.5', '.5'])('retains every character of %s and submits its numeric value', target => {
      const editor = mount();
      typeCharacters(label, target);
      expect(input(label).props.value).toBe(target);
      expect(numberIn(editor.payload())).toBeNull();
      fireEvent.press(save());
      expect(editor.saved).toHaveBeenCalledTimes(1);
      expect(numberIn(editor.saved.mock.calls[0][0])).toBe(Number(target));
    });
  });

  it.each(['', '.', '0.', '1.'])('preserves the raw intermediate draft %j across blur and unrelated edits', text => {
    const editor = mount({ ...fixture(), ingredients: [{ position: 1, item: 'Water', quantity: 2 }] });
    fireEvent.changeText(input(quantityLabel), text);
    fireEvent(input(quantityLabel), 'blur');
    fireEvent.changeText(input('Title'), 'Edited soup');
    expect(input(quantityLabel).props.value).toBe(text);
    expect(editor.payload().ingredients?.[0].quantity).toBe(2);
  });

  it.each(numericCases)('submits an explicitly cleared %s as null', (label, numberIn) => {
    const initial = { ...fixture(), servings: 4, yield_quantity: 2, ingredients: [{ position: 1, item: 'Water', quantity: 2 }], components: [{ component_recipe_id: 12, quantity: 2 }] };
    const editor = mount(initial);
    fireEvent.changeText(input(label), '');
    expect(input(label).props.value).toBe('');
    fireEvent.press(save());
    expect(editor.saved).toHaveBeenCalledTimes(1);
    expect(numberIn(editor.saved.mock.calls[0][0])).toBeNull();
  });

  it.each(['.', '1..5', 'not a number', 'Infinity', '0x10', '1e2'])('never silently saves a stale quantity for invalid draft %j', text => {
    const editor = mount({ ...fixture(), ingredients: [{ position: 1, item: 'Water', quantity: 2 }] });
    fireEvent.changeText(input(quantityLabel), text);
    fireEvent(input(quantityLabel), 'blur');
    expect(input(quantityLabel).props.value).toBe(text);
    expect(save()).toBeDisabled();
    expect(screen.getByText(`${quantityLabel}: Enter a valid number or leave blank.`)).toBeTruthy();
    fireEvent.press(save());
    expect(editor.saved).not.toHaveBeenCalled();
    typeCharacters(quantityLabel, '0.25');
    expect(save()).not.toBeDisabled();
    fireEvent.press(save());
    expect(editor.saved).toHaveBeenCalledTimes(1);
    expect(editor.saved.mock.calls[0][0].ingredients?.[0].quantity).toBe(0.25);
  });

  it.each(['0.', '1.'])('converts valid trailing-decimal draft %s only when saving', text => {
    const editor = mount();
    typeCharacters(quantityLabel, text);
    expect(editor.payload().ingredients?.[0].quantity).toBeNull();
    fireEvent.press(save());
    expect(editor.saved.mock.calls[0][0].ingredients?.[0].quantity).toBe(Number(text));
  });

  it('commits all numeric fields before invoking the parent save callback', () => {
    const editor = mount();
    for (const [label] of numericCases) typeCharacters(label, '0.5');
    fireEvent.press(save());
    expect(editor.saved).toHaveBeenCalledTimes(1);
    const sent = editor.saved.mock.calls[0][0];
    expect(sent).toMatchObject({ title: 'Decimal soup', servings: 0.5, yield_quantity: 0.5, ingredients: [{ item: 'Water', quantity: 0.5 }], components: [{ component_recipe_id: 12, quantity: 0.5 }] });
  });

  it.each(['Prep minutes', 'Cook minutes', 'Rating'])('retains shared numeric behavior for %s', label => {
    const editor = mount();
    typeCharacters(label, '1.5');
    fireEvent.press(save());
    const key = { 'Prep minutes': 'prep_minutes', 'Cook minutes': 'cook_minutes', Rating: 'rating' }[label] as 'prep_minutes' | 'cook_minutes' | 'rating';
    expect(editor.saved.mock.calls[0][0][key]).toBe(1.5);
  });

  it('prefills changed numeric props instead of keeping an obsolete draft', () => {
    const editor = mount();
    typeCharacters(quantityLabel, '1.5');
    editor.replace({ ...fixture(), servings: 3.5, yield_quantity: 2.5, ingredients: [{ position: 1, item: 'Flour', quantity: 4.5 }], components: [{ component_recipe_id: 13, quantity: 0.75 }] }, 13);
    expect(input(quantityLabel).props.value).toBe('4.5');
    expect(input('Default Servings').props.value).toBe('3.5');
    expect(input('Yield quantity').props.value).toBe('2.5');
    expect(input('Component 1 quantity').props.value).toBe('0.75');
    fireEvent.press(save());
    expect(editor.saved.mock.calls[0][0].ingredients?.[0]).toMatchObject({ item: 'Flour', quantity: 4.5 });
  });

  it('resets drafts on replacement even when the incoming number is unchanged', () => {
    const initial = { ...fixture(), ingredients: [{ position: 1, item: 'Water', quantity: 2 }] };
    const editor = mount(initial);
    typeCharacters(quantityLabel, '0.5');
    editor.replace({ ...initial, title: 'Replacement soup' }, 99);
    expect(input(quantityLabel).props.value).toBe('2');
    fireEvent.press(save());
    expect(editor.saved.mock.calls[0][0]).toMatchObject({ title: 'Replacement soup', ingredients: [{ quantity: 2 }] });
  });

  it('prefills the persisted numeric values after remount', () => {
    const editor = mount();
    typeCharacters(quantityLabel, '0.5');
    fireEvent.press(save());
    const persisted = editor.saved.mock.calls[0][0];
    editor.unmount();
    mount(persisted);
    expect(input(quantityLabel).props.value).toBe('0.5');
  });

  it.each(['ingredient', 'component'] as const)('removes invalid %s drafts without transferring them to the next row', kind => {
    const initial = { ...fixture(), ingredients: [{ position: 1, item: 'Water', quantity: 2 }, { position: 2, item: 'Flour', quantity: 2 }], components: [{ component_recipe_id: 12, quantity: 2 }, { component_recipe_id: 13, quantity: 2 }] };
    const editor = mount(initial);
    const prefix = kind === 'ingredient' ? 'Ingredient' : 'Component';
    fireEvent.changeText(input(`${prefix} 1 quantity`), '.');
    typeCharacters(`${prefix} 2 quantity`, '0.5');
    fireEvent.press(screen.getByRole('button', { name: `Remove ${kind} 1` }));
    expect(input(`${prefix} 1 quantity`).props.value).toBe('0.5');
    expect(save()).not.toBeDisabled();
    fireEvent.press(save());
    const sent = editor.saved.mock.calls[0][0];
    expect((kind === 'ingredient' ? sent.ingredients : sent.components)?.[0].quantity).toBe(0.5);
  });
});
