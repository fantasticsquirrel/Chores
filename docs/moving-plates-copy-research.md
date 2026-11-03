# Moving Plates copy research

Accessed: 2026-11-03

Scope: source the teaching claims for `moving-plates` without turning a bounded comparison into a named-boundary reconstruction, earthquake forecast, or hazard tool. Primary U.S. Geological Survey material is used throughout.

## Claim map

| Teaching claim                                                                                                                                                                             | Source support                                                                        | Where used                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A plate is lithosphere, not crust alone; lithosphere includes crust and rigid uppermost mantle. The asthenosphere beneath it can deform over geologic time.                                | USGS, “Inside the Earth” and “What is a tectonic plate?”                              | Registry explanation, shared model boundary, web/native descriptions, scene layer labels     |
| The mantle/asthenosphere is not a global liquid magma layer. It behaves as solid rock over short times and can flow slowly over geologic times; melt occupies comparatively small regions. | USGS, “Are the tectonic plates floating on magma?”                                    | Registry misconception, shared boundary, scene labels and localized melt geometry            |
| Divergent boundaries create new crust; convergent boundaries consume/recycle oceanic lithosphere; transform motion neither creates nor destroys crust.                                     | USGS, “Understanding plate motions”                                                   | Three shared boundary results, arrows, ridge/new-crust, subducting slab, transform evidence  |
| Individual plates move at different speeds and directions. GPS measures current crustal motion, while magnetic-reversal records support geologic-time average rates.                       | USGS, “How fast do tectonic plates move?”                                             | Rate/time control framing and the warning that a constant selected rate is a teaching input  |
| In a subduction zone one plate descends beneath another. Water transported downward enables localized melting; magma can rise to form a volcanic chain.                                    | USGS, “Introduction to Subduction Zones”; USGS dynamic-planet plate-tectonics summary | Oceanic–continental example, exposed slab cutaway, mantle-wedge melt and volcanic-arc labels |
| A locked plate interface can store deformation and release energy suddenly, but a repeating classroom threshold is not a real recurrence model.                                            | USGS, “Introduction to Subduction Zones”                                              | The separate five-step transform illustration and its explicit timeless/invented limits      |
| A valid earthquake prediction would need time, location and magnitude; USGS cannot predict major earthquakes this way.                                                                     | USGS, “Can you predict earthquakes?”                                                  | Shared model boundary, feedback, registry explanation and misconception                      |

## Numerical and spatial decisions

- The model accepts a **relative** rate of 1–10 cm/yr and an elapsed time of 0–5 million years. Those are bounded teaching inputs, not the motion history of a named pair of plates.
- The conversion is dimensional arithmetic: `1 cm/yr × 1,000,000 yr = 1,000,000 cm = 10 km`. Therefore `relative motion (km) = rate (cm/yr) × time (million yr) × 10`.
- The default comparison holds 4 cm/yr and 2.0 million years fixed, so both examples calculate 80 km. Only the boundary example changes.
- Scene morphology maps across the complete 0–500 km input range, but scene widths, vertical exaggeration, trench depth, mountain relief and slab angle remain schematic and have no geographic scale.
- “Together” is specifically an oceanic–continental subduction example. It does not stand for continent–continent collision or every convergent margin.
- The front cutaway distinguishes oceanic crust from the larger oceanic lithosphere slab. Melt is drawn in the mantle wedge above the slab; the scene does not claim that the entire slab or mantle is molten.

## Locked-fault boundary

The transform investigation is qualitative. Its loading index advances through 0%, 20%, 40%, 60% and 80%; the next learner action illustrates a sudden slip, returns the index to 0% and adds one visible marker offset/tally. The five-step threshold, equal steps, recurrence, offset size and 20-slip display limit are invented. Steps have no duration, slips have no magnitude, and the model produces no date, location, probability, shaking level or hazard estimate. At the display limit, loading is disabled rather than silently recording an unrepresented slip.

## Editorial decisions

- Use “lithosphere,” “crust” and “asthenosphere” for different materials; do not use them as synonyms.
- Say “localized melt” rather than painting the mantle as liquid. At subduction, identify the melt region as the mantle wedge above the slab.
- Say “calculated relative motion,” not distance traveled by either individual plate.
- Keep earthquakes possible at all boundary types and within plates; the transform control is only the model’s chosen locked-fault investigation.
- Omit precise hazard language, real-location forecasts and deterministic earthquake timing.
- Keep all essential instruction, evidence, units and limitations in text. Color is supplemental.

## Primary sources

1. [USGS — Understanding plate motions](https://pubs.usgs.gov/gip/dynamic/understanding.html)
2. [USGS — Inside the Earth](https://pubs.usgs.gov/gip/dynamic/inside.html)
3. [USGS — What is a tectonic plate?](https://pubs.usgs.gov/gip/dynamic/tectonic.html)
4. [USGS — How fast do tectonic plates move?](https://www.usgs.gov/faqs/how-fast-do-tectonic-plates-move)
5. [USGS — Are the tectonic plates floating on magma?](https://www.usgs.gov/faqs/are-tectonic-plates-floating-magma)
6. [USGS — Introduction to Subduction Zones](https://www.usgs.gov/special-topics/subduction-zone-science/science/introduction-subduction-zones-amazing-events)
7. [USGS — Can you predict earthquakes?](https://www.usgs.gov/faqs/can-you-predict-earthquakes)
8. [USGS Volcano Hazards Program — Plate tectonics in a nutshell](https://volcanoes.usgs.gov/about/edu/dynamicplanet/nutshell.php)

## Retrieval record

Three legacy USGS pages were retrieved as raw HTTP 200 snapshots:

- `understanding-plate-motions.html` — SHA-256 `0755dd94cdafbbfb3389b04c7522ab1b3c4bdb9e549f1285460e33e883caf6f4`;
- `inside-earth.html` — SHA-256 `81f2bc6c1cd65812cd2c0e685b34cceb78613ae2a251402a171b4bd860c5fe54`;
- `tectonic-plate.html` — SHA-256 `66aaa0b2db53ccb8d5fe7d799d1dfee6d690b96882c7ae679ab0be9fe3dd7b8f`.

They are stored under `/tmp/moving-plates-artifacts/sources/`. Modern `usgs.gov`
routes returned HTTP 504 to direct `curl` from the execution network, so their
same-day search-index records were preserved as a paraphrased retrieval snapshot
at `usgs-web-retrieval-snapshot.md` (SHA-256
`e74d4c51b25d4f1e95c4ae7f34c7bacf666dafae01e4b639cdab7a2628a7b23a`); no
missing page was represented as a successful raw download.
