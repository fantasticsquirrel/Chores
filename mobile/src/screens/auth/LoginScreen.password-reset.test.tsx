import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

import { ChangePasswordScreen } from "../account/ChangePasswordScreen";
import { LoginScreen } from "./LoginScreen";

const PASSWORD_RESET_URL = "https://family.multihost.ing/chore/forgot-password";

function renderLoginScreen() {
  return render(
    <LoginScreen
      apiBaseUrl="https://api.example.test"
      bootstrapError={null}
      onChildLogin={async () => undefined}
      onParentLogin={async () => undefined}
    />,
  );
}

describe("LoginScreen password recovery", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the fixed recovery URL from the visible parent action", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    renderLoginScreen();

    fireEvent.press(screen.getByRole("button", { name: "Forgot password?" }));

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(PASSWORD_RESET_URL);
  });

  it("guides children to a parent instead of exposing email recovery", () => {
    renderLoginScreen();

    fireEvent.press(screen.getByRole("button", { name: "Child" }));

    expect(
      screen.getByText("Ask a parent for help resetting your password."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Forgot password?" }),
    ).toBeNull();
  });

  it("uses the shared 15-character parent password policy copy", () => {
    render(<ChangePasswordScreen />);

    expect(screen.getByPlaceholderText("At least 15 characters")).toBeTruthy();
  });
});
