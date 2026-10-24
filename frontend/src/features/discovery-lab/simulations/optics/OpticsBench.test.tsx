import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { OpticsSimulation } from "../OpticsSimulation";
it("shows no reflected branch at an equal-index boundary", () => {
  render(<OpticsSimulation />);
  expect(screen.getByTestId("reflected-ray")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Bottom refractive index"), {
    target: { value: 1 },
  });
  expect(screen.queryByTestId("reflected-ray")).toBeNull();
  expect(
    screen.getByText("No reflection: equal refractive indices"),
  ).toBeTruthy();
  expect(screen.getByText("40.0°")).toBeTruthy();
});
