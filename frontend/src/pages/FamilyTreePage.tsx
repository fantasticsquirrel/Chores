import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import type { LayoutOptions } from "@family-manager/family-tree-core";
import {
  apiClient,
  type FamilyTreePerson,
  type FamilyTreePeoplePage,
  type FamilyTreeMutationResult,
} from "../api";
import { Card, Button, InlineNotice } from "../ui";
import { formatApiError } from "../lib/errors";
import { FamilyTreeDialog } from "../features/family-tree/components/FamilyTreeDialog";
import { useFamilyTreeAccess } from "../features/family-tree/hooks/useFamilyTreeAccess";
import {
  TreeRuntimeContext,
  useTreeRuntime,
} from "../features/family-tree/hooks/useTreeCommand";
import {
  useTreeRead,
  useTreePages,
} from "../features/family-tree/hooks/useTreeReads";
import { graphParams } from "../features/family-tree/lib/workflows/workflows";
import {
  personEditor,
  type EditorSpec,
  type EditorDraft,
} from "../features/family-tree/lib/workflows/editors";
import { FamilyTreeDirectory } from "../features/family-tree/forms/FamilyTreeDirectory";
import { TreeAdvancedTools } from "../features/family-tree/forms/TreeAdvancedTools";
import { FamilyTreeComparison } from "../features/family-tree/forms/FamilyTreeComparison";
import { RecordEditor } from "../features/family-tree/forms/RecordEditor";
import {
  PersonDetails,
  RelativeChooser,
  IdentityChooser,
} from "../features/family-tree/forms/PersonDetails";
import { useGraphContinuation } from "../features/family-tree/hooks/useGraphContinuation";
import { FamilyTreeAccessNotice } from "../features/family-tree/components/FamilyTreeAccessNotice";
import { ProtectedTree } from "../features/family-tree/hooks/ProtectedTree";
import { TreeGraphPanel } from "../features/family-tree/components/TreeGraphPanel";
import "../features/family-tree/forms/workflows.css";

