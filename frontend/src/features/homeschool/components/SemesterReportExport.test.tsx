import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiClient } from "../../../api";
import { downloadSemesterPdf } from "../lib/downloadReport";
import { SemesterReportExport } from "./SemesterReportExport";

vi.mock("../lib/downloadReport", () => ({ downloadSemesterPdf: vi.fn() }));
const report = { bytes: new ArrayBuffer(8), content_type: "application/pdf", filename: null };
describe("semester PDF export", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.mocked(downloadSemesterPdf).mockClear(); });
  it("defaults to no notes and downloads only the explicitly selected scope", async () => {
    const download = vi.spyOn(apiClient, "downloadHomeschoolSemesterReport").mockResolvedValue(report);
    render(<SemesterReportExport householdId={7} semesterId={10} childId={4} />);
    expect(screen.getByLabelText("Include attendance and day notes")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Export Semester PDF" }));
    await waitFor(() => expect(downloadSemesterPdf).toHaveBeenCalledWith(report, 10, 4));
    expect(download).toHaveBeenCalledWith({ household_id: 7, semester_id: 10, child_id: 4, include_notes: false }, { signal: expect.any(AbortSignal) });
    expect(screen.getByRole("status")).toHaveTextContent("Semester PDF downloaded");
  });
  it("includes notes only when requested and reports failed exports without success", async () => {
    const download = vi.spyOn(apiClient, "downloadHomeschoolSemesterReport").mockRejectedValue(new Error("Unavailable"));
    render(<SemesterReportExport householdId={7} semesterId={10} childId={4} />);
    fireEvent.click(screen.getByLabelText("Include attendance and day notes"));
    fireEvent.click(screen.getByRole("button", { name: "Export Semester PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unavailable");
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ include_notes: true }), expect.anything());
    expect(downloadSemesterPdf).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("prevents duplicate exports and ignores downloads after scope changes/unmount", async () => {
    let finish!: (value: typeof report) => void;
    const download = vi.spyOn(apiClient, "downloadHomeschoolSemesterReport").mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { unmount } = render(<SemesterReportExport householdId={7} semesterId={10} childId={4} />);
    const button = screen.getByRole("button", { name: "Export Semester PDF" });
    fireEvent.click(button); fireEvent.click(button);
    expect(download).toHaveBeenCalledOnce();
    unmount(); await act(async () => finish(report));
    expect(downloadSemesterPdf).not.toHaveBeenCalled();
  });
});
