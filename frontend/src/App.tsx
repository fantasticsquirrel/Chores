import type { ReactElement } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";

import { ParentDashboardPage } from "./pages/ParentDashboardPage";
import { ParentChildrenPage } from "./pages/ParentChildrenPage";
import { ChildTodayPage } from "./pages/ChildTodayPage";
import { ParentSubmissionReviewPage } from "./pages/ParentSubmissionReviewPage";
import { LoginPage } from "./pages/LoginPage";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import { Button, Card } from "./ui";

type RouteCardProps = {
  title: string;
  description: string;
};

const navItems = [
  { to: "/parent/dashboard", label: "Parent Dashboard" },
  { to: "/parent/children", label: "Children" },
  { to: "/child/today", label: "Child Today" },
  { to: "/board", label: "Board" },
];

function RouteCard({ title, description }: RouteCardProps): ReactElement {
  return (
    <Card as="section">
      <h1>{title}</h1>
      <p>{description}</p>
    </Card>
  );
}

function NotFoundPage(): ReactElement {
  return (
    <RouteCard
      title="Route Not Found"
      description="This page is not part of the Chore Tracker shell yet."
    />
  );
}

function AppShell(): ReactElement {
  const navigate = useNavigate();
  const { status, user, logout } = useAuth();

  return (
    <div className="app-shell">
      <div className="background-orb orb-one" />
      <div className="background-orb orb-two" />
      <header className="top-bar glass-card">
        <div>
          <p className="eyebrow">Chore Tracker v3</p>
          <h2>Jewel Pop Workspace</h2>
        </div>
        <nav aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-chip${isActive ? " active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
          {status === "authenticated" ? (
            <Button
              type="button"
              className="nav-chip"
              onClick={() => {
                void logout().then(() => {
                  navigate("/login", { replace: true });
                });
              }}
            >
              Log Out
            </Button>
          ) : null}
        </nav>
      </header>
      {status === "authenticated" && user !== null ? (
        <p className="eyebrow">Signed in as {user.email}</p>
      ) : null}
      <main className="content-grid">
        <Outlet />
      </main>
    </div>
  );
}

export default function App(): ReactElement {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/board"
            element={<ParentSubmissionReviewPage />}
          />
          <Route
            path="/child/today"
            element={<ChildTodayPage />}
          />
          <Route
            path="/child/calendar"
            element={<RouteCard title="Child Calendar" description="Calendar and historical cadence will be added in upcoming tasks." />}
          />
          <Route
            path="/child/history"
            element={<RouteCard title="Child History" description="History and balance timeline will be wired after core API tasks." />}
          />
          <Route path="/parent/dashboard" element={<ParentDashboardPage />} />
          <Route
            path="/parent/chores"
            element={<RouteCard title="Parent Chores" description="Chore authoring and scheduling pages will be built in subsequent iterations." />}
          />
          <Route
            path="/parent/children"
            element={<ParentChildrenPage />}
          />
          <Route
            path="/parent/tags"
            element={<RouteCard title="Parent Tags" description="Tag management is reserved for a later implementation task." />}
          />
          <Route
            path="/parent/templates"
            element={<RouteCard title="Parent Templates" description="Template scheduling UX is queued for a later task." />}
          />
          <Route
            path="/parent/reports"
            element={<RouteCard title="Parent Reports" description="Report visualizations will follow after transaction and approval flows." />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
