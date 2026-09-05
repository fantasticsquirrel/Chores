import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";

import { apiClient } from "../../api/client";
import type {
  AuthSessionResponse,
  Child,
  Chore,
  EligibleChore,
} from "../../api/models";
import { todayDateString } from "../../utils/date";
import { ChoresScreen } from "./ChoresScreen";

const session: AuthSessionResponse = {
  csrf_token: "mobile-csrf",
  user: {
    child_id: null,
    email: "parent@example.com",
    household_id: 7,
    id: 2,
    is_household_owner: true,
    role: "PARENT",
  },
};

const child: Child = {
  active: true,
  household_id: 7,
  id: 3,
  name: "Mia",
};

const chore: Chore = {
  allowed_child_ids: [3],
  archived_at: null,
  assignment_mode: "STATIC",
  completion_mode: "PER_CHILD",
  expires_at: null,
  household_id: 7,
  id: 11,
  is_active: true,
  name: "Laundry",
  owner_user_id: null,
  reward_cents: 275,
  reward_dollars: 2.75,
  rotation_order: [],
  schedule_interval: null,
  schedule_mode: "NONE",
  schedule_unit: null,
  start_date: "2026-09-01",
  timeout_days: 3,
};

const parentTask: Chore = {
  ...chore,
  allowed_child_ids: [],
  id: 12,
  name: "Call plumber",
  owner_user_id: 2,
  reward_cents: 0,
  reward_dollars: 0,
};

const eligibleChore: EligibleChore = {
  chore_id: 11,
  expires_on: "2026-09-08",
  name: "Laundry",
  occurrence_date: "2026-09-05",
  reward_cents: 275,
};

function arrangeSuccessfulLoad() {
  jest.spyOn(apiClient, "listChores").mockResolvedValue([chore]);
  jest.spyOn(apiClient, "listMyParentTasks").mockResolvedValue([parentTask]);
  jest.spyOn(apiClient, "listChildren").mockResolvedValue([child]);
  jest
    .spyOn(apiClient, "listEligibleChores")
    .mockResolvedValue([eligibleChore]);
}

describe("ChoresScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads household chores, parent tasks, children, and eligibility with the existing scopes", async () => {
    arrangeSuccessfulLoad();
    const date = todayDateString();

    render(<ChoresScreen session={session} />);

    expect(
      screen.getByText("Loading children and available chores"),
    ).toBeTruthy();
    expect(await screen.findByText("Call plumber")).toBeTruthy();
    expect(screen.getAllByText("Laundry")).toHaveLength(3);
    expect(apiClient.listChores).toHaveBeenCalledWith({
      active_only: false,
      household_id: 7,
    });
    expect(apiClient.listMyParentTasks).toHaveBeenCalledWith(date);
    expect(apiClient.listChildren).toHaveBeenCalledWith({ household_id: 7 });
    expect(apiClient.listEligibleChores).toHaveBeenCalledWith({
      child_id: 3,
      date,
    });
  });

  it("preserves quick, selected, and parent-task submission payloads", async () => {
    arrangeSuccessfulLoad();
    const createSubmission = jest
      .spyOn(apiClient, "createSubmission")
      .mockResolvedValue({
        child_id: 3,
        for_date: todayDateString(),
        id: 20,
        items: [{ chore_id: 11, status: "PENDING" }],
        status: "PENDING",
      });
    const completeParentTask = jest
      .spyOn(apiClient, "completeParentTask")
      .mockResolvedValue(undefined);
    const date = todayDateString();

    render(<ChoresScreen session={session} />);
    await screen.findByText("Call plumber");

    fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Submitted Laundry for review.");
    expect(createSubmission).toHaveBeenNthCalledWith(
      1,
      { chore_ids: [11], for_date: date },
      { child_id: 3 },
    );

    fireEvent.press(screen.getByText("Select"));
    fireEvent.press(screen.getByRole("button", { name: "Submit Selected" }));
    await screen.findByText("Submitted 1 chore(s) for Mia.");
    expect(createSubmission).toHaveBeenNthCalledWith(
      2,
      { chore_ids: [11], for_date: date },
      { child_id: 3 },
    );

    fireEvent.press(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(completeParentTask).toHaveBeenCalledWith(12, date),
    );
  });

  it("preserves create and update payload mapping", async () => {
    arrangeSuccessfulLoad();
    const createChore = jest
      .spyOn(apiClient, "createChore")
      .mockResolvedValue(chore);
    const updateChore = jest
      .spyOn(apiClient, "updateChore")
      .mockResolvedValue({ ...chore, name: "Fold laundry" });
    const date = todayDateString();

    render(<ChoresScreen session={session} />);
    await screen.findByText("Call plumber");

    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    fireEvent.changeText(
      screen.getByPlaceholderText("Take out trash"),
      "  Clean kitchen  ",
    );
    fireEvent.press(screen.getByRole("button", { name: "Save Chore" }));
    await waitFor(() => expect(createChore).toHaveBeenCalledTimes(1));
    expect(createChore).toHaveBeenCalledWith({
      allowed_child_ids: [],
      assignment_mode: "STATIC",
      completion_mode: "PER_CHILD",
      expires_at: null,
      household_id: 7,
      name: "Clean kitchen",
      owner_user_id: null,
      reward_cents: 0,
      rotation_order: [],
      schedule_interval: null,
      schedule_mode: "NONE",
      schedule_unit: null,
      start_date: date,
      timeout_days: null,
    });

    fireEvent.press(screen.getByRole("button", { name: "Edit" }));
    fireEvent.changeText(
      screen.getByDisplayValue("Laundry"),
      "  Fold laundry  ",
    );
    fireEvent.press(screen.getByRole("button", { name: "Save Chore" }));
    await waitFor(() => expect(updateChore).toHaveBeenCalledTimes(1));
    expect(updateChore).toHaveBeenCalledWith(11, {
      allowed_child_ids: [3],
      assignment_mode: "STATIC",
      completion_mode: "PER_CHILD",
      expires_at: null,
      household_id: 7,
      name: "Fold laundry",
      owner_user_id: null,
      reward_cents: 275,
      rotation_order: null,
      schedule_interval: null,
      schedule_mode: "NONE",
      schedule_unit: null,
      start_date: "2026-09-01",
      timeout_days: 3,
    });
  });

  it("keeps load failures visible and archives only after native confirmation", async () => {
    arrangeSuccessfulLoad();
    jest
      .spyOn(apiClient, "listChildren")
      .mockRejectedValue(new Error("children unavailable"));

    const firstRender = render(<ChoresScreen session={session} />);
    expect(
      await screen.findByText("Could not load children: children unavailable"),
    ).toBeTruthy();
    firstRender.unmount();

    jest.restoreAllMocks();
    arrangeSuccessfulLoad();
    const archiveChore = jest
      .spyOn(apiClient, "archiveChore")
      .mockResolvedValue(undefined);
    const alert = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);

    render(<ChoresScreen session={session} />);
    await screen.findByText("Call plumber");
    fireEvent.press(screen.getByRole("button", { name: "Archive" }));

    expect(archiveChore).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      "Archive chore?",
      '"Laundry" will stop appearing for children but history stays intact.',
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0]?.[2];
    act(() => {
      buttons?.[1]?.onPress?.();
    });
    await waitFor(() => expect(archiveChore).toHaveBeenCalledWith(11, 7));
  });
});
