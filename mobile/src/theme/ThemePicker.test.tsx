import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { adminStyles } from "../features/admin/styles";
import { authStyles } from "../features/auth/styles";
import { homeschoolStyles } from "../features/homeschool/styles";
import { cardStyles } from "../styles/cards";
import { themeDefinitions } from "../styles/colors";
import { formStyles } from "../styles/forms";
import { shellStyles } from "../styles/shell";
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
    const orbitColors = themeDefinitions["orbit-club"].colors;
    expect(shellStyles.safeArea.backgroundColor).toBe(orbitColors.background);
    expect(formStyles.button.backgroundColor).toBe(orbitColors.primary);
    expect(cardStyles.card.backgroundColor).toBe(orbitColors.surface);
    expect(authStyles.loginTitle.color).toBe(orbitColors.text);
    expect(adminStyles.moduleToggleEnabled.backgroundColor).toBe(
      orbitColors.primary,
    );
    expect(homeschoolStyles.calendarCell.borderColor).toBe(orbitColors.border);
  });
});
