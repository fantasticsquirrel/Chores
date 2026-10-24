import { afterEach, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { apiClient } from "../../api/client";
import type { SubmissionReview } from "../../api/models";
import { ParentReviewScreen } from "./ReviewScreen";
const row = (id: number): SubmissionReview => ({
  id,
  child_id: id,
  child_name: `Child ${id}`,
  for_date: "2026-10-24",
  status: "PENDING",
  items: [
    {
      id,
      chore_id: id,
      chore_name: `Chore ${id}`,
      chore_reward_cents: 100,
      status: "PENDING",
    },
  ],
});
afterEach(() => {
  jest.restoreAllMocks();
});
it("keeps unrelated rows during revalidation and labels refresh failure after saved decision", async () => {
  let rejectRefresh!: (reason: Error) => void;
  jest
    .spyOn(apiClient, "listSubmissions")
    .mockResolvedValueOnce([row(1), row(2)])
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRefresh = reject;
        }),
    );
  const save = jest
    .spyOn(apiClient, "approveSubmission")
    .mockResolvedValue({ ...row(1), status: "APPROVED", items: [] });
  const view = render(<ParentReviewScreen />);
  await view.findByText("Chore 1");
  fireEvent.press(view.getAllByText("Approve all")[0]);
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(view.getByText("Chore 2")).toBeTruthy();
  expect(view.queryByText("Chore 1")).toBeNull();
  await act(async () => rejectRefresh(new Error("Offline")));
  expect(view.getByText("Chore 2")).toBeTruthy();
  expect(view.getByText(/saved.*refresh/i)).toBeTruthy();
});

it.each(["all", "item"])(
  "does not refresh another session when delayed %s approval resolves after unmount",
  async (mode) => {
    const reads = jest
      .spyOn(apiClient, "listSubmissions")
      .mockResolvedValue([row(1)]);
    let resolveWrite!: (value: SubmissionReview) => void;
    const write = new Promise<SubmissionReview>((resolve) => {
      resolveWrite = resolve;
    });
    const save =
      mode === "all"
        ? jest.spyOn(apiClient, "approveSubmission").mockReturnValue(write)
        : jest.spyOn(apiClient, "decideSubmissionItem").mockReturnValue(write);
    const view = render(<ParentReviewScreen />);
    await view.findByText("Chore 1");
    fireEvent.press(
      view.getByRole("button", {
        name: mode === "all" ? "Approve all" : "Approve",
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => resolveWrite({ ...row(1), status: "APPROVED" }));
    expect(reads).toHaveBeenCalledTimes(1);
  },
);
