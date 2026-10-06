import { describe, expect, it, vi } from "vitest";
import { NativePushController, type NativePushRuntime } from "./nativePushController";
import type { AuthSessionResponse, FamilyModule, NotificationItem } from "../../../api/models";
const session:AuthSessionResponse={user:{id:1,household_id:2,role:"PARENT",email:"test@example.test",is_household_owner:false}};
const item:NotificationItem={id:7,module_key:"chores",title:"private",body:"private",category:"test",severity:"info",link_url:"/chore/board",read_at:null,created_at:"2026-01-01",expires_at:null};
const deferred=<T>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};};
const chores:FamilyModule={key:"chores",name:"Chores",description:"",can_manage:false};
function setup(overrides:Partial<NativePushRuntime>={}, modules:FamilyModule[]=[chores]) {
 let rows=[{id:5,platform:"android" as const,enabled:true}]; let auth=0; let invalidated=()=>{};
 let response:(data:unknown)=>void=()=>{}; let rotate:()=>void=()=>{};let received:()=>void=()=>{};
 const remove=vi.fn(); const runtime:NativePushRuntime={platform:"android",projectId:"53bf095d-ad94-4ad4-a619-609c57026257",isDevice:true,
  channel:vi.fn(async()=>{}),permission:vi.fn(async()=>true),requestPermission:vi.fn(async()=>true),token:vi.fn(async()=>"ExpoPushToken[test]"),
  listen:vi.fn((r,t,f)=>{response=r;rotate=t;received=f;return remove;}),lastResponse:vi.fn(async()=>null),...overrides};
 const api={get authenticationGeneration(){return auth;},subscribeAuthentication:vi.fn((listener:()=>void)=>{invalidated=listener;return vi.fn();}),
  withAuthentication:vi.fn(async<T>(_g:number,operation:()=>Promise<T>,current:()=>boolean)=>{if(!current())throw Error(); return operation();}),
  getNativePushConfig:vi.fn(async()=>({enabled:true})),listNativePushSubscriptions:vi.fn(async()=>({items:rows})),
  createNativePushSubscription:vi.fn(async()=>{rows=[{id:6,platform:"android",enabled:true}];return rows[0];}),
  deleteNativePushSubscription:vi.fn(async(id:number)=>{rows=rows.filter(row=>row.id!==id);}),getNotificationSettings:vi.fn(async()=>({chores:{push_enabled:true}})),
  updateNotificationSettings:vi.fn(async()=>{api.getNotificationSettings.mockResolvedValue({chores:{push_enabled:true}});}),listNotifications:vi.fn(async()=>({items:[item],unread_count:1}))};
 const publish=vi.fn();const navigate=vi.fn();const loader=vi.fn(async()=>runtime);
 const c=new NativePushController({api:api as never,session,modules:()=>modules,loadRuntime:loader,onState:publish,onNavigate:navigate});
 return {c,api,runtime,publish,navigate,loader,remove,replace:()=>{auth++;invalidated();},response:(v:unknown)=>response(v),rotate:()=>rotate(),received:()=>received(),setRows:(v:typeof rows)=>{rows=v;}};
}
describe("native push controller",()=>{
 it("retains independently verified registration ownership when OS permission is denied and revokes only the session",async()=>{
  const s=setup({permission:vi.fn(async()=>false)});await s.c.start();
  expect(s.c.state).toMatchObject({status:"off",hasRegistration:true});expect(s.c.state.message).toMatch(/permission.*blocked.*registered/i);
  expect(s.runtime.requestPermission).not.toHaveBeenCalled();expect(s.runtime.token).not.toHaveBeenCalled();expect(s.api.createNativePushSubscription).not.toHaveBeenCalled();
  await s.c.disable();expect(s.api.deleteNativePushSubscription).toHaveBeenCalledWith(5);expect(s.api.listNativePushSubscriptions).toHaveBeenCalledTimes(3);
  expect(s.c.state).toMatchObject({status:"off",hasRegistration:false});expect(s.api.updateNotificationSettings).not.toHaveBeenCalled();
 });
 it("preserves verified registration ownership through failed policy reads and deletion readback",async()=>{
  const s=setup();s.api.getNotificationSettings.mockRejectedValue(new Error("offline"));await s.c.start();
  expect(s.c.state).toMatchObject({status:"error",hasRegistration:true});
  s.api.deleteNativePushSubscription.mockImplementation(async()=>{});await s.c.disable();expect(s.c.state).toMatchObject({status:"error",hasRegistration:true});
 });
 it("rotates a verified registration after partial Enable failure without treating unverified delivery status as revoked consent",async()=>{
  const s=setup();s.setRows([]);s.api.getNotificationSettings.mockResolvedValue({chores:{push_enabled:false}});s.api.updateNotificationSettings.mockRejectedValueOnce(new Error("offline"));
  await s.c.start();await s.c.enable();expect(s.c.state).toMatchObject({status:"error",hasRegistration:true});
  s.rotate();await vi.waitFor(()=>expect(s.api.createNativePushSubscription).toHaveBeenCalledTimes(2));
  expect(s.runtime.requestPermission).toHaveBeenCalledOnce();expect(s.api.updateNotificationSettings).toHaveBeenCalledOnce();
  await vi.waitFor(()=>expect(s.c.state.busy).toBe(false));expect(s.c.state.status).toBe("error");
 });
 it("keeps partial preference activation failure off across repeated read-only Retry, then recovers by explicit Enable",async()=>{
  const s=setup();s.setRows([]);s.api.getNotificationSettings.mockResolvedValue({chores:{push_enabled:false}});
  s.api.updateNotificationSettings.mockRejectedValueOnce(new Error("preference activation failed"));
  await s.c.start();await s.c.enable();expect(s.c.state.status).toBe("error");
  const prompts=vi.mocked(s.runtime.requestPermission).mock.calls.length;
  const tokens=vi.mocked(s.runtime.token).mock.calls.length;
  const registrations=s.api.createNativePushSubscription.mock.calls.length;
  const writes=s.api.updateNotificationSettings.mock.calls.length;
  await s.c.refresh();await s.c.refresh();
  expect(s.c.state.status).toBe("off");expect(s.c.state.message).toMatch(/registered.*preferences.*off/i);
  expect(s.api.getNotificationSettings).toHaveBeenCalledTimes(4);
  expect(s.runtime.requestPermission).toHaveBeenCalledTimes(prompts);expect(s.runtime.token).toHaveBeenCalledTimes(tokens);
  expect(s.api.createNativePushSubscription).toHaveBeenCalledTimes(registrations);expect(s.api.updateNotificationSettings).toHaveBeenCalledTimes(writes);
  await s.c.enable();expect(s.c.state.status).toBe("enabled");
 });
 it("does not call a registered device enabled when accessible push preferences are off on startup",async()=>{
  const s=setup();s.api.getNotificationSettings.mockResolvedValue({chores:{push_enabled:false}});await s.c.start();
  expect(s.c.state.status).toBe("off");expect(s.api.getNotificationSettings).toHaveBeenCalledOnce();
  expect(s.runtime.requestPermission).not.toHaveBeenCalled();expect(s.runtime.token).not.toHaveBeenCalled();expect(s.api.updateNotificationSettings).not.toHaveBeenCalled();
 });
 it("does not publish enabled when preferences cannot be verified",async()=>{
  const s=setup();s.api.getNotificationSettings.mockRejectedValue(new Error("offline"));await s.c.start();await s.c.refresh();
  expect(s.c.state.status).toBe("error");expect(s.runtime.requestPermission).not.toHaveBeenCalled();expect(s.runtime.token).not.toHaveBeenCalled();
 });
 it("requires only one accessible configured push policy, not opt-in to every module",async()=>{
  const s=setup({},[chores,{...chores,key:"homeschool"}]);
  s.api.getNotificationSettings.mockResolvedValue({chores:{push_enabled:true},homeschool:{push_enabled:false}} as never);
  await s.c.start();expect(s.c.state.status).toBe("enabled");expect(s.api.getNotificationSettings).toHaveBeenCalledOnce();expect(s.api.updateNotificationSettings).not.toHaveBeenCalled();
 });
 it.each([{modules:[]},{modules:[chores]}])("does not enable when no accessible module has a configured push channel: %j",async ({modules})=>{
  const s=setup({},modules);s.api.getNotificationSettings.mockResolvedValue({homeschool:{push_enabled:true}} as never);
  await s.c.start();expect(s.c.state.status).toBe("off");await s.c.enable();expect(s.c.state.status).toBe("error");expect(s.api.updateNotificationSettings).not.toHaveBeenCalled();
 });
 it("rejects preference readback that still has no enabled accessible channel",async()=>{
  const s=setup();s.api.getNotificationSettings.mockResolvedValue({chores:{push_enabled:false}});s.api.updateNotificationSettings.mockImplementation(async()=>{});
  await s.c.start();await s.c.enable();expect(s.c.state.status).toBe("error");
 });
 it.each(["config", "runtime"])("recovers a temporary %s failure by refreshing without permission prompt or registration",async failure=>{
  const s=setup();
  if(failure==="config") s.api.getNativePushConfig.mockRejectedValueOnce(new Error("private server detail"));
  else s.loader.mockRejectedValueOnce(new Error("private SDK detail"));
  await s.c.start();expect(s.c.state.status).toBe("error");expect(s.c.state.message).not.toContain("private");
  await s.c.refresh();expect(s.c.state.status).toBe("enabled");expect(s.c.state.busy).toBe(false);
  expect(s.runtime.requestPermission).not.toHaveBeenCalled();expect(s.runtime.token).not.toHaveBeenCalled();expect(s.api.createNativePushSubscription).not.toHaveBeenCalled();
 });
 it("cleans listeners before retrying a failed permission read",async()=>{
  const s=setup();vi.mocked(s.runtime.permission).mockRejectedValueOnce(new Error("temporary"));
  await s.c.start();expect(s.c.state.status).toBe("error");await s.c.refresh();
  expect(s.remove).toHaveBeenCalledOnce();expect(s.runtime.listen).toHaveBeenCalledTimes(2);expect(s.c.state.status).toBe("enabled");
  expect(s.runtime.requestPermission).not.toHaveBeenCalled();expect(s.api.createNativePushSubscription).not.toHaveBeenCalled();
 });
 it("bounds concurrent retries and ignores completion after authentication replacement",async()=>{
  const s=setup();await s.c.start();const pending=deferred<{enabled:boolean}>();s.api.getNativePushConfig.mockReturnValueOnce(pending.promise);
  const retry=s.c.refresh();expect(s.c.state.busy).toBe(true);await s.c.refresh();await s.c.enable();
  expect(s.api.getNativePushConfig).toHaveBeenCalledTimes(2);expect(s.api.createNativePushSubscription).not.toHaveBeenCalled();
  s.replace();const count=s.publish.mock.calls.length;pending.resolve({enabled:true});await retry;
  expect(s.publish).toHaveBeenCalledTimes(count);expect(s.c.state.status).toBe("signed-out");expect(s.runtime.listen).toHaveBeenCalledOnce();expect(s.remove).toHaveBeenCalledOnce();
 });
 it("rechecks an unavailable server without opting in",async()=>{
  const s=setup();s.setRows([]);s.api.getNativePushConfig.mockResolvedValueOnce({enabled:false});await s.c.start();expect(s.c.state.status).toBe("unavailable");
  await s.c.refresh();expect(s.c.state.status).toBe("off");expect(s.runtime.requestPermission).not.toHaveBeenCalled();expect(s.api.createNativePushSubscription).not.toHaveBeenCalled();
 });
 it("reads current status without prompting or registration, then performs opt-in channel before permission and verifies receipt/inventory/preferences",async()=>{
  const s=setup();s.api.getNotificationSettings.mockResolvedValue({chores:{push_enabled:false}});await s.c.start();expect(s.api.createNativePushSubscription).not.toHaveBeenCalled();expect(s.runtime.requestPermission).not.toHaveBeenCalled();
  await s.c.enable();expect(s.runtime.channel).toHaveBeenCalledOnce();expect(vi.mocked(s.runtime.channel).mock.invocationCallOrder[0]).toBeLessThan((s.runtime.requestPermission as any).mock.invocationCallOrder[0]);
  expect(s.runtime.token).toHaveBeenCalledOnce();expect(s.api.createNativePushSubscription).toHaveBeenCalledWith({token:"ExpoPushToken[test]",platform:"android"});
  expect(s.api.updateNotificationSettings).toHaveBeenCalledWith("chores",{push_enabled:true});expect(s.c.state.status).toBe("enabled");
 });
 it("permission denial never obtains or registers a token",async()=>{const s=setup({requestPermission:vi.fn(async()=>false)});await s.c.start();await s.c.enable();expect(s.c.state.status).toBe("unavailable");expect(s.runtime.token).not.toHaveBeenCalled();expect(s.api.createNativePushSubscription).not.toHaveBeenCalled();});
 it.each([{projectId:null},{isDevice:false}])("truthfully refuses missing project or virtual device %j",async overrides=>{const s=setup(overrides);await s.c.start();await s.c.enable();expect(s.c.state.status).toBe("unavailable");expect(s.runtime.requestPermission).not.toHaveBeenCalled();});
 it("disabled backend config prevents native registration",async()=>{const s=setup();s.api.getNativePushConfig.mockResolvedValue({enabled:false});await s.c.start();await s.c.enable();expect(s.c.state.status).toBe("unavailable");expect(s.api.createNativePushSubscription).not.toHaveBeenCalled();});
 it("locks repeat taps, cancels registration completion and prevents old preferences/readback after same-user replacement",async()=>{const s=setup();await s.c.start();const pending=deferred<any>();s.api.createNativePushSubscription.mockReturnValue(pending.promise);const first=s.c.enable();await vi.waitFor(()=>expect(s.api.createNativePushSubscription).toHaveBeenCalledOnce());await s.c.enable();s.replace();pending.resolve({id:6,platform:"android",enabled:true});await first;expect(s.remove).toHaveBeenCalledOnce();expect(s.c.state.status).toBe("signed-out");expect(s.api.updateNotificationSettings).not.toHaveBeenCalled();});
 it("disable deletes session registrations and verifies absence, without disabling global/web preferences",async()=>{const s=setup();await s.c.start();await s.c.disable();expect(s.api.deleteNativePushSubscription).toHaveBeenCalledWith(5);expect(s.api.listNativePushSubscriptions).toHaveBeenCalledTimes(3);expect(s.api.updateNotificationSettings).not.toHaveBeenCalled();expect(s.c.state.status).toBe("off");});
 it("retained registrations on readback are not success",async()=>{const s=setup();await s.c.start();s.api.deleteNativePushSubscription.mockImplementation(async()=>{});await s.c.disable();expect(s.c.state.status).toBe("error");});
 it("deferred disable cannot publish after logout/unmount",async()=>{const s=setup();await s.c.start();const pending=deferred<void>();s.api.deleteNativePushSubscription.mockReturnValue(pending.promise);const operation=s.c.disable();await vi.waitFor(()=>expect(s.api.deleteNativePushSubscription).toHaveBeenCalled());s.c.dispose();const count=s.publish.mock.calls.length;pending.resolve();await operation;expect(s.publish).toHaveBeenCalledTimes(count);expect(s.api.updateNotificationSettings).not.toHaveBeenCalled();});
 it("rotates only opted-in registrations with cleanup/readback, never re-prompts permissions",async()=>{const s=setup();await s.c.start();s.rotate();await vi.waitFor(()=>expect(s.api.createNativePushSubscription).toHaveBeenCalledOnce());expect(s.api.deleteNativePushSubscription).toHaveBeenCalledWith(5);expect(s.runtime.requestPermission).not.toHaveBeenCalled();});
 it("tap fetches authenticated inbox, ignores URL payloads and routes same allowlist with role/grants",async()=>{const s=setup();await s.c.start();s.response({notification_id:7,url:"https://evil.test"});await Promise.resolve();expect(s.navigate).not.toHaveBeenCalled();s.response({notification_id:7});await vi.waitFor(()=>expect(s.navigate).toHaveBeenCalledWith("review"));expect(s.api.listNotifications).toHaveBeenCalledWith({unread:0,limit:200});});
 it("foreign/unavailable inbox ID never routes",async()=>{const s=setup();await s.c.start();s.response({notification_id:900});await vi.waitFor(()=>expect(s.api.listNotifications).toHaveBeenCalled());expect(s.navigate).not.toHaveBeenCalled();});
 it("late cold-start response cannot override newer response or route after actor replacement",async()=>{const pending=deferred<any>();const s=setup({lastResponse:vi.fn(()=>pending.promise)});await s.c.start();s.response({notification_id:900});s.replace();pending.resolve({notification_id:7});await Promise.resolve();expect(s.navigate).not.toHaveBeenCalled();});
 it("foreground presentation is generic, opt-in only and contains no inbox content",async()=>{const s=setup();await s.c.start();s.received();expect(s.c.state.message).toBe("You have a household notification.");await s.c.disable();s.received();expect(s.c.state.message).not.toContain("private");expect(s.c.state.status).toBe("off");});
});
