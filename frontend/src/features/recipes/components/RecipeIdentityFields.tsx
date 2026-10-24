import type { CreateRecipeRequest } from "../../../api";
import { FormField, TextInput } from "../../../ui";

type Props = {
  payload: CreateRecipeRequest;
  setPayload: (
    next:
      | CreateRecipeRequest
      | ((previous: CreateRecipeRequest) => CreateRecipeRequest),
  ) => void;
};

/** Basic attribution, yield, timing and description fields shared by create/edit. */
export function RecipeIdentityFields({ payload, setPayload }: Props) {
  return (
    <div className="recipe-editor-grid">
      <FormField label="Title">
        <TextInput
          value={payload.title}
          onChange={(event) =>
            setPayload((prev) => ({ ...prev, title: event.target.value }))
          }
          required
        />
      </FormField>
      <FormField label="Recipe Photo URL">
        <TextInput
          type="url"
          value={payload.photo_url ?? ""}
          onChange={(event) =>
            setPayload((prev) => ({
              ...prev,
              photo_url:
                event.target.value.trim() === "" ? null : event.target.value,
            }))
          }
        />
      </FormField>
      <FormField label="Description">
        <TextInput
          value={payload.description ?? ""}
          onChange={(event) =>
            setPayload((prev) => ({
              ...prev,
              description: event.target.value,
            }))
          }
        />
      </FormField>
      <FormField label="Source URL">
        <TextInput
          type="url"
          value={payload.source_url ?? ""}
          onChange={(event) =>
            setPayload((prev) => ({
              ...prev,
              source_url:
                event.target.value.trim() === "" ? null : event.target.value,
            }))
          }
        />
      </FormField>
      <FormField label="Source Name">
        <TextInput
          value={payload.source_name ?? ""}
          onChange={(event) =>
            setPayload((prev) => ({
              ...prev,
              source_name: event.target.value,
            }))
          }
        />
      </FormField>
      <FormField label="Default Servings">
        <TextInput
          type="number"
          value={payload.servings ?? ""}
          onChange={(event) =>
            setPayload((prev) => ({
              ...prev,
              servings:
                event.target.value === "" ? null : Number(event.target.value),
            }))
          }
        />
      </FormField>
      <FormField label="Prep Minutes">
        <TextInput
          type="number"
          value={payload.prep_minutes ?? ""}
          onChange={(event) =>
            setPayload((prev) => ({
              ...prev,
              prep_minutes:
                event.target.value === "" ? null : Number(event.target.value),
            }))
          }
        />
      </FormField>
      <FormField label="Cook Minutes">
        <TextInput
          type="number"
          value={payload.cook_minutes ?? ""}
          onChange={(event) =>
            setPayload((prev) => ({
              ...prev,
              cook_minutes:
                event.target.value === "" ? null : Number(event.target.value),
            }))
          }
        />
      </FormField>
      <FormField label="Rating">
        <TextInput
          type="number"
          min="1"
          max="5"
          value={payload.rating ?? ""}
          onChange={(event) =>
            setPayload((prev) => ({
              ...prev,
              rating:
                event.target.value === "" ? null : Number(event.target.value),
            }))
          }
        />
      </FormField>
      <FormField label="Notes">
        <TextInput
          value={payload.notes ?? ""}
          onChange={(event) =>
            setPayload((prev) => ({ ...prev, notes: event.target.value }))
          }
        />
      </FormField>
    </div>
  );
}
