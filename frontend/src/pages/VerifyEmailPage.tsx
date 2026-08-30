import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api";
import { clearPasswordResetFragment, readEmailVerificationTokenFromLocation } from "../lib/password-reset-token";
import { ButtonLink, Card, InlineNotice } from "../ui";

export function VerifyEmailPage(): ReactElement {
  const [token] = useState(readEmailVerificationTokenFromLocation);
  const [state, setState] = useState<"working" | "done" | "missing">(token ? "working" : "missing");
  useEffect(() => {
    clearPasswordResetFragment();
    if (!token) return;
    void apiClient.verifyRegistration({ token }).finally(() => setState("done"));
  }, [token]);
  if (state === "missing") return <Card as="section" className="password-reset-card"><h1>Verification Link Unavailable</h1><p>This link is incomplete or has already been removed from the browser.</p><ButtonLink to="/register">Register Again</ButtonLink></Card>;
  return <Card as="section" className="password-reset-card"><h1>{state === "working" ? "Verifying Your Email..." : "Email Verification Processed"}</h1>{state === "working" ? <InlineNotice role="status">Creating your household securely…</InlineNotice> : <><p>Try signing in with the email and password you chose. If the link expired, register again.</p><ButtonLink to="/login">Continue to Sign In</ButtonLink><p className="password-reset-secondary"><Link to="/register">Register again</Link></p></>}</Card>;
}
