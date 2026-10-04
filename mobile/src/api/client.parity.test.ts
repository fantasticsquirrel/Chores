import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";

const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });

describe("mobile cookbook transport parity", () => {
  it("exposes recipe reads and scaling through the native transport", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => response({}));
    const client = new ApiClient({baseUrl: "https://family.example.test/chore-api", fetchImpl});
    await client.listRecipes({query: "bread", favorite: true});
    await client.getRecipe(7);
    await client.scaleRecipe(7, {targetServings: 8});
    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual([
      "https://family.example.test/chore-api/recipes?query=bread&favorite=true",
      "https://family.example.test/chore-api/recipes/7",
      "https://family.example.test/chore-api/recipes/7/scale?target_servings=8",
    ]);
  });

  it("sends recipe mutations with the current native session CSRF token", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => response({csrf_token: "test-csrf", user: {id: 2}}));
    const client = new ApiClient({baseUrl: "https://family.example.test/chore-api", fetchImpl});
    await client.login({email: "parent@example.test", password: "fixture"});
    await client.createRecipe({title: "Bread", servings: 4});
    await client.updateRecipe(7, {title: "Bread", servings: 6});
    await client.duplicateRecipe(7, {as_variant: true});
    await client.upsertRecipeFeedback(7, {reviewer_type: "PARENT", parent_user_id: 2, rating: 4});
    await client.deleteRecipe(7);
    for(const [, init] of fetchImpl.mock.calls.slice(1)) expect(init).toMatchObject({credentials: "include", headers: {"X-CSRF-Token": "test-csrf"}});
    expect(fetchImpl.mock.calls.at(-1)?.[1].method).toBe("DELETE");
  });
});
