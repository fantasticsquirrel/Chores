import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { familyTreeCases } from "../../test-support/family-tree-cases";

// This is a schema-to-type translator ONLY for contract tests, not shipped DTOs.
// Read the current producer each run: no manually maintained schema snapshot.
interface Schema {
  $ref?: string;
  anyOf?: Schema[];
  enum?: unknown[];
  const?: unknown;
  type?: string;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: Schema | boolean;
  propertyNames?: { enum?: string[] };
}
const probe = fileURLToPath(
  new URL("../../test-support/family_tree_contract.py", import.meta.url),
);
const producer = JSON.parse(
  execFileSync(process.env.FAMILY_TREE_CONTRACT_PYTHON ?? "python3", [probe], {
    input: "[]",
    encoding: "utf8",
    timeout: 30000,
  }),
) as { schemas: Record<string, Schema>; error_examples: unknown[] };

const inputModels: Record<string, string> = {
  DomainErrorDetail: "FamilyTreeErrorDetail",
  DomainErrorResponse: "FamilyTreeErrorResponse",
  PartialDate: "FamilyTreePartialDateInput",
  Alias: "FamilyTreeAliasInput",
  PersonFields: "FamilyTreePersonInput",
  PersonCreate: "FamilyTreePersonInput",
  PersonPatch: "FamilyTreePersonChanges",
  Command: "FamilyTreeCommand",
  CreatePerson: "FamilyTreeCreatePersonRequest",
  PatchPerson: "FamilyTreePatchPersonRequest",
  ReasonCommand: "FamilyTreeReasonCommand",
  Citation: "FamilyTreeCitationInput",
  DatedCitation: "FamilyTreeDatedCitationInput",
  ParentData: "FamilyTreeParentData",
  CareData: "FamilyTreeCareData",
  PartnerData: "FamilyTreePartnerData",
  CreateParent: "FamilyTreeCreateParentLinkRequest",
  CreateCare: "FamilyTreeCreateCareLinkRequest",
  CreatePartner: "FamilyTreeCreatePartnerEpisodeRequest",
  ParentChanges: "FamilyTreeParentChanges",
  CareChanges: "FamilyTreeCareChanges",
  PartnerChanges: "FamilyTreePartnerChanges",
  PatchParent: "FamilyTreePatchParentLinkRequest",
  PatchCare: "FamilyTreePatchCareLinkRequest",
  PatchPartner: "FamilyTreePatchPartnerEpisodeRequest",
  RelativeRelationship: "FamilyTreeRelativeRelationship",
  CreateRelative: "FamilyTreeCreateRelativeRequest",
  StoryData: "FamilyTreeStoryInput",
  StoryChanges: "FamilyTreeStoryChanges",
  CreateStory: "FamilyTreeCreateStoryRequest",
  PatchStory: "FamilyTreePatchStoryRequest",
  ReorderStories: "FamilyTreeReorderStoriesRequest",
  ResidenceData: "FamilyTreeResidenceInput",
  ResidenceChanges: "FamilyTreeResidenceChanges",
  CreateResidence: "FamilyTreeCreateResidenceRequest",
  PatchResidence: "FamilyTreePatchResidenceRequest",
  LinkIdentity: "FamilyTreeLinkIdentityRequest",
};
const outputModels: Record<string, string> = {
  PartialDate: "FamilyTreePartialDate",
  AliasDTO: "FamilyTreeAlias",
  Citation: "FamilyTreeCitation",
  DatedCitation: "FamilyTreeDatedCitation",
  Affected: "FamilyTreeAffected",
  MutationResult: "FamilyTreeMutationResult",
  Capabilities: "FamilyTreeCapabilities",
  CollectionState: "FamilyTreeCollectionState",
  PersonDTO: "FamilyTreePerson",
  IdentityDTO: "FamilyTreeIdentityLink",
  ParentDTO: "FamilyTreeParentLink",
  CareDTO: "FamilyTreeCareLink",
  PartnerDTO: "FamilyTreePartnerEpisode",
  StoryDTO: "FamilyTreeStory",
  ResidenceDTO: "FamilyTreeResidence",
  PersonDetail: "FamilyTreePersonDetail",
  PeoplePage: "FamilyTreePeoplePage",
  StoriesPage: "FamilyTreeStoriesPage",
  ResidencesPage: "FamilyTreeResidencesPage",
  IdentityCandidate: "FamilyTreeIdentityCandidate",
  IdentityCandidates: "FamilyTreeIdentityCandidates",
  GraphNode: "FamilyTreeGraphNode",
  GraphEdge: "FamilyTreeGraphEdge",
  ProjectionLimits: "FamilyTreeProjectionLimits",
  GraphProjection: "FamilyTreeGraphProjection",
  CompareResult: "FamilyTreeCompareResult",
};
function schemaType(schema: Schema, output: boolean): string {
  const prefix = output ? "Output" : "Input";
  if (schema.$ref) return `${prefix}_${schema.$ref.split("/").at(-1)}`;
  if (schema.anyOf)
    return schema.anyOf.map((s) => schemaType(s, output)).join(" | ");
  if ("const" in schema) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (schema.type === "array")
    return `Array<${schemaType(schema.items!, output)}>`;
  if (schema.type === "object") {
    if (schema.properties)
      return `{ ${Object.entries(schema.properties)
        .map(
          ([key, value]) =>
            `${JSON.stringify(key)}${output || schema.required?.includes(key) ? "" : "?"}: ${schemaType(value, output)};`,
        )
        .join(" ")} }`;
    if (typeof schema.additionalProperties === "object") {
      const keys =
        schema.propertyNames?.enum?.map((k) => JSON.stringify(k)).join(" | ") ??
        "string";
      return `Record<${keys}, ${schemaType(schema.additionalProperties, output)}>`;
    }
    throw new Error("Unhandled object contract");
  }
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (["string", "boolean", "null"].includes(schema.type ?? ""))
    return schema.type!;
  throw new Error(`Unhandled producer schema: ${JSON.stringify(schema)}`);
}
function contractSource(schemas: Record<string, Schema>): string {
  const definitions = Object.entries(schemas)
    .flatMap(([name, schema]) => [
      `type Input_${name} = ${schemaType(schema, false)};`,
      `type Output_${name} = ${schemaType(schema, true)};`,
    ])
    .join("\n");
  const checks = [
    [inputModels, "Input"],
    [outputModels, "Output"],
  ] as const;
  return (
    `import type * as DTO from "./family-tree";\n${definitions}\n
    type Normalize<T> = T extends readonly unknown[] ? { [K in keyof T]: Normalize<T[K]> } : T extends object ? { [K in keyof T]: Normalize<T[K]> } : T;
    type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
    type Assert<T extends true> = T;\n` +
    checks
      .flatMap(([mapping, prefix]) =>
        Object.entries(mapping).map(
          ([name, dto]) =>
            `type Check_${prefix}_${name} = Assert<Equal<Normalize<${prefix}_${name}>, Normalize<DTO.${dto}>>>;`,
        ),
      )
      .join("\n")
  );
}
function compile(source: string): string[] {
  // Virtual file lives next to the real model. No repository temp artifacts.
  const filename = fileURLToPath(
    new URL("./family-tree.schema-probe.ts", import.meta.url),
  );
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: ["node", "vite/client"],
  };
  const host = ts.createCompilerHost(options);
  const originalGet = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) =>
    name === filename
      ? ts.createSourceFile(name, source, languageVersion, true)
      : originalGet(name, languageVersion, onError, shouldCreate);
  return ts
    .getPreEmitDiagnostics(ts.createProgram([filename], options, host))
    .map((d) => {
      const location =
        d.file && d.start !== undefined
          ? d.file.getLineAndCharacterOfPosition(d.start)
          : undefined;
      return `${location ? `${d.file?.fileName}:${location.line + 1}: ${d.file?.text.split("\n")[location.line]}: ` : ""}${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`;
    });
}

