import type { FamilyTreePerson } from "../../../../api";
export function formatDate(
  date: { value: string; uncertain?: boolean } | null,
) {
  return date
    ? `${date.value}${date.uncertain ? " (uncertain)" : ""}`
    : "Unknown date";
}
export function personFieldsRead(person: FamilyTreePerson): [string, string][] {
  return [
    ["First name", person.first_name ?? "Unknown"],
    ["Middle name", person.middle_name ?? "Unknown"],
    ["Last name", person.last_name ?? "Unknown"],
    ["Maiden name", person.maiden_name ?? "Unknown"],
    ["Suffix", person.suffix ?? "Unknown"],
    [
      "Aliases",
      person.aliases
        .map(
          (alias) => `${alias.name}${alias.label ? ` (${alias.label})` : ""}`,
        )
        .join(", ") || "None",
    ],
    ["Gender", person.gender ?? "Unknown"],
    [
      "Birth",
      `${formatDate(person.birth_date)} · ${person.birth_place ?? "Unknown place"}`,
    ],
    ["Birth source", person.birth_source ?? "Unknown"],
    [
      "Death",
      `${formatDate(person.death_date)} · ${person.death_place ?? "Unknown place"}`,
    ],
    ["Death source", person.death_source ?? "Unknown"],
    ["Tags", person.tags.join(", ") || "None"],
    [
      "Source",
      `${person.source_label ?? "Unknown"} ${person.source_url ?? ""}`,
    ],
  ];
}
