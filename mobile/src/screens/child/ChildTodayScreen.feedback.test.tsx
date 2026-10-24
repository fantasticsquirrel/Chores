import { afterEach, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { apiClient } from "../../api/client";
import { ChildTodayScreen } from "./ChildTodayScreen";
afterEach(() => {
  jest.restoreAllMocks();
});
it("keeps server-confirmed success through refresh", async () => {
  jest
    .spyOn(apiClient, "listEligibleChores")
    .mockResolvedValueOnce([
      {
        chore_id: 1,
        name: "Dishes",
        reward_cents: 100,
        occurrence_date: "2026-10-24",
        expires_on: null,
      },
    ])
    .mockResolvedValueOnce([]);
  const save = jest
    .spyOn(apiClient, "createSubmission")
    .mockResolvedValue({ id: 1, status: "PENDING" } as never);
  const view = render(<ChildTodayScreen />);
  fireEvent.press(await view.findByText("Dishes"));
  fireEvent.press(view.getByText("Submit 1"));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  await view.findByText("No chores are available for this date.");
  expect(view.getByText("Submitted for parent review.")).toBeTruthy();
});

it("does not refresh another session when submission resolves after unmount", async () => {
  const reads = jest
    .spyOn(apiClient, "listEligibleChores")
    .mockResolvedValue([
      {
        chore_id: 1,
        name: "Dishes",
        reward_cents: 100,
        occurrence_date: "2026-10-24",
        expires_on: null,
      },
    ]);
  let resolveWrite!: (
    value: Awaited<ReturnType<typeof apiClient.createSubmission>>,
  ) => void;
  const save = jest.spyOn(apiClient, "createSubmission").mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveWrite = resolve;
      }),
  );
  const view = render(<ChildTodayScreen />);
  fireEvent.press(await view.findByText("Dishes"));
  fireEvent.press(view.getByText("Submit 1"));
  expect(save).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => resolveWrite({ id: 1, status: "PENDING" } as never));
  expect(reads).toHaveBeenCalledTimes(1);
});
