# Discovery Lab publishable packages

## Scope and architecture

Keep the 26 bundled Explorations and native simulations as a compatibility
catalog. Add household-scoped immutable content-package versions, a mutable
published pointer, and explicit version-bound child grants. Publishing and
rollback never implicitly approve a newly selected version for a child.
Existing module, household, role, CSRF and child boundaries remain authoritative.

Parents with Discovery management access upload a validated ZIP, preview it,
and publish or roll back through the application. The running web app fetches
new content without a new build. Declarative scenes reuse trusted components;
custom JavaScript computations run inside an isolated worker and communicate
only bounded drawing/control data. Arbitrary package HTML never executes.

Native keeps the full existing bundled experience and clearly marks downloaded
packages web-only. Downloaded executable native code is not supported. Package
resources may be cached, but cached content is never an offline authorization
grant: online checks are required and failures close the running package.

## Checklist

- [x] Inspect repository standards, ancestry, existing content and access seams.
- [x] Implement backend validation, persistence, migration, preview/publication,
      rollback, child opt-in and adversarial/API tests.
- [x] Implement shared contracts, web authoring, isolated runtime, cache and tests.
- [x] Clarify native unsupported-package behavior without replacing bundled sims.
- [x] Add author guide, usable declarative/custom examples and packaging tooling.
- [x] Independently review tenant security, archive attacks and browser isolation.
- [x] Run backend/shared/web/native gates and mobile-sized browser interaction
      checks, including publication after the app has already loaded.
- [x] Record evidence and remaining limits; prepare a reviewable branch. Do not
      deploy, change production configuration or merge.

## Verification requirements

Use targeted tests before implementation, then adjacent and full applicable
gates. Browser testing must prove meaningful controls, interrupted/repeated
flows, current access enforcement, and a fresh published package rendering in
an already built app. Security review must exercise real browser worker CSP
inheritance, outbound channels, forged messages and malformed drawing data.
Record commands and honest failed/unrun stages in verification documentation.

## Outcome

Implementation and verification complete. See
[`docs/verification/discovery-packages-2026-10-24.md`](../verification/discovery-packages-2026-10-24.md)
for test evidence and explicit limitations. Prepared for draft review only;
not merged or deployed. Hosted CI is intentionally skipped.
