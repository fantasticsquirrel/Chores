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
import { SelectedChoreSubmitPanel } from "../../features/chores/components/ChoreBoardPanels";

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
    expect(screen.getAllByText("Laundry")).toHaveLength(1);
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

    fireEvent.press(screen.getByRole("button", { name: "Select multiple" }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Laundry" }));
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

    fireEvent.press(screen.getByRole("button", { name: "Manage chores" }));
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
    fireEvent.press(screen.getByRole("button", { name: "Manage chores" }));
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

it("shows one board and opens an immediately visible, dismissible editor without losing context", async () => {
  arrangeSuccessfulLoad();
  render(<ChoresScreen session={session} />);
  await screen.findByText("Call plumber");
  expect(screen.getAllByText("Laundry")).toHaveLength(1);
  fireEvent.press(screen.getByRole("button", { name: "Add" }));
  expect(screen.getByTestId("chore-editor-modal")).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText("Take out trash"), "Draft");
  fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByTestId("chore-editor-modal")).toBeNull();
  expect(screen.getAllByText("Laundry")).toHaveLength(1);
});

describe("focused chore board edge cases", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it("submits six chores once for the Today deep-linked child and date", async () => {
    arrangeSuccessfulLoad();
    const robin = { ...child, id: 4, name: "Robin" };
    jest.spyOn(apiClient, "listChildren").mockResolvedValue([child, robin]);
    jest.spyOn(apiClient, "listEligibleChores").mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => ({
        ...eligibleChore,
        chore_id: index + 1,
        name: `Task ${index + 1}`,
      })),
    );
    let resolve!: (value: {
      child_id: number;
      for_date: string;
      id: number;
      items: [];
      status: "PENDING";
    }) => void;
    const submit = jest.spyOn(apiClient, "createSubmission").mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(
      <ChoresScreen
        session={session}
        initialChildId={4}
        initialDate="2026-10-23"
      />,
    );
    await screen.findByText("Robin’s chores");
    await screen.findByText("Task 1");
    expect(screen.getAllByText("Task 1")).toHaveLength(1);
    fireEvent.press(screen.getByRole("button", { name: "Select multiple" }));
    for (let id = 1; id <= 6; id++)
      fireEvent.press(screen.getByRole("checkbox", { name: `Task ${id}` }));
    const button = screen.getByRole("button", { name: "Submit Selected" });
    fireEvent.press(button);
    fireEvent.press(button);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(
      { for_date: "2026-10-23", chore_ids: [1, 2, 3, 4, 5, 6] },
      { child_id: 4 },
    );
    await act(async () => {
      resolve({
        child_id: 4,
        for_date: "2026-10-23",
        id: 20,
        items: [],
        status: "PENDING",
      });
    });
    expect(
      await screen.findByText("Submitted 6 chore(s) for Robin."),
    ).toBeTruthy();
  });
  it("retains a failed editor draft and supports Android Back through Modal onRequestClose", async () => {
    arrangeSuccessfulLoad();
    jest
      .spyOn(apiClient, "createChore")
      .mockRejectedValue(new Error("Offline"));
    render(<ChoresScreen session={session} initialDate="2026-10-23" />);
    await screen.findByText("Call plumber");
    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    fireEvent.changeText(
      screen.getByPlaceholderText("Take out trash"),
      "Keep draft",
    );
    fireEvent.press(screen.getByRole("button", { name: "Save Chore" }));
    await screen.findByText("Offline");
    expect(screen.getByDisplayValue("Keep draft")).toBeTruthy();
    fireEvent(screen.getByTestId("chore-editor-modal"), "requestClose");
    expect(screen.queryByTestId("chore-editor-modal")).toBeNull();
    expect(screen.getByDisplayValue("2026-10-23")).toBeTruthy();
  });
  it("keeps Add and management reachable with no children", async () => {
    arrangeSuccessfulLoad();
    jest.spyOn(apiClient, "listChildren").mockResolvedValue([]);
    render(<ChoresScreen session={session} />);
    await screen.findByText("No active children found.");
    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByPlaceholderText("Take out trash")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.press(screen.getByRole("button", { name: "Manage chores" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });
});

describe("date-scope submission safety", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it("blocks retained quick/multi handlers and selection until the new date roster and eligibility arrive", async () => {
    arrangeSuccessfulLoad();
    const submit = jest.spyOn(apiClient, "createSubmission").mockResolvedValue({
      id: 8,
      child_id: 3,
      for_date: "2026-10-25",
      status: "PENDING",
      items: [],
    });
    render(<ChoresScreen session={session} initialDate="2026-10-24" />);
    await screen.findByText("Laundry");
    const retainedQuickSubmit = screen.UNSAFE_getByType(
      SelectedChoreSubmitPanel,
    ).props.onQuickSubmit;
    fireEvent.press(screen.getByRole("button", { name: "Select multiple" }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Laundry" }));
    const retainedSelectedSubmit = screen.UNSAFE_getByType(
      SelectedChoreSubmitPanel,
    ).props.onSubmit;
    let resolveChildren!: (value: Child[]) => void;
    let resolveEligible!: (value: EligibleChore[]) => void;
    jest.mocked(apiClient.listChildren).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveChildren = resolve;
        }),
    );
    jest.mocked(apiClient.listEligibleChores).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEligible = resolve;
        }),
    );
    act(() => {
      fireEvent.changeText(screen.getByLabelText("Date"), "2026-10-25");
      void retainedQuickSubmit(child, eligibleChore);
      void retainedSelectedSubmit();
    });
    expect(submit).not.toHaveBeenCalled();
    expect(screen.queryByText("Laundry")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Quick submit mode" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Change child (Mia)" }),
    ).toBeDisabled();
    await act(async () => resolveChildren([child]));
    expect(
      screen.getByRole("button", { name: "Quick submit mode" }),
    ).toBeDisabled();
    act(() => {
      void retainedQuickSubmit(child, eligibleChore);
      void retainedSelectedSubmit();
    });
    expect(submit).not.toHaveBeenCalled();
    await act(async () =>
      resolveEligible([
        {
          ...eligibleChore,
          chore_id: 20,
          name: "New date task",
          occurrence_date: "2026-10-25",
        },
      ]),
    );
    act(() => {
      void retainedQuickSubmit(child, eligibleChore);
      void retainedSelectedSubmit();
    });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Quick submit mode" }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(
      { for_date: "2026-10-25", chore_ids: [20] },
      { child_id: 3 },
    );
  });
});
