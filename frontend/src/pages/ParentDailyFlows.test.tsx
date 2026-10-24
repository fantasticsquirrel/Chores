import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import App from "../App";
import { apiClient } from "../api";

const children = [
  { id: 11, household_id: 1, name: "Riley", active: true },
  { id: 12, household_id: 1, name: "Robin", active: true },
];
const chores = Array.from({ length: 6 }, (_, index) => ({
  chore_id: index + 1,
  name: `Task ${index + 1}`,
  occurrence_date: "2026-10-24",
  reward_cents: 100,
}));
beforeEach(() => {
  vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
  vi.spyOn(apiClient, "listChores").mockResolvedValue([]);
  vi.spyOn(apiClient, "listMyParentTasks").mockResolvedValue([]);
  vi.spyOn(apiClient, "listEligibleChores").mockResolvedValue(chores);
});
afterEach(() => vi.restoreAllMocks());
function open(path = "/parent/chores") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

it("opens and focuses a visible editor, retains failed drafts, and returns focus without changing the board", async () => {
  vi.spyOn(apiClient, "createChore").mockRejectedValue(new Error("Offline"));
  open("/parent/chores?childId=12&date=2026-10-23");
  const add = await screen.findByRole("button", { name: "Add Chore" });
  add.focus();
  fireEvent.click(add);
  const dialog = screen.getByRole("dialog", { name: "New Chore" });
  expect(within(dialog).getByLabelText("Name")).toHaveFocus();
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: "Keep this draft" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Create Chore" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Offline");
  expect(within(dialog).getByLabelText("Name")).toHaveValue("Keep this draft");
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(add).toHaveFocus();
  expect(screen.getByLabelText("Child")).toHaveValue("12");
  expect(screen.getByLabelText("Date")).toHaveValue("2026-10-23");
});

it("uses one chore list for quick and six-item submission with explicit multi-select", async () => {
  const submit = vi.spyOn(apiClient, "createSubmission").mockResolvedValue({
    id: 3,
    child_id: 12,
    for_date: "2026-10-23",
    status: "PENDING",
    items: [],
  });
  open("/parent/chores?childId=12&date=2026-10-23");
  await screen.findByText("Task 1");
  expect(screen.getAllByText("Task 1")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Select multiple" }));
  for (const chore of chores)
    fireEvent.click(
      screen.getByRole("checkbox", { name: new RegExp(chore.name) }),
    );
  fireEvent.click(
    screen.getByRole("button", { name: "Submit Selected Chores" }),
  );
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      { for_date: "2026-10-23", chore_ids: [1, 2, 3, 4, 5, 6] },
      { child_id: 12 },
    ),
  );
});

it("starts Children with one roster and reveals child-specific account tools on demand", async () => {
  open("/parent/children");
  const roster = await screen.findByRole("list", { name: "Children list" });
  expect(within(roster).getAllByText("Riley")).toHaveLength(1);
  expect(screen.queryByLabelText("Temporary Password")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  fireEvent.click(
    within(roster).getByRole("button", { name: "Manage login for Robin" }),
  );
  expect(
    screen.getByRole("heading", { name: "Robin’s account" }),
  ).toBeVisible();
  expect(
    screen.queryByLabelText(/New Legacy Login Email/),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Advanced account tools" }),
  );
  expect(screen.getByLabelText(/New Legacy Login Email/)).toBeVisible();
});

it("restores the same unsaved editor draft on browser Forward", async () => {
  const navigation: { current?: (delta: number) => void } = {};
  function History() {
    navigation.current = useNavigate();
    return null;
  }
  render(
    <MemoryRouter initialEntries={["/parent/chores"]}>
      <History />
      <App />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Add Chore" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Back keeps this draft" },
  });
  act(() => navigation.current?.(-1));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  act(() => navigation.current?.(1));
  expect(
    await screen.findByRole("dialog", { name: "New Chore" }),
  ).toBeVisible();
  expect(screen.getByLabelText("Name")).toHaveValue("Back keeps this draft");
});

it("blocks old-date chores while the replacement roster and eligibility are pending", async () => {
  const submit = vi.spyOn(apiClient, "createSubmission").mockResolvedValue({
    id: 8,
    child_id: 11,
    for_date: "2026-10-25",
    status: "PENDING",
    items: [],
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  open("/parent/chores?childId=11&date=2026-10-24");
  await screen.findByText("Task 1");
  let resolveChildren!: (value: typeof children) => void;
  let resolveEligible!: (value: typeof chores) => void;
  vi.mocked(apiClient.listChildren).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveChildren = resolve;
      }),
  );
  vi.mocked(apiClient.listEligibleChores).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveEligible = resolve;
      }),
  );
  fireEvent.change(screen.getByLabelText("Date"), {
    target: { value: "2026-10-25" },
  });
  expect(screen.queryByText("Task 1")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Select multiple" }),
  ).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Child" })).toBeDisabled();
  expect(submit).not.toHaveBeenCalled();
  await act(async () => resolveChildren([children[0]]));
  expect(
    screen.getByRole("button", { name: "Select multiple" }),
  ).toBeDisabled();
  expect(screen.queryByText("Task 1")).not.toBeInTheDocument();
  await act(async () =>
    resolveEligible([
      {
        ...chores[0],
        chore_id: 20,
        name: "New date task",
        occurrence_date: "2026-10-25",
      },
    ]),
  );
  fireEvent.click(await screen.findByRole("button", { name: /New date task/ }));
  expect(submit).toHaveBeenCalledExactlyOnceWith(
    { for_date: "2026-10-25", chore_ids: [20] },
    { child_id: 11 },
  );
});
