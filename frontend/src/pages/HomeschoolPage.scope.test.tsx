import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { apiClient } from "../api";
import { useAuth } from "../auth/useAuth";
import { HomeschoolPage } from "./HomeschoolPage";

vi.mock("../auth/useAuth", () => ({ useAuth: vi.fn() }));
const context = (household: number) => ({ status: "authenticated" as const, user: { id: household, household_id: household, email: "parent@example.test", role: "PARENT" as const, is_household_owner: false, child_id: null }, moduleKeys: ["homeschool"], manageableModuleKeys: ["homeschool"], setAuthenticatedSession: vi.fn(), refreshModuleAccess: vi.fn(), clearSession: vi.fn(), logout: vi.fn() });
const subject = (id: number) => ({ id, household_id: id, name: `Subject ${id}`, color: "#1d4ed8", active: true });
const semester = (id: number) => ({ id, household_id: id, name: `Semester ${id}`, start_date: "2026-09-01", end_date: "2026-12-31", active: true });
function mockData() {
  vi.mocked(useAuth).mockReturnValue(context(1));
  vi.spyOn(apiClient, "listChildren").mockImplementation(async ({ household_id }) => [{ id: household_id!, household_id: household_id!, name: household_id === 1 ? "Maya" : "Bea", active: true }]);
  vi.spyOn(apiClient, "listHomeschoolSubjects").mockImplementation(async (id) => [subject(id)]);
  vi.spyOn(apiClient, "listHomeschoolSemesters").mockImplementation(async (id) => [semester(id)]);
  vi.spyOn(apiClient, "listHomeschoolAttendance").mockResolvedValue([]);
  vi.spyOn(apiClient, "listHomeschoolDayComments").mockResolvedValue([]);
  vi.spyOn(apiClient, "listHomeschoolGrades").mockResolvedValue([]);
}
const page = <MemoryRouter><HomeschoolPage /></MemoryRouter>;
describe("Homeschool scoped selections", () => {
  afterEach(() => vi.restoreAllMocks());
  it("clears old drafts/editor and chooses valid IDs after household replacement", async () => {
    mockData();
    const { rerender } = render(page);
    await screen.findByText("Children: Maya");
    fireEvent.click(within(screen.getByRole("list", { name: "Subject entries" })).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Subject Name"), { target: { value: "Private old draft" } });
    fireEvent.click(screen.getByRole("button", { name: "2026-09-02, no attendance recorded" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    vi.mocked(useAuth).mockReturnValue(context(2));
    rerender(<MemoryRouter><HomeschoolPage /></MemoryRouter>);
    await screen.findByText("Children: Bea");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Subject Name")).toHaveValue("");
    expect(screen.getByLabelText("Report semester")).toHaveValue("2");
    const calendar = screen.getByRole("heading", { name: "Attendance Calendar" }).closest("article")!;
    expect(within(calendar).getByLabelText("Child")).toHaveValue("2");
    const grade = screen.getByRole("heading", { name: "Subject Grade" }).closest("article")!;
    expect(within(grade).getByLabelText("Subject")).toHaveValue("2");
    expect(within(grade).getByLabelText("Semester")).toHaveValue("2");
  });
  it("reconciles deleted subject and semester selections to remaining records", async () => {
    mockData();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(apiClient, "deleteHomeschoolSubject").mockResolvedValue(undefined);
    vi.spyOn(apiClient, "deleteHomeschoolSemester").mockResolvedValue(undefined);
    render(page);
    await screen.findByText("Children: Maya");
    vi.mocked(apiClient.listHomeschoolSubjects).mockResolvedValue([{ ...subject(3), household_id: 1 }]);
    fireEvent.click(within(screen.getByRole("list", { name: "Subject entries" })).getByRole("button", { name: "Delete" }));
    const grade = screen.getByRole("heading", { name: "Subject Grade" }).closest("article")!;
    await waitFor(() => expect(within(grade).getByLabelText("Subject")).toHaveValue("3"));
    vi.mocked(apiClient.listHomeschoolSemesters).mockResolvedValue([{ ...semester(3), household_id: 1 }]);
    fireEvent.click(within(screen.getByRole("list", { name: "Semester entries" })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByLabelText("Report semester")).toHaveValue("3"));
    expect(within(grade).getByLabelText("Semester")).toHaveValue("3");
  });
});
