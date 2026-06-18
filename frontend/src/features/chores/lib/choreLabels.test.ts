import { describe, expect, it } from "vitest";

import type { Child, Chore } from "../../../api";
import {
  buildTimingLabel,
  completionLabel,
  eligibilityLabel,
  scheduleLabel,
} from "./choreLabels";

const children: Child[] = [
  { id: 1, household_id: 1, name: "Ari", active: true },
  { id: 2, household_id: 1, name: "Bea", active: true },
];

function chore(overrides: Partial<Chore> = {}): Chore {
  return {
    id: 10,
    household_id: 1,
    name: "Laundry",
    reward_cents: 0,
    reward_dollars: 0,
    start_date: "2026-06-16",
    expires_at: null,
    timeout_days: null,
    schedule_mode: "NONE",
    schedule_interval: null,
    schedule_unit: null,
    completion_mode: "PER_CHILD",
    assignment_mode: "STATIC",
    archived_at: null,
    is_active: true,
    allowed_child_ids: [],
    rotation_order: [],
    ...overrides,
  };
}

describe("chore label helpers", () => {
  it("formats schedule labels for all schedule modes", () => {
    expect(scheduleLabel(chore({ schedule_mode: "NONE" }))).toBe("On-demand");
    expect(scheduleLabel(chore({ schedule_mode: "ONCE" }))).toBe(
      "Once on 2026-06-16",
    );
    expect(
      scheduleLabel(
        chore({
          schedule_mode: "EVERY",
          schedule_interval: 2,
          schedule_unit: "WEEK",
        }),
      ),
    ).toBe("Every 2 WEEK");
    expect(
      scheduleLabel(
        chore({
          schedule_mode: "AFTER_COMPLETION",
          schedule_interval: 3,
          schedule_unit: "DAY",
        }),
      ),
    ).toBe("3 DAY after completion");
  });

  it("formats completion and static eligibility labels", () => {
    expect(completionLabel("PER_CHILD")).toBe("Per-child completion");
    expect(completionLabel("SHARED")).toBe("Shared completion");
    expect(eligibilityLabel(chore({ allowed_child_ids: [] }), children)).toBe(
      "All children",
    );
    expect(eligibilityLabel(chore({ allowed_child_ids: [2, 99] }), children)).toBe(
      "Bea, #99",
    );
  });

  it("formats rotating eligibility labels in order", () => {
    expect(
      eligibilityLabel(
        chore({ assignment_mode: "ROTATING", rotation_order: [2, 1] }),
        children,
      ),
    ).toBe("Rotation: Bea then Ari");
    expect(
      eligibilityLabel(
        chore({ assignment_mode: "ROTATING", rotation_order: [] }),
        children,
      ),
    ).toBe("Rotation: none set");
  });

  it("formats timing labels", () => {
    expect(buildTimingLabel(chore())).toBe("");
    expect(buildTimingLabel(chore({ expires_at: "2026-06-30" }))).toBe(
      "Ends 2026-06-30",
    );
    expect(buildTimingLabel(chore({ timeout_days: 1 }))).toBe("Window 1 day");
    expect(buildTimingLabel(chore({ timeout_days: 3 }))).toBe("Window 3 days");
    expect(
      buildTimingLabel(chore({ expires_at: "2026-06-30", timeout_days: 3 })),
    ).toBe("Ends 2026-06-30 - Window 3 days");
  });
});
