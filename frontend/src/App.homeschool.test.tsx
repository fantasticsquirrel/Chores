import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { apiClient } from "./api";

const children = [{ id: 1, household_id: 1, name: "Maya", active: true }];
const semesters = [{ id: 10, household_id: 1, name: "Fall 2026", start_date: "2026-08-15", end_date: "2026-12-20", active: true }];
const subjects = [{ id: 20, household_id: 1, name: "Math", color: "#ef4444", active: true }];
const attendanceRecords = [{ id: 30, household_id: 1, child_id: 1, subject_id: 20, date: "2026-09-01", present: true, comment: "Fractions" }];
const dayComments = [{ id: 40, household_id: 1, child_id: 1, date: "2026-09-01", comment: "Good focus" }];
const grades = [{ id: 50, household_id: 1, child_id: 1, subject_id: 20, semester_id: 10, grade: "A" }];

function mockHomeschoolApi(): void {
  vi.spyOn(apiClient, "getMyModules").mockResolvedValue({
    modules: [
      { key: "chores", name: "Chores", description: "" },
      { key: "homeschool", name: "Homeschool", description: "" },
    ],
  });
  vi.spyOn(apiClient, "listChildren").mockResolvedValue(children);
  vi.spyOn(apiClient, "listHomeschoolSemesters").mockResolvedValue(semesters);
  vi.spyOn(apiClient, "listHomeschoolSubjects").mockResolvedValue(subjects);
  vi.spyOn(apiClient, "listHomeschoolAttendance").mockResolvedValue(attendanceRecords);
  vi.spyOn(apiClient, "listHomeschoolDayComments").mockResolvedValue(dayComments);
  vi.spyOn(apiClient, "listHomeschoolGrades").mockResolvedValue(grades);
}

