import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { Alert } from "react-native";

import { apiClient } from "../../api/client";
import type { AuthSessionResponse, Child, Chore, FamilyModule } from "../../api/models";
import { useChildMutations } from "../../features/children/hooks/useChildMutations";
import { useChildAccountActions } from "../../features/children/hooks/useChildAccountActions";
import { useChoreMutations } from "../../features/chores/hooks/useChoreMutations";
import { useChoreFinance } from "../../features/finance/hooks/useChoreFinance";
import { useHomeschoolMutations } from "../../features/homeschool/hooks/useHomeschoolMutations";
import { ModuleAccessProvider } from "../../modules/ModuleAccessContext";
import { ActionButton } from "../../components/ActionButton";
import { ChoreForm } from "../../features/chores/components/ChoreForm";
import { AdminScreen } from "../admin/AdminScreen";
import { ChildTodayScreen } from "../child/ChildTodayScreen";
import { HomeschoolScreen } from "../homeschool/HomeschoolScreen";
import { ChildrenScreen } from "./ChildrenScreen";
import { ChoresScreen } from "./ChoresScreen";
import { MoneyScreen } from "./MoneyScreen";
import { ParentReviewScreen } from "./ReviewScreen";

const session: AuthSessionResponse = {
  csrf_token: "test", user: { id: 2, household_id: 7, email: "parent@example.com", role: "PARENT", child_id: null, is_household_owner: true },
};
const child: Child = { id: 3, household_id: 7, active: true, name: "Mia" };
const chore: Chore = {
  id: 11, household_id: 7, name: "Laundry", reward_cents: 100, reward_dollars: 1,
  archived_at: null, is_active: true, owner_user_id: null, start_date: "2026-09-01", expires_at: null,
  timeout_days: null, schedule_mode: "NONE", schedule_interval: null, schedule_unit: null,
  completion_mode: "PER_CHILD", assignment_mode: "STATIC", allowed_child_ids: [3], rotation_order: [],
};
const eligible = { chore_id: 11, name: "Laundry", reward_cents: 100, occurrence_date: "2026-09-01", expires_on: null };
const grant: FamilyModule = { key: "chores", name: "Chores", description: "Chores", can_manage: false };
function wrap(children: React.ReactNode, canManage = false) {
  return <ModuleAccessProvider module={{ ...grant, can_manage: canManage }}>{children}</ModuleAccessProvider>;
}
function directPress(view: ReturnType<typeof render>, label: string) {
  return view.UNSAFE_getAllByType(ActionButton).find((node) => node.props.label === label)!.props.onPress;
}
function revocableWrapper() {
  let canManage = true;
  return {
    revoke: () => { canManage = false; },
    wrapper: ({ children }: PropsWithChildren) => wrap(children, canManage),
  };
}
function arrangeChores() {
  jest.spyOn(apiClient, "listChildren").mockResolvedValue([child]);
  jest.spyOn(apiClient, "listChores").mockResolvedValue([chore]);
  jest.spyOn(apiClient, "listMyParentTasks").mockResolvedValue([{ ...chore, name: "Call plumber", owner_user_id: 2 }]);
  jest.spyOn(apiClient, "listEligibleChores").mockResolvedValue([eligible]);
}

const schoolModule: FamilyModule = { ...grant, key: "homeschool", name: "Homeschool" };
const semester = { id: 4, household_id: 7, name: "Fall", active: true, start_date: "2026-09-01", end_date: "2026-09-30" };
const subject = { id: 5, household_id: 7, name: "Math", color: "#3b82f6", active: true };
const attendance = { id: 6, household_id: 7, child_id: 3, subject_id: 5, date: "2026-09-05", present: true, comment: "Fractions" };
const comment = { id: 8, household_id: 7, child_id: 3, date: "2026-09-05", comment: "Library day" };
const grade = { id: 9, household_id: 7, child_id: 3, subject_id: 5, semester_id: 4, grade: "A" };
const schoolChildren = [child];
const schoolSemesters = [semester];
const schoolSubjects = [subject];
const schoolComments = [comment];
function arrangeSchool() {
  jest.spyOn(apiClient, "listChildren").mockResolvedValue(schoolChildren);
  jest.spyOn(apiClient, "listHomeschoolSemesters").mockResolvedValue(schoolSemesters);
  jest.spyOn(apiClient, "listHomeschoolSubjects").mockResolvedValue(schoolSubjects);
  jest.spyOn(apiClient, "listHomeschoolAttendance").mockResolvedValue([attendance]);
  jest.spyOn(apiClient, "listHomeschoolDayComments").mockResolvedValue(schoolComments);
  jest.spyOn(apiClient, "listHomeschoolGrades").mockResolvedValue([grade]);
}

