export type PhotosynthesisInputs = {
  light: number;
  water: number;
  carbonDioxide: number;
};

export type PhotosynthesisResource = "light" | "water" | "carbon dioxide";

const RESOURCE_KEYS = ["light", "water", "carbonDioxide"] as const;
const RESOURCE_NAMES: Record<
  (typeof RESOURCE_KEYS)[number],
  PhotosynthesisResource
> = {
  light: "light",
  water: "water",
  carbonDioxide: "carbon dioxide",
};
const SATURATION_SETTING = 35;
const MAX_RESPONSE = 1 - Math.exp(-100 / SATURATION_SETTING);

function normalizeSetting(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Invented response used only by the teaching activity. It is normalized so a
 * setting of 100 maps to an index contribution of 100; it is not an empirical
 * photosynthesis equation or a physical unit conversion.
 */
function responseIndex(setting: number) {
  const bounded = normalizeSetting(setting);
  return ((1 - Math.exp(-bounded / SATURATION_SETTING)) / MAX_RESPONSE) * 100;
}

export function photosynthesisActivity(raw: PhotosynthesisInputs) {
  const inputs: PhotosynthesisInputs = {
    light: normalizeSetting(raw.light),
    water: normalizeSetting(raw.water),
    carbonDioxide: normalizeSetting(raw.carbonDioxide),
  };
  const responses = {
    light: responseIndex(inputs.light),
    water: responseIndex(inputs.water),
    carbonDioxide: responseIndex(inputs.carbonDioxide),
  };
  const activityIndex = Math.min(...RESOURCE_KEYS.map((key) => responses[key]));
  const limitingResources = RESOURCE_KEYS.filter(
    (key) => Math.abs(responses[key] - activityIndex) < 1e-9,
  ).map((key) => RESOURCE_NAMES[key]);

  return { inputs, responses, activityIndex, limitingResources };
}

export function comparePhotosynthesisInputs(
  first: PhotosynthesisInputs,
  second: PhotosynthesisInputs,
) {
  const a = photosynthesisActivity(first).inputs;
  const b = photosynthesisActivity(second).inputs;
  const changed = RESOURCE_KEYS.filter((key) => a[key] !== b[key]).map(
    (key) => RESOURCE_NAMES[key],
  );
  const held = RESOURCE_KEYS.filter((key) => a[key] === b[key]).map(
    (key) => RESOURCE_NAMES[key],
  );
  return { changed, held, controlled: changed.length === 1 };
}

export const PHOTOSYNTHESIS_DEFAULT_INPUTS: PhotosynthesisInputs = {
  light: 70,
  water: 60,
  carbonDioxide: 80,
};

export const PHOTOSYNTHESIS_ZERO_WATER = {
  low: { light: 30, water: 0, carbonDioxide: 80 },
  high: { light: 100, water: 0, carbonDioxide: 80 },
} as const satisfies Record<string, PhotosynthesisInputs>;

export const PHOTOSYNTHESIS_LIGHT_STEPS = [
  { light: 15, water: 35, carbonDioxide: 80 },
  { light: 35, water: 35, carbonDioxide: 80 },
  { light: 100, water: 35, carbonDioxide: 80 },
] as const satisfies readonly PhotosynthesisInputs[];
