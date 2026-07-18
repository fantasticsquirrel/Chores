import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { OpsAuditEntry, OpsEventSummary, OpsHouseholdDetail, OpsHouseholdSummary } from "@family-manager/family-api/ops-models";

import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";
import { formatApiError } from "../lib/errors";
import { opsApi } from "./api/client";
import { OpsAuthProvider } from "./auth/OpsAuthContext";
import { useOpsAuth } from "./auth/OpsAuthState";

export function OpsApp(): ReactElement {
  return (
    <OpsAuthProvider>
      <Routes>
        <Route path="/ops/login" element={<OpsLoginPage />} />
        <Route element={<OpsProtectedRoute />}>
          <Route element={<OpsShell />}>
            <Route path="/ops" element={<Navigate to="/ops/households" replace />} />
            <Route path="/ops/households" element={<OpsHouseholdLookupPage />} />
            <Route path="/ops/households/:householdId" element={<OpsHouseholdDetailPage />} />
            <Route path="*" element={<OpsNotFound />} />
          </Route>
        </Route>
      </Routes>
    </OpsAuthProvider>
  );
}

function OpsProtectedRoute(): ReactElement {
  const { status } = useOpsAuth();
  if (status === "loading") return <OpsStatus title="Checking operations session" body="Verifying separate operator access." />;
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
        <div><p className="eyebrow">Family Manager</p><h1>Operations</h1></div>
        <nav aria-label="Operations">
          <NavLink className="nav-chip" to="/ops/households">Household lookup</NavLink>
          <Button className="nav-chip" type="button" onClick={() => void logout()}>Log out</Button>
        </nav>
      </header>
      <p className="ops-identity">Signed in as {session?.user.email} · {(session?.user.role as string) === "PLATFORM_OWNER" ? "Platform owner" : "Support"}</p>
      {error ? <InlineNotice variant="error">Could not sign out: {error}</InlineNotice> : null}
      <main className="ops-content"><Outlet /></main>
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
  if (status === "authenticated") return <Navigate to="/ops/households" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true); setError(null);
    try {
      const session = await opsApi.login({
        email: email.trim(),
        password,
        totp_code: mfaCode.trim(),
      });
      setSession(session);
      navigate("/ops/households", { replace: true });
    } catch (loginError) { setError(formatApiError(loginError)); }
    finally { setPending(false); }
  }
  return (
    <main className="ops-login"><Card as="section"><h1>Operations sign in</h1><p>Operator credentials are separate from household accounts.</p>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <FormField label="Operator email"><TextInput type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></FormField><FormField label="Password"><TextInput type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></FormField><FormField label="MFA code"><TextInput inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} /></FormField>
        <Button disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in"}</Button>
      </form>{error ? <InlineNotice variant="error">Could not sign in: {error}</InlineNotice> : null}</Card></main>
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
    if (!query.trim()) { setError("Enter a household name, ID, or owner email."); return; }
    setPending(true); setError(null);
    try { setResults(await opsApi.searchHouseholds(query.trim())); setSearched(true); }
    catch (searchError) { setError(formatApiError(searchError)); }
    finally { setPending(false); }
  }
  return <Card as="section" className="ops-panel"><h2>Household lookup</h2><form className="ops-search" onSubmit={(event) => void search(event)}><FormField label="Household name, ID, or owner email"><TextInput type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></FormField><Button disabled={pending} type="submit">{pending ? "Searching…" : "Search"}</Button></form>{error ? <InlineNotice variant="error">{error}</InlineNotice> : null}{searched && results.length === 0 ? <p role="status">No households matched your search.</p> : null}<div className="ops-result-list">{results.map((item) => <NavLink key={item.id} className="ops-result" to={`/ops/households/${item.id}`}><strong>{item.name}</strong><span>{item.owner_email}</span><span>{item.billing_status.replace(/_/g, " ")}</span></NavLink>)}</div></Card>;
}

