import { useCallback, useRef, useState } from "react";
import type {
  GlobalModule,
  HouseholdModule,
  OpsReauthRequest,
} from "@family-manager/family-api/ops-models";
import { Button, Card, InlineNotice } from "../ui";
import { formatApiError } from "../lib/errors";
import { opsApi } from "./api/client";
import { useOpsRead } from "./useOpsRead";
import { ModuleConfirmation } from "./ModuleConfirmation";

type Module = GlobalModule | HouseholdModule;
export function OwnerModules({
  householdId,
  householdName,
}: {
  householdId?: number;
  householdName?: string;
}) {
  const load = useCallback(
    (): Promise<Module[]> =>
      householdId === undefined
        ? opsApi.listGlobalModules()
        : opsApi.listOwnerHouseholdModules(householdId),
    [householdId],
  );
  const read = useOpsRead(load);
  const [intent, setIntent] = useState<Module | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [stale, setStale] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const scope =
    householdId === undefined
      ? "All households (global)"
      : `${householdName ?? "Household"} (#${householdId})`;
  async function confirm(reason: string, credentials: OpsReauthRequest) {
    if (!intent || pending) return;
    const target = intent;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await opsApi.reauthenticate(credentials);
      const payload = {
        enabled: !target.enabled,
        expected_enabled: target.enabled,
        reason,
      };
      if (householdId === undefined)
        await opsApi.setGlobalModule(target.key, payload);
      else
        await opsApi.setOwnerHouseholdModule(householdId, target.key, payload);
      setSaved(true);
      read.retry();
    } catch (failure) {
      if (
        failure &&
        typeof failure === "object" &&
        "status" in failure &&
        failure.status === 409
      ) {
        setStale(true);
        setError("State changed. Reload modules before trying again.");
      } else setError(formatApiError(failure));
    } finally {
      setPending(false);
      setIntent(null);
    }
  }
  function reload() {
    setStale(false);
    setError(null);
    read.retry();
  }
  return (
    <Card as="section" className="ops-panel">
      <h2 ref={heading} tabIndex={-1}>
        {householdId === undefined ? "Global modules" : "Household modules"}
      </h2>
      <p>
        {scope}.{" "}
        {householdId === undefined
          ? "Global access gates household availability without deleting household or user grants."
          : "Stored opt-in, global availability, and effective access are shown separately."}
      </p>
      {error ? <InlineNotice variant="error">{error}</InlineNotice> : null}
      {saved ? (
        <p role="status" aria-live="polite">
          {read.pending
            ? "Saved. Verifying module readback…"
            : read.error
              ? "Saved. Readback failed; retry verification only. The change will not be submitted again."
              : "Saved and verified from the server."}
        </p>
      ) : null}
      {read.pending ? (
        !saved ? (
          <p role="status">Loading modules…</p>
        ) : null
      ) : read.error ? (
        <>
          <InlineNotice variant="error">
            Could not load modules: {read.error}
          </InlineNotice>
          <Button onClick={read.retry}>
            {saved ? "Retry module readback" : "Retry modules"}
          </Button>
        </>
      ) : null}
      {stale ? <Button onClick={reload}>Reload modules</Button> : null}
      {!read.pending && !read.error && read.data ? (
        <div className="ops-module-list">
          {read.data.length === 0 ? (
            <p>No modules returned by the server.</p>
          ) : (
            read.data.map((module) => (
              <article key={module.key} className="ops-module">
                <div>
                  <h3>{module.name}</h3>
                  <p>{module.description}</p>
                  {"globally_enabled" in module ? (
                    <dl className="ops-module-states">
                      <div>
                        <dt>Stored opt-in</dt>
                        <dd>{module.enabled ? "Enabled" : "Disabled"}</dd>
                      </div>
                      <div>
                        <dt>Global access</dt>
                        <dd>
                          {module.globally_enabled ? "Enabled" : "Disabled"}
                        </dd>
                      </div>
                      <div>
                        <dt>Effective access</dt>
                        <dd>
                          {module.effective_enabled ? "Enabled" : "Disabled"}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p>
                      <strong>
                        Global: {module.enabled ? "Enabled" : "Disabled"}
                      </strong>{" "}
                      · Web {module.platforms.web ? "supported" : "unavailable"}{" "}
                      · Mobile{" "}
                      {module.platforms.mobile ? "supported" : "unavailable"}
                    </p>
                  )}
                  {module.restriction ? (
                    <p
                      id={`restriction-${module.key}`}
                      className="ops-restriction"
                    >
                      {module.restriction}
                    </p>
                  ) : null}
                </div>
                <Button
                  aria-describedby={
                    module.restriction ? `restriction-${module.key}` : undefined
                  }
                  disabled={
                    pending ||
                    intent !== null ||
                    stale ||
                    (module.enabled ? !module.can_disable : !module.can_enable)
                  }
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setError(null);
                    setSaved(false);
                    setIntent(module);
                  }}
                >
                  {module.enabled ? "Disable" : "Enable"} {module.name}
                </Button>
              </article>
            ))
          )}
        </div>
      ) : null}
      {intent ? (
        <ModuleConfirmation
          module={intent}
          scope={scope}
          pending={pending}
          returnFocusTo={trigger.current}
          fallbackFocusTo={heading.current}
          onConfirm={(reason, credentials) => void confirm(reason, credentials)}
          onClose={() => setIntent(null)}
        />
      ) : null}
    </Card>
  );
}