describe("native module view-only permissions", () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it("keeps homeschool sections and calendar browseable but disables record/setup writes", async () => {
    arrangeSchool();
    render(<ModuleAccessProvider module={schoolModule}><HomeschoolScreen modules={[schoolModule]} session={session} /></ModuleAccessProvider>);
    await screen.findByText("Fall");
    for (const [section, labels] of [
      ["Setup", ["Create", "Edit", "Delete"]],
      ["Attend", ["Save Attendance", "Edit", "Delete"]],
      ["Notes", ["Save Comment", "Edit", "Delete"]],
      ["Grades", ["Save Grade", "Edit", "Delete"]],
    ] as const) {
      fireEvent.press(screen.getByRole("button", { name: section }));
      for (const label of labels) {
        for (const button of screen.getAllByRole("button", { name: label })) expect(button).toBeDisabled();
      }
    }
    fireEvent.press(screen.getByRole("button", { name: "Calendar" }));
    expect(screen.getByRole("button", { name: "Log Attendance" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Note" })).toBeDisabled();
    for (const label of ["Previous", "Next", "Today", "Refresh"]) expect(screen.getByRole("button", { name: label })).toBeEnabled();
  });

  it("rejects all retained homeschool saves and native delete confirmations after revocation", async () => {
    const writes = [
      jest.spyOn(apiClient, "createHomeschoolSemester").mockResolvedValue(semester),
      jest.spyOn(apiClient, "updateHomeschoolSemester").mockResolvedValue(semester),
      jest.spyOn(apiClient, "createHomeschoolSubject").mockResolvedValue(subject),
      jest.spyOn(apiClient, "updateHomeschoolSubject").mockResolvedValue(subject),
      jest.spyOn(apiClient, "upsertHomeschoolAttendance").mockResolvedValue(attendance),
      jest.spyOn(apiClient, "upsertHomeschoolDayComment").mockResolvedValue(comment),
      jest.spyOn(apiClient, "upsertHomeschoolGrade").mockResolvedValue(grade),
      jest.spyOn(apiClient, "deleteHomeschoolSemester").mockResolvedValue(undefined),
      jest.spyOn(apiClient, "deleteHomeschoolSubject").mockResolvedValue(undefined),
      jest.spyOn(apiClient, "deleteHomeschoolAttendance").mockResolvedValue(undefined),
      jest.spyOn(apiClient, "deleteHomeschoolDayComment").mockResolvedValue(undefined),
      jest.spyOn(apiClient, "deleteHomeschoolGrade").mockResolvedValue(undefined),
    ];
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const access = revocableWrapper();
    const refresh = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(() => useHomeschoolMutations({
      activeChildren: schoolChildren, householdId: 7, refresh, selectedChildComments: schoolComments,
      selectedChildId: 3, selectedDate: "2026-09-05", semesters: schoolSemesters, subjects: schoolSubjects,
      setCalendarYearMonth: jest.fn(), setSelectedChildId: jest.fn(), setSelectedDate: jest.fn(),
    }), { wrapper: access.wrapper });
    act(() => {
      result.current.editSemester(semester); result.current.editSubject(subject);
      result.current.editAttendance(attendance); result.current.editComment(comment); result.current.editGrade(grade);
      result.current.confirmDeleteSemester(semester); result.current.confirmDeleteSubject(subject);
      result.current.confirmDeleteAttendance(attendance); result.current.confirmDeleteComment(comment); result.current.confirmDeleteGrade(grade);
    });
    const stale = result.current;
    const confirmations = alert.mock.calls.map((call) => call[2]![1].onPress!);
    access.revoke(); rerender({});
    await act(async () => {
      for (const confirm of confirmations) confirm();
      await stale.saveSemester(); await stale.saveSubject(); await stale.saveAttendance(); await stale.saveComment(); await stale.saveGrade();
    });
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps child reads/date/refresh usable and prevents even direct submit dispatch", async () => {
    jest.spyOn(apiClient, "listEligibleChores").mockResolvedValue([eligible]);
    const submit = jest.spyOn(apiClient, "createSubmission");
    const view = render(wrap(<ChildTodayScreen />));
    await screen.findByText("Laundry");
    fireEvent.press(screen.getByText("Select"));
    expect(screen.getByRole("button", { name: "Submit 1" })).toBeDisabled();
    await act(async () => directPress(view, "Submit 1")());
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Today" })).toBeEnabled();
    fireEvent.press(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(apiClient.listEligibleChores).toHaveBeenCalledTimes(2));
  });

  it("keeps the chore board readable while gating setup, archive and submissions", async () => {
    arrangeChores();
    const view = render(wrap(<ChoresScreen session={session} />));
    await screen.findByText("Call plumber");
    fireEvent.press(screen.getByText("Select"));
    for (const label of ["Add", "Edit", "Archive", "Submit", "Submit Selected", "Done"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    expect(view.getAllByText("Laundry")).toHaveLength(3);
  });

  it("gates a chore form left open when manage access is revoked", async () => {
    arrangeChores();
    const save = jest.spyOn(apiClient, "createChore");
    const view = render(wrap(<ChoresScreen session={session} />, true));
    await screen.findByText("Call plumber");
    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    fireEvent.changeText(screen.getByPlaceholderText("Take out trash"), "Kitchen");
    const staleSubmit = view.UNSAFE_getByType(ChoreForm).props.onSubmit;
    view.rerender(wrap(<ChoresScreen session={session} />));
    expect(screen.getByRole("button", { name: "Save Chore" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    await act(async () => staleSubmit());
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps children selectable while gating child and credential changes", async () => {
    jest.spyOn(apiClient, "listChildren").mockResolvedValue([child]);
    render(wrap(<ChildrenScreen session={session} />));
    await screen.findAllByText("Mia");
    for (const label of ["Create Child", "Set Inactive", "Create Login", "Reset Email", "Reset Password"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("allows balance/history browsing but no financial recording", async () => {
    jest.spyOn(apiClient, "listChildBalances").mockResolvedValue([{ child_id: 3, child_name: "Mia", balance_cents: 100 }]);
    jest.spyOn(apiClient, "listChoreTransactions").mockResolvedValue([]);
    const write = jest.spyOn(apiClient, "createChoreTransaction");
    const view = render(wrap(<MoneyScreen />));
    await screen.findByText("Mia");
    expect(screen.getByRole("button", { name: "Record" })).toBeDisabled();
    await act(async () => directPress(view, "Record")());
    expect(write).not.toHaveBeenCalled();
  });

  it("allows review refresh but blocks all review decisions including direct dispatch", async () => {
    jest.spyOn(apiClient, "listSubmissions").mockResolvedValue([{
      id: 20, child_id: 3, child_name: "Mia", for_date: "2026-09-01", status: "PENDING",
      items: [{ id: 21, chore_id: 11, chore_name: "Laundry", chore_reward_cents: 100, status: "PENDING" }],
    }]);
    const approve = jest.spyOn(apiClient, "approveSubmission");
    const decide = jest.spyOn(apiClient, "decideSubmissionItem");
    const view = render(wrap(<ParentReviewScreen />));
    await screen.findByText("Laundry");
    for (const label of ["Approve", "Reject", "Approve all"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
      await act(async () => directPress(view, label)());
    }
    expect(approve).not.toHaveBeenCalled();
    expect(decide).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("gates admin privileges and parent creation while leaving refresh enabled", async () => {
    jest.spyOn(apiClient, "listHouseholdModules").mockResolvedValue([{ key: "chores", name: "Chores", description: "Chores", enabled: true, can_disable: true }]);
    jest.spyOn(apiClient, "listUserModuleAccess").mockResolvedValue([{ id: 2, household_id: 7, email: "parent@example.com", role: "PARENT", child_id: null, modules: [] }]);
    const household = jest.spyOn(apiClient, "setHouseholdModuleAccess");
    const user = jest.spyOn(apiClient, "setUserModuleAccess");
    const parent = jest.spyOn(apiClient, "createParentUser");
    const view = render(wrap(<AdminScreen />));
    await screen.findByText("parent@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("other.parent@example.com"), "new.parent@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("At least 8 characters"), "valid-password");
    expect(screen.getByRole("switch", { name: "Chores household access" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Off Chores" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create Parent Login" })).toBeDisabled();
    await act(async () => directPress(view, "Create Parent Login")());
    expect(household).not.toHaveBeenCalled();
    expect(user).not.toHaveBeenCalled();
    expect(parent).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("rejects retained child mutation handlers after revocation", async () => {
    const create = jest.spyOn(apiClient, "createChild").mockResolvedValue(child);
    const update = jest.spyOn(apiClient, "updateChild").mockResolvedValue(child);
    const account = jest.spyOn(apiClient, "createChildAccount").mockRejectedValue(new Error("blocked test transport"));
    const email = jest.spyOn(apiClient, "resetChildAccountEmail").mockRejectedValue(new Error("blocked test transport"));
    const password = jest.spyOn(apiClient, "resetChildAccountPassword").mockRejectedValue(new Error("blocked test transport"));
    const access = revocableWrapper();
    const { result, rerender } = renderHook(() => ({
      child: useChildMutations({ householdId: 7, loadChildren: async () => {} }),
      account: useChildAccountActions({ children: [child], householdId: 7, selectedChildId: 3 }),
    }), { wrapper: access.wrapper });
    act(() => {
      result.current.child.setNameInput("Avery");
      result.current.account.linkAccount.setPassword("password-one");
      result.current.account.resetEmail.setEmail("new@example.com");
      result.current.account.resetPassword.setPassword("password-two");
      result.current.account.resetPassword.setConfirmation("password-two");
    });
    const stale = result.current;
    access.revoke(); rerender({});
    await act(async () => {
      await stale.child.createChild(); await stale.child.toggleActive(child);
      await stale.account.linkAccount.submit(); await stale.account.resetEmail.submit(); await stale.account.resetPassword.submit();
    });
    for (const write of [create, update, account, email, password]) expect(write).not.toHaveBeenCalled();
  });

  it("rejects retained financial save handlers after revocation", async () => {
    jest.spyOn(apiClient, "listChildBalances").mockResolvedValue([{ child_id: 3, child_name: "Mia", balance_cents: 100 }]);
    jest.spyOn(apiClient, "listChoreTransactions").mockResolvedValue([]);
    const save = jest.spyOn(apiClient, "createChoreTransaction").mockRejectedValue(new Error("blocked test transport"));
    const access = revocableWrapper();
    const { result, rerender } = renderHook(useChoreFinance, { wrapper: access.wrapper });
    await waitFor(() => expect(result.current.childId).toBe(3));
    act(() => result.current.setAmount("2.50"));
    const staleSave = result.current.save;
    access.revoke(); rerender({});
    await act(async () => staleSave());
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects retained chore mutations and a native archive confirmation after revocation", async () => {
    const create = jest.spyOn(apiClient, "createChore").mockResolvedValue(chore);
    const update = jest.spyOn(apiClient, "updateChore").mockResolvedValue(chore);
    const submit = jest.spyOn(apiClient, "createSubmission").mockRejectedValue(new Error("blocked test transport"));
    const complete = jest.spyOn(apiClient, "completeParentTask").mockResolvedValue(undefined);
    const archive = jest.spyOn(apiClient, "archiveChore").mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const access = revocableWrapper();
    const noop = async () => {};
    const { result, rerender } = renderHook(() => useChoreMutations({
      householdId: 7, userId: 2, targetDate: "2026-09-01", selectedChild: child, selectedChoreIds: [11], myTasksError: null,
      clearMyTasksError: jest.fn(), clearSelectedChores: jest.fn(), loadChildrenAndEligible: noop, loadChores: noop, loadMyTasks: noop,
      patchEligibleChildState: jest.fn(), refreshEligibleForChild: noop, setChoresError: jest.fn(), setSelectedSubmitError: jest.fn(), setSelectedSubmitSuccess: jest.fn(),
    }), { wrapper: access.wrapper });
    act(() => { result.current.openEditForm(chore); result.current.confirmArchive(chore); });
    const confirm = alert.mock.calls[0][2]![1].onPress!;
    const stale = result.current;
    access.revoke(); rerender({});
    await act(async () => {
      confirm(); await stale.submitChoreForm(); await stale.quickSubmit(child, eligible); await stale.submitSelected(); await stale.completeParentTask(11);
    });
    for (const write of [create, update, submit, complete, archive]) expect(write).not.toHaveBeenCalled();
  });
});
