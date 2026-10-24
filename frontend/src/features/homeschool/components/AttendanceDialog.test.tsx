import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiClient } from "../../../api";
import { AttendanceDialog } from "./AttendanceDialog";

const subjects = [
  { id: 1, household_id: 7, name: "Math", color: "#1d4ed8", active: true },
  { id: 2, household_id: 7, name: "Art", color: "#7e22ce", active: true },
];
const records = subjects.map((subject) => ({ id: subject.id, household_id: 7, child_id: 4, subject_id: subject.id, date: "2026-08-27", present: subject.id === 1, comment: `${subject.name} notes` }));
const props = { householdId: 7, childId: 4, childName: "Maya", date: "2026-09-01", subjects, records, onClose: vi.fn(), onSaved: vi.fn().mockResolvedValue(undefined) };

describe("attendance dialog", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); props.onClose.mockClear(); props.onSaved.mockClear(); });
  it("loads all previous subjects and exact values without saving", () => {
    const save = vi.spyOn(apiClient, "upsertHomeschoolAttendance");
    render(<AttendanceDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy previous day" }));
    expect(screen.getByLabelText("Select Math")).toBeChecked();
    expect(screen.getByLabelText("Select Art")).toBeChecked();
    expect(screen.getByLabelText("Art present")).not.toBeChecked();
    expect(screen.getByLabelText("Art comment")).toHaveValue("Art notes");
    expect(screen.getByText(/Copied 2026-08-27/)).toBeVisible();
    expect(save).not.toHaveBeenCalled();
  });
  it("reports partial saves and retries only failed unchanged rows", async () => {
    const save = vi.spyOn(apiClient, "upsertHomeschoolAttendance").mockResolvedValueOnce(records[0]).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(records[1]);
    render(<AttendanceDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy previous day" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Attendance" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("1 subject saved; 1 could not be saved");
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save Attendance" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Attendance saved"));
    expect(save).toHaveBeenCalledTimes(3);
    expect(save.mock.calls[2][0]).toMatchObject({ subject_id: 2, present: false, comment: "Art notes", date: "2026-09-01", child_id: 4, household_id: 7 });
  });
  it("locks repeated saves/cancel while pending and closes after showing inline success", async () => {
    let finish!: (value: typeof records[0]) => void;
    const save = vi.spyOn(apiClient, "upsertHomeschoolAttendance").mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<AttendanceDialog {...props} />);
    fireEvent.click(screen.getByLabelText("Select Math"));
    const button = screen.getByRole("button", { name: "Save Attendance" });
    fireEvent.click(button); fireEvent.click(button);
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(props.onClose).not.toHaveBeenCalled();
    vi.useFakeTimers();
    await act(async () => finish(records[0]));
    expect(screen.getByRole("status")).toHaveTextContent("Attendance saved");
    expect(props.onClose).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(2500));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
  it("does not let an old save or success timer close a new editor", async () => {
    vi.spyOn(apiClient, "upsertHomeschoolAttendance").mockResolvedValue(records[0]);
    const first = render(<AttendanceDialog {...props} />);
    fireEvent.click(screen.getByLabelText("Select Math"));
    fireEvent.click(screen.getByRole("button", { name: "Save Attendance" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Attendance saved"));
    first.unmount(); vi.useFakeTimers();
    render(<AttendanceDialog {...props} date="2026-09-02" />);
    await act(async () => vi.advanceTimersByTime(3000));
    expect(props.onClose).not.toHaveBeenCalled();
  });
  it("names unavailable copied subjects instead of silently dropping them", () => {
    render(<AttendanceDialog {...props} subjects={[subjects[0]]} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy previous day" }));
    expect(screen.getByText(/Not copied \(unavailable\): Subject 2/)).toBeVisible();
    expect(screen.queryByLabelText("Select Art")).not.toBeInTheDocument();
  });
  it("includes inactive historical subjects with their status and copied values", () => {
    render(<AttendanceDialog {...props} subjects={[subjects[0], { ...subjects[1], active: false }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy previous day" }));
    expect(screen.getByLabelText("Select Art (inactive)")).toBeChecked();
    expect(screen.getByLabelText("Art present")).not.toBeChecked();
    expect(screen.getByLabelText("Art comment")).toHaveValue("Art notes");
  });
  it("keeps known saved rows after a refresh failure without writing them twice", async () => {
    const save = vi.spyOn(apiClient, "upsertHomeschoolAttendance").mockResolvedValue(records[0]);
    const onSaved = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<AttendanceDialog {...props} onSaved={onSaved} />);
    fireEvent.click(screen.getByLabelText("Select Math"));
    fireEvent.click(screen.getByRole("button", { name: "Save Attendance" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Saved changes have not been rolled back");
    fireEvent.click(screen.getByRole("button", { name: "Save Attendance" }));
    expect(await screen.findByText("Attendance saved. Closing shortly…")).toBeVisible();
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("refreshes and releases the parent lock even when Back unmounts a pending dialog", async () => {
    let finish!: (value: typeof records[0]) => void;
    vi.spyOn(apiClient, "upsertHomeschoolAttendance").mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const onSavingChange = vi.fn();
    const { unmount } = render(<AttendanceDialog {...props} onSavingChange={onSavingChange} />);
    fireEvent.click(screen.getByLabelText("Select Math"));
    fireEvent.click(screen.getByRole("button", { name: "Save Attendance" }));
    unmount();
    await act(async () => finish(records[0]));
    expect(props.onSaved).toHaveBeenCalledOnce();
    expect(onSavingChange.mock.calls).toEqual([[true], [false]]);
    expect(props.onClose).not.toHaveBeenCalled();
  });
  it("keeps a Back/Forward reopened dialog locked until the previous save reloads", () => {
    const save = vi.spyOn(apiClient, "upsertHomeschoolAttendance");
    const { rerender } = render(<AttendanceDialog {...props} records={[]} externallySaving />);
    expect(screen.getByRole("button", { name: "Save Attendance" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy previous day" })).toBeDisabled();
    rerender(<AttendanceDialog {...props} records={[{ ...records[0], date: props.date, comment: "Just saved" }]} externallySaving={false} />);
    expect(screen.getByLabelText("Select Math")).toBeChecked();
    expect(screen.getByLabelText("Math comment")).toHaveValue("Just saved");
    expect(save).not.toHaveBeenCalled();
  });
  it("traps keyboard focus, dismisses on Escape and restores the day trigger", () => {
    const trigger = document.createElement("button"); document.body.append(trigger); trigger.focus();
    const { unmount } = render(<AttendanceDialog {...props} />);
    const close = screen.getByRole("button", { name: "Close attendance editor" });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true }); expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: "Tab" }); expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Escape" }); expect(props.onClose).toHaveBeenCalledOnce();
    unmount(); expect(trigger).toHaveFocus(); trigger.remove();
  });
  it("retains acknowledged saves after Back/Forward even if the refresh fails", async () => {
    let finish!: (value: typeof records[0]) => void;
    vi.spyOn(apiClient, "upsertHomeschoolAttendance").mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    function Harness() {
      const [shown, setShown] = useState(true);
      const [generation, setGeneration] = useState(0);
      const [busy, setBusy] = useState(false);
      const [savedRecords, setSavedRecords] = useState<typeof records>([]);
      return <>
        <button onClick={() => { setShown(false); }}>Back</button>
        <button onClick={() => { setGeneration((value) => value + 1); setShown(true); }}>Forward</button>
        {shown ? <AttendanceDialog {...props} key={generation} records={savedRecords} externallySaving={busy} onSavingChange={setBusy} onRecordSaved={(record) => setSavedRecords([record])} onSaved={async () => false} /> : null}
      </>;
    }
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Select Math"));
    fireEvent.change(screen.getByLabelText("Math comment"), { target: { value: "Confirmed work" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Attendance" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(screen.getByRole("button", { name: "Save Attendance" })).toBeDisabled();
    await act(async () => finish({ ...records[0], date: props.date, comment: "Confirmed work" }));
    expect(screen.getByLabelText("Select Math")).toBeChecked();
    expect(screen.getByLabelText("Math comment")).toHaveValue("Confirmed work");
    expect(props.onClose).not.toHaveBeenCalled();
  });
  it("initializes a subject arriving after refresh with complete attendance defaults", () => {
    const { rerender } = render(<AttendanceDialog {...props} subjects={[subjects[0]]} />);
    rerender(<AttendanceDialog {...props} />);
    fireEvent.click(screen.getByLabelText("Select Art"));
    expect(screen.getByLabelText("Art present")).toBeChecked();
    expect(screen.getByLabelText("Art comment")).toHaveValue("");
  });
  it("has an explicit no-history result and cancels without writes", () => {
    const save = vi.spyOn(apiClient, "upsertHomeschoolAttendance");
    render(<AttendanceDialog {...props} records={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy previous day" }));
    expect(screen.getByText(/No earlier attendance/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled();
  });
});
