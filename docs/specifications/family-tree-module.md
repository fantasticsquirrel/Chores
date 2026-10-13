# Family Tree Module — Full Product and Technical Specification

**Status:** Proposed implementation contract; specification only. No Family Tree module is implemented, enabled, or deployed by this document.

**Specification date:** October 13, 2026

**Target repository:** `fantasticsquirrel/Chores` / Family Manager (formerly Chore Tracker)

**Inspected integration baseline:** `master` at `30502d05252a4b304fe0ac6cf3a423367650a7f6`

**Source concept:** `fantasticsquirrel/family_tree`, reviewed at `b310145ce0ff1f736f03cfed8342eb77cf696149`; its open PR #18 was inspected at `9e28a36843e8f5bbacaf930896e989cc45971d17`.

**Authority:** This document owns Family Tree requirements and its unchecked delivery checklist. The [product-finish tracker](../implementation/family-manager-hardening-and-product-finish.md) remains authoritative for existing hardening work; this is a separate planned feature scope, not evidence that those gates are complete.

Follow the [architecture/change standards](../architecture-and-change-standards.md) and [standard module creation guide](../standard-module-creation-guide.md). Requirements using **must** are acceptance requirements. Future paths, tables, methods and APIs below are proposed, not claims about existing code.

## 1. Product purpose and adaptation decision

Family Tree lets a household preserve and explore its family history alongside Chores, Homeschool and Recipes: people, ancestry and social relationships, partnership history, residences, stories, photographs, research notes and source attribution.

Retain the standalone application's useful ideas:

- Focusable family graph with independent ancestor/descendant expansion and compact/detailed person cards.
- Searchable people directory and direct navigation to any person, including disconnected branches.
- Partial/uncertain dates, maiden/other names, flexible tags and generation-color accents.
- Multiple dated stories per person, residences, notes and photographs.
- Explicit parent-child and partner records, connection comparison, edit protection and portable backup/export.

Change its architecture and safety model:

- **One existing Family Manager application**, not a second application, plugin runtime, Tauri/Rust process, login system, local desktop database or standalone shell.
- **FastAPI + SQLAlchemy + Alembic** own canonical household data in the existing configured database; web and Expo mobile are clients.
- Existing household identities, module view/manage permissions, session/CSRF policy, audit, operator backup and deployment paths remain authoritative.
- Correctness and recovery precede visual polish. No raw database replacement, unbounded traversal, inferred marriage, stale full-record saves or silently lost flags.
- Server-authoritative collaboration replaces the standalone no-network requirement. Low-network, accessible read behavior is retained without promising unsupported offline editing or synchronization.

## 2. Goals, non-goals and release boundaries

### 2.1 Release 1: required complete household module

Release 1 includes:

1. Adult household collaboration with explicit view-only/manage permissions.
2. Empty-tree onboarding; directory search, add/edit/archive/restore and focus navigation.
3. Durable names, partial/uncertain life dates, living/deceased/unknown state, tags, notes, edit locks and photographs.
4. Typed ancestry, step-parent, guardianship/care and partner relationships, including previous partners and repeated partnership episodes.
5. Responsive bounded graph, accessible relationship-list alternative and connection comparison.
6. Residence and multi-story create/edit/delete with attribution, ordering and managed images.
7. Existing-account/child identity links, explicitly confirmed and independent of authentication or inferred genealogy.
8. Duplicate detection suggestions and previewed, transactional person merge.
9. Versioned logical JSON/bundle export; staged, previewed append import with ID remapping and idempotent commit.
10. Explicit loading/error/conflict/offline states; web/mobile semantic feature parity; keyboard and touch accessibility.
11. Schema migrations, source/contract/domain/security tests, CI, operator backup/restore and live/device verification.

A short name, unknown surname/date, unmarried parents, disconnected person or unusual but possible family history must not make the application unusable.

### 2.2 Explicitly deferred capabilities

These are not required for Release 1 and must have no active placeholder controls:

- Child access, child contributions and parent-approved child-visible projections.
- External/public share links, cross-household federation or invitation of relatives outside the household.
- Automatic relationship inference from account roles, surnames, ages, sex/gender, addresses or AI.
- DNA/genetics, medical-record storage, legal-parentage determinations or claims of legal authority.
- GEDCOM interchange, genealogy-provider sync, OCR/AI source extraction and arbitrary URL fetching.
- Native SQLite/standalone legacy import adapter; its safe conversion contract is specified in section 13.6.
- Persistent offline genealogy caches, offline writes and automatic conflict-resolution synchronization.
- Interactive replacement of the complete household tree, whole-database restoration and multiple independent household tree collections.
- A new paid tier, subscription provider integration, separate genealogy entitlement or platform-support content access.

Deferral does not permit ignoring integrity or security: Release 1 schema, export versions and service boundaries must leave future work possible without changing identity/authorization authority.

### 2.3 Commercial policy

Release 1 is a module under the existing access model, with no new paywall assumed. A later paid capability requires a separately approved entitlement policy, backend enforcement and non-destructive downgrade behavior. Household ownership is not synonymous with `PARENT_ADMIN`; platform owner/support roles are not household content roles. Subscription/access changes never erase genealogy data.

## 3. Verified repository fit and integration surfaces

The inspected repository already supplies:

- Canonical metadata at `packages/family-api/module-contract.json`, loaded by `backend/app/modules.py` and `packages/family-api/src/modules.ts`.
- Global catalog, household ceiling and per-user view/manage rows through `backend/app/models/modules.py` and `backend/app/services/modules.py`.
- Explicit dependencies `require_module_view`, `require_module_manage` and method-sensitive `require_module_access` in `backend/app/api/dependencies.py`.
- Separate existing household `User` and `Child` identities; `Household.owner_user_id` in `backend/app/models/identity.py`.
- Feature-owned web/mobile structure, registries and shared endpoint/model packages; cookie/CSRF policy remains in platform transports.
- Alembic schema authority, SQLite/WAL, migration/architecture tests and CI quality gates.
- Recipe logical backup/import as a structural example, **not** a ready-made genealogy/media import implementation.

New implementation files are candidates to create, not existing seams:

- `backend/app/models/family_tree.py`, `backend/app/schemas/family_tree.py`, `backend/app/api/family_tree.py`.
- `backend/app/services/family_tree/` with cohesive `access`, `people`, `relationships`, `stories`, `residences`, `media`, `graph`, `merge`, `transfer`, `serialization` and `mutations` services.
- A next-head Alembic migration under `backend/alembic/versions/`; resolve the actual head when implementation starts rather than reserving a stale revision number.
- `packages/family-api/src/models/family-tree.ts` and `packages/family-api/src/endpoints/family-tree.ts`, wired through current domain indexes/endpoint inheritance without reviving removed compatibility facades.
- `packages/family-tree-core/`: a small pure, platform-neutral date/graph/layout library if both clients need common algorithms. It may consume shared types, but must not own authorization, transport, React, DOM/native rendering or database writes; do not create a plugin framework.
- `frontend/src/pages/FamilyTreePage.tsx` and `frontend/src/features/family-tree/{components,hooks,lib}`.
- `mobile/src/screens/FamilyTreeScreen.tsx` and `mobile/src/features/family-tree/{components,lib}`.

Existing integration files to modify during implementation include `backend/app/api/__init__.py`, `backend/app/main.py`, model indexes, module loader constants, the canonical manifest, shared indexes, web `App.tsx`/API adapter/registry, mobile app navigation/API adapter/registry, existing identity lifecycle services, CI/test fixtures and documentation. Do not move unrelated module logic or regress their behavior.

