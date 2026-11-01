import type {
  PhotosynthesisInputs,
  PhotosynthesisResource,
} from "@family-manager/family-api/discovery-models/photosynthesis";

const RESOURCE_FIELDS: Record<
  PhotosynthesisResource,
  keyof PhotosynthesisInputs
> = {
  light: "light",
  water: "water",
  "carbon dioxide": "carbonDioxide",
};

export function roundIndex(value: number) {
  return Math.round(value);
}

export function resourceList(resources: PhotosynthesisResource[]) {
  return resources.join(" and ");
}

export function settingList(
  resources: PhotosynthesisResource[],
  inputs: PhotosynthesisInputs,
) {
  return resources
    .map((resource) => `${resource} ${inputs[RESOURCE_FIELDS[resource]]}%`)
    .join(" · ");
}

export function changedList(
  resources: PhotosynthesisResource[],
  first: PhotosynthesisInputs,
  second: PhotosynthesisInputs,
) {
  return resources
    .map((resource) => {
      const field = RESOURCE_FIELDS[resource];
      return `${resource} ${first[field]}% → ${second[field]}%`;
    })
    .join(" · ");
}
