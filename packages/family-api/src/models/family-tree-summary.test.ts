import { describe, expect, it } from "vitest";
import { familyTreeProducer } from "../../test-support/family-tree-producer";
import {
  readFamilyTreeExportSummary,
  readFamilyTreeImportSummary,
  readFamilyTreeMergeSummary,
  readFamilyTreePurgeSummary,
} from "./family-tree-summary";
import type { FamilyTreeJob } from "./family-tree";
const readers = {
  export: readFamilyTreeExportSummary,
  import: readFamilyTreeImportSummary,
  merge: readFamilyTreeMergeSummary,
  purge: readFamilyTreePurgeSummary,
};
const jobs = familyTreeProducer.records
  .filter(
    (r) => r.response_model === "JobDTO" || r.response_model === "PreviewDTO",
  )
  .map((r) => r.response as FamilyTreeJob);
describe("checked display-only summaries of actual serialized transfer jobs", () => {
  it.each(jobs)(
    "accepts actual $kind $state summary without granting authority",
    (job) => {
      expect(readers[job.kind as keyof typeof readers](job)).not.toBeNull();
    },
  );
  it.each(Object.keys(readers) as (keyof typeof readers)[])(
    "rejects incomplete, wrong-kind and malformed %s summaries without inventing defaults",
    (kind) => {
      const job = jobs.find((j) => j.kind === kind)!;
      const reader = readers[kind];
      expect(reader({ ...job, summary: {} })).toBeNull();
      expect(reader({ ...job, kind: "future-kind" })).toBeNull();
      for (const key of Object.keys(job.summary)) {
        const incomplete = { ...job.summary };
        delete incomplete[key];
        expect(reader({ ...job, summary: incomplete })).toBeNull();
        expect(
          reader({
            ...job,
            summary: { ...job.summary, [key]: Symbol("invalid") },
          }),
        ).toBeNull();
      }
      expect(
        reader({
          ...job,
          summary: { ...job.summary, future_metadata: "ignored" },
        }),
      ).not.toBeNull();
    },
  );
  it("rejects invalid nested person/count/duplicate/relationship values", () => {
    const imp = jobs.find((j) => j.kind === "import")!;
    expect(
      readFamilyTreeImportSummary({
        ...imp,
        summary: { ...imp.summary, people: -1 },
      }),
    ).toBeNull();
    expect(
      readFamilyTreeImportSummary({
        ...imp,
        summary: { ...imp.summary, media: Infinity },
      }),
    ).toBeNull();
    expect(
      readFamilyTreeImportSummary({
        ...imp,
        summary: {
          ...imp.summary,
          duplicate_suggestions: [
            { source_key: "p:1", candidate_person_ids: ["1"] },
          ],
        },
      }),
    ).toBeNull();
    const merge = jobs.find((j) => j.kind === "merge")!;
    expect(
      readFamilyTreeMergeSummary({
        ...merge,
        summary: { ...merge.summary, source: { id: "1" } },
      }),
    ).toBeNull();
    expect(
      readFamilyTreeMergeSummary({
        ...merge,
        summary: {
          ...merge.summary,
          relationship_changes: [
            { table: "relationship", id: 1, endpoints: [1] },
          ],
        },
      }),
    ).toBeNull();
  });
});
