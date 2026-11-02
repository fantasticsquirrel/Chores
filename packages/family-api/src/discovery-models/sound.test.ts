import { describe, expect, it } from "vitest";
import {
  SOUND_AMPLITUDE_COMPARISON,
  SOUND_DEFAULT_INPUTS,
  SOUND_LENGTH_COMPARISON,
  compareSoundTrials,
  soundActivity,
  soundStateAtPhase,
} from "./sound";

describe("bounded Sound Playground teaching model", () => {
  it("halves the fundamental frequency when only length doubles", () => {
    const [shortString, longString] =
      SOUND_LENGTH_COMPARISON.map(soundActivity);

    expect(longString.fundamentalFrequencyHz).toBeCloseTo(
      shortString.fundamentalFrequencyHz / 2,
    );
    expect(longString.cyclesPerTenMilliseconds).toBeCloseTo(
      shortString.cyclesPerTenMilliseconds / 2,
    );
    expect(compareSoundTrials(shortString.inputs, longString.inputs)).toEqual({
      changed: ["vibrating length"],
      held: ["80 N tension", "3 mm model amplitude", "1 g/m linear density"],
    });
  });

  it("changes displacement and its squared-amplitude index without changing frequency", () => {
    const [small, large] = SOUND_AMPLITUDE_COMPARISON.map(soundActivity);

    expect(large.fundamentalFrequencyHz).toBe(small.fundamentalFrequencyHz);
    expect(large.airWavelengthMeters).toBe(small.airWavelengthMeters);
    expect(large.relativeVibrationIndex).toBe(small.relativeVibrationIndex * 4);
    expect(compareSoundTrials(small.inputs, large.inputs)).toEqual({
      changed: ["model amplitude"],
      held: ["60 cm length", "80 N tension", "1 g/m linear density"],
    });
  });

  it("keeps string wavelength distinct from wavelength in air", () => {
    const result = soundActivity(SOUND_DEFAULT_INPUTS);

    expect(result.stringFundamentalWavelengthMeters).toBe(1.2);
    expect(result.airWavelengthMeters).toBeCloseTo(1.4552, 3);
    expect(result.periodMilliseconds).toBeCloseTo(4.2426, 3);
    expect(result.hasVibration).toBe(true);
  });

  it("keeps natural frequency defined at zero amplitude but reports no vibration", () => {
    const silent = soundActivity({ ...SOUND_DEFAULT_INPUTS, amplitudeMm: 0 });

    expect(silent.fundamentalFrequencyHz).toBeCloseTo(235.702, 3);
    expect(silent.relativeVibrationIndex).toBe(0);
    expect(silent.hasVibration).toBe(false);
  });

  it("bounds non-finite inputs and wraps visual phase without treating it as audio time", () => {
    expect(
      soundActivity({
        lengthCm: Number.NaN,
        tensionN: Infinity,
        amplitudeMm: -2,
      }).inputs,
    ).toEqual({ lengthCm: 60, tensionN: 80, amplitudeMm: 0 });
    expect(
      soundActivity({ lengthCm: 999, tensionN: -10, amplitudeMm: 99 }).inputs,
    ).toEqual({ lengthCm: 120, tensionN: 20, amplitudeMm: 8 });
    expect(soundStateAtPhase(SOUND_DEFAULT_INPUTS, 1.25).visualPhase).toBe(
      0.25,
    );
    expect(soundStateAtPhase(SOUND_DEFAULT_INPUTS, -0.25).visualPhase).toBe(
      0.75,
    );
  });
});
