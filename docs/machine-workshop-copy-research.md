# Machine Workshop copy research

Reviewed 2026-11-03 for the Machine Workshop redesign. These sources support
the physical relationships; the exact 40 kg, 0.5 m and ratio settings are
transparent teaching inputs, not measurements from the sources.

## Claim map

| Learner-facing claim                                                                                                                                                                                   | Authoritative support                                                                                                                                                                    | Implemented in                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Work for a constant force parallel to motion is force × distance; one joule is one newton-metre. No displacement means no mechanical work.                                                             | [NASA Glenn: Work](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/work/) defines work from force and aligned displacement and gives J = N·m.                                   | `expansion-mechanics.ts`; web, native and package energy readouts and zero-lift copy. |
| An ideal simple machine trades input force for input distance while input and output work remain equal. Mechanical advantage can be written as load force/input force or input distance/load distance. | [OpenStax Physics 9.3: Simple Machines](https://openstax.org/books/physics/pages/9-3-simple-machines) derives the ideal work and mechanical-advantage relationships.                     | `machine-workshop.ts`; both guided trials; web/native/package explanations.           |
| For an ideal pulley, mechanical advantage is the number of rope sections supporting the moving load; lifting by one unit requires pulling that many units of rope.                                     | OpenStax Physics 9.3 identifies pulley ideal mechanical advantage with the supporting rope sections and explains the matching input-distance trade-off.                                  | Pulley model, reeved scene and “Pulley sections” investigation.                       |
| With meshed gears, tooth ratio fixes the inverse turns ratio and the ideal torque ratio. The ideal relation assumes slow, frictionless operation.                                                      | [UC San Diego MAE: Gear Ratios](https://mae3.eng.ucsd.edu/machine-design/gear-ratios) derives speed/turn and torque ratios from gear teeth under quasi-static, frictionless assumptions. | Equal-radius crank/drum gear model and “Gear ratio” investigation.                    |
| Real machines have efficiency below 100% because some input energy is dissipated; an ideal model cannot supply a real machine's actual force or efficiency.                                            | OpenStax Physics 9.3 defines efficiency as useful output work divided by input work and distinguishes real machines from the ideal case.                                                 | `machineWorkshopBoundary` and the downloadable worker footnote.                       |

## Editorial and model boundaries

- Mass is reported in kg and weight in N. The model visibly states its fixed
  local gravitational field strength, 9.81 N/kg (equivalently 9.81 m/s²).
- Every work and energy result is in J. Torque is separately labeled in N·m as
  a turning effect so the shared dimensional unit does not imply it is energy.
- The pulley comparison changes only supporting sections, 1 to 2. The gear
  comparison changes only driven teeth, 12 to 48; the 12-tooth driver, load,
  lift, gravity and equal 0.20 m crank/drum radii stay fixed.
- “100% efficiency” is the ideal-model assumption. It is not presented as a
  measured ratio when lift and work are zero.
- The model leaves out friction, stretching or bending parts, acceleration and
  machine weight. It is explicitly not lifting-equipment or safety guidance.