describe("Family Tree DTO parity with executable Pydantic schemas", () => {
  it("matches every current producer DTO's exact fields, optionality, nullability, nesting and literal unions", () => {
    expect(Object.keys({ ...inputModels, ...outputModels }).sort()).toEqual(
      Object.keys(producer.schemas).sort(),
    );
    const errorExamples = producer.error_examples
      .map(
        (example, i) =>
          `const error_${i}: DTO.FamilyTreeErrorResponse = ${JSON.stringify(example)};`,
      )
      .join("\n");
    expect(
      compile(contractSource(producer.schemas) + "\n" + errorExamples),
    ).toEqual([]);
  }, 30000);
  it("exposes exact typed responses through both real clients and platform/public model exports", () => {
    const checks = familyTreeCases
      .map((c) => {
        const response = "response" in c ? c.response : "MutationResult";
        const dto = outputModels[response!];
        return ["Shared", "Web", "Native"]
          .map(
            (owner) =>
              `type ${owner}_${c.name} = Assert<Equal<Normalize<Awaited<ReturnType<${owner}["${c.name}"]>>>, Normalize<DTO.${dto}>>>;`,
          )
          .join("\n");
      })
      .join("\n");
    const source =
      contractSource(producer.schemas) +
      `
      import type { FamilyTreeApiEndpoints as Shared } from "../endpoints/family-tree";
      import type { ApiClient as Web } from "../../../../frontend/src/api/client";
      import type { ApiClient as Native } from "../../../../mobile/src/api/client";
      import type * as WebModels from "../../../../frontend/src/api/models";
      import type * as NativeModels from "../../../../mobile/src/api/models";
      import type * as PublicModels from "../index";
      type PublicExport = Assert<Equal<DTO.FamilyTreePersonDetail, PublicModels.FamilyTreePersonDetail>>;
      type WebExport = Assert<Equal<DTO.FamilyTreePersonDetail, WebModels.FamilyTreePersonDetail>>;
      type NativeExport = Assert<Equal<DTO.FamilyTreePersonDetail, NativeModels.FamilyTreePersonDetail>>;
      ${checks}
    `;
    expect(compile(source)).toEqual([]);
  }, 30000);
  it("detects a real field-type drift rather than accepting unchecked fixtures", () => {
    const changed = structuredClone(producer.schemas);
    changed.GraphEdge.properties!.id = { type: "integer" };
    expect(compile(contractSource(changed)).join("\n")).toContain(
      "does not satisfy the constraint 'true'",
    );
  }, 30000);
  it("executes negative caller typing for required idempotency/revision, typed relationships and nonnullable person lists", () => {
    const source = `import type * as DTO from "./family-tree";
      const person: DTO.FamilyTreeCreatePersonRequest = { expected_graph_revision: 0, idempotency_key: "p", person: { display_name: "Ada" } };
      // @ts-expect-error creation requires idempotency
      const missingKey: DTO.FamilyTreeCreatePersonRequest = { expected_graph_revision: 0, person: { display_name: "Ada" } };
      // @ts-expect-error story creation requires idempotency
      const missingStoryKey: DTO.FamilyTreeCreateStoryRequest = { expected_graph_revision: 0, story: { title: "Life", body_md: "Text" } };
      // @ts-expect-error relative creation requires idempotency
      const missingRelativeKey: DTO.FamilyTreeCreateRelativeRequest = { expected_graph_revision: 0, anchor_person_id: 1, person: {}, relationship: { direction: "parent", kind: "biological" } };
      // @ts-expect-error all commands require revision
      const missingRevision: DTO.FamilyTreeCommand = {};
      // @ts-expect-error parent facts cannot be a care relationship
      const parent: DTO.FamilyTreeCreateParentLinkRequest = { expected_graph_revision: 0, parent_person_id: 1, child_person_id: 2, kind: "guardian" };
      // @ts-expect-error care facts cannot be a partnership
      const care: DTO.FamilyTreeCreateCareLinkRequest = { expected_graph_revision: 0, caregiver_person_id: 1, recipient_person_id: 2, kind: "married" };
      // @ts-expect-error partners cannot have a parent kind
      const partner: DTO.FamilyTreeCreatePartnerEpisodeRequest = { expected_graph_revision: 0, person_a_id: 1, person_b_id: 2, kind: "adoptive" };
      // @ts-expect-error confirmation is literal true
      const confirmation: DTO.FamilyTreeLinkIdentityRequest = { expected_graph_revision: 0, user_id: 1, confirmed: false };
      // @ts-expect-error only the explicit review token is allowed
      const review: DTO.FamilyTreeCommand = { expected_graph_revision: 0, reviewed_warnings: ["guessed"] };
      // @ts-expect-error aliases cannot be explicitly null
      const nullAliases: DTO.FamilyTreePersonChanges = { aliases: null };
      const clearFact: DTO.FamilyTreePersonChanges = { birth_date: null };
      const omitFact: DTO.FamilyTreePersonChanges = { display_name: "Ada" };
      // @ts-expect-error comparison must identify both people
      const compare: DTO.FamilyTreeCompareParams = { person_a_id: 1 };
      const graph: DTO.FamilyTreeGraphParams = { collapsed_up_ids: [1, 2] as const, include_history: false, down_depth: 0 };
    `;
    expect(compile(source)).toEqual([]);
  }, 30000);
});
