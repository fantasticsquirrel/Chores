import { render, screen } from "@testing-library/react";

import { AttendanceCalendar } from "./AttendanceCalendar";

const commonProps = {
  saving: false,
  canManage: true,
  calendarYearMonth: "2026-09",
  calendarChildId: "1",
  children: [{ id: 1, household_id: 7, name: "Maya", active: true }],
  selectedChildComments: [],
  selectedDate: null,
  onMonthChange: vi.fn(),
  onChildChange: vi.fn(),
  onDaySelect: vi.fn(),
  onClearAttendance: vi.fn(),
  onClearDayComment: vi.fn(),
};

it("renders solid subject circles with maximal black-or-white text contrast", () => {
  render(
    <AttendanceCalendar
      {...commonProps}
      subjects={[
        {
          id: 10,
          household_id: 7,
          name: "Night",
          color: "#000000",
          active: true,
        },
        {
          id: 11,
          household_id: 7,
          name: "Light",
          color: "#ffffff",
          active: true,
        },
      ]}
      selectedChildAttendance={[
        {
          id: 20,
          household_id: 7,
          child_id: 1,
          subject_id: 10,
          date: "2026-09-01",
          present: true,
          comment: "",
        },
        {
          id: 21,
          household_id: 7,
          child_id: 1,
          subject_id: 11,
          date: "2026-09-01",
          present: true,
          comment: "",
        },
      ]}
    />,
  );

  expect(screen.getByTitle("Night: Present")).toHaveStyle({
    backgroundColor: "#000000",
    color: "#ffffff",
  });
  expect(screen.getByTitle("Light: Present")).toHaveStyle({
    backgroundColor: "#ffffff",
    color: "#000000",
  });
});

it("uses the shared compact select for the child calendar filter", () => {
  render(
    <AttendanceCalendar
      {...commonProps}
      subjects={[]}
      selectedChildAttendance={[]}
    />,
  );

  expect(screen.getByRole("combobox", { name: "Child" })).toHaveClass(
    "ui-control",
    "ui-select",
    "ui-control--compact",
  );
});
