import { useTheme } from '../theme/ThemeContext';
import { colors } from './colors';

// Opt-in overrides for recipe/reminder controls. Keep shared layout metrics and
// subscribe to runtime theme changes without changing unrelated form consumers.
export function useFormTheme() {
  useTheme();
  return {
    label: { color: colors.text },
    input: {
      backgroundColor: colors.surface,
      color: colors.text,
      borderColor: colors.textSubtle,
    },
    inputFocused: { borderColor: colors.primary },
    row: { backgroundColor: colors.surface, borderColor: colors.textSubtle },
    rowSelected: { backgroundColor: colors.primarySoft },
    title: { color: colors.text },
    help: { color: colors.textSubtle },
    placeholder: colors.textSubtle,
    switchTrack: { false: colors.textSubtle, true: colors.primary },
    switchThumb: colors.surface,
  };
}
