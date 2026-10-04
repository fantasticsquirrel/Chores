import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { Pressable } from "react-native";
import { ModuleAccessProvider } from "../modules/ModuleAccessContext";
import { formStyles } from "../styles/forms";
import { ActionButton } from "./ActionButton";

const module = { key: "chores" as const, name: "Chores", description: "Chores" };

it("disables manage actions visually and accessibly without disabling reads", () => {
  const onPress = jest.fn();
  const view = render(
    <ModuleAccessProvider module={module}>
      <ActionButton requiresManage label="Write" onPress={onPress} />
      <ActionButton label="Refresh" onPress={onPress} />
    </ModuleAccessProvider>,
  );
  const button = view.getByRole("button", { name: "Write" });
  expect(button).toBeDisabled();
  expect(button.props.accessibilityState).toEqual({ disabled: true });
  expect(button.props.style).toEqual(expect.arrayContaining([formStyles.buttonDisabled]));
  const handler = view.UNSAFE_root.findAll((node: {props: {accessibilityRole?: string;onPress?:unknown}}) =>
    node.props.accessibilityRole === "button" && typeof node.props.onPress === "function",
  )[0].props.onPress;
  handler();
  expect(onPress).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole("button", { name: "Refresh" }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it("blocks a retained manage handler after permission is revoked", () => {
  const onPress = jest.fn();
  const view = render(
    <ModuleAccessProvider module={{ ...module, can_manage: true }}>
      <ActionButton requiresManage label="Write" onPress={onPress} />
    </ModuleAccessProvider>,
  );
  const staleHandler = view.UNSAFE_root.findAll((node: { props: Record<string, unknown> }) =>
    node.props.accessibilityRole === "button" && typeof node.props.onPress === "function",
  )[0].props.onPress;
  staleHandler();
  expect(onPress).toHaveBeenCalledTimes(1);
  view.rerender(
    <ModuleAccessProvider module={{ ...module, can_manage: false }}>
      <ActionButton requiresManage label="Write" onPress={onPress} />
    </ModuleAccessProvider>,
  );
  staleHandler();
  expect(onPress).toHaveBeenCalledTimes(1);
});

describe("ActionButton", () => {
  it("renders its label and calls onPress", async () => {
    const onPress = jest.fn();
    const view = await render(
      <ActionButton label="Save changes" onPress={onPress} />,
    );

    fireEvent.press(view.getByRole("button", { name: "Save changes" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("exposes its disabled state and does not call onPress", async () => {
    const onPress = jest.fn();
    const view = await render(
      <ActionButton disabled label="Save changes" onPress={onPress} />,
    );

    const button = view.getByRole("button", { name: "Save changes" });
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
