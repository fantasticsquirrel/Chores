import { isTodayCaughtUp, type TodayResource } from "./todayQueue";

function snapshot() {
  return {
    approvals: { data: [], loading: false, error: null } as TodayResource<
      unknown[]
    >,
    children: {
      data: [{ id: 7, active: true }],
      loading: false,
      error: null,
    } as TodayResource<{ id: number; active: boolean }[]>,
    counts: { 7: { data: 0, loading: false, error: null } } as Record<
      number,
      TodayResource<number>
    >,
  };
}

it("confirms caught-up only after every relevant read succeeds", () => {
  const state = snapshot();
  expect(isTodayCaughtUp(state.approvals, state.children, state.counts)).toBe(
    true,
  );
});

it.each(["approvals", "children", "child count"])(
  "does not claim caught-up while %s retries with retained zero data",
  (section) => {
    const state = snapshot();
    if (section === "child count") state.counts[7].loading = true;
    else if (section === "approvals") state.approvals.loading = true;
    else state.children.loading = true;
    expect(isTodayCaughtUp(state.approvals, state.children, state.counts)).toBe(
      false,
    );
  },
);

it("does not claim caught-up for unavailable child work", () => {
  const state = snapshot();
  state.counts[7] = { data: null, loading: false, error: "Offline" };
  expect(isTodayCaughtUp(state.approvals, state.children, state.counts)).toBe(
    false,
  );
});
