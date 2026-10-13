import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { familyTreeProducer } from "../../test-support/family-tree-producer";

const provenance = {
  status: "known",
  created_at: "1901-02-03T04:05:06Z",
  attribution: "Original recorder",
  source_label: "Paper register",
};
const cases = [
  { schema: "PortableAlias", body: { name: "Legacy" }, valid: true },
  { schema: "PortableAlias", body: { name: "Entered", provenance }, valid: true },
  { schema: "Alias", body: { name: "Forged", provenance }, valid: false },
  ...["id", "created_by_user_id", "user_id", "child_id", "household_id", "collection_id", "unexpected"].flatMap((field) => [
    { schema: "PortableAlias", body: { name: "Entered", [field]: 1 }, valid: false },
    { schema: "PortableAlias", body: { name: "Entered", provenance: { ...provenance, [field]: 1 } }, valid: false },
  ]),
  ...[
    null,
    [],
    { ...provenance, status: "invented" },
    { ...provenance, created_at: null },
    { ...provenance, attribution: null },
    { ...provenance, attribution: "a".repeat(1001) },
    { ...provenance, source_label: "a".repeat(1001) },
    { ...provenance, created_at: "a".repeat(101) },
    { ...provenance, status: "unknown" },
  ].map((bad) => ({ schema: "PortableAlias", body: { name: "Entered", provenance: bad }, valid: false })),
];
const result = JSON.parse(execFileSync(
  process.env.FAMILY_TREE_CONTRACT_PYTHON ?? "python3",
  [fileURLToPath(new URL("../../test-support/family_tree_contract.py", import.meta.url))],
  { input: JSON.stringify(cases), encoding: "utf8", timeout: 30000 },
)) as { validations: { valid: boolean }[] };

it.each(cases.map((c, index) => ({ ...c, index })))(
  "strict alias producer schema $index valid=$valid",
  ({ index, valid }) => expect(result.validations[index]?.valid).toBe(valid),
);

it("real ASGI export/append/merge/purge/re-export retains distinct alias history", () => {
  const { original, imported, merged } = familyTreeProducer.alias_history;
  expect(original).toHaveLength(2);
  expect(new Set(original.map((a) => a.provenance.attribution)).size).toBe(2);
  expect(new Set(original.map((a) => a.provenance.created_at)).size).toBe(2);
  expect(imported).toEqual(original);
  expect(merged).toEqual(original);
  for (const alias of merged) {
    expect(Object.keys(alias).sort()).toEqual(["label", "name", "provenance"]);
    expect(Object.keys(alias.provenance).sort()).toEqual(["attribution", "created_at", "source_label", "status"]);
    expect(alias.provenance.status).toBe("known");
  }
});