Both current platform `ApiClient` classes inherit `FamilyRecipeApiEndpoints`. Connect the new Family Tree endpoint methods through that actual inheritance/composition path in `frontend/src/api/client.ts` and `mobile/src/api/client.ts`; exporting an unused class is not integration. Mobile wiring also includes `mobile/src/AppShell.tsx`, `mobile/src/navigation/types.ts`, `mobile/src/navigation/tabs.ts` and `mobile/src/screens/parent/ParentHomeScreen.tsx`, besides the module registry.

The existing web `frontend/src/auth/AuthContext.tsx` temporarily/fallback grants role-derived modules when module discovery is incomplete or fails and treats `can_manage !== false` as manageable. Family Tree must explicitly exclude this fallback: content requires a successful authoritative module response, and mutations require affirmative `can_manage === true`. A module-specific access boundary or a carefully characterized shared correction is required; the existing generic route guard alone does not satisfy this specification.

## 4. Module catalog, navigation and rollout

### 4.1 Canonical proposed manifest entry

The stable key is **`family-tree`**, not `family_tree`: the existing Python loader accepts `^[a-z][a-z0-9-]*$`. Underscores remain appropriate in Python filenames/table names only.

The following entry is a **target**, not permission to register unfinished platforms now:

```json
{
  "key": "family-tree",
  "name": "Family Tree",
  "description": "Household family history, relationships, stories and photographs.",
  "labels": { "web": "Family Tree", "mobile": "Family Tree" },
  "default_grants": {
    "PARENT_ADMIN": true,
    "PARENT": true,
    "CHILD": false
  },
  "platforms": {
    "web": {
      "supported": true,
      "destination": "/family-tree",
      "roles": ["PARENT_ADMIN", "PARENT"],
      "navigation": true,
      "dashboard": true
    },
    "mobile": {
      "supported": true,
      "destination": "family-tree",
      "roles": ["PARENT_ADMIN", "PARENT"],
      "navigation": true,
      "dashboard": true
    }
  }
}
```

Place the entry once under `modules["family-tree"]`. Register actual primary/secondary routes, guards, navigation and dashboard cards per supported platform. Before a platform is ready, explicitly use the guide's unsupported-platform shape; never claim support from metadata alone.

### 4.2 Routes and shell behavior

- Web primary destination: `/family-tree`, served publicly as `/chore/family-tree` under the existing SPA base.
- Bookmarkable adult detail route: `/family-tree/people/:personId`; graph focus and lens may be query parameters. APIs scope IDs independently of route parameters.
- API prefix: `/chore-api/family-tree`; retain the existing application prefixes and canonical host.
- Mobile destination: `family-tree`; extend the actual `AppTab` union, tab/screen selection and navigation registration. Use existing More/overflow navigation rather than adding an unconditional permanent primary tab.
- Add a lightweight adult Home shortcut: “Start your family tree” when empty, otherwise “Open family tree.” No fabricated due tasks, alerts or ancestor anniversaries in Release 1.
- Module discovery must succeed before content calls. A disabled/error/unavailable module route shows a friendly retry/access state and issues no protected genealogy requests. View-only users see content without enabled mutation controls.

### 4.3 Deliberate opt-in rollout

1. Initial migration seeds the global catalog row **disabled**, and explicit household rows **disabled** for existing households. Preserve all unrelated module settings and grants.
2. New-household creation must explicitly initialize Family Tree disabled; do not rely on the current missing-row fallback, which treats household modules as enabled.
3. The migration must run before new application code is exposed. Do not allow `ensure_catalog()` to auto-create an enabled genealogy catalog row ahead of the migration.
4. After required platform/backend gates pass, an authorized deployment enables the global catalog. Household `PARENT_ADMIN` with Admin manage access then opts the household in using the existing Admin module controls.
5. Parent/admin default grants apply only within the global/household ceilings. Explicit user overrides may reduce adults to view-only or deny access.
6. Disabling the module hides navigation, denies APIs, invalidates client queries and prevents newly started imports/exports; it **does not delete data**. Re-enabling restores authorized access to the same collection.
7. Complete backend integration tests for missing rows, fresh registrations, existing household backfill and disable/re-enable before activation.

## 5. Authorization, privacy and account separation

### 5.1 Release 1 permission matrix

- `PARENT_ADMIN` or `PARENT` with effective module **view**: directory, person/relationship/story/residence/media reads, graph and comparison. No edit, upload, bulk transfer or lock mutation.
- Adult with effective module **manage**: ordinary create/edit/archive/restore, relationship changes, story/residence mutations, lock/unlock, upload, merge preview/commit and logical import/export.
- `PARENT_ADMIN` with **Admin manage**: existing household/user module administration. This does not automatically grant genealogy content access, and Family Tree manage does not grant account administration.
- Household **owner + Family Tree manage + fresh password confirmation**: permanent person purge. Ownership must be read from `Household.owner_user_id`; role alone is insufficient. Adapt the existing password-verification/ownership pattern; no household recent-reauth token is presumed to exist.
- Child: **no Release 1 genealogy access**, even if a household override/user row accidentally lists the module. Every route must also explicitly limit the role to adult roles. Default-grant `false` alone is not a security boundary: current household overrides can add modules beyond defaults.
- Platform owner/support: no household genealogy content, exports, media or identity linking merely because of their operations role. No new impersonation or break-glass mechanism is introduced.

Use explicit manage guards for action-like safe-method endpoints, notably export/download generation. A `GET` URL does not make bulk export a view-only capability. Preview POSTs are also manage operations. Normal session/CSRF requirements cover uploads, previews, commits and mutations.

### 5.2 Household and object boundaries

- Derive household ID from the authenticated user. New payloads must not select a target household, owner, user role or grants.
- Scope every collection/person/link/episode/story/residence/asset/job/receipt lookup to that household and collection; an inaccessible resource uses the existing generic safe not-found shape without confirming another household's existence.
- Composite foreign keys or equivalent database constraints must prevent a row referencing a person/asset in another household/collection, in addition to service checks.
- All Release 1 content is shared among authorized adult module viewers. There is no misleading “private to me” note label or row-level sharing feature that the backend does not enforce.
- Only explicitly linked account metadata is projected; never return passwords, email login identifiers, balances, attendance, household billing state or account-security fields as family-history data.
- Source text and media are untrusted. Notes/stories use a documented limited Markdown subset with raw HTML disabled and tested URL sanitization. No remote-image embedding or automatic source URL fetch in Release 1.
- Logs/audit entries contain actor/action/object IDs and outcome, not story bodies, names, birth details, photos, credentials, exported bundles or complete request payloads.

### 5.3 Identity links do not create ancestry or credentials

Relatives are independent genealogy people; most have no Family Manager account. Linking a person to an existing parent `User` or `Child` is an explicit manager-confirmed association. A parent/child role is not evidence of a biological/social relationship.

- Within one collection, one active link per genealogy person and one per linked account/profile.
- Parent-user links must target an eligible same-household adult. Child links target `Child`, not a separate duplicate of its login `User`.
- Family Tree manage may read a minimal eligible identity projection inside this module but may not create/reset credentials, mutate `children`/`users`, or bypass the existing Admin/Chores permissions.
- Linking/unlinking never auto-renames a person or edits a profile in another module. Any initial-name copy is a reviewed suggestion.
- Account/profile deactivation preserves history and shows an inactive association to adult viewers. Deletion removes only the identity-link row, never the genealogy person, stories or lineage. Person purge removes the link only, never the account.
- Core identity lifecycle changes must invalidate/bump affected genealogy projection revision without blocking account deletion. Test this interaction rather than relying on unnoticed FK side effects.
- Household owner transfer does not transfer a private tree to another household; the tree is household-owned and stays with that household.

