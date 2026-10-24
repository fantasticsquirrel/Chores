import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ExpansionCanvas } from "./ExpansionCanvas";
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: class {
      constructor() {
        throw new Error("No GPU");
      }
    },
  };
});
it("keeps a labeled accessible fallback when GPU creation fails", () => {
  const factory = vi.fn();
  render(
    <ExpansionCanvas
      state={{ value: 1 }}
      buildScene={factory}
      description="A water tank with one outlet"
    />,
  );
  expect(
    screen.getByRole("img", { name: "A water tank with one outlet" }),
  ).toBeTruthy();
  expect(screen.getByText(/Use the controls and results below/)).toBeTruthy();
  expect(factory).not.toHaveBeenCalled();
});
