import { describe, expect, it } from "vitest";

import type { Child, Chore } from "../../../api/models";
import {
  buildCreateChoreRequest,
  buildDefaultChoreForm,
  buildEditChoreForm,
  buildUpdateChoreRequest,
  completionLabel,
  eligibleTimingLabel,
  eligibilityLabel,
  parseOptionalPositiveInteger,
  rewardLabel,
  scheduleLabel,
  showScheduleInterval,
  timingLabel,
} from "./chorePresentation";

const children: Child[] = [
  { id: 1, household_id: 1, name: "Jordan", active: true },
  { id: 2, household_id: 1, name: "Ben", active: true },
];

function chore(patch: Partial<Chore>): Chore {
  return {
    id: 1,
    household_id: 1,
    owner_user_id: null,
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

  it("loads a reward into the editable dollar field", () => {
    expect(buildEditChoreForm(chore({ reward_cents: 275 }))).toMatchObject({
      name: "Laundry",
      reward_dollars: "2.75",
    });
  });

  it("formats schedule, assignment, and timing labels", () => {
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
      eligibilityLabel(chore({ allowed_child_ids: [1, 2] }), children),
    ).toBe("Jordan, Ben");
    expect(
      timingLabel(chore({ expires_at: "2026-02-01", timeout_days: 3 })),
    ).toBe("Ends 2026-02-01 · Window 3 days");
    expect(completionLabel(chore({ completion_mode: "SHARED" }))).toBe(
      "Shared",
    );
    expect(rewardLabel(chore({ reward_cents: 275 }))).toBe("Reward $2.75");
    expect(
      eligibleTimingLabel({
        chore_id: 1,
        expires_on: "2026-02-04",
        name: "Laundry",
        occurrence_date: "2026-02-01",
        reward_cents: 275,
      }),
    ).toBe("Due 2026-02-01 · Ends 2026-02-04");
  });

  it("parses optional positive integer form values with mobile validation messages", () => {
    expect(parseOptionalPositiveInteger("", "Timeout")).toBeNull();
    expect(parseOptionalPositiveInteger("3", "Timeout")).toBe(3);
    expect(() => parseOptionalPositiveInteger("0", "Timeout")).toThrow(
      "Timeout must be a positive whole number.",
    );
  });

  it("maps create and update forms to the shared family-api request contracts", () => {
    const form = {
      ...buildDefaultChoreForm("2026-09-05"),
      allowed_child_ids: [1],
      expires_at: "2026-10-01",
      name: "  Laundry  ",
      reward_dollars: "2.75",
      schedule_interval: "2",
      schedule_mode: "EVERY" as const,
      timeout_days: "3",
    };

    expect(showScheduleInterval(form)).toBe(true);
    expect(buildCreateChoreRequest(form, 7, 2)).toEqual({
      allowed_child_ids: [1],
      assignment_mode: "STATIC",
      completion_mode: "PER_CHILD",
      expires_at: "2026-10-01",
      household_id: 7,
      name: "Laundry",
      owner_user_id: null,
      reward_cents: 275,
      rotation_order: [],
      schedule_interval: 2,
      schedule_mode: "EVERY",
      schedule_unit: "WEEK",
      start_date: "2026-09-05",
      timeout_days: 3,
    });
    expect(buildUpdateChoreRequest(form, 7, 2)).toEqual({
      allowed_child_ids: [1],
      assignment_mode: "STATIC",
      completion_mode: "PER_CHILD",
      expires_at: "2026-10-01",
      household_id: 7,
      name: "Laundry",
      owner_user_id: null,
      reward_cents: 275,
      rotation_order: null,
      schedule_interval: 2,
      schedule_mode: "EVERY",
      schedule_unit: "WEEK",
      start_date: "2026-09-05",
      timeout_days: 3,
    });
  });
});