## 6. Data model and durable invariants

### 6.1 Common conventions

Use current SQLAlchemy/UTC timestamp conventions and positive integer internal IDs; portable exports use independent source keys. Include `household_id` and `collection_id` on domain rows, immutable creator attribution (nullable user FK on account removal) and appropriate indexes. `created_by_user_id` is attribution, **not** a private ownership filter.

A new `family_tree_collections` row is unique per household in Release 1. Disconnected branches live in the same collection. Named saved views do not duplicate people. The row includes `title`, optional `default_focus_person_id`, `revision >= 1`, timestamps and actor attribution. Before first creation, the API represents an empty uninitialized collection at revision 0 without mutating storage on a GET.

Proposed tables:

- `family_tree_collections`: canonical household collection, revision, safe default focus.
- `family_tree_people`: names, life facts, notes, living state, edit lock, archive/merge state, optional primary image asset.
- `family_tree_person_tags`: normalized household/collection tags and unique person/tag links; never overloaded as an implicit focus selector.
- `family_tree_parent_links`: typed directed parent-child facts and attribution.
- `family_tree_care_links`: directed guardian/caregiver facts, optional dates and notes; distinct from ancestry.
- `family_tree_partner_episodes`: explicit two-person partnership episodes and their history.
- `family_tree_residences`, `family_tree_stories`: first-class ordered person records.
- `family_tree_identity_links`: person to existing adult user **or** child, exactly one target; scoped uniqueness. Account FK deletion cascades the association only.
- `family_tree_media_assets` plus reference links as needed: opaque object keys, validated MIME, size, checksum, lifecycle, author and caption; original filenames are presentation metadata, never paths.
- `family_tree_mutation_receipts`: bounded idempotency records with operation/body digest, actor, collection, result IDs and committed revision.
- `family_tree_transfer_jobs`: scoped staging/validation state, expected revision, summary, expiry and immutable staged-object references.
- `family_tree_import_source_keys`: optional provenance mapping for repeat-import duplicate suggestions; imported IDs never become local authenticated identity references.

Person/collection hard-delete policy must account for media and receipts; SQL cascades alone cannot clean external object storage. Existing household-deletion operations must incorporate an authorized media inventory and cleanup job without exposing content to support users.

### 6.2 Person contract

- Names: optional `first_name`, `middle_name`, `last_name`, `maiden_name`, `suffix`, chosen `display_name`, and other-name/alias entries with label and attribution. At least one trimmed name/display label is required; do not require a surname or force Western two-part names.
- `living_status`: `living | deceased | unknown`. Never infer a definitive status from missing death data or age.
- Optional user-entered gender text; never use it to authorize actions or infer parent/partner roles.
- Structured `birth_date`/`death_date`, optional places and source references.
- `notes_md`, tags, primary image, `is_locked`, lock reason/actor/time, optional `archived_at`, optional `merged_into_person_id`.
- Responses and create/edit/export/import/restart behavior must preserve every supported field, including flags and nulls. Search must include chosen name, all name parts and aliases, not only last/display name.

Example date value:

```json
{ "value": "1984-02", "precision": "month", "uncertain": true }
```

