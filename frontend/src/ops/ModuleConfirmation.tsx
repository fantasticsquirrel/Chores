import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type {
  ModuleAccessSummary,
  OpsReauthRequest,
} from "@family-manager/family-api/ops-models";
import { Button, FormField, TextInput } from "../ui";

export function ModuleConfirmation({
  module,
  scope,
  pending,
  returnFocusTo,
  fallbackFocusTo,
  onConfirm,
  onClose,
}: {
  module: ModuleAccessSummary;
  scope: string;
  pending: boolean;
  returnFocusTo: HTMLElement | null;
  fallbackFocusTo: HTMLElement | null;
  onConfirm: (reason: string, credentials: OpsReauthRequest) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [mfa, setMfa] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const restoreFrame = useRef<number | null>(null);
  useEffect(() => {
    if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
    restoreFrame.current = null;
    form.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      // Wait for the parent to re-enable the trigger or finish readback layout.
      restoreFrame.current = requestAnimationFrame(() => {
        const target =
          returnFocusTo?.isConnected && !returnFocusTo.hasAttribute("disabled")
            ? returnFocusTo
            : fallbackFocusTo;
        if (target?.isConnected) target.focus();
      });
    };
  }, [returnFocusTo, fallbackFocusTo]);
  useEffect(() => {
    if (pending) form.current?.focus();
  }, [pending]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (
      pending ||
      reason.trim().length < 3 ||
      !password ||
      !/^\d{6}$/.test(mfa)
    )
      return;
    const credentials = { password, totp_code: mfa };
    setPassword("");
    setMfa("");
    onConfirm(reason.trim(), credentials);
  }
  function keyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onClose();
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      form.current?.querySelectorAll<HTMLElement>(
        "input:not(:disabled),button:not(:disabled)",
      ) ?? [],
    );
    if (controls.length === 0) {
      event.preventDefault();
      form.current?.focus();
      return;
    }
    const first = controls[0],
      last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  return (
    <div className="ops-dialog-backdrop" onKeyDown={keyDown}>
      <section
        className="ops-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-confirm-title"
        aria-describedby="module-confirm-impact"
      >
        <h3 id="module-confirm-title">Confirm module change</h3>
        <p id="module-confirm-impact">
          <strong>
            {module.enabled ? "Disable" : "Enable"} {module.name}
          </strong>{" "}
          · {scope}.{" "}
          {scope === "All households (global)"
            ? "This changes availability across every household; existing household opt-ins and user grants are preserved."
            : "This changes only this household’s stored opt-in. Global availability and user grants still apply."}
        </p>
        <form ref={form} tabIndex={-1} onSubmit={submit} className="ops-stack">
          <fieldset disabled={pending} className="ops-stack">
            <legend>Operator authorization</legend>
            <FormField label="Change reason">
              <TextInput
                required
                minLength={3}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
            <FormField label="Current operator password">
              <TextInput
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </FormField>
            <FormField label="Six-digit MFA code">
              <TextInput
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={mfa}
                onChange={(event) => setMfa(event.target.value)}
              />
            </FormField>
          </fieldset>
          <div className="ops-actions">
            <Button disabled={pending} type="submit">
              {pending ? "Authorizing and saving…" : "Confirm change"}
            </Button>
            <Button disabled={pending} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
