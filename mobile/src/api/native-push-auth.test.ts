import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";
function deferred<T>() { let resolve!: (value:T)=>void; const promise=new Promise<T>(r=>{resolve=r;}); return {promise,resolve}; }
const json=(data:unknown)=>new Response(JSON.stringify(data),{headers:{"Content-Type":"application/json"}});
const session={user:{id:1,household_id:2,email:"parent@example.test",role:"PARENT",is_household_owner:false},csrf_token:"test-csrf"};
describe("session-serialized native push",()=>{
 it("holds cookie-changing login behind an in-flight native registration and rejects stale publication",async()=>{
  const response=deferred<Response>(); const fetch=vi.fn().mockResolvedValueOnce(json(session)).mockReturnValueOnce(response.promise).mockResolvedValue(json(session));
  const api=new ApiClient({fetchImpl:fetch}); await api.login({email:"one",password:"test"});
  const generation=api.authenticationGeneration;
  const registration=api.withAuthentication(generation,()=>api.createNativePushSubscription({token:"ExpoPushToken[test]",platform:"android"}));
  await Promise.resolve(); await Promise.resolve();
  const nextLogin=api.login({email:"two",password:"test"});
  expect(fetch).toHaveBeenCalledTimes(2);
  const rejected=expect(registration).rejects.toThrow("Authentication request was cancelled.");
  response.resolve(json({id:7,enabled:true,platform:"android"})); await rejected; await nextLogin;
  expect(fetch.mock.calls.map(c=>c[0])).toEqual([expect.stringContaining("/auth/login"),expect.stringContaining("/push/native/subscriptions"),expect.stringContaining("/auth/login")]);
 });
 it("does not register after a queued same-user replacement or signout",async()=>{
  const api=new ApiClient({fetchImpl:vi.fn().mockResolvedValue(json(session))});
  const generation=api.authenticationGeneration; api.clearAuthentication(); const operation=vi.fn();
  await expect(api.withAuthentication(generation,operation)).rejects.toThrow("cancelled"); expect(operation).not.toHaveBeenCalled();
 });
 it("notifies epoch listeners synchronously and removes them",()=>{
  const api=new ApiClient({fetchImpl:vi.fn()}); const changed=vi.fn(); const remove=api.subscribeAuthentication(changed);
  api.clearAuthentication(); expect(changed).toHaveBeenCalledOnce(); remove(); api.clearAuthentication(); expect(changed).toHaveBeenCalledOnce();
 });
});
