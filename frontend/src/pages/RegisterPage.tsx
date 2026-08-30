import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api";
import { formatApiError } from "../lib/errors";
import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";

const MIN_PASSWORD = 15;

export function RegisterPage(): ReactElement {
  const [email, setEmail] = useState("");
  const [household, setHousehold] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) { setError("Passwords must match."); return; }
    setBusy(true); setError(null);
    try {
      await apiClient.requestRegistration({ email: email.trim(), password, household_name: household.trim(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
      setDone(true); setPassword(""); setConfirmation("");
    } catch (caught) { setError(formatApiError(caught)); }
    finally { setBusy(false); }
  }
  return <Card as="section" className="password-reset-card registration-card">
    <h1>Create Your Household</h1>
    <p>Start a new Family Manager household. We’ll email you a link before creating the account.</p>
    {done ? <><InlineNotice role="status">Check your email for the verification link. The household is created only after you open it.</InlineNotice><p className="password-reset-secondary"><Link to="/login">Back to sign in</Link></p></> :
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      <FormField label="Household name"><TextInput value={household} onChange={e => setHousehold(e.target.value)} maxLength={255} placeholder="The Smith Family" required /></FormField>
      <FormField label="Email"><TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={320} autoComplete="email" required /></FormField>
      <FormField label="Password"><TextInput type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={MIN_PASSWORD} maxLength={1024} autoComplete="new-password" required /></FormField>
      <FormField label="Confirm password"><TextInput type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={MIN_PASSWORD} maxLength={1024} autoComplete="new-password" required /></FormField>
      <p className="password-reset-policy">Use at least {MIN_PASSWORD} characters.</p>
      <Button type="submit" disabled={busy}>{busy ? "Sending Verification..." : "Create Account"}</Button>
      {error ? <InlineNotice variant="error">Could not register: {error}</InlineNotice> : null}
      <p className="password-reset-secondary"><Link to="/login">Already have an account? Sign in</Link></p>
    </form>}
  </Card>;
}
