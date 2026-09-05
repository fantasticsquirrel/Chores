import type { ReactElement } from "react";

import type { AssignmentMode, Child, CompletionMode } from "../../../api";
import { Button, FormField } from "../../../ui";

type ChildChecklistProps = {
  children: Child[];
  disabled: boolean;
  onChange: (ids: number[]) => void;
  selected: number[];
};

function ChildChecklist({
  children,
  disabled,
  onChange,
  selected,
}: ChildChecklistProps): ReactElement {
  function toggle(id: number): void {
    onChange(
      selected.includes(id)
        ? selected.filter((childId) => childId !== id)
        : [...selected, id],
    );
  }

  return (
    <div className="stacked-control-list">
      {children.map((child) => (
        <label key={child.id} className="checkbox-row task-checkbox">
          <input
            type="checkbox"
            checked={selected.includes(child.id)}
            onChange={() => toggle(child.id)}
            disabled={disabled}
          />
          <span>
            {child.name}
            {!child.active ? (
              <span className="muted-inline">inactive</span>
            ) : null}
          </span>
        </label>
      ))}
      {children.length === 0 ? <p>No children in household yet.</p> : null}
    </div>
  );
}

type RotationOrderProps = {
  children: Child[];
  disabled: boolean;
  onChange: (ids: number[]) => void;
  order: number[];
};

function RotationOrderList({
  children,
  disabled,
  onChange,
  order,
}: RotationOrderProps): ReactElement {
  const inRotation = new Set(order);

  function move(index: number, direction: -1 | 1): void {
    const next = [...order];
    const swap = index + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next);
  }

  function toggleChild(id: number): void {
    onChange(
      order.includes(id)
        ? order.filter((childId) => childId !== id)
        : [...order, id],
    );
  }

  return (
    <div className="stacked-control-list">
      {children.map((child) => (
        <label key={child.id} className="checkbox-row task-checkbox">
          <input
            type="checkbox"
            checked={inRotation.has(child.id)}
            onChange={() => toggleChild(child.id)}
            disabled={disabled}
          />
          {child.name}
        </label>
      ))}

      {order.length > 0 ? (
        <ol className="rotation-order-list" aria-label="Rotation order">
          {order.map((id, index) => {
            const name =
              children.find((child) => child.id === id)?.name ?? `#${id}`;
            return (
              <li key={id}>
                <span>{name}</span>
                <div className="item-actions">
                  <Button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={disabled || index === 0}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={disabled || index === order.length - 1}
                  >
                    Down
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

type ChoreAssignmentFieldsProps = {
  allowedChildIds: number[];
  assignmentMode: AssignmentMode;
  children: Child[];
  completionMode: CompletionMode;
  disabled: boolean;
  onAllowedChildIdsChange: (ids: number[]) => void;
  onAssignmentModeChange: (mode: AssignmentMode) => void;
  onCompletionModeChange: (mode: CompletionMode) => void;
  onRotationOrderChange: (ids: number[]) => void;
  rotationOrder: number[];
  taskScope: "CHILD" | "PARENT";
};

export function ChoreAssignmentFields({
  allowedChildIds,
  assignmentMode,
  children,
  completionMode,
  disabled,
  onAllowedChildIdsChange,
  onAssignmentModeChange,
  onCompletionModeChange,
  onRotationOrderChange,
  rotationOrder,
  taskScope,
}: ChoreAssignmentFieldsProps): ReactElement | null {
  if (taskScope !== "CHILD") return null;

  return (
    <>
      <FormField label="Completion">
        <select
          value={completionMode}
          onChange={(event) =>
            onCompletionModeChange(event.target.value as CompletionMode)
          }
          disabled={disabled}
          className="text-input"
        >
          <option value="PER_CHILD">Per child</option>
          <option value="SHARED">Shared</option>
        </select>
      </FormField>
      <FormField label="Assignment">
        <select
          value={assignmentMode}
          onChange={(event) =>
            onAssignmentModeChange(event.target.value as AssignmentMode)
          }
          disabled={disabled}
          className="text-input"
        >
          <option value="STATIC">Static</option>
          <option value="ROTATING">Rotating</option>
        </select>
      </FormField>
      {assignmentMode === "ROTATING" ? (
        <fieldset className="plain-fieldset">
          <legend>Rotation Order</legend>
          <RotationOrderList
            children={children}
            order={rotationOrder}
            onChange={onRotationOrderChange}
            disabled={disabled}
          />
        </fieldset>
      ) : (
        <fieldset className="plain-fieldset">
          <legend>Who can complete? Empty means all children.</legend>
          <ChildChecklist
            children={children}
            selected={allowedChildIds}
            onChange={onAllowedChildIdsChange}
            disabled={disabled}
          />
        </fieldset>
      )}
    </>
  );
}