Request `precision` is not trusted independently: derive and return `year | month | day` from validated `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. Null means unknown. Reject impossible calendar values and timezone-bearing timestamp strings. Use Gregorian years 0001–9999 for Release 1; alternate calendars/BCE require a later explicit contract. Partial dates are ranges, not artificially January 1 or epoch zero; uncertainty is preserved, not silently rounded away. Definite contradictory life ranges are validation errors; uncertain/partially overlapping chronology produces a warning requiring manager review rather than fabricated precision.

### 6.3 Relationships and family semantics

- Parent links: `biological | adoptive | step | unknown`. Each `(parent, child, type)` has at most one active fact; same person cannot be both endpoints. Parentage subgraph must remain acyclic across all these parent types.
- Care links: `guardian | caregiver`, with optional valid date ranges. They do not assert biological parentage or drive ancestry generations. Social/care networks may have reciprocal history; renderer traversal remains bounded regardless.
- Partner episodes: canonical ordered endpoint pair, `kind = married | civil_union | partners | unknown`, optional start/end partial dates, `status = current | separated | ended | unknown`, notes and source attribution. Multiple episodes with the same partner, and multiple past/current partners, are supported. Similar episodes generate a duplicate warning; their dates/types are not automatically collapsed.
- Never create a partner episode because a child has two parents. Co-parent junctions are presentation constructs with a distinct edge type and legend.
- No arbitrary hard limit of two total social/legal parents, one lifetime partner, a 30-year partner age gap or opposite genders. Implausible entered chronology is a review warning unless a definite invariant is violated.
- Relationship changes touching a locked person require an explicit unlock first. Date changes do not rewrite relationships automatically.
- Derived descriptions say “shared recorded biological parent,” “shared adoptive parent” or “guardian connection,” not unqualified genetic/full/half-sibling assertions from incomplete or untyped data.
- Connection comparison returns a typed, explainable path and path distance. Named kinship/genetic-degree calculations are not promised by Release 1.

### 6.4 Residences, stories and attribution

- Residence: person, place label, optional valid start/end partial dates, `is_primary`, notes and source reference. Multiple historical residences are allowed; choosing a primary residence atomically clears the earlier primary for that person. Complete add/edit/delete on both clients.
- Story: person, title, limited Markdown body, optional partial date, source label/URL citation (stored, not fetched), sortable position and optional media references. Multiple stories per person; create/edit/delete/reorder preserve content and attribution.
- Source attribution is a household-entered citation, not a verified legal/historical claim. Imported provenance must distinguish original source label from the local acting user.
- Changes are revisioned and auditable; exports preserve order and dates. Displaying a full story must not require opening an edit form.

### 6.5 Locks, archive, purge and merge

- A lock is durable edit protection, not a permission grant. Backend denies edits, attached-record changes, relationship changes, merge/archive/purge touching a locked person with a stable conflict code. An authorized manager explicitly unlocks with a reason; unlock is audited and revisioned.
- Ordinary removal archives a person after explaining affected presentation. Records/relationships remain recoverable; archived people are omitted from normal graph/directory but available through an adult archived filter. Restoring a person restores its still-valid relationships; do not delete relatives or account data.
- Permanent purge is owner/manage/password-confirmed, previewed and audited. Delete only that person's facts/link rows and unshared attachments, clear affected default focus, preserve remaining people and all other modules. Shared assets are released only when unreferenced and outside backup/export retention. Present irreversible consequences and retained backup policy honestly.
- Merged source people become archived aliases pointing at the canonical target. Authorized reads/bookmarks expose canonical-target metadata and offer navigation to it; they do not silently redirect writes. A merge is not a generic person PATCH; section 12 defines its atomic behavior.

Merged aliases are non-editable and non-restorable through ordinary person, relationship, story/residence, archive/restore or lock/unlock operations. Alias-addressed mutations return HTTP 409 / `person_merged`, with a canonical ID only after normal household authorization. The user must explicitly open the canonical person and submit a new revision-bound command. Unmerge is deferred and has no active endpoint/control. The exceptions are owner-authorized alias purge preview/purge: these remove the alias and its obsolete scalar/provenance copy only, never the canonical target or records moved to it.

Canonical-person purge is blocked with HTTP 409 / `merge_aliases_present` while any alias refers to that target. Preview lists the same-household blocking aliases; the owner must explicitly purge those aliases, obtain a fresh revision-bound target preview, then purge the target. Do not cascade-delete aliases, resurrect them, or leave dangling redirects as an implicit side effect. Enforce a same-collection merged-target FK with `ON DELETE RESTRICT`, plus transaction/revision guards, so a concurrent merge cannot slip between preview and purge. This preserves the deliberate one-person-at-a-time purge boundary.

Alias targets are always canonical, non-merged people; no redirect chains or cycles are permitted. If canonical B (already targeted by alias A) is merged into canonical C, that merge atomically retargets A to C and creates B's alias to C. Preview includes those maintenance changes; ordinary alias mutations remain forbidden. Import validates the same flat-alias invariant. This lets explicit alias purge remain isolated and ensures target-purge blockers account for every alias.

## 7. Mutation consistency, concurrency and idempotency

### 7.1 True patch semantics

PATCH applies only explicitly supplied fields. Omitted means unchanged; null clears a nullable value; an empty allowed text value is defined per field. Never read a whole record client-side and resend it as a pretend partial patch. Unknown/system-owned fields are rejected. Nested life-date updates replace the supplied date object as a whole, with null clearing it.

Every domain mutation includes `expected_graph_revision`. The first atomic create may use 0; initialized collections require the latest positive revision. A conditional collection revision claim and all data changes occur in the same database transaction. This coarse optimistic concurrency serializes topology-sensitive writes and prevents two independently validated links from jointly creating a cycle. External identity lifecycle changes also invalidate the revision.

- Stale expected revision returns HTTP 409 / `revision_conflict` without partial changes.
- Client retains the draft, fetches current state and offers field-level review/reapply; no silent last-write-wins or automatic stale-payload retry.
- Successful writes return affected entity IDs/data plus `committed_revision`; clients do not overwrite newer cache projections with older responses.
- Validation, graph integrity, locks, merge and identity consistency are authoritative backend checks. Database constraints are the safety net.
- SQLite busy/resource limits use bounded retries and a documented retryable response, not partial success. Heavy file/network processing occurs before/outside write transactions.

### 7.2 Idempotency

Compound create-relative, story/person creation, merge and import commit require an opaque idempotency key; other mutations may use the same mechanism. Scope receipt uniqueness by household, actor and operation. Validate session/role/module access **before** replay. Same key + same canonical body replays the original IDs/revision; same key + different body returns `idempotency_conflict`. A replay envelope identifies replay and current revision so clients refresh rather than apply an old snapshot.

Store bounded result metadata/body digests rather than sensitive request copies; propose a configurable 24-hour replay window, documented to clients. User-initiated retries keep the key. No duplicate story/person after double tap, request timeout or upload/import retry.

### 7.3 Atomic create-relative

A single command validates both person data and proposed relationship, claims revision, creates the person and link and commits once. Existing-person linking uses the same guards. Rejection creates no orphan. Birth dates are optional; age/surname heuristics may inform suggestions, never authorize a relationship.

## 8. Graph projection and layout correctness

### 8.1 Bounded server projection

The backend returns authorized graph data for a focus/lens, not every raw household row. Default lens: two ancestry and two descendant levels plus explicitly requested partner/care context. Propose a default 250-node / 500-edge response and configurable hard ceiling 500 nodes / 1,000 edges; specify and test limits before release. Large results return explicit truncation/expansion tokens and continuation controls, not silent missing branches or browser freezes.

Return typed nodes/edges, safe summaries, available expansion counts/tokens, `graph_revision`, explicit warnings and `projection_limits`. No hidden/deleted/cross-household metadata. Return disconnected-component navigation through the authorized directory rather than choosing the first inserted person forever.

### 8.2 Pure staged layout

Separate lookup construction, visibility, ancestry validation/ranking, family/partner grouping, placement, edge routing and diagnostics. Use stable IDs and deterministic ordering. The pure library receives projected authorized data and never decides permission.

- A bounded visited/iteration mechanism is mandatory, even after server cycle validation. Corrupt imported/stored input shows a recoverable warning and list view; it cannot enter an infinite generation-update loop.
- Rank ancestry consistently. Partner same-row placement is a soft constraint; if it conflicts with recorded ancestry, preserve the explicit partnership with a labeled cross-row route instead of hiding it or flattening parent/child generations.
- Preserve biological/adoptive/step/unknown/care/partner metadata through routes and details. Use labels/patterns in addition to color, with an explanatory legend.
- Parent junctions do not persist inferred marriages. Ended/current episodes remain distinguishable; historical links can be shown/hidden through an explicit filter.
- Collapse semantics: collapse stops that node's directional traversal and hides that directional connection in the projected lens. A shared descendant may remain reachable through another open branch, but the collapsed route is not redrawn merely because both endpoints remain visible. Expose “also connected through another branch” where useful.
- Unknown dates get “Birth year unknown,” never years 0–24. Generational row position and 25-year color bands are distinct concepts.
- Memoize stable normalized inputs and shared relationship indexes. Do not compute all-person candidate filters for every mounted card while quick actions are closed.
- Fit once on initial focus/context change or explicit Fit action. Manual zoom/pan is not overwritten by incidental cache updates or fresh array identities.

### 8.3 Platform presentation

Web uses existing React components with bounded SVG/HTML graph presentation and a shared accessible list fallback. Mobile uses native touch-sized cards, explicit branch controls, pan/zoom if verified, and the same typed relationships/list fallback; do not embed the desktop/Tauri UI or rely on hover. If SVG/gesture dependencies are added, they must be compatible with the pinned Expo/toolchain and dependency-audit policy; no new dependency is assumed already installed.

Performance acceptance must be recorded on named devices: initial 100-node interaction target under 1 second excluding network; bounded 500-node layout under 1 second on the reference desktop and under 2 seconds on the reference supported Android device. These are proposed budgets, not measured guarantees. The first implementation slice must benchmark and justify any budget changes with evidence; no unbounded layout is acceptable regardless of benchmark.

## 9. Web/mobile workflows and visual integration

### 9.1 Shell and first run

Follow Jewel Pop tokens/components and existing role/module-aware navigation. Content comes first: a concise Family Tree heading, person search, Tree/People views and one primary “Add person” action. Put advanced filters, merge, import/export and settings behind progressive disclosure.

An empty initialized or uninitialized collection offers a usable first-person form. Creating the first person atomically initializes the collection/focus. Deleting/archiving the final active person returns to that same usable empty state. Seed/demo data is confined to disposable fixtures; no editable sample family replaces production loading state.

### 9.2 Directory and person detail

- Search/paginate/filter by name/alias/tag, living status and archived state; responsive list/card view.
- “Show in tree” on every visible person, including disconnected components. Bookmark focus survives navigation while authorized; invalid focus gets a clear safe fallback.
- Detail sections: Overview, Relationships, Stories, Residences, Sources/Notes and managed images. Overview displays only entered facts and uncertainty.
- Add parent/child/care/partner: choose existing or create a new person with typed relationship details; confirm compound success, prevent duplicate submission and show accessible inline errors.
- Lock/archive controls explain scope; permanent purge/merge are secondary deliberate workflows.
- Editing cannot lose a draft on network error, revision conflict or modal dismissal without confirmation.

### 9.3 Stories, residences, compare and color preferences

- Story list opens full read view; edit is separate. Pending create/reorder/delete disables conflicting submission and preserves errors/drafts.
- Residences support full create/edit/delete, not a dead dedicated form.
- Comparison selectors have persistent labels; result lists typed path facts and uncertainty without claiming a biological relationship from a care edge.
- Default color palette uses theme-safe accents. Custom color applies to a border/accent or a derived contrasting foreground, not arbitrary unreadable card backgrounds. Include a distinct unknown-date style and reset control.

### 9.4 Accessibility and failure states

- All person selection/branch actions keyboard-focusable with names and state; no click-only selection div.
- Web dialogs portal outside transformed canvas, use dialog semantics, initial focus, containment, Escape, restoration and scrollable viewport bounds. Mobile uses platform modal/accessibility ownership and large touch targets.
- Provide non-color labels/patterns, screen-reader relationship summaries and list-only navigation; respect reduced motion.
- Test desktop 1920×1080, mobile web 390×844 and native supported handset layouts for no page-level horizontal overflow, useful content order and readable tap targets.
- Explicit states: permission loading, content loading, empty, denied, disabled, validation error, conflict, interrupted transfer, stale/read-only offline and retry. Never hydrate phantom demo content or silently clear newer state.

## 10. Proposed API and shared contract

All routes below are beneath `/chore-api/family-tree` and remain adult-role/module guarded. Schema validation uses the existing error/transport adapters. Retain existing generic 401/403 behavior; module-specific domain errors may use a structured `detail` with `code`, safe `message` and optional field errors, with shared client tests for both shapes.

### 10.1 Read endpoints

- `GET /`: collection state, revision, safe counts, default focus and authoritative capabilities; uninitialized returns state/revision 0 without creating records.
- `GET /people`: cursor pagination, query/filter; limit 1–100, default 50; deterministic tie-breaker.
- `GET /people/{id}`: authorized detail, links/records appropriate to requested bounded sections, canonical merge redirect metadata if needed.
- `GET /people/{id}/stories`, `GET /people/{id}/residences`: bounded ordered records.
- `GET /graph`: `focus_person_id`, up/down depth, partner/history/care flags, expansion token; hard bounds applied server-side.
- `GET /compare`: two person IDs, bounded typed shortest-path result or disconnected state.
- `GET /identity-candidates`: minimal same-household adults/children, for managers only; no general account/security payload.
- `GET /media/{asset_id}/content`: authorized byte stream with safe content disposition/MIME and no-store/private cache policy; not a publicly served static folder.

### 10.2 Manage endpoints

- `POST /people`, `PATCH /people/{id}`.
- `POST /people/{id}/archive`, `POST /people/{id}/restore`.
- `POST /people/{id}/lock`, `POST /people/{id}/unlock` with reason.
- `POST /people/{id}/purge-preview`, `POST /people/{id}/purge`: owner/password-confirmed final purge; preview snapshot/revision bound.
- `POST /relatives`: atomic create-person-plus-parent/care/partner link.
- `POST|PATCH|DELETE /parent-links[/{id}]`, corresponding `/care-links` and `/partner-episodes`; ID required for PATCH/DELETE.
- `POST /people/{id}/stories`, `PATCH|DELETE /stories/{id}`, `POST /people/{id}/stories/reorder`.
- `POST /people/{id}/residences`, `PATCH|DELETE /residences/{id}`.
- `PUT|DELETE /people/{id}/identity-link`: explicit association/unlink.
- `POST /media`: bounded multipart staging; `POST /media/{id}/attach` and `DELETE /media/{id}/references/{reference_id}` perform revisioned attachment changes. Upload staging is not an attached-person mutation until commit.
- `POST /merge-preview`, `POST /merge`: staged field/link decisions and expected revision, idempotent commit.
- `POST /exports`: create a versioned logical snapshot job; `GET /exports/{id}`, `GET /exports/{id}/download` require manage, remain household/actor scoped and recheck current access.
- `POST /imports`: stage a bounded JSON/ZIP; `GET /imports/{id}` shows manager-only validation/preview; `POST /imports/{id}/commit`; `DELETE /imports/{id}` cancels staging.

Revision/idempotency bodies for DELETE may use explicit shared transport support. Do not put sensitive confirmations in URLs; if current adapters cannot send the required DELETE body, use a named POST removal command rather than weakening revision checks. Multipart/binary methods require bounded extensions to the shared transport **mechanics** with web/native-specific session/file adapters preserved.

### 10.3 Representative payloads

Person PATCH, clearing gender while preserving omitted facts:

```json
{
  "expected_graph_revision": 12,
  "changes": {
    "gender": null,
    "birth_date": { "value": "1984", "uncertain": true },
    "tags": ["research-in-progress"]
  }
}
```

Atomic relative creation:

```json
{
  "expected_graph_revision": 12,
  "idempotency_key": "opaque-client-generated-key",
  "anchor_person_id": 41,
  "relationship": { "direction": "parent", "kind": "adoptive" },
  "person": { "display_name": "Morgan", "living_status": "unknown" }
}
```

Mutation envelope:

```json
{
  "committed_revision": 13,
  "replayed": false,
  "affected": { "person_ids": [41, 57], "relationship_ids": [19] },
  "warnings": []
}
```

### 10.4 Stable failure categories

Use existing HTTP/auth conventions plus documented module codes:

- 401: unauthenticated/revoked session; clear protected caches.
- 403: wrong role, denied/disabled module, insufficient manage/owner authority; no data leak.
- 404: inaccessible/unknown scoped object or unregistered deferred endpoint.
- 409: `revision_conflict`, `person_locked`, `person_merged`, `merge_aliases_present`, `relationship_cycle`, `identity_link_conflict`, `idempotency_conflict`, `merge_conflict`, `transfer_expired`/stale preview.
- 413: upload/archive/resource limit exceeded; no committed domain rows.
- 422: field/date/format validation, no-op/unsupported fields, invalid reference structure.
- Retryable bounded operational response: server busy/unavailable, with a safe correlation ID; never expose local paths, SQL or archive contents.

Authoritative capabilities such as `can_manage`, `can_export`, `can_purge` are projections of real checks, not permissions supplied by clients. Both clients consume the same typed DTOs and code/status handling; no branch on arbitrary English error substrings.

## 11. Loading, refresh and offline contract

- TanStack Query/current platform query patterns own server cache; local component state owns unsaved drafts and viewport state. Do not copy the standalone persisted Zustand data store as a second authority.
- Initial content calls wait for authenticated effective module access. No mutation is possible before a known collection revision/load state.
- After mutation, invalidate/refetch affected directory/detail/graph/count queries with revision-aware application. Cancel outdated reads; a late initial query cannot replace a newer successful mutation.
- Disable/deny/logout/account switch clears cached genealogy and sensitive drafts, aborts transfers and discards per-session focus IDs. Household-specific keys prevent cross-account query reuse.
- Release 1 has **no persistent genealogy cache** in localStorage/AsyncStorage, service-worker caches or downloadable token-bearing URLs. In-memory already-loaded adult data may be visibly stale/read-only during brief network loss; writes/import/merge are disabled until access/revision is revalidated.
- Offline status must not claim immediate remote-revocation knowledge. Once auth/access refresh fails, protected data is cleared. A future persistent offline policy requires device/session protection, revocation limits, explicit opt-in and separate acceptance tests.

## 12. Duplicate detection and transactional merge

Suggestions may compare normalized names/aliases, compatible date ranges and linked identity, but are advisory and never auto-merge or infer lineage.

Preview contains source/target people, each conflicting field, union/parent/care changes, story/residence/tag/media retention, linked-account conflicts, resulting cycle checks, source-to-target remap and retargeting of existing aliases to keep redirects flat. It is bound to the graph revision and short-lived preview token.

- Manager explicitly chooses retained scalar values; nonconflicting stories, residences, sources, tags and media references are preserved with original attribution.
- Reject merging distinct linked accounts/profiles until links are separately corrected; no credential/user merge.
- Reject a result with self-relationships, ancestry cycles or contradictory unresolved facts. Similar partnership episodes require a decision, not automatic destructive deduplication.
- Commit claims the same graph revision, applies all rewrites and source alias/archive state in one transaction, increments revision once and records idempotency/audit metadata.
- On validation/conflict/crash before commit, no person/link/record is partly moved or deleted. Locked inputs require prior explicit unlock. Already-merged aliases cannot be merge inputs; return `person_merged` and require deliberate canonical-person selection rather than silently resolving a mutation.
- Repeated commit returns the canonical result. Merged aliases remain non-restorable/non-editable as defined in section 6.5; a later alias purge never purges target records, and target purge requires prior explicit removal of all referring aliases.

## 13. Managed media, portable transfer and legacy conversion

### 13.1 Media design and limits

There is no existing general genealogy file store assumed. Add a module-owned private storage seam using deployment-configured persistent paths or an approved object store; never use process working directory, system temp paths as durable storage, client filesystem paths or public frontend assets.

Proposed initial limits (server-configurable, shared documentation/validation tests required): 10 MiB per image, 25-megapixel decode ceiling, JPEG/PNG/WebP only; no SVG/HTML/executable files. Verify magic bytes, actual decode, MIME, bounds and checksum; generate safe display sizes and strip location/EXIF metadata from stored app copies. Explain that uploaded images are sanitized copies and source originals remain on the user's device. Arbitrary remote media URLs are citations only and are not fetched/rendered remotely.

Use unpredictable opaque IDs/object keys and private permissions. Immutable ready assets can be referenced by multiple records; changing a photo creates/references a new asset. Lifecycle: staged → validated/ready → attached, or quarantined/expired. Stage outside write transactions; atomically publish ready files before a referencing SQL commit. Failure may leave an unreferenced immutable staged object for bounded cleanup, **never** a DB reference to absent content or deletion of previously referenced media. Cleanup rechecks DB/export/backup pins and age, and is idempotent.

Asset deletion uses a coordinated database claim, not a reference check followed by an unprotected filesystem delete. Live uploads/transfers, referencing mutations and export/backup snapshots hold explicit pins; attachment/pin creation and cleanup claiming must serialize against the same asset lifecycle state. Once claimed for deletion, new attachment/pin operations reject or retry before committing a reference. Expired claims are recoverable and deletion retries are idempotent. Test cleanup racing attachment/import commit, snapshot pin creation and worker recovery: no successful mutation or export may reference an object deleted by the cleaner.

### 13.2 Logical export format

- `schema_version = 1`, producer/version, export time, collection title, snapshot revision, source person/record keys, typed relationships, dates/uncertainty/locks/tags, sources, stories/residences/order and media inventory/checksums.
- Default complete export is a ZIP containing `manifest.json` and only referenced validated media objects. Optional metadata-only JSON explicitly states media omissions; it must not claim to be self-contained.
- Export does not contain the live SQLite file, account/user/child IDs, credentials, auth sessions, module grants, billing, push tokens, paths, cross-household records or unrelated modules. Identity associations export only as optional human-readable untrusted hints; import never reconnects accounts automatically.
- Create the logical record snapshot in a consistent DB read snapshot, pin its immutable media and stream from a bounded staged artifact. Do not copy a WAL-backed live database file or trust a checkpoint statement as proof of completeness.
- Download/export IDs are authorized references, not public bearer links. Revalidate permissions at job execution and download; expire staged artifacts, default 24 hours, with cleanup. No runtime API accepts an arbitrary server output path.

### 13.3 Staged append import

Workflow: Upload → bounded parsing/validation → human preview → revision-bound confirmed commit → refreshed readback.

Proposed archive limits: 100 MiB compressed input, 250 MiB total expanded data, at most 1,000 media files; collection defaults at most 5,000 people, 20,000 relationship facts and 40,000 combined story/residence records. Reject the entire request when limits would be exceeded, unless a future explicit chunked import protocol is approved. Document memory/worker/time budgets and bounded job processing rather than processing the whole archive inside a write transaction.

- Create exclusive private staging directories with cleanup on success, failure, cancel and TTL expiry. Validate declared format/version, paths, entries, media/checksums, references, dates, lock flags and ancestry; reject symlinks/duplicate paths and unrecognized unsafe structures.
- No database-file installation/replacement. Parse only the supported logical format. The job is scoped to household/actor, cannot choose a household, and strips/rejects imported authorization/account fields.
- Preview all counts, missing media, chronology warnings, duplicate suggestions, unsupported fields and source identity hints. Unknown schema versions fail safely; no silently discarded required fields.
- Release 1 import mode is **append** into the existing collection with fresh local IDs. Retain source keys/provenance for suggestions; repeated same-job commit is idempotent. A separately uploaded identical package warns of prior provenance and requires explicit review; it cannot silently mutate prior records.
- Commit only after all media is validated and privately published ready. In one SQL transaction claim graph revision, create records/links and complete the receipt/job. Any error leaves current people, links and media unchanged; unreferenced staged objects are cleaned later.
- An empty incoming media set means no new attachments, not copying previous unrelated media into imported records. Export only media referenced by the current logical snapshot.
- A permission change, expired job or concurrent revision change invalidates commit. Never reapply a stale preview automatically.

### 13.4 Replacement/restore boundary

Interactive full-tree replacement is deferred. Production disaster recovery is an authorized operator workflow, not a module upload API. A future module-only replacement must require owner/manage/password confirmation, a verified logical recovery point including referenced media, exclusive mutation coordination, validated staged data and rollback/readback; it must never restore Chores/auth/billing or replace the whole application DB. Do not expose an unfinished Replace button.

### 13.5 Backup/recovery operations

Extend existing online SQLite backup/restore operations to include genealogy media and a manifest of snapshot IDs/checksums. Coordinate consistent logical revisions with immutable media retention; DB-only backups are insufficient once images exist. Enforce private storage, access-controlled backup inventories, alerts, retention and periodic disposable restore rehearsal. Module disable leaves content recoverable. Purge/household deletion documents when older backups expire; do not promise immediate removal from historical backups if the operation cannot deliver it.

### 13.6 Deferred standalone/legacy adapter contract

An optional `family_tree` migration adapter is a later explicit slice, never an excuse to install its SQLite file into the shared DB:

- Accept a bounded standalone ZIP or SQLite input **as read-only source** in an isolated converter; produce the same staged logical preview format as Release 1 import.
- Recognize supported source schemas explicitly, including old `relationships_partner`, later `relationships_spouse`, stories and `maiden_name` differences. Unknown schemas quarantine/fail; no `CREATE TABLE IF NOT EXISTS` pseudo-migration against the production DB.
- Preserve original IDs only as provenance; map parent types, guardian links, union history, dates, stories/residences and referenced media. Paths are not trusted; missing/out-of-package assets are reported, never fetched from server filesystem or remote URLs.
- Where the old app never persisted uncertainty/locks/tags, report them as unavailable—not recovered/invented. No demo dataset auto-seeding or inference of real genealogy from Family Manager roles.
- Use isolated historical fixtures and validate all data through the current target model before preview/commit. The converter has no household-auth/session authority.

## 14. Migration, deployment, rollback and observability

- Alembic alone changes production schema. Test fresh install, previous application-head upgrade, future downgrade limitations and preservation of existing household/users/children/chores/homeschool/recipes/notifications/billing.
- No genealogy tables are populated with real/demo people during the schema migration. First creation is an authorized runtime transaction; existing accounts are not auto-linked.
- Verify household-scoped indexes, constraints, cascading association-only account deletion, nullable creator attribution and media lifecycle. Registration/missing-row rollout changes belong in the same release.
- Deploy migrations with a verified online application backup and media manifest; restart only after schema compatibility checks. Stage global activation separately from household opt-in.
- Rollback initially disables the global module and hides the feature while preserving schema/data. Do not run destructive down migrations against newly created genealogy content merely to roll back UI code; verify backward-compatible old code behavior or hold the compatible backend.
- Observe request latency, graph truncation/validation warnings, revision conflicts, cycle rejection, staged-job failures/expiry, media cleanup/backup failures and storage quotas. Metrics use IDs/counts, not family content.
- No new push/anniversary notification scheduling in Release 1. Any later notification must reuse module-scoped access/preference/lifecycle checks and avoid leaking living-person history on lockscreens.

## 15. Traceability from the standalone review

The October 13 review identified these exact-reference issues; adaptation requirements supersede copying their implementations:

- **F01** desktop compile/config failures → use existing FastAPI/web/Expo stack; no Tauri build or second DB.
- **F02** false-green verification → nonempty tests, canonical manifest/contract gates, CI and actual platform evidence.
- **F03** empty first run → sections 6.1, 9.1 and atomic initial person creation.
- **F04** import corruption/media loss → staged append, whole-job validation, atomic SQL commit and immutable media.
- **F05** export overwrites live DB → logical generated exports, no client output paths or raw DB copying.
- **F06** ineffective legacy migration → real Alembic upgrades; optional source converter with historical fixtures.
- **F07** cwd-dependent storage → existing configured DB plus private configured media storage.
- **F08** lost tags/locks/uncertainty → durable complete Person contract and round-trip tests.
- **F09** ancestry hangs → backend transactional cycle prevention plus independently bounded renderer.
- **F10** lost concurrent updates → true patches, explicit nulls and optimistic graph revision.
- **F11** wrong spouse generations → ancestry precedence and preserved partner soft-constraint routing.
- **F12** erased parent/care meaning → typed facts, nonancestry care links and qualified comparison/labels.
- **F13** disconnected components inaccessible → directory focus/bookmarks and bounded component navigation.
- **F14** orphan relative creation → single transactional create-relative command.
- **F15** unsafe hydration → permission/load gates, no demo fallback and stale-response protection.
- **F16** duplicate stories → pending UX plus backend idempotency.
- **F17** null cannot clear → field-presence-aware patch DTOs and clear-value regressions.
- **F18** old media contaminates exports → snapshot-reference inventory and scoped append import.
- **F19** inconsistent WAL export → logical DB read snapshot and operator SQLite online backup policy.
- **F20** invalid date editing → shared partial-date semantics plus authoritative server validation.
- **F21** transformed editor overlay → properly managed web portals/native modals.
- **F22** keyboard/dialog/contrast gaps → full accessible selection, labels, focus and color-safe accents.
- **F23** unknown dates become years 0–24 → explicit unknown-date bucket/label.

Additional source limitations—one spouse, two parents, omitted story/residence edit tools, no real duplicate merge, unverified rich Markdown/media, unclear co-parent/collapse semantics and monolithic layout—are explicitly resolved or scoped in this specification. The source review is evidence about the old application, not a claim those defects currently exist in Family Manager.

## 16. Acceptance matrix and regression fixtures

No checkbox below is complete merely because a spec or UI exists.

### Security and module integration

- Anonymous, expired/revoked session, disabled global/household module, denied user, view-only writes, child and platform-support direct calls fail as specified.
- Cross-household IDs denied for **every** people/link/story/residence/media/job/merge/receipt/account-link endpoint, including download/replay/cancel.
- CSRF/session transport correct for JSON/multipart/binary web/native operations; no content on disabled direct routes or access-load failures.
- Owner-only purge denies ordinary admins/nonowner managers; account linking grants no account administration.
- Disable/re-enable retains data; module manifest/platform registrations/default grants and missing-row/fresh-household policy agree.

### Integrity and collaboration

- Create/edit/restart/export/import preserves each name, date/precision/uncertainty, living state, tag, lock, image and attribution.
- Omitted/null/value patches behave distinctly; stale concurrent disjoint edits produce explicit conflict rather than overwrite.
- A→B→A and simultaneous opposing-link requests never persist a cycle; corrupt projection never hangs the client.
- Failed create-relative, duplicate story tap, repeated commit/retry and timeout recovery produce no orphan/duplicate/partial row set.
- Lock enforcement covers person, link, story/residence, merge, archive and purge; authorized unlock is durable/audited.
- Identity-link lifecycle preserves other modules and family history; mismatch/duplicate account links fail.
- Merged-alias reads resolve safely; alias edits/restore/lock/merge inputs fail with `person_merged` without changing the canonical person. Alias purge preserves moved target records; canonical purge with surviving aliases fails with `merge_aliases_present`; explicit alias removal followed by fresh target purge leaves no dangling redirects. A concurrent new merge invalidates or blocks the target purge. Merging B into C when A already aliases B retargets both aliases directly to C atomically, without chains.

### Genealogy and visual fixtures

Use synthetic disposable families covering: unknown/single names; unknown/partial/uncertain/leap dates; biological/adoptive/step parents; guardian-only connections; unmarried co-parents; childless/nonparent partner branch; repeated/divorced partners; disconnected trees; shared ancestors/pedigree collapse; archived/merged people; a cross-generation partner route; corrupt cycles; shared descendants under one collapsed branch; dense graph/truncation.

Assertions cover typed returned facts, layout termination/determinism, preserved explicit links, correct focusability and qualified labels—not only screenshot overlap. Compare must not mislabel guardian links as genetic kinship; historical partner display changes when the filter changes.

### Transfer, media and recovery

- Invalid dates/schema/references/cycles/media/checksums/oversized input fails staging without touching existing records/media.
- File decoding/path/structure limits enforced; cleanup succeeds for failed/canceled/expired/crashed staging; no arbitrary server path access.
- Append remaps IDs, preserves provenance, omits identity/grant import, requires review and is revision/idempotency bound.
- Export excludes other modules/accounts and unrelated media; a concurrent edit does not produce a mixed logical snapshot.
- Disposable operator restore from DB+media backup recovers a complete usable tree and preserves unrelated modules; record integrity/checksum results.
- Cleanup races with new attachment/import commit and export/backup pin creation cannot delete a required object; deletion-claim crash/retry/expiry cases are covered with actual state readbacks.

### Web and native workflows

- Fresh empty tree → first person → relative → story/residence/photo → refresh/relogin → second authorized adult readback.
- View-only adult reads, cannot mutate; manager concurrent-edit conflict retains draft; disconnected directory entry focuses tree.
- Archive final active person → empty state → restore/create; merge preview/cancel/commit; import preview/cancel/commit; export/download.
- Manual zoom survives incidental renders; keyboard/list alternative works; dialogs are not clipped/scaled with canvas; touch targets/readability correct.
- Offline/revoked session/household switch clears or marks cached state according to section 11, with no hidden persistent cache.
- Native screens exercise actual API/attachment adapters on a device or emulator, not only web Playwright at mobile width.

## 17. Dependency-ordered delivery checklist

This is the sole Family Tree implementation checklist. All implementation/review/release boxes start unchecked; specification creation does not complete them. Each slice uses RED → minimal implementation → GREEN for behavior, then adjacent gates. Documentation-only specification changes use format/link/content checks instead of invented runtime RED tests.

### FT-0 — Contract and privacy foundation

- [ ] Confirm this Release 1 scope/permission/deferred-capability contract before behavior delivery.
- [ ] Add focused failing module/role/household/missing-row tests; implement manifest/catalog/registration rollout behind disabled access.
- [ ] Define shared/Pydantic DTOs, true-patch date semantics, error envelopes and revision/idempotency mechanics before clients.
- [ ] Extend multipart/binary transport mechanics with explicit platform security tests; no feature data persistence in shared transport.
- [ ] Verify adjacent module/identity/auth behavior and canonical manifest validator.

### FT-1 — Schema and secure adult core

Depends on FT-0.

- [ ] RED migration/persistence/tenant/patch/revision/identity-link tests; add Alembic tables, constraints and scoped services.
- [ ] Implement collection/person/tags/lock/archive/restore and atomic first-person/relative creation.
- [ ] Implement typed parent/care/partner histories with transactional cycle checks.
- [ ] Implement complete story/residence CRUD/reorder and identity-link lifecycle isolation.
- [ ] Verify fresh/existing DB migration and every advertised Person field round trip; no real data migration automatically.

### FT-2 — Graph and complete web/mobile core flows

Depends on FT-1; pure layout tests may start against frozen contracts from FT-0.

- [ ] RED all genealogy fixture projections/layout/termination/collapse/compare/unknown-date tests.
- [ ] Implement bounded projection and decomposed deterministic layout/list alternative.
- [ ] Implement both clients' onboarding/directory/focus/detail/relationships/stories/residences/compare/locks/archive flows using existing tokens/navigation.
- [ ] Add permission/load/conflict/retry/draft/zoom/accessibility tests; no phantom seed data or persistent genealogy cache.
- [ ] Register only implemented platform routes/guards/dashboard/navigation and run web/mobile contract validation.

### FT-3 — Media, merge and portable transfer

Depends on FT-1/FT-2; does not authorize production data writes.

- [ ] RED managed upload/decode/reference/cleanup/permission tests; implement private immutable media and tested native/web adapters.
- [ ] RED merge conflict/cycle/identity/attribution/rollback/retry tests; implement previewed atomic merge on both clients.
- [ ] RED logical snapshot/export/import limits/ID remap/rollback/stale-preview/idempotency tests; implement append transfers and complete UI states.
- [ ] Add job/cleanup/backup manifests, bounded worker/operational tooling and disposable DB+media restore rehearsal.
- [ ] Verify that archive/purge/deletion preserve shared media and unrelated modules; owner-gated permanent purge remains explicit.

### FT-4 — Verification, rollout and product proof

Depends on FT-0 through FT-3.

- [ ] Independent exact-revision spec/security/data-integrity/implementation review; resolve applicable High/Critical findings, never treat timeout as approval.
- [ ] Final local/shared/backend/web/mobile/architecture/migration/dependency gates plus required PR CI green at the exact candidate.
- [ ] Authorized merge only, then integration-branch CI at the resulting commit; deployment remains separately authorized.
- [ ] Integrity-checked predeployment DB+media backup; staged schema deployment; explicit global activation and one controlled household opt-in.
- [ ] Live authorized API readbacks, adult/view-only/denied/child negative journeys, desktop/mobile-web screenshots, native device/emulator proof and export/restore evidence.
- [ ] Confirm no disposable fixtures remain in real households, no real family data was altered by QA, and rollback/disable preserves content.
- [ ] Update current-scope/docs/runbooks only with matching implementation/CI/deployment/device evidence.

### Future work, separate acceptance scope

- [ ] Child-approved read-only projection with explicit parent sharing, redaction of living/sensitive facts, export/media restrictions and independent privacy tests.
- [ ] Optional native-source conversion adapter using section 13.6; GEDCOM only after a separately sourced format/compatibility decision.
- [ ] Offline writes, public sharing, richer kinship/reports/notifications or paid entitlements only after separately approved contracts/gates.

## 18. Verification commands and deliverables

These are grounded in current root scripts/CI; run from the actual implementation checkout with its supported Node/Python environment. Newly named Family Tree tests do not exist yet and must be created in their slices.

```bash
npm run modules:validate
npm run lint --workspace frontend
npm run test --workspace frontend
npm run build --workspace frontend
npx vitest run packages/family-api/src/*.test.ts --environment node
npm run mobile:gate
.venv/bin/pytest backend/tests -q
.venv/bin/pytest backend/tests/test_module_contract.py -q
.venv/bin/pytest backend/tests/test_alembic_migrations.py -q
python3 scripts/architecture-report.py --strict
node --test scripts/*.test.mjs
npm audit --workspace frontend --omit=dev --audit-level=high
bash scripts/audit-mobile-runtime-dependencies.sh
pip-audit --strict backend
git diff --check
```

Migration comparison must target a disposable freshly migrated database, never an implicit production/default URL. With `TMPDIR` configured to a disposable workspace and the project virtualenv installed, run from the repository root:

```bash
ROOT_DIR="$PWD"
MIGRATION_GATE_DIR=$(mktemp -d "${TMPDIR:?Set TMPDIR to a disposable workspace}/family-tree-migration.XXXXXX")
(
  cd backend
  export APP_ENV=test
  export DATABASE_URL="sqlite:///$MIGRATION_GATE_DIR/gate.sqlite"
  "$ROOT_DIR/.venv/bin/alembic" upgrade head
  "$ROOT_DIR/.venv/bin/alembic" check
)
```

`pip-audit` is separate audit tooling installed by CI; install it only in an approved isolated tooling environment when local verification requires it. The migration gate directory is a disposable artifact subject to that workspace's cleanup policy.

New proposed targeted suites: `backend/tests/test_family_tree_api.py`, `test_family_tree_integrity.py`, `test_family_tree_transfer.py`, `test_family_tree_media.py`, domain-boundary tests under `backend/tests/services/`; shared DTO/endpoint/core algorithm tests; web route/component/Playwright tests; native screen/transport tests. Add them to the appropriate configured test discovery/CI without permitting zero-test success. Pure package tests are an additional explicit gate if `packages/family-tree-core` is created.

Use disposable isolated DB/media storage and the existing `backend/app/smoke_safety.py` boundary for E2E fixtures. Never copy historical live-seed commands from old planning documents into production QA. Native APK publication/install and iOS device evidence are separate platform gates; lack of iOS hardware/provider access must be labeled, not treated as parity proof.

Final implementation deliverables are source/contract/migration changes, tests, web/native module integrations, private media/transfer/recovery tooling, role/module matrices, concise operator/user docs, exact-revision review/CI results, authorized release/deployment records and verified user journeys. This specification's repository presence is not any of those implementation claims.

## 19. Decisions fixed by this proposal

To make the document executable rather than a list of unanswered questions, this proposal chooses: `family-tree` as key; one household collection with disconnected branches; adult-only Release 1; household-shared—not creator-private—content; backend role/module authority; parent profiles independent of genealogy; optimistic collection revisions; bounded projections; private managed media; safe append logical import; owner-confirmed permanent purge; no Tauri/raw-DB replacement; no unapproved paywall, public sharing or offline writes.

Approval of a later implementation phase may revise these product choices, but must update the permission matrix, schemas/API contracts, rollout, acceptance tests and checklist together. Unavailable credentials/hardware do not justify invented release evidence or weakening isolation/recovery gates.
