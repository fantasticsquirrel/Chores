import { useId } from "react";
import { Button } from "../../../ui";
import type { Field } from "../lib/workflows/fields";

export function FactField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}) {
  const id = useId();
  if (field.type === "date") {
    const date = value as
      | { value: string; uncertain?: boolean }
      | null
      | undefined;
    return (
      <fieldset disabled={disabled}>
        <legend>{field.label}</legend>
        <label htmlFor={id}>{field.label} (YYYY, YYYY-MM, or YYYY-MM-DD)</label>
        <input
          id={id}
          value={date?.value ?? ""}
          pattern="[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?"
          onChange={(event) =>
            onChange(
              event.target.value
                ? {
                    value: event.target.value,
                    uncertain: date?.uncertain ?? false,
                  }
                : null,
            )
          }
        />
        <label>
          <input
            type="checkbox"
            checked={date?.uncertain ?? false}
            disabled={!date?.value}
            onChange={(event) =>
              onChange({ ...date, uncertain: event.target.checked })
            }
          />{" "}
          {field.label} uncertain
        </label>
        <small>Blank means unknown; no day is invented.</small>
      </fieldset>
    );
  }
  if (field.type === "aliases") {
    const aliases = (value ?? []) as { name: string; label: string | null }[];
    return (
      <fieldset disabled={disabled}>
        <legend>{field.label}</legend>
        {aliases.map((alias, index) => (
          <div key={index}>
            <label>
              Alias {index + 1} name
              <input
                value={alias.name}
                required
                onChange={(event) =>
                  onChange(
                    aliases.map((item, i) =>
                      i === index
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              Alias {index + 1} label
              <input
                value={alias.label ?? ""}
                onChange={(event) =>
                  onChange(
                    aliases.map((item, i) =>
                      i === index
                        ? { ...item, label: event.target.value || null }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <Button
              type="button"
              onClick={() => onChange(aliases.filter((_, i) => i !== index))}
            >
              Remove alias {index + 1}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          onClick={() => onChange([...aliases, { name: "", label: null }])}
        >
          Add alias
        </Button>
      </fieldset>
    );
  }
  if (field.type === "boolean")
    return (
      <label>
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />{" "}
        {field.label}
      </label>
    );
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {field.label}
        {field.required ? " (required)" : ""}
      </label>
      {field.type === "select" ? (
        <select
          id={id}
          value={String(value ?? field.options?.[0] ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      ) : field.type === "person" ? (
        <select
          id={id}
          required
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          <option value="">Choose a recorded person</option>
          {field.choices?.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          id={id}
          required={field.required}
          rows={5}
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || null)}
        />
      ) : (
        <input
          id={id}
          required={field.required}
          value={
            field.type === "tags"
              ? ((value as string[] | undefined)?.join(", ") ?? "")
              : String(value ?? "")
          }
          disabled={disabled}
          onChange={(event) =>
            onChange(
              field.type === "tags"
                ? event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                : event.target.value || null,
            )
          }
        />
      )}
    </div>
  );
}
