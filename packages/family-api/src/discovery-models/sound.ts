export type SoundInputs = {
  lengthCm: number;
  tensionN: number;
  amplitudeMm: number;
};

export const SOUND_LINEAR_DENSITY_KG_PER_METER = 0.001;
export const SOUND_AIR_SPEED_METERS_PER_SECOND = 343;

export const SOUND_DEFAULT_INPUTS: SoundInputs = {
  lengthCm: 60,
  tensionN: 80,
  amplitudeMm: 3,
};

export const SOUND_LENGTH_COMPARISON = [
  SOUND_DEFAULT_INPUTS,
  { ...SOUND_DEFAULT_INPUTS, lengthCm: 120 },
] as const satisfies readonly SoundInputs[];

export const SOUND_AMPLITUDE_COMPARISON = [
  SOUND_DEFAULT_INPUTS,
  { ...SOUND_DEFAULT_INPUTS, amplitudeMm: 6 },
] as const satisfies readonly SoundInputs[];

function bounded(
  value: number,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;
}

export function normalizeSoundInputs(inputs: SoundInputs): SoundInputs {
  return {
    lengthCm: bounded(inputs.lengthCm, 20, 120, 60),
    tensionN: bounded(inputs.tensionN, 20, 200, 80),
    amplitudeMm: bounded(inputs.amplitudeMm, 0, 8, 3),
  };
}

/**
 * Uniform ideal string in its fundamental fixed-end mode. The amplitude value
 * is a teaching displacement, not sound pressure or a loudness measurement.
 */
export function soundActivity(raw: SoundInputs) {
  const inputs = normalizeSoundInputs(raw);
  const lengthMeters = inputs.lengthCm / 100;
  const stringWaveSpeedMetersPerSecond = Math.sqrt(
    inputs.tensionN / SOUND_LINEAR_DENSITY_KG_PER_METER,
  );
  const fundamentalFrequencyHz =
    stringWaveSpeedMetersPerSecond / (2 * lengthMeters);
  return {
    inputs,
    fundamentalFrequencyHz,
    periodMilliseconds: 1000 / fundamentalFrequencyHz,
    cyclesPerTenMilliseconds: fundamentalFrequencyHz * 0.01,
    stringWaveSpeedMetersPerSecond,
    stringFundamentalWavelengthMeters: 2 * lengthMeters,
    airWavelengthMeters:
      SOUND_AIR_SPEED_METERS_PER_SECOND / fundamentalFrequencyHz,
    // A² is a relative comparison only when length, tension and density stay fixed.
    relativeVibrationIndex: inputs.amplitudeMm ** 2,
    hasVibration: inputs.amplitudeMm > 0,
  };
}

export function soundStateAtPhase(raw: SoundInputs, rawPhase: number) {
  const activity = soundActivity(raw);
  const finitePhase = Number.isFinite(rawPhase) ? rawPhase : 0;
  return {
    ...activity,
    // Visible motion is deliberately slowed and is not an audio-time clock.
    visualPhase: ((finitePhase % 1) + 1) % 1,
  };
}

export function compareSoundTrials(first: SoundInputs, second: SoundInputs) {
  const a = normalizeSoundInputs(first);
  const b = normalizeSoundInputs(second);
  const changed: string[] = [];
  if (a.lengthCm !== b.lengthCm) changed.push("vibrating length");
  if (a.tensionN !== b.tensionN) changed.push("tension");
  if (a.amplitudeMm !== b.amplitudeMm) changed.push("model amplitude");

  const held: string[] = [];
  if (a.lengthCm === b.lengthCm) held.push(`${a.lengthCm} cm length`);
  if (a.tensionN === b.tensionN) held.push(`${a.tensionN} N tension`);
  if (a.amplitudeMm === b.amplitudeMm)
    held.push(`${a.amplitudeMm} mm model amplitude`);
  held.push("1 g/m linear density");
  return { changed, held };
}
