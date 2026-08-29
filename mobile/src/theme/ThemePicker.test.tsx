import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "./ThemeContext";
import { ThemePicker } from "./ThemePicker";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((): Promise<null> => Promise.resolve(null)),
  setItem: jest.fn((): Promise<void> => Promise.resolve()),
}));

describe("ThemePicker", () => {
  it("switches and persists the selected theme", async () => {
    render(<ThemeProvider><ThemePicker /></ThemeProvider>);
    fireEvent.press(screen.getByRole("radio", { name: /Orbit Club/i }));
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith("family-manager-theme", "orbit-club"));
  });
});
