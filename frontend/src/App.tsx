import { useEffect, useState, type ReactElement } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { ParentDashboardPage } from "./pages/ParentDashboardPage";
import { ParentChildrenPage } from "./pages/ParentChildrenPage";
import { ParentChoresPage } from "./pages/ParentChoresPage";
import { ChoreFinancePage } from "./pages/ChoreFinancePage";
import { ChildTodayPage } from "./pages/ChildTodayPage";
import { ParentSubmissionReviewPage } from "./pages/ParentSubmissionReviewPage";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { AccountPage } from "./pages/AccountPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { HomeschoolPage } from "./pages/HomeschoolPage";
import { RecipeDetailPage, RecipeOrganizerPage } from "./pages/RecipeOrganizerPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import { type UserRole, apiClient } from "./api";
import { formatApiError } from "./lib/errors";
import type { FamilyModuleKey } from "./modules/registry";
import { Button, Card, InlineNotice } from "./ui";
import { OpsApp } from "./ops/OpsApp";
import { ThemePicker, ThemeProvider } from "./theme";

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
  { to: "/parent/dashboard", label: "Today", roles: ["PARENT_ADMIN", "PARENT"] },
  { to: "/parent/chores", label: "Chores", roles: ["PARENT_ADMIN", "PARENT"], moduleKey: "chores" },
  { to: "/parent/money", label: "Money", roles: ["PARENT_ADMIN", "PARENT"], moduleKey: "chores" },
  { to: "/homeschool", label: "Homeschool", roles: ["PARENT_ADMIN", "PARENT"], moduleKey: "homeschool" },
  { to: "/recipes", label: "Recipes", roles: ["PARENT_ADMIN", "PARENT"], moduleKey: "recipes" },
  { to: "/admin/dashboard", label: "Admin", roles: ["PARENT_ADMIN"], moduleKey: "admin" },

  { to: "/account", label: "Account", roles: ["PARENT_ADMIN", "PARENT", "CHILD"] },
  { to: "/notifications", label: "Notifications", roles: ["PARENT_ADMIN", "PARENT", "CHILD"], moduleKey: "chores" },
  { to: "/child/today", label: "Child Today", roles: ["CHILD"], moduleKey: "chores" },
  { to: "/child/history", label: "My Money", roles: ["CHILD"], moduleKey: "chores" },
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
  const { status, moduleKeys, manageableModuleKeys } = useAuth();

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

  if (!manageableModuleKeys.includes(moduleKey)) {
    return (
      <>
        <InlineNotice variant="info">You have view-only access. Management controls are hidden.</InlineNotice>
        <div className="module-read-only">
          <Outlet />
        </div>
      </>
    );
  }

  return <Outlet />;
}

function AppShell(): ReactElement {
  const navigate = useNavigate();
  const { status, user, moduleKeys, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const visibleNavItems =
    status === "authenticated" && user !== null
      ? navItems.filter((item) => item.roles.includes(user.role) && (item.moduleKey === undefined || moduleKeys.includes(item.moduleKey)))
      : [];

  useEffect(() => {
    if (status !== "authenticated" || !moduleKeys.includes("chores")) {
      setUnreadNotifications(0);
      return;
    }
    let active = true;
    void apiClient
      .listNotifications({ unread: 1, limit: 1 })
      .then((response) => {
        if (active) setUnreadNotifications(response.unread_count);
      })
      .catch(() => {
        if (active) setUnreadNotifications(0);
      });
    return () => {
      active = false;
    };
  }, [moduleKeys, status]);

  async function handleLogout(): Promise<void> {
    setLoggingOut(true);
    setLogoutError(null);

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      setLogoutError(formatApiError(error));
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="background-orb orb-one" />
      <div className="background-orb orb-two" />
      <header className="top-bar glass-card app-brand-bar">
        <div>
          <p className="eyebrow">Family Manager</p>
          <h2>Household Workspace</h2>
        </div>
        {status === "authenticated" && user !== null ? (
          <div className="app-brand-session"><span>Signed in as {user.email}</span><ThemePicker compact /></div>
        ) : null}
      </header>
      <div className={`workspace-layout${status === "authenticated" ? " workspace-layout--authenticated" : ""}`}>
        {status === "authenticated" ? <aside className="workspace-sidebar glass-card">
        <nav aria-label="Primary" className="workspace-nav">
          {visibleNavItems.map((item, index) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-chip ${index < 3 ? "mobile-primary" : "mobile-secondary"}${isActive ? " active" : ""}`}
            >
              {item.label === "Notifications" && unreadNotifications > 0 ? `${item.label} (${unreadNotifications})` : item.label}
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
          <details className="mobile-more">
            <summary>More</summary>
            <div className="mobile-more-panel">
              {visibleNavItems.slice(3).map((item) => (
                <NavLink
                  key={`mobile-${item.to}`}
                  to={item.to}
                  aria-label={`${item.label} in More menu`}
                >
                  {item.label}
                </NavLink>
              ))}
              <button
                type="button"
                aria-label="Log out from More menu"
                onClick={() => { void handleLogout(); }}
              >
                {loggingOut ? "Logging out..." : "Log out"}
              </button>
            </div>
          </details>
        </nav>
        </aside> : null}
        <div className="workspace-main">
          {logoutError !== null ? (
            <InlineNotice variant="error">Could not sign out: {logoutError}</InlineNotice>
          ) : null}
          <main className="content-grid"><Outlet /></main>
        </div>
      </div>
    </div>
  );
}

export default function App(): ReactElement {
  const { pathname } = useLocation();
  return pathname === "/ops" || pathname.startsWith("/ops/") ? <OpsApp /> : <HouseholdApp />;
}

function HouseholdApp(): ReactElement {
  return (
    <ThemeProvider><AuthProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<AccountPage />} />
            <Route path="/account/security" element={<AccountPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/chore/account/security" element={<Navigate to="/account/security" replace />} />
            <Route element={<RoleProtectedRoute allowedRoles={["PARENT_ADMIN", "PARENT"]} />}>
              <Route path="/parent/dashboard" element={<ParentDashboardPage />} />
              <Route element={<ModuleProtectedRoute moduleKey="chores" />}>
                <Route
                  path="/board"
                  element={<ParentSubmissionReviewPage />}
                />
                <Route path="/parent/chores" element={<ParentChoresPage />} />
                <Route path="/parent/children" element={<ParentChildrenPage />} />
                <Route path="/parent/money" element={<ChoreFinancePage />} />
              </Route>
              <Route element={<ModuleProtectedRoute moduleKey="homeschool" />}>
                <Route path="/homeschool" element={<HomeschoolPage />} />
              </Route>
              <Route element={<ModuleProtectedRoute moduleKey="recipes" />}>
                <Route path="/recipes" element={<RecipeOrganizerPage />} />
                <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
              </Route>
              <Route
                path="/parent/tags"
                element={<RouteCard title="Parent Tags" description="Tag management is reserved for a later implementation task." />}
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
              <Route path="/child/history" element={<ChoreFinancePage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider></ThemeProvider>
  );
}
