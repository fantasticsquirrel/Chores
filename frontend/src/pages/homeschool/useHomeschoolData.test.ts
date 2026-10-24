import { act, renderHook, waitFor } from "@testing-library/react";
import { apiClient } from "../../api";
import { useHomeschoolData } from "./useHomeschoolData";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function mockOtherLists() {
  vi.spyOn(apiClient, "listHomeschoolSemesters").mockResolvedValue([]);
  vi.spyOn(apiClient, "listHomeschoolSubjects").mockResolvedValue([]);
  vi.spyOn(apiClient, "listHomeschoolAttendance").mockResolvedValue([]);
  vi.spyOn(apiClient, "listHomeschoolDayComments").mockResolvedValue([]);
  vi.spyOn(apiClient, "listHomeschoolGrades").mockResolvedValue([]);
}
const child = (householdId: number) => [{ id: householdId, household_id: householdId, name: `Child ${householdId}`, active: true }];

afterEach(() => vi.restoreAllMocks());

it("does not let an older refresh overwrite newer attendance data", async () => {
  mockOtherLists();
  const old = deferred<ReturnType<typeof child>>();
  vi.spyOn(apiClient, "listChildren").mockReturnValueOnce(old.promise).mockResolvedValue(child(2));
  const { result } = renderHook(() => useHomeschoolData(1));
  await act(async () => { await result.current.refresh(); });
  await waitFor(() => expect(result.current.data.children).toEqual(child(2)));
  await act(async () => old.resolve(child(1)));
  expect(result.current.data.children).toEqual(child(2));
});

it("clears old household data and rejects its pending response after switching scope", async () => {
  mockOtherLists();
  const old = deferred<ReturnType<typeof child>>();
  vi.spyOn(apiClient, "listChildren").mockReturnValueOnce(old.promise).mockResolvedValue(child(2));
  const { result, rerender } = renderHook(({ householdId }) => useHomeschoolData(householdId), { initialProps: { householdId: 1 } });
  rerender({ householdId: 2 });
  await waitFor(() => expect(result.current.data.children).toEqual(child(2)));
  await act(async () => old.resolve(child(1)));
  expect(result.current.data.children).toEqual(child(2));
});

it("returns an awaitable refresh and clears data when scope disappears", async () => {
  mockOtherLists();
  vi.spyOn(apiClient, "listChildren").mockResolvedValue(child(1));
  const { result, rerender } = renderHook(({ householdId }: { householdId: number | null }) => useHomeschoolData(householdId), { initialProps: { householdId: 1 as number | null } });
  await waitFor(() => expect(result.current.data.loading).toBe(false));
  let pending: unknown;
  await act(async () => { pending = result.current.refresh(); await pending; });
  expect(pending).toBeInstanceOf(Promise);
  rerender({ householdId: null });
  expect(result.current.data.children).toEqual([]);
});

it("preserves known records and reports refresh failure without an unhandled rejection", async () => {
  mockOtherLists();
  vi.spyOn(apiClient, "listChildren").mockResolvedValueOnce(child(1)).mockRejectedValueOnce(new Error("Offline"));
  const { result } = renderHook(() => useHomeschoolData(1));
  await waitFor(() => expect(result.current.data.loading).toBe(false));
  await act(async () => { expect(await result.current.refresh()).toBe(false); });
  expect(result.current.data.children).toEqual(child(1));
  expect(result.current.data.error).toContain("Offline");
});

it("ignores an old dialog's refresh callback after its household is replaced", async () => {
  mockOtherLists();
  const list = vi.spyOn(apiClient, "listChildren").mockResolvedValue(child(1));
  const { result, rerender } = renderHook(({ householdId }) => useHomeschoolData(householdId), { initialProps: { householdId: 1 } });
  await waitFor(() => expect(result.current.data.loading).toBe(false));
  const oldRefresh = result.current.refresh;
  list.mockResolvedValue(child(2));
  rerender({ householdId: 2 });
  await waitFor(() => expect(result.current.data.children).toEqual(child(2)));
  await act(async () => { expect(await oldRefresh()).toBe(false); });
  expect(result.current.data.children).toEqual(child(2));
  expect(list).toHaveBeenCalledTimes(2);
});

it("retains acknowledged attendance across stale responses and failed refresh", async () => {
  mockOtherLists();
  const pending = deferred<ReturnType<typeof child>>();
  const list = vi.spyOn(apiClient, "listChildren").mockResolvedValueOnce(child(1)).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useHomeschoolData(1));
  await waitFor(() => expect(result.current.data.loading).toBe(false));
  let refresh!: Promise<boolean>;
  act(() => { refresh = result.current.refresh(); });
  const record = { id: 8, household_id: 1, child_id: 1, subject_id: 3, date: "2026-09-08", present: false, comment: "Acknowledged" };
  act(() => result.current.applyAttendanceRecord(record));
  await act(async () => { pending.resolve(child(1)); await refresh; });
  expect(result.current.data.attendanceRecords).toEqual([record]);
  list.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => { await result.current.refresh(); });
  expect(result.current.data.attendanceRecords).toEqual([record]);
  act(() => result.current.applyAttendanceRecord({ ...record, household_id: 2, comment: "Wrong household" }));
  expect(result.current.data.attendanceRecords).toEqual([record]);
});
