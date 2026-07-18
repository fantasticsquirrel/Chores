import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { ActionButton } from "./ActionButton";

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
