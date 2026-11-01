import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LeafCanvas } from "./LeafCanvas";

afterEach(cleanup);

describe("Leaf Energy process diagram", () => {
  it("separates light energy from matter flows and derives the visual state from inputs", () => {
    const { rerender } = render(
      <LeafCanvas
        light={70}
        water={60}
        carbon={80}
        rate={87}
        limitingLabel="water"
      />,
    );

    expect(screen.getByRole("img")).toHaveAccessibleName(
      expect.stringContaining("Light energy 70 percent"),
    );
    expect(screen.getByTestId("leaf-light-flow")).toHaveAttribute(
      "data-flow-kind",
      "energy",
    );
    expect(screen.getByTestId("leaf-water-flow")).toHaveAttribute(
      "data-flow-kind",
      "matter",
    );
    expect(screen.getByTestId("leaf-carbon-flow")).toHaveAttribute(
      "data-level",
      "80",
    );
    expect(screen.getByTestId("leaf-chloroplast")).toHaveAttribute(
      "data-activity",
      "87",
    );

    rerender(
      <LeafCanvas
        light={100}
        water={0}
        carbon={80}
        rate={0}
        limitingLabel="water"
      />,
    );
    expect(screen.getByTestId("leaf-water-flow")).toHaveAttribute(
      "data-level",
      "0",
    );
    expect(screen.getByTestId("leaf-sugar-output")).toHaveAttribute(
      "data-level",
      "0",
    );
    expect(screen.getByTestId("leaf-chloroplast")).toHaveAttribute(
      "data-activity",
      "0",
    );
  });
});
