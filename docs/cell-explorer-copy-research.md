# Cell Explorer copy and model research

Reviewed 2026-11-04 for Exploration #24.

## Claim map

| Shipped claim                                                                                                                               | Evidence reviewed                                                                                                                                                                                                          | Lesson boundary                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plant and animal cells share a cell membrane and mitochondria; plant cells also have a cell wall, chloroplasts and a large central vacuole. | [OpenStax Biology 2e, 4.3](https://openstax.org/books/biology-2e/pages/4-3-eukaryotic-cells) describes these structures and their roles.                                                                                   | The scene is a representative photosynthetic plant cell, not a claim that every plant cell contains chloroplasts or has the same shape.                         |
| Small nonpolar oxygen can cross the lipid bilayer directly, while glucose requires a membrane transport protein.                            | [NCBI Bookshelf, The Cell: The Plasma Membrane](https://www.ncbi.nlm.nih.gov/books/NBK9928/) distinguishes molecules that diffuse through the lipid bilayer from glucose and other molecules that need transport proteins. | “Lipid path,” “carrier path” and the noncolor blocked marker distinguish the routes; the lesson does not imply that glucose is generally unable to enter cells. |
| Facilitated diffusion can move a substance down its concentration gradient through a specific carrier without direct energy input.          | [OpenStax Biology 2e, 5.2](https://openstax.org/books/biology-2e/pages/5-2-passive-transport) explains carrier/channel specificity and passive movement down a gradient.                                                   | The carrier trial models one glucose-specific passive route. It omits active transport, cotransport, metabolism and membrane voltage.                           |
| Net diffusion decreases as concentrations approach dynamic equilibrium, although molecular motion continues.                                | OpenStax Biology 2e, 5.2 describes dynamic equilibrium and continuing molecular movement.                                                                                                                                  | Integer molecule counts are a visible teaching index, not measured concentration, flux or reaction rate.                                                        |

## Bounded teaching model

Outside and inside counts are integers from 0 through 20. One step moves one
modeled molecule down its concentration gradient when the selected route is
available. Oxygen uses the lipid path. Glucose moves only when its specific
carrier is enabled. Equal counts produce no net transfer. The rule deliberately
omits stochastic collisions, cell volume, membrane area, temperature, osmotic
water movement, competing solutes, saturation kinetics, active transport and
cellular consumption.

Two controlled investigations require a prediction before evidence:

1. Compare oxygen with glucose while holding the starting counts and absent
   carrier fixed. Oxygen changes 12/4 to 11/5; glucose remains 12/4.
2. Compare glucose without and with its carrier while holding molecule,
   starting counts and total count fixed. Only the carrier condition changes.

Web, native and standalone package report correct or incorrect feedback,
changed/held controls, the observed counts and the causal route explanation.
Manual changes clear stale evidence, and reset restores the initial state.

## Source retrieval

The three cited pages were read on 2026-11-04. Exact HTTP 200 snapshots of the
two OpenStax pages are staged with the visual evidence. The NCBI page was read
through the research interface; an automated retrieval returned a CAPTCHA
challenge, so that response was rejected and is not represented as a source
snapshot.

| Snapshot                          |  Bytes | SHA-256                                                            |
| --------------------------------- | -----: | ------------------------------------------------------------------ |
| `openstax-eukaryotic-cells.html`  | 407112 | `706499a351a4f016687bbc4aa4bd7a9a7bff8f44b85ba8fc17445e4b18179ab7` |
| `openstax-passive-transport.html` | 401100 | `629c2f2cb22f8b540b1e0e15cc4240b5a16212d7c0fa286395334df308d3a0c3` |

## Editorial review

Copy now directs a prediction, manipulation, evidence reading, explanation or
necessary boundary. Decorative labels are absent. Labels and feedback provide
noncolor evidence, controls have accessible names, and sources remain in the
accessible footer rather than covering the scene.
