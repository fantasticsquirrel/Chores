# FT-2 core evidence — October 13, 2026

Scope: only `packages/family-tree-core/**`; pure algorithm lane, not full Family Tree delivery. No root/lockfile/shared DTO/backend/client/docs or Git edits were made by this lane. Root dependencies were installed by the parent integration worker; initial RED/GREEN used existing external Vitest/TypeScript tooling without copying or installing dependencies.

## Observed TDD

Commands ran from `/root/.hermes/worktrees/chores-family-tree-implementation-20261013`.

Initial RED runner:

```sh
node /var/ralph-projects/chore_tracking/node_modules/vitest/vitest.mjs run packages/family-tree-core/src/dates.test.ts --root /root/.hermes/worktrees/chores-family-tree-implementation-20261013 --config packages/family-tree-core/vitest.config.ts --reporter=dot
```

- Date RED: **24 failed**, exit 1. Real imported temporary production functions threw `Partial date validation/range/chronology/presentation not implemented`; validation assertions also rejected the wrong error. No missing dependency or test-discovery failure. Implemented Gregorian date/range/uncertainty behavior; same runner returned **24 passed**, exit 0, with production typecheck passing.
- Graph RED: same runner with `src/graph.test.ts`: **25 failed**, exit 1, because imported normalization/layout/comparison functions were unimplemented. Added staged implementation; combined date/graph run returned **49 passed**, exit 0.
- Defense RED: `src/defenses.test.ts`: **4 failed / 6 passed**, exit 1. Actual assertions exposed null uncertainty silently becoming certain, incomplete endpoint aliases being repaired, ambiguous duplicate people selecting first input metadata, and an oversized collapse array being read during fallback. Fixed these; full run returned **59 passed**, exit 0.
- Container/collapse regression RED on installed root Vitest: `node node_modules/vitest/vitest.mjs run packages/family-tree-core/src/defenses.test.ts --environment node --reporter=dot -t 'rejects malformed projection containers'`: **1 failed / 10 skipped**, exit 1, with null projection array access throwing. Implemented bounded array/container validation. Final **60 passed**, exit 0.
- Intermediate typecheck caught an `Array.isArray` narrowing to `any[]`; explicit generic array annotations corrected it. Final strict typecheck includes production and test files and passed.

The remaining defense characterization cases passed on their first run; they were not misrepresented as newly demonstrated RED cases. Temporary unimplemented functions were replaced, not shipped.

## Final local gates

```sh
npm run test --workspace @family-manager/family-tree-core -- --reporter=dot
npm run typecheck --workspace @family-manager/family-tree-core
npm run benchmark --workspace @family-manager/family-tree-core -- --reporter=verbose
node node_modules/vitest/vitest.mjs run packages/family-tree-core/src --environment node --reporter=dot
```

Final observed results:

- Package unit gate: **3 files / 60 tests passed**; final post-config-cleanup rerun took 1.47 s total runner duration.
- Strict TypeScript: **passed**, exit 0, including tests.
- Benchmark validator: **1 file / 1 test passed**, 3.04 s total runner duration.
- Direct root discovery: **3 files / 60 tests passed**, 1.15 s total runner duration. Imports explicitly use Vitest, so callers do not need package-only global injection.
- Package test/benchmark configs explicitly set `passWithNoTests: false`.

Coverage includes unknown/single names, year/month/day/leap/uncertain dates, every parent/care kind, unmarried co-parents, unrelated/childless partner branches, repeated/historical episodes, disconnected focus, shared pedigree/descendants, archive/merge omission, cross-row partners, cycles, independent collapse, dense exact ceilings, bounded over-ceiling reads, iteration exhaustion, typed comparison and invalid input/list diagnostics.

## Host-only benchmark

Actual machine: **Linux x64, kernel 6.8.0-136-generic, AMD EPYC Processor (with IBPB), 4 available execution CPUs, 7.755073547363281 GiB host memory; Node v26.7.0; Vitest 4.1.8**. The live Node version is outside the repository engine range `>=20.19.4 <21`; rerun integration/device gates on the pinned supported toolchain. No alternative Node 20 executable was found during this lane.

Each fixture: binary mixed-type ancestry, directed care context, explicit current/ended partner episodes, partial/uncertain/unknown birth dates and preserved metadata. **25 warmups + 200 timed samples**; each sample executes complete pure normalization/index construction, visibility/ranking/grouping/placement/routing/list construction, without a global result cache. Every result was asserted graph mode, complete expected node/route counts, no truncation and bounded work.

| Nodes | Edges | Work iterations | Minimum ms | p50 ms | p95 ms | Maximum ms | Mean ms |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 199 | 3,217 | 0.792 | 1.607 | 5.851 | 28.906 | 2.494 |
| 500 | 999 | 16,001 | 3.399 | 5.354 | 15.619 | 46.888 | 7.576 |

These are measured **in-process pure layout** timings on this Linux execution host, not browser interaction, reference-desktop or Android performance acceptance. No network, actual card/SVG/native rendering, touch/gesture/accessibility, Android, iOS, release, deployment, CI, authorization or end-to-end persistence evidence was produced. The specified named-device gates remain open; these measurements do not justify changing their budgets.
