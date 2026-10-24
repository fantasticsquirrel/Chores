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
  it("does not present a missing native model as a working activity", () => {
    const view = render(<ExplorationDetail detail={content} />);
    expect(view.getByRole("alert")).toHaveTextContent(
      "This published Exploration runs in the web app. Open Discovery Lab in your browser to use its interactive model.",
    );
    expect(view.queryByText("Reset experiment")).toBeNull();
    expect(view.queryByText("Displacements add at each point.")).toBeNull();
    expect(view.queryByText("Think again")).toBeNull();
  });
});
