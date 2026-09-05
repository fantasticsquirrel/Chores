import type { FormEvent, ReactElement } from "react";

import type { UseChildMutationsResult } from "../hooks/useChildMutations";
import {
  Button,
  Card,
  CheckboxField,
  FormField,
  InlineNotice,
  TextInput,
} from "../../../ui";

type AddChildPanelProps = {
  mutations: UseChildMutationsResult;
};

export function AddChildPanel({ mutations }: AddChildPanelProps): ReactElement {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void mutations.createChild();
  }

  return (
    <Card className="dashboard-panel">
      <div className="panel-header-row">
        <h2>Add Child</h2>
      </div>
      <form className="children-form" onSubmit={handleSubmit}>
        <FormField label="Name">
          <TextInput
            type="text"
            value={mutations.nameInput}
            onChange={(event) => mutations.setNameInput(event.target.value)}
            placeholder="Avery"
            maxLength={255}
            disabled={mutations.submitting}
          />
        </FormField>
        <CheckboxField
          label="Active"
          checked={mutations.activeOnCreate}
          onChange={(event) =>
            mutations.setActiveOnCreate(event.target.checked)
          }
          disabled={mutations.submitting}
        />
        <Button type="submit" disabled={mutations.submitting}>
          {mutations.submitting ? "Saving..." : "Create Child"}
        </Button>
      </form>
      {mutations.submitError !== null ? (
        <InlineNotice variant="error">
          Could not save child: {mutations.submitError}
        </InlineNotice>
      ) : null}
    </Card>
  );
}
