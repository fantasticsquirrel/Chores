import {afterEach,describe,expect,it,jest} from '@jest/globals';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {File} from 'expo-file-system';
import {printRecipe,shareCookbookBackup} from './recipe-output';
import type {RecipeBackup,RecipeDetail} from '../../../api/models';
jest.mock('expo-print',()=>({printAsync:jest.fn()}));
jest.mock('expo-sharing',()=>({isAvailableAsync:jest.fn(),shareAsync:jest.fn()}));
jest.mock('expo-file-system',()=>({Paths:{cache:'file:///qa-cache'},File:jest.fn().mockImplementation(()=>({uri:'file:///qa-cache/cookbook.json',create:jest.fn(),write:jest.fn()}))}));
afterEach(()=>{jest.clearAllMocks();});
describe('native cookbook document output',()=>{
 it('opens a native print dialog with escaped printable recipe content',async()=>{
  await printRecipe({title:'Soup',description:'',servings:2,prep_minutes:null,cook_minutes:null,ingredients:[],steps:[],components:[],notes:''} as unknown as RecipeDetail,null);
  expect(Print.printAsync).toHaveBeenCalledWith({html:expect.stringContaining('<h1>Soup</h1>')});
 });
 it('shares a real JSON file rather than silently truncating recipes into text',async()=>{
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  const backup:RecipeBackup={version:1,recipes:[]};
  await shareCookbookBackup(backup);
  const file=jest.mocked(File).mock.results[0].value as {uri:string;write:ReturnType<typeof jest.fn>};
  expect(file.write).toHaveBeenCalledWith(JSON.stringify(backup,null,2));
  expect(Sharing.shareAsync).toHaveBeenCalledWith(file.uri,expect.objectContaining({mimeType:'application/json'}));
 });
 it('reports unavailable sharing instead of claiming export success',async()=>{
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
  await expect(shareCookbookBackup({version:1,recipes:[]})).rejects.toThrow('File sharing is not available on this device.');
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
 });
});