function OpsHouseholdDetailPage(): ReactElement {
  const id = Number(useParams().householdId);
  const { session } = useOpsAuth();
  const [detail, setDetail] = useState<OpsHouseholdDetail | null>(null);
  const [events, setEvents] = useState<OpsEventSummary[]>([]);
  const [audit, setAudit] = useState<OpsAuditEntry[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!Number.isSafeInteger(id) || id <= 0) { setError("Invalid household ID."); setPending(false); return; }
    void opsApi.getHousehold(id).then((value) => { if (active) setDetail(value); }).catch((loadError) => { if (active) setError(formatApiError(loadError)); }).finally(() => { if (active) setPending(false); });
    void opsApi.listHouseholdEvents(id).then((value) => { if (active) { setEvents(value); setEventsError(null); } }).catch((loadError) => { if (active) setEventsError(formatApiError(loadError)); });
    void opsApi.listAuditEntries(id).then((value) => { if (active) { setAudit(value); setAuditError(null); } }).catch((loadError) => { if (active) setAuditError(formatApiError(loadError)); });
    return () => { active = false; };
  }, [id]);
  if (pending) return <OpsStatus title="Loading household" body="Loading billing and support-safe summaries." />;
  if (error || detail === null) return <InlineNotice variant="error">Could not load household: {error ?? "Unknown error"}</InlineNotice>;
  async function retryEvents() { setEventsError(null); try { setEvents(await opsApi.listHouseholdEvents(id)); } catch (loadError) { setEventsError(formatApiError(loadError)); } }
  async function retryAudit() { setAuditError(null); try { setAudit(await opsApi.listAuditEntries(id)); } catch (loadError) { setAuditError(formatApiError(loadError)); } }
  return <div className="ops-detail"><Card as="section"><h2>{detail.name}</h2><dl className="ops-summary"><div><dt>Owner</dt><dd>{detail.owner_email}</dd></div><div><dt>Billing</dt><dd>{detail.billing.status.replace(/_/g, " ")}</dd></div><div><dt>Plan</dt><dd>{detail.billing.plan_name ?? "None"}</dd></div></dl></Card><SummaryList title="Entitlements" empty="No entitlements." items={detail.entitlements.map((item) => `${item.key}: ${item.status}`)} /><SummaryList title="Events" empty="No event summaries available." items={events.map((item) => item.summary)} error={eventsError ? `Could not load events: ${eventsError}` : null} retryLabel="Retry events" onRetry={() => void retryEvents()} /><SummaryList title="Audit" empty="No audit summaries available." items={audit.map((item) => `${item.action} · ${item.actor_email}`)} error={auditError ? `Could not load audit: ${auditError}` : null} retryLabel="Retry audit" onRetry={() => void retryAudit()} /><SupportCases detail={detail} onDetail={setDetail} />{(session?.user.role as string) === "PLATFORM_OWNER" ? <OwnerControls detail={detail} onDetail={setDetail} /> : null}</div>;
}

function SupportCases({ detail, onDetail }: { detail: OpsHouseholdDetail; onDetail: (value: OpsHouseholdDetail) => void }): ReactElement {
  const [note, setNote] = useState(""); const [caseId, setCaseId] = useState(detail.support_cases[0]?.id ?? 0); const [newCaseReason, setNewCaseReason] = useState(""); const [reconcileReason, setReconcileReason] = useState(""); const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null);
  async function openCase() { if (!newCaseReason.trim()) { setError("Enter a reason for the support case."); return; } setError(null); try { const created = await opsApi.createSupportCase(detail.id, { reason: newCaseReason.trim() }); onDetail({ ...detail, support_cases: [created, ...detail.support_cases] }); setCaseId(created.id); setNewCaseReason(""); setMessage("Support case opened."); } catch (caseError) { setError(formatApiError(caseError)); } }
  async function append() { if (!caseId || !note.trim()) { setError("Choose a case and enter a note."); return; } setError(null); try { const result = await opsApi.appendSupportNote(caseId, { body: note.trim() }); onDetail({ ...detail, support_cases: detail.support_cases.map((item) => item.id === caseId ? { ...item, notes: [...item.notes, result] } : item) }); setNote(""); setMessage("Note appended."); } catch (noteError) { setError(formatApiError(noteError)); } }
  async function reconcile() { if (!caseId || !reconcileReason.trim()) { setError("Choose a case and enter a reconciliation reason."); return; } setError(null); try { onDetail(await opsApi.reconcileHousehold(detail.id, { case_id: caseId, reason: reconcileReason.trim() })); setMessage("Billing projection reconciled."); } catch (reconcileError) { setError(formatApiError(reconcileError)); } }
  return <Card as="section"><h3>Support cases</h3><FormField label="New case reason"><TextInput value={newCaseReason} onChange={(event) => setNewCaseReason(event.target.value)} /></FormField><Button type="button" onClick={() => void openCase()}>Open support case</Button>{detail.support_cases.length === 0 ? <p>No support cases.</p> : <label>Case<select value={caseId} onChange={(event) => setCaseId(Number(event.target.value))}>{detail.support_cases.map((item) => <option key={item.id} value={item.id}>{item.subject}</option>)}</select></label>}<FormField label="Append-only note"><TextInput value={note} onChange={(event) => setNote(event.target.value)} /></FormField><Button type="button" onClick={() => void append()}>Append note</Button><FormField label="Reconciliation reason"><TextInput value={reconcileReason} onChange={(event) => setReconcileReason(event.target.value)} /></FormField><Button type="button" onClick={() => void reconcile()}>Reconcile billing</Button>{error ? <InlineNotice variant="error">{error}</InlineNotice> : null}{message ? <InlineNotice variant="info" role="status" aria-live="polite">{message}</InlineNotice> : null}</Card>;
}

