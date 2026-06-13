import { formatQuantity } from "./scaling";

describe("recipe scaling formatter", () => {
  it.each([
    [0.125, "1/8"],
    [0.25, "1/4"],
    [0.333333, "1/3"],
    [0.5, "1/2"],
    [0.666667, "2/3"],
    [0.75, "3/4"],
    [2, "2"],
    [1.2, "1.2"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatQuantity(value)).toBe(expected);
  });

  it("renders null quantities as an empty string", () => {
    expect(formatQuantity(null)).toBe("");
  });
});
