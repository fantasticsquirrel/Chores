import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { TextInput } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AddChildPanel } from "../features/children/components/ChildManagementPanels";
import { ChoreForm } from "../features/chores/components/ChoreForm";
import { buildDefaultChoreForm } from "../features/chores/lib/chorePresentation";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { applyThemeColors, colors, themeIds } from "./colors";
import { refreshFormStyles } from "./forms";
import { contrastRatio } from "../test/contrast";
afterEach(() => { applyThemeColors("paper-pine"); refreshFormStyles(); });
describe.each(themeIds)("actual control placeholders in %s", theme => {
  it.each(["children", "chores", "login"])("keeps %s placeholder text readable", feature => {
    applyThemeColors(theme); refreshFormStyles();
    const content = feature === "children" ? <AddChildPanel mutations={{ activeOnCreate: true, createChild: async () => {}, nameInput: "", setActiveOnCreate: jest.fn(), setNameInput: jest.fn(), submitError: null, submitSuccess: null, submitting: false, toggleActive: async () => {}, updatingChildId: null }} /> : feature === "chores" ? <ChoreForm activeChildren={[]} editingId={null} form={buildDefaultChoreForm("2026-10-24")} onCancel={jest.fn()} onSubmit={async () => {}} setField={jest.fn()} setForm={jest.fn()} showInterval={false} submitError={null} submitting={false} /> : <LoginScreen apiBaseUrl="https://example.test/chore-api" bootstrapError={null} onChildLogin={async () => {}} onParentLogin={async () => {}} />;
    const view = render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}>{content}</SafeAreaProvider>);
    const inputs = view.UNSAFE_getAllByType(TextInput).filter(input => input.props.placeholder);
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input.props.placeholderTextColor).toBe(colors.textSubtle);
      expect(contrastRatio(input.props.placeholderTextColor, colors.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
