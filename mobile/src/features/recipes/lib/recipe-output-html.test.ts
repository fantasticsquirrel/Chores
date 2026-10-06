import {describe,expect,it} from "vitest";
import {buildRecipePrintHtml} from "./recipe-output-html";
import type {RecipeDetail,RecipeScaleResponse} from "../../../api/models";
import {recipe as canonicalRecipe} from '../../../screens/recipes/fixtures';
const recipe={title:'Soup <script>x</script>',description:'Warm & quick',servings:2,prep_minutes:5,cook_minutes:10,notes:'Keep <cool>',ingredients:[{position:1,quantity:2,unit:'cups',item:'water',group_name:'Base',preparation:'',note:'',is_optional:false}],steps:[{position:1,section:'Cook',instruction:'Add 2 cups',ingredient_ids:[]}],components:[]} as unknown as RecipeDetail;
describe('native printable recipe',()=>{
 it('prints canonical backend step ingredient bindings without populated position refs',()=>{expect(buildRecipePrintHtml(canonicalRecipe,null)).toContain('Uses: 2 cup water');});
 it('escapes cookbook content and includes metadata, ingredients, steps and notes',()=>{
  const html=buildRecipePrintHtml(recipe,null);
  expect(html).toContain('Soup &lt;script&gt;x&lt;/script&gt;'); expect(html).not.toContain('<script>');
  for(const text of ['Warm &amp; quick','2 cups water','Add 2 cups','Keep &lt;cool&gt;','5 min','10 min'])expect(html).toContain(text);
 });
 it('prints authoritative scaled quantities/instructions/servings and warnings',()=>{
  const scale={recipe_id:1,factor:2,base_servings:2,target_servings:4,warnings:['QA warning'],ingredients:[{...recipe.ingredients[0],scaled_quantity:4}],steps:[{...recipe.steps[0],scaled_instruction:'Add 4 cups',linked_ingredients:[]}]} as RecipeScaleResponse;
  const html=buildRecipePrintHtml(recipe,scale);
  for(const text of ['4 cups water','Add 4 cups','Servings: 4','QA warning'])expect(html).toContain(text);
  expect(html).not.toContain('2 cups water');
 });
});
