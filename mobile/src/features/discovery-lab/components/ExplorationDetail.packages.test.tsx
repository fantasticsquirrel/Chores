import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react-native";
import type { DiscoveryExploration } from "@family-manager/family-api/models/discovery-lab";
import { ExplorationDetail } from "./ExplorationDetail";

const content = {
  id: "published-wave",
  title: "Wave interference",
  summary: "Compare waves",
  subject: "Physics",
  grade_bands: ["6-8"],
  tags: ["waves"],
  duration_minutes: 10,
  question: "How do waves combine?",
  explanation: "Displacements add at each point.",
  experiments: [],
  misconception: "Interference does not destroy energy.",
  sources: [],
  package: { version: "1.0.0", runtime: "worker-v1", checksum: "a".repeat(64) },
} as DiscoveryExploration;

describe("downloaded Exploration platform support", () => {
  it.each(["worker-v1", "worker-3d-v1", "worker-rich-v1"] as const)(
    "does not present %s as a working native activity",
    (runtime) => {
      const view = render(
        <ExplorationDetail
          detail={{ ...content, package: { ...content.package!, runtime } }}
        />,
      );
      expect(view.getByRole("alert")).toHaveTextContent(
        "This published Exploration runs in the web app. Open Discovery Lab in your browser to use its interactive model.",
      );
      expect(view.queryByText("Reset experiment")).toBeNull();
      expect(view.queryByText("Displacements add at each point.")).toBeNull();
      expect(view.queryByText("Think again")).toBeNull();
    },
  );

  it("keeps the built-in Chance lesson inside its activity instead of repeating registry prose", () => {
    const view = render(
      <ExplorationDetail
        detail={
          {
            ...content,
            id: "chance-carnival",
            title: "Chance Carnival",
            question: "Can fair chances give uneven results?",
            explanation: "Repeated registry explanation.",
            experiments: [
              {
                title: "Repeated experiment",
                instruction: "Repeated instructions.",
                observe: "Repeated observation.",
              },
            ],
            misconception: "Repeated misconception.",
            package: undefined,
          } as DiscoveryExploration
        }
      />,
    );

    expect(
      view.getByText("Can fair chances give uneven results?"),
    ).toBeTruthy();
    expect(view.getByText("1. Compare sample sizes")).toBeTruthy();
    expect(view.queryByText("Repeated registry explanation.")).toBeNull();
    expect(view.queryByText("Repeated experiment")).toBeNull();
    expect(view.queryByText("Repeated misconception.")).toBeNull();
  });

  it("keeps the built-in photosynthesis lesson inside its activity instead of repeating registry prose", () => {
    const view = render(
      <ExplorationDetail
        detail={
          {
            ...content,
            id: "photosynthesis",
            title: "Inside a leaf",
            question: "Can extra light replace water?",
            explanation: "Repeated registry explanation.",
            experiments: [
              {
                title: "Repeated experiment",
                instruction: "Repeated instructions.",
                observe: "Repeated observation.",
              },
            ],
            misconception: "Repeated misconception.",
            package: undefined,
          } as DiscoveryExploration
        }
      />,
    );

    expect(view.getByText("Can extra light replace water?")).toBeTruthy();
    expect(view.getByText("1. Test a missing input")).toBeTruthy();
    expect(view.queryByText("Repeated registry explanation.")).toBeNull();
    expect(view.queryByText("Repeated experiment")).toBeNull();
    expect(view.queryByText("Repeated misconception.")).toBeNull();
  });
});
