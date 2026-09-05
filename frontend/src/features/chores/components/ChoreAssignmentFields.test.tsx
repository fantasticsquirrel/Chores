import { fireEvent, render, screen, within } from "@testing-library/react";

import type { Child } from "../../../api";
import { ChoreAssignmentFields } from "./ChoreAssignmentFields";

const children: Child[] = [
  { id: 11, household_id: 7, name: "Riley", active: true },
  { id: 12, household_id: 7, name: "Maya", active: true },
];

describe("ChoreAssignmentFields", () => {
  it("preserves static child selection controls", () => {
    const onAllowedChildIdsChange = vi.fn();
    render(
      <ChoreAssignmentFields
        allowedChildIds={[11]}
        assignmentMode="STATIC"
        children={children}
        completionMode="PER_CHILD"
        disabled={false}
        onAllowedChildIdsChange={onAllowedChildIdsChange}
        onAssignmentModeChange={vi.fn()}
        onCompletionModeChange={vi.fn()}
        onRotationOrderChange={vi.fn()}
        rotationOrder={[]}
        taskScope="CHILD"
      />,
    );

    expect(screen.getByLabelText("Riley")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Maya"));
    expect(onAllowedChildIdsChange).toHaveBeenCalledWith([11, 12]);
  });

  it("preserves rotation ordering controls", () => {
    const onRotationOrderChange = vi.fn();
    render(
      <ChoreAssignmentFields
        allowedChildIds={[]}
        assignmentMode="ROTATING"
        children={children}
        completionMode="SHARED"
        disabled={false}
        onAllowedChildIdsChange={vi.fn()}
        onAssignmentModeChange={vi.fn()}
        onCompletionModeChange={vi.fn()}
        onRotationOrderChange={onRotationOrderChange}
        rotationOrder={[11, 12]}
        taskScope="CHILD"
      />,
    );

    const order = screen.getByRole("list", { name: "Rotation order" });
    fireEvent.click(
      within(within(order).getAllByRole("listitem")[0]).getByRole("button", {
        name: "Down",
      }),
    );
    expect(onRotationOrderChange).toHaveBeenCalledWith([12, 11]);
  });
});
