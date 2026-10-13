import { parsePartialDate } from "@family-manager/family-tree-core";
import type { FamilyTreeAliasInput } from "@family-manager/family-api/models";
export type Field = {
  key: string;
  label: string;
  kind?:
    | "text"
    | "multiline"
    | "date"
    | "choice"
    | "boolean"
    | "aliases"
    | "tags";
  required?: boolean;
  options?: string[];
};
export type Draft = Record<string, unknown>;
const text = (key: string, label: string, required = false): Field => ({
  key,
  label,
  required,
});
const date = (key: string, label: string): Field => ({
  key,
  label,
  kind: "date",
});
const choice = (key: string, label: string, options: string[]): Field => ({
  key,
  label,
  kind: "choice",
  options,
});
export const sourceFields: Field[] = [
  text("source_label", "Source label"),
  text("source_url", "Source URL"),
];
export const citationFields: Field[] = [
  {
    key: "notes_md",
    label: "Notes (plain text / Markdown)",
    kind: "multiline",
  },
  ...sourceFields,
];
export const datedFields: Field[] = [
  date("start_date", "Start date"),
  date("end_date", "End date"),
];
export const personFields: Field[] = [
  text("first_name", "First name"),
  text("middle_name", "Middle name"),
  text("last_name", "Last name"),
  text("maiden_name", "Maiden name"),
  text("suffix", "Suffix"),
  text("display_name", "Display name"),
  { key: "aliases", label: "Other names / aliases", kind: "aliases" },
  text("gender", "Gender"),
  choice("living_status", "Living state", ["unknown", "living", "deceased"]),
  date("birth_date", "Birth date"),
  date("death_date", "Death date"),
  text("birth_place", "Birth place"),
  text("death_place", "Death place"),
  text("birth_source", "Birth source"),
  text("death_source", "Death source"),
  ...citationFields,
  { key: "tags", label: "Tags (comma separated)", kind: "tags" },
];
export const storyFields: Field[] = [
  text("title", "Story title", true),
  {
    key: "body_md",
    label: "Story body (plain text / Markdown)",
    kind: "multiline",
    required: true,
  },
  date("date", "Story date"),
  ...sourceFields,
];
export const residenceFields: Field[] = [
  text("place", "Residence place", true),
  { key: "is_primary", label: "Primary residence", kind: "boolean" },
  ...datedFields,
  ...citationFields,
];
export type Direction =
  | "parent"
  | "child"
  | "caregiver"
  | "recipient"
  | "partner";
export function relationshipFields(
  type: "parent" | "care" | "partner",
): Field[] {
  const kind = choice(
    "kind",
    "Relationship meaning",
    type === "parent"
      ? ["biological", "adoptive", "step", "unknown"]
      : type === "care"
        ? ["guardian", "caregiver"]
        : ["married", "civil_union", "partners", "unknown"],
  );
  return [
    kind,
    ...(type === "parent" ? [] : datedFields),
    ...(type === "partner"
      ? [
          choice("status", "Partnership status", [
            "unknown",
            "current",
            "separated",
            "ended",
          ]),
        ]
      : []),
    ...citationFields,
  ];
}
export function relativeFields(direction: Direction): Field[] {
  return relationshipFields(
    direction === "partner"
      ? "partner"
      : ["caregiver", "recipient"].includes(direction)
        ? "care"
        : "parent",
  );
}
export function initialDraft(fields: Field[], record: unknown = {}): Draft {
  const r = (record ?? {}) as Record<string, unknown>,
    d: Draft = {};
  for (const f of fields) {
    const v = r[f.key];
    if (f.kind === "date") {
      const date = v as { value?: string; uncertain?: boolean } | null;
      d[f.key] = date?.value ?? "";
      d[`${f.key}_uncertain`] = date?.uncertain ?? false;
    } else if (f.kind === "aliases")
      d[f.key] =
        (v as FamilyTreeAliasInput[] | undefined)?.map((a) => ({
          name: a.name,
          label: a.label ?? "",
        })) ?? [];
    else if (f.kind === "tags")
      d[f.key] = (v as string[] | undefined)?.join(", ") ?? "";
    else if (f.kind === "boolean") d[f.key] = v === true;
    else
      d[f.key] =
        v ??
        (f.kind === "choice"
          ? f.options!.includes("unknown")
            ? "unknown"
            : f.options!.includes("caregiver")
              ? "caregiver"
              : f.options![0]
          : "");
  }
  return d;
}
export function formPayload(
  fields: Field[],
  draft: Draft,
  touched?: Set<string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    if (touched && !touched.has(f.key)) continue;
    const v = draft[f.key];
    if (f.kind === "date") {
      const s = String(v ?? "").trim();
      try {
        payload[f.key] = s
          ? parsePartialDate({
              value: s,
              uncertain: draft[`${f.key}_uncertain`] === true,
            })
          : null;
      } catch {
        throw new Error(
          `${f.label}: use YYYY, YYYY-MM or a real YYYY-MM-DD date.`,
        );
      }
    } else if (f.kind === "aliases") {
      payload[f.key] = (v as FamilyTreeAliasInput[]).map((a) => {
        if (!a.name.trim()) throw new Error("Each alias needs a name.");
        return { name: a.name.trim(), label: a.label?.trim() || null };
      });
    } else if (f.kind === "tags")
      payload[f.key] = [
        ...new Set(
          String(v ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ];
    else if (f.kind === "boolean") payload[f.key] = v === true;
    else {
      const raw = String(v ?? "");
      const s = f.kind === "multiline" ? raw : raw.trim();
      if (f.required && !s.trim()) throw new Error(`${f.label} is required.`);
      if (f.kind === "choice" && !f.options?.includes(s))
        throw new Error(`Choose ${f.label}.`);
      if (f.key.endsWith("source_url") && s && !/^https?:\/\//i.test(s))
        throw new Error("Source URL must use http or https.");
      payload[f.key] = s.trim() ? s : null;
    }
  }
  return payload;
}
