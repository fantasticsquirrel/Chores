import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { apiClient } from "../../api/client";
import type { AuthSessionResponse, FamilyModule } from "../../api/models";
import { HomeschoolScreen } from "./HomeschoolScreen";

const session: AuthSessionResponse = {
  csrf_token: "mobile-csrf",
  user: {
    child_id: null,
    email: "parent@example.com",
    household_id: 7,
    id: 2,
    is_household_owner: true,
    role: "PARENT",
  },
};
const modules: FamilyModule[] = [
  {
    description: "School records and reporting.",
    key: "homeschool",
    name: "Homeschool",
  },
];

function arrangeEmptyLoad() {
  jest.spyOn(apiClient, "listChildren").mockResolvedValue([]);
  jest.spyOn(apiClient, "listHomeschoolSemesters").mockResolvedValue([]);
  jest.spyOn(apiClient, "listHomeschoolSubjects").mockResolvedValue([]);
  jest.spyOn(apiClient, "listHomeschoolAttendance").mockResolvedValue([]);
  jest.spyOn(apiClient, "listHomeschoolDayComments").mockResolvedValue([]);
  jest.spyOn(apiClient, "listHomeschoolGrades").mockResolvedValue([]);
}

describe("HomeschoolScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps role and module gating at the screen boundary", () => {
    const listChildren = jest.spyOn(apiClient, "listChildren");

    render(<HomeschoolScreen modules={[]} session={session} />);

    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(
      screen.getByText("Homeschool is not enabled for this account."),
    ).toBeTruthy();
    expect(listChildren).not.toHaveBeenCalled();
  });

  it("does not treat a child session as homeschool module access", () => {
    const listChildren = jest.spyOn(apiClient, "listChildren");
    const childSession: AuthSessionResponse = {
      ...session,
      user: {
        ...session.user,
        child_id: 3,
        is_household_owner: false,
        role: "CHILD",
      },
    };

    render(<HomeschoolScreen modules={modules} session={childSession} />);

    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(listChildren).not.toHaveBeenCalled();
  });

  it("preserves section navigation and setup card order", async () => {
    arrangeEmptyLoad();

    render(<HomeschoolScreen modules={modules} session={session} />);

    expect(await screen.findByText("Selected Child")).toBeTruthy();
    fireEvent.press(screen.getByText("Setup"));
    const headings = screen
      .getAllByText(/New Semester|New Subject|Semesters|Subjects/)
      .map((node) => node.props.children);
    expect(headings).toEqual([
      "New Semester",
      "New Subject",
      "Semesters",
      "Subjects",
    ]);
    fireEvent.press(screen.getByText("Attend"));
    expect(screen.getByText("Attendance Entry")).toBeTruthy();
    fireEvent.press(screen.getByText("Notes"));
    expect(screen.getByText("Day Comment")).toBeTruthy();
    fireEvent.press(screen.getByText("Grades"));
    expect(screen.getByText("Grade Entry")).toBeTruthy();
  });

  it("preserves the homeschool load error state", async () => {
    arrangeEmptyLoad();
    jest
      .spyOn(apiClient, "listChildren")
      .mockRejectedValue(new Error("network unavailable"));

    render(<HomeschoolScreen modules={modules} session={session} />);

    expect(
      await screen.findByText(
        "Could not load homeschool data: network unavailable",
      ),
    ).toBeTruthy();
  });
});
