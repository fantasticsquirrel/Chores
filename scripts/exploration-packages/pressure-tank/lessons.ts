import type { Trial } from "../physical-lesson";
import { pressureTankTrials, type PressureState } from "./model";

export const experiments =
  pressureTankTrials as unknown as Trial<PressureState>[];
