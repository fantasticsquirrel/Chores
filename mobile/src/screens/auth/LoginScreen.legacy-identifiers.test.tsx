import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { LoginScreen } from "./LoginScreen";

function renderLoginScreen({
  onChildLogin = jest.fn(async () => undefined),
  onParentLogin = jest.fn(async () => undefined),
} = {}) {
  return {
    onChildLogin,
    onParentLogin,
    ...render(
      <LoginScreen
        apiBaseUrl="https://api.example.test"
        bootstrapError={null}
        onChildLogin={onChildLogin}
        onParentLogin={onParentLogin}
      />,
    ),
  };
}

describe("LoginScreen legacy identifiers", () => {
  it("submits a legacy username through the parent login field", async () => {
    const { onParentLogin } = renderLoginScreen();

    expect(
      screen.getByText(
        "Parents use their email or legacy username and password. Kids can use a parent email or legacy username, their child name, and their child password.",
      ),
    ).toBeTruthy();
    const identifierInput = screen.getByLabelText("Email or Username");
    expect(identifierInput.props.keyboardType).not.toBe("email-address");
    expect(identifierInput.props.textContentType).toBe("username");

    fireEvent.changeText(identifierInput, "legacy-parent");
    fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    fireEvent.press(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(onParentLogin).toHaveBeenCalledWith({
        email: "legacy-parent",
        password: "password123",
      }),
    );
  });

  it("submits a legacy parent username through child login", async () => {
    const { onChildLogin } = renderLoginScreen();

    fireEvent.press(screen.getByRole("button", { name: "Child" }));
    const identifierInput = screen.getByLabelText("Parent Email or Username");
    expect(identifierInput.props.keyboardType).not.toBe("email-address");
    expect(identifierInput.props.textContentType).toBe("username");

    fireEvent.changeText(identifierInput, "legacy-parent");
    fireEvent.changeText(screen.getByLabelText("Child Name"), "Jordan");
    fireEvent.changeText(
      screen.getByLabelText("Child Password"),
      "kid-password-123",
    );
    fireEvent.press(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(onChildLogin).toHaveBeenCalledWith({
        parentEmail: "legacy-parent",
        childName: "Jordan",
        password: "kid-password-123",
      }),
    );
  });
});
