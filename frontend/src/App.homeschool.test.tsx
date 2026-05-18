import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "./App";
import { ApiClientError, apiClient } from "./api";

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
    expect(screen.getByRole("heading", { name: "Setup & Records" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Calendar & Progress" })).toBeVisible();
    expect(screen.getByText("Subjects: 1")).toBeVisible();
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


  it("edits existing semester and subject setup records", async () => {
    mockHomeschoolApi();
    const updateSemesterSpy = vi.spyOn(apiClient, "updateHomeschoolSemester").mockResolvedValue({
      id: 10,
      household_id: 1,
      name: "Spring 2027",
      start_date: "2027-01-10",
      end_date: "2027-05-20",
      active: true,
    });
    const updateSubjectSpy = vi.spyOn(apiClient, "updateHomeschoolSubject").mockResolvedValue({
      id: 20,
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

    const semesterList = await screen.findByRole("list", { name: "Semester entries" });
    fireEvent.click(within(semesterList).getByRole("button", { name: "Edit" }));
    const semesterPanel = screen.getByRole("heading", { name: "Edit Semester" }).closest("article");
    expect(semesterPanel).not.toBeNull();
    fireEvent.change(within(semesterPanel as HTMLElement).getByLabelText("Semester Name"), { target: { value: "Spring 2027" } });
    fireEvent.change(within(semesterPanel as HTMLElement).getByLabelText("Start Date"), { target: { value: "2027-01-10" } });
    fireEvent.change(within(semesterPanel as HTMLElement).getByLabelText("End Date"), { target: { value: "2027-05-20" } });
    fireEvent.click(within(semesterPanel as HTMLElement).getByRole("button", { name: "Update Semester" }));

    await waitFor(() => expect(updateSemesterSpy).toHaveBeenCalledWith(10, {
      household_id: 1,
      name: "Spring 2027",
      start_date: "2027-01-10",
      end_date: "2027-05-20",
    }));

    const subjectList = await screen.findByRole("list", { name: "Subject entries" });
    fireEvent.click(within(subjectList).getByRole("button", { name: "Edit" }));
    const subjectPanel = screen.getByRole("heading", { name: "Edit Subject" }).closest("article");
    expect(subjectPanel).not.toBeNull();
    fireEvent.change(within(subjectPanel as HTMLElement).getByLabelText("Subject Name"), { target: { value: "Reading" } });
    fireEvent.change(within(subjectPanel as HTMLElement).getByLabelText("Color"), { target: { value: "#3b82f6" } });
    fireEvent.click(within(subjectPanel as HTMLElement).getByRole("button", { name: "Update Subject" }));

    await waitFor(() => expect(updateSubjectSpy).toHaveBeenCalledWith(20, {
      household_id: 1,
      name: "Reading",
      color: "#3b82f6",
    }));
  });


  it("clears an existing attendance entry", async () => {
    mockHomeschoolApi();
    vi.spyOn(window, "confirm").mockReturnValue(true);
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

  it("clears an existing day comment", async () => {
    mockHomeschoolApi();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteSpy = vi.spyOn(apiClient, "deleteHomeschoolDayComment").mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/homeschool"]}>
        <App />
      </MemoryRouter>,
    );

    const comments = await screen.findByRole("list", { name: "Day comments" });
    expect(within(comments).getByText("Good focus")).toBeVisible();
    fireEvent.click(within(comments).getByRole("button", { name: "Clear" }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(40, 1));
    expect(await screen.findByText("Cleared day comment.")).toBeVisible();
  });

  it("clears an existing grade", async () => {
    mockHomeschoolApi();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteSpy = vi.spyOn(apiClient, "deleteHomeschoolGrade").mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/homeschool"]}>
        <App />
      </MemoryRouter>,
    );

    const gradesList = await screen.findByRole("list", { name: "Grade entries" });
    expect(within(gradesList).getByText("Math: A")).toBeVisible();
    fireEvent.click(within(gradesList).getByRole("button", { name: "Clear" }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(50, 1));
    expect(await screen.findByText("Cleared grade.")).toBeVisible();
  });

  it("deletes an existing semester", async () => {
    mockHomeschoolApi();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteSpy = vi.spyOn(apiClient, "deleteHomeschoolSemester").mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/homeschool"]}>
        <App />
      </MemoryRouter>,
    );

    const semesterList = await screen.findByRole("list", { name: "Semester entries" });
    expect(within(semesterList).getByText("Fall 2026")).toBeVisible();
    fireEvent.click(within(semesterList).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(10, 1));
    expect(await screen.findByText("Deleted semester.")).toBeVisible();
  });

  it("deletes an existing subject", async () => {
    mockHomeschoolApi();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const deleteSpy = vi.spyOn(apiClient, "deleteHomeschoolSubject").mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/homeschool"]}>
        <App />
      </MemoryRouter>,
    );

    const subjectList = await screen.findByRole("list", { name: "Subject entries" });
    expect(within(subjectList).getByText("Math")).toBeVisible();
    fireEvent.click(within(subjectList).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(20, 1));
    expect(await screen.findByText("Deleted subject.")).toBeVisible();
  });

  it("does not clear a grade when confirmation is cancelled", async () => {
    mockHomeschoolApi();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const deleteSpy = vi.spyOn(apiClient, "deleteHomeschoolGrade").mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/homeschool"]}>
        <App />
      </MemoryRouter>,
    );

    const gradesList = await screen.findByRole("list", { name: "Grade entries" });
    fireEvent.click(within(gradesList).getByRole("button", { name: "Clear" }));

    expect(window.confirm).toHaveBeenCalledWith("Clear this grade?");
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("shows setup delete errors from the backend", async () => {
    mockHomeschoolApi();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(apiClient, "deleteHomeschoolSubject").mockRejectedValue(
      new ApiClientError(400, "Subject has homeschool records. Clear related attendance and grades first.", {
        detail: "Subject has homeschool records. Clear related attendance and grades first.",
      }),
    );

    render(
      <MemoryRouter initialEntries={["/homeschool"]}>
        <App />
      </MemoryRouter>,
    );

    const subjectList = await screen.findByRole("list", { name: "Subject entries" });
    fireEvent.click(within(subjectList).getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Homeschool action failed: Subject has homeschool records. Clear related attendance and grades first.",
    );
  });

});
