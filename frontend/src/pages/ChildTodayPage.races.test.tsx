import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { apiClient, type EligibleChore } from "../api";
import { ChildTodayPage } from "./ChildTodayPage";
const chore: EligibleChore = {
  chore_id: 1,
  name: "Dishes",
  reward_cents: 100,
  occurrence_date: "2026-10-24",
  expires_on: null,
};
afterEach(() => vi.restoreAllMocks());
it("rejects a stale date response", async () => {
  let resolveOld!: (value: EligibleChore[]) => void;
  vi.spyOn(apiClient, "listEligibleChores")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce([{ ...chore, name: "New date chore" }]);
  render(<ChildTodayPage />);
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2026-10-25" },
  });
  await screen.findByText("New date chore");
  await act(async () => resolveOld([chore]));
  expect(screen.getByText("New date chore")).toBeVisible();
  expect(screen.queryByText("Dishes")).not.toBeInTheDocument();
});
it("preserves submitted feedback and prevents reselecting submitted chores after refresh failure", async () => {
  vi.spyOn(apiClient, "listEligibleChores")
    .mockResolvedValueOnce([chore])
    .mockRejectedValueOnce(new Error("Offline"));
  const save = vi
    .spyOn(apiClient, "createSubmission")
    .mockResolvedValue({ id: 1, status: "PENDING" } as never);
  render(<ChildTodayPage />);
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Submit Selected Chores" }),
  );
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(
    await screen.findByText("Submitted 1 chore(s) for review."),
  ).toBeVisible();
  expect(await screen.findByText(/submitted.*refresh/i)).toBeVisible();
});

it("does not refresh a different session after a submitted write resolves after unmount", async () => {
  const reads = vi
    .spyOn(apiClient, "listEligibleChores")
    .mockResolvedValue([chore]);
  let resolveWrite!: (
    value: Awaited<ReturnType<typeof apiClient.createSubmission>>,
  ) => void;
  const save = vi.spyOn(apiClient, "createSubmission").mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveWrite = resolve;
      }),
  );
  const view = render(<ChildTodayPage />);
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Submit Selected Chores" }),
  );
  expect(save).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => resolveWrite({ id: 1, status: "PENDING" } as never));
  expect(reads).toHaveBeenCalledTimes(1);
});
