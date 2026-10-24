import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { readdirSync } from "node:fs";
import { it, expect } from "vitest";
import {
  parseScene,
  type Scene,
} from "../../../frontend/src/features/discovery-lab/packages/bridge";
function worker(id: string) {
  const code = buildSync({
    entryPoints: [`scripts/exploration-packages/${id}/worker.ts`],
    bundle: true,
    minify: true,
    format: "iife",
    write: false,
  }).outputFiles[0].text;
  let output: any,
    previous: Scene | null = null;
  const assets = new Set<string>();
  try {
    for (const f of readdirSync(`scripts/exploration-packages/${id}/assets`))
      assets.add("assets/" + f);
  } catch {
    /* no images */
  }
  const context: any = {
    structuredClone,
    console,
    postMessage: (x: any) => {
      output = x;
    },
  };
  context.self = context;
  runInNewContext(code, context);
  return (control?: string, value?: number) => {
    context.onmessage({
      data: {
        type: control ? "control" : "reset",
        control,
        values: control ? { [control]: value ?? 1 } : {},
      },
    });
    const parsed = parseScene(output, "rich", assets, previous);
    expect(parsed, `${id}: ${control ?? "reset"}`).not.toBeNull();
    previous = parsed;
    return parsed!;
  };
}
it("fraction slice selection remains in range after reducing the denominator", () => {
  const send = worker("fraction-feast");
  send();
  send("denominator", 7);
  send("slice", 24);
  send("denominator", 0);
  send("numerator", 2);
  const output = send("toggleSlice");
  const numerator = output.controls.find((c) => c.id === "numerator")!;
  expect(numerator.value).toBeLessThanOrEqual(numerator.max);
}, 30000);
it("guided unlike-fraction comparison cannot accidentally test the default equal halves", () => {
  const send = worker("fraction-feast");
  send();
  send("trialSum");
  send("predictDifferent");
  const result = send("compare");
  expect(result.description).not.toContain("Sum 1/1");
}, 30000);
it("guided sample extension never claims 1000 when only 990 draws were made", () => {
  const send = worker("chance-carnival");
  send();
  send("predictNo");
  const result = send("compare");
  expect(result.description).not.toContain("990 trials");
}, 30000);
it("photosynthesis evidence does not claim zero activity after restoring water", () => {
  const send = worker("photosynthesis");
  send();
  send("predictNo");
  send("test");
  const result = send("water", 80);
  expect(result.description).not.toContain("Relative activity 0 /");
  expect(result.sections?.[1].text).not.toContain("Relative activity is zero");
}, 30000);
it("Moon test evidence is invalidated when the observation changes", () => {
  const send = worker("moon-phases");
  send();
  send("predict50");
  send("test");
  const result = send("angle", 180);
  expect(result.sections?.[2].text).not.toContain("Your prediction matches:");
}, 30000);
it("changing a controlled variable clears stale fixed numerical comparison evidence", () => {
  const send = worker("machine-workshop");
  send();
  send("predict_0");
  send("baseline");
  send("comparison");
  const result = send("loadKg", 100);
  expect(result.description).toContain("Input work 490.5 J");
  expect(result.sections?.[2].text).not.toContain("both 196.2 J");
}, 30000);
it("wrong Moon and orbit predictions never receive a matching-prediction reward", () => {
  for (const [topic, wrong, right] of [
    ["moon-phases", "predict0", "predict50"],
    ["orbital-mechanics", "predict0", "predict1"],
  ]) {
    const send = worker(topic);
    send();
    send(wrong);
    const wrongResult = send("test");
    expect(wrongResult.sections?.map((s) => s.text).join(" ")).not.toContain(
      "Your prediction matches:",
    );
    send();
    send(right);
    const rightResult = send("test");
    expect(rightResult.sections?.map((s) => s.text).join(" ")).toContain(
      "Your prediction matches:",
    );
  }
}, 30000);
