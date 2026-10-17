import { useState, type FormEvent, type ReactElement } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import type { OpsHouseholdSummary } from "@family-manager/family-api/ops-models";

import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";
import { formatApiError } from "../lib/errors";
import { opsApi } from "./api/client";
import { OpsAuthProvider } from "./auth/OpsAuthContext";
import { useOpsAuth } from "./auth/OpsAuthState";
import { ThemeProvider } from "../theme";
import { OwnerOverview } from "./OwnerOverview";
import { OwnerDirectory } from "./OwnerDirectory";
import { OwnerModules } from "./OwnerModules";
import { OpsHouseholdDetailPage } from "./OpsHouseholdDetail";
import "./ops.css";

export function OpsApp(): ReactElement {
  return (
    <ThemeProvider>
      <div className="ops-root">
        <OpsAuthProvider>
          <Routes>
            <Route path="/ops/login" element={<OpsLoginPage />} />
            <Route element={<OpsProtectedRoute />}>
              <Route element={<OpsShell />}>
                <Route path="/ops" element={<OpsLanding />} />
                <Route
                  path="/ops/modules"
                  element={
                    <OwnerRoute>
                      <OwnerModules />
                    </OwnerRoute>
                  }
                />
                <Route path="/ops/households" element={<OpsDirectoryRoute />} />
                <Route
                  path="/ops/households/:householdId"
                  element={<OpsHouseholdDetailPage />}
                />
                <Route path="*" element={<OpsNotFound />} />
              </Route>
            </Route>
          </Routes>
        </OpsAuthProvider>
      </div>
    </ThemeProvider>
  );
}

function OwnerRoute({ children }: { children: ReactElement }): ReactElement {
  const { session } = useOpsAuth();
  return session?.user.role === "PLATFORM_OWNER" ? (
    children
  ) : (
    <Navigate to="/ops/households" replace />
  );
}
function OpsLanding(): ReactElement {
  const { session } = useOpsAuth();
  return session?.user.role === "PLATFORM_OWNER" ? (
    <OwnerOverview />
  ) : (
    <Navigate to="/ops/households" replace />
  );
}
function OpsDirectoryRoute(): ReactElement {
  const { session } = useOpsAuth();
  return session?.user.role === "PLATFORM_OWNER" ? (
    <OwnerDirectory />
  ) : (
    <OpsHouseholdLookupPage />
  );
}
function OpsProtectedRoute(): ReactElement {
  const { status } = useOpsAuth();
  if (status === "loading")
    return (
      <OpsStatus
        title="Checking operations session"
        body="Verifying separate operator access."
      />
    );
  if (status === "anonymous") return <Navigate to="/ops/login" replace />;
  return <Outlet />;
}

function OpsShell(): ReactElement {
  const navigate = useNavigate();
  const { session, setSession } = useOpsAuth();
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    setError(null);
    try {
      await opsApi.logout();
      setSession(null);
      navigate("/ops/login", { replace: true });
    } catch (logoutError) {
      setError(formatApiError(logoutError));
    }
  }
  return (
    <div className="ops-shell">
      <header className="ops-header">
        <div>
          <p className="eyebrow">Family Manager</p>
          <h1>Operations</h1>
        </div>
        <nav aria-label="Operations">
          {session?.user.role === "PLATFORM_OWNER" ? (
            <>
              <NavLink end className="nav-chip" to="/ops">
                Overview
              </NavLink>
              <NavLink className="nav-chip" to="/ops/modules">
                Global modules
              </NavLink>
              <NavLink className="nav-chip" to="/ops/households">
                Households
              </NavLink>
            </>
          ) : (
            <NavLink className="nav-chip" to="/ops/households">
              Household lookup
            </NavLink>
          )}
          <Button
            className="nav-chip"
            type="button"
            onClick={() => void logout()}
          >
            Log out
          </Button>
        </nav>
      </header>
      <p className="ops-identity">
        Signed in as {session?.user.email} ·{" "}
        {(session?.user.role as string) === "PLATFORM_OWNER"
          ? "Platform owner"
          : "Support"}
      </p>
      {error ? (
        <InlineNotice variant="error">Could not sign out: {error}</InlineNotice>
      ) : null}
      <main className="ops-content">
        <Outlet />
      </main>
    </div>
  );
}

function OpsLoginPage(): ReactElement {
  const navigate = useNavigate();
  const { status, setSession } = useOpsAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status === "authenticated") return <Navigate to="/ops" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const session = await opsApi.login({
        email: email.trim(),
        password,
        totp_code: mfaCode.trim(),
      });
      setSession(session);
      navigate("/ops", { replace: true });
    } catch (loginError) {
      setError(formatApiError(loginError));
    } finally {
      setPending(false);
      setPassword("");
      setMfaCode("");
    }
  }
  return (
    <main className="ops-login">
      <Card as="section">
        <h1>Operations sign in</h1>
        <p>Operator credentials are separate from household accounts.</p>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <FormField label="Operator email">
            <TextInput
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <FormField label="Password">
            <TextInput
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <FormField label="MFA code">
            <TextInput
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
            />
          </FormField>
          <Button disabled={pending} type="submit">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        {error ? (
          <InlineNotice variant="error">
            Could not sign in: {error}
          </InlineNotice>
        ) : null}
      </Card>
    </main>
  );
}

function OpsHouseholdLookupPage(): ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OpsHouseholdSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) {
      setError("Enter a household name, ID, or owner email.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      setResults(await opsApi.searchHouseholds(query.trim()));
      setSearched(true);
    } catch (searchError) {
      setError(formatApiError(searchError));
    } finally {
      setPending(false);
    }
  }
  return (
    <Card as="section" className="ops-panel">
      <h2>Household lookup</h2>
      <form className="ops-search" onSubmit={(event) => void search(event)}>
        <FormField label="Household name, ID, or owner email">
          <TextInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </FormField>
        <Button disabled={pending} type="submit">
          {pending ? "Searching…" : "Search"}
        </Button>
      </form>
      {error ? <InlineNotice variant="error">{error}</InlineNotice> : null}
      {searched && results.length === 0 ? (
        <p role="status">No households matched your search.</p>
      ) : null}
      <div className="ops-result-list">
        {results.map((item) => (
          <NavLink
            key={item.id}
            className="ops-result"
            to={`/ops/households/${item.id}`}
          >
            <strong>{item.name}</strong>
            <span>{item.owner_email}</span>
            <span>{item.billing_status.replace(/_/g, " ")}</span>
          </NavLink>
        ))}
      </div>
    </Card>
  );
}

function OpsStatus({
  title,
  body,
}: {
  title: string;
  body: string;
}): ReactElement {
  return (
    <main className="ops-login">
      <Card as="section">
        <h1>{title}</h1>
        <p role="status">{body}</p>
      </Card>
    </main>
  );
}
function OpsNotFound(): ReactElement {
  return (
    <OpsStatus
      title="Operations page not found"
      body="Return to household lookup."
    />
  );
}
