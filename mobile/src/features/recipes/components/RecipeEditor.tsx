import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { View } from 'react-native';
import {RecipeText as Text} from './RecipeText';
import type { CreateRecipeRequest, RecipeCategory, RecipeSummary, RecipeTag } from '@family-manager/family-api/models';
import { ActionButton } from '../../../components/ActionButton';
import { SectionCard } from '../../../components/SectionCard';
import { Field, Toggle } from './RecipeFields';
import { emptyIngredient, emptyStep, removeIngredient } from '../lib/payload';

type Props = { payload: CreateRecipeRequest; setPayload: Dispatch<SetStateAction<CreateRecipeRequest>>; categories: RecipeCategory[]; tags: RecipeTag[]; available: RecipeSummary[]; recipeId?: number; busy: boolean; submitLabel: string; onSave: () => void; onCancel: () => void };
const numericKeys = ['servings', 'yield_quantity', 'prep_minutes', 'cook_minutes', 'rating'] as const;
const numericText = (value: number | null | undefined) => value == null ? '' : String(value);
function parseNumeric(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

export function RecipeEditor({ payload: p, setPayload, categories, tags, available, recipeId, busy, submitLabel, onSave, onCancel }: Props) {
  // Keep editable text separate from the numeric API payload until Save.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const localPayload = useRef(p);
  const currentRecipeId = useRef(recipeId);
  const pendingSave = useRef<CreateRecipeRequest | null>(null);
  const set: Dispatch<SetStateAction<CreateRecipeRequest>> = action => setPayload(prev => {
    const next = typeof action === 'function' ? action(prev) : action;
    localPayload.current = next;
    return next;
  });
  useEffect(() => {
    // Server/import/recipe replacements must prefill anew; our own title/row
    // updates must not erase an in-progress decimal.
    if (p !== localPayload.current || recipeId !== currentRecipeId.current) {
      setDrafts({});
      localPayload.current = p;
      currentRecipeId.current = recipeId;
      pendingSave.current = null;
    }
    if (pendingSave.current === p) {
      pendingSave.current = null;
      // The parent callback now closes over the committed numeric payload.
      onSave();
    }
  }, [p, recipeId, onSave]);
  const update = (patch: Partial<CreateRecipeRequest>) => set(prev => ({ ...prev, ...patch }));
  const draftNumeric = (label: string, key: string, value: number | null | undefined) => <Numeric key={key} label={label} value={drafts[key] ?? numericText(value)} disabled={busy} onChange={text => setDrafts(prev => ({ ...prev, [key]: text }))} />;
  const stringField = (label: string, key: keyof CreateRecipeRequest, multiline = false) => <Field key={key} label={label} value={String(p[key] ?? '')} disabled={busy} multiline={multiline} onChange={v => update({ [key]: v || (/url$/.test(key) ? null : '') })} />;
  const numericField = (label: string, key: typeof numericKeys[number]) => draftNumeric(label, key, p[key]);
  const activeNumericKeys = [...numericKeys, ...(p.ingredients ?? []).map((_, n) => `ingredient:${n}`), ...(p.components ?? []).map((_, n) => `component:${n}`)];
  const invalidDraft = activeNumericKeys.some(key => key in drafts && parseNumeric(drafts[key]) === undefined);
  const removeDraftRow = (kind: 'ingredient' | 'component', index: number) => setDrafts(prev => {
    const next: Record<string, string> = {};
    for (const [key, text] of Object.entries(prev)) {
      if (!key.startsWith(`${kind}:`)) next[key] = text;
      else {
        const row = Number(key.slice(kind.length + 1));
        if (row !== index) next[`${kind}:${row > index ? row - 1 : row}`] = text;
      }
    }
    return next;
  });
  const save = () => {
    if (busy || !p.title.trim() || invalidDraft) return;
    const converted = Object.fromEntries(activeNumericKeys.filter(key => key in drafts).map(key => [key, parseNumeric(drafts[key])]));
    const next: CreateRecipeRequest = {
      ...p,
      ...Object.fromEntries(numericKeys.filter(key => key in drafts).map(key => [key, converted[key]])),
      ingredients: p.ingredients?.map((row, n) => `ingredient:${n}` in drafts ? { ...row, quantity: converted[`ingredient:${n}`] } : row),
      components: p.components?.map((row, n) => `component:${n}` in drafts ? { ...row, quantity: converted[`component:${n}`] } : row),
    };
    pendingSave.current = next;
    set(next);
  };
  const toggleId = (key: 'category_ids' | 'tag_ids', id: number) => update({ [key]: (p[key] ?? []).includes(id) ? p[key]?.filter(x => x !== id) : [...(p[key] ?? []), id] });
  return <View>
    <SectionCard title={recipeId ? 'Edit Recipe' : 'Recipe Editor'}>
      {stringField('Title', 'title')}{stringField('Description', 'description', true)}{stringField('Photo URL', 'photo_url')}{stringField('Source name', 'source_name')}{stringField('Source URL', 'source_url')}
      {numericField('Default Servings', 'servings')}{numericField('Yield quantity', 'yield_quantity')}{stringField('Yield unit', 'yield_unit')}{numericField('Prep minutes', 'prep_minutes')}{numericField('Cook minutes', 'cook_minutes')}{numericField('Rating', 'rating')}{stringField('Notes', 'notes', true)}
      <Toggle label="Favorite" checked={p.favorite ?? false} disabled={busy} onPress={() => update({ favorite: !p.favorite })} />
      <Text>Categories</Text>{categories.map(c => <Toggle key={c.id} label={`Recipe category ${c.name}`} checked={p.category_ids?.includes(c.id) ?? false} disabled={busy} onPress={() => toggleId('category_ids', c.id)} />)}
      <Text>Tags</Text>{tags.map(t => <Toggle key={t.id} label={`Recipe tag ${t.name}`} checked={p.tag_ids?.includes(t.id) ?? false} disabled={busy} onPress={() => toggleId('tag_ids', t.id)} />)}
    </SectionCard>
    <SectionCard title="Ingredients">
      {(p.ingredients ?? []).map((i, n) => {
        const patch = (v: Partial<typeof i>) => update({ ingredients: p.ingredients?.map((row, index) => index === n ? { ...row, ...v } : row) });
        return <View key={n}>
          <Field label={`Ingredient ${n + 1} item`} value={i.item} disabled={busy} onChange={item => patch({ item })} />
          {draftNumeric(`Ingredient ${n + 1} quantity`, `ingredient:${n}`, i.quantity)}
          {(['unit', 'group_name', 'preparation', 'note'] as const).map(key => <Field key={key} label={`Ingredient ${n + 1} ${key === 'group_name' ? 'group' : key}`} value={i[key] ?? ''} disabled={busy} onChange={v => patch({ [key]: v })} />)}
          <Toggle label={`Ingredient ${n + 1} optional`} checked={i.is_optional ?? false} disabled={busy} onPress={() => patch({ is_optional: !i.is_optional })} />
          <ActionButton variant="danger" label={`Remove ingredient ${n + 1}`} disabled={busy} onPress={() => { removeDraftRow('ingredient', n); set(prev => removeIngredient(prev, n)); }} />
        </View>;
      })}
      <ActionButton label="Add Ingredient" variant="secondary" disabled={busy} onPress={() => update({ ingredients: [...(p.ingredients ?? []), emptyIngredient((p.ingredients?.length ?? 0) + 1)] })} />
    </SectionCard>
    <SectionCard title="Steps">
      {(p.steps ?? []).map((s, n) => {
        const patch = (v: Partial<typeof s>) => update({ steps: p.steps?.map((row, index) => index === n ? { ...row, ...v } : row) });
        return <View key={n}>
          <Field label={`Step ${n + 1} section`} value={s.section ?? ''} disabled={busy} onChange={section => patch({ section })} />
          <Field label={`Step ${n + 1} instruction`} value={s.instruction} multiline disabled={busy} onChange={instruction => patch({ instruction })} />
          <Text>Linked ingredients: {(s.ingredient_position_refs ?? []).join(', ') || 'none'}</Text>
          {(p.ingredients ?? []).map(i => <Toggle key={i.position} label={`Step ${n + 1} uses ingredient ${i.position}`} disabled={busy} checked={s.ingredient_position_refs?.includes(i.position) ?? false} onPress={() => patch({ ingredient_position_refs: s.ingredient_position_refs?.includes(i.position) ? s.ingredient_position_refs.filter(ref => ref !== i.position) : [...(s.ingredient_position_refs ?? []), i.position] })} />)}
          <ActionButton variant="danger" label={`Remove step ${n + 1}`} disabled={busy} onPress={() => update({ steps: p.steps?.filter((_, index) => index !== n).map((row, index) => ({ ...row, position: index + 1 })) })} />
        </View>;
      })}
      <ActionButton label="Add Step" variant="secondary" disabled={busy} onPress={() => update({ steps: [...(p.steps ?? []), emptyStep((p.steps?.length ?? 0) + 1)] })} />
    </SectionCard>
    <SectionCard title="Sub-recipes / Components">
      {(p.components ?? []).map((c, n) => {
        const patch = (v: Partial<typeof c>) => update({ components: p.components?.map((row, index) => index === n ? { ...row, ...v } : row) });
        return <View key={n}>
          <Text>Component {n + 1}: {available.find(r => r.id === c.component_recipe_id)?.title ?? `Recipe ${c.component_recipe_id || 'not selected'}`}</Text>
          {available.filter(r => r.id !== recipeId).map(r => <Toggle key={r.id} label={`Component ${n + 1}: ${r.title}`} checked={r.id === c.component_recipe_id} disabled={busy} onPress={() => patch({ component_recipe_id: r.id })} />)}
          <Field label={`Component ${n + 1} label`} value={c.label ?? ''} disabled={busy} onChange={label => patch({ label })} />
          {draftNumeric(`Component ${n + 1} quantity`, `component:${n}`, c.quantity)}
          <Field label={`Component ${n + 1} unit`} value={c.unit ?? ''} disabled={busy} onChange={unit => patch({ unit })} />
          <ActionButton variant="danger" label={`Remove component ${n + 1}`} disabled={busy} onPress={() => { removeDraftRow('component', n); update({ components: p.components?.filter((_, index) => index !== n) }); }} />
        </View>;
      })}
      <ActionButton label="Add Sub-recipe" variant="secondary" disabled={busy} onPress={() => update({ components: [...(p.components ?? []), { component_recipe_id: 0, label: '', quantity: null, unit: '' }] })} />
    </SectionCard>
    <ActionButton label={submitLabel} disabled={busy || !p.title.trim() || invalidDraft} onPress={save} />
    <ActionButton label="Cancel Editor" disabled={busy} variant="secondary" onPress={onCancel} />
  </View>;
}
function Numeric({ label, value, onChange, disabled }: { label: string; value: string; onChange: (text: string) => void; disabled: boolean }) {
  return <View>
    <Field label={label} value={value} disabled={disabled} numeric onChange={onChange} />
    {parseNumeric(value) === undefined && <Text accessibilityRole="alert">{label}: Enter a valid number or leave blank.</Text>}
  </View>;
}
