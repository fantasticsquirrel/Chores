import type { ReactElement } from "react";

import {
  Badge,
  Button,
  Card,
  DateInput,
  FormField,
  InlineNotice,
} from "../../../ui";
import type { ChildrenState } from "../hooks/useEligibleChores";

type DailyChoreBoardPanelProps = {
  activeChildCount: number;
  childrenState: ChildrenState;
  onDateChange: (date: string) => void;
  onToday: () => void;
  targetDate: string;
};

export function DailyChoreBoardPanel({
  activeChildCount,
  childrenState,
  onDateChange,
  onToday,
  targetDate,
}: DailyChoreBoardPanelProps): ReactElement {
  return (
    <Card className="dashboard-panel">
      <div className="panel-header-row">
        <h2>Daily Board</h2>
        <Badge>{targetDate}</Badge>
      </div>
      <form
        className="children-form today-controls"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField label="Date">
          <DateInput
            value={targetDate}
            onChange={(event) => onDateChange(event.target.value)}
            max="9999-12-31"
          />
        </FormField>
        <Button type="button" onClick={onToday}>
          Today
        </Button>
      </form>

      {childrenState.loading ? (
        <p>Loading children and available chores...</p>
      ) : null}
      {!childrenState.loading && childrenState.error !== null ? (
        <InlineNotice variant="error">
          Could not load children: {childrenState.error}
        </InlineNotice>
      ) : null}
      {!childrenState.loading &&
      childrenState.error === null &&
      activeChildCount === 0 ? (
        <p>No active children found for this household.</p>
      ) : null}
    </Card>
  );
}
