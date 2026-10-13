export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "date"
    | "boolean"
    | "tags"
    | "aliases"
    | "select"
    | "person";
  options?: readonly string[];
  choices?: readonly { id: number; label: string }[];
  required?: boolean;
};
export const citationFields: Field[] = [
  { key: "notes_md", label: "Notes (limited Markdown)", type: "textarea" },
  { key: "source_label", label: "Source label" },
  { key: "source_url", label: "Source URL" },
];
export const dateFields: Field[] = [
  { key: "start_date", label: "Start date", type: "date" },
  { key: "end_date", label: "End date", type: "date" },
];
export const personFields: Field[] = [
  { key: "display_name", label: "Display name" },
  { key: "first_name", label: "First name" },
  { key: "middle_name", label: "Middle name" },
  { key: "last_name", label: "Last name" },
  { key: "maiden_name", label: "Maiden name" },
  { key: "suffix", label: "Suffix" },
  { key: "aliases", label: "Aliases", type: "aliases" },
  { key: "gender", label: "Gender" },
  {
    key: "living_status",
    label: "Living status",
    type: "select",
    options: ["unknown", "living", "deceased"],
  },
  { key: "birth_date", label: "Birth date", type: "date" },
  { key: "death_date", label: "Death date", type: "date" },
  { key: "birth_place", label: "Birth place" },
  { key: "death_place", label: "Death place" },
  { key: "birth_source", label: "Birth source" },
  { key: "death_source", label: "Death source" },
  { key: "tags", label: "Tags", type: "tags" },
  ...citationFields,
];
export const storyFields: Field[] = [
  { key: "title", label: "Story title", required: true },
  {
    key: "body_md",
    label: "Full story (limited Markdown)",
    type: "textarea",
    required: true,
  },
  { key: "date", label: "Story date", type: "date" },
  { key: "source_label", label: "Source label" },
  { key: "source_url", label: "Source URL" },
];
export const residenceFields: Field[] = [
  { key: "place", label: "Residence place", required: true },
  { key: "is_primary", label: "Primary residence", type: "boolean" },
  ...dateFields,
  ...citationFields,
];
