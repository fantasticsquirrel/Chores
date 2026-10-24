import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Modal, View } from "react-native";
import { ModuleAccessProvider } from "../../../modules/ModuleAccessContext";
import { apiClient } from "../../../api/client";
import { AttendanceDayModal } from "./AttendanceDayModal";
import type { HomeschoolAttendance } from "../../../api/models";

const subjects = [1, 2].map((id) => ({
  id,
  household_id: 7,
  name: id === 1 ? "Math" : "Reading",
  color: "#3b82f6",
  active: true,
}));
const record = (
  subject_id: number,
  date = "2026-09-01",
): HomeschoolAttendance => ({
  id: subject_id,
  household_id: 7,
  child_id: 3,
  subject_id,
  date,
  present: subject_id === 1,
  comment: `Note ${subject_id}`,
});
const base = {
  householdId: 7,
  childId: 3,
  childName: "Mia",
  date: "2026-09-07",
  subjects,
  records: [record(1), record(2)],
  onClose: jest.fn(),
  onRefresh: jest.fn<() => Promise<void>>().mockResolvedValue(),
  onRecordSaved: jest.fn(),
};
describe("AttendanceDayModal", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it("copies all prior values without saving, supports multiple subjects and waits before closing", async () => {
    jest.useFakeTimers();
    const save = jest
      .spyOn(apiClient, "upsertHomeschoolAttendance")
      .mockImplementation(async (input) => ({
        ...input,
        id: input.subject_id,
        present: input.present ?? true,
        comment: input.comment ?? "",
      }));
    const onClose = jest.fn();
    render(<AttendanceDayModal {...base} onClose={onClose} />);
    fireEvent.press(screen.getByText("Copy previous day"));
    expect(screen.getByLabelText("Math comment").props.value).toBe("Note 1");
    expect(screen.getByLabelText("Reading comment").props.value).toBe("Note 2");
    expect(save).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Save Attendance"));
    await act(async () => {});
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        child_id: 3,
        household_id: 7,
        date: "2026-09-07",
        subject_id: 2,
        present: false,
        comment: "Note 2",
      }),
    );
    expect(screen.getByText("Attendance saved.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(2500));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("keeps successful writes, stays open after partial failure, retries only failed entries", async () => {
    const save = jest
      .spyOn(apiClient, "upsertHomeschoolAttendance")
      .mockResolvedValueOnce(record(1, "2026-09-07"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(record(2, "2026-09-07"));
    render(<AttendanceDayModal {...base} />);
    fireEvent.press(screen.getByText("Copy previous day"));
    fireEvent.press(screen.getByText("Save Attendance"));
    await waitFor(() =>
      expect(screen.getByText(/Some attendance was not saved/)).toBeTruthy(),
    );
    expect(screen.queryByText("Attendance saved.")).toBeNull();
    fireEvent.press(screen.getByText("Save Attendance"));
    await waitFor(() =>
      expect(screen.getByText("Attendance saved.")).toBeTruthy(),
    );
    expect(save).toHaveBeenCalledTimes(3);
    expect(save.mock.calls[2][0].subject_id).toBe(2);
  });
  it("guards rapid save and cancel while pending, stops remaining writes on unmount", async () => {
    let resolve!: (value: HomeschoolAttendance) => void;
    const save = jest
      .spyOn(apiClient, "upsertHomeschoolAttendance")
      .mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
    const onClose = jest.fn();
    const view = render(<AttendanceDayModal {...base} onClose={onClose} />);
    fireEvent.press(screen.getByText("Copy previous day"));
    const button = screen.getByText("Save Attendance");
    fireEvent.press(button);
    fireEvent.press(button);
    fireEvent.press(screen.getByText("Cancel"));
    expect(save).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    view.unmount();
    await act(async () => {
      resolve(record(1, "2026-09-07"));
    });
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("explains missing history and cancel performs no writes", () => {
    const save = jest.spyOn(apiClient, "upsertHomeschoolAttendance");
    const onClose = jest.fn();
    render(<AttendanceDayModal {...base} records={[]} onClose={onClose} />);
    fireEvent.press(screen.getByText("Copy previous day"));
    expect(
      screen.getByText("No earlier attendance for this child."),
    ).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });
  it("handles native Back like Cancel without writing", () => {
    const onClose = jest.fn();
    const save = jest.spyOn(apiClient, "upsertHomeschoolAttendance");
    render(<AttendanceDayModal {...base} onClose={onClose} />);
    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it("stops a partial batch when edit permission is revoked", async () => {
    let resolve!: (record: HomeschoolAttendance) => void;
    const save = jest
      .spyOn(apiClient, "upsertHomeschoolAttendance")
      .mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
    const grant = {
      key: "homeschool" as const,
      name: "Homeschool",
      description: "School",
      can_manage: true,
      can_view: true,
    };
    const view = render(
      <ModuleAccessProvider module={grant}>
        <AttendanceDayModal {...base} />
      </ModuleAccessProvider>,
    );
    fireEvent.press(screen.getByText("Copy previous day"));
    fireEvent.press(screen.getByText("Save Attendance"));
    view.rerender(
      <ModuleAccessProvider module={{ ...grant, can_manage: false }}>
        <AttendanceDayModal {...base} />
      </ModuleAccessProvider>,
    );
    await act(async () => {
      resolve(record(1));
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Attendance saved.")).toBeNull();
    expect(screen.getByText(/Your account or permission changed/)).toBeTruthy();
  });

  it("does not let an old success timer close a reopened editor", async () => {
    jest.useFakeTimers();
    jest
      .spyOn(apiClient, "upsertHomeschoolAttendance")
      .mockResolvedValue(record(1));
    const oldClose = jest.fn();
    const newClose = jest.fn();
    const view = render(
      <View>
        <AttendanceDayModal
          {...base}
          key="old"
          records={[record(1)]}
          onClose={oldClose}
        />
      </View>,
    );
    fireEvent.press(screen.getByText("Copy previous day"));
    fireEvent.press(screen.getByText("Save Attendance"));
    await act(async () => {});
    view.rerender(
      <View>
        <AttendanceDayModal
          {...base}
          key="new"
          childId={4}
          childName="Alex"
          onClose={newClose}
        />
      </View>,
    );
    act(() => jest.advanceTimersByTime(3000));
    expect(oldClose).not.toHaveBeenCalled();
    expect(newClose).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Math comment")).toBeNull();
  });
});
