import { groupExplorationVersions } from "../features/discovery-lab/lib/catalogGroups";
import { AuthorizedPackage } from "../features/discovery-lab/packages/PackageRuntime";
import { PackageAuthorPanel } from "../features/discovery-lab/packages/PackageAuthorPanel";
import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../api";
import { useAuth } from "../auth/useAuth";
import { Button, InlineNotice } from "../ui";
import { DiscoveryAccessPanel } from "../features/discovery-lab/components/DiscoveryAccessPanel";
import { DiscoveryFilters } from "../features/discovery-lab/components/DiscoveryFilters";
import { ExplorationArtwork } from "../features/discovery-lab/components/ExplorationArtwork";
import { useDiscoveryRead } from "../features/discovery-lab/hooks/useDiscoveryRead";
import {
  EMPTY_DISCOVERY_FILTERS,
  filterExplorations,
} from "../features/discovery-lab/lib/filters";
import { ExplorationSimulation } from "../features/discovery-lab/simulations/ExplorationSimulation";
import "../features/discovery-lab/discovery-lab.css";

function useDiscoveryIdentity() {
  const { user, status, moduleKeys, manageableModuleKeys } = useAuth();
  return {
    identity: `${user?.household_id}:${user?.id}:${user?.child_id}`,
    allowed: status === "authenticated" && moduleKeys.includes("discovery-lab"),
    manage:
      user !== null &&
      user.role !== "CHILD" &&
      manageableModuleKeys.includes("discovery-lab"),
  };
}
function DiscoveryUnavailable() {
  return (
    <div className="discovery-empty">
      <h1>Discovery Lab is not enabled</h1>
      <p>
        Ask a household admin to enable Discovery Lab and grant your account
        access in module settings.
      </p>
    </div>
  );
}
export function DiscoveryLabPage() {
  const { identity, allowed, manage } = useDiscoveryIdentity();
  const read = useCallback(() => apiClient.listDiscoveryExplorations(), []);
  const catalog = useDiscoveryRead(identity, read, allowed);
  const [filters, setFilters] = useState(EMPTY_DISCOVERY_FILTERS);
  if (!allowed) return <DiscoveryUnavailable />;
  const items = catalog.data ?? [];
  const visible = filterExplorations(items, filters);
  const groups = groupExplorationVersions(visible);
  return (
    <div className="discovery-lab">
      <header className="discovery-hero discovery-hero--compact">
        <div className="discovery-hero-copy">
          <h1>Discovery Lab</h1>
          {manage && (
            <Link className="discovery-manage-link" to="/discovery-lab/manage">
              Choose Explorations for each child{" "}
              <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
      </header>
      {catalog.loading ? (
        <p className="discovery-loading">Loading Explorations…</p>
      ) : catalog.error ? (
        <div>
          <InlineNotice variant="error">
            Could not open Discovery Lab: {catalog.error}
          </InlineNotice>
          <Button onClick={catalog.refresh}>Try again</Button>
        </div>
      ) : items.length === 0 ? (
        <section className="discovery-empty">
          <h2>No Explorations enabled</h2>
          <p>
            No Explorations are available for your account yet. A parent can
            choose which pages you can explore.
          </p>
        </section>
      ) : (
        <>
          <div className="discovery-section-heading">
            <div>
              <h2>Explorations</h2>
            </div>
            <span>
              {groups.length} of {groupExplorationVersions(items).length}{" "}
              Explorations
            </span>
          </div>
          <DiscoveryFilters
            items={items}
            filters={filters}
            onChange={setFilters}
          />
          {!visible.length ? (
            <section className="discovery-empty">
              <h3>No Explorations match those filters</h3>
              <p>Try a different question, subject, grade, or tag.</p>
            </section>
          ) : (
            <div className="discovery-card-grid">
              {groups.map(({ item, alternatives }, index) => (
                <article className="discovery-card" key={item.id}>
                  <Link
                    className="discovery-card-primary"
                    to={`/discovery-lab/${item.id}`}
                  >
                    <div className="discovery-card-art">
                      <ExplorationArtwork id={item.id} />
                      <span className="discovery-card-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="discovery-card-copy">
                      <div className="discovery-card-meta">
                        <span>{item.subject}</span>
                        <span>{item.duration_minutes} min</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.summary}</p>
                      <div className="discovery-tags">
                        <span>Grades {item.grade_bands.join(" · ")}</span>
                        {item.tags.slice(0, 2).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      <span className="discovery-card-start">
                        Open Exploration <span aria-hidden="true">↗</span>
                      </span>
                    </div>
                  </Link>
                  {alternatives.map((alternative) => (
                    <Link
                      key={alternative.id}
                      className="discovery-package-alternative"
                      to={`/discovery-lab/${alternative.id}`}
                    >
                      Open version {alternative.package?.version}
                    </Link>
                  ))}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function DiscoveryExplorationPage() {
  const { explorationId = "" } = useParams();
  const { identity, allowed } = useDiscoveryIdentity();
  const read = useCallback(
    () => apiClient.getDiscoveryExploration(explorationId),
    [explorationId],
  );
  const exploration = useDiscoveryRead(
    `${identity}:${explorationId}`,
    read,
    allowed,
  );
  if (!allowed) return <DiscoveryUnavailable />;
  const item = exploration.data;
  return (
    <div className="discovery-lab discovery-detail">
      <Link className="discovery-back" to="/discovery-lab">
        ← All Explorations
      </Link>
      {exploration.loading ? (
        <p className="discovery-loading">Setting up your Exploration…</p>
      ) : exploration.error ? (
        <div className="discovery-empty">
          <h1>This Exploration is not available</h1>
          <InlineNotice variant="error">{exploration.error}</InlineNotice>
          <p>
            A parent may have changed access, or the page could not be loaded.
          </p>
          <Button onClick={exploration.refresh}>Try again</Button>
        </div>
      ) : (
        item && (
          <>
            <header className="discovery-detail-heading">
              <div className="discovery-eyebrow">
                {item.subject} · Grades {item.grade_bands.join(" · ")} · About{" "}
                {item.duration_minutes} minutes
              </div>
              <h1>{item.title}</h1>
              <p>{item.question}</p>
              <div className="discovery-tags">
                {item.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </header>
            <section
              className="discovery-experiment-stage"
              aria-label="Interactive experiment"
            >
              {item.package ? (
                <AuthorizedPackage
                  key={`${identity}:${item.id}:${item.package.version}`}
                  id={item.id}
                  expectedChecksum={item.package.checksum}
                  identity={identity}
                />
              ) : (
                <ExplorationSimulation
                  key={`${identity}:${item.id}`}
                  explorationId={item.id}
                />
              )}
            </section>
            <div className="discovery-learning-grid">
              <section className="discovery-explanation">
                <h2>What’s happening?</h2>
                <p>{item.explanation}</p>
                <aside className="discovery-misconception">
                  <h3>Common misconception</h3>
                  <p>{item.misconception}</p>
                </aside>
              </section>
              <section className="discovery-guides">
                <h2>Guided experiments</h2>
                <ol>
                  {item.experiments.map((experiment, index) => (
                    <li key={experiment.title}>
                      <span className="discovery-step" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div>
                        <h3>{experiment.title}</h3>
                        <p>{experiment.instruction}</p>
                        <p className="discovery-observe">
                          <strong>Notice:</strong> {experiment.observe}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <footer className="discovery-sources">
              <details>
                <summary>Sources and references</summary>
                <ul>
                  {item.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.title}{" "}
                        <span className="discovery-sr-only">
                          (opens in a new tab)
                        </span>
                        ↗
                      </a>
                    </li>
                  ))}
                </ul>
                <p>
                  These links open outside Family Manager. The interactive
                  models simplify the real world; read their labels and
                  assumptions.
                </p>
              </details>
            </footer>
          </>
        )
      )}
    </div>
  );
}

export function DiscoveryAccessPage() {
  const [packageRevision, setPackageRevision] = useState(0);
  const [view, setView] = useState<"access" | "authoring">("access");
  const { identity, allowed, manage } = useDiscoveryIdentity();
  if (!allowed) return <DiscoveryUnavailable />;
  return (
    <div className="discovery-lab">
      <Link className="discovery-back" to="/discovery-lab">
        ← Back to the lab
      </Link>
      <header className="discovery-settings-heading">
        <h1>Choose available Explorations</h1>
        <p>
          Turn individual Explorations on or off, or filter by subject, grade
          band, and tags to change a matching group.
        </p>
      </header>
      {manage ? (
        <>
          <nav className="discovery-actions" aria-label="Discovery management">
            <Button
              className={view === "access" ? "" : "discovery-secondary"}
              aria-pressed={view === "access"}
              onClick={() => setView("access")}
            >
              Child access
            </Button>
            <Button
              className={view === "authoring" ? "" : "discovery-secondary"}
              aria-pressed={view === "authoring"}
              onClick={() => setView("authoring")}
            >
              Package authoring
            </Button>
          </nav>
          <div hidden={view !== "access"}>
            <DiscoveryAccessPanel key={`${identity}:${packageRevision}`} />
          </div>
          {view === "authoring" && (
            <PackageAuthorPanel
              key={`packages:${identity}`}
              identity={identity}
              onPublished={() => setPackageRevision((value) => value + 1)}
            />
          )}
        </>
      ) : (
        <InlineNotice>
          Only parents with management access can change Explorations.
        </InlineNotice>
      )}
    </div>
  );
}
