# Family Tree Core (FT-2 algorithm slice)

Small platform-neutral TypeScript helpers. No runtime dependencies, React, DOM/native renderer, authorization, transport, database writes, global cache, or persistent data. This package does **not** complete the Family Tree module or its web/native acceptance gates.

## Exported contracts and integration

Entry point: `@family-manager/family-tree-core` (`src/index.ts`).

- Dates: `parsePartialDate`, `partialDateRange`, `assessChronology`, `birthYearPresentation`, `PartialDateError`, associated input/result types.
- Graph: `prepareGraph`, `layoutGraph`, `comparePeople`, generic `GraphInput<N, E>`, `GraphNode<N>`, `GraphEdge<E>`, `PreparedGraph<N, E>`, result/options types.
- Semantics: `relationshipLabel`, `relationshipPattern`, `RELATIONSHIP_LEGEND`, `DEFAULT_LIMITS`, `HARD_LIMITS`.

These deliberately self-contained input types are **not** API DTOs. A client/shared-contract adapter must supply only an already-authorized server projection:

```ts
const projection = {
  nodes: people.map(person => ({
    id: person.id,
    label: person.display_name,
    birthDate: person.birth_date,
    archived: person.archived_at != null,
    mergedIntoId: person.merged_into_person_id,
    metadata: person, // preserves names, flags, nulls, attribution and other supported facts
  })),
  edges: parentLinks.map(link => ({
    id: link.id,
    type: 'parent' as const,
    kind: link.kind,
    parent: link.parent_id,
    child: link.child_id,
    metadata: link,
  })),
};
const prepared = prepareGraph(projection);
const result = layoutGraph(prepared, { focusId: selectedPersonId });
```

The adapter is illustrative, not an assumed canonical DTO shape. Parent/care/partner category and kind must be mapped explicitly; never infer partnerships from co-parents, gender, accounts or dates. Care/partner inputs use `source`/`target`; parents accept either `source`/`target` or `parent`/`child`. Contradictory or incomplete simultaneous aliases are rejected. Partner endpoint order is canonicalized numerically, without merging repeated episode records. Positive safe integer IDs are required. Relationship identity is **`type:id`**: independent tables may reuse numeric IDs. Node and relationship metadata retain their generic type and original reference; dates, uncertainty, episodes and attribution are not dropped.

`prepareGraph` owns normalized lookup construction. Reuse the returned read-only index for immutable projected inputs across focus/lens changes; callers may memoize that stable input in their own in-memory render lifecycle. There is no module-level cache, all-person candidate filtering, viewport state, fit/zoom command, or persistence. Never mutate an input or a prepared index after handing it to the library. The package does not decide permission, request continuations, approve chronology warnings, or alter canonical records.

## Dates

Gregorian literal `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, years 0001–9999. No whitespace repair, timestamps, timezone coercion, impossible leap/calendar days, or false precision. `precision` is derived from the validated value; any supplied precision is nonauthoritative. Omitted uncertainty defaults to false; supplied uncertainty must be boolean. Null remains unknown.

Ranges return inclusive ISO start/end strings and calendar-day ordinals (year 1 begins at ordinal 1), not JavaScript timestamps or fabricated January 1 facts. `assessChronology` applies to birth/death or an episode/residence start/end: definitely reversed certain ranges are errors; uncertain or partially overlapping ranges are review warnings; missing endpoints are unknown. It does not invent facts or manager approval.

Birth color bands are 25-year buckets, separate from ancestry rows. Unknown has its own bucket and the exact label **“Birth year unknown”**. Known year 1 is clipped to the valid 1–24 range, not mistaken for an unknown year. Uncertain birth years are labeled explicitly. Invalid date input uses a review diagnostic and an invalid-date list label, not a fabricated birth year.

## Graph semantics and bounds

Stages: normalization/indexes → directional visibility → cycle validation/ancestry ranks → partner component alignment → stable placement → typed routing/list/diagnostics.

- Default limits: **250 nodes / 500 edges / 20,000 work iterations**. Hard ceilings: **500 / 1,000 / 100,000**. Invalid limits return a list diagnostic; they do not silently increase ceilings. Normalization/list work is independently bounded by node/edge ceilings; `stats.iterations` counts iterative graph work, not parsing/sorting/list formatting.
- Depth defaults to two ancestors/two descendants, with an explicit 0–32 depth bound. Partner/care context defaults off and must be requested. Requested context traverses partner/care networks with visited sets, but does not open additional ancestry behind that lens. Historical partner episodes default shown; explicitly disabling history hides ended/separated episodes, not unknown-status facts.
- Every parent kind drives ancestry. Care does not. Kahn ranking detects cycles across the entire bounded projection, including off-lens corrupt components. Partner alignment translates whole parent-connected components only; incompatible same-row constraints become labeled cross-generation partner routes. It never flattens ancestry.
- Same-row partner groups are kept together. Layout coordinates are abstract card-center units, not native pixels; clients own card sizing/rendering. Routes preserve the complete typed edge and labels/patterns. Multi-parent junctions have the distinct `co-parent-junction` type and **“Recorded co-parents (not a partnership)”** label.
- Independent ancestor/descendant collapse stops traversal and suppresses that directional parent fact, even if another ancestry/context branch reveals both endpoints. Suppressed facts are also absent from the list. Shared reachability exposes `also_connected` diagnostics. Local expansions contain person, direction, reason and unique adjacent-person count; they are **not** fabricated server continuation tokens or global counts.
- Archive/merge markers omit nodes from this normal active projection. A disconnected node remains focusable when explicitly selected. Missing focus never silently chooses the first inserted person: it returns a bounded directory/list fallback.
- Error/cycle/iteration/limit results use `mode: 'list'`, with **no partial geometry or routes**. Typed relationship rows remain usable, subject to explicit filters/collapse. Truncation carries original input counts and `requiresExpansion`; smaller/incomplete indexes cannot recover discarded records merely by increasing options.
- Within hard ceilings valid inputs are deterministically sorted by positive IDs/type, independent of array ordering and system locale. Oversized corrupt input is never scanned beyond the first 500 node/1,000 edge entries; its bounded fallback subset is therefore not a promise of a canonical complete tree. Obtain a new authorized bounded projection.
- Comparison is a bounded, visited undirected shortest path over explicit facts, with deterministic person-ID/type tie-breaking, directed explanatory labels, metadata and distance. It does **not** calculate named kinship or genetic degree. Disconnected/invalid/limited results never masquerade as a completed path.

## Repeatable gates

From the repository root, with the parent-managed locked dependencies installed:

```sh
npm run test --workspace @family-manager/family-tree-core
npm run typecheck --workspace @family-manager/family-tree-core
npm run benchmark --workspace @family-manager/family-tree-core -- --silent=false --reporter=verbose
```

Direct root discovery also works: `npx vitest run packages/family-tree-core/src --environment node`. The package config disables zero-test success. Typecheck covers production source **and tests** without a DOM library. Benchmarks are isolated under `benchmarks/` and are not timed acceptance tests in the ordinary unit gate. See `EVIDENCE.md` for observed RED/GREEN and host-only benchmark evidence; there is no desktop interaction, Android/iOS, deployment, CI or full-module proof here.
