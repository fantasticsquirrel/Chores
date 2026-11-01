import { photosynthesisActivity } from "@family-manager/family-api/discovery-models/photosynthesis";
export { traceOrbit } from "@family-manager/family-api/discovery-models/orbit";

export type Point = { x: number; y: number };
export function refract(degrees: number, n1: number, n2: number) {
  const sine = (n1 / n2) * Math.sin((degrees * Math.PI) / 180);
  return {
    tir: sine > 1,
    angle: sine > 1 ? null : (Math.asin(Math.min(1, sine)) * 180) / Math.PI,
  };
}
export function gravityDrop(height: number, g: number) {
  return {
    time: Math.sqrt((2 * height) / g),
    speed: Math.sqrt(2 * height * g),
  };
}
export function illuminatedFraction(angle: number) {
  return (1 - Math.cos((angle * Math.PI) / 180)) / 2;
}
export function photosynthesis(light: number, water: number, carbon: number) {
  const result = photosynthesisActivity({
    light,
    water,
    carbonDioxide: carbon,
  });
  return {
    rate: result.activityIndex,
    limiting: result.limitingResources.join(" and "),
    limitingResources: result.limitingResources,
  };
}
