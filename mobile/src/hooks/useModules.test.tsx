import {afterEach,describe,expect,it,jest} from '@jest/globals';
import {act,renderHook} from '@testing-library/react-native';
import {apiClient} from '../api/client';
import type {FamilyModule} from '../api/models';
import {useModules} from './useModules';
const old:FamilyModule[]=[{key:'chores',name:'Chores',description:'',can_manage:true}];
const next:FamilyModule[]=[{key:'recipes',name:'Recipes',description:'',can_manage:false}];
afterEach(()=>{jest.restoreAllMocks();});
describe('module cache request ownership',()=>{
 it('does not restore grants after the authenticated cache is cleared',async()=>{
  let release!:(value:{modules:FamilyModule[]})=>void;
  const pending=new Promise<{modules:FamilyModule[]}>(resolve=>{release=resolve;});
  jest.spyOn(apiClient,'getMyModules').mockReturnValue(pending);
  const {result}=renderHook(()=>useModules());let load!:Promise<FamilyModule[]>;
  act(()=>{load=result.current.loadModules();});act(()=>{result.current.setModules([]);});
  await act(async()=>{release({modules:old});await load;});expect(result.current.modules).toEqual([]);
 });
 it('keeps newer grants when an older refresh completes later',async()=>{
  let release!:(value:{modules:FamilyModule[]})=>void;
  const pending=new Promise<{modules:FamilyModule[]}>(resolve=>{release=resolve;});
  jest.spyOn(apiClient,'getMyModules').mockReturnValueOnce(pending).mockResolvedValueOnce({modules:next});
  const {result}=renderHook(()=>useModules());let load!:Promise<FamilyModule[]>;
  act(()=>{load=result.current.loadModules();});await act(async()=>{await result.current.loadModules();});
  await act(async()=>{release({modules:old});await load;});expect(result.current.modules).toEqual(next);
 });
});
