import { describe, expect, it } from "vitest";

import type { Child, Chore } from "../../../api/models";
import {
  buildDefaultChoreForm,
  eligibilityLabel,
  parseOptionalPositiveInteger,
  scheduleLabel,
  timingLabel,
} from "./chorePresentation";

const children: Child[] = [
  { id: 1, household_id: 1, name: "Ava", active: true },
  { id: 2, household_id: 1, name: "Ben", active: true },
];

function chore(patch: Partial<Chore>): Chore {
  return {
    id: 1,
    household_id: 1,
    name: "Laundry",
    reward_cents: 0,
    reward_dollars: 0,
    archived_at: null,
    is_active: true,
    start_date: "2026-01-01",
    expires_at: null,
    timeout_days: null,
    schedule_mode: "NONE",
    schedule_interval: null,
    schedule_unit: null,
    completion_mode: "PER_CHILD",
    assignment_mode: "STATIC",
    allowed_child_ids: [],
    rotation_order: [],
    ...patch,
  };
}

describe("mobile chore presentation helpers", () => {
  it("builds the default form from the supplied date", () => {
    expect(buildDefaultChoreForm("2026-06-16")).toMatchObject({
      name: "",
      start_date: "2026-06-16",
      schedule_mode: "NONE",
    });
  });

  it("formats schedule, assignment, and timing labels", () => {
    expect(scheduleLabel(chore({ schedule_mode: "EVERY", schedule_interval: 2, schedule_unit: "WEEK" }))).toBe("Every 2 WEEK");
    expect(eligibilityLabel(chore({ allowed_child_ids: [1, 2] }), children)).toBe("Ava, Ben");
    expect(timingLabel(chore({ expires_at: "2026-02-01", timeout_days: 3 }))).toBe("Ends 2026-02-01 · Window 3 days");
  });

  it("parses optional positive integer form values with mobile validation messages", () => {
    expect(parseOptionalPositiveInteger("", "Timeout")).toBeNull();
    expect(parseOptionalPositiveInteger("3", "Timeout")).toBe(3);
    expect(() => parseOptionalPositiveInteger("0", "Timeout")).toThrow("Timeout must be a positive whole number.");
  });
});
