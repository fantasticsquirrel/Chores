import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../../api";
import { useAuth } from "../../../auth/useAuth";
import { formatApiError } from "../../../lib/errors";
import { Button, InlineNotice } from "../../../ui";
import { useDiscoveryRead } from "../hooks/useDiscoveryRead";
import { EMPTY_DISCOVERY_FILTERS, filterExplorations } from "../lib/filters";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { ExplorationArtwork } from "./ExplorationArtwork";

export function DiscoveryAccessPanel() {
  const { user } = useAuth();
  const identity = `${user?.household_id}:${user?.id}`;
  const readChildren = useCallback(() => apiClient.listDiscoveryChildren(), []);
  const children = useDiscoveryRead(identity, readChildren, true, true);
  const [chosenChild, setChosenChild] = useState<number | null>(null);
  const childId = children.data?.some((child) => child.id === chosenChild)
    ? chosenChild
    : (children.data?.[0]?.id ?? null);
  const child = children.data?.find((item) => item.id === childId);
  const readAccess = useCallback(
    () => apiClient.getDiscoveryChildAccess(childId!),
    [childId],
  );
  const accessKey = `${identity}:${childId}`;
  const access = useDiscoveryRead(accessKey, readAccess, childId !== null);
  const [filters, setFilters] = useState(EMPTY_DISCOVERY_FILTERS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const activeKey = useRef(accessKey);
  const mounted = useRef(true);
  activeKey.current = accessKey;
  useEffect(() => {
    mounted.current = true;
    return () => {
      activeKey.current = "retired";
      mounted.current = false;
    };
  }, []);
  const items = access.data?.explorations ?? [];
  const matched = filterExplorations(items, filters);

  async function update(enabled: boolean, ids: string[]) {
    if (childId === null || busy.current || !ids.length) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    setMessage(null);
    const key = accessKey;
    try {
      const result = await apiClient.updateDiscoveryChildAccess(childId, {
        enabled,
        exploration_ids: ids,
        ...(enabled &&
        items.some((item) => ids.includes(item.id) && item.package)
          ? {
              package_versions: Object.fromEntries(
                items
                  .filter((item) => ids.includes(item.id) && item.package)
                  .map((item) => [item.id, item.package!.version]),
              ),
            }
          : {}),
      });
      if (activeKey.current === key) {
        access.replace(result);
        setMessage(
          `Updated ${ids.length} exploration${ids.length === 1 ? "" : "s"} for ${child?.name ?? "this child"}.`,
        );
      }
    } catch (caught) {
      if (activeKey.current === key)
        setError(`Could not save access: ${formatApiError(caught)}`);
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  if (children.loading)
    return <p className="discovery-loading">Opening family settings…</p>;
  if (children.error)
    return (
      <>
        <InlineNotice variant="error">
          Could not load children: {children.error}
        </InlineNotice>
        <Button onClick={children.refresh}>Try again</Button>
      </>
    );
  if (!children.data?.length)
    return (
      <div className="discovery-empty">
        <h2>No children yet</h2>
        <p>
          Create a child in your household before choosing their Explorations.
        </p>
      </div>
    );

  return (
    <section
      className="discovery-access"
      aria-label="Exploration access settings"
    >
      <div className="discovery-settings-intro">
        <label className="discovery-child-picker">
          Choose a child
          <select
            value={childId ?? ""}
            disabled={saving}
            onChange={(event) => {
              setChosenChild(Number(event.target.value));
              setMessage(null);
              setError(null);
            }}
          >
            {children.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <p>
          Choose what {child?.name} can open. Turning off an Exploration removes
          it from their library and blocks its direct link. Account and
          household module access still apply.
        </p>
      </div>
      <details className="discovery-policy">
        <summary>How individual and group choices work</summary>
        <p>
          Bundled Explorations start enabled once Discovery Lab is enabled for
          the household and child’s account. A group change updates only the
          pages matching all current filters. It writes an individual choice for
          each matched page, replacing earlier choices for those pages.
          Everything else stays unchanged. Newly added bundled Explorations
          start enabled; existing choices are preserved. Uploaded packages are
          off until you approve their exact published version. Publishing or
          rolling back a package requires approval again.
        </p>
      </details>
      {access.loading ? (
        <p className="discovery-loading">
          Loading {child?.name}’s Explorations…
        </p>
      ) : access.error ? (
        <>
          <InlineNotice variant="error">
            Could not load access: {access.error}
          </InlineNotice>
          <Button onClick={access.refresh}>Try again</Button>
        </>
      ) : (
        <>
          <DiscoveryFilters
            items={items}
            filters={filters}
            onChange={setFilters}
            disabled={saving}
          />
          <div className="discovery-bulk-panel">
            <div>
              <strong>
                {matched.length} matching exploration
                {matched.length === 1 ? "" : "s"}
              </strong>
              <p>
                Changes below affect only {child?.name}. Filters combine:
                subject AND grade AND tag AND search.
              </p>
            </div>
            <div className="discovery-actions">
              <Button
                disabled={saving || !matched.length}
                onClick={() =>
                  void update(
                    true,
                    matched.map((item) => item.id),
                  )
                }
              >
                {saving
                  ? "Saving…"
                  : `Turn on ${matched.length} matching exploration${matched.length === 1 ? "" : "s"}`}
              </Button>
              <Button
                className="discovery-secondary"
                disabled={saving || !matched.length}
                onClick={() =>
                  void update(
                    false,
                    matched.map((item) => item.id),
                  )
                }
              >
                Turn off {matched.length} matching exploration
                {matched.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
          {error && <InlineNotice variant="error">{error}</InlineNotice>}
          {message && (
            <InlineNotice variant="success" role="status">
              {message}
            </InlineNotice>
          )}
          {!matched.length ? (
            <div className="discovery-empty">
              <h2>No matching Explorations</h2>
              <p>Clear a filter to see more pages.</p>
            </div>
          ) : (
            <ul className="discovery-access-list">
              {matched.map((item) => (
                <li key={item.id} className={item.enabled ? "" : "is-disabled"}>
                  <ExplorationArtwork id={item.id} />
                  <div className="discovery-access-copy">
                    <span className="discovery-eyebrow">
                      {item.subject} · Grades {item.grade_bands.join(", ")}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    {item.package && (
                      <p>Package version {item.package.version} · Web only</p>
                    )}
                    <span className="discovery-choice-note">
                      {item.override === null
                        ? "Default choice"
                        : "Saved individual choice"}
                    </span>
                  </div>
                  <label className="discovery-toggle">
                    <input
                      type="checkbox"
                      aria-label={`Enable ${item.title}`}
                      checked={item.enabled}
                      disabled={saving}
                      onChange={(event) =>
                        void update(event.target.checked, [item.id])
                      }
                    />
                    <span>{item.enabled ? "On" : "Off"}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