describe("Homeschool page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads homeschool dashboard data and renders summary/calendar state", async () => {
    mockHomeschoolApi();

    render(
      <MemoryRouter initialEntries={["/homeschool"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Homeschool" })).toBeVisible();
    expect(await screen.findByText("Children: Maya")).toBeVisible();
    expect(screen.getByText("Subjects: Math")).toBeVisible();
    expect(await screen.findByText("Fall 2026 · 2026-08-15 to 2026-12-20")).toBeVisible();
    expect(screen.getByText("Grade: A")).toBeVisible();
    expect(apiClient.listHomeschoolAttendance).toHaveBeenCalledWith(1);
  });

  it("creates semesters and subjects through the Family Manager APIs", async () => {
    mockHomeschoolApi();
    const createSemesterSpy = vi.spyOn(apiClient, "createHomeschoolSemester").mockResolvedValue({
      id: 11,
      household_id: 1,
      name: "Spring 2027",
      start_date: "2027-01-10",
      end_date: "2027-05-20",
      active: true,
    });
    const createSubjectSpy = vi.spyOn(apiClient, "createHomeschoolSubject").mockResolvedValue({
      id: 21,
      household_id: 1,
      name: "Reading",
      color: "#3b82f6",
      active: true,
    });

    render(
      <MemoryRouter initialEntries={["/homeschool"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText("Children: Maya");

    const semesterPanel = screen.getByRole("heading", { name: "Create Semester" }).closest("article");
    expect(semesterPanel).not.toBeNull();
    fireEvent.change(within(semesterPanel as HTMLElement).getByLabelText("Semester Name"), { target: { value: "Spring 2027" } });
    fireEvent.change(within(semesterPanel as HTMLElement).getByLabelText("Start Date"), { target: { value: "2027-01-10" } });
    fireEvent.change(within(semesterPanel as HTMLElement).getByLabelText("End Date"), { target: { value: "2027-05-20" } });
    fireEvent.click(within(semesterPanel as HTMLElement).getByRole("button", { name: "Create Semester" }));

    await waitFor(() => expect(createSemesterSpy).toHaveBeenCalledWith({
      household_id: 1,
      name: "Spring 2027",
      start_date: "2027-01-10",
      end_date: "2027-05-20",
    }));

    const subjectPanel = screen.getByRole("heading", { name: "Create Subject" }).closest("article");
    expect(subjectPanel).not.toBeNull();
    fireEvent.change(within(subjectPanel as HTMLElement).getByLabelText("Subject Name"), { target: { value: "Reading" } });
    fireEvent.change(within(subjectPanel as HTMLElement).getByLabelText("Color"), { target: { value: "#3b82f6" } });
    fireEvent.click(within(subjectPanel as HTMLElement).getByRole("button", { name: "Create Subject" }));

    await waitFor(() => expect(createSubjectSpy).toHaveBeenCalledWith({
      household_id: 1,
      name: "Reading",
      color: "#3b82f6",
    }));
  });

  it("saves attendance, day comments, and grades", async () => {
    mockHomeschoolApi();
    const attendanceSpy = vi.spyOn(apiClient, "upsertHomeschoolAttendance").mockResolvedValue(attendanceRecords[0]);
    const commentSpy = vi.spyOn(apiClient, "upsertHomeschoolDayComment").mockResolvedValue(dayComments[0]);
    const gradeSpy = vi.spyOn(apiClient, "upsertHomeschoolGrade").mockResolvedValue(grades[0]);

    render(
      <MemoryRouter initialEntries={["/homeschool"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText("Children: Maya");

    const attendancePanel = screen.getByRole("heading", { name: "Quick Attendance" }).closest("article");
    expect(attendancePanel).not.toBeNull();
    fireEvent.change(within(attendancePanel as HTMLElement).getByLabelText("Date"), { target: { value: "2026-09-02" } });
    fireEvent.change(within(attendancePanel as HTMLElement).getByLabelText("Comment"), { target: { value: "Decimals" } });
    fireEvent.click(within(attendancePanel as HTMLElement).getByRole("button", { name: "Save Attendance" }));

    await waitFor(() => expect(attendanceSpy).toHaveBeenCalledWith({
      household_id: 1,
      child_id: 1,
      subject_id: 20,
      date: "2026-09-02",
      present: true,
      comment: "Decimals",
    }));

    const commentPanel = screen.getByRole("heading", { name: "Day Comment" }).closest("article");
    expect(commentPanel).not.toBeNull();
    fireEvent.change(within(commentPanel as HTMLElement).getByLabelText("Date"), { target: { value: "2026-09-02" } });
    fireEvent.change(within(commentPanel as HTMLElement).getByLabelText("Comment"), { target: { value: "Field trip" } });
    fireEvent.click(within(commentPanel as HTMLElement).getByRole("button", { name: "Save Comment" }));

    await waitFor(() => expect(commentSpy).toHaveBeenCalledWith({
      household_id: 1,
      child_id: 1,
      date: "2026-09-02",
      comment: "Field trip",
    }));

    const gradePanel = screen.getByRole("heading", { name: "Subject Grade" }).closest("article");
    expect(gradePanel).not.toBeNull();
    fireEvent.change(within(gradePanel as HTMLElement).getByLabelText("Grade"), { target: { value: "A+" } });
    fireEvent.click(within(gradePanel as HTMLElement).getByRole("button", { name: "Save Grade" }));

    await waitFor(() => expect(gradeSpy).toHaveBeenCalledWith({
      household_id: 1,
      child_id: 1,
      subject_id: 20,
      semester_id: 10,
      grade: "A+",
    }));
  });


  it("clears an existing attendance entry", async () => {
    mockHomeschoolApi();
    const deleteSpy = vi.spyOn(apiClient, "deleteHomeschoolAttendance").mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/homeschool"]}>
        <App />
      </MemoryRouter>,
    );

    const attendanceEntries = await screen.findByRole("list", { name: "Attendance entries" });
    expect(within(attendanceEntries).getByText("2026-09-01 · Math")).toBeVisible();
    fireEvent.click(within(attendanceEntries).getByRole("button", { name: "Clear" }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(30, 1));
    expect(await screen.findByText("Cleared attendance entry.")).toBeVisible();
  });

});
