import { describe, it, expect } from "vitest";
import {
  initialDraft,
  formPayload,
  personFields,
  storyFields,
  residenceFields,
  relativeFields,
  relationshipFields,
} from "./payload";
describe("native full-field touched-only payloads", () => {
  it("does not presume biological parentage, marriage or guardianship in a new relationship", () => {
    expect(initialDraft(relativeFields("parent")).kind).toBe("unknown");
    expect(initialDraft(relativeFields("partner")).kind).toBe("unknown");
    expect(initialDraft(relativeFields("caregiver")).kind).toBe("caregiver");
  });
  it("preserves entered Markdown whitespace while using blank optional text as explicit null", () => {
    const d = initialDraft(storyFields, {
      title: "History",
      body_md: "original",
    });
    d.body_md = "  quoted line  \nnext\n";
    expect(formPayload(storyFields, d, new Set(["body_md"]))).toEqual({
      body_md: "  quoted line  \nnext\n",
    });
  });
  it("does not overwrite untouched DTO facts, lock/media/attribution fields", () => {
    const d = initialDraft(personFields, {
      first_name: "A",
      middle_name: "B",
      is_locked: true,
    });
    d.first_name = "C";
    expect(formPayload(personFields, d, new Set(["first_name"]))).toEqual({
      first_name: "C",
    });
  });
  it("supports explicit null and derives partial-date precision with uncertainty", () => {
    const d = initialDraft(personFields, {
      birth_date: { value: "1900", precision: "year", uncertain: true },
      notes_md: "old",
    });
    d.birth_date = "1900-02";
    d.notes_md = "";
    expect(
      formPayload(personFields, d, new Set(["birth_date", "notes_md"])),
    ).toEqual({
      birth_date: { value: "1900-02", precision: "month", uncertain: true },
      notes_md: null,
    });
  });
  it("rejects impossible dates, preserves unknown facts without defaults on PATCH", () => {
    const d = initialDraft(personFields);
    d.birth_date = "1900-02-29";
    expect(() =>
      formPayload(personFields, d, new Set(["birth_date"])),
    ).toThrow();
    expect(formPayload(personFields, d, new Set())).toEqual({});
  });
  it("has every editable person field but no credential/lock/photo fields", () => {
    expect(personFields.map((f) => f.key).sort()).toEqual(
      [
        "first_name",
        "middle_name",
        "last_name",
        "maiden_name",
        "suffix",
        "display_name",
        "aliases",
        "gender",
        "living_status",
        "birth_date",
        "death_date",
        "birth_place",
        "death_place",
        "birth_source",
        "death_source",
        "notes_md",
        "source_label",
        "source_url",
        "tags",
      ].sort(),
    );
  });
  it("aliases and tags are structured, preserve Unicode, and can be cleared", () => {
    const d = initialDraft(personFields);
    d.aliases = [{ name: "孫 | Jr", label: "birth name" }];
    d.tags = "history, research";
    expect(formPayload(personFields, d, new Set(["aliases", "tags"]))).toEqual({
      aliases: [{ name: "孫 | Jr", label: "birth name" }],
      tags: ["history", "research"],
    });
    d.aliases = [];
    expect(formPayload(personFields, d, new Set(["aliases"]))).toEqual({
      aliases: [],
    });
  });
  it("covers full story and residence facts; required story body is not guessed", () => {
    expect(storyFields.map((f) => f.key)).toEqual([
      "title",
      "body_md",
      "date",
      "source_label",
      "source_url",
    ]);
    expect(residenceFields.map((f) => f.key)).toEqual([
      "place",
      "is_primary",
      "start_date",
      "end_date",
      "notes_md",
      "source_label",
      "source_url",
    ]);
    expect(() => formPayload(storyFields, initialDraft(storyFields))).toThrow(
      /title/i,
    );
  });
  it("relative editors include meaning direction and episode history, typed CRUD fields", () => {
    expect(relativeFields("partner").map((f) => f.key)).toContain("status");
    expect(relativeFields("caregiver").map((f) => f.key)).toContain(
      "start_date",
    );
    expect(relationshipFields("parent").map((f) => f.key)).not.toContain(
      "status",
    );
  });
});
