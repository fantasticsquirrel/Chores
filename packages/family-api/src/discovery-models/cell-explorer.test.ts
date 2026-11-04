import { describe, expect, it } from "vitest";
import {
  cellExplorerBoundary,
  cellExplorerTrials,
  defaultCellExplorerState,
  normalizeCellExplorerState,
  stepCellTransport,
} from "./cell-explorer";

describe("bounded Cell Explorer teaching model", () => {
  it("conserves the two-compartment total and moves oxygen down the gradient", () => {
    const next = stepCellTransport(defaultCellExplorerState);
    expect(next).toMatchObject({ outside: 11, inside: 5 });
    expect(next.outside + next.inside).toBe(16);
  });

  it("requires the modeled glucose carrier and never overshoots equality", () => {
    const glucose = {
      ...defaultCellExplorerState,
      molecule: "glucose" as const,
    };
    expect(stepCellTransport(glucose)).toEqual(glucose);
    expect(stepCellTransport({ ...glucose, carrier: true })).toMatchObject({
      outside: 11,
      inside: 5,
    });
    expect(
      stepCellTransport({
        ...defaultCellExplorerState,
        outside: 5,
        inside: 4,
      }),
    ).toMatchObject({ outside: 4.5, inside: 4.5 });
  });

  it("bounds invalid concentrations and excludes plant-only parts from animal state", () => {
    expect(
      normalizeCellExplorerState({
        ...defaultCellExplorerState,
        cellType: "animal",
        selected: "chloroplast",
        outside: Number.NaN,
        inside: 99,
      }),
    ).toEqual({
      ...defaultCellExplorerState,
      cellType: "animal",
      selected: "membrane",
      inside: 20,
    });
  });

  it("defines two prediction-first one-change trials with explicit evidence", () => {
    expect(cellExplorerTrials).toHaveLength(2);
    expect(cellExplorerTrials.map((trial) => trial.correctChoice)).toEqual([
      "Different transfer",
      "Transfer changes",
    ]);
    expect(cellExplorerTrials[0].changed).toBe(
      "molecule, from oxygen to glucose",
    );
    expect(cellExplorerTrials[1].held).toContain("glucose");
    expect(cellExplorerTrials[1].evidence).toMatch(/total stayed 16\.0/);
    expect(cellExplorerBoundary).toMatch(/facilitated diffusion/);
  });
});
