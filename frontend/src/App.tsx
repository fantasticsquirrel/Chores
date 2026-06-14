import { useState, type ReactElement } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";

import { ParentDashboardPage } from "./pages/ParentDashboardPage";
import { ParentChildrenPage } from "./pages/ParentChildrenPage";
import { ParentChoresPage } from "./pages/ParentChoresPage";
import { ChildTodayPage } from "./pages/ChildTodayPage";
import { ParentSubmissionReviewPage } from "./pages/ParentSubmissionReviewPage";
import { LoginPage } from "./pages/LoginPage";
import { AccountSecurityPage } from "./pages/AccountSecurityPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { HomeschoolPage } from "./pages/HomeschoolPage";
import { RecipeDetailPage, RecipeOrganizerPage } from "./pages/RecipeOrganizerPage";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import { ApiClientError, type UserRole } from "./api";
import type { FamilyModuleKey } from "./modules/registry";
import { Button, Card, InlineNotice } from "./ui";

type RouteCardProps = {
  title: string;
  description: string;
};

type NavItem = {
  to: string;
  label: string;
  roles: UserRole[];
  moduleKey?: FamilyModuleKey;
};

const navItems: NavItem[] = [
  { to: "/parent/dashboard", label: "Parent Dashboard", roles: ["PARENT_ADMIN", "PARENT"] },
  { to: "/parent/chores", label: "Chores", roles: ["PARENT_ADMIN", "PARENT"], moduleKey: "chores" },
  { to: "/homeschool", label: "Homeschool", roles: ["PARENT_ADMIN", "PARENT"], moduleKey: "homeschool" },
  { to: "/recipes", label: "Recipes", roles: ["PARENT_ADMIN", "PARENT"], moduleKey: "recipes" },
  { to: "/admin/dashboard", label: "Admin", roles: ["PARENT_ADMIN"], moduleKey: "admin" },
  { to: "/parent/children", label: "Children", roles: ["PARENT_ADMIN", "PARENT"] },
  { to: "/board", label: "Board", roles: ["PARENT_ADMIN", "PARENT"], moduleKey: "chores" },
  { to: "/account/security", label: "Account Security", roles: ["PARENT_ADMIN", "PARENT", "CHILD"] },
  { to: "/child/today", label: "Child Today", roles: ["CHILD"], moduleKey: "chores" },
];

function getDefaultRouteForRole(role: UserRole): string {
  return role === "CHILD" ? "/child/today" : "/parent/dashboard";
}

function formatAuthActionError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
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
      description="This page is not part of the Family Manager shell yet."
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


type ModuleProtectedRouteProps = {
  moduleKey: FamilyModuleKey;
};

function ModuleProtectedRoute({ moduleKey }: ModuleProtectedRouteProps): ReactElement {
  const { status, moduleKeys } = useAuth();

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  if (!moduleKeys.includes(moduleKey)) {
    return (
      <RouteCard
        title="Module Not Available"
        description="This module is not enabled for your account. Ask a household admin to update module access."
      />
    );
  }

  return <Outlet />;
}

function AppShell(): ReactElement {
  const navigate = useNavigate();
  const { status, user, moduleKeys, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const visibleNavItems =
    status === "authenticated" && user !== null
      ? navItems.filter((item) => item.roles.includes(user.role) && (item.moduleKey === undefined || moduleKeys.includes(item.moduleKey)))
      : [];

  async function handleLogout(): Promise<void> {
    setLoggingOut(true);
    setLogoutError(null);

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      setLogoutError(formatAuthActionError(error));
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="background-orb orb-one" />
      <div className="background-orb orb-two" />
      <header className="top-bar glass-card">
        <div>
          <p className="eyebrow">Family Manager</p>
          <h2>Household Workspace</h2>
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
                void handleLogout();
              }}
              disabled={loggingOut}
            >
              {loggingOut ? "Logging Out..." : "Log Out"}
            </Button>
          ) : null}
        </nav>
      </header>
      {status === "authenticated" && user !== null ? (
        <p className="eyebrow">Signed in as {user.email}</p>
      ) : null}
      {logoutError !== null ? (
        <InlineNotice variant="error">Could not sign out: {logoutError}</InlineNotice>
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
            <Route path="/account/security" element={<AccountSecurityPage />} />
            <Route path="/chore/account/security" element={<Navigate to="/account/security" replace />} />
            <Route element={<RoleProtectedRoute allowedRoles={["PARENT_ADMIN", "PARENT"]} />}>
              <Route path="/parent/dashboard" element={<ParentDashboardPage />} />
              <Route element={<ModuleProtectedRoute moduleKey="chores" />}>
                <Route
                  path="/board"
                  element={<ParentSubmissionReviewPage />}
                />
                <Route path="/parent/chores" element={<ParentChoresPage />} />
              </Route>
              <Route element={<ModuleProtectedRoute moduleKey="homeschool" />}>
                <Route path="/homeschool" element={<HomeschoolPage />} />
              </Route>
              <Route element={<ModuleProtectedRoute moduleKey="recipes" />}>
                <Route path="/recipes" element={<RecipeOrganizerPage />} />
                <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
              </Route>
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
            <Route element={<RoleProtectedRoute allowedRoles={["PARENT_ADMIN"]} />}>
              <Route element={<ModuleProtectedRoute moduleKey="admin" />}>
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              </Route>
            </Route>
            <Route element={<RoleProtectedRoute allowedRoles={["CHILD"]} />}>
              <Route element={<ModuleProtectedRoute moduleKey="chores" />}>
                <Route
                  path="/child/today"
                  element={<ChildTodayPage />}
                />
              </Route>
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
