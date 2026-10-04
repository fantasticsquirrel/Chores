import type { Dispatch, SetStateAction } from 'react';
import { Text, View } from 'react-native';
import type { CreateRecipeRequest, RecipeCategory, RecipeSummary, RecipeTag } from '@family-manager/family-api/models';
import { ActionButton } from '../../../components/ActionButton';
import { SectionCard } from '../../../components/SectionCard';
import { Field, Toggle } from './RecipeFields';
import { emptyIngredient, emptyStep, removeIngredient } from '../lib/payload';

type Props = { payload: CreateRecipeRequest; setPayload: Dispatch<SetStateAction<CreateRecipeRequest>>; categories: RecipeCategory[]; tags: RecipeTag[]; available: RecipeSummary[]; recipeId?: number; busy: boolean; submitLabel: string; onSave: () => void; onCancel: () => void };
export function RecipeEditor({ payload: p, setPayload: set, categories, tags, available, recipeId, busy, submitLabel, onSave, onCancel }: Props) {
  const update = (patch: Partial<CreateRecipeRequest>) => set(prev => ({ ...prev, ...patch }));
  const stringField = (label: string, key: keyof CreateRecipeRequest, multiline = false) => <Field key={key} label={label} value={String(p[key] ?? '')} disabled={busy} multiline={multiline} onChange={v => update({ [key]: v || (/url$/.test(key) ? null : '') })} />;
  const numericField = (label: string, key: keyof CreateRecipeRequest) => <Numeric key={key} label={label} value={p[key] as number | null} disabled={busy} onChange={v => update({ [key]: v })} />;
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
          <Numeric label={`Ingredient ${n + 1} quantity`} value={i.quantity} disabled={busy} onChange={quantity => patch({ quantity })} />
          {(['unit', 'group_name', 'preparation', 'note'] as const).map(key => <Field key={key} label={`Ingredient ${n + 1} ${key === 'group_name' ? 'group' : key}`} value={i[key] ?? ''} disabled={busy} onChange={v => patch({ [key]: v })} />)}
          <Toggle label={`Ingredient ${n + 1} optional`} checked={i.is_optional ?? false} disabled={busy} onPress={() => patch({ is_optional: !i.is_optional })} />
          <ActionButton variant="danger" label={`Remove ingredient ${n + 1}`} disabled={busy} onPress={() => set(prev => removeIngredient(prev, n))} />
        </View>;
      })}
      <ActionButton label="Add Ingredient" disabled={busy} onPress={() => update({ ingredients: [...(p.ingredients ?? []), emptyIngredient((p.ingredients?.length ?? 0) + 1)] })} />
    </SectionCard>
    <SectionCard title="Steps">
      {(p.steps ?? []).map((s, n) => {
        const patch = (v: Partial<typeof s>) => update({ steps: p.steps?.map((row, index) => index === n ? { ...row, ...v } : row) });
        return <View key={n}>
          <Field label={`Step ${n + 1} section`} value={s.section ?? ''} disabled={busy} onChange={section => patch({ section })} />
          <Field label={`Step ${n + 1} instruction`} value={s.instruction} multiline disabled={busy} onChange={instruction => patch({ instruction })} />
          <Text>Linked ingredients: {(s.ingredient_position_refs ?? []).join(', ') || 'none'}</Text>
          {(p.ingredients ?? []).map(i => <ActionButton key={i.position} label={`Step ${n + 1} uses ingredient ${i.position}`} disabled={busy} variant={s.ingredient_position_refs?.includes(i.position) ? 'primary' : 'secondary'} onPress={() => patch({ ingredient_position_refs: s.ingredient_position_refs?.includes(i.position) ? s.ingredient_position_refs.filter(ref => ref !== i.position) : [...(s.ingredient_position_refs ?? []), i.position] })} />)}
          <ActionButton variant="danger" label={`Remove step ${n + 1}`} disabled={busy} onPress={() => update({ steps: p.steps?.filter((_, index) => index !== n).map((row, index) => ({ ...row, position: index + 1 })) })} />
        </View>;
      })}
      <ActionButton label="Add Step" disabled={busy} onPress={() => update({ steps: [...(p.steps ?? []), emptyStep((p.steps?.length ?? 0) + 1)] })} />
    </SectionCard>
    <SectionCard title="Sub-recipes / Components">
      {(p.components ?? []).map((c, n) => {
        const patch = (v: Partial<typeof c>) => update({ components: p.components?.map((row, index) => index === n ? { ...row, ...v } : row) });
        return <View key={n}>
          <Text>Component {n + 1}: {available.find(r => r.id === c.component_recipe_id)?.title ?? `Recipe ${c.component_recipe_id || 'not selected'}`}</Text>
          {available.filter(r => r.id !== recipeId).map(r => <ActionButton key={r.id} label={`Component ${n + 1}: ${r.title}`} variant={r.id === c.component_recipe_id ? 'primary' : 'secondary'} disabled={busy} onPress={() => patch({ component_recipe_id: r.id })} />)}
          <Field label={`Component ${n + 1} label`} value={c.label ?? ''} disabled={busy} onChange={label => patch({ label })} />
          <Numeric label={`Component ${n + 1} quantity`} value={c.quantity} disabled={busy} onChange={quantity => patch({ quantity })} />
          <Field label={`Component ${n + 1} unit`} value={c.unit ?? ''} disabled={busy} onChange={unit => patch({ unit })} />
          <ActionButton variant="danger" label={`Remove component ${n + 1}`} disabled={busy} onPress={() => update({ components: p.components?.filter((_, index) => index !== n) })} />
        </View>;
      })}
      <ActionButton label="Add Sub-recipe" disabled={busy} onPress={() => update({ components: [...(p.components ?? []), { component_recipe_id: 0, label: '', quantity: null, unit: '' }] })} />
    </SectionCard>
    <ActionButton label={submitLabel} disabled={busy || !p.title.trim()} onPress={onSave} />
    <ActionButton label="Cancel Editor" disabled={busy} variant="secondary" onPress={onCancel} />
  </View>;
}
function Numeric({ label, value, onChange, disabled }: { label: string; value: number | null | undefined; onChange: (n: number | null) => void; disabled: boolean }) {
  return <Field label={label} value={value == null ? '' : String(value)} disabled={disabled} numeric onChange={text => { if (text.trim() === '') onChange(null); else if (Number.isFinite(Number(text))) onChange(Number(text)); }} />;
}
