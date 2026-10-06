import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Switch } from 'react-native';

import { apiClient } from '../../api/client';
import type { AuthSessionResponse, NotificationSettings } from '../../api/models';
import { refreshCardStyles } from '../../styles/cards';
import { applyThemeColors, colors, themeIds, type ThemeId } from '../../styles/colors';
import { refreshFormStyles } from '../../styles/forms';
import { refreshShellStyles } from '../../styles/shell';
import { contrastRatio } from '../../test/contrast';
import { NotificationsScreen } from './NotificationsScreen';

const session: AuthSessionResponse = { user: { id: 1, household_id: 27, email: 'parent@example.com', role: 'PARENT', is_household_owner: true } };
const settings: NotificationSettings = { in_app_enabled: true, push_enabled: true, daily_digest_enabled: true, daily_digest_time: '08:00', due_soon_enabled: false, due_soon_hours: 24, approval_notifications_enabled: false, quiet_hours_start: '', quiet_hours_end: '' };
const labels = ['Daily digest time', 'Due soon hours', 'Quiet hours start', 'Quiet hours end'];
const switches = ['In-app notifications', 'Daily chore digest', 'Upcoming chore reminders', 'Submission and approval alerts'];

function apply(theme: ThemeId) {
  applyThemeColors(theme);
  refreshFormStyles();
  refreshCardStyles();
  refreshShellStyles();
}
async function mount() {
  render(<NotificationsScreen modules={[]} session={session} onNavigate={jest.fn()} />);
  await screen.findByText('Chore reminders');
}
beforeEach(() => {
  jest.spyOn(apiClient, 'listNotifications').mockResolvedValue({ items: [], unread_count: 0 });
  jest.spyOn(apiClient, 'getNotificationSettings').mockResolvedValue({ chores: settings });
});
afterEach(() => { jest.restoreAllMocks(); apply('paper-pine'); });

describe.each(themeIds)('notification form contrast: %s', (theme) => {
  it('renders every reminder label with readable runtime text', async () => {
    apply(theme); await mount();
    for (const label of labels) {
      const text = StyleSheet.flatten(screen.getByText(label).props.style);
      expect(text.color).toBe(colors.text);
      expect(contrastRatio(text.color, colors.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('renders reminder values with readable runtime input text', async () => {
    apply(theme); await mount();
    for (const label of labels) {
      const input = screen.getByLabelText(label);
      const style = StyleSheet.flatten(input.props.style);
      expect(style.color).toBe(colors.text);
      expect(style.backgroundColor).toBe(colors.surface);
      expect(contrastRatio(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('uses explicit legible time and hours placeholders', async () => {
    apply(theme); await mount();
    for (const label of labels) {
      const input = screen.getByLabelText(label);
      const style = StyleSheet.flatten(input.props.style);
      expect(input.props.placeholder).toBe(label === 'Due soon hours' ? '1–168' : 'HH:MM');
      expect(input.props.placeholderTextColor).toBe(colors.textSubtle);
      expect(contrastRatio(input.props.placeholderTextColor, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('draws visible resting boundaries for every reminder input', async () => {
    apply(theme); await mount();
    for (const label of labels) {
      const style = StyleSheet.flatten(screen.getByLabelText(label).props.style);
      expect(style.borderWidth).toBeGreaterThanOrEqual(1);
      expect(contrastRatio(style.borderColor, style.backgroundColor)).toBeGreaterThanOrEqual(3);
    }
  });
  it('shows a distinct high-contrast focused input and restores the resting border', async () => {
    apply(theme); await mount();
    for (const label of labels) {
      const input = () => screen.getByLabelText(label);
      const style = () => StyleSheet.flatten(input().props.style);
      const restingBorder = style().borderColor;
      fireEvent(input(), 'focus');
      expect(style().borderColor).not.toBe(restingBorder);
      expect(contrastRatio(style().borderColor, style().backgroundColor)).toBeGreaterThanOrEqual(3);
      fireEvent(input(), 'blur');
      expect(style().borderColor).toBe(restingBorder);
    }
  });
  it('keeps native switch labels, tracks and thumbs legible in both states', async () => {
    apply(theme); await mount();
    for (const label of switches) {
      // Accessibility queries resolve the platform host, which maps trackColor
      // to native tint props. Check the public Switch props on its real wrapper.
      const control = () => screen.UNSAFE_getAllByType(Switch).find((node) => node.props.accessibilityLabel === label)!;
      const text = StyleSheet.flatten(screen.getByText(label).props.style);
      expect(contrastRatio(text.color, colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(control().props.trackColor).toEqual({ false: colors.textSubtle, true: colors.primary });
      expect(control().props.thumbColor).toBe(colors.surface);
      expect(control().props.ios_backgroundColor).toBe(colors.textSubtle);
      for (const track of Object.values(control().props.trackColor) as string[]) {
        expect(contrastRatio(track, colors.surface)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(control().props.thumbColor, track)).toBeGreaterThanOrEqual(3);
      }
      expect(control().props.disabled).toBe(false);
      fireEvent(control(), 'valueChange', true);
      expect(control().props.value).toBe(true);
      fireEvent(control(), 'valueChange', false);
      expect(control().props.value).toBe(false);
    }
  });
});
