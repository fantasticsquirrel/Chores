import {File,Paths} from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {Platform} from 'react-native';
import type {RecipeBackup,RecipeDetail,RecipeScaleResponse} from '../../../api/models';
import {buildRecipePrintHtml} from './recipe-output-html';
export async function printRecipe(recipe:RecipeDetail,scale:RecipeScaleResponse|null):Promise<void>{
 await Print.printAsync({html:buildRecipePrintHtml(recipe,scale)});
}
export async function shareCookbookBackup(backup:RecipeBackup):Promise<void>{
 const json=JSON.stringify(backup,null,2);
 if(Platform.OS==='web'){
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  try{const link=document.createElement('a');link.href=url;link.download='family-manager-cookbook.json';link.click();}
  finally{setTimeout(()=>URL.revokeObjectURL(url),0);}
  return;
 }
 if(!await Sharing.isAvailableAsync())throw new Error('File sharing is not available on this device.');
 const file=new File(Paths.cache,'family-manager-cookbook.json');
 file.create({overwrite:true});file.write(json);
 // Keep the cache file available to the recipient after chooser return. A
 // subsequent explicit export overwrites it; the OS may evict this cache.
 await Sharing.shareAsync(file.uri,{mimeType:'application/json',UTI:'public.json',dialogTitle:'Export cookbook backup'});
}
