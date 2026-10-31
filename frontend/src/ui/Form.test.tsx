import { render, screen } from "@testing-library/react";

import { FormField, Select, TextArea, TextInput } from "./Form";

it("gives shared text, select, and textarea controls consistent theme-aware styling", () => {
  render(
    <>
      <FormField label="Name">
        <TextInput aria-label="Name" />
      </FormField>
      <FormField label="Child">
        <Select aria-label="Child" density="compact">
          <option>Alex</option>
        </Select>
      </FormField>
      <FormField label="Notes">
        <TextArea aria-label="Notes" density="comfortable" />
      </FormField>
    </>,
  );

  expect(screen.getByLabelText("Name")).toHaveClass(
    "ui-control",
    "ui-control--default",
  );
  expect(screen.getByLabelText("Child")).toHaveClass(
    "ui-control",
    "ui-select",
    "ui-control--compact",
  );
  expect(screen.getByLabelText("Notes")).toHaveClass(
    "ui-control",
    "ui-textarea",
    "ui-control--comfortable",
  );
});
