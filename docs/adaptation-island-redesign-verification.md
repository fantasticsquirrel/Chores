# Adaptation Island redesign verification

Review checkpoint: 2026-11-04 on `feat/discovery-learning-overhaul`. This does
not authorize merge, deployment or publication.

## Delivered learning path

Web, native and standalone package now share two prediction-first controlled
investigations, exact five-generation expected proportions, correct-or-incorrect
feedback, changed/held-variable disclosure, stale-evidence clearing and full
reset. State normalization bounds generation to 0–20 and shares to 0–100 while
preserving a 100% total. Shared/package model, trial and scene parity is tested.

The dimensional island, terrain, beetles, predator, vegetation, pebbles and
interactive camera remain. A concise noncolor scene label now reports generation
and dark/pale proportions. Claim provenance, invented weights and exclusions are
in [adaptation-island-copy-research.md](adaptation-island-copy-research.md).

## Focused verification

| Check                                                 | Result                  |
| ----------------------------------------------------- | ----------------------- |
| Shared model/life-geometry/scene tests                | pass, 16 tests          |
| Web life-geometry tests                               | pass, 11 tests          |
| Native expansion interaction tests                    | pass, 26 tests          |
| Package parity and prediction/reset checks            | pass, 2 tests           |
| Independent generated worker check                    | pass, 1 test            |
| Frontend production build and native scene generation | pass                    |
| Native offline browser scene                          | pass; no remote request |

The full integrated gates and three tracked cross-series regression fixes remain
the next checkpoint.

## Browser and visual evidence

- True-before, final web and generated-package desktop/mobile initial/operated
  captures are staged under
  `/root/.openclaw/workspace/media/exploration-series/adaptation-island/`.
- Final report hashes: web
  `5648d6448e330ca46c4f63f211e46aa9f5f75be28ea234504d66f8f93fc13f4b`;
  package
  `aafab9baabacae74f408e857b948b5d2fdcd390e1cef7cb4f95290020f4273b4`.
- Native offline image SHA-256:
  `9a6725126f637de4170c38245d304292b5d25cd63dc81c85419488634548c31c`.
- Reports record no browser errors, failed requests, external requests or
  horizontal overflow. The package records only the expected opaque-iframe
  service-worker denial.

Chrome ran as UID/GID 65534 through `/usr/sbin/runuser`, with isolated writable
HOME/XDG and `chromiumSandbox:true`. Grid navigation used `visibility:hidden`,
not `display:none`. Essential desktop/mobile web, package and native images were
inspected; the final population callout no longer overlaps package introductory
copy. No physical-device or real screen-reader session was performed.
