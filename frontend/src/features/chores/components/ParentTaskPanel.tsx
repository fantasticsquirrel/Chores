import type { ReactElement } from "react";

import type { Chore } from "../../../api";
import { Badge, Button, Card } from "../../../ui";

type ParentTaskPanelProps = {
  myTasks: Chore[];
  onComplete: (choreId: number) => void;
  targetDate: string;
};

export function ParentTaskPanel({
  myTasks,
  onComplete,
  targetDate,
}: ParentTaskPanelProps): ReactElement {
  return (
    <Card className="dashboard-panel">
      <div className="panel-header-row">
        <h2>My To-Do List</h2>
        <Badge>No finance</Badge>
      </div>
      {myTasks.length === 0 ? (
        <p>No personal chores due for {targetDate}.</p>
      ) : (
        <ul className="balance-list" aria-label="My parent chores">
          {myTasks.map((task) => (
            <li className="balance-item" key={task.id}>
              <div>
                <p className="balance-name">{task.name}</p>
                <p className="balance-meta">Personal recurring task</p>
              </div>
              <Button type="button" onClick={() => onComplete(task.id)}>
                Mark Done
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
