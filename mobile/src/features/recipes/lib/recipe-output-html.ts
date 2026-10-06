import type {RecipeDetail,RecipeScaleResponse} from '../../../api/models';
import {stepIngredientPositions} from './payload';
const escapeHtml=(value:unknown):string=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function buildRecipePrintHtml(recipe:RecipeDetail,scale:RecipeScaleResponse|null):string{
 const servings=scale?.target_servings??recipe.servings;
 const ingredients=(scale?.ingredients??recipe.ingredients).map(row=>{
  const quantity='scaled_quantity' in row?row.scaled_quantity:row.quantity;
  return `<li>${escapeHtml([quantity,row.unit,row.item].filter(value=>value!==null&&value!=='').join(' '))}${row.preparation?`, ${escapeHtml(row.preparation)}`:''}${row.is_optional?' (optional)':''}${row.note?` — ${escapeHtml(row.note)}`:''}</li>`;
 }).join('');
 const rows=scale?.ingredients??recipe.ingredients;
 const steps=(scale?.steps??recipe.steps).map((step,index)=>{
  const positions=stepIngredientPositions(step,rows);
  const linked=scale?.steps[index]?.linked_ingredients??rows.filter(row=>positions.includes(row.position));
  const quantities=linked.map(row=>escapeHtml(['scaled_quantity' in row?row.scaled_quantity:row.quantity,row.unit,row.item].filter(value=>value!==null&&value!=='').join(' '))).join(', ');
  return `<li>${step.section?`<strong>${escapeHtml(step.section)}</strong>: `:''}${escapeHtml('scaled_instruction' in step?step.scaled_instruction:step.instruction)}${linked.length?`<p>Uses: ${quantities}</p>`:''}</li>`;
 }).join('');
 const components=recipe.components.map(component=>`<li>${escapeHtml(component.label||component.component_recipe.title)}</li>`).join('');
 const metadata=[servings===null?null:`Servings: ${servings}`,recipe.prep_minutes===null?null:`Prep: ${recipe.prep_minutes} min`,recipe.cook_minutes===null?null:`Cook: ${recipe.cook_minutes} min`].filter(Boolean).map(escapeHtml).join(' · ');
 const warnings=scale?.warnings.map(warning=>`<p>${escapeHtml(warning)}</p>`).join('')??'';
 return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(recipe.title)}</title><style>body{font:16px system-ui;max-width:720px;margin:24px auto;padding:0 18px;color:#111}li{margin:8px 0}p,li{white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{max-width:none;margin:0}}</style></head><body><h1>${escapeHtml(recipe.title)}</h1><p>${escapeHtml(recipe.description)}</p><p>${metadata}</p>${warnings}<h2>Ingredients</h2><ul>${ingredients}</ul><h2>Instructions</h2><ol>${steps}</ol>${components?`<h2>Components</h2><ul>${components}</ul>`:''}${recipe.notes?`<h2>Notes</h2><p>${escapeHtml(recipe.notes)}</p>`:''}${recipe.source_name||recipe.source_url?`<p>Source: ${escapeHtml(recipe.source_name)} ${escapeHtml(recipe.source_url)}</p>`:''}</body></html>`;
}
