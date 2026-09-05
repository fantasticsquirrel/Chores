import { describe, expect, it } from "vitest";

import {
  buildCreateChorePayload,
  buildDefaultChoreForm,
  buildUpdateChorePayload,
  parseOptionalPositiveInteger,
  type ChoreFormState,
} from "./choreForm";

function form(overrides: Partial<ChoreFormState> = {}): ChoreFormState {
  return {
    ...buildDefaultChoreForm(),
    start_date: "2026-09-05",
    ...overrides,
  };
}

describe("parseOptionalPositiveInteger", () => {
  it("returns null for blank values", () => {
    expect(parseOptionalPositiveInteger("", "Window")).toBeNull();
    expect(parseOptionalPositiveInteger("   ", "Window")).toBeNull();
  });

  it("parses positive whole numbers", () => {
    expect(parseOptionalPositiveInteger("7", "Window")).toBe(7);
    expect(parseOptionalPositiveInteger(" 12 ", "Window")).toBe(12);
  });

  it("rejects zero, negative, and non-numeric values", () => {
    expect(() => parseOptionalPositiveInteger("0", "Window")).toThrow(
      "Window must be a positive whole number.",
    );
    expect(() => parseOptionalPositiveInteger("-2", "Window")).toThrow(
      "Window must be a positive whole number.",
    );
    expect(() => parseOptionalPositiveInteger("abc", "Window")).toThrow(
      "Window must be a positive whole number.",
    );
  });
});

describe("chore form payload mapping", () => {
  it("builds the existing rewarded child chore create payload", () => {
    expect(
      buildCreateChorePayload(
        form({
          name: "  Vacuum  ",
          reward_dollars: "2.75",
          allowed_child_ids: [11],
        }),
        7,
        3,
      ),
    ).toEqual({
      household_id: 7,
      owner_user_id: null,
      name: "Vacuum",
      reward_cents: 275,
      start_date: "2026-09-05",
      expires_at: null,
      timeout_days: null,
      schedule_mode: "NONE",
      schedule_interval: null,
      schedule_unit: null,
      completion_mode: "PER_CHILD",
      assignment_mode: "STATIC",
      allowed_child_ids: [11],
      rotation_order: [],
    });
  });

  it("keeps create and update assignment contracts distinct", () => {
    const rotating = form({
      name: "Dishes",
      assignment_mode: "ROTATING",
      rotation_order: [12, 11],
      allowed_child_ids: [99],
      schedule_mode: "EVERY",
      schedule_interval: "2",
      schedule_unit: "DAY",
      timeout_days: "3",
      expires_at: "2026-12-01",
    });

    expect(buildCreateChorePayload(rotating, 7, 3)).toMatchObject({
      assignment_mode: "ROTATING",
      allowed_child_ids: [],
      rotation_order: [12, 11],
      schedule_interval: 2,
      schedule_unit: "DAY",
      timeout_days: 3,
      expires_at: "2026-12-01",
    });
    expect(buildUpdateChorePayload(rotating, 7, 3)).toMatchObject({
      assignment_mode: "ROTATING",
      allowed_child_ids: null,
      rotation_order: [12, 11],
    });
  });

  it("maps parent chores to the signed-in owner without finance", () => {
    expect(
      buildCreateChorePayload(
        form({
          name: "Water plants",
          task_scope: "PARENT",
          reward_dollars: "9.99",
        }),
        7,
        31,
      ),
    ).toMatchObject({
      household_id: 7,
      owner_user_id: 31,
      reward_cents: 0,
      assignment_mode: "STATIC",
      allowed_child_ids: [],
      rotation_order: [],
    });
  });

  it("preserves form validation messages", () => {
    expect(() => buildCreateChorePayload(form(), 7, 3)).toThrow(
      "Chore name is required.",
    );
    expect(() =>
      buildCreateChorePayload(
        form({ name: "Laundry", reward_dollars: "-1" }),
        7,
        3,
      ),
    ).toThrow("Reward must be a non-negative dollar amount.");
    expect(() =>
      buildCreateChorePayload(
        form({
          name: "Laundry",
          assignment_mode: "ROTATING",
          rotation_order: [11],
        }),
        7,
        3,
      ),
    ).toThrow("Rotation requires at least 2 children.");
  });
});
