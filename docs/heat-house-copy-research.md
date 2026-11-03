# Heat House copy research

Reviewed and opened 2026-11-03 for the Heat House redesign. The sources below
support the physical relationships and unit language. The exact wall layers,
areas, temperatures, elapsed times and U-factors in the lesson are disclosed
teaching inputs; they are not measurements or product specifications taken from
the sources.

## Claim map

| Learner-facing claim                                                                                                                                                                                                                   | Authoritative support                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Implemented in                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| For a uniform layer in steady conduction, heat-transfer power increases with area and temperature difference and decreases with thickness. Multiplying constant power by elapsed time gives transferred energy.                        | [OpenStax College Physics 14.5: Conduction](https://openstax.org/books/college-physics/pages/14-5-conduction) gives the conduction-rate relationship, identifies the rate in watts, and works elapsed energy from rate × time.                                                                                                                                                                                                                                                                                             | Shared `heat-house.ts` model; wall resistance calculation; W, J, MJ and kWh readouts; elapsed-time replay.                                                        |
| Thermal energy moves from warmer regions toward cooler regions. Conduction is transfer through contact/material, convection transports energy with moving air or other fluid, and radiation transfers energy by electromagnetic waves. | [US Department of Energy Building Science Education: Heat Flow](https://bsesc.energy.gov/energy-basics/heat-flow) defines the three heat-transfer mechanisms and the warm-to-cool direction.                                                                                                                                                                                                                                                                                                                               | Web/native/package explanation and signed outward/inward direction; model-boundary copy says the simplified U-factors do not calculate the mechanisms separately. |
| A window U-factor describes heat-flow rate through the glazing assembly; lower U means lower heat flow for the same area and temperature difference.                                                                                   | [US Department of Energy FEMP: Residential Windows, Doors, and Skylights](https://www.energy.gov/cmei/femp/purchasing-energy-efficient-residential-windows-doors-and-skylights) identifies U-factor as a heat-flow-rate measure and explains that lower U reduces heat flow. [DOE measure guide for replacing windows](https://www1.eere.energy.gov/buildings/publications/pdfs/building_america/measure_guide_windows.pdf) additionally describes whole-window transfer as combined conduction, convection and radiation. | Separate opaque-wall and whole-window paths; fixed teaching window U-factor; window-area comparison; whole-assembly caveat.                                       |
| The watt is the SI derived unit J/s; joules measure energy. Thermal conductivity uses W/(m·K).                                                                                                                                         | [NIST SP 811, chapter 4](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-4-two-classes-si-units-and-si-prefixes) lists joule, watt = J/s and thermal-conductivity units.                                                                                                                                                                                                                                                                                                                            | Exact unit labels, `1 W = 1 J/s`, `1 kWh = 3.6 MJ`, and U-factor units W/(m²·K).                                                                                  |

## Editorial and model boundaries

- The model uses signed outward power. A negative result means the fixed outdoor
  temperature is warmer and transfer is inward; equal temperatures produce zero
  net modeled transfer.
- A Celsius temperature difference has the same numerical size in kelvins. The
  equation therefore displays temperature difference in K while the controls
  remain familiar °C temperatures.
- Power is a rate in W, not a temperature or an accumulated amount of energy.
  Energy is power × time and is displayed in kWh and MJ. The package and all
  platform lessons use the same conversion, 1 kWh = 3.6 MJ.
- Added insulation raises resistance only on the opaque-wall path. It does not
  generate thermal energy, and it does not change the fixed window path in the
  controlled insulation comparison.
- Windows replace opaque wall inside a fixed 60 m² wall-and-window envelope.
  The window-area result depends on the explicitly stated teaching U-factors; it
  is not a universal ranking of all real walls and windows.
- The steady-temperature model omits roof and floor transfer, air leakage,
  sunlight, moisture, thermal bridges, stored heat and heating/cooling equipment.
  It is not a measurement, product rating, weather forecast, load calculation or
  energy-bill estimate.
