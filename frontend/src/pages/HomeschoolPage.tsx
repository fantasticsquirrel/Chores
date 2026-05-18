import type { ReactElement } from "react";

import { ButtonLink, Card } from "../ui";

export function HomeschoolPage(): ReactElement {
  return (
    <section className="dashboard-grid" aria-label="Homeschool module">
      <Card className="dashboard-panel">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">Family Manager Module</p>
            <h1>Homeschool</h1>
          </div>
        </div>
        <p>
          Homeschool is being integrated into the shared Family Manager account model. This module will use the
          existing linked children instead of a separate standalone state file.
        </p>
        <div className="quick-actions">
          <ButtonLink to="/parent/children">Review Linked Children</ButtonLink>
          <ButtonLink to="/parent/dashboard">Back to Dashboard</ButtonLink>
        </div>
      </Card>

      <Card className="dashboard-panel">
        <h2>Planned Homeschool Tools</h2>
        <ul className="balance-list">
          <li className="balance-item">Semester setup and active semester selection</li>
          <li className="balance-item">Subject palette and per-child attendance tracking</li>
          <li className="balance-item">Day comments, subject notes, grades, and reports</li>
        </ul>
      </Card>
    </section>
  );
}
