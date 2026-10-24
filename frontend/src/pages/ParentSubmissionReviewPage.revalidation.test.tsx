import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { apiClient, type SubmissionReview } from "../api";
import { ParentSubmissionReviewPage } from "./ParentSubmissionReviewPage";
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
afterEach(() => vi.restoreAllMocks());
it("keeps unrelated rows and removes a committed decision when refresh fails", async () => {
  let rejectRefresh!: (reason: Error) => void;
  vi.spyOn(apiClient, "listSubmissions")
    .mockResolvedValueOnce([row(1), row(2)])
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRefresh = reject;
        }),
    );
  const save = vi
    .spyOn(apiClient, "approveSubmission")
    .mockResolvedValue({ ...row(1), status: "APPROVED", items: [] });
  render(<ParentSubmissionReviewPage />);
  await screen.findByText("Child 1");
  fireEvent.click(screen.getAllByRole("button", { name: "Approve All" })[0]);
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(screen.getByText("Child 2")).toBeVisible();
  expect(screen.queryByText("Child 1")).not.toBeInTheDocument();
  await act(async () => rejectRefresh(new Error("Offline")));
  expect(screen.getByText("Child 2")).toBeVisible();
  expect(screen.getByText(/saved.*refresh/i)).toBeVisible();
});

it.each(["all", "item"])(
  "does not refresh another session when a delayed %s approval resolves after unmount",
  async (mode) => {
    const reads = vi
      .spyOn(apiClient, "listSubmissions")
      .mockResolvedValue([row(1)]);
    let resolveWrite!: (value: SubmissionReview) => void;
    const write = new Promise<SubmissionReview>((resolve) => {
      resolveWrite = resolve;
    });
    const save =
      mode === "all"
        ? vi.spyOn(apiClient, "approveSubmission").mockReturnValue(write)
        : vi.spyOn(apiClient, "decideSubmissionItem").mockReturnValue(write);
    const view = render(<ParentSubmissionReviewPage />);
    await screen.findByText("Child 1");
    fireEvent.click(
      screen.getByRole("button", {
        name: mode === "all" ? "Approve All" : "Approve",
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => resolveWrite({ ...row(1), status: "APPROVED" }));
    expect(reads).toHaveBeenCalledTimes(1);
  },
);
