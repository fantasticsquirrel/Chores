# Chance Carnival + Leaf Energy Lab visual redesign

Date: 2026-11-01  
Branch: `feat/discovery-learning-overhaul`  
Baseline: `6e8292670e44ab0b85501c50e48f4c90d866a45b`

## Guardrails

- Preserve the existing prediction gates, two guided investigations, evidence,
  explanations, reset behavior, shared calculations and native behavior.
- Replace presentation, not model results. Every chart, pointer, flow and meter
  must be derived from the current activity state.
- Keep labels and exact values available without color or motion. Use restrained
  motion only for meaningful state changes and disable it for reduced motion.
- Keep the web redesign inside the Discovery feature boundary. Do not change
  authorization, persistence, deployment routes, production data or releases.
- Treat native and independently sandboxed package visuals as separate evidence;
  do not imply device or package parity without verifying it.

## Baseline findings

- Chance uses a large decorative WebGL spinner with small rotated outcome labels;
  its distribution, recent draws and guided comparisons read as separate stacked
  panels instead of one experiment.
- Chance mobile expands into a long run of generic cards. The two sample sizes
  are preserved numerically, but their distributions are not visually compared.
- Leaf uses a dark block-like WebGL cutaway whose tissue, cell and chloroplast
  scales are difficult to distinguish. Light, water and gases do not read as
  clearly different energy and matter flows.
- Leaf's live model result is outside the artwork, so input changes do not feel
  connected to the diagram even though the underlying state is correct.

Matched baseline captures are stored under
`/tmp/ui-captures/exploration-visual-redesign/2026-11-01/` for desktop
1440 × 1000 and mobile 390 × 844, initial and operated, full page and component.

## Checklist

- [x] Freeze and inspect the matched isolated-fixture baseline.
- [x] Redesign Chance graphics and compose its instrument, evidence and guided comparisons as one workbench.
- [x] Redesign Leaf graphics and compose its state-responsive process diagram, evidence and guided investigations.
- [x] Run relevant web/shared/native/package/security/architecture gates, capture and inspect matched finals, publish comparison media, and record limitations.

Verification: `docs/verification/2026-11-01-exploration-visual-redesign.md`.
