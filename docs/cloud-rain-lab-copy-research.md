# Cloud and Rain Lab copy and model research

Reviewed 2026-11-03 for Exploration #22. This document maps learner-facing
claims to authoritative sources and separates sourced atmospheric relationships
from the lesson's explicit teaching assumptions. It is not a weather forecast.

## Claim map

| Shipped claim                                                                                                                                                                                    | Evidence reviewed                                                                                                                                                                                                                                                                                                                                                                                | Editorial decision                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Water vapor is an invisible gas; visible clouds contain liquid droplets, ice crystals or both.                                                                                                   | [Met Office: Clouds](https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/clouds) identifies vapor as invisible, visible clouds as tiny liquid droplets and cold high clouds as ice crystals. [Met Office: Water cycle](https://weather.metoffice.gov.uk/learn-about/weather/how-weather-works/water-cycle) likewise distinguishes atmospheric vapor, visible droplets and ice. | The scene's gold points are explicitly diagram markers, not visible vapor. Copy never presents a cloud as vapor made visible.                                               |
| Evaporation changes liquid water to gas; condensation changes vapor to liquid.                                                                                                                   | [NOAA NESDIS: What Is Humidity?](https://www.nesdis.noaa.gov/about/k-12-education/atmosphere/what-humidity) describes evaporation from surface water and condensation into droplets.                                                                                                                                                                                                             | The lake, upward arrows and process text identify both phase changes.                                                                                                       |
| Rising parcels expand at lower pressure and cool; an unsaturated parcel cools at about 9.8 °C/km until saturation.                                                                               | [NOAA: How Clouds Form](https://www.noaa.gov/jetstream/clouds/how-clouds-form) describes expansion, adiabatic cooling and the 9.8 °C/km dry lapse rate. [NOAA: Parcel Theory](https://www.noaa.gov/jetstream/upperair/parcel-theory) states the same fixed unsaturated rate and explicitly describes parcel theory as an oversimplification.                                                     | The model uses 9.8 °C/km below its estimated cloud base and labels the parcel as a teaching marker, not a contained balloon. It does not claim that warm air rises unaided. |
| At saturation, relative humidity is 100%; some vapor condenses on cloud-condensation nuclei into droplets, while evaporation and condensation can continue.                                      | [NOAA: How Clouds Form](https://www.noaa.gov/jetstream/clouds/how-clouds-form) describes saturation, nuclei, cloud-droplet formation and concurrent condensation/evaporation in changing clouds.                                                                                                                                                                                                 | The lesson reports 100% RH in the saturated parcel and estimated condensate; it does not imply that every vapor molecule condenses.                                         |
| Relative humidity depends on both vapor and temperature.                                                                                                                                         | [NOAA NESDIS: What Is Humidity?](https://www.nesdis.noaa.gov/about/k-12-education/atmosphere/what-humidity) distinguishes water-vapor amount, relative humidity and dew point.                                                                                                                                                                                                                   | For precision and to avoid the container metaphor, shipped copy defines RH as actual vapor pressure divided by saturation vapor pressure at the same temperature.           |
| Small cloud droplets or ice crystals are not automatically precipitation at the ground. Warm-cloud droplets can grow by collision and coalescence; cold-cloud ice growth is a different process. | [NOAA: Precipitation](https://www.noaa.gov/jetstream/atmosphere/precipitation) distinguishes cloud particles from precipitation and describes warm-rain collision/coalescence and a separate ice-crystal process. [NOAA NESDIS: What Is Humidity?](https://www.nesdis.noaa.gov/about/k-12-education/atmosphere/what-humidity) also describes collision/coalescence.                              | The second investigation changes only representative liquid-particle diameter. The boundary states that the model is warm-cloud-only and omits ice growth.                  |
| Virga is precipitation that falls from cloud but evaporates before reaching the ground.                                                                                                          | [National Weather Service glossary: Virga](https://forecast.weather.gov/glossary.php?word=VIRGA) gives this definition.                                                                                                                                                                                                                                                                          | The dry-layer counterexample has a distinct named scene group, outcome and noncolor text explanation.                                                                       |

The sources sometimes use the familiar “air holds water” metaphor. The shipped
lesson does not use that as a physical mechanism: RH is a vapor-pressure ratio,
and cooling changes saturation vapor pressure rather than turning air into a
literal container.

## Model equations and units

The pure model accepts only these bounded learner inputs:

- starting parcel temperature: 22–32 °C;
- starting relative humidity: 30–95%;
- parcel lift: 0–2,000 m;
- representative liquid-particle diameter: 10–2,000 µm;
- below-cloud relative humidity: 20–100%.

The model fixes starting pressure at 1,000 hPa and uses a Magnus approximation
for saturation vapor pressure and displayed dew point. Pressure decreases as
`1000 × exp(−z / 8434)` hPa. Below saturation, parcel temperature decreases at
9.8 °C/km while starting vapor mixing ratio remains fixed. At each height it
computes vapor pressure from that mixing ratio and pressure, then computes RH
from vapor pressure divided by Magnus saturation vapor pressure. A bounded
bisection finds the first height where this same calculation reaches 100% RH.
That single numerical crossing defines saturation, cloud depth and the start of
condensate; it replaces the former independent 125 m-per-degree cloud-base
estimate that could disagree with the displayed RH.

Above the crossing, temperature decreases at a fixed 6 °C/km. That rate is a
teaching approximation: a real saturated lapse rate varies with temperature,
pressure and moisture. Exactly at the crossing the model is saturated but has
zero cloud depth and zero condensate, so it does not draw a cloud. Any positive
rise above the crossing within the bounds must yield positive modeled
condensate before the cloud or precipitation can be drawn.

Before saturation, the starting vapor mixing ratio is conserved in the parcel.
At and above the estimated cloud base, the model reports the excess above the
local saturation mixing ratio as condensed liquid water in g/kg of dry air.
This is a parcel comparison, not a cloud-water observation.

The representative particle is a chosen input, not a growth-time prediction or
a real size distribution. At 200 µm or larger it receives a visible
precipitation path so learners can compare growth; this is not a universal
threshold at which particles begin to fall, because cloud droplets also fall
relative to air and vertical air motion matters. A surviving ground-level
particle at least 500 µm receives the lesson's `rain-sized` name. A smaller
positive survivor is still ground-reaching liquid precipitation. These naming
and drawing thresholds are explicit teaching choices. Particle-volume
comparison uses the sphere ratio `(d / 20 µm)^3`, so the 1,000 µm comparison
particle has 125,000 times the volume of a 20 µm representative cloud droplet.

Below-cloud evaporation uses an invented squared-diameter path:

`d_ground² = max(0, d_cloud² − 1400 × (1 − RH_below/100) × cloud_base_m)`.

The coefficient is 1,400 µm² per metre at 0% RH. It exists only to make the
controlled wet/dry comparison deterministic. It is not a measured universal
constant, rainfall rate, fall-time calculation or forecast parameter.
`Virga` is assigned only when this equation reaches exactly zero before ground;
the former nonzero 200 µm ground cutoff is not used. Modeled condensate is an
equilibrium parcel difference, not observed cloud liquid-water content or a
supply calculation for an arbitrary representative particle.

## Preserved source provenance

The host independently fetched these raw authoritative pages with HTTP 200 on
2026-11-03 and preserved the successful responses under
`/tmp/exploration-series-cloud-rain-lab/sources`:

- `noaa-humidity.html` —
  `https://www.nesdis.noaa.gov/about/k-12-education/atmosphere/what-humidity`,
  SHA-256 `752c03dfd545bd8308bfeffec7b1a12187257aefd21a94d634e6c98472222b60`;
- `metoffice-water-cycle.html` —
  `https://weather.metoffice.gov.uk/learn-about/weather/how-weather-works/water-cycle`,
  SHA-256 `fa942043e676b1c88b4278dbac38c8ba1f9dc65a12c0ea211b91e458ac3cfdc0`;
- `nws-virga.html` —
  `https://forecast.weather.gov/glossary.php?word=VIRGA`, SHA-256
  `362e17500741c75368f11ec365307045584dbdd2325c618e8ef7fe0f2fc0dfef`.

The NOAA JetStream cloud pages remain linked as reviewed references; a direct
host snapshot request was denied with HTTP 403, so no raw NOAA-cloud snapshot
is represented as a successful fetch.

## Controlled investigations

### 1. Lift to saturation

Prediction choices: `Cloud at both heights` or `Cloud only after more lift`.
The baseline has 400 m lift; the comparison has 1,600 m. Starting temperature
24 °C, starting RH 60%, particle diameter 20 µm and below-cloud RH 80% remain
fixed. Evidence reports parcel temperature, parcel RH, estimated cloud base and
modeled condensate in physical units. The comparison distinguishes invisible
vapor from visible liquid droplets and does not imply rain.

### 2. Grow precipitation

Prediction choices: `Both reach the ground` or `Only the larger drop reaches`.
The baseline uses a 20 µm representative droplet; the comparison changes only
that diameter to 1,000 µm. Lift 1,600 m, starting temperature 24 °C, starting RH
60% and below-cloud RH 80% stay fixed. Evidence reports the unchanged saturated
cloud, unchanged modeled condensate, 50-fold diameter change, 125,000-fold
volume change and estimated ground diameter after partial evaporation.

Both investigations require a prediction before baseline, then one change,
numerical and visual evidence, correct/incorrect feedback, causal explanation
and reset on web, native and the standalone package.

## Boundaries retained in the learner view

This is a bounded, above-freezing warm-cloud parcel model. It omits ice growth,
entrainment and mixing, detailed pressure-dependent microphysics, vertical
wind, fall speed, collision efficiency, drop breakup, changing weather and a
particle-size distribution. Real clouds may contain droplets, ice crystals or
both. Falling precipitation can evaporate before reaching the ground, and not
every cloud rains. The model cannot predict cloud base, precipitation amount,
timing or occurrence for any place.

## Editorial review

- Every heading, label and paragraph either directs a test, reports evidence,
  explains the causal relationship, corrects a misconception or states a
  necessary boundary.
- Decorative observatory/bench labels and asset credits are absent from the
  teaching scene. Sources remain in the accessible exploration footer.
- Visible and accessible results use °C, %, m, µm, hPa and g/kg consistently.
- Essential evidence is repeated in text and does not depend on color, orbit or
  motion. Vapor markers are identified as symbolic.
- The default cloud-without-rain state, no-cloud state, rain-at-ground state and
  virga counterexample are all test-covered.
- The rendered desktop/mobile editorial review remains a release gate and must
  be accepted before #22 is marked complete.
