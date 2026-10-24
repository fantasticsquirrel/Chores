import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { apiClient } from "../../../api/client";
import { SemesterReportExport } from "./SemesterReportExport";
import { shareSemesterReport } from "../lib/shareSemesterReport";
import type { BinaryDownload } from "@family-manager/family-api/client-core";
jest.mock("../lib/shareSemesterReport", () => ({
  shareSemesterReport: jest.fn(),
}));
const pdf: BinaryDownload = {
  bytes: new ArrayBuffer(8),
  content_type: "application/pdf",
  filename: "report.pdf",
};
describe("SemesterReportExport", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it("defaults to no notes and exports only the selected household child and semester", async () => {
    const download = jest
      .spyOn(apiClient, "downloadHomeschoolSemesterReport")
      .mockResolvedValue(pdf);
    jest.mocked(shareSemesterReport).mockResolvedValue();
    render(<SemesterReportExport householdId={7} childId={3} semesterId={4} />);
    expect(
      screen.getByLabelText("Include notes in semester PDF").props.value,
    ).toBe(false);
    fireEvent.press(screen.getByText("Export semester PDF"));
    await waitFor(() => expect(shareSemesterReport).toHaveBeenCalled());
    expect(download).toHaveBeenCalledWith({
      household_id: 7,
      child_id: 3,
      semester_id: 4,
      include_notes: false,
    });
  });
  it("includes notes only when selected and suppresses stale responses after selection changes", async () => {
    let resolve!: (download: BinaryDownload) => void;
    const download = jest
      .spyOn(apiClient, "downloadHomeschoolSemesterReport")
      .mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
    const view = render(
      <SemesterReportExport householdId={7} childId={3} semesterId={4} />,
    );
    fireEvent(
      screen.getByLabelText("Include notes in semester PDF"),
      "valueChange",
      true,
    );
    fireEvent.press(screen.getByText("Export semester PDF"));
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ include_notes: true }),
    );
    view.rerender(
      <SemesterReportExport householdId={7} childId={5} semesterId={4} />,
    );
    await act(async () => {
      resolve(pdf);
    });
    expect(shareSemesterReport).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText("Include notes in semester PDF").props.value,
    ).toBe(false);
  });
});
