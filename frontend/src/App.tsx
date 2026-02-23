import type { ReactElement } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";

import { ParentDashboardPage } from "./pages/ParentDashboardPage";
import { ParentChildrenPage } from "./pages/ParentChildrenPage";
import { ChildTodayPage } from "./pages/ChildTodayPage";
import { ParentSubmissionReviewPage } from "./pages/ParentSubmissionReviewPage";
import { LoginPage } from "./pages/LoginPage";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import type { UserRole } from "./api";
import { Button, Card } from "./ui";

type RouteCardProps = {
  title: string;
  description: string;
};

type NavItem = {
  to: string;
  label: string;
  roles: UserRole[];
};

const navItems: NavItem[] = [
  { to: "/parent/dashboard", label: "Parent Dashboard", roles: ["PARENT_ADMIN", "PARENT"] },
  { to: "/parent/children", label: "Children", roles: ["PARENT_ADMIN", "PARENT"] },
  { to: "/board", label: "Board", roles: ["PARENT_ADMIN", "PARENT"] },
  { to: "/child/today", label: "Child Today", roles: ["CHILD"] },
];

function getDefaultRouteForRole(role: UserRole): string {
  return role === "CHILD" ? "/child/today" : "/parent/dashboard";
}

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

function ProtectedRoute(): ReactElement {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <RouteCard
        title="Checking Session"
        description="Verifying your session before loading this page."
      />
    );
  }

  if (status === "anonymous") {
    return <Navigate to="/login" replace />;
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

type RoleProtectedRouteProps = {
  allowedRoles: UserRole[];
};

function RoleProtectedRoute({ allowedRoles }: RoleProtectedRouteProps): ReactElement {
  const { status, user } = useAuth();

  if (status !== "authenticated" || user === null) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return <Outlet />;
}

function AppShell(): ReactElement {
  const navigate = useNavigate();
  const { status, user, logout } = useAuth();
  const visibleNavItems =
    status === "authenticated" && user !== null
      ? navItems.filter((item) => item.roles.includes(user.role))
      : [];

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
          {visibleNavItems.map((item) => (
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
          <Route element={<ProtectedRoute />}>
            <Route element={<RoleProtectedRoute allowedRoles={["PARENT_ADMIN", "PARENT"]} />}>
              <Route
                path="/board"
                element={<ParentSubmissionReviewPage />}
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
            </Route>
            <Route element={<RoleProtectedRoute allowedRoles={["CHILD"]} />}>
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
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