function OwnerControls({ detail, onDetail }: { detail: OpsHouseholdDetail; onDetail: (value: OpsHouseholdDetail) => void }): ReactElement {
  const [expiresAt, setExpiresAt] = useState(""); const [reason, setReason] = useState(""); const [idempotency, setIdempotency] = useState(""); const [password, setPassword] = useState(""); const [mfaCode, setMfaCode] = useState(""); const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null);
  async function grant() { if (!expiresAt || !reason.trim() || !idempotency.trim() || !password || !/^\d{6}$/.test(mfaCode)) { setError("Expiry, reason, idempotency key, password, and six-digit MFA code are required"); return; } const expiry = new Date(expiresAt); if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) { setError("Expiry must be a valid future date and time"); return; } setError(null); try { await opsApi.reauthenticate({ password, totp_code: mfaCode }); onDetail(await opsApi.grantComplimentary(detail.id, { expires_at: expiry.toISOString(), reason: reason.trim(), idempotency_key: idempotency.trim() })); setPassword(""); setMfaCode(""); setMessage("Complimentary access updated."); } catch (grantError) { setError(formatApiError(grantError)); } }
  return <Card as="section"><h3>Complimentary access</h3><div className="ops-form-grid"><FormField label="Expires at"><TextInput type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></FormField><FormField label="Reason"><TextInput value={reason} onChange={(event) => setReason(event.target.value)} /></FormField><FormField label="Idempotency key"><TextInput value={idempotency} onChange={(event) => setIdempotency(event.target.value)} /></FormField><FormField label="Owner password"><TextInput type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></FormField><FormField label="MFA code"><TextInput inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} /></FormField></div><div className="ops-actions"><Button type="button" onClick={() => void grant()}>Grant or extend</Button></div>{error ? <InlineNotice variant="error">{error}</InlineNotice> : null}{message ? <InlineNotice variant="info" role="status" aria-live="polite">{message}</InlineNotice> : null}</Card>;
}

function SummaryList({ title, empty, items, error = null, retryLabel, onRetry }: { title: string; empty: string; items: string[]; error?: string | null; retryLabel?: string; onRetry?: () => void }): ReactElement { return <Card as="section"><h3>{title}</h3>{error ? <><InlineNotice variant="error">{error}</InlineNotice>{retryLabel && onRetry ? <Button type="button" onClick={onRetry}>{retryLabel}</Button> : null}</> : items.length === 0 ? <p>{empty}</p> : <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>}</Card>; }
function OpsStatus({ title, body }: { title: string; body: string }): ReactElement { return <main className="ops-login"><Card as="section"><h1>{title}</h1><p role="status">{body}</p></Card></main>; }
function OpsNotFound(): ReactElement { return <OpsStatus title="Operations page not found" body="Return to household lookup." />; }
