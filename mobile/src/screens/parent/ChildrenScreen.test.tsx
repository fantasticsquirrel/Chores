import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import { apiClient } from "../../api/client";
import type { AuthSessionResponse, Child, ChildAccount } from "../../api/models";
import { ChildrenScreen } from "./ChildrenScreen";

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

const child: Child = {
  active: true,
  household_id: 7,
  id: 3,
  name: "Mia",
};

const childAccount: ChildAccount = {
  child_id: 3,
  email: "mia@child.local",
  household_id: 7,
  id: 10,
  role: "CHILD",
};

function arrangeSuccessfulLoad() {
  jest.spyOn(apiClient, "listChildren").mockResolvedValue([child]);
}

describe("ChildrenScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads household-scoped children and preserves management payloads", async () => {
    arrangeSuccessfulLoad();
    const createChild = jest
      .spyOn(apiClient, "createChild")
      .mockResolvedValue({ ...child, id: 4, name: "Avery" });
    const updateChild = jest
      .spyOn(apiClient, "updateChild")
      .mockResolvedValue({ ...child, active: false });

    render(<ChildrenScreen session={session} />);

    expect(await screen.findAllByText("Mia")).toHaveLength(2);
    expect(apiClient.listChildren).toHaveBeenCalledWith({ household_id: 7 });

    fireEvent.changeText(screen.getByPlaceholderText("Avery"), "  Avery  ");
    fireEvent.press(screen.getByRole("button", { name: "Create Child" }));
    await waitFor(() =>
      expect(createChild).toHaveBeenCalledWith({
        active: true,
        household_id: 7,
        name: "Avery",
      }),
    );
    expect(await screen.findByText("Child created.")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Set Inactive" }));
    await waitFor(() =>
      expect(updateChild).toHaveBeenCalledWith(3, {
        active: false,
        household_id: 7,
      }),
    );
    expect(await screen.findByText("Mia is now inactive.")).toBeTruthy();
  });

  it("preserves child login linking and credential reset contracts", async () => {
    arrangeSuccessfulLoad();
    const createAccount = jest
      .spyOn(apiClient, "createChildAccount")
      .mockResolvedValue(childAccount);
    const resetEmail = jest
      .spyOn(apiClient, "resetChildAccountEmail")
      .mockResolvedValue({ ...childAccount, email: "new@example.com" });
    const resetPassword = jest
      .spyOn(apiClient, "resetChildAccountPassword")
      .mockResolvedValue(childAccount);

    render(<ChildrenScreen session={session} />);
    await screen.findAllByText("Mia");

    fireEvent.changeText(
      screen.getByPlaceholderText("kid@example.com"),
      "  MIA@EXAMPLE.COM  ",
    );
    fireEvent.changeText(
      screen.getAllByPlaceholderText("At least 8 characters")[0],
      "password-one",
    );
    fireEvent.press(screen.getByRole("button", { name: "Create Login" }));
    await waitFor(() =>
      expect(createAccount).toHaveBeenCalledWith(3, {
        email: "mia@example.com",
        household_id: 7,
        password: "password-one",
      }),
    );
    expect(await screen.findByText(/Linked login created for Mia/)).toBeTruthy();

    fireEvent.changeText(
      screen.getByPlaceholderText("Leave blank to auto-generate"),
      "  NEW@EXAMPLE.COM  ",
    );
    fireEvent.press(screen.getByRole("button", { name: "Reset Email" }));
    await waitFor(() =>
      expect(resetEmail).toHaveBeenCalledWith(3, {
        email: "new@example.com",
        household_id: 7,
      }),
    );

    fireEvent.changeText(
      screen.getAllByPlaceholderText("At least 8 characters")[1],
      "password-two",
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Repeat temporary password"),
      "password-two",
    );
    fireEvent.press(screen.getByRole("button", { name: "Reset Password" }));
    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith(3, {
        household_id: 7,
        new_password: "password-two",
      }),
    );
  });
});
