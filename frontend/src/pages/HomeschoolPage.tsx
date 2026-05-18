import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { apiClient, ApiClientError, type Child, type HomeschoolSemester, type HomeschoolSubject } from "../api";
import { useAuth } from "../auth/useAuth";
import { ButtonLink, Card, InlineNotice } from "../ui";

type HomeschoolState = {
  children: Child[];
  semesters: HomeschoolSemester[];
  subjects: HomeschoolSubject[];
  loading: boolean;
  error: string | null;
};

function formatLoadError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed.";
}

export function HomeschoolPage(): ReactElement {
  const { user } = useAuth();
  const householdId = user?.household_id ?? null;
  const [state, setState] = useState<HomeschoolState>({
    children: [],
    semesters: [],
    subjects: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    if (householdId === null) {
      setState({ children: [], semesters: [], subjects: [], loading: false, error: "Could not determine household scope." });
      return () => {
        isMounted = false;
      };
    }

    Promise.all([
      apiClient.listChildren({ household_id: householdId }),
      apiClient.listHomeschoolSemesters(householdId),
      apiClient.listHomeschoolSubjects(householdId),
    ])
      .then(([children, semesters, subjects]) => {
        if (!isMounted) return;
        setState({ children, semesters, subjects, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setState({ children: [], semesters: [], subjects: [], loading: false, error: formatLoadError(error) });
      });

    return () => {
      isMounted = false;
    };
  }, [householdId]);

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
          Homeschool now shares the Family Manager household and child account model. Calendar UI is next; this page is
          already reading the new homeschool API scaffolding.
        </p>
        <div className="quick-actions">
          <ButtonLink to="/parent/children">Review Linked Children</ButtonLink>
          <ButtonLink to="/admin/dashboard">Module Access</ButtonLink>
        </div>
      </Card>

      <Card className="metric-card">
        <p className="metric-label">Linked Children</p>
        <p className="metric-value">{state.loading ? "-" : state.children.length}</p>
        <p className="metric-footnote">Shared with Chores.</p>
      </Card>

      <Card className="metric-card">
        <p className="metric-label">Semesters</p>
        <p className="metric-value">{state.loading ? "-" : state.semesters.length}</p>
        <p className="metric-footnote">Backed by homeschool tables.</p>
      </Card>

      <Card className="metric-card">
        <p className="metric-label">Subjects</p>
        <p className="metric-value">{state.loading ? "-" : state.subjects.length}</p>
        <p className="metric-footnote">Household-scoped subject palette.</p>
      </Card>

      <Card className="dashboard-panel">
        <h2>Integration Status</h2>
        {state.loading ? <p>Loading homeschool module data...</p> : null}
        {!state.loading && state.error !== null ? (
          <InlineNotice variant="error">Could not load homeschool data: {state.error}</InlineNotice>
        ) : null}
        {!state.loading && state.error === null ? (
          <ul className="balance-list">
            <li className="balance-item">Shared children ready: {state.children.map((child) => child.name).join(", ") || "none yet"}</li>
            <li className="balance-item">Semester CRUD API ready for frontend forms.</li>
            <li className="balance-item">Subject and attendance API ready for calendar wiring.</li>
          </ul>
        ) : null}
      </Card>
    </section>
  );
}
