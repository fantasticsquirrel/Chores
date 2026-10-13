import type { CSSProperties } from "react";
import { birthBandAccent, type BirthBandColors, type BirthYearBucket } from "@family-manager/family-tree-core";

export function birthBandStyle(
  bucket: BirthYearBucket,
  custom: BirthBandColors,
): CSSProperties {
  const accent = birthBandAccent(bucket, custom);
  return {
    "--family-tree-accent-light": accent.light,
    "--family-tree-accent-dark": accent.dark,
  } as CSSProperties;
}
