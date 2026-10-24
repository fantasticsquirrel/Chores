# Discovery package platform verification

Base: `52bac3054bdb34971b36adbe4175fa873edcb0ad` (26 bundled Explorations).
Test environment: disposable SQLite databases, Python 3.12, Node 20.19.4,
Chromium 153 with its sandbox enabled. No production data or configuration was
changed, no deployment was performed, and hosted CI was not invoked.

## Architecture and editorial review

- Existing 26 catalog entries and simulation implementations remain bundled.
  This avoids rewriting or flattening their interaction quality during a
  platform change. New content is served from household-scoped package storage.
- Immutable versions, checksummed archives, preview and publication are exercised
  through real endpoints. New publications and rollbacks require explicit
  per-version child approval. Existing subject/grade/tag bulk selection remains.
- Teaching copy is plain text, not executable Markdown/HTML. The two examples
  include prediction, controlled manipulation, observable evidence, explanation,
  model assumptions and inspected primary educational references.
- Spring Force tests proportionality and zero stretch. Pendulum Period tests
  the square-root length relationship, mass independence, equal elapsed time,
  deterministic reset and parameter boundaries. Its schematic drawing is not a
  physically scaled construction or a real clock measurement.
- Desktop and mobile-size screenshots were inspected. Numeric evidence and
  controls remain outside the diagram; Enlarge/Fit makes diagram labels
  inspectable on small screens without page overflow.

## Automated gates

Run from the repository root unless noted. Final pass counts are recorded after
all changes; focused tests are not substituted for broad gates.

- Backend: `cd backend && ../.venv/bin/pytest -q`.
- Web: `npm test`, `npm run lint`, and `npm run build`.
- Shared API: `FAMILY_TREE_CONTRACT_PYTHON="$PWD/.venv/bin/python" npm run shared-api:gate`.
- Native: `npm run mobile:typecheck` and `npm run mobile:test`.
- Packaging/schema: `.venv/bin/python scripts/discovery-packages.test.py`.
- Example physics: `node --test scripts/discovery-package-examples.test.mjs`.
- Whitespace: `git diff --check`.

The full backend sweep initially found legitimate migration head/table-count
snapshots that needed updating for the three additive tables. The assertions
still compare retained rows and unfiltered historical DDL. Historical upgrade
fixtures require predecessor commit `e6ffe2f555258d89b51a6026ab3f1d05de4e5332`;
that exact commit was fetched before rechecking those paths.

Expo's online `check:dependencies` reports baseline patch-version advisories:
`expo` 56.0.23 vs ~56.0.24, `expo-sharing` 56.0.26 vs ~56.0.27, and `jest-expo`
56.0.5 vs ~56.0.6. Package manifests/lockfiles were not changed to address these
unrelated advisory upgrades. Native typechecking and unit/UI tests are separate
from this advisory checker.

## Final results

- Full backend: **818 passed** (218 warnings).
- Full frontend: **635 passed** across 108 files; lint and production build passed.
- Shared API gate: **468 passed** across 27 files.
- Native: typecheck passed; **291 unit + 465 UI tests passed**. The separate
  Expo compatibility advisory remains as described above.
- Packaging/schema: **5 passed**; example physics: **3 passed**.
- Package browser flows: **2 passed**, desktop and mobile, on the final runtime.
- Bundled 26-Exploration browser regression: **2 passed**, desktop and mobile.
- Independent Chromium CSP/adversarial harness passed again on the final bridge.
- Final whitespace, touched package TypeScript formatting, and new backend Python
  formatting checks passed. The independently added tests were reformatted only
  after the full run and rerun separately.

## Browser evidence

Use the repository's isolated smoke wrapper, never a production database:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/sandbox-capable/chromium \
PLAYWRIGHT_CHROMIUM_SANDBOX=1 \
npm run test:smoke --workspace frontend -- e2e/discovery-packages.spec.ts
```

At 1440px and 390px the package test uploads new IDs after the application has
loaded, previews and changes a control, resets, closes preview, publishes and
navigates to the content. A document marker proves the application was neither
rebuilt nor reloaded between initial load and the fresh package rendering.
The test also covers child default denial, reviewed-version approval, offline
teardown, reconnection, online revocation, custom worker rendering, diagram
zoom, Close/Back cleanup, forward re-entry, immutable upgrade and rollback.

The existing `e2e/discovery-lab.spec.ts` independently checks the 26 bundled
Explorations at desktop and mobile sizes. Smoke wrappers must run serially:
they each rebuild the same local `frontend/dist`; parallel wrappers can remove
another running wrapper's index during a Vite build. An initial concurrent
run reproduced that harness race, not a content/runtime failure.

## Independent security checks

See [the threat model and evidence](../security/discovery-package-threat-model.md).
Independent backend cases cover malformed/hostile archives, JSON ambiguity,
finite output bounds, tenant/role/module boundaries, revocation and stale-review
approval. Frontend cases reject malformed drawing output and persistent-cache
poisoning and verify identity changes purge cached content.

```bash
CHROMIUM_EXECUTABLE_PATH=/path/to/sandbox-capable/chromium \
node scripts/security/discovery-package-browser-audit.cjs
```

Real Chromium CSP violation events confirm that recovered network APIs,
external/blob imports, importScripts and eval are blocked. Wrong capability,
hung input, cyclic output and oversized output are rejected/stopped. The
worker has no host DOM, session/child data or native bridge.

## Explicit limits

- Downloaded packages run in the web app, not native. Native labels this
  accurately and preserves its existing 26 supported simulations.
- Cache is bounded, identity-scoped memory only. There is no persistent/offline
  authorization. Online runtime checks recur every 15 seconds with a five-second
  deadline; offline/failed checks close the runtime. Already-delivered bytes
  cannot be recalled from an authorized recipient.
- Browser workers provide no hard CPU/memory quota. A watchdog is an availability
  mitigation, not a guarantee against hostile-code resource exhaustion.
- Chromium was exercised; Firefox, Safari and embedded native WebViews were not.
- Platform changes still require deployment. The no-redeploy result applies to
  new packages within the installed schema/runtime capabilities.
