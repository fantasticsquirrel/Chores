import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { parseRichVector, RichVectorView } from "./vector";
const fixture = () => ({
  viewBox: [0, 0, 100, 100],
  description: "Measured diagram",
  nodes: [
    {
      tag: "defs",
      attrs: {},
      children: [
        {
          tag: "linearGradient",
          attrs: { id: "paint" },
          children: [
            { tag: "stop", attrs: { stopColor: "#ffffff" }, children: [] },
          ],
        },
      ],
    },
    {
      tag: "circle",
      attrs: { cx: 50, cy: 50, r: 30, fill: "url(#paint)" },
      children: [],
    },
  ],
});
describe("bounded rich vectors", () => {
  it("accepts local paint and namespaces DOM IDs", () => {
    const parsed = parseRichVector(fixture());
    expect(parsed).not.toBeNull();
    render(<RichVectorView scene={parsed!} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Measured diagram",
    );
    expect(document.querySelector("linearGradient")?.id).not.toBe("paint");
    cleanup();
  });
  it("rejects executable tags, handlers, styles, external assets and invalid paint refs", () => {
    for (const bad of [
      { tag: "script", attrs: {} },
      { tag: "foreignObject", attrs: {} },
      { tag: "image", attrs: { href: "https://x" } },
      { tag: "circle", attrs: { onload: "x" } },
      { tag: "circle", attrs: { style: "fill:red" } },
      { tag: "circle", attrs: { fill: "url(https://x)" } },
      { tag: "circle", attrs: { fill: "url(#missing)" } },
      { tag: "path", attrs: { d: "M0 0 LInfinity 3" } },
      { tag: "circle", attrs: { r: Infinity } },
    ])
      expect(
        parseRichVector({ ...fixture(), nodes: [{ ...bad, children: [] }] }),
      ).toBeNull();
  });
  it("rejects duplicate IDs, excess nesting and invalid transforms", () => {
    const v = fixture();
    v.nodes.push(v.nodes[0]);
    expect(parseRichVector(v)).toBeNull();
    expect(
      parseRichVector({
        ...fixture(),
        nodes: [
          {
            tag: "g",
            attrs: { transform: "translate(1 2) url(x)" },
            children: [],
          },
        ],
      }),
    ).toBeNull();
  });
});
it("accepts only bounded local drop shadows", () => {
  const shadow = {
    tag: "feDropShadow",
    attrs: {
      dx: 2,
      dy: 3,
      stdDeviation: 2,
      floodColor: "#000000",
      floodOpacity: 0.3,
    },
    children: [],
  };
  const base = {
    ...fixture(),
    nodes: [
      {
        tag: "defs",
        attrs: {},
        children: [
          { tag: "filter", attrs: { id: "shadow" }, children: [shadow] },
        ],
      },
      {
        tag: "circle",
        attrs: { cx: 30, cy: 30, r: 20, filter: "url(#shadow)" },
        children: [],
      },
    ],
  };
  expect(parseRichVector(base)).not.toBeNull();
  shadow.attrs.stdDeviation = 100;
  expect(parseRichVector(base)).toBeNull();
});
