import {afterEach,describe,expect,it,jest} from "@jest/globals";
import {act,renderHook,waitFor} from "@testing-library/react-native";
import {apiClient} from "../api/client";
import {useSessionBootstrap} from "./useSessionBootstrap";
const initial={csrf_token:"qa-csrf",user:{id:1,email:"qa@example.test",role:"PARENT_ADMIN" as const,household_id:1,child_id:null,is_active:true,is_household_owner:true}};
afterEach(()=>{jest.restoreAllMocks();});
describe("session clearing",()=>{
 it("clears session, module cache and current tab immediately after credential revocation",async()=>{
  jest.spyOn(apiClient,"getCurrentSession").mockResolvedValue(initial);
  const loadModules=jest.fn<()=>Promise<[]>>().mockResolvedValue([]); const setModules=jest.fn();
  const {result}=renderHook(()=>useSessionBootstrap({loadModules,setModules}));
  await waitFor(()=>expect(result.current.bootstrapping).toBe(false));
  act(()=>result.current.setActiveTab("account"));
  act(()=>result.current.clearSession("Password changed. Sign in again."));
  expect(result.current.session).toBeNull(); expect(result.current.activeTab).toBe("home");
  expect(result.current.bootstrapError).toBe("Password changed. Sign in again."); expect(setModules).toHaveBeenLastCalledWith([]);
 });
 it("clears local session even if server logout fails",async()=>{
  jest.spyOn(apiClient,"getCurrentSession").mockResolvedValue(initial);
  jest.spyOn(apiClient,"logout").mockRejectedValue(new Error("offline"));
  const loadModules=jest.fn<()=>Promise<[]>>().mockResolvedValue([]); const setModules=jest.fn();
  const {result}=renderHook(()=>useSessionBootstrap({loadModules,setModules}));
  await waitFor(()=>expect(result.current.bootstrapping).toBe(false));
  await act(async()=>{await expect(result.current.handleLogout()).rejects.toThrow("offline");});
  expect(result.current.session).toBeNull(); expect(setModules).toHaveBeenLastCalledWith([]);
 });
});