export function FamilyTreePage(): ReactElement {
  const { access, refresh, revoke } = useFamilyTreeAccess();
  if (access.state !== "allowed")
    return <FamilyTreeAccessNotice access={access} refresh={refresh} />;
  return (
    <ProtectedTree
      key={access.owner}
      owner={access.owner!}
      manage={access.manage}
      checking={!!access.checking}
      revoke={revoke}
    >
      <TreeWorkspace />
    </ProtectedTree>
  );
}
function positiveId(token: string | undefined | null): number | null {
  if (!token || !/^[1-9]\d*$/.test(token)) return null;
  const id = Number(token);
  return Number.isSafeInteger(id) ? id : null;
}
function lensDepth(params: URLSearchParams, key: string) {
  const value = Number(params.get(key) ?? "2");
  return Number.isInteger(value) && value >= 0 && value <= 10 ? value : 2;
}
function TreeWorkspace() {
  const runtime = useTreeRuntime();
  const { manage, online, busy: commandBusy, floor } = runtime;
  const busy = commandBusy || !!runtime.checking;
  const navigate = useNavigate(),
    { personId } = useParams(),
    [searchParams, setSearchParams] = useSearchParams();
  const collection = useTreeRead(
    ["collection"],
    (requestOptions) =>
      apiClient.getFamilyTreeCollection(requestOptions).then((value) => {
        floor.current = Math.max(floor.current, value.graph_revision);
        return value;
      }),
    online,
  );
  const [query, setQuery] = useState(""),
    [tag, setTag] = useState(""),
    [living, setLiving] = useState(""),
    [archived, setArchived] = useState(false);
  const people = useTreePages<FamilyTreePerson, FamilyTreePeoplePage>(
    ["directory", query, tag, living, archived],
    (cursor, requestOptions) =>
      apiClient.listFamilyTreePeople(
        {
          query,
          tag: tag || null,
          living_status: (living || null) as
            | "living"
            | "deceased"
            | "unknown"
            | null,
          archived,
          cursor,
          limit: 40,
        },
        requestOptions,
      ),
    !!collection.data && online,
  );
  const selected = positiveId(personId),
    requestedFocus = searchParams.get("focus"),
    focus =
      positiveId(requestedFocus) ??
      selected ??
      collection.data?.default_focus_person_id ??
      null;
  const invalidId = !!personId && !selected,
    invalidFocus =
      requestedFocus !== null && positiveId(requestedFocus) === null;

  const options = useMemo<LayoutOptions>(
    () => ({
      ancestorDepth: lensDepth(searchParams, "up"),
      descendantDepth: lensDepth(searchParams, "down"),
      includeCare: searchParams.get("care") === "1",
      includePartners: searchParams.get("partners") !== "0",
      showHistoricalPartners: searchParams.get("history") === "1",
      collapsedAncestors: (searchParams.get("collapsedUp") ?? "")
        .split(",")
        .map(positiveId)
        .filter((id): id is number => id !== null),
      collapsedDescendants: (searchParams.get("collapsedDown") ?? "")
        .split(",")
        .map(positiveId)
        .filter((id): id is number => id !== null),
    }),
    [searchParams],
  );
  const params = graphParams(focus, options),
    graphKey = ["graph", params] as const;
  const graph = useTreeRead(
    graphKey,
    (requestOptions) => apiClient.getFamilyTreeGraph(params, requestOptions),
    !!collection.data &&
      collection.data.active_people_count > 0 &&
      online &&
      !invalidFocus,
  );
  const detail = useTreeRead(
    ["person", selected],
    (requestOptions) =>
      apiClient.getFamilyTreePerson(selected!, requestOptions),
    selected !== null && !!collection.data && online,
  );
  const [editor, setEditor] = useState<EditorDraft | null>(null),
    [chooser, setChooser] = useState<"relative" | "identity" | null>(null),
    [discard, setDiscard] = useState(false),
    dirty = useRef(false),
    saving = useRef(false),
    editorId = useRef(0);
  const [announcement, setAnnouncement] = useState("");
  const authoritativeManage =
    manage && collection.data?.capabilities.can_manage === true;
  useEffect(() => {
    if (!authoritativeManage) {
      setEditor(null);
      setChooser(null);
      dirty.current = false;
      saving.current = false;
      setDiscard(false);
    }
  }, [authoritativeManage]);
  const { expanding, expansionError, more } = useGraphContinuation(
    graph,
    params,
    searchParams,
  );
  const onDirty = useCallback((value: boolean, pending: boolean) => {
    dirty.current = value;
    saving.current = pending;
  }, []);
  function edit(spec: EditorSpec) {
    if (
      !authoritativeManage ||
      !online ||
      busy ||
      runtime.checking ||
      collection.isFetching
    )
      return;
    if (
      spec.originRevision === undefined ||
      spec.originRevision < floor.current
    ) {
      setAnnouncement(
        "This target snapshot is not current. Reload its records and review them before opening an editor.",
      );
      return;
    }
    editorId.current++;
    dirty.current = false;
    saving.current = false;
    setDiscard(false);
    setChooser(null);
    setEditor({ ...spec, originRevision: spec.originRevision });
  }
  function close() {
    if (saving.current || busy) return;
    if (dirty.current) {
      setDiscard(true);
      return;
    }
    setEditor(null);
    setChooser(null);
  }
  function select(id: number) {
    if (busy) return;
    navigate(
      `/family-tree/people/${id}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
    );
  }
  function showInTree(id: number) {
    if (busy) return;
    const next = new URLSearchParams(searchParams);
    next.set("focus", String(id));
    navigate(`/family-tree/people/${id}?${next.toString()}`);
  }
  function changeLens(next: LayoutOptions) {
    const query = new URLSearchParams(searchParams);
    query.set("up", String(next.ancestorDepth ?? 2));
    query.set("down", String(next.descendantDepth ?? 2));
    query.set("care", next.includeCare ? "1" : "0");
    query.set("partners", next.includePartners === false ? "0" : "1");
    query.set("history", next.showHistoricalPartners ? "1" : "0");
    query.set("collapsedUp", (next.collapsedAncestors ?? []).join(","));
    query.set("collapsedDown", (next.collapsedDescendants ?? []).join(","));
    setSearchParams(query);
  }
  function saved(result: FamilyTreeMutationResult) {
    setEditor(null);
    dirty.current = false;
    setAnnouncement(
      `Saved at revision ${result.current_revision}${result.replayed ? " (previous request confirmed)" : ""}. Refreshing affected records.`,
    );
    if (editor?.focusCreated && result.affected.person_ids.length) {
      const id =
        result.affected.person_ids.find(
          (candidate) => candidate !== selected,
        ) ?? result.affected.person_ids[0];
      showInTree(id);
    }
  }
  return (
    <TreeRuntimeContext.Provider
      value={{
        ...runtime,
        authorizedManage: authoritativeManage,
        manage: authoritativeManage && !runtime.checking,
      }}
    >
      <section
        className="family-tree-workspace"
        aria-label="Family Tree workspace"
      >
        <header>
          <h1>{collection.data?.title || "Family Tree"}</h1>
          <p>
            Private household records. Relationships and uncertainty are
            recorded explicitly, never inferred.
          </p>
          {!authoritativeManage ? (
            <InlineNotice variant="info">
              View-only access. Management controls are unavailable.
            </InlineNotice>
          ) : null}
          {!online ? (
            <InlineNotice variant="info">
              Offline: showing only this session&apos;s last authorized data.
              Remote changes or revocation cannot be checked until access
              refresh succeeds. Editing is disabled.
            </InlineNotice>
          ) : null}
          <p role="status">
            {runtime.checking
              ? "Rechecking authoritative access; reads and edits are paused. Your draft is kept until access is confirmed."
              : announcement}
          </p>
        </header>
        {collection.isPending ? (
          <p role="status">Loading tree collection…</p>
        ) : null}
        {collection.error ? (
          <InlineNotice variant="error">
            Could not load the collection: {formatApiError(collection.error)}{" "}
            <Button
              disabled={!online || busy}
              onClick={() => void collection.refetch()}
            >
              Retry tree collection
            </Button>
          </InlineNotice>
        ) : null}
        {collection.data && collection.data.active_people_count === 0 ? (
          <Card as="section">
            <h2>Start your family tree</h2>
            <p>
              No active people are recorded. Add your first person or restore an
              archived person. No sample family has been created.
            </p>
            {authoritativeManage ? (
              <Button
                disabled={!online || busy}
                onClick={() =>
                  edit({
                    ...personEditor(),
                    originRevision: collection.data!.graph_revision,
                  })
                }
              >
                Add first person
              </Button>
            ) : (
              <p>An authorized manager can add the first person.</p>
            )}
          </Card>
        ) : null}
        {collection.data ? (
          <FamilyTreeDirectory
            activePeopleCount={collection.data.active_people_count}
            query={query}
            setQuery={setQuery}
            tag={tag}
            setTag={setTag}
            living={living}
            setLiving={setLiving}
            archived={archived}
            setArchived={setArchived}
            busy={busy}
            online={online}
            authoritativeManage={authoritativeManage}
            people={people}
            edit={(spec) =>
              edit({ ...spec, originRevision: collection.data!.graph_revision })
            }
            showInTree={showInTree}
          />
        ) : null}
        {invalidId || invalidFocus ? (
          <InlineNotice variant="error">
            This bookmark has an invalid person or focus ID.{" "}
            <Button onClick={() => navigate("/family-tree")}>
              Open the directory instead
            </Button>
          </InlineNotice>
        ) : null}
        <TreeGraphPanel
          graph={graph}
          collection={collection}
          focus={focus}
          options={options}
          busy={busy}
          expanding={expanding}
          online={online}
          expansionError={expansionError}
          select={select}
          showInTree={showInTree}
          changeLens={changeLens}
          more={more}
        />
        {collection.data ? (
          <TreeAdvancedTools
            collection={collection.data}
            person={detail.data?.person}
            personRevision={detail.data?.graph_revision}
            people={people.items}
          />
        ) : null}
        {selected && detail.isPending ? <p>Loading selected person…</p> : null}
        {detail.error ? (
          <InlineNotice variant="error">
            Person details unavailable: {formatApiError(detail.error)}{" "}
            <Button
              disabled={!online || busy}
              onClick={() => void detail.refetch()}
            >
              Retry person details
            </Button>
            <Link to="/family-tree">Return to directory</Link>
          </InlineNotice>
        ) : null}
        {detail.data ? (
          <PersonDetails
            detail={detail.data}
            people={people.items}
            onEdit={edit}
            onRelative={() => {
              if (authoritativeManage) setChooser("relative");
            }}
            onIdentity={() => {
              if (authoritativeManage) setChooser("identity");
            }}
            onSelect={select}
            onFocus={showInTree}
          />
        ) : null}
        {collection.data && collection.data.active_people_count > 0 ? (
          <FamilyTreeComparison
            people={people.items}
            busy={busy}
            online={online}
            includeHistory={options.showHistoricalPartners ?? false}
          />
        ) : null}
        <FamilyTreeDialog
          open={!!editor || !!chooser}
          title={
            editor?.title ??
            (chooser === "relative"
              ? "Choose relative relationship"
              : "Choose identity association")
          }
          onRequestClose={close}
        >
          {discard && (
            <section>
              <p>
                Discard the unsaved draft? It exists only in this protected
                session.
              </p>
              <Button onClick={() => setDiscard(false)}>Keep editing</Button>
              <Button
                disabled={busy}
                onClick={() => {
                  dirty.current = false;
                  setDiscard(false);
                  setEditor(null);
                  setChooser(null);
                }}
              >
                Discard draft
              </Button>
            </section>
          )}
          {editor ? (
            <div hidden={discard}>
              <RecordEditor
                key={editorId.current}
                {...editor}
                originRevision={editor.originRevision}
                onDirtyChange={onDirty}
                onSaved={saved}
              />
            </div>
          ) : chooser === "relative" && detail.data ? (
            <RelativeChooser
              anchor={detail.data.person}
              originRevision={detail.data.graph_revision}
              onChoose={edit}
            />
          ) : chooser === "identity" && detail.data ? (
            <IdentityChooser
              person={detail.data.person}
              originRevision={detail.data.graph_revision}
              onChoose={edit}
            />
          ) : null}
        </FamilyTreeDialog>
      </section>
    </TreeRuntimeContext.Provider>
  );
}
